const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const walletSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "User"
    },

  balance: { 
    type: Number, 
    default: 0 
},

  transactions: [
    {
      type: {
        type: String,
        enum: ["deposit", "debit", "refund"],
        required: true,
      },
      amount: { type: Number, required: true },
      timestamp: { type: Date, default: Date.now },
      description: { type: String },
    },
  ],
});

module.exports = mongoose.model("Wallet", walletSchema);