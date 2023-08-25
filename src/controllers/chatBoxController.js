require("dotenv").config();
import request from "request";
import User from "../models/user";
import tableTimeController from "./tableTimeController";
import userController from "./userController";
import crawl from "../crawl/crawl";
const schedule = require("node-schedule");
import moment from "moment";
import fs from "fs";
import path from "path";
const storagePath = path.join(__dirname, "../storage");

const today = moment();
const tomorrow = today.clone().add(1, "days");

const formattedDate = today.format("DD/MM/YYYY");
const formattedTomorrow = tomorrow.format("DD/MM/YYYY");

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
  let pronouns;
  let pronounsUppercase;
  let inputString = message.text;
  inputString = inputString
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  let response;
  let user = await User.findOne({ sender_id: sender_psid });

  if (user && !user.hasOwnProperty("gender")) {
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
  // khởi tạo user mới

  if (!user) {
    let fbInfo = await userController.getUserFbInfo(sender_psid);
    const newUser = new User({
      username: "",
      password: "",
      confirm: 0,
      sender_id: sender_psid,
      gender: fbInfo.gender,
    });
    await newUser.save();

    response = {
      text: `Há luu! ${pronouns} cần gì thế?`,
    };
    callSendAPI(sender_psid, response);
    return 1;
  }

  // nhận request thời khóa biểu
  regex = /thoi khoa|tkb/i;
  excludeWords = /(hom nay|nay|ngay mai|mai|lay lai)/i;
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
        text: "Rồi mật khẩu nữa (thêm ký tự mk ở trước mật khẩu)",
      };
    } else {
      response = {
        text: `Mã sinh viên của ${pronouns} hình như sai ở đâu rồi ý`,
      };
    }

    callSendAPI(sender_psid, response);
    return 1;
  }

  // nhận mật khẩu

  if (
    sender_psid != MY_ID &&
    (inputString.includes("mat khau") || inputString.includes("mk"))
  ) {
    if (user.username == "") {
      response = {
        text: `${pronounsUppercase} đã nhập mã sinh viên đâu?`,
      };
      await callSendAPI(sender_psid, response);
      return 1;
    }
    const pattern1 = /mk\s*([^\s]*)/;
    const pattern2 = /mật khẩu\s*(.*)/;

    const match1 = pattern1.exec(inputString);
    const match2 = pattern2.exec(inputString);

    if (match1 && match1.length > 1) {
      const extractedSubString1 = match1[1];
      if (user.sender_id != MY_ID) {
        user.password = extractedSubString1;
        await user.save();

        await processData({
          id: user.username,
          pass: user.password,
          idsender: user.sender_id,
        });
      }
      response = {
        text: "Oke em đã lấy xong thời khóa biểu",
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
        text: "Oke em đã lấy xong thời khóa biểu",
      };
    } else {
      response = {
        text: `Mật khẩu của ${pronouns} hình như sai ở đâu rồi ý`,
      };
    }

    callSendAPI(sender_psid, response);
    return 1;
  }

  // thời khóa biểu hôm nay
  regex = /hom nay|nay/i;
  if (regex.test(inputString)) {
    if (user.username == "" || user.password == "") {
      response = {
        text: `${pronounsUppercase} nhập thiếu thông tin đăng nhập rồi`,
      };
      await callSendAPI(sender_psid, response);
      return 1;
    }
    let dataResponse = await tableTimeController.getTableTime(
      formattedDate,
      user.sender_id
    );
    if (!dataResponse) {
      response = {
        text: `Em chưa lấy được thời khóa biểu của ${pronouns} 🐶`,
      };
      await callSendAPI(sender_psid, response);
      return 1;
    }
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
      setTimeout(() => {
        response = {
          text: `Em gửi ${pronouns} lịch hôm nay ạ 🐶`,
        };
        callSendAPI(user.sender_id, response);
      }, 3000);
    } else {
      response = {
        text: `Hôm nay ${pronouns} không có lịch học`,
      };
      await callSendAPI(sender_psid, response);
    }
    return 1;
  }
  // thời khóa biểu ngày mai
  regex = /ngay mai|mai/i;
  if (regex.test(inputString)) {
    if (user.username == "" || user.password == "") {
      response = {
        text: `${pronounsUppercase} nhập thiếu thông tin đăng nhập rồi`,
      };
      await callSendAPI(sender_psid, response);
      return 1;
    }
    let dataResponse = await tableTimeController.getTableTime(
      formattedTomorrow,
      user.sender_id
    );
    if (!dataResponse) {
      response = {
        text: `Em chưa lấy được thời khóa biểu của ${pronouns} 🐶`,
      };
      await callSendAPI(sender_psid, response);
      return 1;
    }
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
      setTimeout(() => {
        response = {
          text: `Em gửi ${pronouns} lịch ngày mai ạ 🩷`,
        };
        callSendAPI(user.sender_id, response);
      }, 3000);
    } else {
      response = {
        text: `Ngày mai ${pronouns} không có lịch học`,
      };
      await callSendAPI(sender_psid, response);
    }
    return 1;
  }

  // nhập lại tên đăng nhập

  regex = /khoan|nhap lai|nhap lai ma sinh vien|ma sinh vien sai|ma sai/i;
  if (regex.test(inputString) && user.username != "" && user.password == "") {
    response = {
      text: "Oki! Cho em xin lại mã sinh viên",
    };

    callSendAPI(sender_psid, response);
    return 1;
  }

  // nhập lại mật khẩu

  regex = /nhap lai mat khau|mat khau sai/i;
  if (regex.test(inputString)) {
    if (user.username == "" || user.password == "") {
      response = {
        text: `${pronounsUppercase} còn chưa có tài khoản mà đòi nhập lại?`,
      };
      callSendAPI(sender_psid, response);
      return 1;
    }
    response = {
      text: "Oki! Cho em xin lại mật khẩu",
    };

    callSendAPI(sender_psid, response);
    return 1;
  }

  // đăng nhập lại

  regex = /lam lai|dang nhap lai|xoa tai khoan|doi tai khoan/i;
  if (regex.test(inputString) && user.confirm == 0) {
    if (user.username == "" || user.password == "") {
      response = {
        text: `${pronounsUppercase} còn chưa có tài khoản mà đòi xóa tài khoản?`,
      };

      callSendAPI(sender_psid, response);
      return 1;
    }
    user.confirm = 1;
    await user.save();
    response = {
      text: `${pronounsUppercase} chắc chắn muốn xóa tài khoản chứ?\n - Nhập "xóa" để xóa\n - Nhập "thôi" để hủy xóa`,
    };

    callSendAPI(sender_psid, response);
    return 1;
  }

  // confirm xóa

  if (inputString == "xoa") {
    if (user.username == "" || user.password == "") {
      response = {
        text: `${pronounsUppercase} có tài khoản đâu?`,
      };

      callSendAPI(sender_psid, response);
      return 1;
    }
    if (user.confirm == 0) {
      response = {
        text: "Xóa gì thế ạ?",
      };

      callSendAPI(sender_psid, response);
      return 1;
    }
    user.username = "";
    user.password = "";
    user.confirm = 0;
    await user.save();
    response = {
      text: `Đã xóa tài khoản`,
    };

    callSendAPI(sender_psid, response);
    return 1;
  }

  // confirm hủy xóa

  if (inputString == "thoi") {
    if (user.username == "" || user.password == "") {
      response = {
        text: "Êu chưa có tài khoản mà cứ đòi xóa?",
      };

      callSendAPI(sender_psid, response);
      return 1;
    }
    if (user.confirm == 0) {
      response = {
        text: "Thôi gì thế ạ?",
      };

      callSendAPI(sender_psid, response);
      return 1;
    }
    user.confirm = 0;
    await user.save();
    response = {
      text: `Đã hủy xóa luôn ${pronouns} 🐶`,
    };

    callSendAPI(sender_psid, response);
    return 1;
  }

  // nhập lại mật khẩu

  regex = /lay lai|lay lai thoi khoa bieu|thoi khoa bieu sai/i;
  if (regex.test(inputString) && user.password != "") {
    if (user.username == "" || user.password == "") {
      response = {
        text: `${pronounsUppercase} còn chưa có tài khoản mà?`,
      };

      callSendAPI(sender_psid, response);
      return 1;
    }
    await processData({
      id: user.username,
      pass: user.password,
      idsender: sender_psid,
    });
    response = {
      text: "Em đã lấy lại xong",
    };

    callSendAPI(sender_psid, response);
    return 1;
  }

  // trợ giúp

  regex = /duoc gi|help|lam gi|giup gi/i;
  if (regex.test(inputString)) {
    response = {
      text: `Em có thể làm những việc sau \n - Xem thời khóa biểu \n - Check lịch học hôm nay \n - Check lịch học ngày mai \n - Nhập lại (sai thì nhập lại) \n - Hằng ngày em sẽ nhắn tkb vào 6h sáng \n Cách dùng \n - Xem thời khóa biểu ( "thời khóa biểu" || "tkb" ) \n - Mã sinh viên ( nhập mã sinh viên ) \n - Mật khẩu ( trước mật khẩu ghi mk VD:mk02/08/2000 ) \n - Xem hôm nay ( xem hôm nay ) \n - Xem ngày mai ( xem ngày mai ) \n Hoặc một số tùy chọn như \n - Xóa tài khoản hiên tại (kiểu muốn đăng nhập lại ý) \n - Lấy lại thời khóa biểu
      `,
    };

    callSendAPI(sender_psid, response);
    return 1;
  }

  // trợ giúp

  regex = /ok|cam on|oki|oke/i;
  if (regex.test(inputString)) {
    response = {
      text: "Dạ! không có gì đâu ạ",
    };

    callSendAPI(sender_psid, response);
    return 1;
  }

  // emoji

  regex = /chuc|ngu ngon/i;
  if (regex.test(inputString)) {
    response = {
      text: "Em cảm ơn",
    };
    await callSendAPI(sender_psid, response);
    response = {
      text: `Chúc ${pronouns} ngủ ngon ạ 🩷`,
    };
    await callSendAPI(sender_psid, response);
    return 1;
  }

  regex = /bai bai|tam biet|cut|bien|bye/i;
  if (regex.test(inputString)) {
    response = {
      text: "Vâng ạ",
    };

    callSendAPI(sender_psid, response);
    return 1;
  }

  regex = /may la|gioi thieu|bac la|ai day/i;
  if (regex.test(inputString)) {
    response = {
      text: `Em là pet của anh Minh Phạm 🩷`,
    };

    callSendAPI(sender_psid, response);
    return 1;
  }

  regex = /yeu bac|yeu|love/i;
  if (regex.test(inputString)) {
    response = {
      text: `Yêu ${pronouns} 🩷`,
    };

    callSendAPI(sender_psid, response);
    return 1;
  }

  regex = /chao|halu|hello|helo/i;
  if (regex.test(inputString)) {
    response = {
      text: `Há lu ${pronouns} 🩷`,
    };

    callSendAPI(sender_psid, response);
    return 1;
  }

  // từ lần sau khi đăng nhập
  else {
    response = {
      text: `À lú! ${pronouns} muốn Bấc làm gì nào?`,
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
  await crawl.getData(data.id, data.pass, data.idsender);
}

module.exports = {
  getHomePage: getHomePage,
  getWebHook: getWebHook,
  postWebHook: postWebHook,
  callSendAPI: callSendAPI,
};
