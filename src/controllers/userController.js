import User from "../models/user";

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
module.exports = {
  addUser: addUser,
};
