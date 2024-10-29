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
              emailToSend = true;  // Set flag to send email
              paymentItem = item;  // Assign the completed item to paymentItem
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

      // Send email if payment is completed
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
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2c3e50; text-align: center;">Order Invoice</h2>
                
                <div style="margin-bottom: 20px;">
                  <p><strong>Order ID:</strong> ${order._id}</p>
                  <p><strong>Date:</strong> ${moment(order.orderDate).format('MMMM DD, YYYY')}</p>
                  <p><strong>Customer Name:</strong> ${order.address.name}</p>
                  <p><strong>Shipping Address:</strong><br>
                    ${order.address.address}<br>
                    ${order.address.locality}<br>
                    ${order.address.city}, ${order.address.state} - ${order.address.pincode}<br>
                    Phone: ${order.address.phone}
                  </p>
                </div>
          
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                  <thead>
                    <tr style="background-color: #f8f9fa;">
                      <th style="padding: 12px; text-align: left;">Product</th>
                      <th style="padding: 12px; text-align: left;">Quantity</th>
                      <th style="padding: 12px; text-align: left;">Unit Price</th>
                      <th style="padding: 12px; text-align: left;">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${order.items.map(item => `
                      <tr>
                        <td style="padding: 12px; border-bottom: 1px solid #ddd;">${item.productName}</td>
                        <td style="padding: 12px; border-bottom: 1px solid #ddd;">${item.quantity}</td>
                        <td style="padding: 12px; border-bottom: 1px solid #ddd;">₹${item.price.toFixed(2)}</td>
                        <td style="padding: 12px; border-bottom: 1px solid #ddd;">₹${(item.price * item.quantity).toFixed(2)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
          
                <div style="margin-top: 20px; text-align: right;">
                  <p><strong>Subtotal:</strong> ₹${(order.totalPrice - order.deliveryCharge + order.couponDiscount).toFixed(2)}</p>
                  <p><strong>Delivery Charge:</strong> ₹${order.deliveryCharge.toFixed(2)}</p>
                  ${order.couponDiscount > 0 ? `<p><strong>Coupon Discount:</strong> -₹${order.couponDiscount.toFixed(2)}</p>` : ''}
                  <p style="font-size: 1.2em;"><strong>Total Amount:</strong> ₹${order.totalPrice.toFixed(2)}</p>
                  <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
                  <p><strong>Payment Status:</strong> ${paymentItem ? paymentItem.paymentStatus : ''}</p>
                </div>
          
                <div style="margin-top: 40px; text-align: center; color: #666;">
                  <p>Thank you for shopping with us!</p>
                  <p style="font-size: 0.8em;">For any queries, please contact our support team.</p>
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
        }

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

      // Update order status and reason
      item.orderStatus = 'Return Requested';
      item.reason = reason;
      // Set payment status to refund pending initially
      item.paymentStatus = 'refund pending';

      const product = await Products.findById(item.productId).populate('category');
      if (!product) {
          return res.status(404).json({ success: false, message: 'Product not found.' });
      }

      // Add back to product stock only after admin approves return
      // Removing this line as stock should be updated after admin approval
      // product.stock += item.quantity;
      // await product.save();

      // Calculate refund amount but don't process it yet
      const refundAmount = item.price * item.quantity + order.deliveryCharge;

      // Save the order with updated status
      await order.save();

      // Return appropriate message based on payment method
      if (order.paymentMethod === 'Razorpay' || order.paymentMethod === 'Wallet') {
          return res.status(200).json({
              success: true,
              message: 'Return request submitted successfully. Refund will be processed after admin approval.',
              refundAmount: refundAmount // Optionally inform user of expected refund amount
          });
      } else if (order.paymentMethod === 'COD') {
          return res.status(200).json({
              success: true,
              message: 'Return request submitted successfully. Refund will be processed after admin approval.',
              refundAmount: refundAmount // Optionally inform user of expected refund amount
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

