const express = require("express");
const connectDB = require("./config/database");
const app = express();
const cookieParser = require("cookie-parser");
const cors = require("cors");
const http = require("http");
const bcrypt = require("bcrypt");

// Initialize Firebase Admin (this should be done early)
require("./config/firebase");

require("dotenv").config();
require("./utils/cronjob");

const allowedOrigins = [
  process.env.FRONTEND_SITE,         // https://www.mergemates.site
  process.env.FRONTEND_VERCEL,       // https://mergemates-jet.vercel.app
  process.env.FRONTEND_LOCAL,        // http://localhost:5173
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const authRouter = require("./routes/auth");
const profileRouter = require("./routes/profile");
const requestRouter = require("./routes/request");
const userRouter = require("./routes/user");

const initializeSocket = require("./utils/socket");
const chatRouter = require("./routes/chat");
const feedRouter = require("./routes/feed");
const matchRouter = require("./routes/match");
const firebaseAuthRouter = require("./routes/firebaseAuth");
const onboardingRouter = require("./routes/onboarding");

app.use("/", authRouter);
app.use("/", firebaseAuthRouter);
app.use("/", profileRouter);
app.use("/", requestRouter);
app.use("/", userRouter);

app.use("/", chatRouter);
app.use("/", feedRouter);
app.use("/match", matchRouter);
app.use("/", onboardingRouter);

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
    server.listen(process.env.PORT, () => {
      console.log("Server is successfully listening on port", process.env.PORT);
      
});

  })
  .catch((err) => {
    console.error("Database cannot be connected!!", err);
  });
