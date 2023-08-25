import mongoose from "mongoose";

const { Schema } = mongoose; // Sử dụng destructuring để lấy Schema từ mongoose

const userSchema = new Schema({
  id: Schema.Types.ObjectId,
  username: {
    type: String,
  },
  confirm: {
    type: Number,
    default: 0,
  },
  password: {
    type: String,
  },
  sender_id: {
    type: String,
    unique: true,
  },
  gender: {
    type: String,
    default: "male",
  },
});

const User = mongoose.model("Users", userSchema);

export default User;
