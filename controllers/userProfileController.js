const User = require('../models/user');
const Category = require('../models/category');
const Product = require('../models/product')
const bcrypt = require('bcrypt');


exports.getProfilepage = async (req,res) => {
    try { 
        
        const isLoggedIn = req.session.email ? true : false;
        let userDatabase = null;

        if (isLoggedIn) {
            userDatabase = await User.findOne({ email: req.session.email });

            if (userDatabase.isBlocked) {
                req.session.destroy(); 
                return res.render('auth/login', { errorMessage: 'Your account has been blocked. Please contact support.' });
            }
        }
        const user = await User.find()
        const categories = await Category.find();
        const products = await Product.find({ isBlocked: false });
         res.render('user/profile',{user, isLoggedIn, categories, products, userDatabase })
    }
    catch {
        console.err(error)
    }
}


exports.updateProfile = async (req, res) => {
    try {
       
        if (!req.session.email) {
            return res.status(400).json({ success: false, message: 'User is not logged in or session has expired.' });
        }

        const { firstName, lastName, email, phone } = req.body;
      

        const user = await User.findOne({ email: req.session.email });

        if (user) {
            user.firstName = firstName;
            user.lastName = lastName;
            user.email = email;
            user.phone = phone;

            await user.save();

         
            req.session.email = email;

            res.json({ success: true });
        } else {
            res.json({ success: false, message: 'User not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getChangePasswordPage = async (req, res) => {
    try {
        const isLoggedIn = !!req.session.email;

        if (!isLoggedIn) {
            return res.redirect('/auth/login');
        }

        const userDatabase = await User.findOne({ email: req.session.email });

        if (!userDatabase) {
            return res.redirect('/auth/login');
        }

        if (userDatabase.isBlocked) {
            req.session.destroy();
            return res.render('auth/login', { errorMessage: 'Your account has been blocked. Please contact support.' });
        }

        const isGoogleAuth = userDatabase.authProvider === 'google';
        const categories = await Category.find();
        const products = await Product.find({ isBlocked: false });

        res.render('user/changePassword', {
            isGoogleAuth,
            userDatabase,
            categories,
            products,
            isLoggedIn
        });
    } catch (error) {
        console.error("Error loading change password page:", error);
        res.status(500).send('Internal Server Error');
    }
};


exports.changePassword = async (req, res) => {
    try {
      if (!req.session.email) {
        return res.status(400).json({ success: false, message: 'User is not logged in or session has expired.' });
      }
  
      const { currentPassword, newPassword, confirmPassword } = req.body;
  
      if (newPassword !== confirmPassword) {
        return res.status(400).json({ success: false, message: 'New passwords do not match.' });
      }
  
      const user = await User.findOne({ email: req.session.email });
  
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }
  
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
      }
  
      const hashedPassword = await bcrypt.hash(newPassword, 10);
  
      user.password = hashedPassword;
      await user.save();
  
      res.json({ success: true, message: 'Password changed successfully.' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  };
  
