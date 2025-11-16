// routes/authRoutes.js
import express from "express";
import {
  createReview,
  getProductReviews,
  deleteReview,
  getReviewById,
  updateReviewById,
  likeReview,
  unLikeReview,
} from "../controllers/reviewController.js";

import {
  createReply,
  getReviewReplies,
  deleteReply,
  updateReply,
  likeReply,
  unlikeReply,
} from "../controllers/replyController.js";

import { authEither, authorizeAdmin } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Review routes
router.post("/", authEither, createReview); // Create a review
router.get("/product/:productId", getProductReviews); // Get reviews for a product
router.get("/:reviewId", getReviewById); // Get review by ID
router.put("/:reviewId", authEither, updateReviewById); // Update
router.delete("/:reviewId", authEither, deleteReview); // Delete a review
router.post("/:reviewId/like", authEither, likeReview);
router.post("/:reviewId/unlike", authEither, unLikeReview);

// Reply routes
router.post("/:reviewId/replies", authEither, createReply); // Create a reply to a review
router.get("/:reviewId/replies", getReviewReplies); // Get replies for a review
router.put("/replies/:replyId", authEither, updateReply); // Update a reply
router.delete("/replies/:replyId", authEither, deleteReply); // Delete a reply
router.post("/replies/:replyId/like", authEither, likeReply);
router.post("/replies/:replyId/unlike", authEither, unlikeReply);

export default router;
