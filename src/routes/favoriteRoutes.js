import { Router } from "express";
import {
  addToFavorites,
  getMyFavorites,
  getMyFavoriteByProduct,
  removeFromFavorites,
  getAllFavorites,
  toggleFavorite,
} from "../controllers/favoriteController.js";
import { authEither, authorizeAdmin } from "../middlewares/authMiddleware.js";

const router = Router();

// Add product to favorites
router.post("/", authEither, addToFavorites);

// Get current user's favorites
router.get("/", authEither, getMyFavorites);

// Get a specific favorite by productId
router.get("/:productId", authEither, getMyFavoriteByProduct);

// Remove from favorites
router.delete("/:productId", authEither, removeFromFavorites);

// Toggle favorite
router.post("/:productId/toggle", authEither, toggleFavorite);

// Admin: list all favorites across users
router.get("/admin/all", authEither, authorizeAdmin, getAllFavorites);

export default router;
