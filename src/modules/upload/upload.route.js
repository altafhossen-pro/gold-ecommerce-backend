const express = require('express');
const router = express.Router();
const uploadController = require('./upload.controller');

// Upload single file
router.post('/single', uploadController.uploadSingleFile);

// Upload multiple files
router.post('/multiple', uploadController.uploadMultipleFiles);

// Delete file
router.delete('/:filename', uploadController.deleteFile);

module.exports = router;
