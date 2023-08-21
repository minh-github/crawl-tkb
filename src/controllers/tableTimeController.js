import path from "path";
import fs from "fs";

const storagePath = path.join(__dirname, "../storage");

const getTableTime = async (isDate, ID_SENDER = "") => {
  try {
    const jsonData = await getDataRaw(ID_SENDER);
    let response = jsonData
      .map((subject) => {
        let daysBetween = subject.daysBetween
          .map((item) => {
            let days = item.days
              .map((day) => {
                if (day.day == isDate) {
                  return { lesson: day.lesson, room: day.room };
                }
              })
              .filter((item) => item !== undefined);
            if (days.length > 0) {
              return { days };
            }
          })
          .filter((item) => item !== undefined);
        if (daysBetween.length > 0) {
          return {
            subject: subject.subject,
            lecturers: subject.lecturers,
            tableTime: daysBetween,
          };
        }
      })
      .filter((item) => item !== undefined);
    return response;
  } catch (error) {
    console.error("Có lỗi:", error);
  }
};

async function getDataRaw(ID_SENDER = "") {
  try {
    const data = fs.readFileSync(
      storagePath + `/${ID_SENDER}dataFormmat.json`,
      "utf8"
    );
    return JSON.parse(data);
  } catch (err) {
    console.error("Lỗi khi đọc hoặc phân tích JSON:", err);
    return false;
  }
}

module.exports = {
  getTableTime: getTableTime,
};
