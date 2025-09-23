const { Order } = require('./order.model');
const { Product } = require('../product/product.model');
const sendResponse = require('../../utils/sendResponse');

exports.createOrder = async (req, res) => {
  try {
    // Remove orderId from request body if it exists, as it will be generated automatically
    const orderData = { ...req.body };
    delete orderData.orderId;
    
    const order = new Order(orderData);
    await order.save();
    
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
    
    const order = await Order.findByIdAndUpdate(id, updates, { new: true });
    
    // If status changed to 'confirmed', reduce variant stock
    if (updates.status === 'confirmed' && oldOrder.status !== 'confirmed') {
      console.log('Order status changed to confirmed, updating stock...');
      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          console.log('Processing item:', {
            product: item.product,
            variant: item.variant,
            quantity: item.quantity
          });
          
          // Update variant stock if variant exists
          if (item.variant && item.variant.sku) {
            console.log('Updating variant stock for SKU:', item.variant.sku);
            
            // First, get the current product to check variant stock
            const currentProduct = await Product.findById(item.product);
            console.log('Current product variants:', currentProduct.variants);
            
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
              
              console.log('Updated totalStock to:', updatedTotalStock);
              
              // Verify the update by fetching the product again
              const verifyProduct = await Product.findById(item.product);
              console.log('Verification - Product totalStock:', verifyProduct.totalStock);
              console.log('Verification - Variants stock:', verifyProduct.variants.map(v => ({ sku: v.sku, stock: v.stockQuantity })));
            }
            
            if (result) {
              console.log('Variant stock update result: Success');
              console.log('Updated product totalStock:', result.totalStock);
              console.log('Updated variant stock:', result.variants.find(v => v.sku === item.variant.sku)?.stockQuantity);
            } else {
              console.log('Variant stock update result: Failed - Product or variant not found');
            }
          } else {
            console.log('Updating main product stock');
            // Update main product stock
            const result = await Product.findByIdAndUpdate(
              item.product,
              { $inc: { totalStock: -item.quantity } },
              { new: true }
            );
            console.log('Main product stock update result:', result ? 'Success' : 'Failed');
            if (result) {
              console.log('Updated product totalStock:', result.totalStock);
            }
          }
        }
      }
    }
    
    // If status changed to 'delivered', update product totalSold
    if (updates.status === 'delivered' && oldOrder.status !== 'delivered') {
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
    console.log('Starting totalSold update for all delivered orders...');
    
    // Reset all product totalSold to 0
    await Product.updateMany({}, { totalSold: 0 });
    console.log('Reset all product totalSold to 0');
    
    // Get all delivered orders
    const deliveredOrders = await Order.find({ status: 'delivered' });
    console.log(`Found ${deliveredOrders.length} delivered orders`);
    
    // Update totalSold for each delivered order
    for (const order of deliveredOrders) {
      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          await Product.findByIdAndUpdate(
            item.product,
            { $inc: { totalSold: item.quantity } },
            { new: true }
          );
          console.log(`Updated product ${item.product} with quantity ${item.quantity}`);
        }
      }
    }
    
    // Get updated products with sales
    const productsWithSales = await Product.find({ totalSold: { $gt: 0 } })
      .select('title totalSold')
      .limit(10);
    
    console.log('TotalSold update completed successfully!');
    
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
    console.error('Error updating totalSold:', error);
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
