require('dotenv').config();
const express = require('express')
const cors = require('cors')
const dbConfig = require('./config/dbConfig');
const { registrationController, loginController, forgetPasswordController, resetPasswordController, resendverificationemailcontroller } = require('./controllers/authController');


//Middleware
const app = express()
app.use(express.json())
app.use(cors())

//DB Connect
dbConfig()
// app.get('/', (req, res) => {
//     res.send("Done")
// })

app.post('/registration', registrationController)
app.post('/login', loginController)
app.post('/forgetpassword', forgetPasswordController)
app.post('/resetpassword/:token', resetPasswordController)
app.post('/resendverificationemail', resendverificationemailcontroller)



const port = process.env.PORT || 5000
app.listen(port, () => {
    console.log(`Server Running on port ${port}`);
})