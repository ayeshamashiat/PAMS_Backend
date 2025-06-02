// server.js
const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = 5000;

// Middleware
app.use(express.json());

// MongoDB connection string
const MONGO_URI = 'mongodb+srv://pams:pams2025@pams.eawhvlc.mongodb.net/?retryWrites=true&w=majority&appName=PAMS'; // Replace with your DB name or Atlas URI

// Connect to MongoDB
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.get('/', (req, res) => {
  res.send('Hello from Express with MongoDB!');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
