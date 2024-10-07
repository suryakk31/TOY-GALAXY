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


exports.getCouponById = async (req, res) => {
    const { id } = req.params;
    
    try {
        const coupon = await Coupon.findById(id);
        if (!coupon) {
            return res.status(404).json({ message: 'Coupon not found' });
        }
        res.status(200).json(coupon);
    } catch (error) {
        console.error('Error fetching coupon:', error);
        res.status(500).json({ message: 'Failed to fetch coupon' });
    }
};

exports.postCoupon = async (req, res) => {
    const { description, couponCode, discount, expiryDate, minAmount, maxAmount } = req.body;

    try {
      
        if (!description || description.trim() === '') {
            return res.status(400).json({ message: 'Description is required' });
        }
        if (!couponCode || couponCode.trim() === '') {
            return res.status(400).json({ message: 'Coupon code is required' });
        }
        if (!discount || isNaN(discount) || discount < 0 || discount > 100) {
            return res.status(400).json({ message: 'Discount must be a number between 0 and 100' });
        }
        if (!expiryDate || new Date(expiryDate) < new Date()) {
            return res.status(400).json({ message: 'Valid expiry date is required' });
        }
        if (minAmount && maxAmount && Number(minAmount) >= Number(maxAmount)) {
            return res.status(400).json({ message: 'Minimum amount must be less than maximum amount' });
        }

        const existingCoupon = await Coupon.findOne({ 
            couponCode: new RegExp(`^${couponCode.trim()}$`, 'i') 
        });
        if (existingCoupon) {
            return res.status(400).json({ message: 'Coupon code already exists' });
        }


        const coupon = new Coupon({
            description: description.trim(),
            couponCode: couponCode.trim().toUpperCase(),
            discount: Number(discount),
            expiryDate: new Date(expiryDate),
            minAmount: minAmount ? Number(minAmount) : undefined,
            maxAmount: maxAmount ? Number(maxAmount) : undefined,
            createdAt: new Date()
        });

        const newCoupon = await coupon.save();
        res.status(201).json(newCoupon);
    } catch (error) {
        console.error('Error creating coupon:', error);
        res.status(400).json({ message: error.message });
    }
};

exports.updateCoupon = async (req, res) => {
    const { id } = req.params;
    const { description, couponCode, discount, expiryDate, minAmount, maxAmount } = req.body;
    console.log("Received Update Request:", req.body);

    try {
  
        if (!id) {
            return res.status(400).json({ message: 'Coupon ID is required' });
        }
        if (!description || description.trim() === '') {
            return res.status(400).json({ message: 'Description is required' });
        }
        if (!couponCode || couponCode.trim() === '') {
            return res.status(400).json({ message: 'Coupon code is required' });
        }
        if (!discount || isNaN(discount) || discount < 0 || discount > 100) {
            return res.status(400).json({ message: 'Discount must be a number between 0 and 100' });
        }
        if (!expiryDate || new Date(expiryDate) < new Date()) {
            return res.status(400).json({ message: 'Valid expiry date is required' });
        }
        if (minAmount && maxAmount && Number(minAmount) >= Number(maxAmount)) {
            return res.status(400).json({ message: 'Minimum amount must be less than maximum amount' });
        }

   
        const existingCoupon = await Coupon.findOne({
            couponCode: couponCode.trim().toUpperCase(),
            _id: { $ne: id }
        });

        if (existingCoupon) {
            return res.status(400).json({ message: 'Coupon code already exists' });
        }

  
        const updatedCoupon = await Coupon.findByIdAndUpdate(
            id,
            {
                description: description.trim(),
                couponCode: couponCode.trim().toUpperCase(),
                discount: Number(discount),
                expiryDate: new Date(expiryDate),
                minAmount: minAmount ? Number(minAmount) : undefined,
                maxAmount: maxAmount ? Number(maxAmount) : undefined,
                updatedAt: new Date()
            },
            { new: true, runValidators: true }
        );

        if (!updatedCoupon) {
            return res.status(404).json({ message: 'Coupon not found' });
        }

        res.status(200).json(updatedCoupon);
    } catch (error) {
        console.error('Error updating coupon:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation error', details: error.errors });
        }
        res.status(500).json({ message: 'Failed to update coupon', error: error.message });
    }
};

exports.deleteCoupon = async (req, res) => {
    const { id } = req.params;

    try {
        if (!id) {
            return res.status(400).json({ message: 'Coupon ID is required' });
        }

        const deletedCoupon = await Coupon.findByIdAndDelete(id);
        if (!deletedCoupon) {
            return res.status(404).json({ message: 'Coupon not found' });
        }

        res.status(200).json({ message: 'Coupon deleted successfully' });
    } catch (error) {
        console.error('Error deleting coupon:', error);
        res.status(500).json({ message: 'Failed to delete coupon' });
    }
};