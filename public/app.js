// Mosabaqat Client Application

let currentSettings = null;
let selectedFiles = [];
let allSubmissions = [];

// DOM Elements
const rulesListContainer = document.getElementById('rules-list-container');
const categorySelect = document.getElementById('contestant-category');
const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');
const filesPreviewContainer = document.getElementById('files-preview-container');
const filesPreviewList = document.getElementById('files-preview-list');
const filesCountSpan = document.getElementById('files-count');
const clearFilesBtn = document.getElementById('clear-files-btn');
const submissionForm = document.getElementById('submission-form');
const submitBtn = document.getElementById('submit-btn');
const progressWrapper = document.getElementById('upload-progress-wrapper');
const progressBarFill = document.getElementById('progress-bar-fill');
const progressPercentage = document.getElementById('progress-percentage');
const progressStatusText = document.getElementById('progress-status-text');

// Admin Elements
const openLocalFolderBtn = document.getElementById('open-local-folder-btn');
const localStoragePathCode = document.getElementById('local-storage-path');
const submissionsGrid = document.getElementById('submissions-grid');
const submissionsCountSpan = document.getElementById('submissions-count');
const submissionsSearchInput = document.getElementById('submissions-search');
const editRulesModalBtn = document.getElementById('edit-rules-modal-btn');
const rulesModal = document.getElementById('rules-modal');
const rulesTextarea = document.getElementById('rules-textarea');
const saveRulesBtn = document.getElementById('save-rules-btn');
const driveInfoBtn = document.getElementById('drive-info-btn');
const driveModal = document.getElementById('drive-modal');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  fetchSettings();
  fetchSubmissions();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  // Drag and drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(Array.from(e.dataTransfer.files));
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length > 0) {
      handleFilesSelected(Array.from(fileInput.files));
      fileInput.value = ''; // reset so user can select same file again if wanted
    }
  });

  clearFilesBtn.addEventListener('click', () => {
    selectedFiles = [];
    renderFilesPreview();
  });

  // Form submit
  submissionForm.addEventListener('submit', handleFormSubmit);

  // Open local Windows folder
  openLocalFolderBtn.addEventListener('click', async () => {
    try {
      showToast('جاري فتح مجلد المرفوعات على جهازك...', 'success');
      const res = await fetch('/api/open-folder', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
      } else {
        showToast(data.message || 'تعذر فتح المجلد تلقائياً', 'error');
      }
    } catch (err) {
      showToast('خطأ في الاتصال بالخادم', 'error');
    }
  });

  // Search submissions
  submissionsSearchInput.addEventListener('input', (e) => {
    filterSubmissions(e.target.value.trim().toLowerCase());
  });

  // Modals close buttons
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-close');
      document.getElementById(modalId)?.classList.add('hidden');
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', () => {
      overlay.parentElement.classList.add('hidden');
    });
  });

  // Edit rules modal
  editRulesModalBtn.addEventListener('click', () => {
    if (currentSettings && currentSettings.termsAndConditions) {
      rulesTextarea.value = currentSettings.termsAndConditions.join('\n');
    }
    rulesModal.classList.remove('hidden');
  });

  saveRulesBtn.addEventListener('click', handleSaveRules);

  // Drive info modal
  driveInfoBtn.addEventListener('click', () => {
    driveModal.classList.remove('hidden');
  });
}

// Fetch Settings from API
async function fetchSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (data.success) {
      currentSettings = data.settings;
      renderSettings(data.settings);
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

// Render Settings
function renderSettings(settings) {
  if (settings.siteTitle) {
    document.getElementById('nav-site-title').textContent = settings.siteTitle;
    document.title = settings.siteTitle + ' | رفع المشاركات';
  }
  if (settings.siteSubtitle) {
    document.getElementById('hero-subtitle').textContent = settings.siteSubtitle;
  }
  if (settings.storagePath) {
    localStoragePathCode.textContent = settings.storagePath;
  }

  // Render Rules
  if (settings.termsAndConditions && settings.termsAndConditions.length > 0) {
    rulesListContainer.innerHTML = settings.termsAndConditions.map((rule, idx) => `
      <div class="rule-item">
        <span class="rule-number">${idx + 1}</span>
        <span class="rule-text">${escapeHtml(rule)}</span>
      </div>
    `).join('');
  } else {
    rulesListContainer.innerHTML = `
      <div class="rule-item">
        <span class="rule-number">1</span>
        <span class="rule-text">سيتم الإعلان عن شروط المسابقة قريباً.</span>
      </div>
    `;
  }

  // Render Categories
  if (settings.categories && settings.categories.length > 0) {
    categorySelect.innerHTML = settings.categories.map(cat => `
      <option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>
    `).join('');
  }
}

// Handle File Selection
function handleFilesSelected(newFiles) {
  for (const file of newFiles) {
    // Check if duplicate
    const exists = selectedFiles.some(f => f.name === file.name && f.size === file.size);
    if (!exists) {
      selectedFiles.push(file);
    }
  }
  renderFilesPreview();
}

// Format file size
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Render selected files
function renderFilesPreview() {
  if (selectedFiles.length === 0) {
    filesPreviewContainer.classList.add('hidden');
    return;
  }

  filesPreviewContainer.classList.remove('hidden');
  filesCountSpan.textContent = selectedFiles.length;
  filesPreviewList.innerHTML = '';

  selectedFiles.forEach((file, index) => {
    const card = document.createElement('div');
    card.className = 'preview-card';

    const isVideo = file.type.startsWith('video/') || file.name.match(/\.(mp4|mov|avi|mkv|wmv|flv|webm)$/i);
    const isImage = file.type.startsWith('image/');

    let thumbContent = '';
    if (isImage) {
      const url = URL.createObjectURL(file);
      thumbContent = `<img src="${url}" alt="${escapeHtml(file.name)}">`;
    } else if (isVideo) {
      thumbContent = `
        <div class="video-icon-badge">
          <i class="fa-solid fa-film"></i>
          <span>مقطع فيديو</span>
        </div>
      `;
    } else {
      thumbContent = `
        <div class="video-icon-badge">
          <i class="fa-solid fa-file"></i>
          <span>ملف</span>
        </div>
      `;
    }

    card.innerHTML = `
      <button type="button" class="preview-remove-btn" title="حذف">&times;</button>
      <div class="preview-thumb">${thumbContent}</div>
      <div class="preview-info">
        <span class="preview-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
        <span class="preview-size">${formatBytes(file.size)}</span>
      </div>
    `;

    card.querySelector('.preview-remove-btn').addEventListener('click', () => {
      selectedFiles.splice(index, 1);
      renderFilesPreview();
    });

    filesPreviewList.appendChild(card);
  });
}

// Handle Form Submission with XHR Progress
function handleFormSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('contestant-name').value.trim();
  const phone = document.getElementById('contestant-phone').value.trim();
  const category = categorySelect.value;
  const notes = document.getElementById('contestant-notes').value.trim();

  if (!name || !phone) {
    showToast('يرجى كتابة الاسم ورقم الهاتف بالكامل', 'error');
    return;
  }

  if (selectedFiles.length === 0) {
    showToast('يرجى اختيار صورة أو فيديو واحد على الأقل للمشاركة!', 'error');
    return;
  }

  // Prepare FormData
  const formData = new FormData();
  formData.append('name', name);
  formData.append('phone', phone);
  formData.append('category', category);
  formData.append('notes', notes);

  selectedFiles.forEach(file => {
    formData.append('files', file);
  });

  // UI state: uploading
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الرفع والنقل للجهاز...';
  progressWrapper.classList.remove('hidden');
  progressBarFill.style.width = '0%';
  progressPercentage.textContent = '0%';
  progressStatusText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري نقل الملفات وتخزينها على جهازك...';

  // Use XMLHttpRequest to get upload progress
  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/upload', true);

  xhr.upload.onprogress = (event) => {
    if (event.lengthComputable) {
      const percentComplete = Math.round((event.loaded / event.total) * 100);
      progressBarFill.style.width = percentComplete + '%';
      progressPercentage.textContent = percentComplete + '%';
      if (percentComplete === 100) {
        progressStatusText.innerHTML = '<i class="fa-solid fa-check"></i> اكتمل الرفع! جاري حفظ الملفات وتنظيمها في مجلد التحميلات...';
      }
    }
  };

  xhr.onload = () => {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> إرسال المشاركة ورفع الملفات';

    try {
      const data = JSON.parse(xhr.responseText);
      if (xhr.status === 200 && data.success) {
        showToast('🎉 تم استلام مشاركتك ونزول الملفات على جهازك بنجاح!', 'success');
        // Reset form
        submissionForm.reset();
        selectedFiles = [];
        renderFilesPreview();
        setTimeout(() => {
          progressWrapper.classList.add('hidden');
        }, 3000);
        // Refresh submissions
        fetchSubmissions();
      } else {
        showToast(data.message || 'حدث خطأ أثناء الرفع', 'error');
        progressWrapper.classList.add('hidden');
      }
    } catch (err) {
      showToast('خطأ في معالجة استجابة الخادم', 'error');
      progressWrapper.classList.add('hidden');
    }
  };

  xhr.onerror = () => {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> إرسال المشاركة ورفع الملفات';
    progressWrapper.classList.add('hidden');
    showToast('فشل الاتصال بالخادم، تأكد من تشغيل الخادم', 'error');
  };

  xhr.send(formData);
}

// Fetch Submissions (Admin)
async function fetchSubmissions() {
  try {
    const res = await fetch('/api/submissions');
    const data = await res.json();
    if (data.success) {
      allSubmissions = data.submissions || [];
      renderSubmissions(allSubmissions);
    }
  } catch (err) {
    console.error('Failed to load submissions:', err);
  }
}

// Render Submissions
function renderSubmissions(submissions) {
  submissionsCountSpan.textContent = submissions.length;

  if (submissions.length === 0) {
    submissionsGrid.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-box-open"></i>
        <p>لا توجد مشاركات مستلمة حتى الآن. ستظهر هنا فور رفعها من قبل المتسابقين.</p>
      </div>
    `;
    return;
  }

  submissionsGrid.innerHTML = submissions.map(sub => {
    const dateFormatted = new Date(sub.timestamp).toLocaleString('ar-EG', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    const cleanPhone = (sub.phone || '').replace(/[^0-9]/g, '');
    const waLink = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone}` : '#';

    const filesHtml = (sub.files || []).map(f => {
      const isVideo = f.mimeType?.startsWith('video/') || f.savedName.match(/\.(mp4|mov|avi|mkv|webm)$/i);
      const isImage = f.mimeType?.startsWith('image/') || f.savedName.match(/\.(jpg|jpeg|png|webp|gif)$/i);

      if (isVideo) {
        return `
          <div class="sub-file-card">
            <video controls preload="metadata">
              <source src="${f.previewUrl}" type="${f.mimeType || 'video/mp4'}">
              متصفحك لا يدعم تشغيل الفيديو.
            </video>
            <div class="sub-file-label">
              <span title="${escapeHtml(f.originalName)}"><i class="fa-solid fa-video"></i> ${escapeHtml(f.originalName)}</span>
              <span>${formatBytes(f.size)}</span>
            </div>
          </div>
        `;
      } else if (isImage) {
        return `
          <div class="sub-file-card">
            <a href="${f.previewUrl}" target="_blank">
              <img src="${f.previewUrl}" alt="${escapeHtml(f.originalName)}" loading="lazy">
            </a>
            <div class="sub-file-label">
              <span title="${escapeHtml(f.originalName)}"><i class="fa-solid fa-image"></i> ${escapeHtml(f.originalName)}</span>
              <span>${formatBytes(f.size)}</span>
            </div>
          </div>
        `;
      } else {
        return `
          <div class="sub-file-card">
            <div style="height:150px; display:flex; align-items:center; justify-content:center; color:white;">
              <i class="fa-solid fa-file" style="font-size:2rem;"></i>
            </div>
            <div class="sub-file-label">
              <span>${escapeHtml(f.originalName)}</span>
              <span>${formatBytes(f.size)}</span>
            </div>
          </div>
        `;
      }
    }).join('');

    return `
      <div class="submission-card">
        <div class="submission-meta">
          <div class="contestant-badge">
            <div class="avatar-circle">${escapeHtml((sub.name || 'م').slice(0, 1))}</div>
            <div>
              <div class="contestant-name">${escapeHtml(sub.name)}</div>
              <div class="contestant-details">
                <span><i class="fa-regular fa-clock"></i> ${dateFormatted}</span>
                ${cleanPhone ? `<a href="${waLink}" target="_blank"><i class="fa-brands fa-whatsapp"></i> ${escapeHtml(sub.phone)}</a>` : ''}
              </div>
            </div>
          </div>
          <div>
            <span class="submission-category">${escapeHtml(sub.category || 'عام')}</span>
          </div>
        </div>

        ${sub.notes ? `<div class="submission-notes"><i class="fa-solid fa-quote-right"></i> ${escapeHtml(sub.notes)}</div>` : ''}

        <div class="submission-files-grid">
          ${filesHtml}
        </div>
      </div>
    `;
  }).join('');
}

// Filter Submissions
function filterSubmissions(query) {
  if (!query) {
    renderSubmissions(allSubmissions);
    return;
  }
  const filtered = allSubmissions.filter(s => 
    (s.name && s.name.toLowerCase().includes(query)) ||
    (s.phone && s.phone.includes(query)) ||
    (s.category && s.category.toLowerCase().includes(query)) ||
    (s.notes && s.notes.toLowerCase().includes(query))
  );
  renderSubmissions(filtered);
}

// Save Rules from Modal
async function handleSaveRules() {
  const lines = rulesTextarea.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) {
    showToast('يرجى كتابة شرط واحد على الأقل', 'error');
    return;
  }

  saveRulesBtn.disabled = true;
  saveRulesBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الحفظ...';

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ termsAndConditions: lines })
    });
    const data = await res.json();
    if (data.success) {
      showToast('تم حفظ شروط المسابقة بنجاح!', 'success');
      currentSettings = data.settings;
      renderSettings(data.settings);
      rulesModal.classList.add('hidden');
    } else {
      showToast(data.message || 'فشل في حفظ الشروط', 'error');
    }
  } catch (err) {
    showToast('خطأ في الاتصال بالخادم', 'error');
  } finally {
    saveRulesBtn.disabled = false;
    saveRulesBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> حفظ الشروط';
  }
}

// Toast helper
let toastTimeout = null;
function showToast(message, type = 'success') {
  if (toastTimeout) clearTimeout(toastTimeout);
  toastMessage.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');

  toastTimeout = setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}

// Escape HTML helper
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
