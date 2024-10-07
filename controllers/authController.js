
const User = require('../models/user');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const Wallet = require('../models/wallet');

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
        const { firstName, lastName, email, phone, password, confirmPassword, referralCode } = req.body;
        console.log("Entire request body:", req.body);

  
        if (password !== confirmPassword) {
            return res.render('auth/signup', { errorMessage: 'Passwords do not match' });
        }
        if (!password) {
            return res.render('auth/signup', { errorMessage: 'Password is required' });
        }
        
      
        const existingUser = await User.findOne({ email });
        if(existingUser) {
            return res.render('auth/signup', {errorMessage: 'User with this email already exists'});
        }
        
  
        const hash = await bcrypt.hash(password, 10);
        const newUser = new User({
            firstName,
            lastName,
            email,
            phone,
            password: hash,
        });
        
        await newUser.generateReferralCode();
        let retries = 5;
        while (retries > 0) {
            try {
                await newUser.save();
                break;
            } catch (error) {
                if(error.code === 11000 && error.keyPattern.referralCode) {
                    console.log("Duplicate referral code detected, generating a new one...");
                    await newUser.generateReferralCode();
                    retries--;
                } else {
                    throw error;
                }
            }
        }
        if (retries === 0) {
            throw new Error('Failed to generate a unique referral code after multiple attempts');
        }

    
        let newUserBonus = 0;
        let referralBonusText = '';
        
     
        const newUserWallet = new Wallet({
            userId: newUser._id,
            balance: 0,
            transactions: []
        });

      
        if(referralCode) {
            const referringUser = await User.findOne({ referralCode });
            if (referringUser) {
                console.log('Valid referral code detected. Processing referral bonuses...');
                
               
                newUserBonus = 50;
                newUserWallet.balance = newUserBonus;
                newUserWallet.transactions.push({
                    type: 'deposit',
                    amount: newUserBonus,
                    description: `Signup bonus for using referral code `
                });
                
               
                let referringUserWallet = await Wallet.findOne({ userId: referringUser._id });
                if (!referringUserWallet) {
                    referringUserWallet = new Wallet({ userId: referringUser._id, balance: 0 });
                }
                const referrerBonus = 100;
                referringUserWallet.balance += referrerBonus;
                referringUserWallet.transactions.push({
                    type: 'deposit',
                    amount: referrerBonus,
                    description: `Referral bonus for user  signing up with your referral code`
                });
                await referringUserWallet.save();
                
                referralBonusText = `You've received a ${newUserBonus} rupees bonus for using a referral code!`;
                console.log(`Referral bonus of ${referrerBonus} rupees added to referring user's wallet.`);
            } else {
                console.log('Invalid referral code provided.');
                referralBonusText = 'The referral code you provided was invalid.';
            }
        }

        
        await newUserWallet.save();

     
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        newUser.otp = otp;
        newUser.otpExpiry = Date.now() + 3600000; // 1 hour expiry
        await newUser.save();
        
        req.session.email = email;
        
      
        const mailOptions = {
            from: process.env.EMAIL,
            to: email,
            subject: '🏰 Welcome to Kids Kastle! ',
            html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Welcome to Kids Kastle</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #FF6600; padding: 20px; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0; text-align: center; font-size: 28px;">Welcome to Kids Kastle! 🏰</h1>
                </div>
                
                <div style="background-color: #FFF2E6; padding: 20px; border-radius: 0 0 10px 10px; border: 2px solid #FF6600; border-top: none;">
                    <p style="font-size: 18px; color: #333333; margin-bottom: 20px;">
                        Hello <span style="color: #FF6600; font-weight: bold;">${firstName}</span>!
                    </p>
                    
                    <div style="background-color: white; padding: 15px; border-radius: 5px; margin-bottom: 20px; border: 1px solid #FF6600;">
                        <p style="font-size: 16px; margin: 0;">Your OTP for account verification is:</p>
                        <h2 style="color: #FF6600; font-size: 32px; margin: 10px 0; text-align: center;">${otp}</h2>
                        <p style="font-size: 14px; color: #666666; margin: 0; text-align: center;">This OTP will expire in 1 hour</p>
                    </div>
                    
                    ${referralBonusText ? `
                    <div style="background-color: white; padding: 15px; border-radius: 5px; margin-bottom: 20px; border: 1px solid #FF6600;">
                        <p style="color: #FF6600; font-size: 18px; font-weight: bold; margin: 0;">${referralBonusText}</p>
                    </div>
                    ` : ''}
                    
                    <div style="background-color: white; padding: 15px; border-radius: 5px; border: 1px solid #FF6600;">
                        <p style="font-size: 16px; margin-bottom: 10px;">Your unique referral code is:</p>
                        <h3 style="color: #FF6600; font-size: 24px; text-align: center; margin: 10px 0; padding: 10px; background-color: #FFF2E6; border-radius: 5px;">${newUser.referralCode}</h3>
                        <p style="font-size: 16px; color: #333333; margin-top: 15px; text-align: center;">
                            Share this code with others and earn <span style="color: #FF6600; font-weight: bold;">100 rupees</span> for each successful referral!
                        </p>
                    </div>
                    
                    <p style="font-size: 16px; color: #666666; margin-top: 20px; text-align: center;">
                        Thank you for joining Kids Kastle! We're excited to have you with us.
                    </p>
                </div>
                
                <div style="text-align: center; margin-top: 20px; color: #666666; font-size: 14px;">
                    <p>If you have any questions, feel free to contact our support team.</p>
                </div>
            </div>
        </body>
        </html>
            `,
            text: `
        Hello ${firstName}!
        
        Welcome to Kids Kastle!
        
        Your OTP for account verification is: ${otp}
        
        ${referralBonusText}
        
        Your unique referral code is: ${newUser.referralCode}
        
        Share this code with others and earn 500 rupees for each successful referral!
        
        This OTP will expire in 1 hour.
        
        Thank you for joining Kids Kastle! We're excited to have you with us.
            `
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
