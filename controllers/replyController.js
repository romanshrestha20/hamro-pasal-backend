import { prisma } from "../lib/prismaClient.js";
import { AppError } from "../utils/AppError.js";

/******************************************
 * CREATE A REPLY
 ******************************************/
export const createReply = async (req, res, next) => {
  try {
    const { reviewId, comment } = req.body;
    const userId = req?.user?.id;

    if (!userId) throw new AppError("Unauthorized", 401);
    if (!reviewId || !comment)
      throw new AppError("reviewId and comment are required", 400);

    // Ensure review exists
    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new AppError("Review not found", 404);

    const reply = await prisma.reviewReply.create({
      data: { reviewId, userId, comment },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, image: true },
        },
        likes: true,
      },
    });

    res.status(201).json(reply);
  } catch (error) {
    next(error);
  }
};

/******************************************
 * GET ALL REPLIES FOR A REVIEW
 ******************************************/
export const getReviewReplies = async (req, res, next) => {
  try {
    const { reviewId } = req.params;

    if (!reviewId) throw new AppError("Review ID is required", 400);

    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new AppError("Review not found", 404);

    const replies = await prisma.reviewReply.findMany({
      where: { reviewId },
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
        likes: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Format replies to include likeCount and likedByUser
    const formatted = replies.map((reply) => ({
      ...reply,
      likeCount: reply.likes.length,
      likedByUser: req?.user?.id
        ? reply.likes.some((l) => l.userId === req.user.id)
        : false,
    }));

    res.status(200).json(formatted);
  } catch (error) {
    next(error);
  }
};

/******************************************
 * DELETE REPLY
 ******************************************/
export const deleteReply = async (req, res, next) => {
  try {
    const { replyId } = req.params;
    const userId = req?.user?.id;

    if (!userId) throw new AppError("Unauthorized", 401);

    const reply = await prisma.reviewReply.findUnique({
      where: { id: replyId },
    });

    if (!reply) throw new AppError("Reply not found", 404);
    if (reply.userId !== userId)
      throw new AppError("You can only delete your own replies", 403);

    await prisma.reviewReply.delete({
      where: { id: replyId },
    });

    res.status(200).json({ message: "Reply deleted successfully" });
  } catch (error) {
    next(error);
  }
};

/******************************************
 * UPDATE REPLY
 ******************************************/
export const updateReply = async (req, res, next) => {
  try {
    const { replyId } = req.params;
    const { comment } = req.body;
    const userId = req?.user?.id;

    if (!userId) throw new AppError("Unauthorized", 401);

    const reply = await prisma.reviewReply.findUnique({
      where: { id: replyId },
    });
    if (!reply) throw new AppError("Reply not found", 404);
    if (reply.userId !== userId)
      throw new AppError("You can only update your own replies", 403);

    const updated = await prisma.reviewReply.update({
      where: { id: replyId },
      data: { comment },
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
        likes: true,
      },
    });

    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};


/******************************************
 * TOGGLE LIKE FOR A REVIEW REPLY
 ******************************************/
export const toggleReplyLike = async (req, res, next) => {
  try {
    const { replyId } = req.params;
    const userId = req?.user?.id;

    if (!userId) throw new AppError("Unauthorized", 401);
    if (!replyId) throw new AppError("Reply ID is required", 400);

    // Ensure reply exists
    const reply = await prisma.reviewReply.findUnique({
      where: { id: replyId },
    });
    if (!reply) throw new AppError("Reply not found", 404);

    // Look for an existing like
    const existingLike = await prisma.reviewLike.findFirst({
      where: {
        reviewReplyId: replyId,
        userId,
      },
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
        data: {
          reviewReplyId: replyId,
          userId,
        },
      });
      liked = true;
    }

    // Recompute like count
    const likeCount = await prisma.reviewLike.count({
      where: { reviewReplyId: replyId },
    });

    // Update reply.likesCount to stay in sync
    await prisma.reviewReply.update({
      where: { id: replyId },
      data: { likesCount: likeCount },
    });

    res.status(200).json({
      liked,
      likeCount,
    });
  } catch (error) {
    next(error);
  }
};
