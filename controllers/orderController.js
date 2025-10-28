import { prisma } from "../lib/prismaClient.js";
import { Prisma } from "@prisma/client";
import { AppError } from "../utils/AppError.js";

// Helper to compute total and normalize items
const computeOrderTotals = async (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError("Order must contain at least one item", 400);
  }

  // Expect items: [{ productId: string, quantity: number }]
  const productIds = items.map((it) => it.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, price: true, stock: true, isActive: true },
  });

  const productMap = new Map(products.map((p) => [p.id, p]));

  let total = new Prisma.Decimal(0);
  const orderItemsData = items.map((it) => {
    const p = productMap.get(it.productId);
    if (!p) throw new AppError(`Product not found: ${it.productId}`, 404);
    if (!p.isActive)
      throw new AppError(`Product inactive: ${it.productId}`, 400);
    const qty = Number(it.quantity) || 0;
    if (qty <= 0) throw new AppError("Quantity must be greater than 0", 400);

    // price is taken from DB to prevent client tampering
    const linePrice = new Prisma.Decimal(p.price);
    const lineTotal = linePrice.mul(qty);
    total = total.add(lineTotal);
    return {
      productId: it.productId,
      quantity: qty,
      price: linePrice,
    };
  });

  return { total, orderItemsData };
};

export const createOrder = async (req, res, next) => {
  try {
    const userId = req?.user?.id || req?.body?.userId; // prefer authenticated user
    if (!userId) throw new AppError("Unauthorized", 401);

    const { items } = req.body;
    const { total, orderItemsData } = await computeOrderTotals(items);

    const order = await prisma.order.create({
      data: {
        userId,
        total,
        orderItems: { create: orderItemsData },
      },
      include: {
        orderItems: true,
      },
    });

    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
};

export const getMyOrders = async (req, res, next) => {
  try {
    const userId = req?.user?.id;
    if (!userId) throw new AppError("Unauthorized", 401);

    const orders = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        orderItems: {
          include: { product: true },
        },
        payment: true,
      },
    });
    res.status(200).json(orders);
  } catch (error) {
    next(error);
  }
};

export const getAllOrders = async (_req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        orderItems: { include: { product: true } },
        payment: true,
      },
    });
    res.status(200).json(orders);
  } catch (error) {
    next(error);
  }
};

export const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        orderItems: { include: { product: true } },
        payment: true,
      },
    });
    if (!order) throw new AppError("Order not found", 404);

    // Authorization: owner or admin can view
    const isOwner = order.userId === req?.user?.id;
    const isAdmin = !!req?.user?.isAdmin;
    if (!isOwner && !isAdmin) throw new AppError("Forbidden", 403);

    res.status(200).json(order);
  } catch (error) {
    next(error);
  }
};

export const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowed = ["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELED"];
    if (!allowed.includes(status)) {
      throw new AppError("Invalid order status", 400);
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { status },
      include: { orderItems: true, payment: true },
    });
    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};

export const cancelMyOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req?.user?.id;
    if (!userId) throw new AppError("Unauthorized", 401);

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) throw new AppError("Order not found", 404);
    if (order.userId !== userId) throw new AppError("Forbidden", 403);
    if (order.status !== "PENDING") {
      throw new AppError("Only pending orders can be canceled", 400);
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { status: "CANCELED" },
    });
    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};

export default {
  createOrder,
  getMyOrders,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  cancelMyOrder,
};
