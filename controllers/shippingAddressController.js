import { prisma } from "../lib/prismaClient.js";
import { AppError } from "../utils/AppError.js";

/**
 * Validate shipping address input
 */
const validateAddress = (data) => {
  const fields = [
    "fullName",
    "phone",
    "address",
    "city",
    "postalCode",
    "country",
  ];
  for (const f of fields) {
    if (!data[f]) throw new AppError(`Missing field: ${f}`, 400);
  }
};

/**
 * POST /api/orders/:orderId/address
 * Create shipping address (once per order)
 */
export const createShippingAddress = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;
    const data = req.body;
    validateAddress(data);

    // Check if order exists and belongs to user
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order || order.userId !== userId) {
      throw new AppError("Order not found", 404);
    }

    // Check if shipping address already exists for this order
    const existingAddress = await prisma.shippingAddress.findUnique({
      where: { orderId: orderId },
    });
    if (existingAddress) {
      throw new AppError("Shipping address already exists for this order", 400);
    }
    const address = await prisma.shippingAddress.create({
      data: {
        orderId,
        fullName: data.fullName,
        phone: data.phone,
        address: data.address,
        city: data.city,
        postalCode: data.postalCode,
        country: data.country,
      },
    });
    res.status(201).json({ success: true, data: address });
  } catch (error) {
    next(error);
  }
};

/** * PATCH /api/orders/:orderId/address
 * Update shipping address
 */
export const updateShippingAddress = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;
    const isAdmin = !!req?.user?.isAdmin;
    const data = req.body;
    validateAddress(data);
    // Check if order exists and belongs to user or is admin
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order || (order.userId !== userId && !isAdmin)) {
      throw new AppError("Order not found", 404);
    }

    // Check if shipping address exists for this order
    const existingAddress = await prisma.shippingAddress.findUnique({
      where: { orderId: orderId },
    });
    if (!existingAddress) {
      throw new AppError("Shipping address not found for this order", 404);
    }

    const updatedAddress = await prisma.shippingAddress.update({
      where: { orderId: orderId },
      data: {
        fullName: data.fullName,
        phone: data.phone,
        address: data.address,
        city: data.city,
        postalCode: data.postalCode,
        country: data.country,
      },
    });
    res.status(200).json({ success: true, data: updatedAddress });
  } catch (error) {
    next(error);
  }
};

/** * GET /api/orders/:orderId/address
 * Get shipping address for an order
 */
export const getShippingAddress = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;
    const isAdmin = !!req?.user?.isAdmin;

    // Check if order exists and belongs to user or is admin
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order || (order.userId !== userId && !isAdmin)) {
      throw new AppError("Order not found", 404);
    }

    // Get shipping address for this order
    const address = await prisma.shippingAddress.findUnique({
      where: { orderId: orderId },
    });
    if (!address) {
      throw new AppError("Shipping address not found for this order", 404);
    }
    res.status(200).json({ success: true, data: address });
  } catch (error) {
    next(error);
  }
};

/** * DELETE /api/orders/:orderId/address
 * Delete shipping address for an order
 */
export const deleteShippingAddress = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    // Check if order exists and belongs to user
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order || order.userId !== userId) {
      throw new AppError("Order not found", 404);
    }

    // Check if shipping address exists for this order
    const existingAddress = await prisma.shippingAddress.findUnique({
      where: { orderId: orderId },
    });
    if (!existingAddress) {
      throw new AppError("Shipping address not found for this order", 404);
    }

    await prisma.shippingAddress.delete({
      where: { orderId: orderId },
    });
    res
      .status(200)
      .json({ success: true, message: "Shipping address deleted" });
  } catch (error) {
    next(error);
  }
};
