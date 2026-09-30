import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";

const authRouter = Router();

authRouter.post("/register", authController.register);
authRouter.post("/login", authController.login);
authRouter.post("/refresh-token", authController.refreshToken);
authRouter.get("/getMe", authController.getMe);
authRouter.post("/logout", authController.logout);
authRouter.post("/logout-all", authController.logoutAll);
authRouter.get("/verify-email", authController.verifyEmail);

export default authRouter;
