require('dotenv').config();
const express = require('express')
const cors = require('cors')
const dbConfig = require('./config/dbConfig')
const app = express()
app.use(express.json())
app.use(cors())
dbConfig()
app.get('/',(req, res)=>{
    res.send("Done")
})
app.post('/registration', (req, res)=>{
    console.log("Done");
})
const port = process.env.PORT || 5000
app.listen(port, ()=>{
    console.log(`Server Running on port ${port}`);
})