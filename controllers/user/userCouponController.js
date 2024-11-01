const User = require('../../models/user');
const Category = require('../../models/category');
const Coupon = require('../../models/coupon')

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
      // Only show coupons that haven't been used by this user, sorted by newest first
      coupon = await Coupon.find({
          usedBy: { $ne: req.session.email }
      }).sort({ createdAt: -1 }); // Added sort here
  } else {
      coupon = await Coupon.find().sort({ createdAt: -1 }); // Added sort here
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
          usedBy: { $ne: req.session.email } // Check if user hasn't used this coupon
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
      
      // Add user's email to the coupon's usedBy array
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
