const dotenv = require('dotenv');
dotenv.config();


const config = {
    adminEmail: process.env.ADMIN_EMAIL,
    adminPassword: process.env.ADMIN_PASSWORD
};


exports.adminLogin = (req, res) => {
    if (req.session.isAdmin) {
        return res.redirect('/admin/adminDashboard');
    }
  
    res.render('admin/login', { title: 'Admin Login' });
};


exports.loginPost = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (email === config.adminEmail && password === config.adminPassword) {
           
            req.session.isAdmin = true;
          
            return res.redirect('/admin/adminDashboard'); 
        }

        res.render('admin/login', { title: 'Admin Login', errorMessage: 'Invalid email or password.' });
    } catch (error) {
        console.error(error);
        
    }
};



exports.adminDashboard = (req, res) => {
    if (!req.session.isAdmin) {
        return res.redirect('/admin/login'); 
    }
  
    res.render('admin/adminDashboard', { title: 'Admin Dashboard' });
};


exports.adminLogout = (req,res) => {

    req.session.destroy(err => {
        if(err) {
            console.error(err);
            return res.status(500).send('Internal server error')
        }
        res.redirect('/admin/login')
    })
}