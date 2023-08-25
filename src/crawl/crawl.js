import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import moment from "moment";
import request from "request";
require("dotenv").config();
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

const storagePath = path.join(__dirname, "../storage");

const getData = async (
  ID = "DTC2054801030009",
  PASS = "02/08/2002",
  ID_SENDER = ""
) => {
  // Khởi tạo trình duyệt
  const browser = await puppeteer.launch({ headless: true });

  // Mở trang web
  const page = await browser.newPage();

  page.on("dialog", async (dialog) => {
    await dialog.dismiss();
  });

  await page.goto(
    "http://220.231.119.171/kcntt/(S(quqbahvkzmcqwhe2mzdxk44x))/login.aspx"
  );

  const name = "#txtUserName";
  const pass = "#txtPassword";
  const submit = "#btnSubmit";
  const dataRaw = [];

  await page.waitForSelector(name);
  await page.waitForSelector(pass);
  await page.waitForSelector(submit);

  await page.type(name, ID, { delay: 50 });
  await page.type(pass, PASS, { delay: 50 });
  await page.waitForTimeout(500);
  await page.click(submit);
  await page.waitForNavigation();

  const elementContents = await page.$$eval(
    "#gridRegistered > tbody > .cssRangeItem3",
    (elements) => {
      return elements.map((element, index) => {
        const id = index;
        const id_subject = `#gridRegistered_lblCourseClass_${index}`;
        const id_table_time = `#gridRegistered_lblLongTime_${index}`;
        const id_room = `#gridRegistered_lblLocation_${index}`;
        const id_lecturers = `#gridRegistered_lblInstructor_${index}`;

        const subject =
          element.querySelector(id_subject)?.textContent?.trim() || "";
        const room = element.querySelector(id_room)?.textContent?.trim() || "";
        const table_time =
          element.querySelector(id_table_time)?.textContent?.trim() || "";
        const lecturers =
          element.querySelector(id_lecturers)?.textContent?.trim() || "";

        return { id, subject, room, table_time, lecturers };
      });
    }
  );
  console.log(elementContents);
  if (elementContents.length > 0) {
    fs.writeFileSync(
      storagePath + `/${ID_SENDER}rawData.json`,
      JSON.stringify(elementContents, null, 2)
    );
    console.log("Nội dung đã lưu thành JSON");
    await handelData(ID_SENDER);
  } else {
    console.log("không có file trên dktc");
    let response = {
      text: "Nhưng trên dktc không có dữ liệu",
    };

    callSendAPI(ID_SENDER, response);
  }
  await browser.close();
};

async function handelData(ID_SENDER) {
  try {
    const jsonData = await getDataRaw(ID_SENDER);
    await readJson(jsonData, ID_SENDER);
  } catch (error) {
    console.error("Có lỗi:", error);
  }
}

async function getDataRaw(ID_SENDER) {
  try {
    const data = fs.readFileSync(
      storagePath + `/${ID_SENDER}rawData.json`,
      "utf8"
    );
    return JSON.parse(data);
  } catch (err) {
    console.error("Lỗi khi đọc hoặc phân tích JSON:", err);
    return false;
  }
}

async function readJson(data, ID_SENDER = "") {
  let _data = data.map((item, index) => {
    let subject = item.subject;
    let lecturers = item.lecturers.split("(")[0].trim();
    let timeRaw = item.table_time.split("Từ ").filter((item) => item !== "");
    let room = [{}];
    if (item.room.includes("(")) {
      let sliceType = item.room
        .replace("(CLC)", "")
        .split("(")
        .filter((item) => item !== "");
      room = sliceType.map((item) => {
        return { type: item.split(")")[0], room: item.split(")")[1] };
      });
    } else {
      room[0].type = "0";
      room[0].room = item.room;
    }
    let dataTime = timeRaw.map((item) => {
      let timeBetween = item.split(": (")[0];
      let dayOfWeek = item.split(": (")[1];
      let type = dayOfWeek[0];
      dayOfWeek = dayOfWeek.split("Thứ");
      let lesson = dayOfWeek.filter((item) => item.includes("tiết"));
      lesson = lesson.map((item) => {
        return item.trim();
      });
      dayOfWeek = dayOfWeek
        .filter((item) => item.includes("tiết"))
        .map((item) => item.trim().split(" ")[0]);
      let dataOfWeek = {
        type: type,
        timeBetween: timeBetween,
        dayOfWeek: dayOfWeek,
        lesson: lesson,
      };
      return { dataOfWeek };
    });
    let daysBetween = dataTime.map((item) => {
      let type = item.dataOfWeek.type;
      const days = [];
      const format = "DD/MM/YYYY";
      const startDate = moment(
        item.dataOfWeek.timeBetween.substring(0, 10),
        format
      );
      const endDate = moment(item.dataOfWeek.timeBetween.slice(-10), format);
      const currentDay = startDate.clone();
      while (currentDay.isSameOrBefore(endDate)) {
        const date = moment(currentDay.format(format), "DD/MM/YYYY").day() + 1;
        if (item.dataOfWeek.dayOfWeek.includes(date.toString())) {
          let lesson = item.dataOfWeek.lesson
            .filter((item) => {
              return parseInt(item[0], 10) === date;
            })
            .map((item) => {
              return item.substring(1).trim();
            });

          let sliceRoom = room
            .map((item) => {
              if (item.type.includes(type) || item.type == "0")
                return item.room;
            })
            .filter((item) => item !== undefined);

          let resRoom = sliceRoom.map((item) => {
            if (item.includes("[")) {
              let temp = item.split("[");
              temp = temp.filter((item) => item !== "");
              let day = temp
                .map((item) => {
                  if (item.includes("T" + date)) return item;
                })
                .filter((item) => item !== undefined);
              return { room: day };
            }
            return { room: [item] };
          });
          let temp = {
            day: currentDay.format(format),
            lesson: lesson,
            room: resRoom[0].room[0],
          };
          days.push(temp);
        }
        currentDay.add(1, "days");
      }
      return { type, days };
    });
    return { subject, lecturers, daysBetween };
  });
  fs.writeFileSync(
    storagePath + `/${ID_SENDER}dataFormmat.json`,
    JSON.stringify(_data, null, 2)
  );
}

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

module.exports = {
  getData: getData,
};
