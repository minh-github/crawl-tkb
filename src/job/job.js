const schedule = require("node-schedule");
require("dotenv").config();
const MY_ID = process.env.MY_ID;
import chatBoxController from "../controllers/chatBoxController";
import tableTimeController from "../controllers/tableTimeController";
import userController from "../controllers/userController";
import User from "../models/user";
import moment from "moment";

const bacJob = schedule.scheduleJob("0 0 6 * * *", async function () {
  const today = moment();
  const tomorrow = today.clone().add(1, "days");

  const formattedDate = today.format("DD/MM/YYYY");
  const formattedTomorrow = tomorrow.format("DD/MM/YYYY");

  const users = await User.find({ sender_id: { $ne: MY_ID } }).exec();
  for (const user of users) {
    let pronouns;
    let pronounsUppercase;
    let dataResponse = await tableTimeController.getTableTime(
      formattedDate,
      user.sender_id
    );

    if (!user.hasOwnProperty("gender")) {
      let fbInfo = await userController.getUserFbInfo(user.sender_id);
      user.gender = fbInfo.gender;
      await user.save();
    }

    pronouns = await userController.checkGender(
      user ? user.gender : "none",
      false
    );
    pronounsUppercase = await userController.checkGender(
      user ? user.gender : "none",
      true
    );

    if (!dataResponse) {
      response = {
        text: `Em chưa lấy được thời khóa biểu của ${pronouns} 🐶`,
      };
      await chatBoxController.callSendAPI(user.sender_id, response);
      continue;
    }

    let response;
    if (dataResponse && dataResponse.length > 0) {
      for (const message of dataResponse) {
        let tableTime = "";
        for (const lesson of message.tableTime[0].days) {
          tableTime += lesson.lesson[0] + " - phòng " + lesson.room + "\n";
        }
        response = {
          text:
            message.subject +
            "\n" +
            tableTime +
            "giảng viên - " +
            message.lecturers,
        };
        await chatBoxController.callSendAPI(user.sender_id, response);
      }
      setTimeout(() => {
        response = {
          text: `Em gửi ${pronouns} lịch hôm nay ạ 🩷`,
        };
        chatBoxController.callSendAPI(user.sender_id, response);
      }, 3000);
    } else {
      response = {
        text: `Hôm nay ${pronouns} không có lịch học`,
      };
      await chatBoxController.callSendAPI(user.sender_id, response);
    }
  }
  return 1;
});

export default bacJob;
