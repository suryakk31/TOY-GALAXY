const User = require("../../models/user");
const Category = require("../../models/category");
const Orders = require("../../models/order");
const Products = require('../../models/product')

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

  try {
      const order = await Orders.findOne({ 'items._id': itemId });

      if (!order) {
          return res.status(404).json({ success: false, message: 'Order not found.', itemId });
      }

      const item = order.items.id(itemId);
      if (!item) {
          return res.status(404).json({ success: false, message: 'Item not found.', itemId });
      }

      if (order.paymentMethod === 'Online payment') {
          const user = await User.findById(order.userId);
          if (user) {
              const refundAmount = order.totalPrice;
              user.wallet.balance += refundAmount;
              user.wallet.transactions.push({
                  amount: refundAmount,
                  description: `Refund for cancelled order #${order._id}`,
                  date: new Date()
              });
              await user.save(); 
          }
      }

      item.orderStatus = 'cancelled';
      item.reason = reason;

      const product = await Products.findById(item.productId);
      if (product) {
          product.stock += item.quantity;
          await product.save();
      }

      await order.save();

      return res.status(200).json({ success: true, message: 'Item has been cancelled successfully.' });

  } catch (error) {
      return res.status(500).json({ 
        success: false, 
        message: 'An error occurred while cancelling the order.', 
        error: error.message,
        itemId,
        productId,
        orderId: order?._id
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

