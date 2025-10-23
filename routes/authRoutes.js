// routes/authRoutes.js
import express from "express";
import {
  registerUser,
  loginUser,
  changeUserPassword,
  logoutUser,
  getCurrentUser,
} from "../controllers/authController.js";
import { authenticate } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Auth routes
router.post("/register", registerUser); // Register user
router.post("/login", loginUser); // Login user
router.put("/:id/change-password", authenticate, changeUserPassword); // Change user password
router.post("/logout", authenticate, logoutUser); // Logout user
router.get("/me", authenticate, getCurrentUser); // Get current user
export default router;
