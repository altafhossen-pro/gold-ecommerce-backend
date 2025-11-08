const nodemailer = require('nodemailer');

// Create transporter (configure according to your email service)
const createTransporter = () => {
  const transporterConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false, // true for 465, false for 587 (STARTTLS)
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD
    },
    tls: {
      rejectUnauthorized: false
    }
  };

  return nodemailer.createTransport(transporterConfig);
};

// Send email function
const sendEmail = async (to, subject, text, html = null) => {
  try {
    const transporter = createTransporter();

    // Use SMTP_EMAIL as from address to avoid spam (must match authenticated email)
    const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_EMAIL;
    const fromName = process.env.EMAIL_FROM_NAME || 'Forpink';

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`, // Proper format: "Name" <email@domain.com>
      to: to,
      subject: subject,
      text: text,
      // Add proper headers to avoid spam
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high',
        'List-Unsubscribe': `<mailto:${fromEmail}?subject=unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
      },
      // Add reply-to
      replyTo: fromEmail
    };

    // If HTML content is provided
    if (html) {
      mailOptions.html = html;
    }

    const result = await transporter.sendMail(mailOptions);

    return {
      success: true,
      messageId: result.messageId
    };

  } catch (error) {
    console.error('Email sending error:', error.message);
    throw new Error('Failed to send email: ' + error.message);
  }
};

// Send OTP email specifically
const sendOTPEmail = async (email, otp) => {
  // Better subject line to avoid spam filters
  const subject = 'Your Forpink Verification Code';
  const text = `Your Forpink verification code is: ${otp}. This code will expire in 5 minutes. Please do not share this code with anyone.`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
      <meta name="format-detection" content="telephone=no">
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

// Send order confirmation email
const sendOrderConfirmationEmail = async (order, user) => {
  try {
    // Format order date
    const orderDate = new Date(order.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Calculate subtotal from items
    const subtotal = order.items.reduce((sum, item) => sum + (item.subtotal || item.price * item.quantity), 0);
    
    // Calculate total discounts
    const totalDiscounts = (order.discount || 0) + (order.couponDiscount || 0) + (order.upsellDiscount || 0) + (order.loyaltyDiscount || 0);
    
    // Build items HTML (without images)
    const itemsHtml = order.items.map((item, index) => {
      const variantInfo = item.variant ? 
        `<p style="margin: 4px 0 0; color: #6b7280; font-size: 13px;">
          ${item.variant.size ? `Size: ${item.variant.size}` : ''}
          ${item.variant.color ? `${item.variant.size ? ', ' : ''}Color: ${item.variant.color}` : ''}
        </p>` : '';
      
      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            <div>
              <p style="margin: 0 0 4px; font-weight: 600; color: #1f2937; font-size: 14px;">${item.name || 'Product'}</p>
              ${variantInfo}
              <p style="margin: 4px 0 0; color: #6b7280; font-size: 13px;">Quantity: ${item.quantity}</p>
            </div>
          </td>
          <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">
            <p style="margin: 0; font-weight: 600; color: #1f2937; font-size: 14px;">৳${(item.subtotal || item.price * item.quantity).toFixed(2)}</p>
          </td>
        </tr>
      `;
    }).join('');

    // Payment method display
    const paymentMethodDisplay = {
      'cod': 'Cash on Delivery (COD)',
      'card': 'Credit/Debit Card',
      'bkash': 'bKash',
      'nagad': 'Nagad',
      'rocket': 'Rocket',
      'bank': 'Bank Transfer'
    }[order.paymentMethod] || order.paymentMethod || 'N/A';

    // Status display
    const statusDisplay = {
      'pending': 'Pending',
      'confirmed': 'Confirmed',
      'processing': 'Processing',
      'shipped': 'Shipped',
      'delivered': 'Delivered',
      'cancelled': 'Cancelled',
      'returned': 'Returned'
    }[order.status] || order.status;

    // Build shipping address
    const shippingAddress = order.shippingAddress ? `
      <p style="margin: 0 0 4px; color: #4b5563; font-size: 14px; line-height: 1.6;">
        ${order.shippingAddress.street || ''}<br>
        ${[order.shippingAddress.area, order.shippingAddress.upazila, order.shippingAddress.district, order.shippingAddress.division].filter(Boolean).join(', ')}<br>
        ${order.shippingAddress.postalCode ? `Postal Code: ${order.shippingAddress.postalCode}` : ''}
      </p>
    ` : '<p style="margin: 0; color: #6b7280; font-size: 14px;">N/A</p>';

    // Frontend URL for order details (using orderId, not _id)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const orderDetailsUrl = `${frontendUrl}/dashboard/my-orders/${order.orderId}`;

    // Map order status to schema.org OrderStatus
    const getOrderStatusSchema = (status) => {
      const statusMap = {
        'pending': 'http://schema.org/OrderPaymentDue',
        'confirmed': 'http://schema.org/OrderProcessing',
        'processing': 'http://schema.org/OrderProcessing',
        'shipped': 'http://schema.org/OrderInTransit',
        'delivered': 'http://schema.org/OrderDelivered',
        'cancelled': 'http://schema.org/OrderCancelled',
        'returned': 'http://schema.org/OrderReturned'
      };
      return statusMap[status] || 'http://schema.org/OrderProcessing';
    };

    // Build acceptedOffer array for structured data
    const acceptedOffers = order.items.map(item => {
      // Build variant description
      let variantDesc = "";
      if (item.variant) {
        const parts = [];
        if (item.variant.size) parts.push(`Size: ${item.variant.size}`);
        if (item.variant.color) parts.push(`Color: ${item.variant.color}`);
        variantDesc = parts.join(", ");
      }
      
      return {
        "@type": "Offer",
        "itemOffered": {
          "@type": "Product",
          "name": item.name || "Product",
          "image": item.image || "",
          "description": variantDesc || "Product"
        },
        "price": (item.subtotal || item.price * item.quantity).toFixed(2),
        "priceCurrency": "BDT",
        "quantity": item.quantity
      };
    });

    // Build structured data (JSON-LD) for Gmail Purchase category
    const structuredData = {
      "@context": "http://schema.org",
      "@type": "Order",
      "merchant": {
        "@type": "Organization",
        "name": "Forpink",
        "url": frontendUrl
      },
      "orderNumber": order.orderId,
      "priceCurrency": "BDT",
      "price": order.total.toFixed(2),
      "acceptedOffer": acceptedOffers,
      "url": orderDetailsUrl,
      "orderStatus": getOrderStatusSchema(order.status),
      "orderDate": new Date(order.createdAt).toISOString(),
      "customer": {
        "@type": "Person",
        "name": user.name || "Customer",
        "email": user.email
      }
    };

    const subject = `Order Confirmation - #${order.orderId}`;
    const text = `Thank you for your order! Your order #${order.orderId} has been confirmed. Total: ৳${order.total.toFixed(2)}. View details: ${orderDetailsUrl}`;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <meta name="format-detection" content="telephone=no">
        <script type="application/ld+json">
        ${JSON.stringify(structuredData, null, 2)}
        </script>
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
                    <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 22px; font-weight: 600;">Order Confirmation</h2>
                    <p style="margin: 0 0 24px; color: #4b5563; font-size: 15px; line-height: 1.6;">
                      Thank you for your order, ${user.name || 'Valued Customer'}! Your order has been confirmed and we're preparing it for shipment.
                    </p>
                    
                    <!-- Order Info Box -->
                    <div style="background: linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%); border: 2px solid #fbcfe8; border-radius: 12px; padding: 24px; margin: 24px 0;">
                      <p style="margin: 0 0 8px; color: #1f2937; font-size: 14px; line-height: 1.6;">
                        <span style="font-weight: 600; color: #9f1239;">Order Number:</span> 
                        <span style="color: #be185d; font-weight: 700; font-family: 'Courier New', monospace;">#${order.orderId}</span>
                      </p>
                      <p style="margin: 0 0 8px; color: #1f2937; font-size: 14px; line-height: 1.6;">
                        <span style="font-weight: 600; color: #9f1239;">Order Date:</span> 
                        <span style="color: #be185d; font-weight: 600;">${orderDate}</span>
                      </p>
                      <p style="margin: 0 0 8px; color: #1f2937; font-size: 14px; line-height: 1.6;">
                        <span style="font-weight: 600; color: #9f1239;">Status:</span> 
                        <span style="color: #be185d; font-weight: 600;">${statusDisplay}</span>
                      </p>
                      <p style="margin: 0; color: #1f2937; font-size: 14px; line-height: 1.6;">
                        <span style="font-weight: 600; color: #9f1239;">Payment Method:</span> 
                        <span style="color: #be185d; font-weight: 600;">${paymentMethodDisplay}</span>
                      </p>
                    </div>

                    <!-- Shipping Address -->
                    <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
                      <h3 style="margin: 0 0 12px; color: #1f2937; font-size: 16px; font-weight: 600;">Shipping Address</h3>
                      ${shippingAddress}
                    </div>

                    <!-- Order Items -->
                    <div style="margin: 24px 0;">
                      <h3 style="margin: 0 0 16px; color: #1f2937; font-size: 16px; font-weight: 600;">Order Items</h3>
                      <table role="presentation" style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                        <thead>
                          <tr style="background-color: #f9fafb;">
                            <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; font-size: 13px; border-bottom: 1px solid #e5e7eb;">Item</th>
                            <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151; font-size: 13px; border-bottom: 1px solid #e5e7eb;">Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${itemsHtml}
                        </tbody>
                      </table>
                    </div>

                    <!-- Order Summary -->
                    <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
                      <h3 style="margin: 0 0 16px; color: #1f2937; font-size: 16px; font-weight: 600;">Order Summary</h3>
                      <table role="presentation" style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Subtotal:</td>
                          <td style="padding: 8px 0; text-align: right; color: #1f2937; font-size: 14px; font-weight: 600;">৳${subtotal.toFixed(2)}</td>
                        </tr>
                        ${order.shippingCost > 0 ? `
                        <tr>
                          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Shipping:</td>
                          <td style="padding: 8px 0; text-align: right; color: #1f2937; font-size: 14px; font-weight: 600;">৳${order.shippingCost.toFixed(2)}</td>
                        </tr>
                        ` : ''}
                        ${totalDiscounts > 0 ? `
                        <tr>
                          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Discounts:</td>
                          <td style="padding: 8px 0; text-align: right; color: #10b981; font-size: 14px; font-weight: 600;">-৳${totalDiscounts.toFixed(2)}</td>
                        </tr>
                        ` : ''}
                        <tr style="border-top: 2px solid #e5e7eb;">
                          <td style="padding: 12px 0 0; color: #1f2937; font-size: 16px; font-weight: 700;">Total:</td>
                          <td style="padding: 12px 0 0; text-align: right; color: #be185d; font-size: 18px; font-weight: 700;">৳${order.total.toFixed(2)}</td>
                        </tr>
                      </table>
                    </div>

                    <!-- View Order Button -->
                    <div style="text-align: center; margin: 32px 0 0;">
                      <a href="${orderDetailsUrl}" style="display: inline-block; background: linear-gradient(135deg, #ec4899 0%, #be185d 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">View Order Details</a>
                    </div>

                    ${order.orderNotes ? `
                    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 4px;">
                      <p style="margin: 0 0 8px; color: #92400e; font-size: 13px; font-weight: 600;">Order Notes:</p>
                      <p style="margin: 0; color: #78350f; font-size: 14px; line-height: 1.6;">${order.orderNotes}</p>
                    </div>
                    ` : ''}
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f9fafb; padding: 30px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px;">
                      If you have any questions about your order, please contact our support team.
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

    return await sendEmail(user.email, subject, text, html);
  } catch (error) {
    console.error('Error sending order confirmation email:', error);
    throw error;
  }
};

module.exports = {
  sendEmail,
  sendOTPEmail,
  sendOrderConfirmationEmail
};