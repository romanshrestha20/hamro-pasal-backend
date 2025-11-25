import express from "express";
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  searchProducts,
  getAllCategories,
  getProductsbyCategory,
  createCategory,
} from "../controllers/productController.js";
import { upload } from "../utils/uploads.js";

import { authEither, authorizeAdmin } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Public routes
router.get("/", getProducts);

// Category routes (MUST come before /:id to avoid conflicts)
router.get("/categories", getAllCategories);
router.post(
  "/categories",
  authEither,
  authorizeAdmin,
  upload.array("images", 10),
  createCategory
);
router.get("/category/:categoryId", getProductsbyCategory);

// Search route (MUST come before /:id)
router.get("/search/:query", searchProducts);

// Dynamic routes (MUST come last)
router.get("/:id", getProductById);

// Admin-only routes
router.post("/", authEither, authorizeAdmin, createProduct);
router.put("/:id", authEither, authorizeAdmin, updateProduct);
router.delete("/:id", authEither, authorizeAdmin, deleteProduct);

export default router;
