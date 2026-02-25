const { Order } = require('./order.model');
const { Product } = require('../product/product.model');
const { User } = require('../user/user.model');
const { Loyalty } = require('../loyalty/loyalty.model');
const { Coupon } = require('../coupon/coupon.model');
const Settings = require('../settings/settings.model');
const { Division, District, Upazila, DhakaCity } = require('../address/address.model');
const { StockTracking } = require('../inventory/stockTracking.model');
const { earnCoinsFromOrder, redeemPoints } = require('../loyalty/loyalty.controller');
const { incrementCouponUsage } = require('../coupon/coupon.controller');
const sendResponse = require('../../utils/sendResponse');
const { sendOrderConfirmationEmail } = require('../../utils/email');
const { sendCustomSMS } = require('../../utils/smsService');
const { Affiliate } = require('../affiliate/affiliate.model');
const { AffiliateTracking } = require('../affiliate/affiliateTracking.model');
const steadfastService = require('../steadfast/steadfast.service');

exports.createOrder = async (req, res) => {
  try {
    // Remove orderId from request body if it exists, as it will be generated automatically
    const orderData = { ...req.body };
    delete orderData.orderId;

    // Set user from authenticated token
    orderData.user = req.user._id;
    orderData.isGuestOrder = false;

    // Validate address IDs if provided
    if (orderData.shippingAddress) {


      // Validate division ID if provided
      if (orderData.shippingAddress.divisionId) {
        const division = await Division.findOne({ id: orderData.shippingAddress.divisionId });
        if (!division) {
          return sendResponse({
            res,
            statusCode: 400,
            success: false,
            message: 'Invalid division ID provided'
          });
        }
      }

      // Validate district ID if provided
      if (orderData.shippingAddress.districtId) {
        const district = await District.findOne({ id: orderData.shippingAddress.districtId });
        if (!district) {
          return sendResponse({
            res,
            statusCode: 400,
            success: false,
            message: 'Invalid district ID provided'
          });
        }
      }

      // Validate upazila ID if provided
      if (orderData.shippingAddress.upazilaId) {
        const upazila = await Upazila.findOne({ id: orderData.shippingAddress.upazilaId });
        if (!upazila) {
          return sendResponse({
            res,
            statusCode: 400,
            success: false,
            message: 'Invalid upazila ID provided'
          });
        }
      }

      // Validate area ID if provided (for Dhaka city)
      if (orderData.shippingAddress.areaId) {
        const area = await DhakaCity.findById(orderData.shippingAddress.areaId);
        if (!area) {
          return sendResponse({
            res,
            statusCode: 400,
            success: false,
            message: 'Invalid area ID provided'
          });
        }
      }
    }

    // Validate billing address IDs if provided
    if (orderData.billingAddress) {
      // Validate division ID if provided
      if (orderData.billingAddress.divisionId) {
        const division = await Division.findOne({ id: orderData.billingAddress.divisionId });
        if (!division) {
          return sendResponse({
            res,
            statusCode: 400,
            success: false,
            message: 'Invalid billing division ID provided'
          });
        }
      }

      // Validate district ID if provided
      if (orderData.billingAddress.districtId) {
        const district = await District.findOne({ id: orderData.billingAddress.districtId });
        if (!district) {
          return sendResponse({
            res,
            statusCode: 400,
            success: false,
            message: 'Invalid billing district ID provided'
          });
        }
      }

      // Validate upazila ID if provided
      if (orderData.billingAddress.upazilaId) {
        const upazila = await Upazila.findOne({ id: orderData.billingAddress.upazilaId });
        if (!upazila) {
          return sendResponse({
            res,
            statusCode: 400,
            success: false,
            message: 'Invalid billing upazila ID provided'
          });
        }
      }

      // Validate area ID if provided (for Dhaka city)
      if (orderData.billingAddress.areaId) {
        const area = await DhakaCity.findById(orderData.billingAddress.areaId);
        if (!area) {
          return sendResponse({
            res,
            statusCode: 400,
            success: false,
            message: 'Invalid billing area ID provided'
          });
        }
      }
    }

    // Set default status to 'pending' for all orders
    orderData.status = 'pending';
    orderData.statusTimestamps = {
      pending: new Date()
    };

    // If order is paid with loyalty points, set payment status to 'paid' and status to 'confirmed'
    if (orderData.loyaltyPointsUsed && orderData.loyaltyPointsUsed > 0) {
      orderData.paymentStatus = 'paid';
      orderData.status = 'confirmed';
      orderData.statusTimestamps = {
        ...orderData.statusTimestamps,
        confirmed: new Date()
      };
    }

    const order = new Order(orderData);
    await order.save();

    // Handle coupon usage increment
    if (orderData.coupon) {
      try {
        await Coupon.findOneAndUpdate(
          { code: orderData.coupon },
          { $inc: { usedCount: 1 } }
        );
      } catch (couponError) {
        // Don't fail the order creation if coupon increment fails
      }
    }

    // Handle loyalty points redemption after order creation
    if (orderData.loyaltyPointsUsed && orderData.loyaltyPointsUsed > 0) {
      try {

        const loyalty = await Loyalty.findOne({ user: req.user._id });

        if (loyalty) {
          // Deduct coins
          loyalty.coins -= orderData.loyaltyPointsUsed;

          // Add history entry with actual order ID
          loyalty.history.unshift({
            type: 'redeem',
            points: 0,
            coins: orderData.loyaltyPointsUsed,
            order: order._id,
            description: `Redeemed ${orderData.loyaltyPointsUsed} coins for order payment`
          });

          await loyalty.save();
        }
      } catch (redeemError) {
        // Don't fail the order creation if loyalty redemption fails
      }
    }

    // Update product stock only for confirmed orders (loyalty points orders)
    if (order.status === 'confirmed' && order.items && order.items.length > 0) {
      for (const item of order.items) {
        let previousStock = 0;
        let newStock = 0;

        // Update variant stock if variant exists
        if (item.variant && item.variant.sku) {
          // Get product to find variant and previous stock
          const product = await Product.findById(item.product);
          if (product) {
            const variant = product.variants.find(v => v.sku === item.variant.sku);
            if (variant) {
              previousStock = variant.stockQuantity || 0;
            }
          }

          // Update variant stock
          const result = await Product.findOneAndUpdate(
            {
              _id: item.product,
              'variants.sku': item.variant.sku
            },
            {
              $inc: { 'variants.$.stockQuantity': -item.quantity }
            },
            { new: true }
          );

          if (result) {
            const updatedVariant = result.variants.find(v => v.sku === item.variant.sku);
            newStock = updatedVariant ? updatedVariant.stockQuantity : 0;

            // Update totalStock
            const updatedTotalStock = result.variants.reduce((total, variant) => total + (variant.stockQuantity || 0), 0);
            await Product.findByIdAndUpdate(item.product, { totalStock: updatedTotalStock });

            // Create stock tracking record for sold items
            const stockTracking = new StockTracking({
              product: item.product,
              variant: {
                sku: item.variant.sku,
                attributes: item.variant.attributes
              },
              type: 'remove',
              quantity: -item.quantity,
              previousStock,
              newStock,
              reason: `Order: ${order.orderId} - Confirmed`,
              reference: order.orderId,
              performedBy: order.user || null,
              notes: `Order confirmed - stock removed`
            });
            await stockTracking.save();
          }
        } else {
          // Get product for previous stock
          const product = await Product.findById(item.product);
          if (product) {
            previousStock = product.totalStock || 0;
          }

          // Update main product stock
          const result = await Product.findByIdAndUpdate(
            item.product,
            { $inc: { totalStock: -item.quantity } },
            { new: true }
          );

          if (result) {
            newStock = result.totalStock || 0;

            // Create stock tracking record for sold items
            const stockTracking = new StockTracking({
              product: item.product,
              variant: null,
              type: 'remove',
              quantity: -item.quantity,
              previousStock,
              newStock,
              reason: `Order: ${order.orderId} - Confirmed`,
              reference: order.orderId,
              performedBy: order.user || null,
              notes: `Order confirmed - stock removed`
            });
            await stockTracking.save();
          }
        }
      }
    }

    // No totalSold update on order creation
    // totalSold will be updated when order status becomes 'delivered'

    // Handle affiliate tracking if affiliate code was used
    if (order.affiliateOrder && order.affiliateOrder.affiliateCode) {
      try {
        // Find affiliate by code to get referrer user
        const affiliate = await Affiliate.findOne({
          affiliateCode: order.affiliateOrder.affiliateCode.toUpperCase()
        });

        if (affiliate && affiliate.isActive) {
          // Create affiliate tracking record
          const trackingData = {
            user: order.user || null, // Can be null for guest orders
            mobileNumber: order.user ? null : (order.guestInfo?.phone || null), // For guest orders
            affiliateCode: order.affiliateOrder.affiliateCode.toUpperCase(),
            order: order._id,
            referrer: affiliate.user,
            orderTotal: order.total,
            affiliateDiscount: order.affiliateOrder.affiliateDiscount || 0
          };

          // Only create if we have either user or mobileNumber
          if (trackingData.user || trackingData.mobileNumber) {
            await AffiliateTracking.create(trackingData);
          }

          // Update affiliate stats
          affiliate.totalPurchases += 1;
          affiliate.totalPurchaseAmount += order.total;
          await affiliate.save();
        }
      } catch (affiliateError) {
        console.error('Error creating affiliate tracking:', affiliateError);
        // Don't fail the order creation if affiliate tracking fails
      }
    }

    // Send order confirmation email to logged-in users (if enabled in settings)
    if (order.user && !order.isGuestOrder) {
      try {
        // Check if email sending is enabled
        const settings = await Settings.findOne();
        if (settings && settings.isSendOrderConfirmationEmail !== false) {
          // Populate user data for email
          const populatedOrder = await Order.findById(order._id).populate('user', 'name email');
          if (populatedOrder && populatedOrder.user && populatedOrder.user.email) {
            // Send email asynchronously (don't wait for it to complete)
            sendOrderConfirmationEmail(populatedOrder, populatedOrder.user).catch(emailError => {
              console.error('Failed to send order confirmation email:', emailError);
              // Don't fail the order creation if email fails
            });
          }
        }
      } catch (emailError) {
        console.error('Error preparing order confirmation email:', emailError);
        // Don't fail the order creation if email fails
      }
    }

    return sendResponse({
      res,
      statusCode: 201,
      success: true,
      message: 'Order created successfully',
      data: order,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const { userId, status, page = 1, limit = 10 } = req.query;

    // Build filter object
    // Exclude deleted orders - include orders where isDeleted is false OR doesn't exist (backward compatibility)
    const baseFilters = {};

    if (userId) {
      baseFilters.user = userId;
    }

    if (status) {
      baseFilters.status = status;
    }

    // Combine base filters with deleted filter using $and
    const filter = {
      $and: [
        ...Object.keys(baseFilters).length > 0 ? [baseFilters] : [],
        {
          $or: [
            { isDeleted: false },
            { isDeleted: { $exists: false } } // Include orders without isDeleted field (backward compatibility)
          ]
        }
      ]
    };

    // If no base filters, simplify to just deleted filter
    if (Object.keys(baseFilters).length === 0) {
      filter.$or = filter.$and[0].$or;
      delete filter.$and;
    }

    // Calculate skip value for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get orders with pagination
    const orders = await Order.find(filter)
      .populate('user', 'name email phone')
      .populate('items.product', 'title featuredImage slug')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Order.countDocuments(filter);

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Orders fetched successfully',
      data: orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNextPage,
        hasPrevPage
      }
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// Admin: Get all orders (excluding deleted by default, with advanced filtering)
exports.getAdminOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      paymentStatus,
      search, // Unified search for orderId, email, phone
      orderId, // Keep for backward compatibility
      email, // Keep for backward compatibility
      phone, // Keep for backward compatibility
      includeDeleted = false, // Optional: include deleted orders
      startDate, // Date range filter - start date (ISO format or YYYY-MM-DD)
      endDate // Date range filter - end date (ISO format or YYYY-MM-DD)
    } = req.query;

    // Use unified search if provided, otherwise fall back to individual filters
    const searchTerm = search || orderId || email || phone;

    // Email and Phone filtering - need to find matching users first
    let matchingUserIds = [];
    if (searchTerm) {
      // If unified search, try to detect if it's email or phone, otherwise search both
      // If individual filters, use them
      const emailSearch = search ? (search.includes('@') ? search : null) : email;
      const phoneSearch = search ? search : phone;

      const userQuery = {};

      // Email search (only if contains @ or if email parameter provided)
      if (emailSearch) {
        userQuery.email = { $regex: emailSearch, $options: 'i' };
      }

      // Phone search (always try phone search for unified search, or if phone parameter provided)
      // But don't add phone search if we're searching for email
      if (phoneSearch && !emailSearch) {
        if (userQuery.$or) {
          userQuery.$or.push({ phone: { $regex: phoneSearch, $options: 'i' } });
          userQuery.$or.push({ phoneNumber: { $regex: phoneSearch, $options: 'i' } });
        } else {
          userQuery.$or = [
            { phone: { $regex: phoneSearch, $options: 'i' } },
            { phoneNumber: { $regex: phoneSearch, $options: 'i' } }
          ];
        }
      }

      if (Object.keys(userQuery).length > 0) {
        const users = await User.find(userQuery).select('_id');
        matchingUserIds = users.map(u => u._id);
        if (searchTerm) {

        }
      }
    }

    // Build filter conditions
    const filterConditions = [];
    const orConditions = [];

    // Unified search or Order ID filter
    if (searchTerm) {
      const searchConditions = [];

      // Order ID search (exact match or partial match)
      searchConditions.push({ orderId: { $regex: searchTerm, $options: 'i' } });

      // If we found matching users by email/phone, include their orders
      if (matchingUserIds.length > 0) {
        searchConditions.push({ user: { $in: matchingUserIds } });
      }

      // Phone search in order fields (always search phone fields for unified search)
      searchConditions.push({ 'manualOrderInfo.phone': { $regex: searchTerm, $options: 'i' } });
      searchConditions.push({ 'shippingAddress.phone': { $regex: searchTerm, $options: 'i' } });
      searchConditions.push({ 'guestInfo.phone': { $regex: searchTerm, $options: 'i' } });

      // Email search in guestInfo (always search email fields for unified search)
      searchConditions.push({ 'guestInfo.email': { $regex: searchTerm, $options: 'i' } });

      if (searchConditions.length > 0) {
        orConditions.push({ $or: searchConditions });
      }
    } else {
      // Backward compatibility: individual filters
      if (orderId) {
        filterConditions.push({ orderId: { $regex: orderId, $options: 'i' } });
      }

      // Email/Phone search conditions - combine all search options
      if (email || phone || matchingUserIds.length > 0) {
        const searchConditions = [];

        // If we found matching users by email/phone, include their orders
        if (matchingUserIds.length > 0) {
          searchConditions.push({ user: { $in: matchingUserIds } });
        }

        // Phone search in order fields
        if (phone) {
          searchConditions.push({ 'manualOrderInfo.phone': { $regex: phone, $options: 'i' } });
          searchConditions.push({ 'shippingAddress.phone': { $regex: phone, $options: 'i' } });
          searchConditions.push({ 'guestInfo.phone': { $regex: phone, $options: 'i' } });
        }

        // Email search in guestInfo
        if (email) {
          searchConditions.push({ 'guestInfo.email': { $regex: email, $options: 'i' } });
        }

        if (searchConditions.length > 0) {
          orConditions.push({ $or: searchConditions });
        }
      }
    }

    // Status filter
    if (status && status !== 'all') {
      filterConditions.push({ status });
    }

    // Payment status filter
    if (paymentStatus && paymentStatus !== 'all') {
      filterConditions.push({ paymentStatus });
    }

    // Date range filter
    if (startDate || endDate) {
      const dateFilter = {};

      if (startDate) {
        // Parse start date - set to beginning of day (00:00:00)
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        dateFilter.$gte = start;
      }

      if (endDate) {
        // Parse end date - set to end of day (23:59:59)
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }

      if (Object.keys(dateFilter).length > 0) {
        filterConditions.push({ createdAt: dateFilter });
      }
    }

    // Deleted filter
    if (includeDeleted !== 'true' && includeDeleted !== true) {
      filterConditions.push({
        $or: [
          { isDeleted: false },
          { isDeleted: { $exists: false } }
        ]
      });
    }

    // Combine all conditions
    const finalConditions = [...filterConditions, ...orConditions];

    let finalFilter = {};
    if (finalConditions.length === 0) {
      finalFilter = {};
    } else if (finalConditions.length === 1) {
      finalFilter = finalConditions[0];
    } else {
      finalFilter = { $and: finalConditions };
    }



    // Calculate skip value for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get total count for pagination (before filtering by user.email which needs populate)
    const total = await Order.countDocuments(finalFilter);



    // Get orders with pagination
    let orders = await Order.find(finalFilter)
      .populate('user', 'name email phone')
      .populate('items.product', 'title featuredImage slug')
      .populate('deletedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));



    // Additional filter by user.email if search term was provided (for exact match after populate)
    // Only filter if search term looks like email (contains @) or if email parameter was provided
    const emailSearchTerm = search?.includes('@') ? search : email;
    if (emailSearchTerm && orders.length > 0) {
      const emailLower = emailSearchTerm.toLowerCase();
      const filteredByEmail = orders.filter(order => {
        const userEmail = order.user?.email?.toLowerCase() || '';
        const guestEmail = order.guestInfo?.email?.toLowerCase() || '';
        const manualEmail = order.manualOrderInfo?.email?.toLowerCase() || '';
        const matches = userEmail.includes(emailLower) || guestEmail.includes(emailLower) || manualEmail.includes(emailLower);

        return matches;
      });
      // Always use filtered results if email search was provided (even if empty, to show no results)
      orders = filteredByEmail;
    }

    // Additional filter by user.phone if search term was provided (for exact match after populate)
    // Only filter if search term doesn't look like email and phone search is needed
    // Skip if we already filtered by email
    const phoneSearchTerm = (search && !search.includes('@')) ? search : phone;
    if (phoneSearchTerm && !emailSearchTerm && orders.length > 0) {
      const phoneLower = phoneSearchTerm.toLowerCase();
      const filteredByPhone = orders.filter(order => {
        const userPhone = order.user?.phone?.toLowerCase() || '';
        const manualPhone = order.manualOrderInfo?.phone?.toLowerCase() || '';
        const guestPhone = order.guestInfo?.phone?.toLowerCase() || '';
        return userPhone.includes(phoneLower) || manualPhone.includes(phoneLower) || guestPhone.includes(phoneLower);
      });
      // Only replace orders if we found matches, otherwise keep original (might be orderId match)
      if (filteredByPhone.length > 0) {
        orders = filteredByPhone;

      }
    }



    // Note: If we filtered after populate, the total count might not match exactly
    // For better accuracy, we could recalculate, but for now using the original total
    // Calculate pagination info based on filtered results
    const actualTotal = emailSearchTerm && orders.length < parseInt(limit)
      ? (parseInt(page) - 1) * parseInt(limit) + orders.length
      : total; // Approximation when post-filtering is done

    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages && orders.length === parseInt(limit);
    const hasPrevPage = parseInt(page) > 1;

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Admin orders fetched successfully',
      data: orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNextPage,
        hasPrevPage
      }
    });
  } catch (error) {
    console.error('Error in getAdminOrders:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

exports.getUserOrders = async (req, res) => {
  try {
    const userId = req.user._id;
    // Include orders where isDeleted is false OR doesn't exist (backward compatibility)
    const orders = await Order.find({
      user: userId,
      $or: [
        { isDeleted: false },
        { isDeleted: { $exists: false } }
      ]
    })
      .populate('items.product', 'title featuredImage slug')
      .sort({ createdAt: -1 }); // Sort by newest first
    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'User orders fetched successfully',
      data: orders,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

exports.getUserOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;

    const userId = req.user._id;

    const order = await Order.findOne({
      orderId,
      user: userId,
      $or: [
        { isDeleted: { $exists: false } },
        { isDeleted: false }
      ]
    })
      .populate('items.product', 'title featuredImage slug description')
      .populate('user', 'name email phone');

    if (!order) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Order not found',
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Order details fetched successfully',
      data: order,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findOne({ _id: id, isDeleted: false }).populate('user', 'name email phone');
    if (!order) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Order not found',
      });
    }
    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Order fetched successfully',
      data: order,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

exports.updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const adminId = req.user?._id; // Admin who is updating

    // Get the old order to check status change
    const oldOrder = await Order.findOne({ _id: id, isDeleted: false });
    if (!oldOrder) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Order not found',
      });
    }

    // Validate status transition
    if (updates.status && updates.status !== oldOrder.status) {
      const validTransitions = {
        'pending': ['confirmed', 'cancelled'],
        'confirmed': ['processing', 'cancelled'],
        'processing': ['shipped', 'cancelled'],
        'shipped': ['delivered', 'returned'],
        'delivered': ['returned'],
        'cancelled': [], // No transitions from cancelled
        'returned': [] // No transitions from returned
      };

      const currentStatus = oldOrder.status;
      const newStatus = updates.status;

      if (!validTransitions[currentStatus] || !validTransitions[currentStatus].includes(newStatus)) {
        return sendResponse({
          res,
          statusCode: 400,
          success: false,
          message: `Invalid status transition from ${currentStatus} to ${newStatus}`,
        });
      }

      // Update status timestamps
      updates.statusTimestamps = {
        ...oldOrder.statusTimestamps,
        [newStatus]: new Date()
      };
    }

    // Handle partial return quantities if provided
    if (updates.status === 'returned' && updates.returnQuantities) {
      // Validate return quantities
      for (const returnItem of updates.returnQuantities) {
        const itemIndex = returnItem.itemIndex;
        const returnQuantity = returnItem.quantity;

        if (itemIndex >= oldOrder.items.length) {
          return sendResponse({
            res,
            statusCode: 400,
            success: false,
            message: `Invalid item index: ${itemIndex}`,
          });
        }

        const originalQuantity = oldOrder.items[itemIndex].quantity;
        if (returnQuantity > originalQuantity || returnQuantity < 0) {
          return sendResponse({
            res,
            statusCode: 400,
            success: false,
            message: `Invalid return quantity for item ${itemIndex}. Must be between 0 and ${originalQuantity}`,
          });
        }
      }

      // Store return quantities
      updates.returnQuantities = updates.returnQuantities.map(item => ({
        itemIndex: item.itemIndex,
        quantity: item.quantity,
        returnedAt: new Date()
      }));
    }

    // Automatically update payment status to 'paid' for COD orders when status changes to 'delivered'
    if (updates.status === 'delivered' && oldOrder.status !== 'delivered') {
      if (oldOrder.paymentMethod === 'cod' && oldOrder.paymentStatus !== 'paid') {
        updates.paymentStatus = 'paid';
      }
    }

    const order = await Order.findByIdAndUpdate(id, updates, { new: true });

    // If status changed to 'confirmed', reduce variant stock
    if (updates.status === 'confirmed' && oldOrder.status !== 'confirmed') {
      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          let previousStock = 0;
          let newStock = 0;

          // Update variant stock if variant exists
          if (item.variant && item.variant.sku) {
            // First, get the current product to check variant stock
            const currentProduct = await Product.findById(item.product);
            if (currentProduct) {
              const variant = currentProduct.variants.find(v => v.sku === item.variant.sku);
              if (variant) {
                previousStock = variant.stockQuantity || 0;
              }
            }

            // Find variant by SKU and update stock
            const result = await Product.findOneAndUpdate(
              {
                _id: item.product,
                'variants.sku': item.variant.sku
              },
              {
                $inc: { 'variants.$.stockQuantity': -item.quantity }
              },
              { new: true }
            );

            // Manually update totalStock after variant update
            if (result) {
              const updatedVariant = result.variants.find(v => v.sku === item.variant.sku);
              newStock = updatedVariant ? updatedVariant.stockQuantity : 0;

              const updatedTotalStock = result.variants.reduce((total, variant) => total + (variant.stockQuantity || 0), 0);

              // Update totalStock and save to trigger any middleware
              const product = await Product.findById(item.product);
              product.totalStock = updatedTotalStock;
              await product.save();

              // Create stock tracking record for sold items
              const stockTracking = new StockTracking({
                product: item.product,
                variant: {
                  sku: item.variant.sku,
                  attributes: item.variant.attributes
                },
                type: 'remove',
                quantity: -item.quantity,
                previousStock,
                newStock,
                reason: `Order: ${order.orderId} - Confirmed`,
                reference: order.orderId,
                performedBy: adminId || null,
                notes: `Order confirmed - stock removed`
              });
              await stockTracking.save();
            }
          } else {
            // Get product for previous stock
            const product = await Product.findById(item.product);
            if (product) {
              previousStock = product.totalStock || 0;
            }

            // Update main product stock
            const result = await Product.findByIdAndUpdate(
              item.product,
              { $inc: { totalStock: -item.quantity } },
              { new: true }
            );

            if (result) {
              newStock = result.totalStock || 0;

              // Create stock tracking record for sold items
              const stockTracking = new StockTracking({
                product: item.product,
                variant: null,
                type: 'remove',
                quantity: -item.quantity,
                previousStock,
                newStock,
                reason: `Order: ${order.orderId} - Confirmed`,
                reference: order.orderId,
                performedBy: adminId || null,
                notes: `Order confirmed - stock removed`
              });
              await stockTracking.save();
            }
          }
        }
      }
    }

    // If status changed to 'returned', add stock back (partial or full)
    if (updates.status === 'returned' && oldOrder.status !== 'returned') {
      if (order.items && order.items.length > 0) {
        // If partial return quantities are provided, use them
        if (updates.returnQuantities && updates.returnQuantities.length > 0) {
          for (const returnItem of updates.returnQuantities) {
            const itemIndex = returnItem.itemIndex;
            const returnQuantity = returnItem.quantity;
            const item = order.items[itemIndex];

            if (returnQuantity > 0) {
              let previousStock = 0;
              let newStock = 0;

              // Update variant stock if variant exists
              if (item.variant && item.variant.sku) {
                // Get product to find variant and previous stock
                const product = await Product.findById(item.product);
                if (product) {
                  const variant = product.variants.find(v => v.sku === item.variant.sku);
                  if (variant) {
                    previousStock = variant.stockQuantity || 0;
                  }
                }

                // Find variant by SKU and add stock back
                const result = await Product.findOneAndUpdate(
                  {
                    _id: item.product,
                    'variants.sku': item.variant.sku
                  },
                  {
                    $inc: { 'variants.$.stockQuantity': +returnQuantity }
                  },
                  { new: true }
                );

                // Manually update totalStock after variant update
                if (result) {
                  const updatedVariant = result.variants.find(v => v.sku === item.variant.sku);
                  newStock = updatedVariant ? updatedVariant.stockQuantity : 0;

                  const updatedTotalStock = result.variants.reduce((total, variant) => total + (variant.stockQuantity || 0), 0);

                  // Update totalStock and save to trigger any middleware
                  const product = await Product.findById(item.product);
                  product.totalStock = updatedTotalStock;
                  await product.save();

                  // Create stock tracking record for returned items (adjusts sold count)
                  const stockTracking = new StockTracking({
                    product: item.product,
                    variant: {
                      sku: item.variant.sku,
                      attributes: item.variant.attributes
                    },
                    type: 'add',
                    quantity: returnQuantity,
                    previousStock,
                    newStock,
                    reason: `Order: ${order.orderId} - Returned (Partial)`,
                    reference: order.orderId,
                    performedBy: adminId || null,
                    notes: `Item returned - stock added back (adjusts sold count)`
                  });
                  await stockTracking.save();
                }
              } else {
                // Get product for previous stock
                const product = await Product.findById(item.product);
                if (product) {
                  previousStock = product.totalStock || 0;
                }

                // Update main product stock
                const result = await Product.findByIdAndUpdate(
                  item.product,
                  { $inc: { totalStock: +returnQuantity } },
                  { new: true }
                );

                if (result) {
                  newStock = result.totalStock || 0;

                  // Create stock tracking record for returned items (adjusts sold count)
                  const stockTracking = new StockTracking({
                    product: item.product,
                    variant: null,
                    type: 'add',
                    quantity: returnQuantity,
                    previousStock,
                    newStock,
                    reason: `Order: ${order.orderId} - Returned (Partial)`,
                    reference: order.orderId,
                    performedBy: adminId || null,
                    notes: `Item returned - stock added back (adjusts sold count)`
                  });
                  await stockTracking.save();
                }
              }
            }
          }
        } else {
          // Full return - add back all quantities
          for (const item of order.items) {
            let previousStock = 0;
            let newStock = 0;

            // Update variant stock if variant exists
            if (item.variant && item.variant.sku) {
              // Get product to find variant and previous stock
              const product = await Product.findById(item.product);
              if (product) {
                const variant = product.variants.find(v => v.sku === item.variant.sku);
                if (variant) {
                  previousStock = variant.stockQuantity || 0;
                }
              }

              // Find variant by SKU and add stock back
              const result = await Product.findOneAndUpdate(
                {
                  _id: item.product,
                  'variants.sku': item.variant.sku
                },
                {
                  $inc: { 'variants.$.stockQuantity': +item.quantity }
                },
                { new: true }
              );

              // Manually update totalStock after variant update
              if (result) {
                const updatedVariant = result.variants.find(v => v.sku === item.variant.sku);
                newStock = updatedVariant ? updatedVariant.stockQuantity : 0;

                const updatedTotalStock = result.variants.reduce((total, variant) => total + (variant.stockQuantity || 0), 0);

                // Update totalStock and save to trigger any middleware
                const product = await Product.findById(item.product);
                product.totalStock = updatedTotalStock;
                await product.save();

                // Create stock tracking record for returned items (adjusts sold count)
                const stockTracking = new StockTracking({
                  product: item.product,
                  variant: {
                    sku: item.variant.sku,
                    attributes: item.variant.attributes
                  },
                  type: 'add',
                  quantity: item.quantity,
                  previousStock,
                  newStock,
                  reason: `Order: ${order.orderId} - Returned (Full)`,
                  reference: order.orderId,
                  performedBy: adminId || null,
                  notes: `Item returned - stock added back (adjusts sold count)`
                });
                await stockTracking.save();
              }
            } else {
              // Get product for previous stock
              const product = await Product.findById(item.product);
              if (product) {
                previousStock = product.totalStock || 0;
              }

              // Update main product stock
              const result = await Product.findByIdAndUpdate(
                item.product,
                { $inc: { totalStock: +item.quantity } },
                { new: true }
              );

              if (result) {
                newStock = result.totalStock || 0;

                // Create stock tracking record for returned items (adjusts sold count)
                const stockTracking = new StockTracking({
                  product: item.product,
                  variant: null,
                  type: 'add',
                  quantity: item.quantity,
                  previousStock,
                  newStock,
                  reason: `Order: ${order.orderId} - Returned (Full)`,
                  reference: order.orderId,
                  performedBy: adminId || null,
                  notes: `Item returned - stock added back (adjusts sold count)`
                });
                await stockTracking.save();
              }
            }
          }
        }
      }
    }

    // If status changed to 'delivered', update product totalSold and earn coins
    if (updates.status === 'delivered' && oldOrder.status !== 'delivered') {
      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          await Product.findByIdAndUpdate(
            item.product,
            { $inc: { totalSold: item.quantity } },
            { new: true }
          );
        }

        // Earn coins for delivered order (COD) - but not if paid with loyalty points
        if (order.paymentMethod === 'cod' && (!order.loyaltyPointsUsed || order.loyaltyPointsUsed === 0)) {
          const coinResult = await earnCoinsFromOrder(
            order.user,
            order._id,
            order.items,
            'order_delivered_cod'
          );
        } else if (order.paymentMethod === 'cod' && order.loyaltyPointsUsed > 0) {
        }
      }

      // Add affiliate loyalty points to purchaser (if logged in and affiliate code was used)
      if (order.affiliateOrder && order.affiliateOrder.affiliateCode && order.user) {
        try {
          const purchaserPoints = parseInt(order.affiliateOrder.purchaserLoyaltyPointsPerPurchase || '0');
          if (purchaserPoints > 0) {
            // Find or create loyalty record for purchaser
            let purchaserLoyalty = await Loyalty.findOne({ user: order.user });
            if (!purchaserLoyalty) {
              purchaserLoyalty = new Loyalty({ user: order.user, points: 0, coins: 0, history: [] });
            }

            // Check if points already awarded (to avoid duplicate awards)
            const tracking = await AffiliateTracking.findOne({ order: order._id });
            if (tracking && tracking.purchaserPointsAwarded) {
              // Purchaser loyalty points already awarded for this order
            } else {
              // Add points
              purchaserLoyalty.coins += purchaserPoints;
              purchaserLoyalty.history.unshift({
                type: 'earn',
                points: 0,
                coins: purchaserPoints,
                order: order._id,
                description: `Affiliate purchase bonus: ${purchaserPoints} coins (Order #${order.orderId})`
              });
              await purchaserLoyalty.save();

              // Update affiliate tracking record
              if (tracking) {
                tracking.purchaserPointsAwarded = true;
                tracking.purchaserPointsAwardedAt = new Date();
                await tracking.save();
              }
            }
          }
        } catch (affiliateError) {
          console.error('Error adding purchaser affiliate loyalty points:', affiliateError);
          // Don't fail the order update if affiliate points fail
        }
      }

      // Add affiliate loyalty points to referrer (if affiliate code was used)
      if (order.affiliateOrder && order.affiliateOrder.affiliateCode) {
        try {
          const referrerPoints = parseInt(order.affiliateOrder.referrerLoyaltyPointsPerPurchase || '0');
          if (referrerPoints > 0) {
            // Find affiliate tracking record to get referrer
            const tracking = await AffiliateTracking.findOne({ order: order._id }).populate('referrer');
            if (tracking && tracking.referrer && !tracking.referrerPointsAwarded) {
              // Find or create loyalty record for referrer
              let referrerLoyalty = await Loyalty.findOne({ user: tracking.referrer._id });
              if (!referrerLoyalty) {
                referrerLoyalty = new Loyalty({ user: tracking.referrer._id, points: 0, coins: 0, history: [] });
              }

              // Add points
              referrerLoyalty.coins += referrerPoints;
              referrerLoyalty.history.unshift({
                type: 'earn',
                points: 0,
                coins: referrerPoints,
                order: order._id,
                description: `Affiliate referral bonus: ${referrerPoints} coins (Order #${order.orderId})`
              });
              await referrerLoyalty.save();

              // Update tracking record
              tracking.referrerPointsAwarded = true;
              tracking.referrerPointsAwardedAt = new Date();
              await tracking.save();
            }
          }
        } catch (affiliateError) {
          console.error('Error adding referrer affiliate loyalty points:', affiliateError);
          // Don't fail the order update if affiliate points fail
        }
      }
    }

    // If payment status changed to 'paid', earn coins (for online payments) - but not if paid with loyalty points
    if (updates.paymentStatus === 'paid' && oldOrder.paymentStatus !== 'paid') {
      if (order.items && order.items.length > 0) {
        if (!order.loyaltyPointsUsed || order.loyaltyPointsUsed === 0) {
          const coinResult = await earnCoinsFromOrder(
            order.user,
            order._id,
            order.items,
            'payment_successful'
          );
        } else {
        }
      }
    }

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Order updated successfully',
      data: order,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// Comprehensive order update with tracking
exports.updateOrderComprehensive = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const adminId = req.user?._id; // Admin who is updating

    // Get the old order
    const oldOrder = await Order.findOne({ _id: id, isDeleted: false }).populate('items.product');
    if (!oldOrder) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Order not found',
      });
    }

    const updateHistory = [];
    const updates = {};

    // Track all changes in a single update entry
    const allChanges = [];
    const currentTimestamp = new Date();

    const trackChange = (field, oldValue, newValue, updateType, reason = '') => {
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        allChanges.push({
          field,
          oldValue,
          newValue,
          updateType
        });
        updates[field] = newValue;
      }
    };

    // Update order items if provided
    if (updateData.items) {
      // Check for individual item changes
      const itemChanges = [];

      updateData.items.forEach((newItem, index) => {
        const oldItem = oldOrder.items[index];
        if (oldItem) {
          // Check quantity change
          if (oldItem.quantity !== newItem.quantity) {
            itemChanges.push({
              field: `items[${index}].quantity`,
              oldValue: oldItem.quantity,
              newValue: newItem.quantity,
              updateType: 'item_update',
              itemName: newItem.name
            });
          }

          // Check price change
          if (oldItem.price !== newItem.price) {
            itemChanges.push({
              field: `items[${index}].price`,
              oldValue: oldItem.price,
              newValue: newItem.price,
              updateType: 'item_update',
              itemName: newItem.name
            });
          }
        }
      });

      // Add individual item changes
      itemChanges.forEach(change => {
        allChanges.push(change);
      });

      // Update items if there are changes
      if (itemChanges.length > 0) {
        updates.items = updateData.items;
      }

      // Validate all items exist and have sufficient stock
      // Important: Account for stock already deducted for this order
      const stockDeductedStatuses = ['confirmed', 'processing', 'shipped', 'delivered'];
      const isWasDeducted = stockDeductedStatuses.includes(oldOrder.status);

      for (const item of updateData.items) {
        const product = await Product.findById(item.product);
        if (!product) {
          return sendResponse({
            res,
            statusCode: 400,
            success: false,
            message: `Product not found: ${item.product}`,
          });
        }

        // Find the matching item in the old order to see what was already "reserved"
        const matchedOldItem = oldOrder.items.find(oi =>
          oi.product?._id?.toString() === item.product?.toString() &&
          ((!oi.variant && !item.variant) || (oi.variant?.sku === item.variant?.sku))
        );

        const oldQuantity = matchedOldItem ? matchedOldItem.quantity : 0;

        // Check stock availability
        if (item.variant && item.variant.sku) {
          const variant = product.variants.find(v => v.sku === item.variant.sku);
          if (!variant) {
            return sendResponse({
              res,
              statusCode: 400,
              success: false,
              message: `Variant not found: ${item.variant.sku}`,
            });
          }

          // Total available = Current stock + (Old quantity if it was already deducted)
          const availableStock = (variant.stockQuantity || 0) + (isWasDeducted ? oldQuantity : 0);

          if (availableStock < item.quantity) {
            return sendResponse({
              res,
              statusCode: 400,
              success: false,
              message: `Insufficient stock for variant ${item.variant.sku}`,
            });
          }
        } else {
          // Total available = Current stock + (Old quantity if it was already deducted)
          const availableStock = (product.totalStock || 0) + (isWasDeducted ? oldQuantity : 0);

          if (availableStock < item.quantity) {
            return sendResponse({
              res,
              statusCode: 400,
              success: false,
              message: `Insufficient stock for product ${product.title}`,
            });
          }
        }
      }
    }

    // Update shipping address if provided
    if (updateData.shippingAddress) {
      trackChange('shippingAddress', oldOrder.shippingAddress, updateData.shippingAddress, 'address_change', updateData.addressUpdateReason || '');
    }

    // Update billing address if provided
    if (updateData.billingAddress) {
      trackChange('billingAddress', oldOrder.billingAddress, updateData.billingAddress, 'address_change', updateData.addressUpdateReason || '');
    }

    // Update pricing fields (excluding total as it will be calculated automatically)
    const pricingFields = ['shippingCost', 'discount', 'couponDiscount', 'loyaltyDiscount'];

    pricingFields.forEach(field => {
      if (updateData[field] !== undefined && updateData[field] !== oldOrder[field]) {
        trackChange(field, oldOrder[field], updateData[field], 'price_change', updateData.priceUpdateReason || '');
      }
    });

    // Update status if provided
    if (updateData.status && updateData.status !== oldOrder.status) {
      const validTransitions = {
        'pending': ['confirmed', 'cancelled'],
        'confirmed': ['processing', 'cancelled'],
        'processing': ['shipped', 'cancelled'],
        'shipped': ['delivered', 'returned'],
        'delivered': ['returned'],
        'cancelled': [],
        'returned': []
      };

      const currentStatus = oldOrder.status;
      const newStatus = updateData.status;

      // Allow any status transition if overrideStatus query param or allowAnyStatus body flag is true
      const isOverride = req.query.overrideStatus === 'true' || updateData.allowAnyStatus === true;

      if (!isOverride && (!validTransitions[currentStatus] || !validTransitions[currentStatus].includes(newStatus))) {
        return sendResponse({
          res,
          statusCode: 400,
          success: false,
          message: `Invalid status transition from ${currentStatus} to ${newStatus}`,
        });
      }

      trackChange('status', oldOrder.status, updateData.status, 'status_change', updateData.statusUpdateReason || '');

      // Update status timestamps
      updates.statusTimestamps = {
        ...oldOrder.statusTimestamps,
        [updateData.status]: new Date()
      };

      // Automatically update payment status to 'paid' for COD orders when status changes to 'delivered'
      if (updateData.status === 'delivered' && oldOrder.paymentMethod === 'cod' && oldOrder.paymentStatus !== 'paid') {
        updateData.paymentStatus = 'paid';
        updates.paymentStatus = 'paid';
      }
    }

    // Update payment status if provided
    if (updateData.paymentStatus && updateData.paymentStatus !== oldOrder.paymentStatus) {
      trackChange('paymentStatus', oldOrder.paymentStatus, updateData.paymentStatus, 'payment_change', updateData.paymentUpdateReason || '');
    }

    // Update payment method if provided
    if (updateData.paymentMethod && updateData.paymentMethod !== oldOrder.paymentMethod) {
      trackChange('paymentMethod', oldOrder.paymentMethod, updateData.paymentMethod, 'payment_change', updateData.paymentUpdateReason || '');
    }

    // Update notes if provided
    if (updateData.orderNotes !== undefined) {
      trackChange('orderNotes', oldOrder.orderNotes, updateData.orderNotes, 'notes_update', updateData.notesUpdateReason || '');
    }

    if (updateData.adminNotes !== undefined) {
      trackChange('adminNotes', oldOrder.adminNotes, updateData.adminNotes, 'admin_notes_update', updateData.adminNotesUpdateReason || '');
    }

    // Create a single update entry with all changes
    if (allChanges.length > 0) {
      // Determine the main update type based on what changed
      let mainUpdateType = 'order_update';
      let mainReason = '';

      // Priority order for update types
      if (allChanges.some(change => change.updateType === 'item_update')) {
        mainUpdateType = 'item_update';
        mainReason = updateData.itemUpdateReason || updateData.reason || '';
      } else if (allChanges.some(change => change.updateType === 'price_change')) {
        mainUpdateType = 'price_change';
        mainReason = updateData.priceUpdateReason || updateData.reason || '';
      } else if (allChanges.some(change => change.updateType === 'address_change')) {
        mainUpdateType = 'address_change';
        mainReason = updateData.addressUpdateReason || updateData.reason || '';
      } else if (allChanges.some(change => change.updateType === 'status_change')) {
        mainUpdateType = 'status_change';
        mainReason = updateData.statusUpdateReason || updateData.reason || '';
      } else if (allChanges.some(change => change.updateType === 'notes_update')) {
        mainUpdateType = 'notes_update';
        mainReason = updateData.notesUpdateReason || updateData.reason || '';
      } else if (allChanges.some(change => change.updateType === 'admin_notes_update')) {
        mainUpdateType = 'admin_notes_update';
        mainReason = updateData.adminNotesUpdateReason || updateData.reason || '';
      } else {
        // Fallback to general reason
        mainReason = updateData.reason || '';
      }

      const singleUpdateEntry = {
        updatedBy: adminId,
        updateType: mainUpdateType,
        changes: allChanges,
        reason: mainReason,
        timestamp: currentTimestamp
      };

      updates.$push = { updateHistory: singleUpdateEntry };
    }

    // Calculate new total if items or pricing changed
    if (updateData.items || updateData.shippingCost !== undefined || updateData.discount !== undefined ||
      updateData.couponDiscount !== undefined || updateData.loyaltyDiscount !== undefined) {

      // Use updated items if provided, otherwise use existing items
      const itemsToCalculate = updateData.items || oldOrder.items;
      const shippingCost = updateData.shippingCost !== undefined ? updateData.shippingCost : oldOrder.shippingCost;
      const discount = updateData.discount !== undefined ? updateData.discount : oldOrder.discount;
      const couponDiscount = updateData.couponDiscount !== undefined ? updateData.couponDiscount : oldOrder.couponDiscount;
      const loyaltyDiscount = updateData.loyaltyDiscount !== undefined ? updateData.loyaltyDiscount : oldOrder.loyaltyDiscount;

      // Calculate subtotal from items
      const subtotal = itemsToCalculate.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      // Calculate new total
      const newTotal = subtotal + shippingCost - discount - couponDiscount - loyaltyDiscount;

      // Track total change if it's different
      if (oldOrder.total !== newTotal) {
        allChanges.push({
          field: 'total',
          oldValue: oldOrder.total,
          newValue: newTotal,
          updateType: 'price_change'
        });
        updates.total = newTotal;
      }
    }

    // Perform the update
    const updatedOrder = await Order.findByIdAndUpdate(id, updates, { new: true })
      .populate('user', 'name email phone')
      .populate('items.product', 'title featuredImage slug')
      .populate('updateHistory.updatedBy', 'name email');

    // Handle stock updates based on status changes and item changes
    const stockDeductedStatuses = ['confirmed', 'processing', 'shipped', 'delivered'];
    const isOldDeducted = stockDeductedStatuses.includes(oldOrder.status);
    const isNewDeducted = stockDeductedStatuses.includes(updatedOrder.status);

    if (isOldDeducted && !isNewDeducted) {
      // Transition from deducted to non-deducted (pending, cancelled, returned): Add OLD items stock back
      for (const item of oldOrder.items) {
        const productId = item.product?._id || item.product;
        if (item.variant && item.variant.sku) {
          const result = await Product.findOneAndUpdate(
            { _id: productId, 'variants.sku': item.variant.sku },
            { $inc: { 'variants.$.stockQuantity': +item.quantity } },
            { new: true }
          );
          if (result) {
            const updatedTotalStock = result.variants.reduce((total, v) => total + (v.stockQuantity || 0), 0);
            const prod = await Product.findById(productId);
            if (prod) {
              prod.totalStock = updatedTotalStock;
              await prod.save();
            }
          }
        } else {
          await Product.findByIdAndUpdate(productId, { $inc: { totalStock: +item.quantity } });
        }
      }
    } else if (!isOldDeducted && isNewDeducted) {
      // Transition from non-deducted to deducted: Deduct NEW items stock
      for (const item of updatedOrder.items) {
        const productId = item.product?._id || item.product;
        if (item.variant && item.variant.sku) {
          const result = await Product.findOneAndUpdate(
            { _id: productId, 'variants.sku': item.variant.sku },
            { $inc: { 'variants.$.stockQuantity': -item.quantity } },
            { new: true }
          );
          if (result) {
            const updatedTotalStock = result.variants.reduce((total, v) => total + (v.stockQuantity || 0), 0);
            const prod = await Product.findById(productId);
            if (prod) {
              prod.totalStock = updatedTotalStock;
              await prod.save();
            }
          }
        } else {
          await Product.findByIdAndUpdate(productId, { $inc: { totalStock: -item.quantity } });
        }
      }
    } else if (isOldDeducted && isNewDeducted && updateData.items) {
      // Stayed in deducted state, but items changed: Adjust by difference (Revert Old, Apply New)
      // Revert Old
      for (const item of oldOrder.items) {
        const productId = item.product?._id || item.product;
        if (item.variant && item.variant.sku) {
          const result = await Product.findOneAndUpdate(
            { _id: productId, 'variants.sku': item.variant.sku },
            { $inc: { 'variants.$.stockQuantity': +item.quantity } },
            { new: true }
          );
          if (result) {
            const updatedTotalStock = result.variants.reduce((total, v) => total + (v.stockQuantity || 0), 0);
            const prod = await Product.findById(productId);
            if (prod) {
              prod.totalStock = updatedTotalStock;
              await prod.save();
            }
          }
        } else {
          await Product.findByIdAndUpdate(productId, { $inc: { totalStock: +item.quantity } });
        }
      }
      // Apply New
      for (const item of updatedOrder.items) {
        const productId = item.product?._id || item.product;
        if (item.variant && item.variant.sku) {
          const result = await Product.findOneAndUpdate(
            { _id: productId, 'variants.sku': item.variant.sku },
            { $inc: { 'variants.$.stockQuantity': -item.quantity } },
            { new: true }
          );
          if (result) {
            const updatedTotalStock = result.variants.reduce((total, v) => total + (v.stockQuantity || 0), 0);
            const prod = await Product.findById(productId);
            if (prod) {
              prod.totalStock = updatedTotalStock;
              await prod.save();
            }
          }
        } else {
          await Product.findByIdAndUpdate(productId, { $inc: { totalStock: -item.quantity } });
        }
      }
    }

    // Handle totalSold updates for delivered state
    if (oldOrder.status === 'delivered' && updatedOrder.status !== 'delivered') {
      // Moves FROM delivered: subtract from totalSold
      for (const item of oldOrder.items) {
        const productId = item.product?._id || item.product;
        await Product.findByIdAndUpdate(productId, { $inc: { totalSold: -item.quantity } });
      }
    } else if (oldOrder.status !== 'delivered' && updatedOrder.status === 'delivered') {
      // Moves TO delivered: add to totalSold
      for (const item of updatedOrder.items) {
        const productId = item.product?._id || item.product;
        await Product.findByIdAndUpdate(productId, { $inc: { totalSold: item.quantity } });
      }
    } else if (oldOrder.status === 'delivered' && updatedOrder.status === 'delivered' && updateData.items) {
      // Stayed delivered, but items changed: Adjust totalSold
      for (const item of oldOrder.items) {
        const productId = item.product?._id || item.product;
        await Product.findByIdAndUpdate(productId, { $inc: { totalSold: -item.quantity } });
      }
      for (const item of updatedOrder.items) {
        const productId = item.product?._id || item.product;
        await Product.findByIdAndUpdate(productId, { $inc: { totalSold: item.quantity } });
      }
    }

    // Add affiliate loyalty points to purchaser (if logged in and affiliate code was used)
    if (updatedOrder.affiliateOrder && updatedOrder.affiliateOrder.affiliateCode && updatedOrder.user) {
      try {
        const purchaserPoints = parseInt(updatedOrder.affiliateOrder.purchaserLoyaltyPointsPerPurchase || '0');
        if (purchaserPoints > 0) {
          // Find or create loyalty record for purchaser
          let purchaserLoyalty = await Loyalty.findOne({ user: updatedOrder.user });
          if (!purchaserLoyalty) {
            purchaserLoyalty = new Loyalty({ user: updatedOrder.user, points: 0, coins: 0, history: [] });
          }

          // Check if points already awarded (to avoid duplicate awards)
          const tracking = await AffiliateTracking.findOne({ order: updatedOrder._id });
          if (tracking && tracking.purchaserPointsAwarded) {

          } else {
            // Add points
            purchaserLoyalty.coins += purchaserPoints;
            purchaserLoyalty.history.unshift({
              type: 'earn',
              points: 0,
              coins: purchaserPoints,
              order: updatedOrder._id,
              description: `Affiliate purchase bonus: ${purchaserPoints} coins (Order #${updatedOrder.orderId})`
            });
            await purchaserLoyalty.save();

            // Update affiliate tracking record
            if (tracking) {
              tracking.purchaserPointsAwarded = true;
              tracking.purchaserPointsAwardedAt = new Date();
              await tracking.save();
            }
          }
        }
      } catch (affiliateError) {
        console.error('Error adding purchaser affiliate loyalty points:', affiliateError);
        // Don't fail the order update if affiliate points fail
      }
    }

    // Add affiliate loyalty points to referrer (if affiliate code was used)
    if (updatedOrder.affiliateOrder && updatedOrder.affiliateOrder.affiliateCode) {
      try {
        const referrerPoints = parseInt(updatedOrder.affiliateOrder.referrerLoyaltyPointsPerPurchase || '0');
        if (referrerPoints > 0) {
          // Find affiliate tracking record to get referrer
          const tracking = await AffiliateTracking.findOne({ order: updatedOrder._id }).populate('referrer');
          if (tracking && tracking.referrer && !tracking.referrerPointsAwarded) {
            // Find or create loyalty record for referrer
            let referrerLoyalty = await Loyalty.findOne({ user: tracking.referrer._id });
            if (!referrerLoyalty) {
              referrerLoyalty = new Loyalty({ user: tracking.referrer._id, points: 0, coins: 0, history: [] });
            }

            // Add points
            referrerLoyalty.coins += referrerPoints;
            referrerLoyalty.history.unshift({
              type: 'earn',
              points: 0,
              coins: referrerPoints,
              order: updatedOrder._id,
              description: `Affiliate referral bonus: ${referrerPoints} coins (Order #${updatedOrder.orderId})`
            });
            await referrerLoyalty.save();

            // Update tracking record
            tracking.referrerPointsAwarded = true;
            tracking.referrerPointsAwardedAt = new Date();
            await tracking.save();
          }
        }
      } catch (affiliateError) {
        console.error('Error adding referrer affiliate loyalty points:', affiliateError);
        // Don't fail the order update if affiliate points fail
      }
    }
    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Order updated successfully',
      data: updatedOrder,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

exports.updateTotalSold = async (req, res) => {
  try {

    // Reset all product totalSold to 0
    await Product.updateMany({}, { totalSold: 0 });

    // Get all delivered orders (excluding deleted)
    const deliveredOrders = await Order.find({ status: 'delivered', isDeleted: false });

    // Update totalSold for each delivered order
    for (const order of deliveredOrders) {
      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          await Product.findByIdAndUpdate(
            item.product,
            { $inc: { totalSold: item.quantity } },
            { new: true }
          );
        }
      }
    }

    // Get updated products with sales
    const productsWithSales = await Product.find({ totalSold: { $gt: 0 } })
      .select('title totalSold')
      .limit(10);


    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'TotalSold updated successfully for all delivered orders',
      data: {
        updatedOrders: deliveredOrders.length,
        productsWithSales: productsWithSales
      }
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// Soft delete order (set isDeleted: true)
exports.deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user?._id; // Admin who is deleting

    const order = await Order.findById(id);
    if (!order) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Order not found',
      });
    }

    // Check if already deleted
    if (order.isDeleted) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Order is already deleted',
      });
    }

    // Soft delete: set isDeleted to true
    order.isDeleted = true;
    order.deletedAt = new Date();
    order.deletedBy = adminId;
    await order.save();

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Order deleted successfully',
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

exports.createGuestOrder = async (req, res) => {
  try {
    // Remove orderId from request body if it exists, as it will be generated automatically
    const orderData = { ...req.body };
    delete orderData.orderId;

    // For guest orders, no user authentication required
    // Set user as null or undefined for guest orders
    orderData.user = null;
    orderData.isGuestOrder = true;

    // Validate address IDs if provided
    if (orderData.shippingAddress) {
      // Validate division ID if provided
      if (orderData.shippingAddress.divisionId) {
        const division = await Division.findOne({ id: orderData.shippingAddress.divisionId });
        if (!division) {
          return sendResponse({
            res,
            statusCode: 400,
            success: false,
            message: 'Invalid division ID provided'
          });
        }
      }

      // Validate district ID if provided
      if (orderData.shippingAddress.districtId) {
        const district = await District.findOne({ id: orderData.shippingAddress.districtId });
        if (!district) {
          return sendResponse({
            res,
            statusCode: 400,
            success: false,
            message: 'Invalid district ID provided'
          });
        }
      }

      // Validate upazila ID if provided
      if (orderData.shippingAddress.upazilaId) {
        const upazila = await Upazila.findOne({ id: orderData.shippingAddress.upazilaId });
        if (!upazila) {
          return sendResponse({
            res,
            statusCode: 400,
            success: false,
            message: 'Invalid upazila ID provided'
          });
        }
      }

      // Validate Dhaka city area ID if provided
      if (orderData.shippingAddress.areaId) {
        const area = await DhakaCity.findOne({ _id: orderData.shippingAddress.areaId });
        if (!area) {
          return sendResponse({
            res,
            statusCode: 400,
            success: false,
            message: 'Invalid area ID provided'
          });
        }
      }
    }

    // Validate required fields
    if (!orderData.items || orderData.items.length === 0) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'At least one item is required'
      });
    }

    if (!orderData.shippingAddress || !orderData.shippingAddress.street) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Shipping address is required'
      });
    }

    // Process items and validate products
    for (const item of orderData.items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return sendResponse({
          res,
          statusCode: 400,
          success: false,
          message: `Product not found: ${item.product}`
        });
      }

      // Check stock availability
      if (item.variant && item.variant.sku) {
        const variant = product.variants.find(v => v.sku === item.variant.sku);
        if (!variant) {
          return sendResponse({
            res,
            statusCode: 400,
            success: false,
            message: `Variant not found: ${item.variant.sku}`
          });
        }
        if (variant.stockQuantity < item.quantity) {
          return sendResponse({
            res,
            statusCode: 400,
            success: false,
            message: `Insufficient stock for variant ${item.variant.sku}`
          });
        }
      } else {
        if (product.totalStock < item.quantity) {
          return sendResponse({
            res,
            statusCode: 400,
            success: false,
            message: `Insufficient stock for product ${product.title}`
          });
        }
      }
    }

    // Set default values for guest orders
    orderData.status = 'pending';
    orderData.paymentStatus = orderData.paymentStatus || 'pending';
    orderData.statusTimestamps = {
      pending: new Date()
    };

    // guestInfo will be saved automatically if provided in orderData

    // Create the order
    const order = new Order(orderData);
    await order.save();

    // Update product stock
    for (const item of order.items) {
      let previousStock = 0;
      let newStock = 0;

      if (item.variant && item.variant.sku) {
        // Get product to find variant and previous stock
        const product = await Product.findById(item.product);
        if (product) {
          const variant = product.variants.find(v => v.sku === item.variant.sku);
          if (variant) {
            previousStock = variant.stockQuantity || 0;
          }
        }

        // Update variant stock
        const result = await Product.findOneAndUpdate(
          {
            _id: item.product,
            'variants.sku': item.variant.sku
          },
          {
            $inc: { 'variants.$.stockQuantity': -item.quantity }
          },
          { new: true }
        );

        if (result) {
          const updatedVariant = result.variants.find(v => v.sku === item.variant.sku);
          newStock = updatedVariant ? updatedVariant.stockQuantity : 0;

          // Update totalStock
          const updatedTotalStock = result.variants.reduce((total, variant) => total + (variant.stockQuantity || 0), 0);
          await Product.findByIdAndUpdate(item.product, { totalStock: updatedTotalStock });

          // Create stock tracking record for sold items
          const stockTracking = new StockTracking({
            product: item.product,
            variant: {
              sku: item.variant.sku,
              attributes: item.variant.attributes
            },
            type: 'remove',
            quantity: -item.quantity,
            previousStock,
            newStock,
            reason: `Order: ${order.orderId} - Guest Order`,
            reference: order.orderId,
            performedBy: null,
            notes: `Guest order - stock removed`
          });
          await stockTracking.save();
        }
      } else {
        // Get product for previous stock
        const product = await Product.findById(item.product);
        if (product) {
          previousStock = product.totalStock || 0;
        }

        // Update main product stock
        const result = await Product.findByIdAndUpdate(
          item.product,
          { $inc: { totalStock: -item.quantity } },
          { new: true }
        );

        if (result) {
          newStock = result.totalStock || 0;

          // Create stock tracking record for sold items
          const stockTracking = new StockTracking({
            product: item.product,
            variant: null,
            type: 'remove',
            quantity: -item.quantity,
            previousStock,
            newStock,
            reason: `Order: ${order.orderId} - Guest Order`,
            reference: order.orderId,
            performedBy: null,
            notes: `Guest order - stock removed`
          });
          await stockTracking.save();
        }
      }
    }

    // Populate the created order for response
    const populatedOrder = await Order.findById(order._id)
      .populate('items.product', 'title featuredImage slug');

    // Handle affiliate tracking if affiliate code was used
    if (order.affiliateOrder && order.affiliateOrder.affiliateCode) {
      try {
        // Find affiliate by code to get referrer user
        const affiliate = await Affiliate.findOne({
          affiliateCode: order.affiliateOrder.affiliateCode.toUpperCase()
        });

        if (affiliate && affiliate.isActive) {
          // Create affiliate tracking record
          const trackingData = {
            user: order.user || null, // Can be null for guest orders
            mobileNumber: order.user ? null : (order.guestInfo?.phone || order.manualOrderInfo?.phone || null), // For guest orders
            affiliateCode: order.affiliateOrder.affiliateCode.toUpperCase(),
            order: order._id,
            referrer: affiliate.user,
            orderTotal: order.total,
            affiliateDiscount: order.affiliateOrder.affiliateDiscount || 0
          };

          // Only create if we have either user or mobileNumber
          if (trackingData.user || trackingData.mobileNumber) {
            await AffiliateTracking.create(trackingData);
          }

          // Update affiliate stats
          affiliate.totalPurchases += 1;
          affiliate.totalPurchaseAmount += order.total;
          await affiliate.save();
        }
      } catch (affiliateError) {
        console.error('Error creating affiliate tracking:', affiliateError);
        // Don't fail the order creation if affiliate tracking fails
      }
    }

    // Send SMS confirmation to guest if phone number is available (if enabled in settings)
    const guestPhone = order.guestInfo?.phone || order.manualOrderInfo?.phone || order.shippingAddress?.phone;
    if (guestPhone) {
      try {
        // Check if SMS sending is enabled
        const settings = await Settings.findOne();
        if (settings && settings.isSendGuestOrderConfirmationSMS !== false) {
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
          const trackingUrl = `${frontendUrl}/tracking?orderId=${order.orderId}`;
          const totalAmount = order.total.toFixed(2);

          // Professional short SMS message
          const smsMessage = `Forpink: Order #${order.orderId} confirmed. Total: ৳${totalAmount}. Track: ${trackingUrl}`;

          // Send SMS asynchronously (don't wait for it to complete)
          sendCustomSMS(guestPhone, smsMessage).catch(smsError => {
            console.error('Failed to send order confirmation SMS:', smsError);
            // Don't fail the order creation if SMS fails
          });
        }
      } catch (smsError) {
        console.error('Error preparing order confirmation SMS:', smsError);
        // Don't fail the order creation if SMS fails
      }
    }

    return sendResponse({
      res,
      statusCode: 201,
      success: true,
      message: 'Guest order created successfully',
      data: populatedOrder,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

exports.createManualOrder = async (req, res) => {
  try {
    const { orderType, items, subtotal, discount, shippingCost, totalAmount, status, notes, userId, guestInfo, deliveryAddress, orderSource } = req.body;

    // Validate required fields
    if (!items || items.length === 0) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'At least one item is required',
      });
    }

    if (!totalAmount || totalAmount <= 0) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Total amount must be greater than 0',
      });
    }

    // Prepare order data
    const orderData = {
      orderType: 'manual',
      items: [],
      total: totalAmount,
      discount: discount || 0,
      shippingCost: shippingCost || 0,
      shippingAddress: {
        label: 'Manual Order',
        street: deliveryAddress || '',
        city: '',
        state: '',
        postalCode: '',
        country: 'Bangladesh'
      },
      status: status || 'confirmed',
      orderNotes: notes || '',
      orderSource: orderSource || 'manual', // Set order source from request or default to 'manual'
      createdBy: req.user._id, // Admin who created the order
      statusTimestamps: {
        pending: new Date(),
        confirmed: new Date()
      }
    };

    // Process items and validate products
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return sendResponse({
          res,
          statusCode: 400,
          success: false,
          message: `Product with ID ${item.productId} not found`,
        });
      }

      // Find variant if variantId is provided
      let selectedVariant = null;
      if (item.variantId && product.variants && product.variants.length > 0) {
        selectedVariant = product.variants.find(v => v._id.toString() === item.variantId);
        if (!selectedVariant) {
          return sendResponse({
            res,
            statusCode: 400,
            success: false,
            message: `Variant with ID ${item.variantId} not found for product ${product.title}`,
          });
        }
      }

      // Prepare order item
      const orderItem = {
        product: item.productId,
        name: product.title,
        image: product.featuredImage,
        price: item.price || (selectedVariant ? selectedVariant.currentPrice : product.priceRange?.min || 0),
        quantity: item.quantity,
        subtotal: (item.price || (selectedVariant ? selectedVariant.currentPrice : product.priceRange?.min || 0)) * item.quantity,
        variant: {
          size: item.size || (selectedVariant ? selectedVariant.attributes.find(attr => attr.name === 'Size')?.value : ''),
          color: item.color || (selectedVariant ? selectedVariant.attributes.find(attr => attr.name === 'Color')?.value : ''),
          colorHexCode: item.colorHexCode || (selectedVariant ? selectedVariant.attributes.find(attr => attr.name === 'Color')?.hexCode : ''),
          sku: item.sku || (selectedVariant ? selectedVariant.sku : ''),
          stockQuantity: item.stockQuantity || (selectedVariant ? selectedVariant.stockQuantity : 0),
          stockStatus: item.stockStatus || (selectedVariant ? selectedVariant.stockStatus : 'in_stock')
        }
      };

      orderData.items.push(orderItem);
    }

    // Set user based on order type
    if (orderType === 'existing' && userId) {
      orderData.user = userId;

      // Get user info for manualOrderInfo
      const user = await User.findById(userId).select('name firstName lastName phone email addresses address');
      if (user) {
        orderData.manualOrderInfo = {
          name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          phone: user.phone || '',
          email: user.email || '',
          address: user.addresses && user.addresses.length > 0
            ? [
              user.addresses.find(addr => addr.isDefault)?.street || user.addresses[0].street || '',
              user.addresses.find(addr => addr.isDefault)?.city || user.addresses[0].city || '',
              user.addresses.find(addr => addr.isDefault)?.state || user.addresses[0].state || '',
              user.addresses.find(addr => addr.isDefault)?.postalCode || user.addresses[0].postalCode || ''
            ].filter(Boolean).join(', ')
            : user.address || ''
        };
      }
    } else if (orderType === 'guest' && guestInfo) {
      // For guest orders, store guest info in manualOrderInfo for easy search
      orderData.manualOrderInfo = {
        name: guestInfo.name || '',
        phone: guestInfo.phone || '',
        address: guestInfo.address || '',
        email: guestInfo.email || ''
      };

      // For guest orders, we'll store guest info in shipping address
      orderData.shippingAddress = {
        label: 'Guest Order',
        street: guestInfo.address || '',
        city: '',
        state: '',
        postalCode: '',
        country: 'Bangladesh'
      };
      // Store guest info in admin notes as well (backward compatibility)
      orderData.adminNotes = `Guest Order - Name: ${guestInfo.name}, Phone: ${guestInfo.phone}, Email: ${guestInfo.email || 'N/A'}`;
    } else {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Invalid order type or missing user information',
      });
    }

    // Create the order
    const order = new Order(orderData);
    await order.save();

    // Update product stock if order is confirmed
    if (order.status === 'confirmed') {
      for (const item of order.items) {
        if (item.variant && item.variant.sku) {
          // Update variant stock
          const result = await Product.findOneAndUpdate(
            {
              _id: item.product,
              'variants.sku': item.variant.sku
            },
            {
              $inc: { 'variants.$.stockQuantity': -item.quantity }
            },
            { new: true }
          );

          if (result) {
            // Update totalStock
            const updatedTotalStock = result.variants.reduce((total, variant) => total + (variant.stockQuantity || 0), 0);
            await Product.findByIdAndUpdate(item.product, { totalStock: updatedTotalStock });
          }
        } else {
          // Update main product stock
          await Product.findByIdAndUpdate(
            item.product,
            { $inc: { totalStock: -item.quantity } },
            { new: true }
          );
        }
      }
    }

    // Populate the created order for response
    const populatedOrder = await Order.findById(order._id)
      .populate('user', 'name email phone')
      .populate('items.product', 'title featuredImage slug');

    // Send SMS confirmation for guest orders (manual orders with guest type) - if enabled in settings
    if (orderType === 'guest' && guestInfo && guestInfo.phone) {
      try {
        // Check if SMS sending is enabled
        const settings = await Settings.findOne();
        if (settings && settings.isSendGuestOrderConfirmationSMS !== false) {
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
          const trackingUrl = `${frontendUrl}/tracking?orderId=${order.orderId}`;
          const totalAmount = order.total.toFixed(2);

          // Professional short SMS message
          const smsMessage = `Forpink: Order #${order.orderId} confirmed. Total: ৳${totalAmount}. Track: ${trackingUrl}`;

          // Send SMS asynchronously (don't wait for it to complete)
          sendCustomSMS(guestInfo.phone, smsMessage).catch(smsError => {
            console.error('Failed to send order confirmation SMS:', smsError);
            // Don't fail the order creation if SMS fails
          });
        }
      } catch (smsError) {
        console.error('Error preparing order confirmation SMS:', smsError);
        // Don't fail the order creation if SMS fails
      }
    }

    return sendResponse({
      res,
      statusCode: 201,
      success: true,
      message: 'Manual order created successfully',
      data: populatedOrder,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

exports.trackOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({
      orderId, $or: [
        { isDeleted: { $exists: false } },
        { isDeleted: false }
      ]
    })
      .populate('user', 'name email phone')
      .populate('items.product', 'title featuredImage slug');

    if (!order) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Order not found',
      });
    }




    // Ensure loyaltyDiscount is properly read from order document
    // Convert to number and handle undefined/null cases
    const loyaltyDiscountValue = (order.loyaltyDiscount !== undefined && order.loyaltyDiscount !== null)
      ? Number(order.loyaltyDiscount)
      : 0;

    // Convert affiliateOrder values from string to number if needed
    let affiliateOrderData = null;
    if (order.affiliateOrder && order.affiliateOrder.affiliateCode) {
      affiliateOrderData = {
        affiliateCode: order.affiliateOrder.affiliateCode,
        affiliateDiscount: order.affiliateOrder.affiliateDiscount !== undefined && order.affiliateOrder.affiliateDiscount !== null
          ? Number(order.affiliateOrder.affiliateDiscount)
          : 0,
        purchaserDiscountType: order.affiliateOrder.purchaserDiscountType || null,
        purchaserDiscountValue: order.affiliateOrder.purchaserDiscountValue !== undefined && order.affiliateOrder.purchaserDiscountValue !== null
          ? Number(order.affiliateOrder.purchaserDiscountValue)
          : 0,
        purchaserLoyaltyPointsPerPurchase: order.affiliateOrder.purchaserLoyaltyPointsPerPurchase !== undefined && order.affiliateOrder.purchaserLoyaltyPointsPerPurchase !== null
          ? Number(order.affiliateOrder.purchaserLoyaltyPointsPerPurchase)
          : 0,
        referrerLoyaltyPointsPerPurchase: order.affiliateOrder.referrerLoyaltyPointsPerPurchase !== undefined && order.affiliateOrder.referrerLoyaltyPointsPerPurchase !== null
          ? Number(order.affiliateOrder.referrerLoyaltyPointsPerPurchase)
          : 0
      };
    }

    // Create tracking timeline
    // Check if order has timestamps to determine if steps were completed
    const hasConfirmedTimestamp = !!order.statusTimestamps.confirmed;
    const hasProcessingTimestamp = !!order.statusTimestamps.processing;
    const hasShippedTimestamp = !!order.statusTimestamps.shipped;
    const hasDeliveredTimestamp = !!order.statusTimestamps.delivered;

    const trackingSteps = [
      {
        status: 'pending',
        label: 'Order Received',
        completed: true,
        timestamp: order.statusTimestamps.pending || order.createdAt,
        description: 'Your order has been received and is being processed'
      },
      {
        status: 'confirmed',
        label: 'Order Confirmed',
        completed: hasConfirmedTimestamp || order.status === 'confirmed' || order.status === 'processing' || order.status === 'shipped' || order.status === 'delivered' || order.status === 'returned',
        timestamp: order.statusTimestamps.confirmed,
        description: 'Your order has been confirmed'
      },
      {
        status: 'processing',
        label: 'Order Processing',
        completed: hasProcessingTimestamp || order.status === 'processing' || order.status === 'shipped' || order.status === 'delivered' || order.status === 'returned',
        timestamp: order.statusTimestamps.processing,
        description: 'Your order is being prepared for shipment'
      },
      {
        status: 'shipped',
        label: 'Order Shipped',
        completed: hasShippedTimestamp || order.status === 'shipped' || order.status === 'delivered' || order.status === 'returned',
        timestamp: order.statusTimestamps.shipped,
        description: 'Your order has been shipped and is on its way'
      },
      {
        status: 'delivered',
        label: 'Delivered',
        completed: hasDeliveredTimestamp || order.status === 'delivered' || order.status === 'returned',
        timestamp: order.statusTimestamps.delivered,
        description: 'Your order has been delivered successfully'
      }
    ];

    // Only add cancelled step if order is actually cancelled
    if (order.status === 'cancelled') {
      trackingSteps.push({
        status: 'cancelled',
        label: 'Order Cancelled',
        completed: true,
        timestamp: order.statusTimestamps.cancelled,
        description: 'Your order has been cancelled'
      });
    }

    // Only add returned step if order is actually returned
    if (order.status === 'returned') {
      trackingSteps.push({
        status: 'returned',
        label: 'Order Returned',
        completed: true,
        timestamp: order.statusTimestamps.returned,
        description: 'Your order has been returned'
      });
    }

    const responseData = {
      order: {
        orderId: order.orderId,
        status: order.status,
        total: order.total,
        createdAt: order.createdAt,
        shippingAddress: order.shippingAddress,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        discount: order.discount !== undefined && order.discount !== null ? Number(order.discount) : 0,
        upsellDiscount: order.upsellDiscount !== undefined && order.upsellDiscount !== null ? Number(order.upsellDiscount) : 0,
        couponDiscount: order.couponDiscount !== undefined && order.couponDiscount !== null ? Number(order.couponDiscount) : 0,
        shippingCost: order.shippingCost !== undefined && order.shippingCost !== null ? Number(order.shippingCost) : 0,
        loyaltyDiscount: loyaltyDiscountValue,
        coupon: order.coupon || null,
        ...(affiliateOrderData && { affiliateOrder: affiliateOrderData })
      },
      trackingSteps
    };

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Order tracking information retrieved successfully',
      data: responseData
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// Search orders by phone number
exports.searchOrdersByPhone = async (req, res) => {
  try {
    const { phoneNumber } = req.params;

    // Search for orders with matching phone number (excluding deleted)
    const orders = await Order.find({
      $or: [
        { 'guestInfo.phone': phoneNumber },
        { 'shippingAddress.phone': phoneNumber }
      ],
      isDeleted: false
    })
      .sort({ createdAt: -1 }) // Sort by latest first
      .limit(5) // Limit to 5 most recent orders
      .select('guestInfo shippingAddress deliveryAddress createdAt');

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Orders found successfully',
      data: orders
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: 'Error searching orders by phone number',
      error: error.message
    });
  }
};

// Get customer info by phone number 
// Address comes ONLY from last order's shippingAddress (not from user table)
// Public API - no authentication required (for guest checkout)
exports.getCustomerInfoByPhone = async (req, res) => {
  try {
    const { phoneNumber } = req.params;

    // Token is optional - if present, we can use it for additional features, but not required
    // const token = req.headers.authorization?.split(' ')[1];

    let customerInfo = {
      name: '',
      address: '', // Full address string for backward compatibility
      street: '', // Street address only
      division: '',
      divisionId: '',
      district: '',
      districtId: '',
      upazila: '',
      upazilaId: '',
      area: '',
      areaId: ''
    };

    // Find user for name only (not for address)
    const user = await User.findOne({
      $or: [
        { phone: phoneNumber },
        { phoneNumber: phoneNumber }
      ]
    }).select('name firstName lastName');

    if (user) {
      // Get name from user table
      customerInfo.name = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }

    // Always get address from last order's shippingAddress (not from user table)
    const orderQueryOr = [
      { 'manualOrderInfo.phone': phoneNumber },
      { 'guestInfo.phone': phoneNumber }
    ];

    // Only add user filter if user was found, otherwise it might match null/undefined user fields in guest orders
    if (user && user._id) {
      orderQueryOr.push({ user: user._id });
    }

    const latestOrder = await Order.findOne({
      $or: orderQueryOr,
      isDeleted: false
    })
      .sort({ createdAt: -1 }) // Get the latest order
      .select('manualOrderInfo guestInfo shippingAddress deliveryAddress user');

    if (latestOrder) {
      // Get name from order if not found in user table
      if (!customerInfo.name) {
        if (latestOrder.manualOrderInfo?.name) {
          customerInfo.name = latestOrder.manualOrderInfo.name;
        } else if (latestOrder.guestInfo?.name) {
          customerInfo.name = latestOrder.guestInfo.name;
        } else if (latestOrder.user) {
          const orderUser = await User.findById(latestOrder.user).select('name firstName lastName');
          if (orderUser) {
            customerInfo.name = orderUser.name || `${orderUser.firstName || ''} ${orderUser.lastName || ''}`.trim();
          }
        }
      }

      // Get address from shippingAddress (priority: shippingAddress > deliveryAddress)
      if (latestOrder.shippingAddress) {
        // Get structured address details
        customerInfo.street = latestOrder.shippingAddress.street || '';
        customerInfo.division = latestOrder.shippingAddress.division || '';
        customerInfo.divisionId = latestOrder.shippingAddress.divisionId || '';
        customerInfo.district = latestOrder.shippingAddress.district || '';
        customerInfo.districtId = latestOrder.shippingAddress.districtId || '';
        customerInfo.upazila = latestOrder.shippingAddress.upazila || '';
        customerInfo.upazilaId = latestOrder.shippingAddress.upazilaId || '';
        customerInfo.area = latestOrder.shippingAddress.area || '';
        customerInfo.areaId = latestOrder.shippingAddress.areaId || '';

        // Build full address string for backward compatibility
        const addrParts = [
          latestOrder.shippingAddress.street,
          latestOrder.shippingAddress.city,
          latestOrder.shippingAddress.state,
          latestOrder.shippingAddress.postalCode,
          latestOrder.shippingAddress.area,
          latestOrder.shippingAddress.upazila,
          latestOrder.shippingAddress.district,
          latestOrder.shippingAddress.division
        ].filter(Boolean);
        customerInfo.address = addrParts.length > 0 ? addrParts.join(', ') : '';
      } else if (latestOrder.deliveryAddress) {
        customerInfo.address = latestOrder.deliveryAddress;
        customerInfo.street = latestOrder.deliveryAddress; // Use full address as street if no shippingAddress
      } else if (latestOrder.manualOrderInfo?.address) {
        customerInfo.address = latestOrder.manualOrderInfo.address;
        customerInfo.street = latestOrder.manualOrderInfo.address;
      } else if (latestOrder.guestInfo?.address) {
        customerInfo.address = latestOrder.guestInfo.address;
        customerInfo.street = latestOrder.guestInfo.address;
      }
    }

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Customer info retrieved successfully',
      data: customerInfo
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: 'Error retrieving customer info',
      error: error.message
    });
  }
};

// Add order to Steadfast
exports.addOrderToSteadfast = async (req, res) => {
  try {
    const { id } = req.params;

    // Get the order
    const order = await Order.findById(id).populate('items.product').populate('user', 'name email phone');
    if (!order) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Order not found',
      });
    }

    // Note: Duplicate order validation is handled on the frontend with captcha confirmation
    // Backend allows adding orders even if already added to Steadfast to support duplicate entries

    // Get customer information
    let recipientName = '';
    let recipientPhone = '';
    let recipientEmail = '';
    let recipientAddress = '';

    // Get customer info from different sources
    if (order.user && order.user.name) {
      recipientName = order.user.name;
    } else if (order.guestInfo?.name) {
      recipientName = order.guestInfo.name;
    } else if (order.manualOrderInfo?.name) {
      recipientName = order.manualOrderInfo.name;
    }

    if (order.user && order.user.phone) {
      recipientPhone = order.user.phone;
    } else if (order.guestInfo?.phone) {
      recipientPhone = order.guestInfo.phone;
    } else if (order.manualOrderInfo?.phone) {
      recipientPhone = order.manualOrderInfo.phone;
    }

    if (order.user && order.user.email) {
      recipientEmail = order.user.email;
    } else if (order.guestInfo?.email) {
      recipientEmail = order.guestInfo.email;
    } else if (order.manualOrderInfo?.email) {
      recipientEmail = order.manualOrderInfo.email;
    }

    // Build address string from shippingAddress
    // street is mandatory, area/upazila/district/division are optional
    if (order.shippingAddress) {
      // Validate street (mandatory)
      if (!order.shippingAddress.street || order.shippingAddress.street.trim() === '') {
        return sendResponse({
          res,
          statusCode: 400,
          success: false,
          message: 'Street address is required',
        });
      }

      const addressParts = [];
      // Street is mandatory - must add
      addressParts.push(order.shippingAddress.street.trim());

      // Optional fields - only add if they exist
      if (order.shippingAddress.area && order.shippingAddress.area.trim()) {
        addressParts.push(order.shippingAddress.area.trim());
      }
      if (order.shippingAddress.upazila && order.shippingAddress.upazila.trim()) {
        addressParts.push(order.shippingAddress.upazila.trim());
      }
      if (order.shippingAddress.district && order.shippingAddress.district.trim()) {
        addressParts.push(order.shippingAddress.district.trim());
      }
      if (order.shippingAddress.division && order.shippingAddress.division.trim()) {
        addressParts.push(order.shippingAddress.division.trim());
      }
      if (order.shippingAddress.postalCode && order.shippingAddress.postalCode.trim()) {
        addressParts.push(order.shippingAddress.postalCode.trim());
      }

      recipientAddress = addressParts.join(', ');
    } else if (order.guestInfo?.address) {
      // For guest orders, use the address string directly (should contain street)
      if (!order.guestInfo.address || order.guestInfo.address.trim() === '') {
        return sendResponse({
          res,
          statusCode: 400,
          success: false,
          message: 'Street address is required',
        });
      }
      recipientAddress = order.guestInfo.address.trim();
    } else if (order.manualOrderInfo?.address) {
      // For manual orders, use the address string directly (should contain street)
      if (!order.manualOrderInfo.address || order.manualOrderInfo.address.trim() === '') {
        return sendResponse({
          res,
          statusCode: 400,
          success: false,
          message: 'Street address is required',
        });
      }
      recipientAddress = order.manualOrderInfo.address.trim();
    } else {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Street address is required',
      });
    }

    // Validate required fields
    if (!recipientName) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Recipient name is required',
      });
    }

    if (!recipientPhone || recipientPhone.length !== 11) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Valid 11-digit phone number is required',
      });
    }

    // Validate address length (max 250 chars for Steadfast)
    if (recipientAddress.length > 250) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Address must be within 250 characters',
      });
    }

    // Build item description
    const itemDescriptions = order.items.map(item => {
      return `${item.name || item.product?.title || 'Product'} (Qty: ${item.quantity})`;
    });
    const itemDescription = itemDescriptions.join(', ');

    // Prepare order data for Steadfast
    const steadfastOrderData = {
      invoice: order.orderId || order._id.toString(),
      recipient_name: recipientName,
      recipient_phone: recipientPhone,
      recipient_email: recipientEmail || undefined,
      recipient_address: recipientAddress.substring(0, 250), // Ensure max 250 chars
      cod_amount: order.total || 0,
      note: order.orderNotes || undefined,
      item_description: itemDescription || undefined,
      delivery_type: 0 // 0 = home delivery
    };

    // Send order to Steadfast
    const steadfastResponse = await steadfastService.createOrder(steadfastOrderData);

    if (!steadfastResponse.success) {
      // Check if it's a credentials error and provide user-friendly message
      let errorMessage = steadfastResponse.error?.message || 'Failed to add order to Steadfast Courier';

      // If it's a credentials error, provide more helpful message
      if (errorMessage.includes('credentials') || errorMessage.includes('configured')) {
        errorMessage = 'Steadfast Courier API credentials are not configured. Please go to Settings > Steadfast Configuration and add your API Key and Secret Key to enable order delivery integration.';
      }

      return sendResponse({
        res,
        statusCode: steadfastResponse.statusCode || 500,
        success: false,
        message: errorMessage,
        error: steadfastResponse.error
      });
    }

    // Update order with Steadfast information and change status to shipped
    order.isAddedIntoSteadfast = true;
    order.status = 'shipped';
    if (steadfastResponse.data?.consignment?.consignment_id) {
      order.steadfastConsignmentId = steadfastResponse.data.consignment.consignment_id.toString();
    }
    if (steadfastResponse.data?.consignment?.tracking_code) {
      order.steadfastTrackingCode = steadfastResponse.data.consignment.tracking_code;
    }

    // Update status timestamps
    if (!order.statusTimestamps) {
      order.statusTimestamps = {};
    }
    order.statusTimestamps.shipped = new Date();

    await order.save();

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Order successfully added to Steadfast',
      data: {
        order: order,
        steadfastResponse: steadfastResponse.data
      }
    });
  } catch (error) {
    console.error('Error adding order to Steadfast:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};