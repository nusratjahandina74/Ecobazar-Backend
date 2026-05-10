const nodemailer = require("nodemailer");
const transporter = nodemailer.createTransport({
    service: "gmail",
    port: 587,
    secure: false, // use STARTTLS (upgrade connection to TLS after connecting)
    auth: {
        user: "nusrat49141@gmail.com",
        pass: "whvniwjdlggvpotl",
    },
});
const emailverification = async (token, email) => {
    try {
        const info = await transporter.sendMail({
            from: 'nusrat49141@gmail.com', // sender address
            to: email, // list of recipients
            subject: "Please verify your email", // subject line
            html: `<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:Arial,sans-serif"><div style="display:none;max-height:0;overflow:hidden;opacity:0">Verify your EcoBazar account and start shopping eco-friendly products today.</div><table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f6f8"><tr><td align="center" style="padding:20px 10px"><table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.05)"><tr><td align="center" style="background:#27ae60;padding:25px"><span style="color:#fff;font-size:26px;font-weight:700">🌿 EcoBazar</span></td></tr><tr><td align="center" style="padding:30px 25px 10px"><h2 style="margin:0;color:#2c3e50">Verify Your Email Address</h2></td></tr><tr><td align="center" style="padding:10px 30px 30px;color:#555;font-size:15px;line-height:1.6"><p style="margin:0 0 15px">Hello<strong> User</strong>,</p><p style="margin:0 0 20px">Thanks for signing up with EcoBazar. Please confirm your email address to activate your account and enjoy a seamless eco-friendly shopping experience.</p><a href="http://localhost:5173/verifyemail/${token}" style="display:inline-block;padding:14px 28px;background:#27ae60;color:#fff;text-decoration:none;font-weight:700;border-radius:6px;font-size:16px">Verify Email</a><div style="margin:30px 0;height:1px;background:#eee"></div><p style="font-size:13px;color:#888;margin:0 0 10px">If the button above doesn't work, copy and paste this link into your browser:</p><p style="font-size:13px;word-break:break-all;color:#27ae60">"http://localhost:5173/verifyemail/${token}"</p></td></tr><tr><td align="center" style="padding:0 30px 25px;font-size:13px;color:#999">This verification link will expire in<strong>24 hours</strong>for security reasons.</td></tr><tr><td align="center" style="background:#fafafa;padding:20px;font-size:12px;color:#999;line-height:1.5"><p style="margin:0 0 8px">© 2026 EcoBazar. All rights reserved.</p><p style="margin:0 0 8px">You received this email because you created an account on EcoBazar.</p><p style="margin:0">If this wasn't you, please ignore this email.</p></td></tr></table></td></tr></table></body>`,
        });

        console.log("Message sent: %s", info.messageId);
        // Preview URL is only available when using an Ethereal test account
        console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    } catch (err) {
        console.error("Error while sending mail:", err);
    }

}
const resetPasswordmail = async (token, email) => {
    try {
        const info = await transporter.sendMail({
            from: 'nusrat49141@gmail.com', // sender address
            to: email, // list of recipients
            subject: "Please Reset your Password", // subject line
            html: `<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,sans-serif"><table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#f5f5f5"><tr><td align="center" style="padding:40px 20px"><table width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="border-radius:8px;overflow:hidden"><tr><td align="center" bgcolor="#2e7d32" style="padding:30px 20px"><h1 style="color:#fff;margin:0;font-size:28px">EcoBazar</h1></td></tr><tr><td style="padding:40px 30px;color:#333"><h2 style="margin-top:0">Reset Your Password</h2><p style="font-size:16px;line-height:1.5">Hi User,<br><br>We received a request to reset your EcoBazar account password. Click the button below to set a new password:</p><p style="text-align:center;margin:40px 0"><a href="http://localhost:5000/resetpasswor/${token}" style="background-color:#2e7d32;color:#fff;text-decoration:none;padding:14px 28px;border-radius:5px;font-size:16px;display:inline-block">Reset Password</a></p><p style="font-size:14px;color:#666">This link will expire in 30 minutes. If you didn’t request a password reset, please ignore this email — your password will remain unchanged.</p><p style="font-size:14px;color:#666;margin-top:30px">Best regards,<br>The EcoBazar Team</p></td></tr><tr><td align="center" bgcolor="#f0f0f0" style="padding:20px;font-size:12px;color:#777">© 2026 EcoBazar. All rights reserved.<br><a href="[UNSUBSCRIBE_LINK]" style="color:#2e7d32;text-decoration:none">Unsubscribe</a></td></tr></table></td></tr></table></body>`,
        });

        console.log("Message sent: %s", info.messageId);
        // Preview URL is only available when using an Ethereal test account
        console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    } catch (err) {
        console.error("Error while sending mail:", err);
    }

}

module.exports = { emailverification, resetPasswordmail }