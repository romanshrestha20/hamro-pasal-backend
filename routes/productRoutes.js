import express from "express";
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  searchProducts,
  getAllCategories,
  createCategory,
} from "../controllers/productController.js";

import { authEither, authorizeAdmin } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Public routes
router.get("/", getProducts);
router.get("/:id", getProductById);
router.get("/search/:query", searchProducts);

// Category routes
router.get("/categories", getAllCategories);
router.post("/categories", authEither, authorizeAdmin, createCategory);

// Admin-only routes
router.post("/", authEither, authorizeAdmin, createProduct);
router.put("/:id", authEither, authorizeAdmin, updateProduct);
router.delete("/:id", authEither, authorizeAdmin, deleteProduct);

export default router;
