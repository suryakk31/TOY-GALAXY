const User = require('../models/user')

exports.isAuthenticated = (req, res, next) => {
   
    if (req.session.email) {
    
        User.findOne({ email: req.session.email })
            .then(user => {
                if (user && user.isBlocked) {
                  
                    req.session.email = null;
                    return res.redirect('/auth/login');
                }
                return next();
            })
            .catch(err => {
                console.error(err);
                return res.redirect('/auth/login');
            });
    } else {
        res.redirect('/auth/login');
    }
};
