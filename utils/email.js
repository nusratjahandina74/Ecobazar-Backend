const nodemailer = require("nodemailer");
const MailComposer = require("nodemailer/lib/mail-composer");

const MAIL_USER = process.env.MAIL_USER;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// Local fallback (Gmail SMTP) - Render free e kaj korbe na
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: MAIL_USER, pass: process.env.MAIL_PASS },
});

let cachedToken = null;
let cachedExpiry = 0;

const getAccessToken = async () => {
    if (cachedToken && Date.now() < cachedExpiry) return cachedToken;
    const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: process.env.GMAIL_CLIENT_ID,
            client_secret: process.env.GMAIL_CLIENT_SECRET,
            refresh_token: process.env.GMAIL_REFRESH_TOKEN,
            grant_type: "refresh_token",
        }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Google token error: ${JSON.stringify(data)}`);
    cachedToken = data.access_token;
    cachedExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return cachedToken;
};

const buildRaw = (mail) =>
    new Promise((resolve, reject) => {
        new MailComposer(mail).compile().build((err, message) => {
            if (err) return reject(err);
            resolve(
                message
                    .toString("base64")
                    .replace(/\+/g, "-")
                    .replace(/\//g, "_")
                    .replace(/=+$/, "")
            );
        });
    });

const sendMail = async ({ to, subject, html }) => {
    const mail = { from: `"EcoBazar" <${MAIL_USER}>`, to, subject, html };

    // Production (Render): Gmail API over HTTPS
    if (process.env.GMAIL_REFRESH_TOKEN) {
        const accessToken = await getAccessToken();
        const raw = await buildRaw(mail);
        const res = await fetch(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ raw }),
            }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(`Gmail API error ${res.status}: ${JSON.stringify(data)}`);
        return data.id;
    }

    // Local: Gmail SMTP
    const info = await transporter.sendMail(mail);
    return info.messageId;
};

const emailverification = async (token, email) => {
    try {
        const link = `${FRONTEND_URL}/verifyemail/${token}`;
        const id = await sendMail({
            to: email,
            subject: "Please verify your email",
            html: `<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:Arial,sans-serif"><div style="display:none;max-height:0;overflow:hidden;opacity:0">Verify your EcoBazar account and start shopping eco-friendly products today.</div><table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f6f8"><tr><td align="center" style="padding:20px 10px"><table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.05)"><tr><td align="center" style="background:#27ae60;padding:25px"><span style="color:#fff;font-size:26px;font-weight:700">🌿 EcoBazar</span></td></tr><tr><td align="center" style="padding:30px 25px 10px"><h2 style="margin:0;color:#2c3e50">Verify Your Email Address</h2></td></tr><tr><td align="center" style="padding:10px 30px 30px;color:#555;font-size:15px;line-height:1.6"><p style="margin:0 0 15px">Hello<strong> User</strong>,</p><p style="margin:0 0 20px">Thanks for signing up with EcoBazar. Please confirm your email address to activate your account and enjoy a seamless eco-friendly shopping experience.</p><a href="${link}" style="display:inline-block;padding:14px 28px;background:#27ae60;color:#fff;text-decoration:none;font-weight:700;border-radius:6px;font-size:16px">Verify Email</a><div style="margin:30px 0;height:1px;background:#eee"></div><p style="font-size:13px;color:#888;margin:0 0 10px">If the button above doesn't work, copy and paste this link into your browser:</p><p style="font-size:13px;word-break:break-all;color:#27ae60">${link}</p></td></tr><tr><td align="center" style="padding:0 30px 25px;font-size:13px;color:#999">This verification link will expire in <strong>24 hours</strong> for security reasons.</td></tr><tr><td align="center" style="background:#fafafa;padding:20px;font-size:12px;color:#999;line-height:1.5"><p style="margin:0 0 8px">© 2026 EcoBazar. All rights reserved.</p><p style="margin:0 0 8px">You received this email because you created an account on EcoBazar.</p><p style="margin:0">If this wasn't you, please ignore this email.</p></td></tr></table></td></tr></table></body>`,
        });
        console.log("Verification mail sent:", id);
        return true;
    } catch (err) {
        console.error("Error while sending verification mail:", err);
        return false;
    }
};

const resetPasswordmail = async (token, email) => {
    try {
        const link = `${FRONTEND_URL}/resetpassword/${token}`;
        const id = await sendMail({
            to: email,
            subject: "Please Reset your Password",
            html: `<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,sans-serif"><table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#f5f5f5"><tr><td align="center" style="padding:40px 20px"><table width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="border-radius:8px;overflow:hidden"><tr><td align="center" bgcolor="#2e7d32" style="padding:30px 20px"><h1 style="color:#fff;margin:0;font-size:28px">EcoBazar</h1></td></tr><tr><td style="padding:40px 30px;color:#333"><h2 style="margin-top:0">Reset Your Password</h2><p style="font-size:16px;line-height:1.5">Hi User,<br><br>We received a request to reset your EcoBazar account password. Click the button below to set a new password:</p><p style="text-align:center;margin:40px 0"><a href="${link}" style="background-color:#2e7d32;color:#fff;text-decoration:none;padding:14px 28px;border-radius:5px;font-size:16px;display:inline-block">Reset Password</a></p><p style="font-size:14px;color:#666">This link will expire in 24 hours. If you didn’t request a password reset, please ignore this email — your password will remain unchanged.</p><p style="font-size:14px;color:#666;margin-top:30px">Best regards,<br>The EcoBazar Team</p></td></tr><tr><td align="center" bgcolor="#f0f0f0" style="padding:20px;font-size:12px;color:#777">© 2026 EcoBazar. All rights reserved.</td></tr></table></td></tr></table></body>`,
        });
        console.log("Reset mail sent:", id);
        return true;
    } catch (err) {
        console.error("Error while sending reset mail:", err);
        return false;
    }
};

module.exports = { emailverification, resetPasswordmail };