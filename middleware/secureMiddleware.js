const jwt = require('jsonwebtoken')
const secureMiddleware = (req, res, next)=>{
    let token = req.headers.authorization
//  const dataVerify = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
 jwt.verify(token, 'shhhhh', function(err, decoded) {
  if(err){
    res.send(message, ":Unauthorized")
  }else{
    next()
  }
});
}

module.exports = {secureMiddleware}