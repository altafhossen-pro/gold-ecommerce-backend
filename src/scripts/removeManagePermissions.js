const mongoose = require('mongoose');
require('dotenv').config();

const { Permission } = require('../modules/permission/permission.model');

/**
 * Remove all "manage" permissions from database
 * Run this after removing manage permissions from seed file
 */
const removeManagePermissions = async () => {
  try {
    console.log('🚀 Starting to remove "manage" permissions...\n');

    // Connect to database
    const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gold-ecommerce';
    await mongoose.connect(dbUri);
    console.log('✅ Connected to database\n');

    // Find all permissions with action "manage"
    const managePermissions = await Permission.find({ action: 'manage' });
    
    if (managePermissions.length === 0) {
      console.log('ℹ️  No "manage" permissions found in database\n');
      await mongoose.connection.close();
      process.exit(0);
      return;
    }

    console.log(`📋 Found ${managePermissions.length} "manage" permissions:`);
    managePermissions.forEach(perm => {
      console.log(`   - ${perm.module}.${perm.action}`);
    });
    console.log('');

    // Delete all manage permissions
    const result = await Permission.deleteMany({ action: 'manage' });
    
    console.log(`✅ Successfully removed ${result.deletedCount} "manage" permissions from database\n`);

    // Also remove from roles that have these permissions
    const { Role } = require('../modules/role/role.model');
    const roles = await Role.find({}).populate('permissions');
    
    let updatedRolesCount = 0;
    for (const role of roles) {
      const managePermissionIds = managePermissions.map(p => p._id.toString());
      const originalCount = role.permissions.length;
      
      // Filter out manage permissions
      role.permissions = role.permissions.filter(
        perm => !managePermissionIds.includes(perm._id?.toString() || perm.toString())
      );
      
      if (role.permissions.length !== originalCount) {
        await role.save();
        updatedRolesCount++;
        console.log(`   ✅ Removed manage permissions from role: ${role.name}`);
      }
    }

    if (updatedRolesCount > 0) {
      console.log(`\n✅ Updated ${updatedRolesCount} roles (removed manage permissions)\n`);
    } else {
      console.log('\nℹ️  No roles needed to be updated\n');
    }

    console.log('✅ "manage" permissions removal completed!\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error removing manage permissions:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  removeManagePermissions();
}

module.exports = { removeManagePermissions };

