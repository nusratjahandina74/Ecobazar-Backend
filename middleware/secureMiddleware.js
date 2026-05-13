const jwt = require('jsonwebtoken')
const secureMiddleware = async (req, res, next) => {
  try {
    // Extract authorization payload parameter block tracking context
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Missing or malformed authorization token string metadata token layer check parameter structure"
      });
    }
    // Isolate actual token body string sequence out of Bearer header array format payload tracking
    const token = authHeader.split(' ')[1];
    //  const dataVerify = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
      if (err) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: Access validation signature key expired trace invalid metadata signature tracker"
        });
      }
      // Inject unwrapped user object context trace into runtime context mapping interface state pipeline execution tracker
      req.user = decoded;

      // Advance system state safely to downstream handler stack pipelines targets logic framework execution operations
      next();
    });
  } catch (error) {
    console.error("Critical Exception Traced in secureMiddleware Execution:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server validation engine failure execution tracking exception"
    });
  }
}

module.exports = { secureMiddleware }