const User = require('../../models/user');
const Category = require('../../models/category');
const Wishlist = require('../../models/wishlist');

exports.getWishlist = async (req, res) => {
  try {
    const isLoggedIn = !!req.session.email;
    const perPage = 5; // Items per page
    const page = parseInt(req.query.page) || 1; // Current page, default to 1

    if (!isLoggedIn) {
      return res.redirect('/login');
    }

    const userDatabase = await User.findOne({ email: req.session.email });

    if (!userDatabase) {
      req.session.destroy();
      return res.redirect('/login');
    }

    if (userDatabase.isBlocked) {
      req.session.destroy();
      return res.render('auth/login', { errorMessage: 'Your account has been blocked. Please contact support.' });
    }

    // Find wishlist items for the user
    const wishlistData = await Wishlist.findOne({ userId: userDatabase._id })
      .populate('items')
      .skip((page - 1) * perPage)
      .limit(perPage);
      
    const wishlistItems = wishlistData ? wishlistData.items : [];

    // Get total wishlist count for pagination
    const totalWishlist = wishlistItems.length;
    const totalPages = Math.ceil(totalWishlist / perPage);

    // Fetch categories if needed
    const categories = await Category.find(); // Ensure correct schema/model

    // Render the wishlist with pagination data
    res.render('user/wishlist', {
      isLoggedIn,
      userDatabase,
      categories,
      wishlistItems,
      currentPage: page,
      totalPages,
      currentPath: '/auth/wishlist'
    });
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    res.status(500).render('error', { message: 'An error occurred while fetching your wishlist. Please try again later.' });
  }
};

exports.addToWishlist = async (req, res) => {
  try {
    const userEmail = req.session.email;
    const { productId } = req.body;

    if (!userEmail) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    // Find the user by email
    const user = await User.findOne({ email: userEmail });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let wishlist = await Wishlist.findOne({ userId: user._id });

    if (!wishlist) {
      wishlist = new Wishlist({ userId: user._id, items: [] });
    }

    const productIndex = wishlist.items.findIndex(item => item.toString() === productId);

    if (productIndex === -1) {
 
      wishlist.items.push(productId);
    } else {

      wishlist.items.splice(productIndex, 1);
    }

    await wishlist.save();
    
    res.json({ 
      added: productIndex === -1,
      message: productIndex === -1 ? 'Product added to wishlist' : 'Product removed from wishlist'
    });

  } catch (error) {
    console.error('Error updating wishlist:', error);
    res.status(500).json({ error: 'Failed to update wishlist', details: error.message });
  }
};




exports.removeFromWishlist = async (req, res) => {
  try {
    const userEmail = req.session.email;
    const { productId } = req.body;

    if (!userEmail) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    const user = await User.findOne({ email: userEmail });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let wishlist = await Wishlist.findOne({ userId: user._id });

    if (!wishlist) {
      return res.status(404).json({ error: 'Wishlist not found' });
    }

   
    wishlist.items = wishlist.items.filter(item => item.toString() !== productId);
    await wishlist.save();

    res.json({ 
      removed: true,
      message: 'Product removed from wishlist'
    });

  } catch (error) {
    console.error('Error removing from wishlist:', error);
    res.status(500).json({ error: 'Failed to remove from wishlist', details: error.message });
  }
};