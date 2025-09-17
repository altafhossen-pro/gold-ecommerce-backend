const { Testimonial } = require('./testimonial.model');
const sendResponse = require('../../utils/sendResponse');

// Get all testimonials
const getAllTestimonials = async (req, res) => {
    try {
        const { page = 1, limit = 10, isActive, sort } = req.query;
        
        let query = {};
        if (isActive !== undefined) {
            query.isActive = isActive === 'true';
        }

        // Handle sorting
        let sortQuery = { order: 1, createdAt: -1 };
        if (sort === 'order') {
            sortQuery = { order: -1 }; // Descending order to get highest first
        }

        const testimonials = await Testimonial.find(query)
            .sort(sortQuery)
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Testimonial.countDocuments(query);

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Testimonials retrieved successfully',
            data: {
                testimonials,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / limit),
                    totalItems: total,
                    itemsPerPage: parseInt(limit)
                }
            }
        });
    } catch (error) {
        console.error('Error getting testimonials:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get single testimonial
const getTestimonialById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const testimonial = await Testimonial.findById(id);
        
        if (!testimonial) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Testimonial not found'
            });
        }

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Testimonial retrieved successfully',
            data: { testimonial }
        });
    } catch (error) {
        console.error('Error getting testimonial:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Internal server error'
        });
    }
};

// Create testimonial
const createTestimonial = async (req, res) => {
    try {
        const { profilePic, name, designation, rating, reviewText, isActive = true, order = 0 } = req.body;

        // Validation
        if (!profilePic || !name || !rating || !reviewText) {
            return sendResponse({
            res,
            statusCode: 400,
            success: false,
            message: 'Profile picture, name, rating, and review text are required'
        });
        }

        if (rating < 1 || rating > 5) {
            return sendResponse({
            res,
            statusCode: 400,
            success: false,
            message: 'Rating must be between 1 and 5'
        });
        }

        // Get the highest order number and add 1
        let finalOrder = order;
        if (!order || order <= 0) {
            const highestOrderTestimonial = await Testimonial.findOne({}, {}, { sort: { order: -1 } });
            finalOrder = highestOrderTestimonial ? highestOrderTestimonial.order + 1 : 1;
        }

        const testimonial = new Testimonial({
            profilePic,
            name,
            designation,
            rating,
            reviewText,
            isActive,
            order: finalOrder
        });

        await testimonial.save();

        return sendResponse({
            res,
            statusCode: 201,
            success: true,
            message: 'Testimonial created successfully',
            data: { testimonial }
        });
    } catch (error) {
        console.error('Error creating testimonial:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Internal server error'
        });
    }
};

// Update testimonial
const updateTestimonial = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Validate rating if provided
        if (updateData.rating && (updateData.rating < 1 || updateData.rating > 5)) {
            return sendResponse({
            res,
            statusCode: 400,
            success: false,
            message: 'Rating must be between 1 and 5'
        });
        }

        const testimonial = await Testimonial.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!testimonial) {
            return sendResponse({
            res,
            statusCode: 404,
            success: false,
            message: 'Testimonial not found'
        });
        }

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Testimonial updated successfully',
            data: { testimonial }
        });
    } catch (error) {
        console.error('Error updating testimonial:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Internal server error'
        });
    }
};

// Delete testimonial
const deleteTestimonial = async (req, res) => {
    try {
        const { id } = req.params;

        const testimonial = await Testimonial.findByIdAndDelete(id);

        if (!testimonial) {
            return sendResponse({
            res,
            statusCode: 404,
            success: false,
            message: 'Testimonial not found'
        });
        }

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Testimonial deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting testimonial:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Internal server error'
        });
    }
};

// Toggle testimonial status
const toggleTestimonialStatus = async (req, res) => {
    try {
        const { id } = req.params;

        const testimonial = await Testimonial.findById(id);
        
        if (!testimonial) {
            return sendResponse({
            res,
            statusCode: 404,
            success: false,
            message: 'Testimonial not found'
        });
        }

        testimonial.isActive = !testimonial.isActive;
        await testimonial.save();

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Testimonial status updated successfully',
            data: { testimonial }
        });
    } catch (error) {
        console.error('Error toggling testimonial status:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get active testimonials for frontend
const getActiveTestimonials = async (req, res) => {
    try {
        const testimonials = await Testimonial.find({ isActive: true })
            .sort({ order: 1, createdAt: -1 })
            .select('profilePic name designation rating reviewText');

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Active testimonials retrieved successfully',
            data: { testimonials }
        });
    } catch (error) {
        console.error('Error getting active testimonials:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    getAllTestimonials,
    getTestimonialById,
    createTestimonial,
    updateTestimonial,
    deleteTestimonial,
    toggleTestimonialStatus,
    getActiveTestimonials
};
