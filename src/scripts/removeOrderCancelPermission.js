const mongoose = require('mongoose');
require('dotenv').config();
const { Permission } = require('../modules/permission/permission.model');
const { Role } = require('../modules/role/role.model');

const removeOrderCancelPermission = async () => {
  try {
    console.log('🚀 Starting removal of "order.cancel" permission...\n');

    const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gold-ecommerce';
    await mongoose.connect(dbUri);
    console.log('✅ Connected to database\n');

    // Find the 'order.cancel' permission
    const cancelPermission = await Permission.findOne({
      module: 'order',
      action: 'cancel'
    });

    if (!cancelPermission) {
      console.log('ℹ️ No "order.cancel" permission found in database.');
      await mongoose.connection.close();
      process.exit(0);
    }

    console.log(`🗑️ Found "order.cancel" permission (ID: ${cancelPermission._id})`);

    // Find all roles that have this permission
    const rolesWithCancel = await Role.find({
      permissions: cancelPermission._id
    });

    if (rolesWithCancel.length > 0) {
      console.log(`📋 Found ${rolesWithCancel.length} role(s) with this permission:`);
      rolesWithCancel.forEach(role => {
        console.log(`   - ${role.name} (${role._id})`);
      });

      // Remove the permission from all roles
      console.log('\n🔄 Removing permission from roles...');
      const updateResult = await Role.updateMany(
        { permissions: cancelPermission._id },
        { $pull: { permissions: cancelPermission._id } }
      );
      console.log(`✅ Successfully removed permission from ${updateResult.modifiedCount} role(s).\n`);
    } else {
      console.log('ℹ️ No roles found with this permission.\n');
    }

    // Delete the permission from the Permission collection
    console.log('🗑️ Deleting permission from Permission collection...');
    const deleteResult = await Permission.deleteOne({ _id: cancelPermission._id });
    console.log(`✅ Successfully deleted ${deleteResult.deletedCount} permission.\n`);

    console.log('🎉 "order.cancel" permission removal completed!\n');
    console.log('📝 Note: Order cancellation is now handled by "order.update" permission.\n');
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error removing "order.cancel" permission:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

if (require.main === module) {
  removeOrderCancelPermission();
}

module.exports = { removeOrderCancelPermission };

