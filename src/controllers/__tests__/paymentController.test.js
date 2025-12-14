import {
  createPayment,
  updatePaymentStatus,
  getPaymentByOrder,
  refundPayment,
} from "../paymentController.js";
import { prisma } from "../../lib/prismaClient.js";
import { AppError } from "../../utils/AppError.js";

jest.mock("../../lib/prismaClient.js", () => {
  const payment = {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  };
  const order = {
    findUnique: jest.fn(),
  };
  const prisma = {
    payment,
    order,
  };
  return { prisma };
});

const mockRes = () => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  return res;
};

const mockNext = () => jest.fn();

describe("paymentController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createPayment", () => {
    it("creates a payment record successfully", async () => {
      const req = {
        user: { id: "user-1" },
        params: { orderId: "order-1" },
        body: {
          provider: "STRIPE",
          transactionId: "txn_123",
        },
      };
      const res = mockRes();
      const next = mockNext();

      prisma.order.findUnique.mockResolvedValue({
        id: "order-1",
        userId: "user-1",
        total: "100.00",
      });

      prisma.payment.findUnique.mockResolvedValue(null);

      prisma.payment.create.mockResolvedValue({
        id: "payment-1",
        orderId: "order-1",
        amount: "100.00",
        provider: "STRIPE",
        transactionId: "txn_123",
        status: "PENDING",
      });

      await createPayment(req, res, next);

      expect(prisma.payment.create).toHaveBeenCalledWith({
        data: {
          orderId: "order-1",
          amount: "100.00",
          provider: "STRIPE",
          transactionId: "txn_123",
          status: "PENDING",
        },
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "payment-1",
          orderId: "order-1",
        })
      );
    });

    it("rejects when unauthenticated", async () => {
      const req = {
        params: { orderId: "order-1" },
        body: { provider: "STRIPE" },
      };
      const res = mockRes();
      const next = mockNext();

      await createPayment(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });

    it("rejects when order not found", async () => {
      const req = {
        user: { id: "user-1" },
        params: { orderId: "order-999" },
        body: { provider: "STRIPE" },
      };
      const res = mockRes();
      const next = mockNext();

      prisma.order.findUnique.mockResolvedValue(null);

      await createPayment(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });

    it("rejects when payment already exists", async () => {
      const req = {
        user: { id: "user-1" },
        params: { orderId: "order-1" },
        body: { provider: "STRIPE" },
      };
      const res = mockRes();
      const next = mockNext();

      prisma.order.findUnique.mockResolvedValue({
        id: "order-1",
        userId: "user-1",
        total: "100.00",
      });

      prisma.payment.findUnique.mockResolvedValue({
        id: "payment-1",
        orderId: "order-1",
      });

      await createPayment(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    });

    it("rejects when user does not own order and is not admin", async () => {
      const req = {
        user: { id: "user-2", isAdmin: false },
        params: { orderId: "order-1" },
        body: { provider: "STRIPE" },
      };
      const res = mockRes();
      const next = mockNext();

      prisma.order.findUnique.mockResolvedValue({
        id: "order-1",
        userId: "user-1",
        total: "100.00",
      });

      await createPayment(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });

    it("allows admin to create payment for any order", async () => {
      const req = {
        user: { id: "admin-1", isAdmin: true },
        params: { orderId: "order-1" },
        body: { provider: "STRIPE" },
      };
      const res = mockRes();
      const next = mockNext();

      prisma.order.findUnique.mockResolvedValue({
        id: "order-1",
        userId: "user-1",
        total: "100.00",
      });

      prisma.payment.findUnique.mockResolvedValue(null);

      prisma.payment.create.mockResolvedValue({
        id: "payment-1",
        orderId: "order-1",
        amount: "100.00",
        provider: "STRIPE",
        status: "PENDING",
      });

      await createPayment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe("updatePaymentStatus", () => {
    it("updates payment status successfully", async () => {
      const req = {
        params: { orderId: "order-1" },
        body: {
          status: "PAID",
          transactionId: "txn_456",
        },
      };
      const res = mockRes();
      const next = mockNext();

      prisma.payment.findUnique.mockResolvedValue({
        id: "payment-1",
        orderId: "order-1",
        status: "PENDING",
        transactionId: null,
      });

      prisma.payment.update.mockResolvedValue({
        id: "payment-1",
        orderId: "order-1",
        status: "PAID",
        transactionId: "txn_456",
      });

      await updatePaymentStatus(req, res, next);

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { orderId: "order-1" },
        data: {
          status: "PAID",
          transactionId: "txn_456",
        },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "PAID",
          transactionId: "txn_456",
        })
      );
    });

    it("rejects invalid payment status", async () => {
      const req = {
        params: { orderId: "order-1" },
        body: { status: "INVALID_STATUS" },
      };
      const res = mockRes();
      const next = mockNext();

      await updatePaymentStatus(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(400);
      expect(next.mock.calls[0][0].message).toContain("Invalid payment status");
    });

    it("rejects when payment not found", async () => {
      const req = {
        params: { orderId: "order-999" },
        body: { status: "PAID" },
      };
      const res = mockRes();
      const next = mockNext();

      prisma.payment.findUnique.mockResolvedValue(null);

      await updatePaymentStatus(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });

    it("preserves existing transactionId if not provided", async () => {
      const req = {
        params: { orderId: "order-1" },
        body: { status: "PAID" },
      };
      const res = mockRes();
      const next = mockNext();

      prisma.payment.findUnique.mockResolvedValue({
        id: "payment-1",
        orderId: "order-1",
        transactionId: "existing_txn",
      });

      prisma.payment.update.mockResolvedValue({
        id: "payment-1",
        orderId: "order-1",
        status: "PAID",
        transactionId: "existing_txn",
      });

      await updatePaymentStatus(req, res, next);

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { orderId: "order-1" },
        data: {
          status: "PAID",
          transactionId: "existing_txn",
        },
      });
    });
  });

 it("retrieves payment successfully", async () => {
   const req = {
     user: { id: "user-1", isAdmin: true },
     params: { orderId: "order-1" },
   };
   const res = mockRes();
   const next = mockNext();

   prisma.payment.findUnique.mockResolvedValue({
     id: "payment-1",
     orderId: "order-1",
     amount: "100.00",
     status: "PAID",
   });

   await getPaymentByOrder(req, res, next);

   expect(prisma.payment.findUnique).toHaveBeenCalledWith({
     where: { orderId: "order-1" },
   });

   expect(res.status).toHaveBeenCalledWith(200);
 });

 describe("refundPayment", () => {
   it("refunds payment successfully as admin", async () => {
     const req = {
       user: { id: "admin-1", isAdmin: true },
       params: { orderId: "order-1" },
     };
     const res = mockRes();
     const next = mockNext();

     prisma.payment.findUnique.mockResolvedValue({
       id: "payment-1",
       orderId: "order-1",
       status: "PAID",
     });

     prisma.payment.update.mockResolvedValue({
       id: "payment-1",
       orderId: "order-1",
       status: "REFUNDED",
     });

     await refundPayment(req, res, next);

     expect(prisma.payment.update).toHaveBeenCalledWith({
       where: { orderId: "order-1" },
       data: { status: "REFUNDED" },
     });
     expect(res.status).toHaveBeenCalledWith(200);
     expect(res.json).toHaveBeenCalledWith(
       expect.objectContaining({
         status: "REFUNDED",
       })
     );
   });

   it("rejects when user is not admin", async () => {
     const req = {
       user: { id: "user-1", isAdmin: false },
       params: { orderId: "order-1" },
     };
     const res = mockRes();
     const next = mockNext();

     await refundPayment(req, res, next);

     expect(next).toHaveBeenCalledWith(expect.any(AppError));
     expect(next.mock.calls[0][0].statusCode).toBe(403);
   });

   it("returns 404 when payment not found", async () => {
     const req = {
       user: { id: "user-1", isAdmin: true },
       params: { orderId: "order-999" },
     };
     const res = mockRes();
     const next = mockNext();

     prisma.payment.findUnique.mockResolvedValue(null);

     await getPaymentByOrder(req, res, next);

     expect(next).toHaveBeenCalledWith(expect.any(AppError));
     expect(next.mock.calls[0][0].statusCode).toBe(404);
   });

   it("rejects when payment is not in PAID status", async () => {
     const req = {
       user: { id: "admin-1", isAdmin: true },
       params: { orderId: "order-1" },
     };
     const res = mockRes();
     const next = mockNext();

     prisma.payment.findUnique.mockResolvedValue({
       id: "payment-1",
       orderId: "order-1",
       status: "PENDING",
     });

     await refundPayment(req, res, next);

     expect(next).toHaveBeenCalledWith(expect.any(AppError));
     expect(next.mock.calls[0][0].statusCode).toBe(400);
     expect(next.mock.calls[0][0].message).toContain("Only paid payments");
   });
 });
});
