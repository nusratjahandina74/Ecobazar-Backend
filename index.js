require('dotenv').config();
const express = require('express');
const cors = require('cors');
const dbConfig = require('./config/dbConfig');
const swaggerDocs = require('./config/swaggerConfig');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoute');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.urlencoded({ extended: true }));

// DB Connection
dbConfig();
app.use('/', authRoutes); 
app.use('/', userRoutes); 
app.use('/', productRoutes); 
app.use('/', cartRoutes);
app.use('/', paymentRoutes); 

const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log(`Server Running on port ${port}`);
    swaggerDocs(app, port);
});
