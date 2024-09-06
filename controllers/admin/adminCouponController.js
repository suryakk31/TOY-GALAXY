const Coupon = require('../../models/coupon');

exports.getCouponPage = async (req, res) => {
    if (!req.session.isAdmin) {
        return res.redirect('/admin/login');
    }
    try {
       
        const coupons = await Coupon.find({});
        
     
        res.render('admin/coupon', { coupons: coupons });
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
};

exports.postCoupon = async (req, res) => {
    const { couponDescription, couponCode, couponOffer, expiryDate, minAmount, maxAmount } = req.body;


    try {

        const existingCoupon = await Coupon.findOne({ code: couponCode });
        if (existingCoupon) {
            return res.status(400).json({ message: 'Coupon code already exists' });
        }

       
        const coupon = new Coupon({
            description: couponDescription,
            couponCode,
            discount: couponOffer, 
            expiryDate, 
            minAmount,  
            maxAmount   
        });

        const newCoupon = await coupon.save();
        res.status(201).json(newCoupon);
    } catch (error) {
        console.error(error);
        res.status(400).json({ message: error.message });
    }
};
