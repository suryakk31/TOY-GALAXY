const Order = require('../../models/order');
const User = require('../../models/user');
const Product = require('../../models/product');
const Category = require('../../models/category');
const moment = require('moment');

exports.getAdminDashboard = async (req, res) => {
    try {
      
        const totalSales = await Order.aggregate([
            { $group: { _id: null, total: { $sum: "$totalPrice" } } }
        ]);

        
        const totalOrders = await Order.countDocuments();

        const totalUsers = await User.countDocuments();

      
        const totalProducts = await Product.countDocuments();

 
        const twelveWeeksAgo = moment().subtract(11, 'weeks').startOf('week');
        const weeklySales = await Order.aggregate([
            { $match: { orderDate: { $gte: twelveWeeksAgo.toDate() } } },
            { $group: {
                _id: { $dateToString: { format: "%Y-W%V", date: "$orderDate" } },
                sales: { $sum: "$totalPrice" }
            }},
            { $sort: { _id: 1 } }
        ]);

   
        const twelveMonthsAgo = moment().subtract(11, 'months').startOf('month');
        const monthlySales = await Order.aggregate([
            { $match: { orderDate: { $gte: twelveMonthsAgo.toDate() } } },
            { $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$orderDate" } },
                sales: { $sum: "$totalPrice" }
            }},
            { $sort: { _id: 1 } }
        ]);

   
        const fiveYearsAgo = moment().subtract(4, 'years').startOf('year');
        const yearlySales = await Order.aggregate([
            { $match: { orderDate: { $gte: fiveYearsAgo.toDate() } } },
            { $group: {
                _id: { $dateToString: { format: "%Y", date: "$orderDate" } },
                sales: { $sum: "$totalPrice" }
            }},
            { $sort: { _id: 1 } }
        ]);

  
        const categoryDistribution = await Product.aggregate([
            { $group: { _id: "$category", count: { $sum: 1 } } },
            { $lookup: { from: "categories", localField: "_id", foreignField: "_id", as: "category" } },
            { $unwind: "$category" },
            { $project: { name: "$category.name", count: 1 } }
        ]);

        const topProducts = await Order.aggregate([
            { $unwind: "$items" },
            { $group: { _id: "$items.productId", totalSales: { $sum: "$items.quantity" }, totalRevenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } } } },
            { $sort: { totalRevenue: -1 } },
            { $limit: 10 },
            { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "product" } },
            { $unwind: "$product" },
            { $project: { name: "$product.name", sales: "$totalSales", revenue: "$totalRevenue" } }
        ]);


        const topCategories = await Order.aggregate([
            { $unwind: "$items" },
            { $lookup: { from: "products", localField: "items.productId", foreignField: "_id", as: "product" } },
            { $unwind: "$product" },
            { $group: { _id: "$product.category", totalSales: { $sum: "$items.quantity" } } },
            { $sort: { totalSales: -1 } },
            { $limit: 10 },
            { $lookup: { from: "categories", localField: "_id", foreignField: "_id", as: "category" } },
            { $unwind: "$category" },
            { $project: { name: "$category.name", sales: "$totalSales" } }
        ]);


        const orderItemStatuses = await Order.aggregate([
            { $unwind: "$items" },
            { $group: { 
                _id: "$items.orderStatus", 
                count: { $sum: 1 } 
            }},
            { $project: {
                status: "$_id",
                count: 1,
                _id: 0
            }}
        ]);


        const orderItemStatusCounts = orderItemStatuses.reduce((acc, status) => {
            acc[status.status] = status.count;
            return acc;
        }, {});




        res.render('admin/adminDashboard', {
            totalSales: totalSales[0]?.total || 0,
            totalOrders,
            totalUsers,
            totalProducts,
            weeklySales,
            monthlySales,
            yearlySales,
            categoryDistribution,
            topProducts,
            topCategories,
            orderItemStatuses,
            orderItemStatusCounts
            
        });
    } catch (error) {
        console.error('Error in admin dashboard:', error);
        res.status(500).send('An error occurred while loading the dashboard');
    }
};