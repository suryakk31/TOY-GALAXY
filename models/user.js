const mongoose = require('mongoose');
const crypto = require('crypto');

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
    phone: Number,
    password: String,
    image: String,
    otp: String,
    otpExpiry: Date,
    isBlocked: {
        type: Boolean,
        default: false
    },
    referralCode: {
        type: String,
        unique: true,
        sparse: true
    }
}, { 
    timestamps: true 
});

userSchema.methods.setOtp = function (otp) {
    this.otp = otp;
    this.otpExpiry = Date.now() + 3600000; 
};

userSchema.methods.generateReferralCode = function() {
    return new Promise((resolve, reject) => {
        crypto.randomBytes(4, (err, buffer) => {
            if (err) {
                reject(err);
            } else {
                const code = buffer.toString('hex').toUpperCase();
                this.referralCode = code;
                resolve(code);
            }
        });
    });
};

module.exports = mongoose.model('User', userSchema);