const User = require('../models/userModel')
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
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        })
    }

}
const singleUserDataController = async (req, res) => {
    try {
        const { id } = req.params
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
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        })
    }
}
const updateUserController = async (req, res) => {
    try {
        const { id } = req.params
        const userData = await User.findByIdAndUpdate({_id: id}, req.body, {new: true})
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
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        })
    }
}
const deleteUserController = async (req, res) => {
    try {
        const { id } = req.params
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
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        })
    }
}
module.exports = { getAllUsersController, singleUserDataController, updateUserController, deleteUserController }