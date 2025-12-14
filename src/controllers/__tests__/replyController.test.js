import { jest } from "@jest/globals";
import {
  createReply,
  getReviewReplies,
  deleteReply,
  updateReply,
  likeReply,
  unlikeReply,
} from "../replyController.js";
import { prisma } from "../../lib/prismaClient.js";
import { AppError } from "../../utils/AppError.js";

// Mock Prisma used in reply controller
jest.mock("../../lib/prismaClient.js", () => ({
  prisma: {
    review: { findUnique: jest.fn() },
    reviewReply: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
    reviewLike: {
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

describe("ReplyController", () => {
  let req, res, next;

  beforeEach(() => {
    req = { params: {}, body: {}, user: { id: "user-1" } };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe("createReply", () => {
    it("creates a reply successfully", async () => {
      req.body = { reviewId: "r1", comment: "Thanks!" };
      prisma.review.findUnique.mockResolvedValue({ id: "r1" });
      const created = {
        id: "rr1",
        reviewId: "r1",
        userId: "user-1",
        comment: "Thanks!",
        user: { id: "user-1" },
        likes: [],
      };
      prisma.reviewReply.create.mockResolvedValue(created);

      await createReply(req, res, next);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(created);
    });

    it("calls next when unauthorized", async () => {
      req.user = undefined;
      req.body = { reviewId: "r1", comment: "Hi" };
      await createReply(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe("Unauthorized");
    });

    it("errors when review not found", async () => {
      req.body = { reviewId: "rX", comment: "Hi" };
      prisma.review.findUnique.mockResolvedValue(null);

      await createReply(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe("Review not found");
    });
  });

  describe("getReviewReplies", () => {
    it("returns formatted replies including like metadata", async () => {
      req.params.reviewId = "r1";
      prisma.review.findUnique.mockResolvedValue({ id: "r1" });
      prisma.reviewReply.findMany.mockResolvedValue([
        { id: "rr1", reviewId: "r1", likes: [], user: { id: "user-x" } },
        {
          id: "rr2",
          reviewId: "r1",
          likes: [{ id: "l1", userId: "z" }],
          user: { id: "user-y" },
        },
      ]);
      await getReviewReplies(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([
        expect.objectContaining({
          id: "rr1",
          likeCount: 0,
          likedByUser: false,
        }),
        expect.objectContaining({ id: "rr2", likeCount: 1 }),
      ]);
    });

    it("errors when review not found", async () => {
      req.params.reviewId = "missing";
      prisma.review.findUnique.mockResolvedValue(null);

      await getReviewReplies(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe("Review not found");
    });
  });

  describe("deleteReply", () => {
    it("deletes own reply", async () => {
      req.params.replyId = "rr1";
      prisma.reviewReply.findUnique.mockResolvedValue({
        id: "rr1",
        userId: "user-1",
      });
      prisma.reviewReply.delete.mockResolvedValue({});
      await deleteReply(req, res, next);
      expect(prisma.reviewReply.delete).toHaveBeenCalledWith({
        where: { id: "rr1" },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Reply deleted successfully",
      });
    });

    it("forbids deleting others' reply", async () => {
      req.params.replyId = "rr2";
      prisma.reviewReply.findUnique.mockResolvedValue({
        id: "rr2",
        userId: "other",
      });

      await deleteReply(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe(
        "You can only delete your own replies"
      );
    });

    it("rejects when unauthorized", async () => {
      req.user = undefined;
      await deleteReply(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe("Unauthorized");
    });
  });

  describe("updateReply", () => {
    it("updates own reply", async () => {
      req.params.replyId = "rr1";
      req.body = { comment: "updated" };
      prisma.reviewReply.findUnique.mockResolvedValue({
        id: "rr1",
        userId: "user-1",
        comment: "old",
      });
      const updated = {
        id: "rr1",
        userId: "user-1",
        comment: "updated",
        user: { id: "user-1" },
        likes: [],
      };
      prisma.reviewReply.update.mockResolvedValue(updated);
      await updateReply(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(updated);
    });

    it("handles reply not found", async () => {
      req.params.replyId = "missing";
      prisma.reviewReply.findUnique.mockResolvedValue(null);
      await updateReply(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe("Reply not found");
    });

    it("rejects when unauthorized", async () => {
      req.user = undefined;
      await updateReply(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe("Unauthorized");
    });
  });

  describe("like/unlike reply", () => {
    it("likes a reply returns liked true", async () => {
      req.user = { id: "user-1" };
      req.params.replyId = "rr1";
      prisma.reviewReply.findUnique.mockResolvedValue({ id: "rr1" });
      prisma.reviewLike.findFirst.mockResolvedValue(null);
      prisma.reviewLike.create.mockResolvedValue({ id: "l1" });
      await likeReply(req, res, next);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ liked: true });
    });
    it("duplicate like blocked", async () => {
      req.user = { id: "user-1" };
      req.params.replyId = "rr1";
      prisma.reviewReply.findUnique.mockResolvedValue({ id: "rr1" });
      prisma.reviewLike.findFirst.mockResolvedValue({ id: "l1" });
      await likeReply(req, res, next);
      expect(next.mock.calls[0][0].message).toBe("Already liked");
    });
    it("unlikes a reply returns liked false", async () => {
      req.user = { id: "user-1" };
      req.params.replyId = "rr1";
      prisma.reviewLike.findFirst.mockResolvedValue({ id: "l1" });
      await unlikeReply(req, res, next);
      expect(prisma.reviewLike.delete).toHaveBeenCalledWith({
        where: { id: "l1" },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ liked: false });
    });
    it("errors when not liked yet", async () => {
      req.user = { id: "user-1" };
      req.params.replyId = "rr1";
      prisma.reviewLike.findFirst.mockResolvedValue(null);
      await unlikeReply(req, res, next);
      expect(next.mock.calls[0][0].message).toBe(
        "You have not liked this reply"
      );
    });
    it("unauthorized like/unlike", async () => {
      req.user = undefined;
      req.params.replyId = "rr1";
      await likeReply(req, res, next);
      expect(next.mock.calls[0][0].message).toBe("Unauthorized");
      next.mockClear();
      await unlikeReply(req, res, next);
      expect(next.mock.calls[0][0].message).toBe("Unauthorized");
    });
  });
});
