const User = require('../../models/user');
const Category = require('../../models/category');
const Address = require('../../models/address')


exports.manageAddress = async(req,res) => {
    try {
        const isLoggedIn = req.session.email ? true : false;
        let userDatabase = null;
        

        if (isLoggedIn) {
            userDatabase = await User.findOne({ email: req.session.email });

            if (userDatabase.isBlocked) {
                req.session.destroy(); 
                return res.render('auth/login', { errorMessage: 'Your account has been blocked. Please contact support.' });
            }
        }
        const email = req.session.email;
        const user = await User.findOne({email});
        const userId = user._id;
        
        const categories = await Category.find();
        const addresses = await Address.find({userId:userId});
      
       res.render('user/address',{isLoggedIn,userDatabase,categories,addresses}); 
    } catch (error) {
      console.log(error);  
    }
}



exports.addAddress = async (req, res) => {
    try {
        const { name, address, phone, locality, pincode, state, city } = req.body;
        const email = req.session.email;
        const user = await User.findOne({email});
        const userId = user._id;
        
        
        const newAddress = new Address({
            userId,
            name,
            address,
            phone,
            locality,
            pincode,
            state,
            city
        });

       
        await newAddress.save();

       
        res.status(201).json({
            success: true,
            message: 'Address added successfully',
            data: newAddress
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error, could not add address'
        });
    }
};


exports.getupdateAddress = async (req, res) => {
    try {
   
        const isLoggedIn = req.session.email ? true : false;
        let userDatabase = null;

        if (isLoggedIn) {
            userDatabase = await User.findOne({ email: req.session.email });

            if (userDatabase.isBlocked) {
                req.session.destroy();
                return res.render('auth/login', { errorMessage: 'Your account has been blocked. Please contact support.' });
            }
        }

    
        const addressId = req.params.id;
        const address = await Address.findById(addressId);

      
        if (!address) {
            return res.status(404).json({ message: 'Address not found' });
        }

        res.status(200).json(address);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error, could not fetch address' });
    }
};

exports.updateAddress = async (req, res) => {
    try {
        const addressId = req.params.id;
        const updatedData = req.body;

        const updatedAddress = await Address.findByIdAndUpdate(addressId, updatedData, { new: true });

        if (!updatedAddress) {
            return res.status(404).json({ message: 'Address not found' });
        }

        res.status(200).json({
            success: true,
            message: 'Address updated successfully',
            data: updatedAddress
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error, could not update address'
        });
    }
};
exports.deleteAddress = async (req, res) => {
    try {
        const { id: addressId } = req.params;

          
              const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(addressId);

              if (!isValidObjectId) {
                  return res.status(400).json({
                      success: false,
                      message: 'Invalid address ID'
                  });
              }
      
      
        const deletedAddress = await Address.findByIdAndDelete(addressId);

        if (!deletedAddress) {
            return res.status(404).json({
                success: false,
                message: 'Address not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Address deleted successfully',
            data: deletedAddress
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error, could not delete address'
        });
    }
};

