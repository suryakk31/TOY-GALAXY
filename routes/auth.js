const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const passport = require('passport')
const User = require('../models/user')




// Load the Google strategy configuration
require('../config/passport')

// Google OAuth route
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google OAuth callback route
router.get('/google/callback', 
    passport.authenticate('google', { failureRedirect: '/auth/login' }),
    async (req, res) => {
        try {
            const user = await User.findOne({ email: req.user.email });

            if (user.isBlocked) {
                req.session.destroy(); 
                return res.render('auth/login', { errorMessage: 'Your account has been blocked. Please contact support.' });
            }

           
            req.session.email = req.user.email;
           
           
            res.redirect('/auth/homepage');
        } catch (error) {
            console.error('Error during authentication callback:', error);
            res.status(500).send('Internal Server Error');
        }
    }
);


//Get Login page

router.get('/login', authController.getLoginPage);

// POST Login form
router.post('/login', authController.postLogin);

// GET Signup page
router.get('/signup', authController.getSignupPage);

// POST Signup form
router.post('/signup', authController.postSignup);

// OTP Verification page
router.get('/verify-otp', authController.getVerifyOtpPage);

// OTP Verification form
router.post('/postverify-otp', authController.postVerifyOtp);



router.post('/resend-otp', authController.resendOtp);



router.get('/forgot-password', authController.getForgotPasswordPage);
router.post('/forgot-password', authController.postForgotPassword);
router.get('/reset-password', authController.getResetPasswordPage);
router.post('/reset-password', authController.postResetPassword);




//Logout route

router.get('/logout',authController.logout)

module.exports = router;

