import userModel from "../model/user.model.js";
import sessionModel from "../model/session.model.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import config from "../config/config.js";

// REGISTER
export async function register(req, res) {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        message: "Username, email and password are required",
      });
    }

    const existingUser = await userModel.findOne({
      $or: [{ username }, { email }],
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Username or Email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await userModel.create({
      username,
      email,
      password: hashedPassword,
    });

    const refreshToken = jwt.sign(
      {
        userId: user._id,
      },
      config.REFRESH_TOKEN_SECRET,
      {
        expiresIn: "7d",
      },
    );

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    // Create session
    const session = await sessionModel.create({
      user: user._id,
      refreshToken: refreshTokenHash,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      revoked: false,
    });

    const accessToken = jwt.sign(
      {
        userId: user._id,
        sessionId: session._id,
      },
      config.ACCESS_TOKEN_SECRET,
      {
        expiresIn: "15m",
      },
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: config.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({
      message: "User registered successfully",
      accessToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Register Error:", error);
    return res.status(500).json({
      message: "Server error",
    });
  }
}

// LOGIN
export async function login(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        message: "Username and password are required",
      });
    }

    const user = await userModel.findOne({ username });

    if (!user) {
      return res.status(401).json({
        message: "Invalid username or password",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: "Invalid username or password",
      });
    }

    const refreshToken = jwt.sign(
      {
        userId: user._id,
      },
      config.REFRESH_TOKEN_SECRET,
      {
        expiresIn: "7d",
      },
    );

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    const session = await sessionModel.create({
      user: user._id,
      refreshToken: refreshTokenHash,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      revoked: false,
    });

    const accessToken = jwt.sign(
      {
        userId: user._id,
        sessionId: session._id,
      },
      config.ACCESS_TOKEN_SECRET,
      {
        expiresIn: "15m",
      },
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: config.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      message: "Login successful",
      accessToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({
      message: "Server error",
    });
  }
}

// REFRESH TOKEN
export async function refreshToken(req, res) {
  try {
    const oldRefreshToken = req.cookies.refreshToken;

    if (!oldRefreshToken) {
      return res.status(401).json({
        message: "Refresh token not found",
      });
    }

    const decoded = jwt.verify(oldRefreshToken, config.REFRESH_TOKEN_SECRET);

    const session = await sessionModel.findOne({
      user: decoded.userId,
      revoked: false,
    });

    if (!session) {
      return res.status(401).json({
        message: "Invalid refresh token",
      });
    }

    const isValid = await bcrypt.compare(oldRefreshToken, session.refreshToken);

    if (!isValid) {
      return res.status(401).json({
        message: "Invalid refresh token",
      });
    }

    const newRefreshToken = jwt.sign(
      {
        userId: decoded.userId,
      },
      config.REFRESH_TOKEN_SECRET,
      {
        expiresIn: "7d",
      },
    );

    const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 10);

    session.refreshToken = newRefreshTokenHash;

    await session.save();

    const newAccessToken = jwt.sign(
      {
        userId: decoded.userId,
        sessionId: session._id,
      },
      config.ACCESS_TOKEN_SECRET,
      {
        expiresIn: "15m",
      },
    );

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: config.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      message: "Token refreshed successfully",
      accessToken: newAccessToken,
    });
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired refresh token",
    });
  }
}

// GET ME
export async function getMe(req, res) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Access token not found",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, config.ACCESS_TOKEN_SECRET);
    log("Decoded Token:", decoded); // Debugging line to check the decoded token
    const session = await sessionModel.findOne({
      user: decoded.userId,
      revoked: false,
    });

    if (!session) {
      return res.status(401).json({
        message: "Session not found",
      });
    }

    const user = await userModel.findById(decoded.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      message: "User fetched successfully",
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired access token",
    });
  }
}

export async function logout(req, res) {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token not found" });
    }

    const decoded = jwt.verify(refreshToken, config.REFRESH_TOKEN_SECRET);

    const session = await sessionModel.findOne({
      user: decoded.userId,
      revoked: false,
    });

    if (!session) {
      return res.status(400).json({ message: "Invalid refresh token" });
    }

    const isValid = await bcrypt.compare(refreshToken, session.refreshToken);

    if (!isValid) {
      return res.status(400).json({ message: "Invalid refresh token" });
    }

    session.revoked = true;
    await session.save();

    res.clearCookie("refreshToken");
    res.status(200).json({ message: "Logout successfully" });
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired access token",
    });
  }
}

export async function logoutAll(req, res) {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token not found" });
    }

    const decoded = jwt.verify(refreshToken, config.REFRESH_TOKEN_SECRET);

    const session = await sessionModel.findOne({
      user: decoded.userId,
      revoked: false,
    });

    if (!session) {
      return res.status(400).json({
        message: "Invalid refresh token",
      });
    }

    const isValid = await bcrypt.compare(refreshToken, session.refreshToken);

    if (!isValid) {
      return res.status(400).json({
        message: "Invalid refresh token",
      });
    }

    await sessionModel.updateMany(
      {
        user: decoded.userId,
        revoked: false,
      },
      {
        $set: {
          revoked: true,
        },
      },
    );

    res.clearCookie("refreshToken");
    res.status(200).json({ message: "Logged out of all devices" });
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired access token",
    });
  }
}
