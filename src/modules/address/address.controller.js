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
