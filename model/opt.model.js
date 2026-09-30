import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: [true, "User reference is required"],
    },
    otpHash: {
        type: String,
        required: [true, "OTP hash is required"],
    },
  },
  {
    timestamps: true,
  }
);

const otpModel = mongoose.model("otp", otpSchema);

export default otpModel;