const Order = require('../../models/order');

exports.adminSales = async (req, res) => {
    try {
        let query = {};

      
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        switch (req.query.dateFilter) {
            case 'daily':
                query.orderDate = {
                    $gte: today,
                    $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
                };
                break;
            case 'weekly':
                const weekStart = new Date(today);
                weekStart.setDate(today.getDate() - today.getDay());
                query.orderDate = {
                    $gte: weekStart,
                    $lt: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
                };
                break;
            case 'monthly':
                const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
                query.orderDate = {
                    $gte: monthStart,
                    $lt: nextMonth
                };
                break;
            case 'custom':
                if (req.query.startDate && req.query.endDate) {
                    query.orderDate = {
                        $gte: new Date(req.query.startDate),
                        $lte: new Date(req.query.endDate)
                    };
                }
                break;
        }

        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const totalOrders = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalOrders / limit);

        const orders = await Order.find(query)
            .skip(skip)
            .limit(limit)
            .sort({ orderDate: -1 });

        const processedOrders = orders.map(order => ({
            ...order.toObject(),
            userFirstName: order.address ? order.address.name : 'N/A',
            userPhone: order.address ? order.address.phone : 'N/A',
            addressDetails: order.address ? `${order.address.name}, ${order.address.locality}, ${order.address.city}, ${order.address.state} - ${order.address.pincode}` : 'N/A',
            orderStatus: order.items.length > 0 ? order.items[0].orderStatus : 'N/A'
        }));

        res.render('admin/adminsalesReport', { 
            orders: processedOrders,
            filters: req.query,
            currentPage: page,
            totalPages: totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
            nextPage: page + 1,
            previousPage: page - 1,
            lastPage: totalPages,
            showPagination: totalOrders > limit
        });
    } catch (error) {
        console.error('Error in adminSales:', error);
        res.status(500).send('Server Error');
    }
};


