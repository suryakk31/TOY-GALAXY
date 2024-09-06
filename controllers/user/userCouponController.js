const User = require('../../models/user');
const Category = require('../../models/category');
const Coupon = require('../../models/coupon')

exports.getCoupon = async(req,res) => {

    const isLoggedIn = req.session.email ? true : false;
    let userDatabase = null;

    if (isLoggedIn) {
        userDatabase = await User.findOne({ email: req.session.email });

        if (userDatabase.isBlocked) {
            req.session.destroy(); 
            return res.render('auth/login', { errorMessage: 'Your account has been blocked. Please contact support.' });
        }
    }

    const categories = await Category.find();
    const coupon = await Coupon.find()

    res.render('user/coupon',{isLoggedIn, userDatabase, categories, coupon})
}