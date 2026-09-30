import mongoose, { model, Schema } from "mongoose";

const sessionSchema = new Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: [true, "User reference is required"],
    },
    refreshToken: {
      type: String,
      required: [true, "Refresh token is required"],
    },
    ip: {
      type: String,
      required: [true, "IP address is required"],
    },
    userAgent: {
      type: String,
      required: [true, "User agent is required"],
    },
    revoked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

const sessionModel = model("session", sessionSchema);

export default sessionModel;
