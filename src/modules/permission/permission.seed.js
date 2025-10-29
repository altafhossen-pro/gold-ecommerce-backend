const { Permission } = require('./permission.model');

// All available permissions organized by module
const permissions = [
  // Product Permissions
  { module: 'product', action: 'create', description: 'Create products', category: 'product' },
  { module: 'product', action: 'read', description: 'View products', category: 'product' },
  { module: 'product', action: 'update', description: 'Update products', category: 'product' },
  { module: 'product', action: 'delete', description: 'Delete products', category: 'product' },

  // Order Permissions
  { module: 'order', action: 'create', description: 'Create orders', category: 'order' },
  { module: 'order', action: 'read', description: 'View orders', category: 'order' },
  { module: 'order', action: 'update', description: 'Update orders (includes cancel)', category: 'order' },
  { module: 'order', action: 'delete', description: 'Delete orders', category: 'order' },

  // User Permissions
  { module: 'user', action: 'create', description: 'Create users', category: 'user' },
  { module: 'user', action: 'read', description: 'View users', category: 'user' },
  { module: 'user', action: 'update', description: 'Update users', category: 'user' },
  { module: 'user', action: 'delete', description: 'Delete users', category: 'user' },
  { module: 'user', action: 'manage_roles', description: 'Manage user roles', category: 'user' },

  // Category Permissions
  { module: 'category', action: 'create', description: 'Create categories', category: 'category' },
  { module: 'category', action: 'read', description: 'View categories', category: 'category' },
  { module: 'category', action: 'update', description: 'Update categories', category: 'category' },
  { module: 'category', action: 'delete', description: 'Delete categories', category: 'category' },

  // Coupon Permissions
  { module: 'coupon', action: 'create', description: 'Create coupons', category: 'coupon' },
  { module: 'coupon', action: 'read', description: 'View coupons', category: 'coupon' },
  { module: 'coupon', action: 'update', description: 'Update coupons', category: 'coupon' },
  { module: 'coupon', action: 'delete', description: 'Delete coupons', category: 'coupon' },

  // Inventory Permissions
  { module: 'inventory', action: 'read', description: 'View inventory', category: 'system' },
  { module: 'inventory', action: 'update', description: 'Update inventory', category: 'system' },

  // Settings Permissions
  { module: 'settings', action: 'read', description: 'View settings', category: 'settings' },
  { module: 'settings', action: 'update', description: 'Update settings', category: 'settings' },

  // Content Permissions
  { module: 'banner', action: 'create', description: 'Create banners', category: 'content' },
  { module: 'banner', action: 'read', description: 'View banners', category: 'content' },
  { module: 'banner', action: 'update', description: 'Update banners', category: 'content' },
  { module: 'banner', action: 'delete', description: 'Delete banners', category: 'content' },

  { module: 'testimonial', action: 'create', description: 'Create testimonials', category: 'content' },
  { module: 'testimonial', action: 'read', description: 'View testimonials', category: 'content' },
  { module: 'testimonial', action: 'update', description: 'Update testimonials', category: 'content' },
  { module: 'testimonial', action: 'delete', description: 'Delete testimonials', category: 'content' },

  { module: 'menu', action: 'create', description: 'Create menus', category: 'content' },
  { module: 'menu', action: 'read', description: 'View menus', category: 'content' },
  { module: 'menu', action: 'update', description: 'Update menus', category: 'content' },
  { module: 'menu', action: 'delete', description: 'Delete menus', category: 'content' },

  // Analytics Permissions
  { module: 'analytics', action: 'read', description: 'View analytics', category: 'analytics' },
  { module: 'analytics', action: 'export', description: 'Export analytics', category: 'analytics' },

  // Role & Permission Management
  { module: 'role', action: 'create', description: 'Create roles', category: 'system' },
  { module: 'role', action: 'read', description: 'View roles', category: 'system' },
  { module: 'role', action: 'update', description: 'Update roles', category: 'system' },
  { module: 'role', action: 'delete', description: 'Delete roles', category: 'system' },
];

const seedPermissions = async () => {
  try {
    console.log('Seeding permissions...');
    
    for (const perm of permissions) {
      await Permission.findOneAndUpdate(
        { module: perm.module, action: perm.action },
        perm,
        { upsert: true, new: true }
      );
    }
    
    console.log(`✅ Successfully seeded ${permissions.length} permissions`);
    return permissions;
  } catch (error) {
    console.error('❌ Error seeding permissions:', error);
    throw error;
  }
};

module.exports = { seedPermissions, permissions };

