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
      return res.redirect("/user/product", {
        message: "Your cart is empty.",
      });
    }

    const categories = await Category.find();
    let wallet = await Wallet.findOne({ userId: userDatabase._id });  
    const addresses = await Address.find({ userId: userDatabase._id });
    const coupon = await Coupon.find();


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
      console.log('originalPrice:',originalPrice)
      const quantity = item.quantity;
      
      const productDiscountAmount = Math.floor((originalPrice * item.productId.discount) / 100 * 100) / 100;
      console.log('productDiscountAmount:',productDiscountAmount)
      const priceAfterProductDiscount = Math.floor((originalPrice - productDiscountAmount) * 100) / 100;
      console.log('priceAfterProductDiscount:',priceAfterProductDiscount)
      const categoryDiscountAmount = item.productId.category && item.productId.category.offer
        ? Math.floor((priceAfterProductDiscount * item.productId.category.offer) / 100 * 100) / 100
        : 0;
     console.log('categoryDiscountAmount:',categoryDiscountAmount)
      const priceAfterAllDiscounts = Math.floor((priceAfterProductDiscount - categoryDiscountAmount) * 100) / 100;
      console.log('priceAfterAllDiscounts:',priceAfterAllDiscounts)
    
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
    console.log('subtotalBeforeDelivery:',subtotalBeforeDelivery)

    const deliveryFee = subtotalBeforeDelivery > 500 ? 0 : 50;
    const subtotalBeforeCoupon = Math.floor((subtotalBeforeDelivery + deliveryFee) * 100) / 100;

    let totalCouponDiscount = 0;
    let itemCouponDiscounts = [];

    if (couponCode) {
      const coupon = await Coupon.findOne({ couponCode });
      
      if (coupon && new Date() < new Date(coupon.expiryDate)) {
        if (subtotalBeforeCoupon >= coupon.minAmount && subtotalBeforeCoupon <= coupon.maxAmount) {
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

    // Determine payment status for each item based on payment method
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
      console.log('finalPricePerUnit:',finalPricePerUnit)

      return {
        productId: item.productId._id,
        productName: item.productId.name,
        productDescription: item.productId.description,
        stock: item.productId.stock,
        productImage: item.productId.image,
        quantity: item.quantity,
        price: Math.floor(finalPricePerUnit * 100) / 100,
        discountPrice: Math.floor((item.calculatedPrices.productDiscountAmount + item.calculatedPrices.categoryDiscountAmount) * 100) / 100,
        couponDiscountPrice: couponDiscountForItem,
        orderStatus: 'pending',
        paymentStatus: itemPaymentStatus,  // Add payment status for each item
        reason: ""
      };
    });

    const totalPrice = Math.floor((subtotalBeforeCoupon - totalCouponDiscount) * 100) / 100;
    console.log('totalPrice:',totalPrice)
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
console.log('newOrder:',newOrder)
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
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #2c3e50; text-align: center;">Order Invoice</h2>
      
      <div style="margin-bottom: 20px;">
        <p><strong>Order ID:</strong> ${newOrder._id}</p>
        <p><strong>Date:</strong> ${moment(newOrder.orderDate).format('MMMM DD, YYYY')}</p>
        <p><strong>Customer Name:</strong> ${newOrder.address.name}</p>
        <p><strong>Shipping Address:</strong><br>
          ${newOrder.address.address}<br>
          ${newOrder.address.locality}<br>
          ${newOrder.address.city}, ${newOrder.address.state} - ${newOrder.address.pincode}<br>
          Phone: ${newOrder.address.phone}
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
          ${orderItems.map(item => `
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
        <p><strong>Subtotal:</strong> ₹${(totalPrice - deliveryFee + totalCouponDiscount).toFixed(2)}</p>
        <p><strong>Delivery Charge:</strong> ₹${deliveryFee.toFixed(2)}</p>
        ${totalCouponDiscount > 0 ? `<p><strong>Coupon Discount:</strong> -₹${totalCouponDiscount.toFixed(2)}</p>` : ''}
        <p style="font-size: 1.2em;"><strong>Total Amount:</strong> ₹${totalPrice.toFixed(2)}</p>
        <p><strong>Payment Method:</strong> ${paymentMethod}</p>
        <p><strong>Payment Status:</strong> ${itemPaymentStatus}</p>
      </div>

      <div style="margin-top: 40px; text-align: center; color: #666;">
        <p>Thank you for shopping with us!</p>
        <p style="font-size: 0.8em;">For any queries, please contact our support team.</p>
      </div>
    </div>
  </body>
  </html>
    `;

    // Send email asynchronously without awaiting
    if (itemPaymentStatus !== 'failed') {
      transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: `Order Invoice #${newOrder._id}`,
        html: invoiceHTML
      }).then(() => {
        console.log('Invoice email sent successfully');
      }).catch(emailError => {
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
