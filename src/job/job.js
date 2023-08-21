const schedule = require("node-schedule");
require("dotenv").config();
const MY_ID = process.env.MY_ID;
import chatBoxController from "../controllers/chatBoxController";
import User from "../models/user";

const bacJob = schedule.scheduleJob("*/1 * * * *", async function () {
  const users = await User.find({ sender_id: { $ne: MY_ID } }).exec();
  for (const user of users) {
    let response = {
      text: "Gâu Gấu!",
    };
    chatBoxController.callSendAPI(user.sender_id, response);
  }
});

export default bacJob;
