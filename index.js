require('dotenv').config();
const express = require('express');
const cors = require('cors');
const dbConfig = require('./config/dbConfig');
const swaggerDocs = require('./config/swaggerConfig');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');

const app = express();
app.use(express.json());
app.use(cors());

// DB Connection
dbConfig();

// App API Distributed Routes Mounted
app.use('/', authRoutes); 
app.use('/', userRoutes); 
app.use('/', productRoutes); 

const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log(`Server Running on port ${port}`);
    swaggerDocs(app, port);
});
