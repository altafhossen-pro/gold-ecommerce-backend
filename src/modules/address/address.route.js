const express = require('express');
const router = express.Router();
const addressController = require('./address.controller');

// Public routes (no authentication required)
router.get('/divisions', addressController.getDivisions);
router.get('/districts/division/:divisionId', addressController.getDistrictsByDivision);
router.get('/upazilas/district/:districtId', addressController.getUpazilasByDistrict);
router.get('/dhaka-city/district/:districtId', addressController.getDhakaCityAreas);

// Get all data routes
router.get('/districts', addressController.getAllDistricts);
router.get('/upazilas', addressController.getAllUpazilas);
router.get('/dhaka-city', addressController.getAllDhakaCityAreas);

module.exports = router;
