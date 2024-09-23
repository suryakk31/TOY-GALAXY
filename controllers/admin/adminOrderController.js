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
        const { status, itemId } = req.body;

        if (!status || !itemId) {
            return res.status(400).send('Invalid request');
        }

        
        const order = await Order.findOne({ 'items._id': itemId });
        if (!order) {
            return res.status(404).send('Order or Item not found');
        }

      
        const item = order.items.find(item => item._id.toString() === itemId);
        if (item.orderStatus === 'cancelled') {
            return res.status(400).send('Cannot update status of a canceled item');
        }

    
        const updatedOrder = await Order.findOneAndUpdate(
            { 'items._id': itemId },
            { $set: { 'items.$.orderStatus': status } },
            { new: true }
        );

        if (!updatedOrder) {
            return res.status(404).send('Order or Item not found');
        }

   
        res.redirect('/admin/orders'); 
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).send('Server Error');
    }
};
