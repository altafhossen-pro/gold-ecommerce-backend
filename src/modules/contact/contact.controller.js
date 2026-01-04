const { Contact } = require('./contact.model');
const sendResponse = require('../../utils/sendResponse');
const { sendEmail } = require('../../utils/email');

/**
 * Submit contact form
 */
exports.submitContact = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    // Validation
    if (!name || !email || !subject || !message) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Name, email, subject, and message are required',
      });
    }

    // Email validation
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Please provide a valid email address',
      });
    }

    // Create contact entry
    const contact = new Contact({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? phone.trim() : '',
      subject: subject.trim(),
      message: message.trim(),
      status: 'new',
      isRead: false,
    });

    await contact.save();

    // Send email to admin
    const adminEmail = 'support@tigerhoster.com';
    const emailSubject = `New Contact Form Submission: ${subject}`;
    
    const emailText = `
New contact form submission received:

Name: ${name}
Email: ${email}
Phone: ${phone || 'Not provided'}
Subject: ${subject}

Message:
${message}

---
Submitted at: ${new Date().toLocaleString()}
    `;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ef3d6a;">New Contact Form Submission</h2>
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
          ${phone ? `<p><strong>Phone:</strong> <a href="tel:${phone}">${phone}</a></p>` : ''}
          <p><strong>Subject:</strong> ${subject}</p>
        </div>
        <div style="background-color: #ffffff; padding: 20px; border-left: 4px solid #ef3d6a; margin: 20px 0;">
          <h3 style="color: #374151; margin-top: 0;">Message:</h3>
          <p style="color: #4b5563; white-space: pre-wrap;">${message}</p>
        </div>
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
          <p>Submitted at: ${new Date().toLocaleString()}</p>
        </div>
      </div>
    `;

    try {
      await sendEmail(adminEmail, emailSubject, emailText, emailHtml);
    } catch (emailError) {
      console.error('Error sending contact form email:', emailError);
      // Don't fail the request if email fails, just log it
    }

    return sendResponse({
      res,
      statusCode: 201,
      success: true,
      message: 'Thank you for contacting us! We will get back to you soon.',
      data: {
        contactId: contact._id,
      },
    });
  } catch (error) {
    console.error('Error submitting contact form:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Failed to submit contact form',
    });
  }
};

/**
 * Get all contact messages (Admin only)
 */
exports.getAllContacts = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    if (status) {
      query.status = status;
    }

    const contacts = await Contact.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Contact.countDocuments(query);

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      data: {
        contacts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Failed to fetch contacts',
    });
  }
};

/**
 * Get single contact message (Admin only)
 */
exports.getContactById = async (req, res) => {
  try {
    const { id } = req.params;

    const contact = await Contact.findById(id);

    if (!contact) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Contact message not found',
      });
    }

    // Mark as read
    if (!contact.isRead) {
      contact.isRead = true;
      await contact.save();
    }

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      data: contact,
    });
  } catch (error) {
    console.error('Error fetching contact:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Failed to fetch contact',
    });
  }
};

/**
 * Update contact status (Admin only)
 */
exports.updateContactStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    const contact = await Contact.findById(id);

    if (!contact) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Contact message not found',
      });
    }

    if (status) {
      contact.status = status;
      if (status === 'replied') {
        contact.repliedAt = new Date();
      }
    }

    if (adminNotes !== undefined) {
      contact.adminNotes = adminNotes;
    }

    await contact.save();

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Contact status updated successfully',
      data: contact,
    });
  } catch (error) {
    console.error('Error updating contact:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Failed to update contact',
    });
  }
};

/**
 * Delete contact message (Admin only)
 */
exports.deleteContact = async (req, res) => {
  try {
    const { id } = req.params;

    const contact = await Contact.findByIdAndDelete(id);

    if (!contact) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Contact message not found',
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Contact message deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting contact:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Failed to delete contact',
    });
  }
};

