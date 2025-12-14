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

/* ---------------------------
   ORDER ROUTES (ORDER MATTERS)
------------------------------*/

// 1. Create Order
router.post("/", authEither, createOrder);

// 2. Get all orders (admin only)
router.get("/", authEither, getAllOrders);  // <-- must be ABOVE /:id

// 3. User's personal orders
router.get("/my", authEither, getMyOrders);

// 4. Get single order
router.get("/:id", authEither, getOrderById);

// 5. Update status (admin)
router.patch("/:id/status", authEither, updateOrderStatus);

// 6. Cancel order (user)
router.patch("/:id/cancel", authEither, cancelMyOrder);


/* ---------------------------
   SHIPPING ADDRESS ROUTES
------------------------------*/
router.post("/:orderId/address", authEither, createShippingAddress);
router.patch("/:orderId/address", authEither, updateShippingAddress);
router.get("/:orderId/address", authEither, getShippingAddress);
router.delete("/:orderId/address", authEither, deleteShippingAddress);


/* ---------------------------
   PAYMENT ROUTES
------------------------------*/
router.post("/:orderId/payment", authEither, createPayment);
router.patch("/:orderId/payment/status", authEither, updatePaymentStatus);
router.get("/:orderId/payment", authEither, getPaymentByOrder);
router.patch("/:orderId/payment/refund", authEither, refundPayment);

export default router;
