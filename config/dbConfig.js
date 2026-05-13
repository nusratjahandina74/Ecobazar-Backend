const mongoose = require('mongoose')
const dbConfig = async ()=>{
    try {
        const connection = await mongoose.connect(process.env.MONGODB_URL)
        console.log("Database Connected");
    } catch (error) {
        console.error(`Database Connection Error: ${error.message}`);
    }
}
module.exports = dbConfig