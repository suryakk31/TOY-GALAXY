const User = require('../../models/user');
const Category = require('../../models/category');
const Orders = require('../../models/order')

exports.getOrderPage = async (req, res) => {
    try {
        const isLoggedIn = !!req.session.email;
        const categories = await Category.find();
        let userDatabase = null;
        let orders = [];

        if (isLoggedIn) {
            userDatabase = await User.findOne({ email: req.session.email });

            if (userDatabase.isBlocked) {
                req.session.destroy();
                return res.render('auth/login', { errorMessage: 'Your account has been blocked. Please contact support.' });
            }
            orders = await Orders.find({ userId: userDatabase._id }).populate({
                path: 'items.productId',
                
            });
        }

        res.render('user/order', { isLoggedIn, categories, userDatabase, orders });
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while loading the order page.');
    }
};


