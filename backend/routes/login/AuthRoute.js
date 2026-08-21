import express from "express";
import {
  postLogin,
  deleteLogout,
  getLoginAttemptStatus,
  sessionEvents,
  sendRegisterEmailOtp,
  sendForgotPasswordEmailOtp,
  verifyForgotPasswordEmailOtp,
  resetForgotPassword,
} from "../../controllers/login/Auth.js";
import { registerPeserta } from "../../controllers/login/Users.js";
import { verifyToken, verifyUser } from "../../middleware/verify.js";

const router = express.Router();

router.post("/login", postLogin);
router.post("/auth/login", postLogin);
router.delete("/logout", deleteLogout);
router.delete("/auth/logout", deleteLogout);
router.post("/logout", deleteLogout);
router.post("/auth/logout", deleteLogout);
router.post("/register", registerPeserta);
router.post("/auth/register", registerPeserta);
router.post("/otp/register/send", sendRegisterEmailOtp);
router.post("/auth/otp/register/send", sendRegisterEmailOtp);
router.post("/otp/forgot-password/send", sendForgotPasswordEmailOtp);
router.post("/auth/otp/forgot-password/send", sendForgotPasswordEmailOtp);
router.post("/otp/forgot-password/verify", verifyForgotPasswordEmailOtp);
router.post("/auth/otp/forgot-password/verify", verifyForgotPasswordEmailOtp);
router.post("/forgot-password/reset", resetForgotPassword);
router.post("/auth/forgot-password/reset", resetForgotPassword);
router.get("/login/attempts", verifyToken, verifyUser, getLoginAttemptStatus);
router.get("/auth/login-attempt", verifyToken, verifyUser, getLoginAttemptStatus);
router.get("/session/events", sessionEvents);
router.get("/auth/session-events", sessionEvents);

export default router;
