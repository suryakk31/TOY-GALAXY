const mongoose = require('mongoose');
const moment = require('moment-timezone');

const Schema = mongoose.Schema;

const OrderSchema = new Schema({

    orderId: {
        type: String
    },

    userId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "User"
    },

    items: [{

        productId: { 
            type: Schema.Types.ObjectId, 
            ref: "Product" 
        },

        productName: { 
            type: String
        },

        categoryId: { 
            type: Schema.Types.ObjectId, 
            ref: "Category" 
        },
        
        categoryName: { 
            type: String 
        },

        productDescription: { 
            type: String 
        },

        stock: { 
            type: Number 
        },

        productImage: { 
            type: [String] 
        },

        quantity: { 
            type: Number, 
            min: 1 
        },
        price: { 
            type: Number, 
            min: 0 
        },

        orderStatus: { 
            type: String, 
            default: 'pending' 
        },

        reason: { 
            type: String, 
            default: "" 
        },

        discountPrice: { 
            type: Number, 
            default: 0 
        },

    }],

    totalQuantity: { 
        type: Number, 
        min: 1 
    },

    totalPrice: { 
        type: Number, 
        min: 0 
    },

    address: {

        name: { 
            type: String, 
            required: true 
        },

        address: { 
            type: String, 
            required: true 
        },

        phone: { 
            type: String, 
            required: true 
        },

        locality: { 
            type: String, 
            required: true 
        },

        pincode: { 
            type: String, 
            required: true 
        },

        state: { 
            type: String, 
            required: true 
        },

        city: { 
            type: String, 
            required: true 
        }
    },

    paymentMethod: { 
        type: String, 
        required: true 
    },

    orderDate: { 
        type: Date, 
        default: Date.now 
    },

    createdAt: { type: Date, 
        default: Date.now 
    }
}, {
    timestamps: true
});


OrderSchema.pre('save', function(next) {
    this.orderDate = moment().tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss");
    this.createdAt = moment().tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss");
    next();
});

module.exports = mongoose.model('Orders', OrderSchema);
