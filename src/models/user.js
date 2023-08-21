import mongoose from "mongoose";

const { Schema } = mongoose; // Sử dụng destructuring để lấy Schema từ mongoose

const userSchema = new Schema({
  id: Schema.Types.ObjectId,
  username: {
    type: String,
  },
  password: {
    type: String,
  },
  sender_id: {
    type: String,
    unique: true,
  },
});

const User = mongoose.model("Users", userSchema);

export default User;
