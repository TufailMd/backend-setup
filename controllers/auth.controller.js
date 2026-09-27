import userModel from "../model/user.model.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import config from "../config/config.js";

export async function register(req, res) {
  console.log(req.body);
  
  const { username, email, password } = req.body;
  const existingUser = await userModel.findOne({
    $or: [{ username }, { email }],
  });

  if (existingUser) {
    return res
      .status(409)
      .json({ message: "Username or Email already exists" });
  }

  const hashedPassword = crypto
    .createHash("sha256")
    .update(password)
    .digest("hex");

  const user = await userModel.create({
    username,
    email,
    password: hashedPassword,
  });

  const token = jwt.sign({ id: user._id }, config.jwt_secret, {
    expiresIn: "1d",
  });

  res.status(201).json({
    message: "User registered successfully",
    data: { username: user.username, email: user.email, token },
  });
}
