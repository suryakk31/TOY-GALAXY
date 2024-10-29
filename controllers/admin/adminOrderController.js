const Order = require('../../models/order')
const User = require("../../models/user");
const Wallet = require('../../models/wallet')
const Product = require('../../models/product')

exports.adminOrder = async (req, res) => {
    try {
        const perPage = 10;
        const page = parseInt(req.query.page) || 1;
        const sortCriteria = req.query.sort || 'createdAt';
        const sortOrder = req.query.order === 'asc' ? 1 : -1;
        const skip = (page - 1) * perPage;

        const orders = await Order.find()
            .populate('userId')
            .populate({
                path: 'items.productId',
                select: 'name image' 
            })
            .populate('address')
            .sort({ [sortCriteria] : sortOrder})
            .skip(skip)
            .limit(perPage);

            const totalOrders = await Order.countDocuments();
            const totalPages = Math.ceil(totalOrders / perPage);
    
        res.render('admin/adminOrder', { orders,
            currentPage: page,
            totalPages,
            sortCriteria,
            sortOrder
         });

    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};
exports.updateOrderStatus = async (req, res) => {
    try {
        const { status, itemId } = req.body;

        if (!status || !itemId) {
            return res.status(400).send('Invalid request');
        }

        const order = await Order.findOne({ 'items._id': itemId });
        if (!order) {
            return res.status(404).send('Order or Item not found');
        }

        const item = order.items.find(item => item._id.toString() === itemId);
        if (!item) {
            return res.status(404).send('Item not found');
        }

        if (item.orderStatus === 'cancelled') {
            return res.status(400).send('Cannot update status of a canceled item');
        }

        let updateStatus;
        let paymentStatus = item.paymentStatus; // Preserve existing payment status

        switch(status) {
            case 'cancelled':
                updateStatus = 'cancelled';
                
                // Update product stock first
                try {
                    const product = await Product.findById(item.productId);
                    if (!product) {
                        console.error(`Product not found for ID: ${item.productId}`);
                        return res.status(404).send('Product not found');
                    }

                    product.stock += item.quantity;
                    await product.save();
                    console.log(`Product stock updated after cancellation: ${product._id}, New stock: ${product.stock}`);
                } catch (error) {
                    console.error('Error updating product stock:', error);
                    return res.status(500).send('Error updating product stock');
                }

                // Process refund for paid orders (Razorpay or Wallet)
                if (item.paymentStatus === 'completed' && 
                    (order.paymentMethod === 'Razorpay' || order.paymentMethod === 'Wallet')) {
                    
                    // Calculate refund amount
                    const refundAmount = item.price * item.quantity + order.deliveryCharge;

                    // Validate refund amount
                    if (typeof refundAmount !== 'number' || isNaN(refundAmount) || refundAmount <= 0) {
                        return res.status(400).send('Invalid refund amount calculated');
                    }

                    // Find or create user wallet
                    let userWallet = await Wallet.findOne({ userId: order.userId });
                    if (!userWallet) {
                        userWallet = new Wallet({ 
                            userId: order.userId, 
                            balance: 0,
                            transactions: []
                        });
                    }

                    // Update wallet balance and add transaction
                    userWallet.balance += refundAmount;
                    userWallet.transactions.push({
                        type: 'refund',
                        amount: refundAmount,
                        description: `Refund for cancelled item in order #${order._id}`
                    });
                    await userWallet.save();

                    // Update payment status to refunded
                    paymentStatus = 'refunded';
                    
                    console.log(`Refund processed: Amount ${refundAmount} added to wallet for user ${order.userId}`);
                }
                break;

            case 'return_approved':
                updateStatus = 'returned';
                // Only change to refunded when admin approves return
                if (item.paymentStatus === 'refund pending') {
                    if (order.paymentMethod === 'Razorpay' || order.paymentMethod === 'Wallet' || order.paymentMethod === 'COD') {
                        paymentStatus = 'refunded';
                        
                        // Calculate refund amount
                        const refundAmount = item.price * item.quantity + order.deliveryCharge;

                        // Validate refund amount
                        if (typeof refundAmount !== 'number' || isNaN(refundAmount) || refundAmount <= 0) {
                            return res.status(400).send('Invalid refund amount calculated');
                        }

                        // Process refund based on payment method
                        if (order.paymentMethod === 'Razorpay' || order.paymentMethod === 'Wallet') {
                            // Find or create user wallet
                            let userWallet = await Wallet.findOne({ userId: order.userId });
                            if (!userWallet) {
                                userWallet = new Wallet({ 
                                    userId: order.userId, 
                                    balance: 0,
                                    transactions: []
                                });
                            }

                            // Update wallet balance and add transaction
                            userWallet.balance += refundAmount;
                            userWallet.transactions.push({
                                type: 'refund',
                                amount: refundAmount,
                                description: `Refund for returned item in order #${order._id}`
                            });
                            await userWallet.save();
                        }

                        // Update product stock
                        const product = await Product.findById(item.productId);
                        if (!product) {
                            console.error(`Product not found for ID: ${item.productId}`);
                            return res.status(404).send('Product not found');
                        }

                        product.stock += item.quantity;
                        await product.save();
                        console.log(`Product stock updated: ${product._id}, New stock: ${product.stock}`);
                    }
                }
                break;

            case 'return_rejected':
                updateStatus = 'delivered';
                // If return is rejected, revert payment status to completed
                if (item.paymentStatus === 'refund pending') {
                    paymentStatus = 'completed';
                }
                break;

            case 'delivered':
                updateStatus = 'delivered';
                // If COD and delivered, mark payment as completed
                if (order.paymentMethod === 'COD') {
                    paymentStatus = 'completed';
                }
                break;

            default:
                updateStatus = status;
        }

        const updatedOrder = await Order.findOneAndUpdate(
            { 'items._id': itemId },
            { 
                $set: { 
                    'items.$.orderStatus': updateStatus,
                    'items.$.paymentStatus': paymentStatus
                }
            },
            { new: true }
        );

        if (!updatedOrder) {
            return res.status(404).send('Failed to update order status');
        }

        res.redirect('/admin/orders');

    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).send('Server Error');
    }
};