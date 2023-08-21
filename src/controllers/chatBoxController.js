require("dotenv").config();
import request from "request";
import User from "../models/user";
import tableTimeController from "./tableTimeController";
import crawl from "../crawl/crawl";
const schedule = require("node-schedule");

const currentDate = new Date();

const day = String(currentDate.getDate()).padStart(2, "0"); // Đảm bảo luôn có 2 chữ số
const month = String(currentDate.getMonth() + 1).padStart(2, "0"); // Tháng trong JavaScript bắt đầu từ 0
const year = currentDate.getFullYear();

const tomorrowDate = new Date(year, month, day + 1);

const tomorrowDay = String(tomorrowDate.getDate()).padStart(2, "0");
const tomorrowMonth = String(tomorrowDate.getMonth() + 1).padStart(2, "0");
const tomorrowYear = tomorrowDate.getFullYear();

const formattedTomorrow = `${tomorrowDay}/${tomorrowMonth}/${tomorrowYear}`;

const formattedDate = `${day}/${month}/${year}`;

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const MY_ID = process.env.MY_ID;

let getHomePage = (req, res) => {
  return res.send("xin chao");
};

let getWebHook = (req, res) => {
  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
};

let postWebHook = (req, res) => {
  let body = req.body;
  if (body.object === "page") {
    body.entry.forEach(function (entry) {
      let webhook_event = entry.messaging[0];

      let sender_psid = webhook_event.sender.id;
      console.log("Sender PSID: " + sender_psid);
      if (webhook_event.message && sender_psid != MY_ID) {
        handleMessage(sender_psid, webhook_event.message);
      } else if (webhook_event.postback && sender_psid != MY_ID) {
        handlePostback(sender_psid, webhook_event.postback);
      }
    });

    res.status(200).send("EVENT_RECEIVED");
  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }
};

// Handles messages events
async function handleMessage(sender_psid, message) {
  let regex;
  let excludeWords;
  let inputString = message.text;
  inputString = inputString.toLowerCase();

  console.log(inputString);

  let response;
  let user = await User.findOne({ sender_id: sender_psid });

  // khởi tạo user mới

  if (!user) {
    const newUser = new User({
      username: "",
      password: "",
      sender_id: sender_psid,
    });
    await newUser.save();

    response = {
      text: "Há luu! anh cần gì thế?",
    };
    callSendAPI(sender_psid, response);
    return 1;
  }

  // nhận request thời khóa biểu
  regex = /thời khóa|tkb/i;
  excludeWords = /(hôm nay|nay|ngày mai|mai)/i;
  if (
    regex.test(inputString) &&
    !excludeWords.test(inputString) &&
    user.password == ""
  ) {
    response = {
      text: "Oki! Cho em mã sinh viên",
    };

    callSendAPI(sender_psid, response);
    return 1;
  }

  // nhận mã sinh viên aka username

  if (inputString.includes("dtc") && inputString.length < 18) {
    const pattern = /dtc.*/;
    const matches = inputString.match(pattern);
    if (matches && matches.length > 0) {
      const extractedSubString = matches[0];
      console.log("mã sinh viên " + extractedSubString);
      if (user.sender_id != MY_ID) {
        user.username = extractedSubString;
        await user.save();
      }
      response = {
        text: "Rồi mật khẩu nữa",
      };
    } else {
      response = {
        text: "Mã sinh viên hình như sai ở đâu rồi ý",
      };
    }

    callSendAPI(sender_psid, response);
    return 1;
  }

  // nhận mật khẩu

  if (
    sender_psid != MY_ID &&
    (inputString.includes("mật khẩu") || inputString.includes("mk"))
  ) {
    const pattern1 = /mk\s*([^\s]*)/;
    const pattern2 = /mật khẩu\s*(.*)/;

    const match1 = pattern1.exec(inputString);
    const match2 = pattern2.exec(inputString);

    if (match1 && match1.length > 1) {
      const extractedSubString1 = match1[1];
      if (user.sender_id != MY_ID) {
        user.password = extractedSubString1;
        await user.save();
        console.log(sender_psid);
        await processData({
          id: user.username,
          pass: user.password,
          idsender: sender_psid,
        });
      }
      response = {
        text: "Oke đã lấy xong thời khóa biểu",
      };
    } else if (match2 && match2.length > 1) {
      const extractedSubString2 = match2[1];
      if (user.sender_id != MY_ID) {
        user.password = extractedSubString2;
        await user.save();
        await processData({
          id: user.username,
          pass: user.password,
          idsender: sender_psid,
        });
      }
      response = {
        text: "Oke đã lấy xong thời khóa biểu",
      };
    } else {
      response = {
        text: "Mật khẩu của bạn hình như sai ở đâu rồi ý",
      };
    }

    callSendAPI(sender_psid, response);
    return 1;
  }

  // thời khóa biểu hôm nay

  if (inputString.includes("hôm nay") || inputString.includes("nay")) {
    let dataResponse = await tableTimeController.getTableTime(
      formattedDate,
      sender_psid
    );
    if (dataResponse.length > 0 && dataResponse != null) {
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
        await callSendAPI(sender_psid, response);
      }
    } else {
      response = {
        text: "Hôm nay anh không có lịch học",
      };
      await callSendAPI(sender_psid, response);
    }
    return 1;
  }

  if (inputString.includes("ngày mai") || inputString.includes("mai")) {
    let dataResponse = await tableTimeController.getTableTime(
      formattedTomorrow,
      sender_psid
    );
    if (dataResponse.length > 0) {
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
        await callSendAPI(sender_psid, response);
      }
    } else {
      response = {
        text: "Ngày mai anh không có lịch học",
      };
      await callSendAPI(sender_psid, response);
    }
    return 1;
  }

  // từ lần sau khi đăng nhập
  else {
    response = {
      text: "À lú! anh muốn Bấc làm gì nào?",
    };
    callSendAPI(sender_psid, response);
    return 1;
  }
}

// Handles messaging_postbacks events
function handlePostback(sender_psid, received_postback) {}

// Sends response messages via the Send API
async function callSendAPI(sender_psid, response) {
  let request_body = {
    recipient: {
      id: sender_psid,
    },
    message: response,
  };
  // Send the HTTP request to the Messenger Platform
  request(
    {
      uri: "https://graph.facebook.com/v2.6/me/messages",
      qs: { access_token: PAGE_ACCESS_TOKEN },
      method: "POST",
      json: request_body,
    },
    (err, res, body) => {
      if (!err) {
        console.log("message sent!" + response);
      } else {
        console.error("Unable to send message:" + err);
      }
    }
  );
}

async function processData(data) {
  console.log(data.idsender);
  await crawl.getData(data.id, data.pass, data.idsender);
}

module.exports = {
  getHomePage: getHomePage,
  getWebHook: getWebHook,
  postWebHook: postWebHook,
  callSendAPI: callSendAPI,
};
