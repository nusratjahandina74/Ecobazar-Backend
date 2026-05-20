const mongoose = require('mongoose')
const { Schema } = mongoose
const userSchema = new Schema({
    firstName: {
        type: String,
        trim: true,
        maxlength: [50, 'First name cannot exceed 50 characters']
    },
    lastName: {
        type: String,
        trim: true,
        maxlength: [50, 'Last name cannot exceed 50 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        index: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: [true, 'Password validation parameters required'],
        select: false
    },
    phoneNumber: {
        type: String,
        unique: true,
        sparse: true,
        trim: true
    },
    terms: {
        type: Boolean,
        required: [true, 'Terms agreement execution context state flag status parameters required']
    },
    profile: {
        type: String
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    role: {
        type: String,
        enum: ['admin', 'user', 'editor', 'vendor'],
        default: 'user'
    },
    isHold: {
        type: Boolean,
        default: false
    },
    billingAdress: {
        firstName: {
            type: String,
            trim: true
        },
        LastName: {
            type: String,
            trim: true
        },
        email: {
            type: String,
            trim: true
        },
        companyName: {
            type: String,
            lowercase: true,
            trim: true
        },
        street: {
            type: String,
            trim: true
        },
        state: {
            type: String,
            trim: true
        },
        zipCOde: {
            type: String,
            trim: true
        },
        phoneNumber: {
            type: String,
            trim: true
        },
        country: {
            type: String,
            trim: true
        }
    }
}, { timestamps: true })
module.exports = mongoose.model('User', userSchema)