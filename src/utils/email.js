const nodemailer = require('nodemailer');

// Create transporter (configure according to your email service)
const createTransporter = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Base configuration for both development and production
  const transporterConfig = {
    service: 'gmail', // or your email service
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports (587 uses STARTTLS)
    auth: {
      user: process.env.SMTP_EMAIL, // Your email
      pass: process.env.SMTP_PASSWORD  // Your email password or app password
    },
    tls: {
      // Do not fail on invalid certs (for both dev and prod)
      rejectUnauthorized: false
    }
  };

  // Production-specific settings (timeouts, pooling, rate limiting)
  if (isProduction) {
    transporterConfig.connectionTimeout = 60000; // 60 seconds
    transporterConfig.greetingTimeout = 30000; // 30 seconds
    transporterConfig.socketTimeout = 60000; // 60 seconds
    transporterConfig.pool = true;
    transporterConfig.maxConnections = 5;
    transporterConfig.maxMessages = 100;
    transporterConfig.rateDelta = 1000; // 1 second
    transporterConfig.rateLimit = 14; // 14 emails per rateDelta
  } else {
    // Development mode - faster timeouts for quick feedback
    transporterConfig.connectionTimeout = 10000; // 10 seconds
    transporterConfig.greetingTimeout = 5000; // 5 seconds
    transporterConfig.socketTimeout = 10000; // 10 seconds
  }

  return nodemailer.createTransport(transporterConfig);
};

// Send email function
const sendEmail = async (to, subject, text, html = null) => {
  let transporter;
  const isProduction = process.env.NODE_ENV === 'production';
  const timeoutDuration = isProduction ? 30000 : 15000; // Production: 30s, Development: 15s

  try {
    transporter = createTransporter();

    // Verify connection before sending (only in development for quick feedback)
    if (!isProduction) {
      try {
        await transporter.verify();
        console.log('Email server connection verified');
      } catch (verifyError) {
        console.warn('Email server verification failed, but continuing:', verifyError.message);
      }
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.SMTP_EMAIL || 'noreply@forpink.com',
      to: to,
      subject: subject,
      text: text
    };

    // If HTML content is provided
    if (html) {
      mailOptions.html = html;
    }

    // Send email with timeout (different for dev/prod)
    const result = await Promise.race([
      transporter.sendMail(mailOptions),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Email sending timeout after ${timeoutDuration / 1000} seconds`)), timeoutDuration)
      )
    ]);

    return {
      success: true,
      messageId: result.messageId
    };

  } catch (error) {
    console.error('Email sending error:', error);
    
    // Close transporter connection on error
    if (transporter) {
      transporter.close();
    }
    
    throw new Error('Failed to send email: ' + error.message);
  }
};

// Send OTP email specifically
const sendOTPEmail = async (email, otp) => {
  const subject = 'Your Forpink Register OTP';
  const text = `Your Forpink register OTP is: ${otp}. This code will expire in 5 minutes. Please do not share this code with anyone.`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8f9fa;">
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8f9fa; padding: 20px 0;">
        <tr>
          <td align="center">
            <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden;">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #ec4899 0%, #be185d 100%); padding: 40px 40px 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">Forpink</h1>
                  <p style="margin: 8px 0 0; color: #fce7f3; font-size: 14px; font-weight: 400;">Your trusted shopping partner</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px;">
                  <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 22px; font-weight: 600;">Email Verification</h2>
                  <p style="margin: 0 0 24px; color: #4b5563; font-size: 15px; line-height: 1.6;">
                    Thank you for registering with Forpink! Your register OTP is:
                  </p>
                  
                  <!-- OTP Box -->
                  <div style="background: linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%); border: 2px solid #fbcfe8; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0;">
                    <p style="margin: 0 0 12px; color: #9f1239; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">Your Verification Code</p>
                    <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #be185d; font-family: 'Courier New', monospace; margin: 8px 0;">
                      ${otp}
                    </div>
                  </div>
                  
                  <p style="margin: 24px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                    This code will expire in <strong style="color: #be185d;">5 minutes</strong>. Please use it to complete your registration.
                  </p>
                  
                  <p style="margin: 20px 0 0; color: #9ca3af; font-size: 13px; line-height: 1.6;">
                    <strong style="color: #6b7280;">⚠️ Security Notice:</strong> Never share this code with anyone. Forpink will never ask for your OTP.
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 30px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px;">
                    If you didn't request this code, please ignore this email.
                  </p>
                  <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                    © ${new Date().getFullYear()} Forpink. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return await sendEmail(email, subject, text, html);
};

module.exports = {
  sendEmail,
  sendOTPEmail
};