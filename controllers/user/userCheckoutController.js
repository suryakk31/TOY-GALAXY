const User = require('../../models/user');
const Orders = require('../../models/order');
const Cart = require('../../models/cart');
const Address = require('../../models/address');
const Category = require('../../models/category'); 
const Coupon = require('../../models/coupon')

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


        const cart = await Cart.findOne({ userId: userDatabase._id })
            .populate({
                path: 'items.productId',
                populate: { path: 'category' } // Ensure category data is populated within productId
            });

        if (!cart || cart.items.length === 0) {
            return res.redirect('/user/product', {
                message: 'Your cart is empty.'
            });
        }
     

        const categories = await Category.find();
        const addresses = await Address.find({ userId: userDatabase._id });
        const coupon = await Coupon.find()

         // Calculate original total
         const originalTotal = cart.items.reduce((sum, item) => {
            const itemTotal = (item.productId.price - (item.productId.price * item.productId.discount / 100)) * item.quantity;
            return sum + itemTotal;
        }, 0);

        // Calculate category offer
        const categoryOffer = cart.items.reduce((sum, item) => {
            if (item.productId.category && item.productId.category.offer) {
                const productPriceAfterDiscount = (item.productId.price - (item.productId.price * item.productId.discount / 100)) * item.quantity;
                const offer = productPriceAfterDiscount * (item.productId.category.offer / 100);
                return sum + offer;
            }
            return sum;
        }, 0);

        const deliveryFee = 50;
        const total = (originalTotal - categoryOffer + deliveryFee).toFixed(2);
        

        res.render('user/checkout', {
            isLoggedIn,
            userDatabase,
            categories,
            addresses,
            cartItems: cart.items,
            originalTotal: originalTotal.toFixed(2),
            categoryOffer: categoryOffer.toFixed(2),
            deliveryFee,
            total,
            coupon
        });
        console.log('category offer:',categoryOffer)
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

exports.postCheckout = async (req, res) => {
    try {
        const addressId = req.body.address;
        const paymentMethod = req.body.paymentMethod;
        const couponCode = req.body.couponCode; // Get coupon code from request body
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

        const cart = await Cart.findOne({ userId: userDatabase._id })
        .populate({
            path: 'items.productId',
            populate: { path: 'category' } 
        });

        if (!cart || cart.items.length === 0) {
            return res.redirect('/user/product', {
                message: 'Your cart is empty.'
            });
        }

        let discountAmount = 0;
        if (couponCode) {
            const coupon = await Coupon.findOne({ couponCode: couponCode });
            if (coupon) {
                if (new Date() > coupon.expiryDate) {
                    return res.status(400).json({ error: 'Coupon has expired' });
                }

                const cartTotal = cart.items.reduce((total, item) => {
                    return total + (item.productId.price * item.quantity);
                }, 0);

                if (cartTotal < coupon.minAmount) {
                    return res.status(400).json({ error: `Minimum purchase amount of ₹${coupon.minAmount} required` });
                }

                discountAmount = (cartTotal * coupon.discount) / 100;
            } else {
                return res.status(404).json({ error: 'Invalid coupon code' });
            }
        }

        const originalTotal = cart.items.reduce((sum, item) => {
            const itemTotal = (item.productId.price - (item.productId.price * item.productId.discount / 100)) * item.quantity;
            return sum + itemTotal;
        }, 0);

        const categoryOffer = cart.items.reduce((sum, item) => {
            if (item.productId.category && item.productId.category.offer) {
                const productPriceAfterDiscount = (item.productId.price - (item.productId.price * item.productId.discount / 100)) * item.quantity;
                const offer = productPriceAfterDiscount * (item.productId.category.offer / 100);
                return sum + offer;
            }
            return sum;
        }, 0);

        const deliveryFee = 50;
        const totalPrice = (originalTotal - categoryOffer - discountAmount + deliveryFee).toFixed(2);
        const totalQuantity = cart.items.reduce((sum, item) => sum + item.quantity, 0);

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
            discountPrice: item.productId.price - (item.productId.price * item.productId.discount / 100) // Calculate discount price
        }));

        const newOrder = new Orders({
            userId: user._id,
            items: orderItems,
            totalQuantity,
            totalPrice: totalPrice,
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
