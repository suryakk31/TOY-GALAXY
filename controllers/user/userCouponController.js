const User = require('../../models/user');
const Category = require('../../models/category');
const Coupon = require('../../models/coupon')
const Orders = require('../../models/order');

exports.getCoupon = async(req,res) => {
  const isLoggedIn = req.session.email ? true : false;
  let userDatabase = null;
  let coupon;
  if (isLoggedIn) {
      userDatabase = await User.findOne({ email: req.session.email });
      if (userDatabase.isBlocked) {
          req.session.destroy();
          return res.render('auth/login', { 
              errorMessage: 'Your account has been blocked. Please contact support.' 
          });
      }
      
      const userOrders = await Orders.find({
        userId: userDatabase._id,
        couponCode: { $exists: true, $ne: null }
    }, 'couponCode');

   
    const usedCouponCodes = userOrders.map(order => order.couponCode);


    coupon = await Coupon.find({
        $and: [
            { usedBy: { $ne: req.session.email } },
            { couponCode: { $nin: usedCouponCodes } }
        ]
    }).sort({ createdAt: -1 });
} else {
    coupon = await Coupon.find().sort({ createdAt: -1 });
}

  const categories = await Category.find();
  
  res.render('user/coupon', {
      isLoggedIn, 
      userDatabase, 
      categories, 
      coupon, 
      currentPath: '/auth/coupon'
  });
}


exports.applyCoupon = async (req, res) => {
  const { couponCode, totalAmount } = req.body;
  try {
      const coupon = await Coupon.findOne({ 
          couponCode: couponCode,
          usedBy: { $ne: req.session.email } 
      });
      
      if (!coupon || new Date() >= new Date(coupon.expiryDate)) {
          return res.json({ 
              isValid: false, 
              message: 'Coupon is invalid or expired' 
          });
      }

      const { discount, minAmount, maxAmount } = coupon;
      
      if (totalAmount < minAmount) {
          return res.json({ 
              isValid: false, 
              message: `The minimum amount to apply this coupon is ₹${minAmount}.` 
          });
      }

      if (totalAmount > maxAmount) {
          return res.json({ 
              isValid: false, 
              message: `This coupon can only be applied to orders up to ₹${maxAmount}.` 
          });
      }

      const discountAmount = Math.min((discount / 100) * totalAmount, maxAmount - minAmount);
      

      if (req.session.email) {
          await Coupon.findByIdAndUpdate(
              coupon._id,
              { $addToSet: { usedBy: req.session.email } }
          );
      }

      res.json({ 
          isValid: true, 
          discount, 
          discountAmount, 
          minAmount, 
          maxAmount 
      });
  } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error' });
  }
};
