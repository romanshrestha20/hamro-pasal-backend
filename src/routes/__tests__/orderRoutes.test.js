import request from "supertest";
import express from "express";
import orderRoutes from "../orderRoutes.js";
import { prisma } from "../../lib/prismaClient.js";
import jwt from "jsonwebtoken";

// Mock prisma
jest.mock("../../lib/prismaClient.js", () => {
  const prisma = {
    order: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    shippingAddress: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    payment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(async (cb) => {
      const tx = {
        product: prisma.product,
        order: prisma.order,
        shippingAddress: prisma.shippingAddress,
        payment: prisma.payment,
      };
      return cb(tx);
    }),
  };
  return { prisma };
});

// Mock error middleware
const errorMiddleware = (err, req, res, next) => {
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
};

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/orders", orderRoutes);
  app.use(errorMiddleware);
  return app;
};

// Helper to generate JWT token
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET || "test-secret", {
    expiresIn: "1h",
  });
};

describe("Order Routes Integration Tests", () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
  });

  describe("POST /api/orders", () => {
    it("creates an order with valid token", async () => {
      const token = generateToken({ id: "user-1" });

      prisma.product.findMany.mockResolvedValue([
        {
          id: "p1",
          name: "Product 1",
          price: "10.00",
          stock: 10,
          isActive: true,
          image: "p1.jpg",
        },
      ]);

      prisma.product.updateMany.mockResolvedValue({ count: 1 });
      prisma.order.create.mockResolvedValue({ id: "o1", userId: "user-1" });
      prisma.order.findUnique.mockResolvedValue({
        id: "o1",
        userId: "user-1",
        orderItems: [],
        payment: null,
        shippingAddress: null,
      });

      const response = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${token}`)
        .send({
          items: [{ productId: "p1", quantity: 2 }],
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("id", "o1");
    });
  });

  describe("GET /api/orders/my", () => {
    it("returns user orders with valid token", async () => {
      const token = generateToken({ id: "user-1" });

      prisma.order.findMany.mockResolvedValue([
        { id: "o1", userId: "user-1" },
        { id: "o2", userId: "user-1" },
      ]);

      const response = await request(app)
        .get("/api/orders/my")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });
  });

  describe("GET /api/orders/:id", () => {
    it("returns order details for owner", async () => {
      const token = generateToken({ id: "user-1" });

      prisma.order.findUnique.mockResolvedValue({
        id: "o1",
        userId: "user-1",
        user: {
          id: "user-1",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        },
        orderItems: [],
        payment: null,
        shippingAddress: null,
      });

      const response = await request(app)
        .get("/api/orders/o1")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("id", "o1");
    });
  });

  describe("POST /api/orders/:orderId/address", () => {
    it("creates shipping address for order", async () => {
      const token = generateToken({ id: "user-1" });

      // Mock order lookup with implementation
      prisma.order.findUnique.mockImplementation(({ where }) => {
        if (where.id === "o1") {
          return Promise.resolve({ id: "o1", userId: "user-1" });
        }
        return Promise.resolve(null);
      });

      // Mock address lookup - doesn't exist yet
      prisma.shippingAddress.findUnique.mockImplementation(() =>
        Promise.resolve(null)
      );

      // Mock address creation
      prisma.shippingAddress.create.mockImplementation(({ data }) =>
        Promise.resolve({
          id: "addr-1",
          ...data,
        })
      );

      const response = await request(app)
        .post("/api/orders/o1/address")
        .set("Authorization", `Bearer ${token}`)
        .send({
          fullName: "John Doe",
          phone: "+1234567890",
          address: "123 Main St",
          city: "New York",
          postalCode: "10001",
          country: "USA",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("id", "addr-1");
    });
  });
  describe("POST /api/orders/:orderId/payment", () => {
    it("creates payment for order", async () => {
      const token = generateToken({ id: "user-1" });

      prisma.order.findUnique.mockResolvedValue({
        id: "o1",
        userId: "user-1",
        total: "100.00",
      });

      prisma.payment.findUnique.mockResolvedValue(null);

      prisma.payment.create.mockResolvedValue({
        id: "pay-1",
        orderId: "o1",
        amount: "100.00",
        provider: "STRIPE",
        status: "PENDING",
      });

      const response = await request(app)
        .post("/api/orders/o1/payment")
        .set("Authorization", `Bearer ${token}`)
        .send({
          provider: "STRIPE",
          transactionId: "txn_123",
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("id", "pay-1");
    });
  });

  describe("PATCH /api/payments/:paymentId/status", () => {
    it("updates payment status", async () => {
      const token = generateToken({ id: "user-1" });

      prisma.payment.findUnique.mockResolvedValue({
        id: "pay-1",
        orderId: "o1",
        status: "PENDING",
      });

      prisma.payment.update.mockResolvedValue({
        id: "pay-1",
        orderId: "o1",
        status: "PAID",
        transactionId: "txn_456",
      });

      const response = await request(app)
        .patch("/api/orders/o1/payment/status")
        .set("Authorization", `Bearer ${token}`)
        .send({
          status: "PAID",
          transactionId: "txn_456",
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("PAID");
    });
  });

  describe("PATCH /api/orders/:id/cancel", () => {
    it("allows user to cancel their pending order", async () => {
      const token = generateToken({ id: "user-1" });

      prisma.order.findUnique.mockResolvedValue({
        id: "o1",
        userId: "user-1",
        status: "PENDING",
        orderItems: [{ productId: "p1", quantity: 2 }],
        payment: null,
      });

      prisma.product.update.mockResolvedValue({});
      prisma.order.update.mockResolvedValue({
        id: "o1",
        status: "CANCELED",
        orderItems: [],
        payment: null,
        shippingAddress: null,
      });

      const response = await request(app)
        .patch("/api/orders/o1/cancel")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("CANCELED");
    });
  });

  describe("PATCH /api/orders/:id/status", () => {
    it("allows admin to update order status", async () => {
      const token = generateToken({ id: "admin-1", isAdmin: true });

      prisma.order.update.mockResolvedValue({
        id: "o1",
        status: "SHIPPED",
        orderItems: [],
        payment: null,
        shippingAddress: null,
      });

      const response = await request(app)
        .patch("/api/orders/o1/status")
        .set("Authorization", `Bearer ${token}`)
        .send({
          status: "SHIPPED",
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("SHIPPED");
    });
  });
});
