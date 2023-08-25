import User from "../models/user";
import axios from "axios";
require("dotenv").config();
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

let addUser = async (username, password, sender_id) => {
  try {
    const newUser = new User({
      username: username,
      password: password,
      sender_id: sender_id,
    });
    await newUser.save();
    res.status(200).json({ success: "Lấy dữ liệu thành công" });
  } catch (err) {
    console.error("Error saving user:", err);
    res.status(500).json({ error: err.message });
  }
};

let getUserFbInfo = async (sender_id) => {
  try {
    let url = `https://graph.facebook.com/${sender_id}?fields=first_name,last_name,gender&access_token=${PAGE_ACCESS_TOKEN}`;
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error("Error fetching data:", error.message);
    return error.message;
  }
};

let checkGender = async (gender = "none", uppercase = false) => {
  if (gender == "male") return uppercase ? "Anh" : "anh";
  if (gender == "female") return uppercase ? "Chị" : "chị";
  else return uppercase ? "Bạn" : "bạn";
};

module.exports = {
  addUser: addUser,
  getUserFbInfo: getUserFbInfo,
  checkGender: checkGender,
};
