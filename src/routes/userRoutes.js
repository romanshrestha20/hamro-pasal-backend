import express from "express";
import {
  getAllUsers,
  getUserById,
  deleteUser,
  updateUser,
  uploadUserProfileImage,
  removeUserProfileImage,
} from "../controllers/usersController.js";

import { authEither, authorizeAdmin } from "../middlewares/authMiddleware.js";
import { upload } from "../utils/uploads.js";

const router = express.Router();

// Admin-only route: must authenticate (cookie or header) first
router.get("/all", authEither, authorizeAdmin, getAllUsers);

// Image routes (more specific - must come before /:id routes)
router.post(
  "/upload",
  authEither,
  upload.single("image"),
  uploadUserProfileImage
);
router.delete("/image", authEither, removeUserProfileImage);

// Protect user routes: allow auth via cookie or header
router.get("/:id", authEither, getUserById);
router.put("/:id", authEither, updateUser);
router.delete("/:id", authEither, deleteUser);

export default router;
