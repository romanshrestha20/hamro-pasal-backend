// controllers/paymentController.js
import { prisma } from "../lib/prismaClient.js";
import { AppError } from "../utils/AppError.js";

/**
 * POST /api/orders/:orderId/payment
 * Create a payment record (one per order)
 */
export const createPayment = async (req, res, next) => {
  try {
    const user = req?.user;
    if (!user?.id) throw new AppError("Unauthorized", 401);

    const { orderId } = req.params;
    const { provider, method, transactionId } = req.body;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError("Order not found", 404);

    const isOwner = order.userId === user.id;
    const isAdmin = !!user.isAdmin;
    if (!isOwner && !isAdmin) throw new AppError("Forbidden", 403);

    // Only allow payment on non-canceled orders
    if (order.status === "CANCELED") {
      throw new AppError("Cannot create payment for canceled order", 400);
    }

    const existing = await prisma.payment.findUnique({
      where: { orderId },
    });
    if (existing) throw new AppError("Payment already exists", 400);

    const payment = await prisma.payment.create({
      data: {
        orderId,
        amount: order.total,
        provider: provider || method || "UNKNOWN",
        transactionId: transactionId || null,
        status: "PENDING",
      },
    });

    res.status(201).json(payment);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/orders/:orderId/payment/status
 * Typically called from payment gateway or your server-side callback
 * No auth enforced here by design; add auth if needed.
 */
export const updatePaymentStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { status, transactionId } = req.body;

    const allowed = ["PENDING", "PAID", "FAILED", "REFUNDED"];
    if (!allowed.includes(status)) {
      throw new AppError("Invalid payment status", 400);
    }

    const payment = await prisma.payment.findUnique({
      where: { orderId },
    });
    if (!payment) throw new AppError("Payment not found", 404);

    const updated = await prisma.payment.update({
      where: { orderId },
      data: {
        status,
        transactionId: transactionId || payment.transactionId,
      },
    });

    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/orders/:orderId/payment
 * Owner or admin
 */
export const getPaymentByOrder = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user?.id) throw new AppError("Unauthorized", 401);

    const { orderId } = req.params;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError("Order not found", 404);

    const isOwner = order.userId === user.id;
    const isAdmin = !!user.isAdmin;
    if (!isOwner && !isAdmin) throw new AppError("Forbidden", 403);

    const payment = await prisma.payment.findUnique({
      where: { orderId },
    });

    if (!payment) throw new AppError("Payment not found", 404);

    res.status(200).json(payment);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/orders/:orderId/payment/refund
 * Admin-only refund
 */
export const refundPayment = async (req, res, next) => {
  try {
    const isAdmin = !!req?.user?.isAdmin;
    if (!isAdmin) throw new AppError("Forbidden", 403);

    const { orderId } = req.params;

    const payment = await prisma.payment.findUnique({ where: { orderId } });
    if (!payment) throw new AppError("Payment not found", 404);

    if (payment.status !== "PAID") {
      throw new AppError("Only paid payments can be refunded", 400);
    }

    const updated = await prisma.payment.update({
      where: { orderId },
      data: { status: "REFUNDED" },
    });

    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};

export default {
  createPayment,
  updatePaymentStatus,
  getPaymentByOrder,
  refundPayment,
};
