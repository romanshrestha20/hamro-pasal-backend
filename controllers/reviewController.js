import { prisma } from "../lib/prismaClient.js";
import { AppError } from "../utils/AppError.js";

/*************************************************
 * Helper: Calculate and update product rating
 *************************************************/
const calculateProductRating = async (productId) => {
  const reviews = await prisma.review.findMany({
    where: { productId },
    select: { rating: true },
  });

  if (!reviews.length) return 0;
  const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  return Number(avg.toFixed(2));
};

/*************************************************
 * CREATE REVIEW
 *************************************************/
export const createReview = async (req, res, next) => {
  try {
    const { productId, rating, comment, title, images = [] } = req.body;
    const userId = req?.user?.id;

    if (!userId) throw new AppError("Unauthorized", 401);
    if (!productId) throw new AppError("Product ID is required", 400);
    if (rating == null) throw new AppError("Rating is required", 400);

    if (rating < 1 || rating > 5)
      throw new AppError("Rating must be between 1–5", 400);

    if (title && title.length > 255)
      throw new AppError("Title cannot exceed 255 characters", 400);

    if (comment && comment.length > 1000)
      throw new AppError("Comment cannot exceed 1000 characters", 400);

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, isActive: true },
    });

    if (!product || !product.isActive) {
      throw new AppError("Product not found or inactive", 404);
    }

    const existingReview = await prisma.review.findFirst({
      where: { productId, userId },
    });

    if (existingReview)
      throw new AppError("You have already reviewed this product", 400);

    const createdReview = await prisma.review.create({
      data: {
        productId,
        userId,
        rating,
        comment,
        title,
        images: images.length
          ? {
              create: images.map((url) => ({ url })),
            }
          : undefined,
      },
      include: { images: true },
    });

    const averageRating = await calculateProductRating(productId);

    await prisma.product.update({
      where: { id: productId },
      data: { rating: averageRating },
    });

    res.status(201).json(createdReview);
  } catch (error) {
    next(error);
  }
};

/*************************************************
 * GET REVIEW BY ID
 *************************************************/
export const getReviewById = async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const userId = req?.user?.id;

    if (!reviewId) throw new AppError("Review ID is required", 400);

    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        images: true,
        likes: true,
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                image: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!review) throw new AppError("Review not found", 404);

    res.status(200).json({
      ...review,
      likesCount: review.likes.length,
      likedByUser: userId
        ? review.likes.some((like) => like.userId === userId)
        : false,
    });
  } catch (error) {
    next(error);
  }
};

/*************************************************
 * GET ALL REVIEWS FOR A PRODUCT
 *************************************************/
export const getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const userId = req?.user?.id;

    if (!productId) throw new AppError("Product ID is required", 400);

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!product) throw new AppError("Product not found", 404);

    const reviews = await prisma.review.findMany({
      where: { productId },
      include: {
        images: true,
        likes: true,
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                image: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = reviews.map((review) => ({
      ...review,
      likesCount: review.likes.length,
      likedByUser: userId
        ? review.likes.some((like) => like.userId === userId)
        : false,
    }));

    res.status(200).json(formatted);
  } catch (error) {
    next(error);
  }
};

/*************************************************
 * DELETE REVIEW
 *************************************************/
export const deleteReview = async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const userId = req?.user?.id;

    if (!userId) throw new AppError("Unauthorized", 401);

    const review = await prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) throw new AppError("Review not found", 404);
    if (review.userId !== userId)
      throw new AppError("You can only delete your own reviews", 403);

    await prisma.review.delete({ where: { id: reviewId } });

    const newRating = await calculateProductRating(review.productId);

    await prisma.product.update({
      where: { id: review.productId },
      data: { rating: newRating },
    });

    res.status(200).json({ message: "Review deleted successfully" });
  } catch (error) {
    next(error);
  }
};

/*************************************************
 * UPDATE REVIEW
 *************************************************/
export const updateReviewById = async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const userId = req?.user?.id;
    const { rating, comment, title, images = [] } = req.body;

    if (!userId) throw new AppError("Unauthorized", 401);

    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: { images: true },
    });

    if (!review) throw new AppError("Review not found", 404);
    if (review.userId !== userId)
      throw new AppError("You can only update your own reviews", 403);

    if (rating != null && (rating < 1 || rating > 5))
      throw new AppError("Rating must be 1–5", 400);

    if (comment && comment.length > 1000)
      throw new AppError("Comment cannot exceed 1000 characters", 400);

    // Delete old images, add new ones
    await prisma.image.deleteMany({ where: { reviewId } });

    if (images.length) {
      await prisma.image.createMany({
        data: images.map((url) => ({ reviewId, url })),
      });
    }

    const updatedReview = await prisma.review.update({
      where: { id: reviewId },
      data: {
        rating: rating ?? review.rating,
        comment: comment ?? review.comment,
        title: title ?? review.title,
      },
      include: { images: true },
    });

    const newRating = await calculateProductRating(review.productId);

    await prisma.product.update({
      where: { id: review.productId },
      data: { rating: newRating },
    });

    res.status(200).json(updatedReview);
  } catch (error) {
    next(error);
  }
};

/*************************************************
 * GET USER'S OWN REVIEWS
 *************************************************/
export const getMyReviews = async (req, res, next) => {
  try {
    const userId = req?.user?.id;
    if (!userId) throw new AppError("Unauthorized", 401);

    const reviews = await prisma.review.findMany({
      where: { userId },
      include: { product: true },
    });

    res.status(200).json(reviews);
  } catch (error) {
    next(error);
  }
};

/*************************************************
 * TOGGLE REVIEW LIKE (like/unlike combined)
 *************************************************/
export const toggleReviewLike = async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const userId = req?.user?.id;

    if (!userId) throw new AppError("Unauthorized", 401);

    const review = await prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) throw new AppError("Review not found", 404);

    // Check if a like exists
    const existingLike = await prisma.reviewLike.findFirst({
      where: { reviewId, userId },
    });

    let liked = false;

    if (existingLike) {
      // UNLIKE
      await prisma.reviewLike.delete({
        where: { id: existingLike.id },
      });
      liked = false;
    } else {
      // LIKE
      await prisma.reviewLike.create({
        data: { reviewId, userId },
      });
      liked = true;
    }

    const likeCount = await prisma.reviewLike.count({
      where: { reviewId },
    });

    res.status(200).json({ liked, likeCount });
  } catch (error) {
    next(error);
  }
};

