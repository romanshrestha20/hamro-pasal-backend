import { Router } from "express";
import {
  createOrder,
  getMyOrders,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  cancelMyOrder,
} from "../controllers/orderController.js";
import { authEither, authorizeAdmin } from "../middlewares/authMiddleware.js";

const router = Router();

// Create an order (authenticated user)
router.post("/", authEither, createOrder);

// Get current user's orders
router.get("/my", authEither, getMyOrders);

// Get all orders (admin only)
router.get("/", authEither, authorizeAdmin, getAllOrders);

// Get order by id (owner or admin)
router.get("/:id", authEither, getOrderById);

// Update order status (admin only)
router.patch("/:id/status", authEither, authorizeAdmin, updateOrderStatus);

// Cancel my order (owner only, pending status)
router.patch("/:id/cancel", authEither, cancelMyOrder);

export default router;
