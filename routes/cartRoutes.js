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
router.post("/items", addToCart);

// Update cart item quantity
router.put("/items", updateCartItem);

// Remove item from cart
router.delete("/items", removeFromCart);

// Clear entire cart
router.delete("/", clearCart);

export default router;
