const sendError = require('../utils/sendError');
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt');
const User = require('../models/userModel')
const { emailverification, resetPasswordmail } = require('../utils/email');
const { emptyFieldValidation } = require('../utils/validation');
const tokenGenerator = require('../utils/tokenGenerator');
const safeUser = (u) => ({
    id: u._id,
    _id: u._id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    phoneNumber: u.phoneNumber,
    role: u.role,
    isVerified: u.isVerified,
    isHold: u.isHold,
    profile: u.profile
})
const registrationController = async (req, res) => {
    try {
        const { email, password, confirmPassword, terms, firstName, lastName } = req.body

        if (emptyFieldValidation(res, email, password, confirmPassword, terms)) return

        if (!terms) {
            return res.status(400).json({
                success: false,
                message: "Please accept our Terms and Conditions."
            })
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Passwords do not match."
            })
        }
        const hash = bcrypt.hashSync(password, 10);

        const existingUser = await User.findOne({ email: String(email).toLowerCase().trim() })
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "User already exists with this email."
            })
        }

        const user = new User({
            email: email,
            password: hash,
            terms: terms,
            ...(firstName ? { firstName: String(firstName).trim() } : {}),
            ...(lastName ? { lastName: String(lastName).trim() } : {})
        })
        await user.save()

        const token = tokenGenerator({
            id: user._id,
            email: user.email
        }, process.env.ACCESS_TOKEN_SECRET, '1d')

        Promise.resolve(emailverification(token, email)).catch((e) => console.error('[mail]', e.message))
        return res.status(201).json({
            success: true,
            message: "Registration Successfully Done, Please check your email for verification.",
            user: {
                id: user._id,
                email: user.email
            }
        })

    } catch (error) {
        // console.error("Error:", err);
        sendError(res, error)
    }
}
const loginController = async (req, res) => {
    try {
        const { email, password } = req.body
        if (emptyFieldValidation(res, email, password)) return
        const existingUser = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+password')
        if (!existingUser) {
            return res.status(409).json({
                success: false,
                message: "User not found"
            })
        }
        const pass = bcrypt.compareSync(password, existingUser.password);

        if (!pass) {
            return res.status(401).json({
                success: false,
                message: "Invalid Credential"
            })
        }
        if (existingUser.isHold) {
            return res.status(403).json({
                success: false,
                message: "Your account is on hold. Please contact support."
            })
        }
        const accessToken = tokenGenerator({
            id: existingUser._id,
            email: existingUser.email,
            type: 'access'
        }, process.env.ACCESS_TOKEN_SECRET, process.env.ACCESS_TOKEN_EXPIRES || '1d')
        return res.status(200).json({
            success: true,
            message: "Login Successfully Done",
            accessToken,
            user: safeUser(existingUser)
        })
    } catch (error) {
        console.log(error);
        return sendError(res, error)

    }
}
const forgetPasswordController = async (req, res) => {
    try {
        const { email } = req.body
        if (emptyFieldValidation(res, email)) return
        const existingUser = await User.findOne({ email: String(email).toLowerCase().trim() })
        if (!existingUser) {
            return res.status(409).json({
                success: false,
                message: "Email not found"
            })
        }
        const token = tokenGenerator({
            id: existingUser._id,
            email: existingUser.email
        }, process.env.ACCESS_TOKEN_SECRET, '1d')

        resetPasswordmail(token, email)
        res.status(200).json({
            success: true,
            message: "Please check your email"
        })

    } catch (error) {
        console.log(error);
        return sendError(res, error)
    }
}
const resetPasswordController = async (req, res) => {
    try {
        const { newPassword, confirmPassword } = req.body
        const { token } = req.params
        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Confirm Password not matched."
            })
        }

        let decoded
        try {
            decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
        } catch (err) {
            return res.status(401).json({ success: false, message: "Invalid or expired token" })
        }
        if (decoded.type === 'access' || !decoded.id) {
            return res.status(401).json({ success: false, message: "Invalid or expired token" })
        }
        const hash = bcrypt.hashSync(newPassword, 10);
        const updated = await User.findByIdAndUpdate(decoded.id, { password: hash }, { new: true })
        if (!updated) {
            return res.status(404).json({ success: false, message: "User not found" })
        }
        return res.status(200).json({
            success: true,
            message: "Password Updated Successfully"
        })
    } catch (error) {
        console.log(error);
        return sendError(res, error)
    }
}
const resendverificationemailcontroller = async (req, res) => {
    try {
        const { email } = req.body
        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required" })
        }
        const existingUser = await User.findOne({ email: String(email).toLowerCase().trim() })
        if (!existingUser) {
            return res.status(404).json({ success: false, message: "Email not found" })
        }
        if (existingUser.isVerified) {
            return res.status(400).json({ success: false, message: "User already verified" })
        }
        const token = tokenGenerator({
            id: existingUser._id,
            email: existingUser.email
        }, process.env.ACCESS_TOKEN_SECRET, '1d')

        emailverification(token, email)
        return res.status(200).json({
            success: true,
            message: "Verification email sent. Please check your inbox."
        })
    } catch (error) {
        console.log(error);
        return sendError(res, error)
    }
}
const verifyEmailController = async (req, res) => {
    try {
        const { token } = req.params
        let decoded
        try {
            decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
        } catch (err) {
            return res.status(401).json({ success: false, message: "Invalid or expired verification link" })
        }
        if (decoded.type === 'access' || !decoded.id) {
            return res.status(401).json({ success: false, message: "Invalid or expired verification link" })
        }
        const findUser = await User.findById(decoded.id)
        if (!findUser) {
            return res.status(404).json({ success: false, message: "User not found" })
        }
        if (findUser.isVerified) {
            return res.status(400).json({ success: false, message: "User already verified" })
        }
        findUser.isVerified = true
        await findUser.save()
        return res.status(200).json({ success: true, message: "Email verified successfully" })
    } catch (error) {
        console.log(error);
        return sendError(res, error)
    }
}
const meController = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" })
        }
        return res.status(200).json({ success: true, message: "Current user", user: safeUser(user) })
    } catch (error) {
        return sendError(res, error)
    }
}
module.exports = { meController, registrationController, loginController, forgetPasswordController, resetPasswordController, resendverificationemailcontroller, verifyEmailController }