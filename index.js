require('dotenv').config();
const express = require('express')
const cors = require('cors')
const dbConfig = require('./config/dbConfig');
const { registrationController } = require('./controllers/authController');


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



const port = process.env.PORT || 5000
app.listen(port, () => {
    console.log(`Server Running on port ${port}`);
})