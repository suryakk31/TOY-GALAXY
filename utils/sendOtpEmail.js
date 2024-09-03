const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD
    }
});

async function sendOtpEmail(to, otp) {
    const mailOptions = {
        from: process.env.EMAIL,
        to,
        subject: 'OTP Verification',
        text: `Your OTP is ${otp}`
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Error sending email:', error);
    }
}

module.exports = sendOtpEmail;
