import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import archiver from 'archiver';
import { uploadToGoogleDrive } from './googleDrive.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Load or initialize settings
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
const SUBMISSIONS_DB = path.join(__dirname, 'submissions.json');

function getSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Error reading settings:', err);
  }
  return {
    siteTitle: 'مسابقات',
    siteSubtitle: 'المنصة الرسمية لاستقبال المشاركات ومقاطع الفيديو والصور',
    storagePath: path.join(process.env.USERPROFILE || 'C:\\Users\\redam', 'Downloads', 'مسابقات_المرفوعات'),
    termsAndConditions: [
      'سيتم الإعلان عن الشروط والضوابط التفصيلية للمسابقة قريباً من قبل الإدارة.',
      'يُسمح برفع الصور بصيغ (JPG, PNG, WEBP) والفيديوهات بصيغ (MP4, MOV, MKV, AVI).',
      'يجب إدخال الاسم ورقم الهاتف بشكل صحيح لضمان التواصل مع الفائزين.'
    ],
    categories: ['مسابقة الفيديو وصناعة المحتوى', 'مسابقة التصوير الفوتوغرافي', 'مسابقة التصميم والمونتاج', 'أخرى'],
    googleDrive: { enabled: false, folderId: '', credentialsFile: 'google-drive-key.json' }
  };
}

function saveSettings(settings) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
}

function getSubmissions() {
  try {
    if (fs.existsSync(SUBMISSIONS_DB)) {
      return JSON.parse(fs.readFileSync(SUBMISSIONS_DB, 'utf-8'));
    }
  } catch (err) {
    console.error('Error reading submissions:', err);
  }
  return [];
}

function saveSubmissions(submissions) {
  fs.writeFileSync(SUBMISSIONS_DB, JSON.stringify(submissions, null, 2), 'utf-8');
}

// Ensure download directory exists on user PC
function ensureStorageDirectory() {
  const settings = getSettings();
  const storageDir = settings.storagePath || path.join(process.env.USERPROFILE || 'C:\\Users\\redam', 'Downloads', 'مسابقات_المرفوعات');
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
    console.log(`[Storage] Created storage folder on PC: ${storageDir}`);
  }
  return storageDir;
}

// Multer Storage configured to stream directly into contestant folder
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const baseDir = ensureStorageDirectory();
    
    // Create submission subfolder if not created yet for this request
    if (!req.submissionFolder) {
      const now = new Date();
      const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const safeName = (req.body.name || 'متسابق').replace(/[<>:"/\\|?*]/g, '_').trim();
      const safePhone = (req.body.phone || '0000').replace(/[^0-9+]/g, '');
      const folderName = `${dateStr}_${safeName}_${safePhone}`;
      
      const fullPath = path.join(baseDir, folderName);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
      req.submissionFolder = fullPath;
      req.submissionFolderName = folderName;
    }
    cb(null, req.submissionFolder);
  },
  filename: (req, file, cb) => {
    // Keep original filename or sanitize
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[<>:"/\\|?*]/g, '_');
    const safeFileName = `${Date.now()}_${base}${ext}`;
    cb(null, safeFileName);
  }
});

// Configure upload limits (up to 2GB per file to accommodate high quality videos)
const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024 // 2GB
  },
  fileFilter: (req, file, cb) => {
    // Allow images and videos
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/') || file.originalname.match(/\.(mp4|mov|avi|mkv|wmv|flv|webm|jpg|jpeg|png|gif|webp)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('الملف المرفوع يجب أن يكون صورة أو فيديو'));
    }
  }
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// Serve uploads folder for browser preview
app.use('/preview-files', (req, res, next) => {
  const settings = getSettings();
  express.static(settings.storagePath)(req, res, next);
});

// API: Get site info and current conditions
app.get('/api/settings', (req, res) => {
  const settings = getSettings();
  res.json({ success: true, settings });
});

// API: Update settings (admin)
app.post('/api/settings', (req, res) => {
  try {
    const current = getSettings();
    const updated = {
      ...current,
      ...req.body,
      // Keep storage path verified
      storagePath: req.body.storagePath || current.storagePath
    };
    saveSettings(updated);
    ensureStorageDirectory();
    res.json({ success: true, message: 'تم تحديث الإعدادات وشروط المسابقة بنجاح', settings: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API: Open storage folder on Windows
app.post('/api/open-folder', (req, res) => {
  try {
    const settings = getSettings();
    const folder = settings.storagePath;
    ensureStorageDirectory();
    
    // Windows Explorer command
    exec(`explorer.exe "${folder}"`, (error) => {
      if (error) {
        console.error('Error opening folder:', error);
        return res.status(500).json({ success: false, message: 'تعذر فتح المجلد تلقائياً' });
      }
      res.json({ success: true, message: `تم فتح مجلد التحميلات على جهازك: ${folder}` });
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API: Handle Contestant File Upload
app.post('/api/upload', upload.array('files', 10), async (req, res) => {
  try {
    const { name, phone, category, notes } = req.body;
    const files = req.files || [];

    if (files.length === 0) {
      return res.status(400).json({ success: false, message: 'يرجى اختيار صورة أو فيديو واحد على الأقل للمشاركة!' });
    }

    const settings = getSettings();
    const submissionId = 'SUB-' + Date.now();
    const timestamp = new Date().toISOString();

    const fileRecords = files.map(file => ({
      originalName: file.originalname,
      savedName: file.filename,
      size: file.size,
      mimeType: file.mimetype,
      localPath: file.path,
      previewUrl: `/preview-files/${encodeURIComponent(req.submissionFolderName)}/${encodeURIComponent(file.filename)}`
    }));

    const submissionData = {
      id: submissionId,
      timestamp,
      name: name || 'مشارك مجهول',
      phone: phone || '',
      category: category || 'عام',
      notes: notes || '',
      folderName: req.submissionFolderName,
      folderPath: req.submissionFolder,
      files: fileRecords
    };

    // 1. Write contestant metadata file directly inside the local folder
    if (req.submissionFolder) {
      const metaFilePath = path.join(req.submissionFolder, 'بيانات_المشارك.json');
      fs.writeFileSync(metaFilePath, JSON.stringify(submissionData, null, 2), 'utf-8');
    }

    // 2. Save to submissions database
    const submissions = getSubmissions();
    submissions.unshift(submissionData);
    saveSubmissions(submissions);

    console.log(`[Upload] New submission received from "${name}". Saved to: ${req.submissionFolder}`);

    // 3. Optional: Sync to Google Drive if configured
    if (settings.googleDrive && settings.googleDrive.enabled) {
      (async () => {
        for (const file of files) {
          await uploadToGoogleDrive(
            file.path,
            `${name}_${file.originalname}`,
            file.mimetype,
            settings.googleDrive.folderId
          );
        }
      })().catch(err => console.error('[Google Drive Sync Background Error]:', err));
    }

    res.json({
      success: true,
      message: 'تم استلام مشاركتك وحفظ الملفات بنجاح على الجهاز!',
      submissionId,
      filesCount: files.length,
      savedLocation: req.submissionFolder
    });
  } catch (err) {
    console.error('[Upload Error]:', err);
    res.status(500).json({ success: false, message: 'حدث خطأ أثناء رفع الملفات: ' + err.message });
  }
});

// API: List all submissions (Admin)
app.get('/api/submissions', (req, res) => {
  const submissions = getSubmissions();
  res.json({ success: true, count: submissions.length, submissions });
});

// API: Download all submissions or specific submission as ZIP
app.get('/api/download-zip', (req, res) => {
  const { id } = req.query;
  const settings = getSettings();
  const baseDir = settings.storagePath;

  if (!fs.existsSync(baseDir)) {
    return res.status(404).send('لا توجد مرفوعات حتى الآن.');
  }

  const archive = archiver('zip', { zlib: { level: 9 } });

  res.attachment(id ? `submission-${id}.zip` : 'جميع_مشاركات_المسابقة.zip');
  archive.pipe(res);

  if (id) {
    const submissions = getSubmissions();
    const item = submissions.find(s => s.id === id);
    if (item && fs.existsSync(item.folderPath)) {
      archive.directory(item.folderPath, item.folderName);
    } else {
      return res.status(404).send('المشاركة المطلوبة غير موجودة.');
    }
  } else {
    archive.directory(baseDir, false);
  }

  archive.finalize();
});

// Start the server
ensureStorageDirectory();

app.listen(PORT, '0.0.0.0', () => {
  const settings = getSettings();
  console.log(`=======================================================`);
  console.log(`🎉 موقع "مسابقات" يعمل الآن بنجاح!`);
  console.log(`🔗 الرابط المحلي: http://localhost:${PORT}`);
  console.log(`📂 مجلد حفظ الملفات على جهازك:`);
  console.log(`   ${settings.storagePath}`);
  console.log(`=======================================================`);
});
