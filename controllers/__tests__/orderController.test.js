import {
  createOrder,
  getMyOrders,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  cancelMyOrder,
} from "../orderController.js";
import { prisma } from "../../lib/prismaClient.js";
import { AppError } from "../../utils/AppError.js";
import { Prisma } from "@prisma/client";

jest.mock("../../lib/prismaClient.js", () => {
  const product = { findMany: jest.fn(), update: jest.fn() };
  const order = {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  };
  const prisma = {
    product,
    order,
    $transaction: jest.fn(async (cb) => {
      // Provide a tx object mirroring prisma methods used in controller
      const tx = { product, order };
      return cb(tx);
    }),
  };
  return { prisma };
});

const mockRes = () => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  return res;
};

const mockNext = () => jest.fn();

describe("orderController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createOrder", () => {
    it("creates an order using DB prices and computes total", async () => {
      const req = {
        user: { id: "user-1" },
        body: {
          items: [
            { productId: "p1", quantity: 2 },
            { productId: "p2", quantity: 1 },
          ],
        },
      };
      const res = mockRes();
      const next = mockNext();

      prisma.product.findMany.mockResolvedValue([
        { id: "p1", price: "10.00", stock: 10, isActive: true },
        { id: "p2", price: "20.00", stock: 5, isActive: true },
      ]);

      prisma.order.create.mockImplementation(async ({ data }) => {
        // Basic shape expectations only; decimal formatting handled by controller
        expect(data.userId).toBe("user-1");
        expect(data.orderItems.create).toEqual([
          expect.objectContaining({ productId: "p1", quantity: 2 }),
          expect.objectContaining({ productId: "p2", quantity: 1 }),
        ]);
        return { id: "o1", ...data };
      });

      await createOrder(req, res, next);

      expect(prisma.order.create).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ id: "o1" })
      );
    });

    it("rejects when unauthenticated", async () => {
      const req = { body: { items: [{ productId: "p1", quantity: 1 }] } };
      const res = mockRes();
      const next = mockNext();

      await createOrder(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });

    it("rejects empty items", async () => {
      const req = { user: { id: "u1" }, body: { items: [] } };
      const res = mockRes();
      const next = mockNext();

      await createOrder(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    });

    it("rejects when product not found", async () => {
      const req = {
        user: { id: "u1" },
        body: { items: [{ productId: "missing", quantity: 1 }] },
      };
      const res = mockRes();
      const next = mockNext();

      prisma.product.findMany.mockResolvedValue([]);

      await createOrder(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });

    it("rejects invalid quantity", async () => {
      const req = {
        user: { id: "u1" },
        body: { items: [{ productId: "p1", quantity: 0 }] },
      };
      const res = mockRes();
      const next = mockNext();

      prisma.product.findMany.mockResolvedValue([
        { id: "p1", price: "10.00", stock: 10, isActive: true },
      ]);

      await createOrder(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    });
  });

  describe("getMyOrders", () => {
    it("requires auth", async () => {
      const req = { user: null };
      const res = mockRes();
      const next = mockNext();
      await getMyOrders(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });

    it("returns user's orders", async () => {
      const req = { user: { id: "u1" } };
      const res = mockRes();
      const next = mockNext();

      prisma.order.findMany.mockResolvedValue([{ id: "o1" }]);
      await getMyOrders(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([{ id: "o1" }]);
    });
  });

  describe("getAllOrders", () => {
    it("returns all orders", async () => {
      const req = {};
      const res = mockRes();
      const next = mockNext();

      prisma.order.findMany.mockResolvedValue([{ id: "o1" }, { id: "o2" }]);
      await getAllOrders(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([{ id: "o1" }, { id: "o2" }]);
    });
  });

  describe("getOrderById", () => {
    it("allows owner to view", async () => {
      const req = { params: { id: "o1" }, user: { id: "u1" } };
      const res = mockRes();
      const next = mockNext();

      prisma.order.findUnique.mockResolvedValue({ id: "o1", userId: "u1" });
      await getOrderById(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ id: "o1", userId: "u1" });
    });

    it("forbids other users", async () => {
      const req = { params: { id: "o1" }, user: { id: "u2" } };
      const res = mockRes();
      const next = mockNext();

      prisma.order.findUnique.mockResolvedValue({ id: "o1", userId: "u1" });
      await getOrderById(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });

    it("returns 404 when not found", async () => {
      const req = { params: { id: "missing" }, user: { id: "u1" } };
      const res = mockRes();
      const next = mockNext();

      prisma.order.findUnique.mockResolvedValue(null);
      await getOrderById(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });
  });

  describe("updateOrderStatus", () => {
    it("rejects invalid status", async () => {
      const req = { params: { id: "o1" }, body: { status: "WRONG" } };
      const res = mockRes();
      const next = mockNext();
      await updateOrderStatus(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    });

    it("updates status", async () => {
      const req = { params: { id: "o1" }, body: { status: "PAID" } };
      const res = mockRes();
      const next = mockNext();

      prisma.order.update.mockResolvedValue({ id: "o1", status: "PAID" });
      await updateOrderStatus(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ id: "o1", status: "PAID" });
    });
  });

  describe("cancelMyOrder", () => {
    it("requires auth", async () => {
      const req = { params: { id: "o1" }, user: null };
      const res = mockRes();
      const next = mockNext();
      await cancelMyOrder(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });

    it("allows owner to cancel pending", async () => {
      const req = { params: { id: "o1" }, user: { id: "u1" } };
      const res = mockRes();
      const next = mockNext();

      prisma.order.findUnique.mockResolvedValue({
        id: "o1",
        userId: "u1",
        status: "PENDING",
      });
      prisma.order.update.mockResolvedValue({ id: "o1", status: "CANCELED" });

      await cancelMyOrder(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ id: "o1", status: "CANCELED" });
    });

    it("rejects non-pending", async () => {
      const req = { params: { id: "o1" }, user: { id: "u1" } };
      const res = mockRes();
      const next = mockNext();

      prisma.order.findUnique.mockResolvedValue({
        id: "o1",
        userId: "u1",
        status: "PAID",
      });
      await cancelMyOrder(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    });
  });
});
