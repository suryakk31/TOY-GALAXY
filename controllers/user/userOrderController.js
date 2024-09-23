const User = require('../../models/user');
const Category = require('../../models/category');
const Orders = require('../../models/order');

exports.getOrderPage = async (req, res) => {
    try {
        const isLoggedIn = !!req.session.email;
        const categories = await Category.find();
        let userDatabase = null;
        let orders = [];
        const perPage = 10; 
        const page = parseInt(req.query.page) || 1; 

        if (isLoggedIn) {
            userDatabase = await User.findOne({ email: req.session.email });

            if (userDatabase.isBlocked) {
                req.session.destroy();
                return res.render('auth/login', { errorMessage: 'Your account has been blocked. Please contact support.' });
            }

            const skip = (page - 1) * perPage;

            orders = await Orders.find({ userId: userDatabase._id })
                .populate({
                    path: 'items.productId',
                })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(perPage);


            const totalOrders = await Orders.countDocuments({ userId: userDatabase._id });
            const totalPages = Math.ceil(totalOrders / perPage);

            res.render('user/order', { 
                isLoggedIn, 
                categories, 
                userDatabase, 
                orders, 
                currentPage: page, 
                totalPages 
            });
        } else {
            res.render('user/order', { 
                isLoggedIn, 
                categories, 
                orders, 
                currentPage: 1, 
                totalPages: 1 
            });
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while loading the order page.');
    }
};
