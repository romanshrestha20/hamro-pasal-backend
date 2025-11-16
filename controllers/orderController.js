import { prisma } from "../lib/prismaClient.js";
import { Prisma } from "@prisma/client";
import { AppError } from "../utils/AppError.js";

// Helper to compute total and normalize items
const computeOrderTotals = async (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError("Order must contain at least one item", 400);
  }

  const productIds = items.map((it) => it.productId);

  // Fetch products from DB
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      name: true,
      image: true,
      price: true,
      stock: true,
      isActive: true,
    },
  });

  // Map products by ID for quick lookup 
  const productMap = new Map(products.map((p) => [p.id, p]));

  // Validate items and compute totals
  let subtotal = new Prisma.Decimal(0);

  // Prepare order items data with snapshots
  const orderItemsData = items.map((it) => {
    const product = productMap.get(it.productId);
    if (!product) throw new AppError(`Product not found: ${it.productId}`, 404);
    if (!product.isActive)
      throw new AppError(`Product inactive: ${it.productId}`, 400);

    // Validate quantity
    const qty = Number(it.quantity);
    if (qty <= 0) throw new AppError("Invalid quantity", 400);
    if (qty > product.stock)
      throw new AppError(`Not enough stock for product: ${product.name}`, 400);

    // Compute line total
    const unitPrice = new Prisma.Decimal(product.price);
    const lineTotal = unitPrice.mul(qty);
    subtotal = subtotal.add(lineTotal);

    return {
      productId: it.productId,
      quantity: qty,
      unitPrice,
      productName: product.name,
      productImage: product.image,
      subtotal: lineTotal,
    };
  });

  // extra calculations
  const tax = subtotal.mul(0.15); // example 15%
  const shippingFee = new Prisma.Decimal(0);
  const discount = new Prisma.Decimal(0);

  const total = subtotal.add(tax).add(shippingFee).sub(discount);

  return {
    subtotal,
    tax,
    discount,
    shippingFee,
    total,
    orderItemsData,
  };
};

export const createOrder = async (req, res, next) => {
  try {
    const userId = req?.user?.id || req.body.userId;
    if (!userId) throw new AppError("Unauthorized", 401);

    const { items } = req.body;

    // Compute totals, validate data, prepare snapshots
    const totals = await computeOrderTotals(items);

    // Use transaction to ensure atomicity 
    const result = await prisma.$transaction(async (tx) => {
      // Decrease stock
      for (const item of totals.orderItemsData) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      // Create order inside transaction
      const order = await tx.order.create({
        data: {
          userId,
          subtotal: totals.subtotal,
          total: totals.total,
          tax: totals.tax,
          discount: totals.discount,
          shippingFee: totals.shippingFee,
          orderItems: {
            create: totals.orderItemsData.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              subtotal: i.subtotal,
              productName: i.productName,
              productImage: i.productImage,
            })),
          },
        },
        include: { orderItems: true },
      });

      return order;
    });

    res.status(201).json(result);
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
        orderItems: true,
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

    if (order.status !== "PENDING")
      throw new AppError("Order cannot be canceled at this stage", 400);

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
