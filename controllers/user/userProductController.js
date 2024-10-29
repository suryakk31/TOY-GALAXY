const mongoose = require('mongoose')
const Product = require('../../models/product');
const User = require('../../models/user');
const Category = require('../../models/category');

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
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      
      return res.status(404).render('404', { title: '404: Product Not Found' });
    }
    

    const product = await Product.findById(productId).populate('category');
    const products = await Product.find({ isBlocked: false });
    const categories = await Category.find({ isBlocked: false });

    if (!product) {
      return res.render('404')
    }

    res.render('user/product', { product, userDatabase, products, categories, isLoggedIn });
  } catch (error) {
 
    res.render('500')
  }
};

