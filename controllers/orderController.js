import { prisma } from "../lib/prismaClient.js";
import { Prisma } from "@prisma/client";
import { AppError } from "../utils/AppError.js";

/**
 * Configuration – adjust as you like
 */
const TAX_RATE = 0.15; // 15% tax
const BASE_SHIPPING_FEE = new Prisma.Decimal(0); // flat fee, or set from env
const DEFAULT_DISCOUNT = new Prisma.Decimal(0);

/**
 * Basic runtime validation for createOrder input
 */
const validateCreateOrderInput = (body) => {
  if (!body || typeof body !== "object") {
    throw new AppError("Invalid request body", 400);
  }

  const { items, shippingAddress, paymentMethod } = body;

  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError("Order must contain at least one item", 400);
  }

  for (const item of items) {
    if (!item.productId) {
      throw new AppError("Each item must include productId", 400);
    }
    const qty = Number(item.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new AppError("Each item must have a positive quantity", 400);
    }
  }

  if (shippingAddress) {
    const requiredAddressFields = [
      "fullName",
      "phone",
      "address",
      "city",
      "postalCode",
      "country",
    ];
    for (const field of requiredAddressFields) {
      if (!shippingAddress[field]) {
        throw new AppError(`Missing shipping address field: ${field}`, 400);
      }
    }
  }

  if (paymentMethod && typeof paymentMethod !== "string") {
    throw new AppError("Invalid paymentMethod", 400);
  }
};

/**
 * Compute totals and build normalized orderItems data with product snapshots
 */
const computeOrderTotals = async (items = []) => {
  const productIds = items.map((it) => it.productId);

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

  const productMap = new Map(products.map((p) => [p.id, p]));
  let subtotal = new Prisma.Decimal(0);

  const orderItemsData = items.map((it) => {
    const product = productMap.get(it.productId);
    if (!product) throw new AppError(`Product not found: ${it.productId}`, 404);
    if (!product.isActive)
      throw new AppError(`Product inactive: ${product.name}`, 400);

    const qty = Number(it.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new AppError("Invalid quantity", 400);
    }
    if (qty > product.stock) {
      throw new AppError(`Not enough stock for product: ${product.name}`, 400);
    }

    const unitPrice = new Prisma.Decimal(product.price);
    const lineSubtotal = unitPrice.mul(qty);

    subtotal = subtotal.add(lineSubtotal);

    return {
      productId: it.productId,
      quantity: qty,
      unitPrice,
      discount: DEFAULT_DISCOUNT, // per-item discount placeholder
      tax: new Prisma.Decimal(0), // can be used per line if you want
      subtotal: lineSubtotal,
      productName: product.name,
      productImage: product.image,
      status: "PENDING",
    };
  });

  const tax = subtotal.mul(TAX_RATE);
  const shippingFee = BASE_SHIPPING_FEE;
  const discount = DEFAULT_DISCOUNT;
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

/**
 * POST /api/orders
 * Create a new order from items + optional shipping address + optional payment
 */
export const createOrder = async (req, res, next) => {
  try {
    const userId = req?.user?.id || req.body.userId;
    if (!userId) throw new AppError("Unauthorized", 401);

    validateCreateOrderInput(req.body);

    const { items, shippingAddress, paymentMethod, paymentProvider } = req.body;

    const totals = await computeOrderTotals(items);

    const order = await prisma.$transaction(async (tx) => {
      // Decrease stock safely (race-condition aware)
      for (const item of totals.orderItemsData) {
        const updated = await tx.product.updateMany({
          where: {
            id: item.productId,
            stock: { gte: item.quantity },
          },
          data: {
            stock: { decrement: item.quantity },
          },
        });

        if (updated.count === 0) {
          throw new AppError(
            "Stock changed while placing order. Please try again.",
            409
          );
        }
      }

      // Create Order with nested OrderItems
      const createdOrder = await tx.order.create({
        data: {
          userId,
          subtotal: totals.subtotal,
          total: totals.total,
          tax: totals.tax,
          discount: totals.discount,
          shippingFee: totals.shippingFee,
          status: "PENDING",
          orderItems: {
            create: totals.orderItemsData.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              discount: i.discount,
              tax: i.tax,
              subtotal: i.subtotal,
              productName: i.productName,
              productImage: i.productImage,
              status: i.status,
            })),
          },
        },
      });

      // Optional Shipping Address
      if (shippingAddress) {
        await tx.shippingAddress.create({
          data: {
            orderId: createdOrder.id,
            fullName: shippingAddress.fullName,
            phone: shippingAddress.phone,
            address: shippingAddress.address,
            city: shippingAddress.city,
            postalCode: shippingAddress.postalCode,
            country: shippingAddress.country,
          },
        });
      }

      // Optional Payment (e.g. COD, STRIPE, ESEWA, etc.)
      if (paymentMethod || paymentProvider) {
        await tx.payment.create({
          data: {
            orderId: createdOrder.id,
            amount: totals.total,
            status: "PENDING", // matches PaymentStatus enum
            provider: paymentProvider || paymentMethod || "UNKNOWN",
            transactionId: null,
          },
        });
      }

      // Return full order with relations
      const fullOrder = await tx.order.findUnique({
        where: { id: createdOrder.id },
        include: {
          orderItems: true,
          payment: true,
          shippingAddress: true,
        },
      });

      return fullOrder;
    });

    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/orders/my
 * Get orders for logged-in user
 */
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
        shippingAddress: true,
      },
    });

    res.status(200).json(orders);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/orders
 * Admin: get all orders (add admin middleware or check here)
 */
export const getAllOrders = async (req, res, next) => {
  try {
    const isAdmin = !!req?.user?.isAdmin;
    if (!isAdmin) throw new AppError("Forbidden", 403);

    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          orderItems: true,
          payment: true,
          shippingAddress: true,
        },
      }),
      prisma.order.count(),
    ]);

    res.status(200).json({
      data: orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/orders/:id
 * Owner or admin can view
 */
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
        shippingAddress: true,
      },
    });

    if (!order) throw new AppError("Order not found", 404);

    const isOwner = order.userId === req?.user?.id;
    const isAdmin = !!req?.user?.isAdmin;

    if (!isOwner && !isAdmin) {
      throw new AppError("Forbidden", 403);
    }

    res.status(200).json(order);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/orders/:id/status
 * Admin only – update order status
 */
export const updateOrderStatus = async (req, res, next) => {
  try {
    const isAdmin = !!req?.user?.isAdmin;
    if (!isAdmin) throw new AppError("Forbidden", 403);

    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = [
      "PENDING",
      "PAID",
      "SHIPPED",
      "DELIVERED",
      "CANCELED",
    ];

    if (!allowedStatuses.includes(status)) {
      throw new AppError("Invalid order status", 400);
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { status },
      include: {
        orderItems: true,
        payment: true,
        shippingAddress: true,
      },
    });

    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/orders/:id/cancel
 * User cancels own order if still PENDING
 */
export const cancelMyOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req?.user?.id;
    if (!userId) throw new AppError("Unauthorized", 401);

    const existing = await prisma.order.findUnique({
      where: { id },
      include: { orderItems: true, payment: true },
    });

    if (!existing) throw new AppError("Order not found", 404);
    if (existing.userId !== userId) throw new AppError("Forbidden", 403);

    if (existing.status !== "PENDING") {
      throw new AppError("Order cannot be canceled at this stage", 400);
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      // Restore stock
      for (const item of existing.orderItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }

      // Update order status
      const order = await tx.order.update({
        where: { id },
        data: { status: "CANCELED" },
        include: {
          orderItems: true,
          payment: true,
          shippingAddress: true,
        },
      });

      // (Optional) update payment status if needed – e.g. mark REFUNDED for prepaid
      // if (order.payment && order.payment.status === "COMPLETED") {
      //   await tx.payment.update({
      //     where: { orderId: order.id },
      //     data: { status: "REFUNDED" },
      //   });
      // }

      return order;
    });

    res.status(200).json(updatedOrder);
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
