const jwt = require('jsonwebtoken')
const tokenGenerator = (data, secret, expires) => {
    const token = jwt.sign(data, secret, {
        expiresIn: expires
    })
    return token
}
module.exports = tokenGenerator