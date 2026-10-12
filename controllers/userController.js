const sendError = require('../utils/sendError');
const mongoose = require('mongoose')
const User = require('../models/userModel')

// Fields any user may edit on their own profile. role / isHold / isVerified are admin-only.
const SELF_FIELDS = ['firstName', 'lastName', 'phoneNumber', 'profile', 'billingAdress']
const ADMIN_FIELDS = [...SELF_FIELDS, 'role', 'isHold', 'isVerified']
const getAllUsersController = async (req, res) => {
    try {
        const userData = await User.find({})
        if (userData) {
            return res.status(200).json({
                success: true,
                message: "All Profile",
                data: userData
            })
        } else {
            return res.status(404).json({
                success: false,
                message: "Profile not found"
            })
        }
    } catch (error) {
        console.log(error);
        return sendError(res, error)
    }

}
const singleUserDataController = async (req, res) => {
    try {
        const { id } = req.params
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid User ID format" })
        }
        const userData = await User.findById(id)
        if (userData) {
            return res.status(200).json({
                success: true,
                message: `Profile data for ${userData.email}`,
                data: userData
            })
        } else {
            return res.status(404).json({
                success: false,
                message: "Profile not found"
            })
        }
    } catch (error) {
        console.log(error);
        return sendError(res, error)
    }
}
const updateUserController = async (req, res) => {
    try {
        const { id } = req.params
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid User ID format" })
        }
        const allowed = req.user.role === 'admin' ? ADMIN_FIELDS : SELF_FIELDS
        const update = {}
        allowed.forEach((k) => { if (req.body[k] !== undefined) update[k] = req.body[k] })
        if (update.phoneNumber === '') delete update.phoneNumber
        const userData = await User.findByIdAndUpdate(id, update, { new: true, runValidators: true })
        if (!userData) {
            return res.status(404).json({
                success: false,
                message: "Profile not found"
            })
        }
        return res.status(200).json({
            success: true,
            message: "Profile Update Sccessfully Done",
            data: userData
        })
    } catch (error) {
        if (error && error.code === 11000) {
            return res.status(409).json({ success: false, message: "This phone number is already in use" })
        }
        console.log(error);
        return sendError(res, error)
    }
}
const deleteUserController = async (req, res) => {
    try {
        const { id } = req.params
        if (id === req.user.id) {
            return res.status(400).json({ success: false, message: "You cannot delete your own admin account" })
        }
        const userData = await User.findByIdAndDelete(id)
        if (!userData) {
            return res.status(404).json({
                success: false,
                message: "Profile not found"
            })
        }
        return res.status(200).json({
            success: true,
            message: "Profile Delete Sccessfully Done",
        })
    } catch (error) {
        console.log(error);
        return sendError(res, error)
    }
}
module.exports = { getAllUsersController, singleUserDataController, updateUserController, deleteUserController }