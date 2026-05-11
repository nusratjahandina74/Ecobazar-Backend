const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt');
const User = require('../models/userModel')
const { emailverification, resetPasswordmail } = require('../utils/email');
const { emptyFieldValidation } = require('../utils/validation');
const tokenGenerator = require('../utils/tokenGenerator');
const registrationController = async (req, res) => {
    try {
        const { email, password, confirmPassword, terms } = req.body

        emptyFieldValidation(res, email, password, confirmPassword, terms)

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

        const existingUser = await User.findOne({ email: email })
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "User already exists with this email."
            })
        }

        const user = new User({
            email: email,
            password: hash,
            terms: terms
        })
        await user.save()

        const token = tokenGenerator({
            id: user._id,
            email: user.email
        }, process.env.ACCESS_TOKEN_SECRET, '1d')

        emailverification(token, email)
        return res.status(201).json({
            success: true,
            message: "Registration Successfully Done",
            user: {
                id: user._id,
                email: user.email
            }
        })

    } catch (error) {
        // console.error("Error:", err);
        res.status(500).json({
            success: false,
            message: "Internal server error."
        })
    }
}
const loginController = async (req, res) => {
    try {
        const { email, password } = req.body
        emptyFieldValidation(res, email, password)
        const existingUser = await User.findOne({ email: email })
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
        return res.status(200).json({
            success: true,
            message: "Login Successfully Done"
        })
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        })

    }
}
const forgetPasswordController = async (req, res) => {
    try {
        const { email } = req.body
        emptyFieldValidation(res, email)
        const existingUser = await User.findOne({ email: email })
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
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        })
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

        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, async function (err, decoded) {
            if (err) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid or expired token"
                });
            } else {
                const hash = bcrypt.hashSync(newPassword, 10);
                const updatePassword = await User.findByIdAndUpdate({ _id: decoded.id }, { password: hash }, { new: true })
                return res.status(200).json({
                    success: true,
                    message: "Password Updated Successfully"
                })
            }
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        })
    }
}
const resendverificationemailcontroller = async (req, res) => {
    try {
        const { email } = req.body
        const existingUser = await User.findOne({ email: email })
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
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        })
    }
}
const verifyEmailController = async (req, res) => {
    try {
        const { token } = req.params
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, async function (err, decoded) {
            if (err) {
                res.send(message, ":Unauthorized")
            } else {
                const userId = decoded.id
                const findUser = await User.findById(userId)
                if (findUser.isVerified) {
                    return res.status(400).json({
                        success: false,
                        message: "User already verified"
                    })
                } else {
                    findUser.isVerified = true
                    await findUser.save()
                    return res.status(200).json({
                        success: true,
                        message: "Email verified successfully"
                    })
                }
            }
        })
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        })
    }
}
module.exports = { registrationController, loginController, forgetPasswordController, resetPasswordController, resendverificationemailcontroller, verifyEmailController }