const express = require("express");
const connectDB = require("./config/database");
const app = express();
const cookieParser = require("cookie-parser");
const cors = require("cors");
const http = require("http");
const bcrypt = require("bcrypt");

require("dotenv").config();
require("./utils/cronjob");

app.use(cors({
  origin: ['https://dev-tinder-jet.vercel.app', 'http://localhost:5173', 'https://dev-tinder-sidgureja.netlify.app/' ],  // Allow specific origins
  credentials: true,  // Allow credentials (cookies, etc.)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const authRouter = require("./routes/auth");
const profileRouter = require("./routes/profile");
const requestRouter = require("./routes/request");
const userRouter = require("./routes/user");
const paymentRouter = require("./routes/payment");
const initializeSocket = require("./utils/socket");
const chatRouter = require("./routes/chat");
const feedRouter = require("./routes/feed");
const matchRouter = require("./routes/match");

app.use("/", authRouter);
app.use("/", profileRouter);
app.use("/", requestRouter);
app.use("/", userRouter);
app.use("/", paymentRouter);
app.use("/", chatRouter);
app.use("/", feedRouter);
app.use("/match", matchRouter);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).send({
    status: "ok",
    message: "Server is running",
    timestamp: new Date().toISOString()
  });
});

const server = http.createServer(app);
initializeSocket(server);


connectDB()
  .then(() => {
    console.log("Database connection established");
    server.listen(7777, () => {
      console.log("Server is successfully listening on port 7777");
      
      const password = '8193006167Sid@';  // The password you want to check
      bcrypt.hash(password, 10).then(hashedPassword => {
      console.log('Hashed Password:', hashedPassword);
      }).catch(err => {
    console.error('Error hashing password:', err);
});
      
});

  })
  .catch((err) => {
    console.error("Database cannot be connected!!", err);
  });
