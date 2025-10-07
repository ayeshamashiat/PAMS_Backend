const nodemailer = require('nodemailer');

const sendEmail = async ({ email, subject, message }) => {
  try {
    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE, // should be 'gmail'
      auth: {
        user: process.env.EMAIL_USER,      // your_email@gmail.com
        pass: process.env.EMAIL_PASS       // your_app_password (not real password)
      }
    });

    const mailOptions = {
      from: `PAMS Admin <${process.env.EMAIL_USER}>`,
      to: email,
      subject,
      text: message
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.response);
  } catch (error) {
    console.error('Email send failed:', error);
    throw new Error('Email could not be sent');
  }
};

module.exports = sendEmail;