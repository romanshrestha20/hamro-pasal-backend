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

jest.mock("../../lib/prismaClient.js", () => {
  const product = {
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  };
  const order = {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  };
  const shippingAddress = {
    create: jest.fn(),
  };
  const payment = {
    create: jest.fn(),
  };

  return {
    prisma: {
      product,
      order,
      shippingAddress,
      payment,
      $transaction: jest.fn(async (cb) =>
        cb({ product, order, shippingAddress, payment })
      ),
    },
  };
});

const mockRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

const mockNext = () => jest.fn();

describe("orderController", () => {
  beforeEach(() => jest.clearAllMocks());

  // ===========================
  // CREATE ORDER
  // ===========================
  describe("createOrder", () => {
    it("creates an order successfully", async () => {
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
        {
          id: "p1",
          name: "Product 1",
          price: "10.00",
          stock: 10,
          isActive: true,
          image: "p1.jpg",
        },
        {
          id: "p2",
          name: "Product 2",
          price: "20.00",
          stock: 5,
          isActive: true,
          image: "p2.jpg",
        },
      ]);

      prisma.product.updateMany.mockResolvedValue({ count: 1 });
      prisma.order.create.mockResolvedValue({ id: "o1" });

      prisma.order.findUnique.mockResolvedValue({
        id: "o1",
        userId: "user-1",
        orderItems: [],
        payment: null,
        shippingAddress: null,
      });

      await createOrder(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ id: "o1" })
      );
    });

    it("rejects unauthenticated", async () => {
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

    it("rejects missing product", async () => {
      const req = {
        user: { id: "u1" },
        body: { items: [{ productId: "not-found", quantity: 1 }] },
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
        { id: "p1", price: "10", stock: 10, isActive: true },
      ]);

      await createOrder(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    });
  });

  // ===========================
  // GET MY ORDERS
  // ===========================
  describe("getMyOrders", () => {
    it("requires authentication", async () => {
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

  // ===========================
  // ADMIN GET ALL ORDERS
  // ===========================
  describe("getAllOrders", () => {
    it("rejects non-admin", async () => {
      const req = { user: { id: "u1", isAdmin: false }, query: {} };
      const res = mockRes();
      const next = mockNext();

      await getAllOrders(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });

    it("returns paginated orders for admin", async () => {
      const req = {
        user: { id: "u1", isAdmin: true },
        query: { page: "1", limit: "20" },
      };
      const res = mockRes();
      const next = mockNext();

      prisma.order.findMany.mockResolvedValue([{ id: "o1" }, { id: "o2" }]);
      prisma.order.count.mockResolvedValue(2);

      await getAllOrders(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        data: [{ id: "o1" }, { id: "o2" }],
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1,
        },
      });
    });
  });

  // ===========================
  // GET ORDER BY ID
  // ===========================
  describe("getOrderById", () => {
    it("allows owner access", async () => {
      const req = { params: { id: "o1" }, user: { id: "u1" } };
      const res = mockRes();
      const next = mockNext();

      prisma.order.findUnique.mockResolvedValue({ id: "o1", userId: "u1" });

      await getOrderById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("denies non-owner", async () => {
      const req = { params: { id: "o1" }, user: { id: "u2" } };
      const res = mockRes();
      const next = mockNext();

      prisma.order.findUnique.mockResolvedValue({ id: "o1", userId: "u1" });

      await getOrderById(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });

    it("returns 404 if not found", async () => {
      const req = { params: { id: "missing" }, user: { id: "u1" } };
      const res = mockRes();
      const next = mockNext();

      prisma.order.findUnique.mockResolvedValue(null);

      await getOrderById(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });
  });

  // ===========================
  // UPDATE ORDER STATUS (ADMIN)
  // ===========================
  describe("updateOrderStatus", () => {
    it("requires admin", async () => {
      const req = {
        params: { id: "o1" },
        body: { status: "PROCESSING" },
        user: { id: "u1", isAdmin: false },
      };
      const res = mockRes();
      const next = mockNext();

      await updateOrderStatus(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });

    it("rejects invalid status", async () => {
      const req = {
        params: { id: "o1" },
        body: { status: "WRONG" },
        user: { id: "u1", isAdmin: true },
      };
      const res = mockRes();
      const next = mockNext();

      await updateOrderStatus(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    });

    it("updates order status (PROCESSING)", async () => {
      const req = {
        params: { id: "o1" },
        body: { status: "PROCESSING" },
        user: { id: "u1", isAdmin: true },
      };
      const res = mockRes();
      const next = mockNext();

      prisma.order.update.mockResolvedValue({
        id: "o1",
        status: "PROCESSING",
      });

      await updateOrderStatus(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        id: "o1",
        status: "PROCESSING",
      });
    });
  });

  // ===========================
  // CANCEL ORDER
  // ===========================
  describe("cancelMyOrder", () => {
    it("requires auth", async () => {
      const req = { params: { id: "o1" }, user: null };
      const res = mockRes();
      const next = mockNext();

      await cancelMyOrder(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });

    it("allows owner to cancel PENDING", async () => {
      const req = { params: { id: "o1" }, user: { id: "u1" } };
      const res = mockRes();
      const next = mockNext();

      prisma.order.findUnique.mockResolvedValue({
        id: "o1",
        userId: "u1",
        status: "PENDING",
        orderItems: [{ productId: "p1", quantity: 2 }],
        payment: null,
      });

      prisma.product.update.mockResolvedValue({});
      prisma.order.update.mockResolvedValue({
        id: "o1",
        status: "CANCELED",
      });

      await cancelMyOrder(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        id: "o1",
        status: "CANCELED",
      });
    });

    it("rejects cancel when status !== PENDING", async () => {
      const req = { params: { id: "o1" }, user: { id: "u1" } };
      const res = mockRes();
      const next = mockNext();

      prisma.order.findUnique.mockResolvedValue({
        id: "o1",
        userId: "u1",
        status: "SHIPPED",
      });

      await cancelMyOrder(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    });
  });
});
