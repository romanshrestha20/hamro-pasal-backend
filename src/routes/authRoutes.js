// routes/authRoutes.js
import express from "express";
import {
  registerUser,
  loginUser,
  changeUserPassword,
  logoutUser,
  getCurrentUser,
  forgotPassword,
  resetPassword,
  verifyOtp,
} from "../controllers/authController.js";
import { googleAuth } from "../controllers/googleAuthController.js";
import { authEither } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Auth routes
router.post("/register", registerUser); // Register user
router.post("/login", loginUser); // Login user
router.post("/google", googleAuth);
router.post("/forgot-password", forgotPassword); // Request password reset
router.post("/verify-otp", verifyOtp);
router.post("/reset-password", resetPassword); // Reset password with token
router.put("/change-password", authEither, changeUserPassword); // Change user password
router.post("/logout", authEither, logoutUser); // Logout user
router.get("/me", authEither, getCurrentUser); // Get current user
export default router;
