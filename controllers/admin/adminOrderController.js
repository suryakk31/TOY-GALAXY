const Order = require('../../models/order')



exports.adminOrder = async (req, res) => {
    try {
        const orders = await Order.find()
            .populate('userId')
            .populate({
                path: 'items.productId',
                select: 'name image' 
            })
            .populate('address');

        res.render('admin/adminOrder', { orders });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

exports.updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const orderId = req.params.id;
        const itemId = req.body.itemId;

        console.log(`Status: ${status}, Order ID: ${orderId}, Item ID: ${itemId}`);

        if (!status || !orderId || !itemId) {
            return res.status(400).send('Invalid request');
        }

        const updatedOrder = await Order.findOneAndUpdate(
            { _id: orderId, 'items._id': itemId },
            { $set: { 'items.$.orderStatus': status } },
            { new: true }
        );

        if (!updatedOrder) {
            return res.status(404).send('Order not found');
        }

        console.log('Order updated successfully:', updatedOrder);
        res.redirect('/admin/orders'); // Redirect to orders page
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).send('Server Error');
    }
};