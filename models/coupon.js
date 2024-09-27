const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const couponSchema = new Schema({
    description: {
      type: String,
      required: true,
    },
    
    couponCode: {
        type: String,
        required: true, 
        unique: true,
    },
    discount: {
        type: Number,
        required: true, 
    },
    expiryDate: {
        type: Date,
        required: true, 
    },
    minAmount: {
        type: Number,
    },
    maxAmount: {
        type: Number,
    }
   
}, { timestamps: true }); 

module.exports = mongoose.model('Coupon', couponSchema);
