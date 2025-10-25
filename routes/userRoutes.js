import express from "express";
import {
  getAllUsers,
  getUserById,
  deleteUser,
  updateUser,
  uploadUserProfileImage,
} from "../controllers/usersController.js";

import { authEither, authorizeAdmin } from "../middlewares/authMiddleware.js";
import { upload } from "../utils/uploads.js";

const router = express.Router();

// Admin-only route: must authenticate (cookie or header) first
router.get("/all", authEither, authorizeAdmin, getAllUsers);

// Protect user routes: allow auth via cookie or header
router.get("/:id", authEither, getUserById);
router.put("/:id", authEither, updateUser);
router.delete("/:id", authEither, deleteUser);

// image upload
router.post(
  "/upload",
  authEither,
  upload.single("image"),
  uploadUserProfileImage
);

export default router;
