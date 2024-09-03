
const User = require('../models/user');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD
    }
});


exports.getSignupPage = (req, res) => {
    res.render('auth/signup');
};


exports.postSignup = async (req, res) => {
    try {
        const { firstName, lastName, email, phone, password, confirmPassword } = req.body;

        if (password !== confirmPassword) {
            return res.render('auth/signup', { errorMessage: 'Passwords do not match' });
        }

        if (!password) {
            return res.render('auth/signup', { errorMessage: 'Password is required' });
        }

        const existingUser = await User.findOne({ email });
        if(existingUser) {
            return res.render('auth/signup',{errorMessage:'User with this email already exists'})
        }
        
        const hash = await bcrypt.hash(password,10)
        const newUser = new User({
            firstName,
            lastName,
            email,
            phone,
            password: hash,
        });

        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        newUser.otp = otp;
        newUser.otpExpiry = Date.now() + 3600000; // 1 hour expiry
        await newUser.save();

        req.session.email = email;

        const mailOptions = {
            from: process.env.EMAIL,
            to: email,
            subject: 'OTP Verification',
            text: `Your OTP is ${otp}`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Error sending OTP email:", error);
                return res.status(500).send('Error sending OTP email');
            }
          
            res.redirect('/auth/verify-otp');
        });

    } catch (error) {
        console.error("Error during signup:", error);
        res.status(500).send('Internal Server Error');
    }
};


exports.getVerifyOtpPage = (req, res) => {
    res.render('auth/verify-otp', { errorMessage: req.flash('error'), successMessage: req.flash('success') });
};


exports.postVerifyOtp = async (req, res) => {
    try {
        const { otp, timer } = req.body;
        const email = req.session.email;

        if (!email) {
            req.flash('error', 'Session expired. Please sign up again.');
            return res.redirect('/auth/signup');
        }

        const user = await User.findOne({ email, otp });

        if (!user) {
            req.flash('error', 'User not found or invalid OTP');
            return res.render('auth/verify-otp', { errorMessage: 'User not found or invalid OTP', timer });
        }

        if (user.otpExpiry < Date.now()) {
            req.flash('error', 'Invalid OTP or OTP expired');
            return res.render('auth/verify-otp', { errorMessage: 'Invalid OTP or OTP expired', timer });
        }

     
        user.otp = undefined;
        user.otpExpiry = undefined;
        await user.save();

        req.session.email = null;

        req.flash('success', 'OTP verified successfully! You can now log in.');
        res.redirect('/auth/login');
    } catch (error) {
        console.error("Error during OTP verification:", error);
        req.flash('error', 'Internal Server Error');
        res.redirect('/auth/verify-otp');
    }
};


exports.resendOtp = async (req, res) => {
    try {
        const email = req.session.email;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Session expired. Please sign up again.' });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ success: false, message: 'User not found' });
        }

        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        user.otp = otp;
        user.otpExpiry = Date.now() + 3600000; // 1 hour expiry
        await user.save();

        const mailOptions = {
            from: process.env.EMAIL,
            to: email,
            subject: 'OTP Verification',
            text: `Your OTP is ${otp}`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Error sending OTP email:", error);
                return res.status(500).json({ success: false, message: 'Error sending OTP email' });
            }
          
            res.json({ success: true, message: 'OTP resent successfully' });
        });

    } catch (error) {
        console.error("Error resending OTP:", error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};




exports.getLoginPage = (req, res) => {
    if(req.session.email){
        return res.redirect('/auth/homepage')
    }
    res.render('auth/login');
};


exports.postLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return res.render('auth/login', { errorMessage: 'Invalid email or password' });
        }

        if (user.isBlocked) {
            req.session.destroy(); 
            return res.render('auth/login', { errorMessage: 'Your account has been blocked. Please contact support.' });
        }


        const isMatch = await bcrypt.compare(password, user.password);
        

        if (!isMatch) {
            return res.render('auth/login', { errorMessage: 'Invalid email or password' });
        }

     
        req.session.email = email;

        res.redirect('/auth/homepage');
    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).send('Internal Server Error');
    }
};



exports.getForgotPasswordPage = (req, res) => {
    res.render('auth/forgot-password',{ errorMessage: null });
};


exports.postForgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.render('auth/forgot-password', { errorMessage: 'No account with that email found.' });
        }

        req.session.resetEmail = email;

        const resetLink = `http://${req.headers.host}/auth/reset-password`; 

        const mailOptions = {
            from: process.env.EMAIL,
            to: email,
            subject: 'Password Reset',
            text: `Click the following link to reset your password: ${resetLink}`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Error sending password reset email:", error);
                return res.status(500).send('Error sending password reset email');
            }
          
            res.render('auth/login', { ErrorMessage: 'Check your email for a password reset link.' });
        });

    } catch (error) {
        console.error("Error during forgot password:", error);
        res.status(500).send('Internal Server Error');
    }
};



exports.getResetPasswordPage = (req, res) => {
    if (!req.session.resetEmail) {
        return res.status(400).send('Session expired. Please try resetting your password again.');
    }
    res.render('auth/reset-password');
};


exports.postResetPassword = async (req, res) => {
    try {
        const { password, confirmPassword } = req.body;

        if (password !== confirmPassword) {
            return res.render('auth/reset-password', { errorMessage: 'Passwords do not match' });
        }

        if (!password) {
            return res.render('auth/reset-password', { errorMessage: 'Password is required' });
        }

        const email = req.session.resetEmail;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).send('User not found.');
        }

        user.password = await bcrypt.hash(password, 10);
        await user.save();

       
        req.session.resetEmail = null;

        res.redirect('/auth/login');
    } catch (error) {
        console.error("Error during password reset:", error);
        res.status(500).send('Internal Server Error');
    }
};




exports.logout = (req, res) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        res.redirect('/');
    });
};
