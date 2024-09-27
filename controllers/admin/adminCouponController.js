const Coupon = require('../../models/coupon');

exports.getCouponPage = async (req, res) => {
    if (!req.session.isAdmin) {
        return res.redirect('/admin/login');
    }
    try {
     
        const coupons = await Coupon.find({});
        res.render('admin/coupon', { coupons });
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
};

exports.postCoupon = async (req, res) => {
    const { description, couponCode, discount, expiryDate, minAmount, maxAmount } = req.body;

    if (!couponCode || couponCode.trim() === '') {
        return res.status(400).json({ message: 'Coupon code is required' });
    }

    try {
        
        const existingCoupon = await Coupon.findOne({ couponCode: couponCode.trim() });
        if (existingCoupon) {
            return res.status(400).json({ message: 'Coupon code already exists' });
        }

      
        const coupon = new Coupon({
            description: description.trim(), 
            couponCode: couponCode.trim(),
            discount: Number(discount),
            expiryDate: new Date(expiryDate),
            minAmount: minAmount ? Number(minAmount) : undefined, 
            maxAmount: maxAmount ? Number(maxAmount) : undefined, 
        });

        const newCoupon = await coupon.save();
        res.status(201).json(newCoupon);
    } catch (error) {
        console.error(error);
        res.status(400).json({ message: error.message });
    }
};
