const mongoose = require('mongoose')
const {Schema} = mongoose
const userSchema = new Schema({
    firstName: {
        type: String
    },
    LastName: {
        type: String
    },
    email: {
        type: String
    },
    password: {
        type: String
    },
    phoneNumber: {
        type: String
    },
    terms: {
        type: Boolean
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
        enum: ['admin','user','editor','vendor'],
        default: 'user'
    },
    isHold: {
        type: Boolean,
        default: false
    },
    billingAdress: {
        firstName: {
        type: String
    },
    LastName: {
        type: String
    },
    email: {
        type: String
    },
    companyName: {
        type: String
    },
    street: {
        type: String
    },
    state: {
        type: String
    },
    zipCOde: {
        type: String
    },
    phoneNumber: {
        type: String
    },
    country: {
        type: String
    }
    }
})
module.exports = mongoose.model('User',userSchema)