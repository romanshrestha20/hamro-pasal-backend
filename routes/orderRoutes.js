import express from "express";
import {
  createOrder,
  getMyOrders,
  getOrderById,
  getAllOrders,
  updateOrderStatus,
  cancelMyOrder,
} from "../controllers/orderController.js";

import {
  createShippingAddress,
  updateShippingAddress,
  getShippingAddress,
  deleteShippingAddress,
} from "../controllers/shippingAddressController.js";

import {
  createPayment,
  updatePaymentStatus,
  getPaymentByOrder,
  refundPayment,
} from "../controllers/paymentController.js";
import { authEither } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Orders
router.post("/", authEither, createOrder);
router.get("/my", authEither, getMyOrders);
router.get("/:id", authEither, getOrderById);
router.get("/", authEither, getAllOrders);
router.patch("/:id/status", authEither, updateOrderStatus);
router.patch("/:id/cancel", authEither, cancelMyOrder);

// Shipping Address
router.post("/:orderId/address", authEither, createShippingAddress);
router.patch("/:orderId/address", authEither, updateShippingAddress);
router.get("/:orderId/address", authEither, getShippingAddress);
router.delete("/:orderId/address", authEither, deleteShippingAddress);

// Payment
router.post("/:orderId/payment", authEither, createPayment);
router.patch("/:orderId/payment/status", authEither, updatePaymentStatus);
router.get("/:orderId/payment", authEither, getPaymentByOrder);
router.patch("/:orderId/payment/refund", authEither, refundPayment);

export default router;
