const express = require('express')
const app = express()
app.use(express.json())
app.post('/registration', (req, res)=>{
    console.log("Done");
})
const PORT = process.env.PORT || 5000
app.listen(PORT, ()=>{
    console.log(`Server Running on ${PORT}`);
})