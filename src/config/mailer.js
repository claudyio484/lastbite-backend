const nodemailer = require('nodemailer');

// Use Gmail service shorthand — handles host/port/secure automatically
// Falls back to manual SMTP config if SMTP_HOST is explicitly set to something other than gmail
const transportConfig = (process.env.SMTP_HOST && process.env.SMTP_HOST !== 'smtp.gmail.com')
  ? {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    }
  : {
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    };

let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport(transportConfig);
  }
  return transporter;
};

const sendEmail = async ({ to, subject, html }) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('⚠️ SMTP not configured. Email not sent.');
    console.log(`  Would send to: ${to}, subject: ${subject}`);
    return null;
  }

  const info = await getTransporter().sendMail({
    from: `"LastBite" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });

  console.log(`📧 Email sent to ${to}: ${info.messageId}`);
  return info;
};

module.exports = { sendEmail };
