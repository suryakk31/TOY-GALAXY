const User = require("../../models/user");
const Category = require("../../models/category");
const Orders = require("../../models/order");
const Products = require('../../models/product')
const Wallet = require('../../models/wallet')

exports.getOrderdetails = async (req, res) => {
  try {
    const isLoggedIn = !!req.session.email;
    const categories = await Category.find();

    let userDatabase = null;
    let orders = [];

    if (isLoggedIn) {
      userDatabase = await User.findOne({ email: req.session.email });

      if (userDatabase.isBlocked) {
        req.session.destroy();
        return res.render("auth/login", {
          errorMessage:
            "Your account has been blocked. Please contact support.",
        });
      }

      if (req.params.orderId) {
        const orderId = req.params.orderId;
        const order = await Orders.findById(orderId).populate(
          "items.productId"
        );

        if (!order) {
          return res.status(404).send("Order not found");
        }

        return res.render("user/order_details", {
          isLoggedIn,
          categories,
          userDatabase,
          orders: [order],
          address: order.address,
        });
      }

      orders = await Orders.find({ userId: userDatabase._id }).populate(
        "items.productId"
      );
    }

    res.render("user/order_details", {
      isLoggedIn,
      categories,
      userDatabase,
      orders,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while loading the order page.");
  }
};
exports.cancelOrder = async (req, res) => {
  const { itemId } = req.params;
  const { reason, productId } = req.body;

  let order; 

  try {
   
    order = await Orders.findOne({ 'items._id': itemId });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.', itemId });
    }

    const item = order.items.id(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found.', itemId });
    }


    item.orderStatus = 'cancelled';
    item.cancelReason = reason;


    const product = await Products.findById(item.productId).populate('category');;
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    if (product.stock + item.quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel the item. Insufficient stock to revert this action.',
      });
    }

    product.stock += item.quantity;

    await product.save();

    const productDiscountedPrice = product.price - (product.price * product.discount / 100);

    const categoryOffer = product.category ? product.category.offer : 0;
    console.log(categoryOffer)
    const categoryOfferAmount = (productDiscountedPrice * (categoryOffer / 100));
    
    const finalPriceAfterDiscounts = productDiscountedPrice - categoryOfferAmount;
    
    const refundAmount = finalPriceAfterDiscounts * item.quantity;

    await order.save();

    if (order.paymentMethod === 'Online payment' && item.orderStatus === 'cancelled') {
     
    

      if (typeof refundAmount !== 'number' || isNaN(refundAmount) || refundAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid refund amount. Cannot proceed with wallet refund.',
        });
      }


      let userWallet = await Wallet.findOne({ userId: order.userId });
      if (!userWallet) {
        userWallet = new Wallet({ userId: order.userId, balance: 0 });
      }

    
      userWallet.balance += refundAmount;

     
      userWallet.transactions.push({
        type: 'refund',
        amount: refundAmount,
        description: `Refund for cancelled item in order #${order._id}`,
      });

     
      await userWallet.save();

      return res.status(200).json({
        success: true,
        message: 'Item has been cancelled and refund has been added to the wallet successfully.',
      });
    } else {
      return res.status(200).json({
        success: true,
        message: 'Item has been cancelled successfully.',
      });
    }

  } catch (error) {
    console.error('Error while cancelling the order:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while cancelling the order.',
      error: error.message,
      itemId,
      productId,
      orderId: order ? order._id : null,
    });
  }
};


exports.returnOrder = async (req, res) => {
  const { itemId } = req.body;

  try {
      const updatedOrder = await Orders.findOneAndUpdate(
          { 'items._id': itemId },
          { $set: { 'items.$.orderStatus': 'return requested' } },
          { new: true }
      );
  
      if (!updatedOrder) {
          return res.status(404).send('Order or Item not found');
      }

     
      res.redirect('/auth/order');
  } catch (error) {
      console.error('Error returning order:', error);
      res.status(500).send('Server Error');
  }
};

