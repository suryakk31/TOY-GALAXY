const express = require('express');
const router = express.Router();

const adminAuth = require('../middleware/adminMiddleware')

const upload = require('../middleware/multer')

const adminLoginController = require('../controllers/admin/adminLoginController');

const adminDashboard = require('../controllers/admin/adminDashboard')

const adminUserController = require('../controllers/admin/adminUserController');

const adminProductController = require('../controllers/admin/adminProductController');

const adminCategoryController = require('../controllers/admin/adminCategoryController');

const adminOrderController = require('../controllers/admin/adminOrderController')

const adminCouponController = require('../controllers/admin/adminCouponController')

const adminSalesController = require('../controllers/admin/adminSalesreportController')



router.get('/login', adminLoginController.adminLogin);
router.post('/', adminLoginController.loginPost);

router.get('/adminDashboard', adminAuth.isAuthAuthenticated, adminDashboard.getAdminDashboard);


router.get('/userManagement', adminAuth.isAuthAuthenticated, adminUserController.getUserManagementPage);
router.post('/block/:id', adminUserController.blockUser);

router.get('/products', adminAuth.isAuthAuthenticated, adminProductController.getProductpage);
router.get('/products/addProduct', adminAuth.isAuthAuthenticated, adminProductController.addProductpage);
router.post('/products/addProduct', upload.array('image', 10), adminProductController.postAddProductpage);
router.post('/products/:id/toggle', adminProductController.blockProduct); 
router.get('/products/edit/:id', adminAuth.isAuthAuthenticated, adminProductController.getEditProductPage);
router.put('/products/edit/:id', upload.array('image', 10), adminProductController.updateProduct);

router.get('/category', adminAuth.isAuthAuthenticated, adminCategoryController.getCategories);
router.get('/category/addCategory', adminAuth.isAuthAuthenticated, adminCategoryController.addCategory);
router.post('/category/addCategory',adminCategoryController.postAddCategoryPage)

router.get('/category/:id/edit', adminAuth.isAuthAuthenticated, adminCategoryController.editCategory)
router.put('/category/:id/edit',adminCategoryController.updateCategory);

router.post('/category/:id/toggle', adminCategoryController.blockCategory);

router.get('/orders', adminAuth.isAuthAuthenticated, adminOrderController.adminOrder)
router.post('/updateOrderStatus', adminOrderController.updateOrderStatus);


router.get('/coupon', adminAuth.isAuthAuthenticated, adminCouponController.getCouponPage)
router.get('/coupon/:id', adminAuth.isAuthAuthenticated, adminCouponController.getCouponById);
router.post('/coupon', adminCouponController.postCoupon)
router.put('/coupon/:id', adminCouponController.updateCoupon)
router.delete('/coupon/:id' ,adminCouponController.deleteCoupon)


router.get('/sales-report', adminAuth.isAuthAuthenticated, adminSalesController.adminSales)
router.get('/sales-report/download-pdf', adminSalesController.downloadSalesPDF);
router.get('/sales-report/download-excel', adminSalesController.downloadSalesExcel);

router.get('/logout', adminLoginController.adminLogout);

module.exports = router;
