const { Order } = require('./order.model');
const { Product } = require('../product/product.model');
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
    const filter = {};
    if (userId) {
      filter.user = userId;
    }
    if (status) {
      filter.status = status;
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

exports.getUserOrders = async (req, res) => {
  try {
    const userId = req.user._id;
    const orders = await Order.find({ user: userId })
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

    const order = await Order.findOne({ orderId, user: userId })
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
    const order = await Order.findById(id).populate('user', 'name email phone');
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
    
    // Get the old order to check status change
    const oldOrder = await Order.findById(id);
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
    
    // Update status timestamps when status changes
    if (updates.status && updates.status !== oldOrder.status) {
      updates.statusTimestamps = {
        ...oldOrder.statusTimestamps,
        [updates.status]: new Date()
      };
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
    
    // If status changed to 'returned', add stock back
    if (updates.status === 'returned' && oldOrder.status !== 'returned') {
      if (order.items && order.items.length > 0) {
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

exports.updateTotalSold = async (req, res) => {
  try {
    
    // Reset all product totalSold to 0
    await Product.updateMany({}, { totalSold: 0 });
    
    // Get all delivered orders
    const deliveredOrders = await Order.find({ status: 'delivered' });
    
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

exports.deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findByIdAndDelete(id);
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

exports.createManualOrder = async (req, res) => {
  try {
    const { orderType, items, subtotal, discount, totalAmount, status, notes, userId, guestInfo, deliveryAddress } = req.body;
    
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
    } else if (orderType === 'guest' && guestInfo) {
      // For guest orders, we'll store guest info in shipping address
      orderData.shippingAddress = {
        label: 'Guest Order',
        street: guestInfo.address || '',
        city: '',
        state: '',
        postalCode: '',
        country: 'Bangladesh'
      };
      // Store guest info in admin notes
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
    
    const order = await Order.findOne({ orderId })
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