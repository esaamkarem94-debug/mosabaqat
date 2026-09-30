import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

/**
 * Initializes and uploads files to Google Drive if credentials exist.
 */
export async function uploadToGoogleDrive(filePath, fileName, mimeType, folderId = '') {
  try {
    const keyPath = path.resolve(process.cwd(), 'google-drive-key.json');
    if (!fs.existsSync(keyPath)) {
      return { success: false, reason: 'Credentials file (google-drive-key.json) not found' };
    }

    const auth = new google.auth.GoogleAuth({
      keyFile: keyPath,
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });

    const drive = google.drive({ version: 'v3', auth });

    const fileMetadata = {
      name: fileName
    };
    if (folderId) {
      fileMetadata.parents = [folderId];
    }

    const media = {
      mimeType: mimeType || 'application/octet-stream',
      body: fs.createReadStream(filePath)
    };

    const res = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink'
    });

    console.log(`[Google Drive] File uploaded successfully: ${res.data.name} (ID: ${res.data.id})`);
    return { success: true, fileId: res.data.id, link: res.data.webViewLink };
  } catch (error) {
    console.error('[Google Drive] Upload failed:', error.message);
    return { success: false, error: error.message };
  }
}
