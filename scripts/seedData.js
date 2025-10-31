const mongoose = require('mongoose');
require('dotenv').config();

const { seedPermissions } = require('../src/modules/permission/permission.seed');

/**
 * Seed Permissions Data
 * This script seeds all permission data from permission.seed.js
 */
const seedData = async () => {
  try {
    console.log('🚀 Starting permission data seeding...\n');

    // Connect to database
    const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gold-ecommerce';
    await mongoose.connect(dbUri);
    console.log('✅ Connected to database\n');

    // Seed permissions
    console.log('📋 Seeding permissions...');
    const permissions = await seedPermissions();
    console.log(`✅ Successfully seeded ${permissions.length} permissions\n`);

    console.log('📊 Seeded Permissions Summary:');
    console.log('━'.repeat(50));
    const permissionsByCategory = {};
    permissions.forEach(perm => {
      if (!permissionsByCategory[perm.category]) {
        permissionsByCategory[perm.category] = [];
      }
      permissionsByCategory[perm.category].push(`${perm.module}.${perm.action}`);
    });

    Object.keys(permissionsByCategory).forEach(category => {
      console.log(`\n📁 ${category.toUpperCase()}:`);
      permissionsByCategory[category].forEach(perm => {
        console.log(`   ✓ ${perm}`);
      });
    });

    console.log('\n✅ Permission seeding completed!\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Handle reset flag
const shouldReset = process.argv.includes('--reset');

if (shouldReset) {
  console.log('⚠️  --reset flag detected, but permission seeding uses upsert (no reset needed)');
  console.log('   Permissions will be updated if they exist, created if they don\'t\n');
}

// Run if called directly
if (require.main === module) {
  seedData();
}

module.exports = { seedData };

