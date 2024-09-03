const Product = require('../models/product');
const User = require('../models/user');
const Category = require('../models/category');

exports.getProductPage = async (req, res) => {
  try {
  
    const isLoggedIn = !!req.session.email;
    let userDatabase = null;

    if (isLoggedIn) {
      userDatabase = await User.findOne({ email: req.session.email });

  
      if (userDatabase.isBlocked) {
        req.session.destroy();
        return res.render('auth/login', { errorMessage: 'Your account has been blocked. Please contact support.' });
      }
    }


    const productId = req.params.id;


    const product = await Product.findById(productId);
    const products = await Product.find({ isBlocked: false });
    const categories = await Category.find({ isBlocked: false });

    if (!product) {
      return res.status(404).send('Product not found');
    }

    res.render('user/product', { product, userDatabase, products, categories, isLoggedIn });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
};

