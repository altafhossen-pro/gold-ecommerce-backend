const { uploadSingle, uploadMultiple, handleUploadError, generateFileUrl, deleteFile } = require('../../utils/fileUpload');
const sendResponse = require('../../utils/sendResponse');

// Single file upload
exports.uploadSingleFile = async (req, res) => {
    try {
        uploadSingle(req, res, async (err) => {
            if (err) {
                return handleUploadError(err, req, res, () => {});
            }

            if (!req.file) {
                return sendResponse({
                    res,
                    statusCode: 400,
                    success: false,
                    message: 'No file uploaded'
                });
            }

            const fileUrl = generateFileUrl(req.file.filename);

            return sendResponse({
                res,
                statusCode: 200,
                success: true,
                message: 'File uploaded successfully',
                data: {
                    filename: req.file.filename,
                    originalName: req.file.originalname,
                    size: req.file.size,
                    mimetype: req.file.mimetype,
                    url: fileUrl
                }
            });
        });
    } catch (error) {
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: error.message || 'Server error'
        });
    }
};

// Multiple files upload
exports.uploadMultipleFiles = async (req, res) => {
    try {
        uploadMultiple(req, res, async (err) => {
            if (err) {
                return handleUploadError(err, req, res, () => {});
            }

            if (!req.files || req.files.length === 0) {
                return sendResponse({
                    res,
                    statusCode: 400,
                    success: false,
                    message: 'No files uploaded'
                });
            }

            const uploadedFiles = req.files.map(file => ({
                filename: file.filename,
                originalName: file.originalname,
                size: file.size,
                mimetype: file.mimetype,
                url: generateFileUrl(file.filename)
            }));

            return sendResponse({
                res,
                statusCode: 200,
                success: true,
                message: 'Files uploaded successfully',
                data: uploadedFiles
            });
        });
    } catch (error) {
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: error.message || 'Server error'
        });
    }
};

// Delete file
exports.deleteFile = async (req, res) => {
    try {
        const { filename } = req.params;

        if (!filename) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Filename is required'
            });
        }

        const deleted = deleteFile(filename);

        if (deleted) {
            return sendResponse({
                res,
                statusCode: 200,
                success: true,
                message: 'File deleted successfully'
            });
        } else {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'File not found'
            });
        }
    } catch (error) {
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: error.message || 'Server error'
        });
    }
};
