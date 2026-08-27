const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const os = require('os');
    cb(null, os.tmpdir());
  },
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
  },
});

// Allow-list rather than block-list: anything not explicitly recognized as a safe document/
// image/archive type is rejected, so a new dangerous type doesn't slip through by default.
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
  'application/zip',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.md', '.json',
  '.zip', '.png', '.jpg', '.jpeg', '.gif', '.webp',
]);

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
    return cb(ApiError.badRequest(`File type not allowed: ${file.mimetype || ext}`));
  }
  return cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.upload.maxMb * 1024 * 1024 },
});

module.exports = upload;
