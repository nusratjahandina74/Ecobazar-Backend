const jwt = require('jsonwebtoken')
const User = require('../models/userModel')
const { emailverification, resetPasswordmail } = require('../utils/email');
const { emptyFieldValidation } = require('../utils/validation');
const tokenGenerator = require('../utils/tokenGenerator');
const registrationController = async (req, res) => {
    try {
        const { email, password, confirmPassword, terms } = req.body

        emptyFieldValidation(res, email, password, confirmPassword, terms)

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
        const hash = bcrypt.hashSync(password, 10);

        const existingUser = await User.findOne({ email: email })
        if (existingUser) {
            return res.status(409).send({
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
const loginController = async (req, res) => {
    const { email, password } = req.body
    emptyFieldValidation(res, email, password)
    const existingUser = await User.findOne({ email: email })
    if (!existingUser) {
        return res.status(409).send({
            success: false,
            message: "User not found"
        })
    }
    const pass = bcrypt.compareSync(password, existingUser.password);

    if (!pass) {
        return res.status(401).send({
            success: false,
            message: "Invalid Credential"
        })
    }
    return res.status(200).json({
        success: true,
        message: "Login Successfully Done"
    })
}
const forgetPasswordController = async (req, res) => {
    const { email } = req.body
    emptyFieldValidation(res, email)
    const existingUser = await User.findOne({ email: email })
    if (!existingUser) {
        return res.status(409).send({
            success: false,
            message: "Email not found"
        })
    }
    const token = tokenGenerator({
        id: existingUser._id,
        email: existingUser.email
    }, process.env.ACCESS_TOKEN_SECRET, '1d')

    resetPasswordmail(token, email)
    res.status(200).send({
        success: true,
        message: "Please check your email"
    })

}
const resetPasswordController = async (req, res) => {
    const { newPassword, confirmPassword } = req.body
    const {token} = req.params
    if (newPassword !== confirmPassword) {
        return res.status(400).send({
            success: false,
            message: "Confirm Password not matched."
        })
    }

    jwt.verify(token, 'shhhhh', function(err, decoded) {
      if(err){
        res.send(message, ":Unauthorized")
      }else{
        const hash = bcrypt.hashSync(newPassword, 10);
        const updatePassword = User.findByIdAndDelete({_id: decoded.id}, {password: newPassword})
        return res.status(200).send({
            success: true,
            message: "Password Updated"
        })
      }
    });
}
const resendverificationemailcontroller = async (req, res)=>{
    const {email} = req.body
    const existingUser = await User.findOne({ email: email })
    const token = tokenGenerator({
            id: existingUser._id,
            email: existingUser.email
        }, process.env.ACCESS_TOKEN_SECRET, '1d')

        emailverification(token, email)
    return res.status(200).send({
            success: true,
            message: "Verification email sent. Please check your inbox."
        })   
}
module.exports = { registrationController, loginController, forgetPasswordController, resetPasswordController, resendverificationemailcontroller }