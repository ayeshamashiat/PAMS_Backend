// backend/server.js 
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/userRoutes');
const studentRoutes = require('./routes/studentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const createHardcodedAdmin = require('./utils/createAdminUser');
const cors = require("cors");
const notificationRoutes = require('./routes/notificationRoutes');
const facultyRoutes = require('./routes/facultyRoutes');
const pgcRoutes = require('./routes/pgcRoutes');
const bodyParser = require('body-parser');


dotenv.config();
const app = express();
const PORT = 8080;

app.use(express.json());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true })); 

app.use(cors({ origin: "http://localhost:3000", credentials: true }));

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB connected successfully');
    await createHardcodedAdmin();  
    app.listen(process.env.PORT || 8080, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  })
  .catch(err => console.error('❌ MongoDB connection error:', err));

app.get('/', (req, res) => {
  res.send('🚀 Server is running');
});

app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/pgc', pgcRoutes);