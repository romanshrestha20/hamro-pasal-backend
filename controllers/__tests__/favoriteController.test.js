import {
  addToFavorites,
  getMyFavorites,
  getMyFavoriteByProduct,
  removeFromFavorites,
  toggleFavorite,
} from "../favoriteController.js";
import { prisma } from "../../lib/prismaClient.js";
import { AppError } from "../../utils/AppError.js";

jest.mock("../../lib/prismaClient.js", () => ({
  prisma: {
    product: {
      findUnique: jest.fn(),
    },
    favorite: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

const mockRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
const mockNext = () => jest.fn();

describe("favoriteController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("addToFavorites", () => {
    it("adds favorite (happy path)", async () => {
      const req = { user: { id: "u1" }, body: { productId: "p1" } };
      const res = mockRes();
      const next = mockNext();
      prisma.product.findUnique.mockResolvedValue({ id: "p1", isActive: true });
      prisma.favorite.create.mockResolvedValue({
        id: "f1",
        userId: "u1",
        productId: "p1",
      });

      await addToFavorites(req, res, next);

      expect(prisma.favorite.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { userId: "u1", productId: "p1" } })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "u1", productId: "p1" })
      );
    });

    it("returns existing on duplicate (P2002)", async () => {
      const req = { user: { id: "u1" }, body: { productId: "p1" } };
      const res = mockRes();
      const next = mockNext();
      prisma.product.findUnique.mockResolvedValue({ id: "p1", isActive: true });
      const dupErr = new Error("duplicate");
      dupErr.code = "P2002";
      prisma.favorite.create.mockRejectedValue(dupErr);
      prisma.favorite.findUnique.mockResolvedValue({
        id: "f1",
        userId: "u1",
        productId: "p1",
      });

      await addToFavorites(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ productId: "p1" })
      );
    });

    it("fails when product missing", async () => {
      const req = { user: { id: "u1" }, body: { productId: "missing" } };
      const res = mockRes();
      const next = mockNext();
      prisma.product.findUnique.mockResolvedValue(null);

      await addToFavorites(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });

    it("fails when inactive product", async () => {
      const req = { user: { id: "u1" }, body: { productId: "p1" } };
      const res = mockRes();
      const next = mockNext();
      prisma.product.findUnique.mockResolvedValue({
        id: "p1",
        isActive: false,
      });

      await addToFavorites(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    });
  });

  describe("toggleFavorite", () => {
    it("removes when existing", async () => {
      const req = { user: { id: "u1" }, params: { productId: "p1" } };
      const res = mockRes();
      const next = mockNext();
      prisma.favorite.findUnique.mockResolvedValue({ id: "f1" });
      prisma.favorite.delete.mockResolvedValue({ id: "f1" });

      await toggleFavorite(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ toggled: "removed" })
      );
    });

    it("adds when missing (and product active)", async () => {
      const req = { user: { id: "u1" }, params: { productId: "p1" } };
      const res = mockRes();
      const next = mockNext();
      prisma.favorite.findUnique.mockResolvedValue(null);
      prisma.product.findUnique.mockResolvedValue({ id: "p1", isActive: true });
      prisma.favorite.create.mockResolvedValue({
        id: "f1",
        userId: "u1",
        productId: "p1",
      });

      await toggleFavorite(req, res, next);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ toggled: "added" })
      );
    });
  });

  describe("getMyFavorites", () => {
    it("returns list", async () => {
      const req = { user: { id: "u1" } };
      const res = mockRes();
      const next = mockNext();
      prisma.favorite.findMany.mockResolvedValue([{ id: "f1" }]);

      await getMyFavorites(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([{ id: "f1" }]);
    });
  });

  describe("getMyFavoriteByProduct", () => {
    it("returns 200 when exists", async () => {
      const req = { user: { id: "u1" }, params: { productId: "p1" } };
      const res = mockRes();
      const next = mockNext();
      prisma.favorite.findUnique.mockResolvedValue({
        id: "f1",
        userId: "u1",
        productId: "p1",
      });

      await getMyFavoriteByProduct(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ productId: "p1" })
      );
    });

    it("returns 404 when not favorited", async () => {
      const req = { user: { id: "u1" }, params: { productId: "p1" } };
      const res = mockRes();
      const next = mockNext();
      prisma.favorite.findUnique.mockResolvedValue(null);

      await getMyFavoriteByProduct(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Not favorited" });
    });
  });

  describe("removeFromFavorites", () => {
    it("returns 200 on delete", async () => {
      const req = { user: { id: "u1" }, params: { productId: "p1" } };
      const res = mockRes();
      const next = mockNext();
      prisma.favorite.delete.mockResolvedValue({ id: "f1" });

      await removeFromFavorites(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Removed from favorites" })
      );
    });

    it("returns 404 when missing", async () => {
      const req = { user: { id: "u1" }, params: { productId: "p1" } };
      const res = mockRes();
      const next = mockNext();
      const notFound = new Error("not found");
      notFound.code = "P2025";
      prisma.favorite.delete.mockRejectedValue(notFound);

      await removeFromFavorites(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });
  });
});
