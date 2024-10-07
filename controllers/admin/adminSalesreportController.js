const Order = require('../../models/order');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const moment = require('moment');


const getFilteredOrders = async (query) => {
    const { startDate, endDate, reportType } = query;
    let filter = {};
    let dateRange = {};

    if (startDate && endDate) {
     
        const start = moment(startDate, 'YYYY-MM-DD', true);
        const end = moment(endDate, 'YYYY-MM-DD', true);

        if (start.isValid() && end.isValid() && start.isBefore(end)) {
            dateRange = {
                orderDate: { $gte: start.toDate(), $lte: end.endOf('day').toDate() }
            };
        } else {
            throw new Error('Invalid date range. Ensure that startDate and endDate are in YYYY-MM-DD format and startDate is earlier than endDate.');
        }
    } else if (reportType && reportType !== 'All') {
        const today = new Date();
        today.setHours(23, 59, 59, 999); 
        let startDateTime = new Date();
        startDateTime.setHours(0, 0, 0, 0); 

        switch (reportType) {
            case 'daily':
             
                break;
            case 'weekly':
                startDateTime.setDate(today.getDate() - 7);
                break;
            case 'monthly':
                startDateTime.setMonth(today.getMonth() - 1);
                break;
            case 'yearly':
                startDateTime.setFullYear(today.getFullYear() - 1);
                break;
        }

        dateRange = {
            orderDate: { $gte: startDateTime, $lte: today }
        };
    }

    if (reportType && reportType !== 'All') {
        filter['items.orderStatus'] = reportType;
    }

    return Order.find({ ...dateRange, ...filter })
        .populate('userId')
        .populate({
            path: 'items.productId',
            select: 'name image'
        })
        .populate('address')
        .sort({ orderDate: -1 });  
};

exports.adminSales = async (req, res) => {
    try {
        const { startDate, endDate, reportType } = req.query;
        const orders = await getFilteredOrders(req.query);

   
        const processedOrders = orders.map(order => ({
            ...order.toObject(),
            userFirstName: order ? order.address.name : 'N/A',
            userPhone: order ? order.address.phone : 'N/A',
            addressDetails: order.address ? `${order.address.name}, ${order.address.locality}, ${order.address.city}, ${order.address.state} - ${order.address.pincode}` : 'N/A',
            orderStatus: order.items.length > 0 ? order.items[0].orderStatus : 'N/A'
        }));

        res.render('admin/adminsalesReport', { orders: processedOrders, startDate, endDate, reportType });
    } catch (error) {
        console.error('Error in adminSales:', error);
        res.status(500).send('Server Error');
    }
};

exports.downloadSalesReportPDF = async (req, res) => {
    try {
        const orders = await getFilteredOrders(req.query);
        const doc = new PDFDocument({ margin: 30, size: 'A4' });

        const filename = `SalesReport_${moment().format('YYYY-MM-DD')}.pdf`;
        res.setHeader('Content-disposition', `attachment; filename=${filename}`);
        res.setHeader('Content-type', 'application/pdf');

        doc.pipe(res);

        doc.fontSize(18).text('Sales Report', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Report Type: ${req.query.reportType || 'All'}`, { align: 'left' });
        if (req.query.startDate && req.query.endDate) {
            doc.text(`Date Range: ${req.query.startDate} to ${req.query.endDate}`, { align: 'left' });
        }
        doc.moveDown();

        const table = {
            headers: ['Order ID', 'Name', 'Phone', 'Quantity', 'Total Price', 'Payment', 'Order Date', 'Status'],
            rows: orders.map(order => ([
                `#${order._id.toString().slice(-4)}`,
                order ? order.address.name : 'N/A',
                order ? order.address.phone : 'N/A',
                order.totalQuantity,
                `₹${order.totalPrice.toFixed(2)}`,
                order.paymentMethod,
                moment(order.orderDate).format('DD-MM-YYYY'),
                order.items && order.items.length > 0 && order.items[0].orderStatus ? order.items[0].orderStatus : 'Unknown'
            ]))
        };

        drawTable(doc, table);
        doc.end();
    } catch (error) {
        console.error('Error in downloadSalesReportPDF:', error);
        res.status(500).send('Server Error');
    }
};

function drawTable(doc, table) {
    const startX = 50;
    let startY = doc.y + 20;
    const rowHeight = 20;
    const colWidth = (doc.page.width - 2 * startX) / table.headers.length;


    doc.font('Helvetica-Bold');
    table.headers.forEach((header, i) => {
        doc.text(header, startX + i * colWidth, startY, { width: colWidth, align: 'center' });
    });

 
    doc.font('Helvetica');
    table.rows.forEach((row, i) => {
        startY += rowHeight;
        if (startY + rowHeight > doc.page.height - 50) {
            doc.addPage();
            startY = 50;
        }
        row.forEach((cell, j) => {
            doc.text(cell, startX + j * colWidth, startY, { width: colWidth, align: 'center' });
        });
    });
}

exports.downloadSalesReportExcel = async (req, res) => {
    try {
        const orders = await getFilteredOrders(req.query);
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sales Report');

        worksheet.columns = [
            { header: 'Order ID', key: 'orderId', width: 20 },
            { header: 'Name', key: 'name', width: 30 },
            { header: 'Phone', key: 'phone', width: 30 },
            { header: 'Total Quantity', key: 'totalQuantity', width: 15 },
            { header: 'Total Price', key: 'totalPrice', width: 15 },
            { header: 'Payment Method', key: 'paymentMethod', width: 20 },
            { header: 'Order Date', key: 'orderDate', width: 20 },
            { header: 'Status', key: 'status', width: 15 },
        ];

     
        worksheet.addRow(['Report Type', req.query.reportType || 'All']);
        if (req.query.startDate && req.query.endDate) {
            worksheet.addRow(['Date Range', `${req.query.startDate} to ${req.query.endDate}`]);
        }
        worksheet.addRow([]);  

        orders.forEach(order => {
            worksheet.addRow({
                orderId: order._id,
                name: order ? order.address.name : 'N/A',
                phone: order ? order.address.phone : 'N/A',
                totalQuantity: order.totalQuantity,
                totalPrice: order.totalPrice.toFixed(2),
                paymentMethod: order.paymentMethod,
                orderDate: moment(order.orderDate).format('YYYY-MM-DD'),
                status: order.items.length > 0 ? order.items[0].orderStatus : 'N/A'
            });
        });

        const filename = `SalesReport_${moment().format('YYYY-MM-DD')}.xlsx`;
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error in downloadSalesReportExcel:', error);
        res.status(500).send('Server Error');
    }
};
