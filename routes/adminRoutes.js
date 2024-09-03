const express = require('express');
const router = express.Router();
const upload = require('../middleware/multer')
const adminLoginController = require('../controllers/adminLoginController');
const adminUserController = require('../controllers/adminUserController');
const adminProductController = require('../controllers/adminProductController');
const adminCategoryController = require('../controllers/adminCategoryController');
const adminOrderController = require('../controllers/adminOrderController')


router.get('/login', adminLoginController.adminLogin);
router.post('/', adminLoginController.loginPost);

router.get('/adminDashboard', adminLoginController.adminDashboard);
router.get('/userManagement', adminUserController.getUserManagementPage);
router.post('/block/:id', adminUserController.blockUser);

router.get('/products', adminProductController.getProductpage);
router.get('/products/addProduct', adminProductController.addProductpage);
router.post('/products/addProduct', upload.array('image', 10), adminProductController.postAddProductpage);
router.post('/products/:id/toggle', adminProductController.blockProduct); 
router.get('/products/edit/:id', adminProductController.getEditProductPage);
router.put('/products/edit/:id', upload.array('image', 10), adminProductController.updateProduct);

router.get('/category', adminCategoryController.getCategories);
router.get('/category/addCategory', adminCategoryController.addCategory);
router.post('/category/addCategory',adminCategoryController.postAddCategoryPage)

router.get('/category/:id/edit',adminCategoryController.editCategory)
router.put('/category/:id/edit',adminCategoryController.updateCategory);

router.post('/category/:id/toggle', adminCategoryController.blockCategory);

router.get('/orders',adminOrderController.adminOrder)
router.post('/updateOrderStatus/:id', adminOrderController.updateOrderStatus);


router.get('/logout', adminLoginController.adminLogout);

module.exports = router;
