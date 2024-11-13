const User = require("../../models/user");
const Category = require("../../models/category");
const Orders = require("../../models/order");
const Products = require('../../models/product')
const Wallet = require('../../models/wallet')
const Razorpay = require('razorpay')
const nodemailer = require('nodemailer')
const moment = require('moment');

require('dotenv').config();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

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
                    errorMessage: "Your account has been blocked. Please contact support.",
                });
            }

            if (req.params.orderId) {
                const orderId = req.params.orderId;
                const order = await Orders.findById(orderId).populate("items.productId");

                if (!order) {
                    return res.status(404).send("Order not found");
                }

                return res.render("user/order_details", {
                    isLoggedIn,
                    categories,
                    userDatabase,
                    orders: [order],
                    address: order.address,
                    razorpayKeyId: process.env.RAZORPAY_KEY_ID
                });
            }

            orders = await Orders.find({ 
                userId: userDatabase._id 
            }).populate("items.productId");
        }

        res.render("user/order_details", {
            isLoggedIn,
            categories,
            userDatabase,
            orders,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("An error occurred while loading the order page.");
    }
};



exports.retryPayment = async (req, res) => {
  try {
      const { orderId } = req.params;
      const order = await Orders.findById(orderId);

      if (!order) {
          return res.status(404).json({ error: 'Order not found' });
      }
      const item = order.items.find(item => item.paymentStatus === 'failed');
      if (!item) {
        return res.status(400).json({ error: 'Payment retry is not applicable for this order' });
      }
      const amountInPaise = Math.round(amount * 100);

      const options = {
          amount: amountInPaise, 
          currency: "INR",
          receipt: `receipt_${new Date().getTime()}`,
          payment_capture: 1
      };

      const razorpayOrder = await razorpay.orders.create(options);

      res.status(200).json({
          id: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          key_id: process.env.RAZORPAY_KEY_ID
      });
  } catch (error) {
      console.error('Error creating Razorpay order for retry:', error);
      res.status(500).json({ error: 'Server error while creating Razorpay order for retry' });
  }
};

exports.updatePaymentStatus = async (req, res) => {
  try {
      const { orderId } = req.params;
      const { paymentId, paymentStatus } = req.body;

      const order = await Orders.findById(orderId);

      if (!order) {
          return res.status(404).json({ error: 'Order not found' });
      }

      let stockUpdated = false;
      let emailToSend = false;
      let paymentItem = null;

      for (const item of order.items) {
        if (item.paymentStatus === 'failed') {
          item.paymentStatus = paymentStatus;
  
          if (paymentStatus === 'completed') {
            const product = await Products.findById(item.productId);
            if (product && product.stock >= item.quantity) {
              product.stock -= item.quantity;
              await product.save();
              stockUpdated = true;
              emailToSend = true;  
              paymentItem = item; 
            } else {
              console.error(`Insufficient stock for product ${item.productId}`);
              return res.status(400).json({ error: `Insufficient stock for product ${item.productId}` });
            }
          }
        }
      }
      
      if (paymentStatus === 'completed') {
          order.paymentMethod = 'Razorpay';
          for (const item of order.items) {
              item.orderStatus = 'pending';
          }
      }
      await order.save();

      if (emailToSend) {
          const user = await User.findById(order.userId);
          const transporter = nodemailer.createTransport({
              service: 'gmail',
              auth: {
                  user: process.env.EMAIL,
                  pass: process.env.EMAIL_PASSWORD
              }
          });

          const invoiceHTML = `
          <!DOCTYPE html>
          <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; margin: 0; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <!-- Header with Logo -->
              <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #4a90e2; padding-bottom: 20px;">
                <div style="font-size: 28px; font-weight: bold; color: #2c3e50; margin-bottom: 5px;">
                  <span style="color: #4a90e2;">🪐</span> TOY GALAXY
                </div>
                <div style="color: #666; font-size: 14px;">Where Fun Meets Adventure</div>
              </div>
          
              <!-- Invoice Title -->
              <h2 style="color: #2c3e50; text-align: center; margin-bottom: 25px; font-size: 24px;">Order Invoice</h2>
              
              <!-- Order Details -->
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                <p style="margin: 8px 0;"><strong style="color: #4a90e2;">Order ID:</strong> ${newOrder._id}</p>
                <p style="margin: 8px 0;"><strong style="color: #4a90e2;">Date:</strong> ${moment(newOrder.orderDate).format('MMMM DD, YYYY')}</p>
                <p style="margin: 8px 0;"><strong style="color: #4a90e2;">Customer Name:</strong> ${newOrder.address.name}</p>
              </div>
          
              <!-- Shipping Address -->
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                <h3 style="color: #4a90e2; margin: 0 0 10px 0; font-size: 16px;">Shipping Address</h3>
                <p style="margin: 5px 0;">${newOrder.address.address}</p>
                <p style="margin: 5px 0;">${newOrder.address.locality}</p>
                <p style="margin: 5px 0;">${newOrder.address.city}, ${newOrder.address.state} - ${newOrder.address.pincode}</p>
                <p style="margin: 5px 0;"><strong>Phone:</strong> ${newOrder.address.phone}</p>
              </div>
          
              <!-- Order Items Table -->
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #4a90e2; color: #ffffff;">
                    <th style="padding: 12px 15px; text-align: left;">Product</th>
                    <th style="padding: 12px 15px; text-align: center;">Quantity</th>
                    <th style="padding: 12px 15px; text-align: right;">Unit Price</th>
                    <th style="padding: 12px 15px; text-align: right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${orderItems.map(item => `
                    <tr>
                      <td style="padding: 12px 15px; border-bottom: 1px solid #eee;">${item.productName}</td>
                      <td style="padding: 12px 15px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
                      <td style="padding: 12px 15px; border-bottom: 1px solid #eee; text-align: right;">₹${item.price.toFixed(2)}</td>
                      <td style="padding: 12px 15px; border-bottom: 1px solid #eee; text-align: right;">₹${(item.price * item.quantity).toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
          
              <!-- Order Summary -->
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                <div style="text-align: right;">
                  <p style="margin: 8px 0;"><strong>Subtotal:</strong> <span style="min-width: 80px; display: inline-block;">₹${(totalPrice - deliveryFee + totalCouponDiscount).toFixed(2)}</span></p>
                  <p style="margin: 8px 0;"><strong>Delivery Charge:</strong> <span style="min-width: 80px; display: inline-block;">₹${deliveryFee.toFixed(2)}</span></p>
                  ${totalCouponDiscount > 0 ? `<p style="margin: 8px 0; color: #28a745;"><strong>Coupon Discount:</strong> <span style="min-width: 80px; display: inline-block;">-₹${totalCouponDiscount.toFixed(2)}</span></p>` : ''}
                  <p style="margin: 15px 0; padding-top: 10px; border-top: 2px solid #ddd; font-size: 18px;"><strong>Total Amount:</strong> <span style="min-width: 80px; display: inline-block; color: #4a90e2;">₹${totalPrice.toFixed(2)}</span></p>
                  <p style="margin: 8px 0;"><strong>Payment Method:</strong> <span style="min-width: 80px; display: inline-block;">${paymentMethod}</span></p>
                  <p style="margin: 8px 0;"><strong>Payment Status:</strong> <span style="min-width: 80px; display: inline-block; color: ${itemPaymentStatus.toLowerCase() === 'paid' ? '#28a745' : '#dc3545'}">${itemPaymentStatus}</span></p>
                </div>
              </div>
          
              <!-- Footer -->
              <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #4a90e2; color: #666;">
                <p style="margin: 5px 0; font-size: 16px; color: #2c3e50;">Thank you for shopping with Toy Galaxy! 🚀</p>
                <p style="margin: 5px 0; font-size: 14px;">For any queries, please contact our support team.</p>
                <div style="margin-top: 15px; font-size: 12px;">
                  <p style="margin: 3px 0;">Toy Galaxy - Where Every Child's Dreams Take Flight</p>
                  <p style="margin: 3px 0;">📧 support@toygalaxy.com | 📞 1800-TOY-GALAXY</p>
                </div>
              </div>
            </div>
          </body>
          </html>
          `;

          transporter.sendMail({
              from: process.env.EMAIL_USER,
              to: user.email,
              subject: `Order Invoice #${order._id}`,
              html: invoiceHTML
          }).then(() => {
              console.log('Invoice email sent successfully');
          }).catch(emailError => {
              console.error('Error sending invoice email:', emailError);
          });
      }

      res.status(200).json({ success: true, message: 'Payment status updated successfully' });
  } catch (error) {
      console.error('Error updating payment status:', error);
      res.status(500).json({ error: 'Server error while updating payment status' });
  }
};

exports.cancelOrder = async (req, res) => {
  const { itemId } = req.params;
  const { reason } = req.body;
  let order;

  try {
    order = await Orders.findOne({ 'items._id': itemId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.',
        itemId
      });
    }

    const item = order.items.id(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found.',
        itemId
      });
    }

    item.orderStatus = 'cancelled';
    item.cancelReason = reason;

    const product = await Products.findById(item.productId).populate('category');
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    if (product.stock + item.quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel the item. Insufficient stock to revert this action.',
      });
    }

    product.stock += item.quantity;
    await product.save();

    const refundAmount = item.price * item.quantity + order.deliveryCharge;
    await order.save();

    if (item.orderStatus === 'cancelled') {
      if (order.paymentMethod === 'Razorpay' || order.paymentMethod === 'Wallet') {
        if (typeof refundAmount !== 'number' || isNaN(refundAmount) || refundAmount <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Invalid refund amount. Cannot proceed with wallet refund.',
          });
        }

        let userWallet = await Wallet.findOne({ userId: order.userId });

        if (!userWallet) {
          userWallet = new Wallet({ userId: order.userId, balance: 0 });
        }  // dsjuhfcujshnc

        userWallet.balance += refundAmount;
        userWallet.transactions.push({
          type: 'refund',
          amount: refundAmount,
          description: `Refund for cancelled item in order #${order._id}`,
        });

        await userWallet.save();
        item.paymentStatus = 'refunded';
        await order.save();

        return res.status(200).json({
          success: true,
          message: 'Item has been cancelled and refund has been added to the wallet successfully.',
        });
      } else if (order.paymentMethod === 'COD') {
        item.paymentStatus = 'cancelled';
        await order.save();
        return res.status(200).json({
          success: true,
          message: 'Item has been cancelled successfully.',
        });
      }
    }
  } catch (error) {
    console.error('Error while cancelling the order:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while cancelling the order.',
      error: error.message,
      itemId,
      orderId: order ? order._id : null,
    });
  }
};


exports.returnOrder = async (req, res) => {
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

      const returnPeriod = 14;
      const deliveryDate = new Date(item.deliveryDate);
      const currentDate = new Date();
      const daysSinceDelivery = (currentDate - deliveryDate) / (1000 * 60 * 60 * 24);

      if (daysSinceDelivery > returnPeriod) {
          return res.status(400).json({ success: false, message: 'Return period has expired.' });
      }


      item.orderStatus = 'Return Requested';
      item.reason = reason;
    
      item.paymentStatus = 'refund pending';

      const product = await Products.findById(item.productId).populate('category');
      if (!product) {
          return res.status(404).json({ success: false, message: 'Product not found.' });
      }


      const refundAmount = item.price * item.quantity + order.deliveryCharge;


      await order.save();

    
      if (order.paymentMethod === 'Razorpay' || order.paymentMethod === 'Wallet') {
          return res.status(200).json({
              success: true,
              message: 'Return request submitted successfully. Refund will be processed after admin approval.',
              refundAmount: refundAmount 
          });
      } else if (order.paymentMethod === 'COD') {
          return res.status(200).json({
              success: true,
              message: 'Return request submitted successfully. Refund will be processed after admin approval.',
              refundAmount: refundAmount
          });
      }

  } catch (error) {
      console.error('Error while processing the return:', error);
      return res.status(500).json({
          success: false,
          message: 'An error occurred while processing the return.',
          error: error.message,
          itemId,
          productId,
          orderId: order ? order._id : null,
      });
  }
};

