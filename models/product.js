const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ProductSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  image: {
    type: [String],
    required: true
  },
  stock: {
    type: Number,
    required: true
  },
  discount: {
    type: Number,
  },
  category: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  created: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps:true
});

module.exports = mongoose.model('Product', ProductSchema);
