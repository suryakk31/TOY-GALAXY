const User = require('../../models/user');
const Category = require('../../models/category');
const Product = require('../../models/product')
const Wishlist = require('../../models/wishlist')



exports.getWishlist = async (req, res) => {
    try {
      const isLoggedIn = req.session.email ? true : false;
      let userDatabase = null;
      let wishlistItems = [];
  
      if (isLoggedIn) {
        userDatabase = await User.findOne({ email: req.session.email });
  
        if (userDatabase.isBlocked) {
          req.session.destroy();
          return res.render('auth/login', { errorMessage: 'Your account has been blocked. Please contact support.' });
        }
  
        // Get the user's wishlist
        const wishlist = await Wishlist.findOne({ userId: userDatabase._id }).populate('items');
        wishlistItems = wishlist ? wishlist.items : []; 
      }
  
      const categories = await Category.find();
  

      res.render('user/wishlist', {
        title: 'Wishlist',
        isLoggedIn,
        userDatabase,
        categories,
        wishlistItems 
      });
    } catch (error) {
      console.error(error);
      res.status(500).send('Server error');
    }
  };
  


exports.addToWishlist = async (req, res) => {
    try {
      const { productId } = req.body;
  
      // Check if the user is logged in
      if (!req.session.email) {
        return res.status(401).json({ success: false, message: 'Please log in to add items to wishlist.' });
      }
  
      // Find the user's wishlist
      const user = await User.findOne({ email: req.session.email });
      let wishlist = await Wishlist.findOne({ userId: user._id });
  
    
      if (!wishlist) {
        wishlist = new Wishlist({ userId: user._id, items: [] });
      }
  
    
      if (wishlist.items.includes(productId)) {
        return res.status(400).json({ success: false, message: 'Product is already in the wishlist.' });
      }
  

      wishlist.items.push(productId);
      await wishlist.save();
  
      res.json({ success: true, message: 'Product added to wishlist.' });
    } catch (error) {
      console.error('Error adding product to wishlist:', error);
      res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  };