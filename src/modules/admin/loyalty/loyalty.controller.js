const { Loyalty } = require('../../loyalty/loyalty.model');
const { User } = require('../../user/user.model');
const sendResponse = require('../../../utils/sendResponse');

// Get user loyalty data for admin
exports.getUserLoyalty = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'User not found'
      });
    }

    // Get loyalty data
    const loyalty = await Loyalty.findOne({ user: userId });
    
    const responseData = {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone
      },
      loyalty: loyalty ? {
        coins: loyalty.coins,
        points: loyalty.points,
        history: loyalty.history.slice(0, 20) // Last 20 transactions
      } : {
        coins: 0,
        points: 0,
        history: []
      }
    };

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'User loyalty data fetched successfully',
      data: responseData
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message
    });
  }
};

// Admin manually add coins to user
exports.addCoinsToUser = async (req, res) => {
  try {
    const { userId, coins, notes } = req.body;
    const adminId = req.user._id;

    // Validate input
    if (!userId || !coins || coins <= 0) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Invalid input. User ID and positive coin amount required.'
      });
    }

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'User not found'
      });
    }

    // Get or create loyalty record
    let loyalty = await Loyalty.findOne({ user: userId });
    if (!loyalty) {
      loyalty = new Loyalty({ user: userId, points: 0, coins: 0, history: [] });
    }

    // Add coins
    loyalty.coins += coins;
    
    // Add history entry
    loyalty.history.unshift({
      type: 'topup',
      points: 0,
      coins: coins,
      description: `Admin added ${coins} coins${notes ? ` - ${notes}` : ''}`,
      adminId: adminId,
      date: new Date()
    });

    await loyalty.save();

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: `${coins} coins added successfully`,
      data: {
        userId: userId,
        coinsAdded: coins,
        totalCoins: loyalty.coins,
        notes: notes || ''
      }
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message
    });
  }
};


// Get all users with loyalty data (for admin dashboard)
exports.getAllUsersLoyalty = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const skip = (page - 1) * limit;

    // Build search query
    let searchQuery = {};
    if (search) {
      searchQuery = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ]
      };
    }

    // Get users with loyalty data
    const users = await User.find(searchQuery)
      .select('name email phone status role createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get loyalty data for each user
    const usersWithLoyalty = await Promise.all(
      users.map(async (user) => {
        const loyalty = await Loyalty.findOne({ user: user._id });
        return {
          ...user.toObject(),
          loyalty: loyalty ? {
            coins: loyalty.coins,
            points: loyalty.points,
            lastActivity: loyalty.history.length > 0 ? loyalty.history[0].date : null
          } : {
            coins: 0,
            points: 0,
            lastActivity: null
          }
        };
      })
    );

    // Get total count for pagination
    const totalUsers = await User.countDocuments(searchQuery);

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Users loyalty data fetched successfully',
      data: {
        users: usersWithLoyalty,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalUsers / limit),
          totalUsers,
          hasNext: page * limit < totalUsers,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message
    });
  }
};

// Get loyalty transaction history for a user
exports.getUserLoyaltyHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'User not found'
      });
    }

    // Get loyalty record
    const loyalty = await Loyalty.findOne({ user: userId });
    if (!loyalty) {
      return sendResponse({
        res,
        statusCode: 200,
        success: true,
        message: 'No loyalty history found',
        data: {
          history: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            totalTransactions: 0
          }
        }
      });
    }

    // Get paginated history
    const totalTransactions = loyalty.history.length;
    const history = loyalty.history.slice(skip, skip + parseInt(limit));

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Loyalty history fetched successfully',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email
        },
        currentCoins: loyalty.coins,
        history: history,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalTransactions / limit),
          totalTransactions,
          hasNext: page * limit < totalTransactions,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message
    });
  }
};
