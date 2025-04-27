const express = require("express");
const requestRouter = express.Router();

const { authenticateUser } = require("../middlewares/auth");
const ConnectionRequest = require("../models/connectionRequest");
const User = require("../models/User");

const sendEmail = require("../utils/sendEmail");

requestRouter.post(
  "/request/send/:status/:toUserId",
  authenticateUser,
  async (req, res) => {
    try {
      const fromUserId = req.userId;
      const toUserId = req.params.toUserId;
      const status = req.params.status;

      const allowedStatus = ["ignored", "interested"];
      if (!allowedStatus.includes(status)) {
        return res
          .status(400)
          .json({ message: "Invalid status type: " + status });
      }

      const fromUser = await User.findById(fromUserId);
      if (!fromUser) {
        return res.status(404).json({ message: "User not found!" });
      }

      const toUser = await User.findById(toUserId);
      if (!toUser) {
        return res.status(404).json({ message: "User not found!" });
      }

      const existingConnectionRequest = await ConnectionRequest.findOne({
        $or: [
          { fromUserId, toUserId },
          { fromUserId: toUserId, toUserId: fromUserId },
        ],
      });
      if (existingConnectionRequest) {
        return res
          .status(400)
          .send({ message: "Connection Request Already Exists!!" });
      }

      const connectionRequest = new ConnectionRequest({
        fromUserId,
        toUserId,
        status,
      });

      const data = await connectionRequest.save();

      // const emailRes = await sendEmail.run(
      //   "A new friend request from " + fromUser.firstName,
      //   fromUser.firstName + " is " + status + " in " + toUser.firstName
      // );
      // console.log(emailRes);

      res.json({
        message:
          fromUser.firstName + " is " + status + " in " + toUser.firstName,
        data,
      });
    } catch (err) {
      res.status(400).send("ERROR: " + err.message);
    }
  }
);

requestRouter.post(
  "/request/review/:status/:requestId",
  authenticateUser,
  async (req, res) => {
    try {
      const loggedInUserId = req.userId;
      const status = req.params.status;
      const requestId = req.params.requestId;

      const loggedInUser = await User.findById(loggedInUserId);
      if (!loggedInUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const request = await ConnectionRequest.findById(requestId);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }

      if (request.toUserId.toString() !== loggedInUserId) {
        return res.status(403).json({ message: "Not authorized to review this request" });
      }

      request.status = status;
      await request.save();

      res.json({
        message: "Request " + status,
        data: request,
      });
    } catch (err) {
      res.status(400).send("ERROR: " + err.message);
    }
  }
);

module.exports = requestRouter;
