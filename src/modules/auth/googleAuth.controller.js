const { User } = require('../user/user.model');
const sendResponse = require('../../utils/sendResponse');
const jwtService = require('../../services/jwtService');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const querystring = require('querystring');
const { Loyalty } = require('../loyalty/loyalty.model');
const Settings = require('../settings/settings.model');
const { sendWelcomeEmail } = require('../../utils/email');
require('dotenv').config(); // Ensure dotenv is loaded

// Google OAuth credentials - Must be set in environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL;
const BACKEND_URL = process.env.BACKEND_URL;

/**
 * Initiate Google OAuth - returns redirect URL
 */
exports.initiateGoogleAuth = async (req, res) => {
  try {
    // Validate environment variables
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !FRONTEND_URL || !BACKEND_URL) {
      const missingVars = [];
      if (!GOOGLE_CLIENT_ID) missingVars.push('GOOGLE_CLIENT_ID');
      if (!GOOGLE_CLIENT_SECRET) missingVars.push('GOOGLE_CLIENT_SECRET');
      if (!FRONTEND_URL) missingVars.push('FRONTEND_URL');
      if (!BACKEND_URL) missingVars.push('BACKEND_URL');
      
      return sendResponse({
        res,
        statusCode: 500,
        success: false,
        message: `Google OAuth configuration is missing. Missing variables: ${missingVars.join(', ')}. Please check your .env file.`,
      });
    }

    const redirectUri = `${BACKEND_URL}/api/v1/auth/google/callback`;
    const scope = 'openid email profile';
    const responseType = 'code';
    const state = req.query.state || 'default'; // Can be used to track login vs register

    // Build Google OAuth URL
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${GOOGLE_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=${responseType}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `state=${state}&` +
      `access_type=offline&` +
      `prompt=consent`;

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Google OAuth URL generated',
      data: {
        authUrl,
        redirectUri
      }
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Failed to initiate Google authentication',
    });
  }
};

/**
 * Handle Google OAuth callback
 */
exports.googleCallback = async (req, res) => {
  try {
    // Validate environment variables
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !FRONTEND_URL || !BACKEND_URL) {
      // Redirect to frontend with error (callback must redirect, not send JSON)
      return res.redirect(`${FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_config_missing`);
    }

    const { code, state } = req.query;

    if (!code) {
      // Redirect to frontend with error
      return res.redirect(`${FRONTEND_URL}/login?error=google_auth_failed`);
    }

    // Exchange authorization code for access token
    const tokenData = {
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: `${BACKEND_URL}/api/v1/auth/google/callback`,
    };

    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', querystring.stringify(tokenData), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const { access_token, id_token } = tokenResponse.data;

    if (!access_token) {
      return res.redirect(`${FRONTEND_URL}/login?error=token_exchange_failed`);
    }

    // Get user info from Google
    const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const googleUser = userInfoResponse.data;
    const { id: googleId, email, name, picture } = googleUser;

    if (!email) {
      return res.redirect(`${FRONTEND_URL}/login?error=no_email_provided`);
    }

    // Check if user exists by email
    let user = await User.findOne({ email: email.toLowerCase() });
    let isNewUser = false;

    if (!user) {
      // Create new user
      // Generate a random password for OAuth users (they won't use it)
      const randomPassword = Math.random().toString(36).slice(-12) + Date.now().toString(36);
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      user = new User({
        name: name || email.split('@')[0],
        email: email.toLowerCase(),
        password: hashedPassword,
        avatar: picture || null,
        emailVerified: true, // Google emails are verified
        registerType: 'google', // Track registration method
        role: 'customer',
        status: 'active',
        googleId: googleId, // Store Google ID
      });

      await user.save();
      isNewUser = true;
    } else {
      // Update existing user with Google info if needed
      if (!user.googleId) {
        user.googleId = googleId;
      }
      if (picture && !user.avatar) {
        user.avatar = picture;
      }
      user.emailVerified = true;
      user.lastLogin = new Date();
      await user.save();
    }

    // Get signup bonus coins amount for welcome email
    let signupBonusCoins = 0;
    
    // Give signup bonus coins to new users only
    if (isNewUser) {
      try {
        const settings = await Settings.findOne();
        if (settings && settings.loyaltySettings?.isLoyaltyEnabled && settings.loyaltySettings?.signupBonusCoins > 0) {
          signupBonusCoins = settings.loyaltySettings.signupBonusCoins;
          
          // Get or create loyalty record
          let loyalty = await Loyalty.findOne({ user: user._id });
          if (!loyalty) {
            loyalty = new Loyalty({ user: user._id, points: 0, coins: 0, history: [] });
          }
          
          // Add signup bonus coins
          loyalty.coins += signupBonusCoins;
          loyalty.history.unshift({
            type: 'earn',
            points: 0,
            coins: signupBonusCoins,
            description: `Welcome bonus: ${signupBonusCoins} coins for signing up`
          });
          
          await loyalty.save();
        }
      } catch (error) {
        // Don't fail Google auth if loyalty bonus fails
        console.error('Error giving signup bonus:', error);
      }
    }

    // Generate JWT token
    const token = jwtService.generateAccessToken(user._id);

    // Remove password from user object
    const userObj = user.toObject();
    delete userObj.password;

    // Redirect to frontend with token and user data
    // Using URL params to pass data
    const redirectParams = querystring.stringify({
      token: token,
      userId: user._id.toString(),
      name: userObj.name,
      email: userObj.email,
      role: userObj.role,
    });

    const redirectUrl = `${FRONTEND_URL}/auth/google/success?${redirectParams}`;

    // Send welcome email asynchronously to new users (don't wait for it)
    if (isNewUser && user.email) {
      sendWelcomeEmail(user, signupBonusCoins).catch(emailError => {
        console.error('Failed to send welcome email:', emailError);
        // Don't fail Google auth if email fails
      });
    }

    return res.redirect(redirectUrl);

  } catch (error) {
    // Redirect to frontend with error
    const errorMessage = error.response?.data?.error_description || error.message || 'google_auth_failed';
    return res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent(errorMessage)}`);
  }
};

