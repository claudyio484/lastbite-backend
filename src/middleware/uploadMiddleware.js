'use strict';

const multer = require('multer');
const path = require('path');

/**
 * Allowed MIME types mapped to their expected file extensions.
 * Both the MIME type AND the file extension must match for a file to be accepted.
 */
const ALLOWED_TYPES = {
  'text/csv': ['.csv'],
  'application/vnd.ms-excel': ['.csv', '.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
};

/** Maximum upload size: 10 MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Multer file filter that validates both MIME type and file extension.
 * Rejects files that do not match the allowed combinations.
 *
 * @param {import('express').Request} _req
 * @param {Express.Multer.File} file
 * @param {function} cb
 */
function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;

  const allowedExtensions = ALLOWED_TYPES[mime];
  if (!allowedExtensions) {
    return cb(
      new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'file'),
    );
  }

  if (!allowedExtensions.includes(ext)) {
    return cb(
      new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'file'),
    );
  }

  cb(null, true);
}

/**
 * Configured multer instance for CSV/XLSX file uploads.
 * - Storage: memory (buffer) — no disk writes on serverless
 * - Max file size: 10 MB
 * - Validates MIME type AND file extension
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

/**
 * Express middleware that handles a single file upload on field "file".
 * Wraps multer to convert MulterError into a structured JSON response.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function uploadSingle(req, res, next) {
  const handler = upload.single('file');

  handler(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          error: 'FILE_TOO_LARGE',
          message: 'File size exceeds the 10 MB limit',
        });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(415).json({
          success: false,
          error: 'UNSUPPORTED_FILE_TYPE',
          message: 'Only CSV (.csv) and Excel (.xlsx) files are accepted',
        });
      }
      return res.status(400).json({
        success: false,
        error: 'UPLOAD_ERROR',
        message: err.message,
      });
    }
    if (err) {
      return next(err);
    }
    next();
  });
}

module.exports = { uploadSingle };
