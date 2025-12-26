const express = require('express');
const router = express.Router();
const categoryController = require('./category.controller');

router.post('/', categoryController.createCategory);
router.get('/', categoryController.getCategories);
router.get('/main', categoryController.getMainCategories);
router.get('/main/paginated', categoryController.getPaginatedMainCategories);
router.get('/homepage', categoryController.getHomepageCategories);
router.get('/featured', categoryController.getFeaturedCategories);
router.get('/megamenu', categoryController.getCategoriesForMegamenu);
router.get('/:id', categoryController.getCategoryById);
router.put('/:id', categoryController.updateCategory);
router.delete('/:id', categoryController.deleteCategory);

module.exports = router;
