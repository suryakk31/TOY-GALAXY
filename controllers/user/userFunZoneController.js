const User = require('../../models/user');
const Category = require('../../models/category');
const Product = require('../../models/product')


exports.getFun = async (req, res) => {
    try {
        const isLoggedIn = !!req.session.email;
        let userDatabase = null;

     

        if (isLoggedIn) {
            userDatabase = await User.findOne({ email: req.session.email });

            if (!userDatabase) {
                req.session.destroy();
                return res.render('auth/login', { errorMessage: 'User not found. Please log in again.' });
            }

            if (userDatabase.isBlocked) {
                req.session.destroy(); 
                return res.render('auth/login', { errorMessage: 'Your account has been blocked. Please contact support.' });
            }
            
        
            
        }

        const categories = await Category.find({ isBlocked: false });
        const products = await Product.find({ isBlocked: false }); 

        res.render('user/funZone', {isLoggedIn, userDatabase, categories, products });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
};