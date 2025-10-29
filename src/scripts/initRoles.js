const mongoose = require('mongoose');
require('dotenv').config();

const { Permission } = require('../modules/permission/permission.model');
const { Role } = require('../modules/role/role.model');
const { User } = require('../modules/user/user.model');
const { seedPermissions } = require('../modules/permission/permission.seed');

/**
 * Initialize Roles and Permissions System
 * This script:
 * 1. Seeds all permissions
 * 2. Creates Super Admin role with all permissions
 * 3. Creates default Admin role (for backward compatibility)
 */
const initRoles = async () => {
  try {
    console.log('🚀 Starting role system initialization...\n');

    // Connect to database
    const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gold-ecommerce';
    await mongoose.connect(dbUri);
    console.log('✅ Connected to database\n');

    // Step 1: Seed permissions
    console.log('📋 Seeding permissions...');
    await seedPermissions();
    console.log('✅ Permissions seeded\n');

    // Step 2: Get all permissions
    const allPermissions = await Permission.find({ isActive: true });
    console.log(`📦 Found ${allPermissions.length} active permissions\n`);

    // Step 3: Create Super Admin role
    console.log('👑 Creating Super Admin role...');
    let superAdminRole = await Role.findOne({ isSuperAdmin: true });

    if (!superAdminRole) {
      superAdminRole = new Role({
        name: 'Super Admin',
        slug: 'super-admin',
        description: 'Has all permissions. Cannot be modified or deleted.',
        permissions: allPermissions.map(p => p._id),
        isSuperAdmin: true,
        isDefault: false,
        isActive: true,
      });

      await superAdminRole.save();
      console.log('✅ Super Admin role created\n');
    } else {
      // Update permissions if role exists
      superAdminRole.permissions = allPermissions.map(p => p._id);
      await superAdminRole.save();
      console.log('✅ Super Admin role updated\n');
    }

    // Step 4: Create default Admin role (for backward compatibility)
    console.log('👤 Creating default Admin role...');
    let adminRole = await Role.findOne({ slug: 'admin' });

    if (!adminRole) {
      // Give admin role all permissions by default
      adminRole = new Role({
        name: 'Admin',
        slug: 'admin',
        description: 'Default admin role with full permissions',
        permissions: allPermissions.map(p => p._id),
        isSuperAdmin: false,
        isDefault: true,
        isActive: true,
      });

      await adminRole.save();
      console.log('✅ Default Admin role created\n');
    } else {
      console.log('ℹ️  Default Admin role already exists\n');
    }

    // Step 5: Display summary
    const roles = await Role.find({ isActive: true }).populate('permissions');
    console.log('📊 Role System Summary:');
    console.log('━'.repeat(50));
    roles.forEach(role => {
      console.log(`\n🎭 ${role.name} (${role.slug})`);
      console.log(`   ${role.permissions.length} permissions`);
      console.log(`   Super Admin: ${role.isSuperAdmin ? 'Yes' : 'No'}`);
      console.log(`   Default: ${role.isDefault ? 'Yes' : 'No'}`);
    });

    console.log('\n✅ Role system initialization completed!\n');
    console.log('📝 Next steps:');
    console.log('   1. Assign Super Admin role to a user:');
    console.log(`      await User.updateOne({ email: 'admin@example.com' }, { roleId: '${superAdminRole._id}' });`);
    console.log('\n   2. Or use the admin user management API to assign roles\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing roles:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  initRoles();
}

module.exports = { initRoles };

