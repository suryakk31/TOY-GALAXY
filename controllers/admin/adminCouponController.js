


exports.getCouponPage = async (req, res) => {
    if (!req.session.isAdmin) {
        return res.redirect('/admin/login'); 
    }
    try {
        
        res.render('admin/coupon');
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
};