const User = require('../../models/user');


exports.getUserManagementPage = async (req, res) => {
    if (!req.session.isAdmin) {
        return res.redirect('/admin/login'); 
    }
    try {
        const users = await User.find();
        res.render('admin/userManagement', { users });
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
};


exports.blockUser = async (req, res) => {
    try {
        
        const userId = req.params.id;
      
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).send('User not found');
        }

        user.isBlocked = !user.isBlocked;
        await user.save();

        res.redirect('/admin/userManagement'); 
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
};
