const express = require('express');
const router = express.Router();
const addressController = require('./address.controller');
const verifyTokenAdmin = require('../../middlewares/verifyTokenAdmin');
const { checkPermission } = require('../../middlewares/checkPermission');

// Public routes (no authentication required)
router.get('/divisions', addressController.getDivisions);
router.get('/districts/division/:divisionId', addressController.getDistrictsByDivision);
router.get('/upazilas/district/:districtId', addressController.getUpazilasByDistrict);
router.get('/dhaka-city/district/:districtId', addressController.getDhakaCityAreas);

// Get all data routes
router.get('/districts', addressController.getAllDistricts);
router.get('/upazilas', addressController.getAllUpazilas);
router.get('/dhaka-city', addressController.getAllDhakaCityAreas);

// Admin routes (require authentication and settings permission)
router.use(verifyTokenAdmin);

// Admin: Get with pagination and filters
router.get('/admin/divisions', checkPermission('settings', 'read'), addressController.adminGetDivisions);
router.get('/admin/districts', checkPermission('settings', 'read'), addressController.adminGetDistricts);
router.get('/admin/upazilas', checkPermission('settings', 'read'), addressController.adminGetUpazilas);
router.get('/admin/dhaka-city', checkPermission('settings', 'read'), addressController.adminGetDhakaCityAreas);

// Admin: Update (require write permission)
router.put('/admin/divisions/:id', checkPermission('settings', 'write'), addressController.adminUpdateDivision);
router.put('/admin/districts/:id', checkPermission('settings', 'write'), addressController.adminUpdateDistrict);
router.put('/admin/upazilas/:id', checkPermission('settings', 'write'), addressController.adminUpdateUpazila);
router.put('/admin/dhaka-city/:id', checkPermission('settings', 'write'), addressController.adminUpdateDhakaCityArea);

// Admin: Delete (require write permission) - Only for Dhaka City
router.delete('/admin/dhaka-city/:id', checkPermission('settings', 'write'), addressController.adminDeleteDhakaCityArea);

module.exports = router;
