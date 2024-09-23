const mongoose = require('mongoose');


const userSchema = new mongoose.Schema({
    
    googleId: {
        type: String,
        required: false
    },

    wallet: {
        balance: {
            type: Number,
            default: 0
        },
        transactions: [{
            amount: Number,
            description: String,
            date: { type: Date, default: Date.now }
        }]
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
