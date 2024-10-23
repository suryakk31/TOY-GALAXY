const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const passport = require('passport')
const User = require('../models/user')
const userAuth = require('../middleware/userMiddleware')




// Load the Google strategy configuration
require('../config/passport')

// Google OAuth route
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', 
    passport.authenticate('google', { 
        failureRedirect: '/auth/login', 
        failureMessage: true 
    }),
    async (req, res) => {
        try {
            const user = await User.findOne({ email: req.user.email });

            if (user.isBlocked) {
                req.logout((err) => {
                    if (err) {
                        console.error('Error logging out:', err);
                    }
                    req.session.destroy();
                    return res.render('auth/login', { errorMessage: 'Your account has been blocked. Please contact support.' });
                });
            } else {
                req.session.email = req.user.email;
                res.redirect('/auth/homepage');
            }
        } catch (error) {
            console.error('Error during authentication callback:', error);
            res.status(500).send('Internal Server Error');
        }
    }
);


router.get('/login', (req, res) => {
    let error = null;
    if (req.session.messages && req.session.messages.length > 0) {
        error = req.session.messages[0];
        req.session.messages = [];
    }
    authController.getLoginPage(req, res, { error });
});

router.post('/login', authController.postLogin);


router.get('/signup', authController.getSignupPage);

router.post('/signup', authController.postSignup);


router.get('/verify-otp',  authController.getVerifyOtpPage);

// OTP Verification form
router.post('/postverify-otp',authController.postVerifyOtp);



router.post('/resend-otp', authController.resendOtp);



router.get('/forgot-password', authController.getForgotPasswordPage);
router.post('/forgot-password', authController.postForgotPassword);
router.get('/reset-password', authController.getResetPasswordPage);
router.post('/reset-password', authController.postResetPassword);




router.get('/logout',authController.logout)

module.exports = router;

