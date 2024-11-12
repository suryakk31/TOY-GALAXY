const Order = require('../../models/order');
const PDFDocument = require('pdfkit-table');
const ExcelJS = require('exceljs');

exports.adminSales = async (req, res) => {
    try {
        let query = {
            'items' : {
                $elemMatch: {
                    'orderStatus': 'delivered'

                }
            }
        };

      
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

            const processedOrders = orders.map(order => {
                const orderObj = order.toObject();
             
                orderObj.items = orderObj.items.filter(item => item.orderStatus === 'delivered');
                return {
                    ...orderObj,
                    userFirstName: orderObj.address ? orderObj.address.name : 'N/A',
                    userPhone: orderObj.address ? orderObj.address.phone : 'N/A',
                    addressDetails: orderObj.address ? 
                        `${orderObj.address.name}, ${orderObj.address.locality}, ${orderObj.address.city}, ${orderObj.address.state} - ${orderObj.address.pincode}` : 'N/A'
                };
            });
    

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

exports.downloadSalesPDF = async (req, res) => {
    try {
        
        let query = {
            'items': {
                $elemMatch: {
                    'orderStatus': 'delivered'
                }
            }
        };

      
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

        const orders = await Order.find(query).sort({ orderDate: -1 });


        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        
   
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=toy_galaxy_sales_report.pdf');
        
   
        doc.pipe(res);

  
        doc.fontSize(18).text('Toy Galaxy Sales Report', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'left' });
        doc.moveDown();

     
        const tableData = {
            headers: ['Name', 'Phone Number', 'Address', 'Product Name', 'Quantity', 'Original Price', 'Discount', 'Coupon Discount', 'Final Price', 'Payment Method', 'Order Date'],
            rows: []
         };
         
         orders.forEach(order => {
            order.items.forEach(item => {
                if (item.orderStatus === 'delivered') {
                    tableData.rows.push([
                        order.address?.name || 'Unknown',
                        order.address?.phone || 'Unknown',
                        `${order.address?.name || ''}, ${order.address?.locality || ''}, ${order.address?.city || ''}, ${order.address?.state || ''} - ${order.address?.pincode || ''}`,
                        item.productName,
                        item.quantity.toString(),
                        `RS.${item.price?.toFixed(2)}`, // Original price
                        `RS.${(item.price - item.discountPrice).toFixed(2)}`, // Discount amount
                        `RS.${item.couponDiscountPrice || '0'}`, // Coupon discount
                        `RS.${(item.discountPrice - (item.couponDiscountPrice || 0)).toFixed(2)}`, // Final price after all discounts
                        order.paymentMethod,
                        order.orderDate ? order.orderDate.toDateString() : 'N/A'
                    ]);
                }
            });
         });
        await doc.table(tableData, {
            prepareHeader: () => doc.fontSize(10),
            prepareRow: () => doc.fontSize(10)
        });

  
        doc.end();

    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).send('Error generating PDF report');
    }
};


exports.downloadSalesExcel = async (req, res) => {
    try {
        let query = {
            'items': {
                $elemMatch: {
                    'orderStatus': 'delivered'
                }
            }
        };
 
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
 
        const orders = await Order.find(query).sort({ orderDate: -1 });
 
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sales Report');
 
        worksheet.columns = [
            { header: 'Name', key: 'name', width: 20 },
            { header: 'Phone Number', key: 'phone', width: 15 },
            { header: 'Address', key: 'address', width: 40 },
            { header: 'Product Name', key: 'product', width: 20 },
            { header: 'Quantity', key: 'quantity', width: 10 },
            { header: 'Original Price', key: 'originalPrice', width: 15 },
            { header: 'Discount', key: 'discount', width: 15 },
            { header: 'Coupon Discount', key: 'couponDiscount', width: 15 },
            { header: 'Final Price', key: 'finalPrice', width: 15 },
            { header: 'Payment Method', key: 'payment', width: 15 },
            { header: 'Order Date', key: 'date', width: 15 }
        ];
 
   
        worksheet.getRow(1).font = { bold: true };
 
      
        orders.forEach(order => {
            order.items.forEach(item => {
                if (item.orderStatus === 'delivered') {
                    const originalPrice = item.price || 0;
                    const discountAmount = item.price - item.discountPrice || 0;
                    const couponDiscount = item.couponDiscountPrice || 0;
                    const finalPrice = item.discountPrice - couponDiscount;
 
                    worksheet.addRow({
                        name: order.address?.name || 'Unknown',
                        phone: order.address?.phone || 'Unknown',
                        address: `${order.address?.name || ''}, ${order.address?.locality || ''}, ${order.address?.city || ''}, ${order.address?.state || ''} - ${order.address?.pincode || ''}`,
                        product: item.productName,
                        quantity: item.quantity,
                        originalPrice: `Rs. ${originalPrice.toFixed(2)}`,
                        discount: `Rs. ${discountAmount.toFixed(2)}`,
                        couponDiscount: `Rs. ${couponDiscount.toFixed(2)}`,
                        finalPrice: `Rs. ${finalPrice.toFixed(2)}`,
                        payment: order.paymentMethod,
                        date: order.orderDate ? order.orderDate.toDateString() : 'N/A'
                    });
                }
            });
        });
 
        worksheet.eachRow((row, rowNumber) => {
            row.eachCell((cell) => {
                cell.alignment = { vertical: 'middle', horizontal: 'left' };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });
 
    
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=toy_galaxy_sales_report.xlsx');
 
        await workbook.xlsx.write(res);
        res.end();
 
    } catch (error) {
        console.error('Error generating Excel:', error);
        res.status(500).send('Error generating Excel report');
    }
 };
