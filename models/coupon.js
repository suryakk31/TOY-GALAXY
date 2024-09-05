const mongoose = require('mongoose');
const Schema = mongoose.Schema

const couponSchema = new Schema({
    code: {
      type: String,
      unique: true,
      required: true,
    },
    discountValue: {
        type: Number,
        required: true,
      },
      usedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      expirationDate: {
        type: Date,
        required: true,
      },
      isActive: {
        type: Boolean,
        default: true,
      },
    });
  
  
    module.exports = mongoose.model('Coupon', couponSchema);