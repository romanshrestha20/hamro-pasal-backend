import express from "express";

import {
  createShippingAddress,
  updateShippingAddress,
  getShippingAddress,
  deleteShippingAddress,
} from "../controllers/shippingAddressController.js";
import { authEither } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Shipping Address
router.post("/", authEither, createShippingAddress);
router.patch("/:id", authEither, updateShippingAddress);
router.get("/", authEither, getShippingAddress);
router.delete("/:id", authEither, deleteShippingAddress);

export default router;
