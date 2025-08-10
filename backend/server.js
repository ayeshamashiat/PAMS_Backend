// backend/server.js
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/userRoutes");
const studentRoutes = require("./routes/studentRoutes");
const adminRoutes = require("./routes/adminRoutes");
const cors = require("cors");
<<<<<<< HEAD
const notificationRoutes = require("./routes/notificationRoutes");
const facultySupervisorAssignmentRoutes = require("./routes/facultySupervisorAssignmentRoutes");
const createHardcodedAdmin = require("./utils/createAdminUser");
=======
const notificationRoutes = require('./routes/notificationRoutes');
const facultyRoutes = require('./routes/facultyRoutes');


>>>>>>> a3793c3492f109590805e5eb5dc8b0ae63f09f89
dotenv.config();
const app = express();
const PORT = 8080;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors({ origin: "http://localhost:3000", credentials: true }));

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("✅ MongoDB connected successfully");
    await createHardcodedAdmin(); //
    console.log("✅ MongoDB connected successfully");
    await createHardcodedAdmin();
    app.listen(process.env.PORT || 8080, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => console.error("❌ MongoDB connection error:", err));

app.get("/", (req, res) => {
  res.send("🚀 Server is running");
});

<<<<<<< HEAD
app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use(
  "/api/faculty/supervisor-assignment",
  facultySupervisorAssignmentRoutes
);
=======
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/faculty', facultyRoutes);
>>>>>>> a3793c3492f109590805e5eb5dc8b0ae63f09f89
