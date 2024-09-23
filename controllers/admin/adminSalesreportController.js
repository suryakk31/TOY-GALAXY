const Order = require('../../models/order')


exports.adminSales = async (req, res) => {
    try {
        const orders = await Order.find()
            .populate('userId')
            .populate({
                path: 'items.productId',
                select: 'name image' 
            })
            .populate('address');

        orders.forEach(order => {
            if (order.items.length > 0) {
                order.orderStatus = order.items[0].orderStatus; 
            } else {
                order.orderStatus = 'N/A'; 
            }
        });

        res.render('admin/adminsalesReport', { orders });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};


const PDFDocument = require('pdfkit');
exports.downloadSalesReportPDF = async (req, res) => {
    try {
        const orders = await Order.find()
            .populate('userId')
            .populate({
                path: 'items.productId',
                select: 'name image'
            })
            .populate('address');

        const doc = new PDFDocument({ margin: 30 });

        let filename = 'SalesReport.pdf';
        res.setHeader('Content-disposition', `attachment; filename=${filename}`);
        res.setHeader('Content-type', 'application/pdf');

        doc.pipe(res);

      
        doc.fontSize(12).text('Sales Report', { align: 'center' });
        doc.moveDown(0.5); 

        // Table header
        const tableTop = 100;
        const itemSpacing = 18; 

        drawTableRow(
            doc,
            tableTop,
            "Name",
            "Phone",
            "Product",
            "Qty",
            "Price",
            "Payment",
            "Order Date",
            "Status"
        );

        doc.moveTo(50, tableTop + 12).lineTo(550, tableTop + 12).stroke(); 

        let y = tableTop + 16;

        orders.forEach(order => {
            const name = order.userId.firstName;
            const phoneNumber = order.userId.phone;
            const paymentMethod = order.paymentMethod;
            const orderDate = new Date(order.orderDate).toLocaleDateString();

            order.items.forEach(item => {
                const productName = item.productId ? item.productId.name : 'No Product';
                const quantity = item.quantity || 1;
                const price = `₹${item.price.toFixed(2)}`;
                const orderStatus = item.orderStatus || 'Unknown'; 
                
              
                drawTableRow(
                    doc,
                    y,
                    name,
                    phoneNumber,
                    productName,
                    quantity,
                    price,
                    paymentMethod,
                    orderDate,
                    orderStatus
                );

                doc.moveTo(50, y + 12).lineTo(550, y + 12).stroke();

                y += itemSpacing;

          
                if (y > 750) { 
                    doc.addPage();
                    y = 100;
                }
            });
        });

        doc.end();
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};


function drawTableRow(doc, y, name, phoneNumber, productName, quantity, price, paymentMethod, orderDate, orderStatus) {
    doc.fontSize(8); 

   
    doc.text(name, 50, y, { width: 60, align: 'left' })
        .moveTo(110, y - 5).lineTo(110, y + 12).stroke(); 

    doc.text(phoneNumber, 120, y, { width: 60, align: 'left' })
        .moveTo(180, y - 5).lineTo(180, y + 12).stroke(); 

    doc.text(productName, 180, y, { width: 80, align: 'left' })
        .moveTo(260, y - 5).lineTo(260, y + 12).stroke(); 

    doc.text(quantity, 260, y, { width: 30, align: 'left' })
        .moveTo(290, y - 5).lineTo(290, y + 12).stroke(); 

    doc.text(price, 300, y, { width: 60, align: 'left' })
        .moveTo(360, y - 5).lineTo(360, y + 12).stroke();

    doc.text(paymentMethod, 360, y, { width: 60, align: 'left' })
        .moveTo(420, y - 5).lineTo(420, y + 12).stroke(); 

    doc.text(orderDate, 420, y, { width: 60, align: 'left' })
        .moveTo(480, y - 5).lineTo(480, y + 12).stroke();

    doc.text(orderStatus, 480, y, { width: 60, align: 'left' })
        .moveTo(540, y - 5).lineTo(540, y + 12).stroke(); 
}



const ExcelJS = require('exceljs');

exports.downloadSalesReportExcel = async (req, res) => {
    try {
        const orders = await Order.find()
            .populate('userId')
            .populate({
                path: 'items.productId',
                select: 'name image'
            })
            .populate('address');

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sales Report');

        worksheet.columns = [
            { header: 'Order ID', key: 'orderId', width: 20 },
            { header: 'Total Quantity', key: 'totalQuantity', width: 20 },
            { header: 'Total Price', key: 'totalPrice', width: 20 },
            { header: 'Payment Method', key: 'paymentMethod', width: 20 },
            { header: 'Order Date', key: 'orderDate', width: 20 },
            { header: 'Status', key: 'orderStatus', width: 20 },
        ];

        orders.forEach(order => {
            worksheet.addRow({
                orderId: order._id,
                totalQuantity: order.totalQuantity,
                totalPrice: order.totalPrice.toFixed(2),
                paymentMethod: order.paymentMethod,
                orderDate: new Date(order.orderDate).toDateString(),
                orderStatus: order.orderStatus
            });
        });

        res.setHeader('Content-Disposition', 'attachment; filename=SalesReport.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};
