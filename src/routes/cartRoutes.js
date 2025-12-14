import express from "express";
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
} from "../controllers/cartController.js";
import { authEither } from "../middlewares/authMiddleware.js";

const router = express.Router();

// All cart routes require authentication
router.use(authEither);

// Get user's cart
router.get("/", getCart);

// Add item to cart (or increment if exists)
router.post("/add", addToCart);

// Update cart item quantity
router.patch("/item/:itemId", updateCartItem);

// Remove item from cart
router.delete("/item/:itemId", removeFromCart);

// Clear entire cart
router.delete("/", clearCart);

export default router;
