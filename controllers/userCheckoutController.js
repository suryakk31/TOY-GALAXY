const User = require('../models/user');
const Orders = require('../models/order');
const Cart = require('../models/cart');
const Address = require('../models/address');
const Category = require('../models/category'); 

exports.getCheckout = async (req, res) => {
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

        
        if (!userDatabase) {
            return res.redirect('/auth/login');
        }

        const cart = await Cart.findOne({ userId: userDatabase._id }).populate('items.productId');
        if (!cart || cart.items.length === 0) {
            return res.redirect('/user/product', {
                message: 'Your cart is empty.'
            });
        }

        console.log("cart is working", cart);

        const categories = await Category.find();
        const addresses = await Address.find({ userId: userDatabase._id });

        const originalTotal = cart.items.reduce((sum, item) => sum + (item.productId.price - (item.productId.price * item.productId.discount / 100)) * item.quantity, 0).toFixed(2);
        const discount = cart.items.reduce((sum, item) => sum + (item.productId.price * item.productId.discount / 100) * item.quantity, 0).toFixed(2);
        const deliveryFee = 50;
        const total = parseFloat((originalTotal - discount + deliveryFee).toFixed(2));

        res.render('user/checkout', {
            isLoggedIn,
            userDatabase,
            categories,
            addresses,
            cartItems: cart.items,
            originalTotal,
            discount,
            deliveryFee,
            total,
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

exports.postCheckout = async (req, res) => {
    try {
        const addressId = req.body.address;
        const paymentMethod = req.body.paymentMethod;

        const user = await User.findOne({ email: req.session.email });
        if (!user) {
            console.error('User not found');
            return res.status(400).json({ error: 'User not found' });
        }

        const address = await Address.findById(addressId);
        if (!address) {
            console.error('Address not found');
            return res.status(400).json({ error: 'Address not found' });
        }

        const cart = await Cart.findOne({ userId: user._id }).populate('items.productId');
        if (!cart || cart.items.length === 0) {
            console.error('Cart is empty');
            return res.status(400).json({ error: 'Cart is empty' });
        }

        const orderItems = cart.items.map(item => ({
            productId: item.productId._id,
            productName: item.productId.name,
            categoryId: item.productId.category._id,
            categoryName: item.productId.category.name,
            productDescription: item.productId.description,
            stock: item.productId.stock,
            productImage: item.productId.image,
            quantity: item.quantity,
            price: item.productId.price,
            discountPrice: (item.productId.price * (1 - item.productId.discount / 100)).toFixed(2),
        }));

        const totalQuantity = cart.items.reduce((sum, item) => sum + item.quantity, 0);
        const totalPrice = orderItems.reduce((sum, item) => sum + item.quantity * item.discountPrice, 0);

        const newOrder = new Orders({
            userId: user._id,
            items: orderItems,
            totalQuantity,
            totalPrice: totalPrice.toFixed(2),
            address: {
                name: address.name,
                address: address.address,
                phone: address.phone,
                locality: address.locality,
                pincode: address.pincode,
                state: address.state,
                city: address.city
            },
            paymentMethod,
            orderStatus: 'pending',
            orderDate: new Date(),  
            createdAt: new Date()   
        });

        await newOrder.save();

        await Cart.deleteOne({ userId: user._id });

        res.status(200).json({ message: 'Order placed successfully' });  
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
