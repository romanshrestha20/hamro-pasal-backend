// routes/authRoutes.js
import express from "express";
import {
  registerUser,
  loginUser,
  changeUserPassword,
  logoutUser,
  getCurrentUser,
} from "../controllers/authController.js";
import { googleAuth } from "../controllers/googleAuthController.js";
import { authenticate } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Auth routes
router.post("/register", registerUser); // Register user
router.post("/login", loginUser); // Login user
router.post("/google", googleAuth);
router.put("/change-password", authenticate, changeUserPassword); // Change user password
router.post("/logout", authenticate, logoutUser); // Logout user
router.get("/me", authenticate, getCurrentUser); // Get current user
export default router;
