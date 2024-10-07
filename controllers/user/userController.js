const User = require('../../models/user');
const Category = require('../../models/category');
const Product = require('../../models/product')


exports.getLandingPage = async (req, res) => {
    try {
        const isLoggedIn = req.session.email ? true : false;
    

        if (isLoggedIn) {
            
            userDatabase = await User.findOne({ email: req.session.email });
            return res.redirect('/auth/homepage');
        }

       
        const categories = await Category.find();
        const products = await Product.find({ isBlocked: false });

        res.render('user/homepage', { isLoggedIn, categories, products });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
};



exports.getHomepage = async (req, res) => {
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

        const categories = await Category.find({ isBlocked: false });
        const products = await Product.find({ isBlocked: false }); 

        res.render('user/homepage', {isLoggedIn, userDatabase, categories, products });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
};


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
        console.log("The request.body from the backend function updateProfile",req.body); 
       
        


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




