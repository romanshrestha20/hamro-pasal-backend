import { jest } from "@jest/globals";
import {
  createReview,
  getReviewById,
  getProductReviews,
  deleteReview,
  updateReviewById,
  getMyReviews,
  likeReview,
  unLikeReview,
} from "../reviewController.js";
import { prisma } from "../../lib/prismaClient.js";
import { AppError } from "../../utils/AppError.js";

// Mock Prisma client methods used by review controller (restored version)
jest.mock("../../lib/prismaClient.js", () => ({
  prisma: {
    product: { findUnique: jest.fn(), update: jest.fn() },
    review: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
    reviewLike: {
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    image: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
  },
}));

describe("ReviewController", () => {
  let req, res, next;

  beforeEach(() => {
    req = { params: {}, body: {}, user: { id: "user-1" } };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe("createReview", () => {
    it("creates a review and updates product rating", async () => {
      req.body = {
        productId: "p1",
        rating: 5,
        comment: "Great",
        images: ["a.jpg"],
        title: "Awesome",
      };
      prisma.product.findUnique.mockResolvedValue({ id: "p1", isActive: true });
      prisma.review.findFirst.mockResolvedValue(null);
      prisma.review.create.mockResolvedValue({
        id: "r1",
        productId: "p1",
        userId: req.user.id,
        rating: 5,
        comment: "Great",
        title: "Awesome",
        images: [{ id: "img1", url: "a.jpg" }],
      });
      prisma.review.findMany.mockResolvedValue([{ rating: 5 }]); // for average calculation
      prisma.product.update.mockResolvedValue({ id: "p1", rating: 5 });

      await createReview(req, res, next);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ id: "r1", rating: 5 })
      );
      expect(prisma.product.update).toHaveBeenCalled();
    });

    it("rejects unauthorized user", async () => {
      req.user = undefined;
      await createReview(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe("Unauthorized");
    });

    it("rejects inactive product", async () => {
      req.body = { productId: "p1", rating: 4 };
      prisma.product.findUnique.mockResolvedValue({
        id: "p1",
        isActive: false,
      });
      await createReview(req, res, next);
      expect(next.mock.calls[0][0].message).toBe(
        "Product not found or inactive"
      );
    });

    it("rejects duplicate review", async () => {
      req.body = { productId: "p1", rating: 4 };
      prisma.product.findUnique.mockResolvedValue({ id: "p1", isActive: true });
      prisma.review.findFirst.mockResolvedValue({ id: "r-existing" });
      await createReview(req, res, next);
      expect(next.mock.calls[0][0].message).toBe(
        "You have already reviewed this product"
      );
    });
  });

  describe("getReviewById", () => {
    it("returns enriched review object", async () => {
      req.params.reviewId = "r1";
      prisma.review.findUnique.mockResolvedValue({
        id: "r1",
        productId: "p1",
        likes: [{ id: "l1", userId: "other" }],
        user: {},
        images: [],
        replies: [],
      });
      await getReviewById(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ id: "r1", likesCount: 1, likedByUser: false })
      );
    });

    it("handles review not found", async () => {
      req.params.reviewId = "missing";
      prisma.review.findUnique.mockResolvedValue(null);
      await getReviewById(req, res, next);
      expect(next.mock.calls[0][0].message).toBe("Review not found");
    });
  });

  describe("getProductReviews", () => {
    it("returns formatted product reviews", async () => {
      req.params.productId = "p1";
      prisma.product.findUnique.mockResolvedValue({ id: "p1" });
      prisma.review.findMany.mockResolvedValue([
        {
          id: "r1",
          productId: "p1",
          likes: [],
          user: {},
          images: [],
          replies: [],
        },
        {
          id: "r2",
          productId: "p1",
          likes: [{ id: "l1", userId: "x" }],
          user: {},
          images: [],
          replies: [],
        },
      ]);
      await getProductReviews(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([
        expect.objectContaining({
          id: "r1",
          likesCount: 0,
          likedByUser: false,
        }),
        expect.objectContaining({ id: "r2", likesCount: 1 }),
      ]);
    });

    it("errors when product not found", async () => {
      req.params.productId = "pX";
      prisma.product.findUnique.mockResolvedValue(null);
      await getProductReviews(req, res, next);
      expect(next.mock.calls[0][0].message).toBe("Product not found");
    });
  });

  describe("deleteReview", () => {
    it("deletes own review", async () => {
      req.params.reviewId = "r1";
      prisma.review.findUnique.mockResolvedValue({
        id: "r1",
        userId: "user-1",
      });
      prisma.review.delete.mockResolvedValue({});

      await deleteReview(req, res, next);
      expect(prisma.review.delete).toHaveBeenCalledWith({
        where: { id: "r1" },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Review deleted successfully",
      });
    });

    it("forbids deleting others' review", async () => {
      req.params.reviewId = "r2";
      prisma.review.findUnique.mockResolvedValue({ id: "r2", userId: "other" });

      await deleteReview(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe(
        "You can only delete your own reviews"
      );
    });

    it("rejects when unauthorized", async () => {
      req.user = undefined;
      await deleteReview(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe("Unauthorized");
    });
  });

  describe("updateReviewById", () => {
    it("updates review and recalculates product rating", async () => {
      req.params.reviewId = "r1";
      req.body = { rating: 4, comment: "updated" };
      prisma.review.findUnique.mockResolvedValue({
        id: "r1",
        userId: "user-1",
        productId: "p1",
        rating: 5,
        comment: "old",
        title: "T",
      });
      prisma.image.deleteMany.mockResolvedValue({});
      prisma.image.createMany.mockResolvedValue({ count: 0 });
      prisma.review.update.mockResolvedValue({
        id: "r1",
        userId: "user-1",
        productId: "p1",
        rating: 4,
        comment: "updated",
        images: [],
      });
      prisma.review.findMany.mockResolvedValue([{ rating: 4 }]);
      prisma.product.update.mockResolvedValue({ id: "p1", rating: 4 });
      await updateReviewById(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ id: "r1", rating: 4 })
      );
      expect(prisma.product.update).toHaveBeenCalled();
    });

    it("rejects unauthorized", async () => {
      req.user = undefined;
      await updateReviewById(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe("Unauthorized");
    });
  });

  describe("getMyReviews", () => {
    it("returns user's reviews", async () => {
      prisma.review.findMany.mockResolvedValue([{ id: "r1" }]);
      await getMyReviews(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([{ id: "r1" }]);
    });
    it("rejects unauthorized", async () => {
      req.user = undefined;
      await getMyReviews(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe("Unauthorized");
    });
  });

  describe("likeReview / unLikeReview", () => {
    it("likes a review returns liked true", async () => {
      req.params.reviewId = "r1";
      prisma.review.findUnique.mockResolvedValue({ id: "r1" });
      prisma.reviewLike.findFirst.mockResolvedValue(null);
      prisma.reviewLike.create.mockResolvedValue({ id: "l1" });
      await likeReview(req, res, next);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ liked: true });
    });
    it("prevents duplicate like", async () => {
      req.params.reviewId = "r1";
      prisma.review.findUnique.mockResolvedValue({ id: "r1" });
      prisma.reviewLike.findFirst.mockResolvedValue({ id: "l1" });
      await likeReview(req, res, next);
      expect(next.mock.calls[0][0].message).toBe(
        "You already liked this review"
      );
    });
    it("unlikes a review returns liked false", async () => {
      req.params.reviewId = "r1";
      prisma.reviewLike.findFirst.mockResolvedValue({ id: "l1" });
      await unLikeReview(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ liked: false });
    });
    it("errors if not liked", async () => {
      req.params.reviewId = "r1";
      prisma.reviewLike.findFirst.mockResolvedValue(null);
      await unLikeReview(req, res, next);
      expect(next.mock.calls[0][0].message).toBe(
        "You have not liked this review"
      );
    });
    it("unauthorized like/unlike", async () => {
      req.user = undefined;
      req.params.reviewId = "r1";
      await likeReview(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe("Unauthorized");
      next.mockClear();
      await unLikeReview(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe("Unauthorized");
    });
  });
});
