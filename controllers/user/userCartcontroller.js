const User = require('../../models/user');
const Product = require('../../models/product');
const Cart = require('../../models/cart');
const Category = require('../../models/category'); 

exports.getCart = async (req, res) => {
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
        return res.redirect('/auth/login');
    }

    const cart = await Cart.findOne({ userId: userDatabase._id })
      .populate({
        path: 'items.productId',
        populate: { path: 'category' }
      });

    const products = await Product.find(); 
    const categories = await Category.find();

    if (!cart || cart.items.length === 0) {
      return res.render('user/cart', {
        isLoggedIn,
        cart: { items: [], originalTotal: 0, deliveryFee: 0, deliveryFeeDisplay: 'Free', total: 0 }, 
        message: 'Your cart is empty.',
        products,
        categories,
        isLoggedIn,
        userDatabase
      });
    }

    const originalTotal = cart.items.reduce((sum, item) => {
      const itemTotal = (item.productId.price - (item.productId.price * item.productId.discount / 100)) * item.quantity;
      return sum + itemTotal;
    }, 0);

    const categoryOffer = cart.items.reduce((sum, item) => {
      if (item.productId.category && item.productId.category.offer) {
        const productPriceAfterDiscount = (item.productId.price - (item.productId.price * item.productId.discount / 100)) * item.quantity;
        const offer = productPriceAfterDiscount * (item.productId.category.offer / 100);
        return sum + offer;
      }
      return sum; 
    }, 0);
    
    // Calculate delivery fee based on original total
    const deliveryFee = originalTotal > 500 ? 0 : 50;
    const deliveryFeeDisplay = deliveryFee === 0 ? 'Free' : `₹${deliveryFee}`;
    
    const total = (originalTotal - categoryOffer + deliveryFee).toFixed(2);

    res.render('user/cart', {
      isLoggedIn,
      userDatabase,
      categories,
      cart: {
        ...cart.toObject(), 
        originalTotal: originalTotal.toFixed(2), 
        categoryOffer: categoryOffer.toFixed(2),
        deliveryFee,
        deliveryFeeDisplay,
        total
      },
      products,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
};


exports.addToCart = async (req, res) => {
    try {
      const { productId } = req.body;
      const userDatabase = await User.findOne({ email: req.session.email });
      if (!userDatabase) {
        return res.status(401).json({ success: false, message: 'User not found' });
      }

      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
  
  
      let cart = await Cart.findOne({ userId: userDatabase._id });
      if (!cart) {
        cart = new Cart({ userId: userDatabase._id, items: [] });
      }
  
      const existingItemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
      if (existingItemIndex > -1) {

        cart.items[existingItemIndex].quantity += 1;
      } else {
       
        cart.items.push({ productId, quantity: 1 });
      }
  
      await cart.save();
    
      res.redirect('/auth/cart');
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  };

  exports.updateCartQuantity = async (req, res) => {
    try {
      const { productId, change } = req.body;
      const userDatabase = await User.findOne({ email: req.session.email });
  
      if (!userDatabase) {
        return res.status(401).json({ success: false, message: 'User not found' });
      }
  
      const cart = await Cart.findOne({ userId: userDatabase._id }).populate('items.productId');
  
      if (!cart) {
        return res.status(404).json({ success: false, message: 'Cart not found' });
      }
  
      const item = cart.items.find(item => item.productId._id.toString() === productId);
  
      if (item) {

        const product = await Product.findById(productId);
        
        if (!product) {
          return res.status(404).json({ success: false, message: 'Product not found' });
        }

        const newQuantity = item.quantity + change;

        if (newQuantity > product.stock) {
          return res.status(400).json({ success: false, message: 'Out of stock' });
        }

        if (newQuantity < 1) {
          return res.status(400).json({ success: false, message: 'Cannot decrease quantity below 1' });
        }

        item.quantity = newQuantity;
  
        
       
        await cart.save();

        return res.json({ success: true, quantity: item.quantity });
      } else {
        return res.status(404).json({ success: false, message: 'Item not found in cart' });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  };
  
  exports.removeProductFromCart = async (req, res) => {
    try {
      const { productId } = req.body;
      const userDatabase = await User.findOne({ email: req.session.email });
      if (!userDatabase) {
        return res.status(401).json({ success: false, message: 'User not found' });
      }
  
      const cart = await Cart.findOne({ userId: userDatabase._id }).populate('items.productId');
  
      if (!cart) {
        return res.status(404).json({ success: false, message: 'Cart not found' });
      }
  
      const item = cart.items.find(item => item.productId._id.toString() === productId);
      if (item) {
        const product = await Product.findById(productId);
  
        product.stock += item.quantity;
        await product.save();
  
        cart.items.pull({ productId });
        await cart.save();
  

  
        return res.json({
          success: true,
      
        });
      } else {
        return res.status(404).json({ success: false, message: 'Item not found in cart' });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  };
  