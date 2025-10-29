const express = require('express');
const router = express.Router();
const roleController = require('./role.controller');
const verifyTokenAdmin = require('../../middlewares/verifyTokenAdmin');

// All role routes require admin authentication
router.use(verifyTokenAdmin);

// Get all permissions (for role assignment UI)
router.get('/permissions', roleController.getPermissions);

// Role CRUD routes
router.get('/', roleController.getRoles);
router.get('/:id', roleController.getRoleById);
router.post('/', roleController.createRole);
router.put('/:id', roleController.updateRole);
router.patch('/:id', roleController.updateRole);
router.delete('/:id', roleController.deleteRole);

module.exports = router;

