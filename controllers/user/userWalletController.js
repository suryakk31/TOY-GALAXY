const User = require('../../models/user');
const Category = require('../../models/category');
const Product = require('../../models/product');

exports.getWallet = async (req, res) => {
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

    if (!userDatabase) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const categories = await Category.find();
    const products = await Product.find({ isBlocked: false });

    res.render('user/wallet', {
      isLoggedIn,        
      categories,          
      userDatabase, 
      products,       
      walletBalance: userDatabase.wallet.balance, 
    });
  } catch (error) {
    console.error('Error fetching wallet balance:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};
