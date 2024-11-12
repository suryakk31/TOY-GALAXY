const Order = require('../../models/order');
const User = require('../../models/user');
const Product = require('../../models/product');

const moment = require('moment');

exports.getAdminDashboard = async (req, res) => {
    try {
      
        const totalSales = await Order.aggregate([
            {
                $addFields: {
                    effectiveItems: {
                        $map: {
                            input: "$items",
                            as: "item",
                            in: {
                                effectivePrice: {
                                    $subtract: [
                                        "$$item.price",
                                        { $add: ["$$item.discountPrice", "$$item.couponDiscountPrice"] }
                                    ]
                                },
                                quantity: "$$item.quantity",
                                orderStatus: "$$item.orderStatus",
                                paymentStatus: "$$item.paymentStatus"
                            }
                        }
                    }
                }
            },
            {
                $addFields: {
                   
                    refundAmount: {
                        $reduce: {
                            input: "$effectiveItems",
                            initialValue: 0,
                            in: {
                                $add: [
                                    "$$value",
                                    {
                                        $cond: {
                                            if: {
                                                $or: [
                                                    { $eq: ["$$this.orderStatus", "cancelled"] },
                                                    { $eq: ["$$this.orderStatus", "returned"] },
                                                    { $eq: ["$$this.paymentStatus", "refunded"] },
                                                    { $eq: ["$$this.paymentStatus", "cancelled"] }
                                                ]
                                            },
                                            then: {
                                                $multiply: [
                                                    "$$this.effectivePrice",
                                                    "$$this.quantity"
                                                ]
                                            },
                                            else: 0
                                        }
                                    }
                                ]
                            }
                        }
                    },
                    deliveryChargeRefund: {
                        $cond: {
                            if: {
                                $anyElementTrue: {
                                    $map: {
                                        input: "$items",
                                        as: "item",
                                        in: {
                                            $or: [
                                                { $eq: ["$$item.orderStatus", "cancelled"] },
                                                { $eq: ["$$item.orderStatus", "returned"] },
                                                { $eq: ["$$item.paymentStatus", "refunded"] },
                                                { $eq: ["$$item.paymentStatus", "cancelled"] }
                                            ]
                                        }
                                    }
                                }
                            },
                            then: "$deliveryCharge",
                            else: 0
                        }
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    total: {
                        $sum: {
                            $subtract: [
                                { $subtract: ["$totalPrice", "$couponDiscount"] },
                                { $add: ["$refundAmount", "$deliveryChargeRefund"] }
                            ]
                        }
                    }
                }
            }
        ]);
        
        const totalOrders = await Order.countDocuments();

        const totalUsers = await User.countDocuments();

      
        const totalProducts = await Product.countDocuments();
        const thirtyDaysAgo = moment().subtract(29, 'days').startOf('day');
        const dailySales = await Order.aggregate([
            {
                $match: {
                    orderDate: { $gte: thirtyDaysAgo.toDate() }
                }
            },
            {
                $addFields: {
                    effectiveItems: {
                        $map: {
                            input: "$items",
                            as: "item",
                            in: {
                                effectivePrice: {
                                    $subtract: [
                                        "$$item.price",
                                        { $add: ["$$item.discountPrice", "$$item.couponDiscountPrice"] }
                                    ]
                                },
                                quantity: "$$item.quantity",
                                orderStatus: "$$item.orderStatus",
                                paymentStatus: "$$item.paymentStatus"
                            }
                        }
                    }
                }
            },
            {
                $addFields: {
                    refundAmount: {
                        $reduce: {
                            input: "$effectiveItems",
                            initialValue: 0,
                            in: {
                                $add: [
                                    "$$value",
                                    {
                                        $cond: {
                                            if: {
                                                $or: [
                                                    { $eq: ["$$this.orderStatus", "cancelled"] },
                                                    { $eq: ["$$this.orderStatus", "returned"] },
                                                    { $eq: ["$$this.paymentStatus", "refunded"] },
                                                    { $eq: ["$$this.paymentStatus", "cancelled"] }
                                                ]
                                            },
                                            then: {
                                                $multiply: [
                                                    "$$this.effectivePrice",
                                                    "$$this.quantity"
                                                ]
                                            },
                                            else: 0
                                        }
                                    }
                                ]
                            }
                        }
                    },
                    deliveryChargeRefund: {
                        $cond: {
                            if: {
                                $anyElementTrue: {
                                    $map: {
                                        input: "$items",
                                        as: "item",
                                        in: {
                                            $or: [
                                                { $eq: ["$$item.orderStatus", "cancelled"] },
                                                { $eq: ["$$item.orderStatus", "returned"] },
                                                { $eq: ["$$item.paymentStatus", "refunded"] },
                                                { $eq: ["$$item.paymentStatus", "cancelled"] }
                                            ]
                                        }
                                    }
                                }
                            },
                            then: "$deliveryCharge",
                            else: 0
                        }
                    }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
                    sales: {
                        $sum: {
                            $subtract: [
                                { $subtract: ["$totalPrice", "$couponDiscount"] },
                                { $add: ["$refundAmount", "$deliveryChargeRefund"] }
                            ]
                        }
                    }
                }
            },
            { $sort: { _id: 1 } }
        ]);

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


        const lastMonth = moment().subtract(1, 'months').startOf('month');
        const twoMonthsAgo = moment().subtract(2, 'months').startOf('month');
        
        const [lastMonthSales, previousMonthSales] = await Promise.all([
            Order.aggregate([
                {
                    $match: {
                        orderDate: {
                            $gte: lastMonth.toDate(),
                            $lt: moment().startOf('month').toDate()
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: "$totalPrice" }
                    }
                }
            ]),
            Order.aggregate([
                {
                    $match: {
                        orderDate: {
                            $gte: twoMonthsAgo.toDate(),
                            $lt: lastMonth.toDate()
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: "$totalPrice" }
                    }
                }
            ])
        ]);

        const monthlyGrowth = lastMonthSales[0] && previousMonthSales[0]
            ? ((lastMonthSales[0].total - previousMonthSales[0].total) / previousMonthSales[0].total) * 100
            : 0;

        const averageOrderValue = totalOrders > 0 ? (totalSales[0]?.total || 0) / totalOrders : 0;

      
        const recentOrders = await Order.find()
            .sort({ orderDate: -1 })
            .limit(5);

   
        const recentUsers = await User.find()
            .sort({ createdAt: -1 })
            .limit(5);

      
        const lowStockThreshold = 10; 
        const lowStockItems = await Product.find({ stock: { $lte: lowStockThreshold } })
            .select('name stock')
            .limit(5);
        
        const lowStockCount = await Product.countDocuments({ stock: { $lte: lowStockThreshold } });

       
        const categoryPerformance = await Order.aggregate([
            { $unwind: "$items" },
            { $lookup: { from: "products", localField: "items.productId", foreignField: "_id", as: "product" } },
            { $unwind: "$product" },
            { $group: {
                _id: "$product.category",
                revenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } },
                sales: { $sum: "$items.quantity" }
            }},
            { $lookup: { from: "categories", localField: "_id", foreignField: "_id", as: "category" } },
            { $unwind: "$category" },
            { $project: {
                name: "$category.name",
                revenue: 1,
                sales: 1
            }},
            { $sort: { revenue: -1 } },
            { $limit: 5 }
        ]);




        res.render('admin/adminDashboard', {
            totalSales: totalSales[0]?.total || 0,
            totalOrders,
            totalUsers,
            totalProducts,
            dailySales,
            weeklySales,
            monthlySales,
            yearlySales,
            categoryDistribution,
            topProducts,
            topCategories,
            orderItemStatuses,
            orderItemStatusCounts,
            monthlyGrowth,
            averageOrderValue,
            recentOrders,
            recentUsers,
            lowStockItems,
            lowStockCount,
            categoryPerformance,
            moment
            
        });
    } catch (error) {
        console.error('Error in admin dashboard:', error);
        res.status(500).send('An error occurred while loading the dashboard');
    }
};

