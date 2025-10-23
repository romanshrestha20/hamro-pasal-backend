import express from "express";
import {
  getAllUsers,
  getUserById,
  deleteUser,
  updateUser,
  uploadUserProfileImage,
} from "../controllers/usersController.js";

import { authenticate, authorizeAdmin } from "../middlewares/authMiddleware.js";
import { upload } from "../utils/uploads.js";

const router = express.Router();

// Admin-only route: must authenticate first
router.get("/all", authenticate, authorizeAdmin, getAllUsers);

// Protect  user routes: optional, but usually you want only the owner or admin
router.get("/:id", authenticate, getUserById);
router.put("/:id", authenticate, updateUser);
router.delete("/:id", authenticate, deleteUser);

// image upload
router.post(
  "/upload",
  authenticate,
  upload.single("image"),
  uploadUserProfileImage
);

export default router;
