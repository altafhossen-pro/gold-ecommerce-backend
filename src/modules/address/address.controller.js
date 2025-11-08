const { Division, District, Upazila, DhakaCity } = require('./address.model');
const sendResponse = require('../../utils/sendResponse');

// Get all divisions
exports.getDivisions = async (req, res) => {
    try {
        const divisions = await Division.find().sort({ name: 1 });
        
        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Divisions retrieved successfully',
            data: divisions
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

// Get districts by division
exports.getDistrictsByDivision = async (req, res) => {
    try {
        const { divisionId } = req.params;
        
        const districts = await District.find({ 
            division_id: divisionId
        }).sort({ name: 1 });
        
        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Districts retrieved successfully',
            data: districts
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

// Get upazilas by district
exports.getUpazilasByDistrict = async (req, res) => {
    try {
        const { districtId } = req.params;
        
        const upazilas = await Upazila.find({ 
            district_id: districtId, 
        }).sort({ name: 1 });
        
        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Upazilas retrieved successfully',
            data: upazilas
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

// Get Dhaka city areas
exports.getDhakaCityAreas = async (req, res) => {
    try {
        const { districtId } = req.params;
        
        const dhakaAreas = await DhakaCity.find({ 
            district_id: districtId, 
        }).sort({ name: 1 });
        
        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Dhaka city areas retrieved successfully',
            data: dhakaAreas
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

// Get all districts
exports.getAllDistricts = async (req, res) => {
    try {
        const districts = await District.find()
            .sort({ name: 1 });
        
        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'All districts retrieved successfully',
            data: districts
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

// Get all upazilas
exports.getAllUpazilas = async (req, res) => {
    try {
        const upazilas = await Upazila.find()
            .sort({ name: 1 });
        
        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'All upazilas retrieved successfully',
            data: upazilas
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

// Get all Dhaka city areas
exports.getAllDhakaCityAreas = async (req, res) => {
    try {
        const dhakaAreas = await DhakaCity.find()
            .sort({ name: 1 });
        
        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'All Dhaka city areas retrieved successfully',
            data: dhakaAreas
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

// ============ ADMIN ENDPOINTS ============

// Admin: Get divisions with pagination and filters
exports.adminGetDivisions = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const isActive = req.query.isActive;

        const skip = (page - 1) * limit;

        // Build query
        const query = {};
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { bn_name: { $regex: search, $options: 'i' } },
                { id: { $regex: search, $options: 'i' } }
            ];
        }
        if (isActive !== undefined) {
            query.isActive = isActive === 'true';
        }

        const [data, total] = await Promise.all([
            Division.find(query)
                .sort({ name: 1 })
                .skip(skip)
                .limit(limit),
            Division.countDocuments(query)
        ]);

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Divisions retrieved successfully',
            data: {
                data,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
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

// Admin: Get districts with pagination and filters
exports.adminGetDistricts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const divisionId = req.query.divisionId;
        const isActive = req.query.isActive;

        const skip = (page - 1) * limit;

        // Build query
        const query = {};
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { bn_name: { $regex: search, $options: 'i' } },
                { id: { $regex: search, $options: 'i' } }
            ];
        }
        if (divisionId) {
            query.division_id = divisionId;
        }
        if (isActive !== undefined) {
            query.isActive = isActive === 'true';
        }

        const [data, total] = await Promise.all([
            District.find(query)
                .sort({ name: 1 })
                .skip(skip)
                .limit(limit),
            District.countDocuments(query)
        ]);

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Districts retrieved successfully',
            data: {
                data,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
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

// Admin: Get upazilas with pagination and filters
exports.adminGetUpazilas = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const districtId = req.query.districtId;
        const isActive = req.query.isActive;

        const skip = (page - 1) * limit;

        // Build query
        const query = {};
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { bn_name: { $regex: search, $options: 'i' } },
                { id: { $regex: search, $options: 'i' } }
            ];
        }
        if (districtId) {
            query.district_id = districtId;
        }
        if (isActive !== undefined) {
            query.isActive = isActive === 'true';
        }

        const [data, total] = await Promise.all([
            Upazila.find(query)
                .sort({ name: 1 })
                .skip(skip)
                .limit(limit),
            Upazila.countDocuments(query)
        ]);

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Upazilas retrieved successfully',
            data: {
                data,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
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

// Admin: Get Dhaka city areas with pagination and filters
exports.adminGetDhakaCityAreas = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const districtId = req.query.districtId;
        const isActive = req.query.isActive;

        const skip = (page - 1) * limit;

        // Build query
        const query = {};
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { bn_name: { $regex: search, $options: 'i' } },
                { city_corporation: { $regex: search, $options: 'i' } }
            ];
        }
        if (districtId) {
            query.district_id = districtId;
        }
        if (isActive !== undefined) {
            query.isActive = isActive === 'true';
        }

        const [data, total] = await Promise.all([
            DhakaCity.find(query)
                .sort({ name: 1 })
                .skip(skip)
                .limit(limit),
            DhakaCity.countDocuments(query)
        ]);

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Dhaka city areas retrieved successfully',
            data: {
                data,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
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

// Admin: Update division (name only)
exports.adminUpdateDivision = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, bn_name, isActive } = req.body;

        const updateData = {};
        if (name !== undefined) updateData.name = name.trim();
        if (bn_name !== undefined) updateData.bn_name = bn_name.trim();
        if (isActive !== undefined) updateData.isActive = isActive;

        const division = await Division.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!division) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Division not found'
            });
        }

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Division updated successfully',
            data: division
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

// Admin: Update district (name only)
exports.adminUpdateDistrict = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, bn_name, isActive } = req.body;

        const updateData = {};
        if (name !== undefined) updateData.name = name.trim();
        if (bn_name !== undefined) updateData.bn_name = bn_name.trim();
        if (isActive !== undefined) updateData.isActive = isActive;

        const district = await District.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!district) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'District not found'
            });
        }

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'District updated successfully',
            data: district
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

// Admin: Update upazila (name only)
exports.adminUpdateUpazila = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, bn_name, isActive } = req.body;

        const updateData = {};
        if (name !== undefined) updateData.name = name.trim();
        if (bn_name !== undefined) updateData.bn_name = bn_name.trim();
        if (isActive !== undefined) updateData.isActive = isActive;

        const upazila = await Upazila.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!upazila) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Upazila not found'
            });
        }

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Upazila updated successfully',
            data: upazila
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

// Admin: Update Dhaka city area (name only)
exports.adminUpdateDhakaCityArea = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, bn_name, city_corporation, isActive } = req.body;

        const updateData = {};
        if (name !== undefined) updateData.name = name.trim();
        if (bn_name !== undefined) updateData.bn_name = bn_name.trim();
        if (city_corporation !== undefined) updateData.city_corporation = city_corporation.trim();
        if (isActive !== undefined) updateData.isActive = isActive;

        const dhakaArea = await DhakaCity.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!dhakaArea) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Dhaka city area not found'
            });
        }

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Dhaka city area updated successfully',
            data: dhakaArea
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

// Admin: Delete Dhaka city area
exports.adminDeleteDhakaCityArea = async (req, res) => {
    try {
        const { id } = req.params;

        const dhakaArea = await DhakaCity.findByIdAndDelete(id);

        if (!dhakaArea) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Dhaka city area not found'
            });
        }

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Dhaka city area deleted successfully',
            data: dhakaArea
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