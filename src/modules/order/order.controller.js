const { Order } = require('./order.model');
const { Product } = require('../product/product.model');
const { User } = require('../user/user.model');
const { earnCoinsFromOrder, redeemPoints } = require('../loyalty/loyalty.controller');
const { incrementCouponUsage } = require('../coupon/coupon.controller');
const sendResponse = require('../../utils/sendResponse');

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
      const { Division, District, Upazila, DhakaCity } = require('../address/address.model');
      
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
      const { Division, District, Upazila, DhakaCity } = require('../address/address.model');
      
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
        const { Coupon } = require('../coupon/coupon.model');
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
        const { Loyalty } = require('../loyalty/loyalty.model');
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
        // Update variant stock if variant exists
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
    
    // No totalSold update on order creation
    // totalSold will be updated when order status becomes 'delivered'
    
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
      orderId,
      email,
      phone,
      includeDeleted = false // Optional: include deleted orders
    } = req.query;
    
    // Email and Phone filtering - need to find matching users first
    let matchingUserIds = [];
    if (email || phone) {
      const userQuery = {};
      if (email) {
        userQuery.email = { $regex: email, $options: 'i' };
      }
      if (phone) {
        userQuery.$or = userQuery.$or || [];
        userQuery.$or.push({ phone: { $regex: phone, $options: 'i' } });
        userQuery.$or.push({ phoneNumber: { $regex: phone, $options: 'i' } });
      }
      
      if (Object.keys(userQuery).length > 0) {
        const users = await User.find(userQuery).select('_id');
        matchingUserIds = users.map(u => u._id);
      }
    }
    
    // Build filter conditions
    const filterConditions = [];
    const orConditions = [];
    
    // Order ID filter
    if (orderId) {
      filterConditions.push({ orderId: { $regex: orderId, $options: 'i' } });
    }
    
    // Status filter
    if (status && status !== 'all') {
      filterConditions.push({ status });
    }
    
    // Payment status filter
    if (paymentStatus && paymentStatus !== 'all') {
      filterConditions.push({ paymentStatus });
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
    
    // Additional filter by user.email if email was provided (for exact match after populate)
    if (email && orders.length > 0) {
      const emailLower = email.toLowerCase();
      orders = orders.filter(order => {
        const userEmail = order.user?.email?.toLowerCase() || '';
        const guestEmail = order.guestInfo?.email?.toLowerCase() || '';
        return userEmail.includes(emailLower) || guestEmail.includes(emailLower);
      });
    }
    
    // Note: If we filtered after populate, the total count might not match exactly
    // For better accuracy, we could recalculate, but for now using the original total
    // Calculate pagination info based on filtered results
    const actualTotal = email && orders.length < parseInt(limit) 
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

    const order = await Order.findOne({ orderId, user: userId, isDeleted: false })
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
    
    const order = await Order.findByIdAndUpdate(id, updates, { new: true });
    
    // If status changed to 'confirmed', reduce variant stock
    if (updates.status === 'confirmed' && oldOrder.status !== 'confirmed') {
      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          
          // Update variant stock if variant exists
          if (item.variant && item.variant.sku) {
            
            // First, get the current product to check variant stock
            const currentProduct = await Product.findById(item.product);
            
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
              const updatedTotalStock = result.variants.reduce((total, variant) => total + (variant.stockQuantity || 0), 0);
              
              // Update totalStock and save to trigger any middleware
              const product = await Product.findById(item.product);
              product.totalStock = updatedTotalStock;
              await product.save();
              
              
              // Verify the update by fetching the product again
              const verifyProduct = await Product.findById(item.product);
            }
            
            if (result) {
            } else {
            }
          } else {
            // Update main product stock
            const result = await Product.findByIdAndUpdate(
              item.product,
              { $inc: { totalStock: -item.quantity } },
              { new: true }
            );
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
              // Update variant stock if variant exists
              if (item.variant && item.variant.sku) {
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
                  const updatedTotalStock = result.variants.reduce((total, variant) => total + (variant.stockQuantity || 0), 0);
                  
                  // Update totalStock and save to trigger any middleware
                  const product = await Product.findById(item.product);
                  product.totalStock = updatedTotalStock;
                  await product.save();
                }
              } else {
                // Update main product stock
                await Product.findByIdAndUpdate(
                  item.product,
                  { $inc: { totalStock: +returnQuantity } },
                  { new: true }
                );
              }
            }
          }
        } else {
          // Full return - add back all quantities
          for (const item of order.items) {
            // Update variant stock if variant exists
            if (item.variant && item.variant.sku) {
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
                const updatedTotalStock = result.variants.reduce((total, variant) => total + (variant.stockQuantity || 0), 0);
                
                // Update totalStock and save to trigger any middleware
                const product = await Product.findById(item.product);
                product.totalStock = updatedTotalStock;
                await product.save();
              }
            } else {
              // Update main product stock
              await Product.findByIdAndUpdate(
                item.product,
                { $inc: { totalStock: +item.quantity } },
                { new: true }
              );
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
          if (variant.stockQuantity < item.quantity) {
            return sendResponse({
              res,
              statusCode: 400,
              success: false,
              message: `Insufficient stock for variant ${item.variant.sku}`,
            });
          }
        } else {
          if (product.totalStock < item.quantity) {
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
      
      if (!validTransitions[currentStatus] || !validTransitions[currentStatus].includes(newStatus)) {
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

    // Handle stock updates based on status changes
    if (updateData.status === 'confirmed' && oldOrder.status !== 'confirmed') {
      // Reduce stock for confirmed orders
      for (const item of updatedOrder.items) {
        if (item.variant && item.variant.sku) {
          await Product.findOneAndUpdate(
            { _id: item.product, 'variants.sku': item.variant.sku },
            { $inc: { 'variants.$.stockQuantity': -item.quantity } }
          );
        } else {
          await Product.findByIdAndUpdate(
            item.product,
            { $inc: { totalStock: -item.quantity } }
          );
        }
      }
    }

    if (updateData.status === 'returned' && oldOrder.status !== 'returned') {
      // Add stock back for returned orders
      for (const item of updatedOrder.items) {
        if (item.variant && item.variant.sku) {
          await Product.findOneAndUpdate(
            { _id: item.product, 'variants.sku': item.variant.sku },
            { $inc: { 'variants.$.stockQuantity': +item.quantity } }
          );
        } else {
          await Product.findByIdAndUpdate(
            item.product,
            { $inc: { totalStock: +item.quantity } }
          );
        }
      }
    }

    if (updateData.status === 'delivered' && oldOrder.status !== 'delivered') {
      // Update totalSold for delivered orders
      for (const item of updatedOrder.items) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { totalSold: item.quantity } }
        );
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
      const { Division, District, Upazila, DhakaCity } = require('../address/address.model');
      
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

    // Create the order
    const order = new Order(orderData);
    await order.save();

    // Update product stock
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

    // Populate the created order for response
    const populatedOrder = await Order.findById(order._id)
      .populate('items.product', 'title featuredImage slug');

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
    const { orderType, items, subtotal, discount, shippingCost, totalAmount, status, notes, userId, guestInfo, deliveryAddress } = req.body;
    
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
    
    const order = await Order.findOne({ orderId, isDeleted: false })
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

    // Create tracking timeline
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
        completed: order.status === 'confirmed' || order.status === 'processing' || order.status === 'shipped' || order.status === 'delivered',
        timestamp: order.statusTimestamps.confirmed,
        description: 'Your order has been confirmed'
      },
      {
        status: 'processing',
        label: 'Order Processing',
        completed: order.status === 'processing' || order.status === 'shipped' || order.status === 'delivered',
        timestamp: order.statusTimestamps.processing,
        description: 'Your order is being prepared for shipment'
      },
      {
        status: 'shipped',
        label: 'Order Shipped',
        completed: order.status === 'shipped' || order.status === 'delivered',
        timestamp: order.statusTimestamps.shipped,
        description: 'Your order has been shipped and is on its way'
      },
      {
        status: 'delivered',
        label: 'Delivered',
        completed: order.status === 'delivered',
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

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Order tracking information retrieved successfully',
      data: {
        order: {
          orderId: order.orderId,
          status: order.status,
          total: order.total,
          createdAt: order.createdAt,
          shippingAddress: order.shippingAddress,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus
        },
        trackingSteps
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
// Priority: 1. User table (registered user), 2. Orders table (previous guest orders)
exports.getCustomerInfoByPhone = async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    
    let customerInfo = {
      name: '',
      address: ''
    };
    
    // First, search in user table for registered user
    const user = await User.findOne({
      $or: [
        { phone: phoneNumber },
        { phoneNumber: phoneNumber }
      ]
    }).select('name firstName lastName addresses phone address'); // Include address fields
    
    if (user) {
      // User found - get name and address from user table
      customerInfo.name = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim();
      
      // Get address from user (priority: addresses array > address field)
      if (user.addresses && user.addresses.length > 0) {
        // Get default address or first address
        const defaultAddress = user.addresses.find(addr => addr.isDefault) || user.addresses[0];
        if (defaultAddress) {
          customerInfo.address = [
            defaultAddress.street || '',
            defaultAddress.city || '',
            defaultAddress.state || '',
            defaultAddress.postalCode || ''
          ].filter(Boolean).join(', ');
        }
      } else if (user.address) {
        
        customerInfo.address = user.address;
      }
    } else {
      
      const latestOrder = await Order.findOne({
        $or: [
          { 'manualOrderInfo.phone': phoneNumber }, // First check manualOrderInfo (new field)
          { 'guestInfo.phone': phoneNumber },
          { 'shippingAddress.phone': phoneNumber }
        ],
        isDeleted: false
      })
      .sort({ createdAt: -1 }) // Get the latest order
      .select('manualOrderInfo guestInfo shippingAddress deliveryAddress user');
      
      if (latestOrder) {
        // Priority: manualOrderInfo > guestInfo > user reference
        if (latestOrder.manualOrderInfo?.name) {
          // Use manualOrderInfo (best case - stores complete info)
          customerInfo.name = latestOrder.manualOrderInfo.name;
          customerInfo.address = latestOrder.manualOrderInfo.address || '';
        } else if (latestOrder.guestInfo?.name) {
          // Get name from guestInfo (previous guest order)
          customerInfo.name = latestOrder.guestInfo.name;
        } else if (latestOrder.user) {
          // Order has user reference, populate and get name
          const orderUser = await User.findById(latestOrder.user).select('name firstName lastName');
          if (orderUser) {
            customerInfo.name = orderUser.name || `${orderUser.firstName || ''} ${orderUser.lastName || ''}`.trim();
          }
        }
        
        if (!customerInfo.address) {
          if (latestOrder.deliveryAddress) {
            customerInfo.address = latestOrder.deliveryAddress;
          } else if (latestOrder.shippingAddress) {
            // Build full address from shippingAddress object
            const addrParts = [
              latestOrder.shippingAddress.street,
              latestOrder.shippingAddress.city,
              latestOrder.shippingAddress.state,
              latestOrder.shippingAddress.postalCode
            ].filter(Boolean);
            customerInfo.address = addrParts.length > 0 ? addrParts.join(', ') : '';
          } else if (latestOrder.guestInfo?.address) {
            customerInfo.address = latestOrder.guestInfo.address;
          }
        }
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