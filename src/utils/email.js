const nodemailer = require('nodemailer');

// Create transporter (configure according to your email service)
const createTransporter = () => {

    return nodemailer.createTransport({
        service: 'gmail', // or your email service
        auth: {
            user: process.env.SMTP_EMAIL, // Your email
            pass: process.env.SMTP_PASSWORD  // Your email password or app password
        }
        // For other services like Outlook, Yahoo, etc:
        /*
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
        */
    });
};

// Send email function
const sendEmail = async (to, subject, text, html = null) => {
    try {
        const transporter = createTransporter();

        const mailOptions = {
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to: to,
            subject: subject,
            text: text
        };

        // If HTML content is provided
        if (html) {
            mailOptions.html = html;
        }

        const result = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', result.messageId);
        return {
            success: true,
            messageId: result.messageId
        };

    } catch (error) {
        console.error('Email sending error:', error);
        throw new Error('Failed to send email: ' + error.message);
    }
};

// Send OTP email specifically
const sendOTPEmail = async (email, otp) => {
    const subject = 'Your OTP Verification Code';
    const text = `Your OTP code is: ${otp}. This code will expire in 5 minutes. Please do not share this code with anyone.`;

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">OTP Verification</h2>
      <p>Your OTP verification code is:</p>
      <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 3px; margin: 20px 0;">
        ${otp}
      </div>
      <p style="color: #666;">This code will expire in 5 minutes.</p>
      <p style="color: #666;">Please do not share this code with anyone.</p>
    </div>
  `;

    return await sendEmail(email, subject, text, html);
};

module.exports = {
    sendEmail,
    sendOTPEmail
};