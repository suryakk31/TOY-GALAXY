const User = require("../../models/user");
const Orders = require("../../models/order");
const Cart = require("../../models/cart");
const Address = require("../../models/address");
const Category = require("../../models/category");
const Coupon = require("../../models/coupon");
const Product = require('../../models/product')
const Wallet = require('../../models/wallet')
const nodemailer = require('nodemailer');
const moment = require('moment');

const Razorpay = require('razorpay');

require('dotenv').config();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

exports.createRazorpayOrder = async (req, res) => {
    try {
        const { amount } = req.body;

        if (!amount || isNaN(amount) || amount <= 0) {
          return res.status(400).json({ error: 'Invalid amount' });
      }

      const amountInPaise = Math.round(amount * 100);
        


        const options = {
            amount: amountInPaise, 
            currency: "INR",
            receipt: `receipt_${new Date().getTime()}`, 
        };

        const order = await razorpay.orders.create(options);

        res.status(200).json({
            id: order.id,
            amount: order.amount,
            currency: order.currency,
            key_id: process.env.RAZORPAY_KEY_ID 
        });
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({ error: 'Server error while creating Razorpay order' });
    }
};


exports.getCheckout = async (req, res) => {
  try {
    const isLoggedIn = req.session.email ? true : false;
    let userDatabase = null;

    if (isLoggedIn) {
      userDatabase = await User.findOne({ email: req.session.email });

      if (userDatabase.isBlocked) {
        req.session.destroy();
        return res.render("auth/login", {
          errorMessage:
            "Your account has been blocked. Please contact support.",
        });
      }
    }

    if (!userDatabase) {
      return res.redirect("/auth/login");
    }

    const cart = await Cart.findOne({ userId: userDatabase._id }).populate({
      path: "items.productId",
      populate: { path: "category" }, 
    });

    if (!cart || cart.items.length === 0) {
      return res.redirect("/auth/homepage");
    }

    const userOrders = await Orders.find({
      userId: userDatabase._id,
      couponCode: { $exists: true, $ne: null }
    }, 'couponCode');

    // Extract all coupon codes used by the user in orders
    const usedCouponCodes = userOrders.map(order => order.couponCode);

    // Find available coupons (not used in orders and not in usedBy array)
    const coupon = await Coupon.find({
      $and: [
        { usedBy: { $ne: req.session.email } },
        { couponCode: { $nin: usedCouponCodes } }
      ]
    }).sort({ createdAt: -1 });


    const categories = await Category.find();
    let wallet = await Wallet.findOne({ userId: userDatabase._id });  
    const addresses = await Address.find({ userId: userDatabase._id });


    const originalTotal = cart.items.reduce((sum, item) => {
      const itemTotal =
        (item.productId.price -
          (item.productId.price * item.productId.discount) / 100) *
        item.quantity;
      return sum + itemTotal;
    }, 0);

    const categoryOffer = cart.items.reduce((sum, item) => {
      if (item.productId.category && item.productId.category.offer) {
        const productPriceAfterDiscount =
          (item.productId.price -
            (item.productId.price * item.productId.discount) / 100) *
          item.quantity;
        const offer =
          productPriceAfterDiscount * (item.productId.category.offer / 100);
        return sum + offer;
      }
      return sum;
    }, 0);

 
    const deliveryFee = originalTotal > 500 ? 0 : 50;
    const deliveryFeeDisplay = deliveryFee === 0 ? 'Free' : `₹${deliveryFee}`;
    
    const total = (originalTotal - categoryOffer + deliveryFee).toFixed(2);

    res.render("user/checkout", {
      isLoggedIn,
      userDatabase,
      categories,
      addresses,
      cartItems: cart.items,
      originalTotal: originalTotal.toFixed(2),
      categoryOffer: categoryOffer.toFixed(2),
      deliveryFee,
      deliveryFeeDisplay,
      total,
      coupon,
      wallet: wallet

    });
    
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
};

exports.postCheckout = async (req, res) => {
  try {
    const { address: addressId, paymentMethod, paymentStatus, paymentId, couponCode } = req.body;

    const isLoggedIn = req.session.email ? true : false;
    let userDatabase = null;

    if (isLoggedIn) {
      userDatabase = await User.findOne({ email: req.session.email });
      if (userDatabase.isBlocked) {
        req.session.destroy();
        return res.render("auth/login", {
          errorMessage: "Your account has been blocked. Please contact support.",
        });
      }
    }

    if (!userDatabase) {
      return res.redirect("/auth/login");
    }

    const user = await User.findOne({ email: req.session.email });
    if (!user) {
      console.error("User not found");
      return res.status(400).json({ error: "User not found" });
    }

    const address = await Address.findById(addressId);
    if (!address) {
      console.error("Address not found");
      return res.status(400).json({ error: "Address not found" });
    }

    const cart = await Cart.findOne({ userId: userDatabase._id }).populate({
      path: "items.productId",
      populate: { path: "category" },
    });

    if (!cart || cart.items.length === 0) {
      return res.redirect("/user/product", {
        message: "Your cart is empty.",
      });
    }

    const itemsWithDiscounts = cart.items.map(item => {
      const originalPrice = Math.floor(item.productId.price * 100) / 100;
     
      const quantity = item.quantity;
      
      const productDiscountAmount = Math.floor((originalPrice * item.productId.discount) / 100 * 100) / 100;
  
      const priceAfterProductDiscount = Math.floor((originalPrice - productDiscountAmount) * 100) / 100;
    
      const categoryDiscountAmount = item.productId.category && item.productId.category.offer
        ? Math.floor((priceAfterProductDiscount * item.productId.category.offer) / 100 * 100) / 100
        : 0;

      const priceAfterAllDiscounts = Math.floor((priceAfterProductDiscount - categoryDiscountAmount) * 100) / 100;

    
      return {
        ...item.toObject(),
        calculatedPrices: {
          originalPrice,
          priceAfterAllDiscounts,
          totalPriceForQuantity: priceAfterAllDiscounts * quantity,
          productDiscountAmount,
          categoryDiscountAmount
        }
      };
    });

    const subtotalBeforeDelivery = Math.floor(itemsWithDiscounts.reduce(
      (sum, item) => sum + item.calculatedPrices.totalPriceForQuantity,
      0
    ) * 100) / 100;
  

    const deliveryFee = subtotalBeforeDelivery > 500 ? 0 : 50;
    const subtotalBeforeCoupon = Math.floor((subtotalBeforeDelivery + deliveryFee) * 100) / 100;

    let totalCouponDiscount = 0;
    let itemCouponDiscounts = [];
    let validCouponCode = null;
    let appliedCoupon = null;
    if (couponCode) {
      const coupon = await Coupon.findOne({ couponCode });
      
      if (coupon && new Date() < new Date(coupon.expiryDate)) {
        if (subtotalBeforeCoupon >= coupon.minAmount && subtotalBeforeCoupon <= coupon.maxAmount) {
          validCouponCode = couponCode;
          appliedCoupon = coupon;
          totalCouponDiscount = Math.floor(Math.min(
            (coupon.discount / 100) * subtotalBeforeCoupon,
            coupon.maxAmount - coupon.minAmount
          ) * 100) / 100;

          const totalAmount = Math.floor(itemsWithDiscounts.reduce(
            (sum, item) => sum + item.calculatedPrices.totalPriceForQuantity,
            0
          ) * 100) / 100;

          itemCouponDiscounts = itemsWithDiscounts.map(item => {
            const proportion = item.calculatedPrices.totalPriceForQuantity / totalAmount;
            return Math.floor((totalCouponDiscount * proportion) * 100) / 100;
          });
        }
      }
    }


    let itemPaymentStatus;
    if (paymentMethod === 'COD') {
      itemPaymentStatus = 'pending';
    } else if (paymentMethod === 'Razorpay') {
      itemPaymentStatus = paymentStatus === 'failed' ? 'failed' : 'completed';
    } else if (paymentMethod === 'Wallet') {
      itemPaymentStatus = 'completed';
    }

    const orderItems = itemsWithDiscounts.map((item, index) => {
      const couponDiscountForItem = Math.floor((itemCouponDiscounts[index] || 0) * 100) / 100;
      const finalPricePerUnit = Math.floor(((item.calculatedPrices.totalPriceForQuantity - couponDiscountForItem) / item.quantity) * 100) / 100;
     

      return {
        productId: item.productId._id,
        productName: item.productId.name,
        productDescription: item.productId.description,
        stock: item.productId.stock,
        productImage: item.productId.image,
        quantity: item.quantity,
        price: Math.floor(finalPricePerUnit * 100) / 100,
        discountPrice: Math.floor((item.calculatedPrices.productDiscountAmount + item.calculatedPrices.categoryDiscountAmount) * 100) / 100,
        couponCode: validCouponCode,
        couponDiscountPrice: couponDiscountForItem,
        couponCode: validCouponCode, 
        orderStatus: 'pending',
        paymentStatus: itemPaymentStatus,  
        reason: ""
      };
    });

    const totalPrice = Math.floor((subtotalBeforeCoupon - totalCouponDiscount) * 100) / 100;
  
    const totalQuantity = cart.items.reduce((sum, item) => sum + item.quantity, 0);

   
    if (itemPaymentStatus !== 'failed') {
      for (let item of cart.items) {
        const product = await Product.findById(item.productId._id);
        if (product.stock < item.quantity) {
          return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
        }
        product.stock -= item.quantity;
        await product.save();
      }
    }

    const newOrder = new Orders({
      userId: user._id,
      items: orderItems,
      totalQuantity,
      totalPrice,
      deliveryCharge: deliveryFee,
      couponDiscount: totalCouponDiscount,
      couponCode: validCouponCode, 
      address: {
        name: address.name,
        address: address.address,
        phone: address.phone,
        locality: address.locality,
        pincode: address.pincode,
        state: address.state,
        city: address.city,
      },
      paymentMethod,
      orderDate: new Date(),
      createdAt: new Date(),
      paymentId: paymentId || null,
    });

    await newOrder.save();
    await Cart.deleteOne({ userId: user._id });

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
        <th style="padding: 12px 15px; text-align: center; width: 40%;">Product</th>
        <th style="padding: 12px 15px; text-align: center; width: 20%;">Quantity</th>
        <th style="padding: 12px 15px; text-align: center; width: 20%;">Unit Price</th>
        <th style="padding: 12px 15px; text-align: center; width: 20%;">Total</th>
      </tr>
          </thead>
          <tbody>
          ${orderItems.map(item => `
              <tr>
                  <td style="padding: 12px 15px; border-bottom: 1px solid #eee; text-align: center;">${item.productName}</td>
                  <td style="padding: 12px 15px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
                  <td style="padding: 12px 15px; border-bottom: 1px solid #eee; text-align: center;">₹${item.price.toFixed(2)}</td>
                  <td style="padding: 12px 15px; border-bottom: 1px solid #eee; text-align: center;">₹${(item.price * item.quantity).toFixed(2)}</td>
              </tr>
          `).join('')}
      </tbody>
        </table>
    
        <!-- Order Summary -->
        <div style="background-color: #f8f9fa; padding: 10px; border-radius: 8px; margin-bottom: 25px;">
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

 
    if (itemPaymentStatus !== 'failed') {
      transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: `Order Invoice #${newOrder._id}`,
        html: invoiceHTML
      })
      .then(async () => {
        
        await Orders.updateOne({ _id: newOrder._id }, { emailStatus: 'sent' });
      })
      .catch(emailError => {
        console.error('Error sending invoice email:', emailError);
      });
    }
    

    res.status(200).json({
      message: "Order placed successfully",
      totalPrice,
      orderItems: orderItems.map(item => ({
        productName: item.productName,
        quantity: item.quantity,
        originalPrice: Math.floor(item.productId.price * 100) / 100,
        finalPrice: Math.floor(item.price * 100) / 100,
        totalDiscount: Math.floor((item.discountPrice + item.couponDiscountPrice) * 100) / 100,
        paymentStatus: item.paymentStatus  // Include payment status in response
      }))
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Server error" });
  }
};
