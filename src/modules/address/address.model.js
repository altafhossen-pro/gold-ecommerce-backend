const mongoose = require('mongoose');

// Division Schema
const divisionSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    bn_name: {
        type: String,
        required: true,
        trim: true
    },
    lat: {
        type: String,
        required: true
    },
    long: {
        type: String,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// District Schema
const districtSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true
    },
    division_id: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    bn_name: {
        type: String,
        required: true,
        trim: true
    },
    lat: {
        type: String,
        required: true
    },
    long: {
        type: String,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Upazila Schema
const upazilaSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true
    },
    district_id: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    bn_name: {
        type: String,
        required: true,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Dhaka City Schema
const dhakaCitySchema = new mongoose.Schema({
    division_id: {
        type: String,
        required: true
    },
    district_id: {
        type: String,
        required: true
    },
    city_corporation: {
        type: String,
        required: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    bn_name: {
        type: String,
        required: true,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Create models
const Division = mongoose.model('Division', divisionSchema);
const District = mongoose.model('District', districtSchema);
const Upazila = mongoose.model('Upazila', upazilaSchema);
const DhakaCity = mongoose.model('DhakaCity', dhakaCitySchema);

module.exports = {
    Division,
    District,
    Upazila,
    DhakaCity
};
