const jwt = require('jsonwebtoken')
const User = require('../models/userModel')
const emailverification = require('../utils/email');
const registrationController = async (req, res) => {
    try {
        const { email, password, confirmPassword, terms } = req.body

        if (!email || !password || !confirmPassword) {
            return res.status(400).send({
                success: false,
                message: "Please fill in all fields."
            })
        }

        if (!terms) {
            return res.status(400).send({
                success: false,
                message: "Please accept our Terms and Conditions."
            })
        }

        if (password !== confirmPassword) {
            return res.status(400).send({
                success: false,
                message: "Passwords do not match."
            })
        }

        const existingUser = await User.findOne({ email: email })
        if (existingUser) {
            return res.status(409).send({
                success: false,
                message: "User already exists with this email."
            })
        }

        const user = new User({
            email: email,
            password: password,
            terms: terms
        })
       await user.save()
       
        const token = jwt.sign({
            id: user._id,
            email: user.email
        }, process.env.ACCESS_TOKEN_SECRET, {
            expiresIn: '1d'
        })
        emailverification(token)
        return res.status(201).send({
            success: true,
            message: "Registration Successfully Done"
        })

    } catch (error) {
        // console.error("Error:", err);
        res.status(500).send({
            success: false,
            message: "Internal server error."
        })
    }
}
module.exports = {registrationController}