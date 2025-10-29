const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  description: {
    type: String,
    trim: true,
  },
  permissions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Permission',
  }],
  isSuperAdmin: {
    type: Boolean,
    default: false,
    index: true,
  },
  isDefault: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

// Index for faster lookups
roleSchema.index({ isActive: 1, isSuperAdmin: 1 });
roleSchema.index({ slug: 1 });

// Virtual to get permission strings array
roleSchema.virtual('permissionStrings', {
  ref: 'Permission',
  localField: 'permissions',
  foreignField: '_id',
});

// Method to check if role has a specific permission
roleSchema.methods.hasPermission = async function(module, action) {
  // Super admin has all permissions
  if (this.isSuperAdmin) {
    return true;
  }

  // Populate permissions if not already populated
  if (!this.permissions || this.permissions.length === 0) {
    await this.populate('permissions');
  }

  // If still no permissions after populate, return false
  if (!this.permissions || this.permissions.length === 0) {
    return false;
  }

  // Check if any permission matches
  const hasPerm = this.permissions.some(permission => {
    // Handle both populated (object) and non-populated (ObjectId string) cases
    if (typeof permission === 'string') {
      // This is an ObjectId string, skip (shouldn't happen after populate)
      return false;
    }
    
    // Ensure permission has module and action properties
    if (!permission.module || !permission.action) {
      return false;
    }
    
    // Support wildcard: "product.*" matches all product actions
    const matchesModule = permission.module === module || permission.module === '*';
    const matchesAction = permission.action === action || permission.action === '*';
    
    const matches = matchesModule && matchesAction;
    
    return matches;
  });

  
  return hasPerm;
};

// Static method to check permission by permission string (e.g., "product.create")
roleSchema.statics.checkPermission = async function(roleId, module, action) {
  const role = await this.findById(roleId).populate('permissions');
  if (!role || !role.isActive) return false;
  return role.hasPermission(module, action);
};

const Role = mongoose.model('Role', roleSchema);

module.exports = { Role };

