const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for 587 (STARTTLS)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendEmail = async ({ to, subject, html }) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('⚠️ SMTP not configured. Email not sent.');
    console.log(`  Would send to: ${to}, subject: ${subject}`);
    return null;
  }

  const info = await transporter.sendMail({
    from: `"LastBite" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });

  console.log(`📧 Email sent to ${to}: ${info.messageId}`);
  return info;
};

module.exports = { sendEmail };
