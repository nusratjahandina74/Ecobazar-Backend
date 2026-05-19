require('dotenv').config();
const express = require('express')
const cors = require('cors')
const dbConfig = require('./config/dbConfig');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swaggerConfig');
// const { registrationController, loginController, forgetPasswordController, resetPasswordController, resendverificationemailcontroller, verifyEmailController } = require('./controllers/authController');
// const { registrationlimiter, loginlimiter, forgetPasswordlimiter } = require('./utils/limiter');
// const { getAllUsersController, singleUserDataController, updateUserController, deleteUserController } = require('./controllers/userController');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');

//Middleware
const app = express()
app.use(express.json())
app.use(cors())
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

//DB Connect
dbConfig()

app.use('/', authRoutes); 
app.use('/', userRoutes); 

// app.post('/registration', registrationlimiter, registrationController)
// app.post('/login', loginlimiter, loginController)
// app.post('/forgetpassword', forgetPasswordlimiter, forgetPasswordController)
// app.post('/resetpassword/:token', resetPasswordController)
// app.post('/resendverificationemail', resendverificationemailcontroller)
// app.post('/verifyemail/:token', verifyEmailController)

// Product Create

// Order Management

// User Management
// app.get('/allusers', getAllUsersController)
// app.get('/singleuser/:id', singleUserDataController)
// app.post('/updateuser/:id', updateUserController)
// app.delete('/deleteuser/:id', deleteUserController)


const port = process.env.PORT || 5000
app.listen(port, () => {
    console.log(`Server Running on port ${port}`);
    console.log(`Swagger Docs portal accessible at http://localhost:${port}/api-docs`);
})