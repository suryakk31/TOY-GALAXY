const express = require('express');
const router = express.Router();

const adminAuth = require('../middleware/adminMiddleware')

const upload = require('../middleware/multer')

const adminLoginController = require('../controllers/admin/adminLoginController');

const adminUserController = require('../controllers/admin/adminUserController');

const adminProductController = require('../controllers/admin/adminProductController');

const adminCategoryController = require('../controllers/admin/adminCategoryController');

const adminOrderController = require('../controllers/admin/adminOrderController')

const adminCouponController = require('../controllers/admin/adminCouponController')

const adminSalesController = require('../controllers/admin/adminSalesreportController')



router.get('/login', adminLoginController.adminLogin);
router.post('/', adminLoginController.loginPost);

router.get('/adminDashboard', adminAuth.isAuthenticated, adminLoginController.adminDashboard);
router.get('/userManagement', adminAuth.isAuthenticated, adminUserController.getUserManagementPage);
router.post('/block/:id', adminUserController.blockUser);

router.get('/products', adminAuth.isAuthenticated, adminProductController.getProductpage);
router.get('/products/addProduct', adminAuth.isAuthenticated, adminProductController.addProductpage);
router.post('/products/addProduct', upload.array('image', 10), adminProductController.postAddProductpage);
router.post('/products/:id/toggle', adminProductController.blockProduct); 
router.get('/products/edit/:id', adminAuth.isAuthenticated, adminProductController.getEditProductPage);
router.put('/products/edit/:id', upload.array('image', 10), adminProductController.updateProduct);

router.get('/category', adminAuth.isAuthenticated, adminCategoryController.getCategories);
router.get('/category/addCategory', adminAuth.isAuthenticated, adminCategoryController.addCategory);
router.post('/category/addCategory',adminCategoryController.postAddCategoryPage)

router.get('/category/:id/edit', adminAuth.isAuthenticated, adminCategoryController.editCategory)
router.put('/category/:id/edit',adminCategoryController.updateCategory);

router.post('/category/:id/toggle', adminCategoryController.blockCategory);

router.get('/orders', adminAuth.isAuthenticated, adminOrderController.adminOrder)
router.post('/updateOrderStatus', adminOrderController.updateOrderStatus);


router.get('/coupon', adminAuth.isAuthenticated, adminCouponController.getCouponPage)
router.get('/coupon/:id', adminCouponController.getCouponById);
router.post('/coupon', adminCouponController.postCoupon)
router.put('/coupon/:id', adminCouponController.updateCoupon)
router.delete('/coupon/:id' ,adminCouponController.deleteCoupon)


router.get('/sales-report', adminAuth.isAuthenticated, adminSalesController.adminSales)

router.get('/sales-report/pdf', adminSalesController.downloadSalesReportPDF);
router.get('/sales-report/excel', adminSalesController.downloadSalesReportExcel);

router.get('/logout', adminLoginController.adminLogout);

module.exports = router;
