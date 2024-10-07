exports.isAuthenticated = (req, res, next) => {
    if (req.session.isAdmin) {
        return next();
    } else {
        res.redirect('/admin/login');
    }
};


