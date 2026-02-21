const { Notification } = require('./notification.model');
const sendResponse = require('../../utils/sendResponse');
const mongoose = require('mongoose');

// Create Notification (Admin Only)
exports.createNotification = async (req, res) => {
    try {
        const { title, message, type, link, expiresAt, isActive } = req.body;

        if (!title || !message) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Title and message are required',
            });
        }

        const notification = new Notification({
            title,
            message,
            type: type || 'info',
            link: link || '',
            expiresAt: expiresAt || null,
            isActive: isActive !== undefined ? isActive : true,
            createdBy: req.user._id // Assuming req.user is populated by auth middleware
        });

        await notification.save();

        return sendResponse({
            res,
            statusCode: 201,
            success: true,
            message: 'Notification created successfully',
            data: notification,
        });
    } catch (error) {
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: error.message || 'Server error',
        });
    }
};

// Get All Notifications (Public/Admin - with filtering and pagination)
exports.getNotifications = async (req, res) => {
    try {
        const { activeOnly, type, page = 1, limit = 10 } = req.query;
        let query = {};

        // Filter by active status
        if (activeOnly === 'true') {
            query.isActive = true;
            query.$or = [
                { expiresAt: null },
                { expiresAt: { $gt: new Date() } }
            ];
        } else if (activeOnly === 'false') {
            query.isActive = false;
        }

        if (type) {
            query.type = type;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await Notification.countDocuments(query);

        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('createdBy', 'name email');

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Notifications fetched successfully',
            data: notifications,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: error.message || 'Server error',
        });
    }
};

// Get Notification Details
exports.getNotificationById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Invalid notification ID',
            });
        }

        const notification = await Notification.findById(id).populate('createdBy', 'name email');

        if (!notification) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Notification not found',
            });
        }

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Notification details fetched successfully',
            data: notification,
        });
    } catch (error) {
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: error.message || 'Server error',
        });
    }
};

// Update Notification (Admin Only)
exports.updateNotification = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Invalid notification ID',
            });
        }

        const notification = await Notification.findByIdAndUpdate(id, updates, { new: true });

        if (!notification) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Notification not found',
            });
        }

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Notification updated successfully',
            data: notification,
        });
    } catch (error) {
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: error.message || 'Server error',
        });
    }
};

// Delete Notification (Admin Only)
exports.deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Invalid notification ID',
            });
        }

        const notification = await Notification.findByIdAndDelete(id);

        if (!notification) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Notification not found',
            });
        }

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Notification deleted successfully',
        });
    } catch (error) {
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: error.message || 'Server error',
        });
    }
};
