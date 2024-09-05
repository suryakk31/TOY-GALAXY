const express = require('express')
const router = express.Router();


const userAuth = require('../middleware/userMiddlewear')

const userController =  require('../controllers/user/userController')

const shopController = require('../controllers/user/userShopController')

const productController = require('../controllers/user/userProductController')

const profileController = require('../controllers/user/userProfileController')

const addressController = require('../controllers/user/userAddressController')

const cartController = require('../controllers/user/userCartcontroller');

const userCheckoutController = require('../controllers/user/userCheckoutController');

const userOrderController = require('../controllers/user/userOrderController')

const userOrderdetailsController = require('../controllers/user/userOrderdetailsController')


router.get('/',userController.getLandingPage)
router.get('/auth/homepage', userController.getHomepage)
router.get('/shop',userAuth.isAuthenticated,shopController.getShopPage)
router.get('/product/:id',userAuth.isAuthenticated,productController.getProductPage)


router.get('/profile',userAuth.isAuthenticated,profileController.getProfilepage)
router.put('/auth/updateProfile',profileController.updateProfile)


// Route to display the change password page
router.get('/auth/changePassword', profileController.getChangePasswordPage);

// Route to handle password change logic
router.put('/auth/changePassword', profileController.changePassword);


router.get('/auth/addresses',userAuth.isAuthenticated,addressController.manageAddress);
router.post('/auth/addAddress', addressController.addAddress);

router.get('/auth/addresses/:id',userAuth.isAuthenticated,addressController.getupdateAddress)
router.put('/auth/addresses/:id',addressController.updateAddress)
router.delete('/auth/addresses/:id', addressController.deleteAddress);

router.get('/auth/cart',userAuth.isAuthenticated,cartController.getCart)
router.post('/auth/cart', userAuth.isAuthenticated, cartController.addToCart);

router.put('/auth/cart',  cartController.updateCartQuantity);
router.delete('/auth/cart', cartController.removeProductFromCart)

router.get('/auth/checkout',userCheckoutController.getCheckout)
router.post('/auth/checkout',userCheckoutController.postCheckout)


router.get('/auth/order',userOrderController.getOrderPage)

router.get('/auth/orderDetails/:orderId', userOrderdetailsController.getOrderdetails);

module.exports = router;