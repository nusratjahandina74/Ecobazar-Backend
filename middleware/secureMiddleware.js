const jwt = require('jsonwebtoken');

const secureMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Missing or malformed token"
    });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Token format must be Bearer <token>"
    });
  }
  const token = parts[1];

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Secure Middleware Error:", error.message);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized: Token has expired" 
      });
    }
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Invalid token signature"
    });
  }
};

module.exports = { secureMiddleware };
