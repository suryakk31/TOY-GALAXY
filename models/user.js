const mongoose = require('mongoose');


const userSchema = new mongoose.Schema({
    googleId: {
        type: String,
        required: false
    },
    firstName: String,
    lastName: String,
    email: {
        type: String,
        required: true,
        unique: true
    },
    phone : Number,
     
    password: String,
    image: String,
    otp: String,
    otpExpiry: Date,
    isBlocked: {
        type: Boolean,
        default: false
    }
}, { 
    timestamps: true 
});


userSchema.methods.setOtp = function (otp) {
    this.otp = otp;
    this.otpExpiry = Date.now() + 3600000; 
};

module.exports = mongoose.model('User', userSchema);
