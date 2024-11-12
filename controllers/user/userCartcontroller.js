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

    
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.render('user/cart', {
        isLoggedIn,
        cart: { 
          items: [], 
          originalTotal: 0, 
          deliveryFee: 0, 
          deliveryFeeDisplay: 'Free', 
          total: 0,
          categoryOffer: 0 
        }, 
        message: 'Your cart is empty.',
        products,
        categories,
        userDatabase
      });
    }

  
    const validCartItems = cart.items
      .filter(item => item.productId != null)
      .map(item => ({
        ...item.toObject(),
        productId: {
          _id: item.productId._id,
          name: item.productId.name || 'Product Unavailable',
          price: Number(item.productId.price) || 0,
          discount: Number(item.productId.discount) || 0,
          description: item.productId.description || 'No description available',
          image: Array.isArray(item.productId.image) ? item.productId.image : [],
          category: item.productId.category ? {
            _id: item.productId.category._id,
            name: item.productId.category.name || 'Uncategorized',
            offer: Number(item.productId.category.offer) || 0
          } : { name: 'Uncategorized', offer: 0 }
        }
      }));

  
    if (validCartItems.length !== cart.items.length) {
      cart.items = validCartItems;
      await cart.save();
    }

   
    const originalTotal = validCartItems.reduce((sum, item) => {
      const price = Number(item.productId.price) || 0;
      const discount = Number(item.productId.discount) || 0;
      const quantity = Number(item.quantity) || 0;
      const itemTotal = (price - (price * discount / 100)) * quantity;
      return sum + itemTotal;
    }, 0);

    const categoryOffer = validCartItems.reduce((sum, item) => {
      const price = Number(item.productId.price) || 0;
      const discount = Number(item.productId.discount) || 0;
      const quantity = Number(item.quantity) || 0;
      const categoryOffer = Number(item.productId.category?.offer) || 0;
      const productPriceAfterDiscount = (price - (price * discount / 100)) * quantity;
      return sum + (productPriceAfterDiscount * categoryOffer / 100);
    }, 0);

    const deliveryFee = originalTotal > 500 ? 0 : 50;
    const total = Math.max(0, originalTotal - categoryOffer + deliveryFee);

    const safeCart = {
      items: validCartItems,
      originalTotal: originalTotal.toFixed(2),
      categoryOffer: categoryOffer.toFixed(2),
      deliveryFee,
      deliveryFeeDisplay: deliveryFee === 0 ? 'Free' : `₹${deliveryFee}`,
      total: total.toFixed(2)
    };

    res.render('user/cart', {
      isLoggedIn,
      userDatabase,
      categories,
      cart: safeCart,
      products,
    });

  } catch (error) {
    console.error('Cart error:', error);
    res.status(500).render('error', { 
      message: 'Unable to load cart. Please try again later.',
      error: { status: 500, stack: process.env.NODE_ENV === 'development' ? error.stack : '' }
    });
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
  
      const cart = await Cart.findOne({ userId: userDatabase._id })
        .populate({
          path: 'items.productId',
          populate: {
            path: 'category'
          }
        });
  
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
          return res.status(400).json({ success: false, message: 'out_of_stock' });
        }
  
        if (newQuantity < 1) {
          return res.status(400).json({ 
            success: false, 
            message: 'Cannot decrease quantity below 1' 
          });
        }
  
        item.quantity = newQuantity;
  
        const validCartItems = cart.items
          .filter(item => item.productId != null)
          .map(item => ({
            ...item.toObject(),
            productId: {
              _id: item.productId._id,
              name: item.productId.name || 'Product Unavailable',
              price: Number(item.productId.price) || 0,
              discount: Number(item.productId.discount) || 0,
              description: item.productId.description || 'No description available',
              image: Array.isArray(item.productId.image) ? item.productId.image : [],
              category: item.productId.category ? {
                _id: item.productId.category._id,
                name: item.productId.category.name || 'Uncategorized',
                offer: Number(item.productId.category.offer) || 0
              } : { name: 'Uncategorized', offer: 0 }
            }
          }));
  
        const originalTotal = validCartItems.reduce((sum, item) => {
          const price = Number(item.productId.price) || 0;
          const discount = Number(item.productId.discount) || 0;
          const quantity = Number(item.quantity) || 0;
          const itemTotal = (price - (price * discount / 100)) * quantity;
          return sum + itemTotal;
        }, 0);
  
        const categoryOffer = validCartItems.reduce((sum, item) => {
          const price = Number(item.productId.price) || 0;
          const discount = Number(item.productId.discount) || 0;
          const quantity = Number(item.quantity) || 0;
          const categoryOffer = Number(item.productId.category?.offer) || 0;
          const productPriceAfterDiscount = (price - (price * discount / 100)) * quantity;
          return sum + (productPriceAfterDiscount * categoryOffer / 100);
        }, 0);
  
        const deliveryFee = originalTotal > 500 ? 0 : 50;
        const total = Math.max(0, originalTotal - categoryOffer + deliveryFee);
  
        await cart.save();
  
        return res.json({
          success: true,
          item: {
            quantity: newQuantity,
            productId: {
              price: item.productId.price,
              discount: item.productId.discount
            }
          },
          cart: {
            items: validCartItems,
            originalTotal: originalTotal.toFixed(2),
            categoryOffer: categoryOffer.toFixed(2),
            deliveryFee,
            deliveryFeeDisplay: deliveryFee === 0 ? 'Free' : `₹${deliveryFee}`,
            total: total.toFixed(2)
          }
        });
  
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
  
      const cart = await Cart.findOne({ userId: userDatabase._id })
        .populate({
          path: 'items.productId',
          populate: {
            path: 'category'
          }
        });
  
      if (!cart) {
        return res.status(404).json({ success: false, message: 'Cart not found' });
      }
  
      const item = cart.items.find(item => item.productId._id.toString() === productId);
      if (item) {
        const product = await Product.findById(productId);
        
        // Update the product stock
        product.stock += item.quantity;
        await product.save();
  
        // Remove the item from the cart
        cart.items.pull({ productId });
  
        // Recalculate the cart totals
        const validCartItems = cart.items
          .filter(item => item.productId != null)
          .map(item => ({
            ...item.toObject(),
            productId: {
              _id: item.productId._id,
              name: item.productId.name || 'Product Unavailable',
              price: Number(item.productId.price) || 0,
              discount: Number(item.productId.discount) || 0,
              description: item.productId.description || 'No description available',
              image: Array.isArray(item.productId.image) ? item.productId.image : [],
              category: item.productId.category ? {
                _id: item.productId.category._id,
                name: item.productId.category.name || 'Uncategorized',
                offer: Number(item.productId.category.offer) || 0
              } : { name: 'Uncategorized', offer: 0 }
            }
          }));
  
        const originalTotal = validCartItems.reduce((sum, item) => {
          const price = Number(item.productId.price) || 0;
          const discount = Number(item.productId.discount) || 0;
          const quantity = Number(item.quantity) || 0;
          const itemTotal = (price - (price * discount / 100)) * quantity;
          return sum + itemTotal;
        }, 0);
  
        const categoryOffer = validCartItems.reduce((sum, item) => {
          const price = Number(item.productId.price) || 0;
          const discount = Number(item.productId.discount) || 0;
          const quantity = Number(item.quantity) || 0;
          const categoryOffer = Number(item.productId.category?.offer) || 0;
          const productPriceAfterDiscount = (price - (price * discount / 100)) * quantity;
          return sum + (productPriceAfterDiscount * categoryOffer / 100);
        }, 0);
  
        const deliveryFee = originalTotal > 500 ? 0 : 50;
        const total = Math.max(0, originalTotal - categoryOffer + deliveryFee);
  
        await cart.save();
  
        return res.json({
          success: true,
          cart: {
            items: validCartItems,
            originalTotal: originalTotal.toFixed(2),
            categoryOffer: categoryOffer.toFixed(2),
            deliveryFee,
            deliveryFeeDisplay: deliveryFee === 0 ? 'Free' : `₹${deliveryFee}`,
            total: total.toFixed(2)
          }
        });
      } else {
        return res.status(404).json({ success: false, message: 'Item not found in cart' });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  };