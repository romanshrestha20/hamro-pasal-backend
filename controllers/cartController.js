import { prisma } from "../lib/prismaClient.js";
import { AppError } from "../utils/AppError.js";

/**
 * Get user's cart with all items
 */
export const getCart = async (req, res, next) => {
  try {
    const userId = req.user.id;

    let cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                description: true,
                price: true,
                image: true,
                stock: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    // Create cart if it doesn't exist
    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });
    }

    res.status(200).json({
      success: true,
      data: cart,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add product to cart (or increment quantity if already exists)
 */
export const addToCart = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { productId, quantity = 1 } = req.body;

    if (!productId) {
      throw new AppError("Product ID is required", 400);
    }

    if (quantity < 1) {
      throw new AppError("Quantity must be at least 1", 400);
    }

    // Verify product exists and is active
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, price: true, stock: true, isActive: true },
    });

    if (!product) {
      throw new AppError("Product not found", 404);
    }

    if (!product.isActive) {
      throw new AppError("Product is not available", 400);
    }

    // Find or create cart for user
    const cart = await prisma.cart.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    // Add item to cart or increment quantity
    const item = await prisma.cartItem.upsert({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId,
        },
      },
      update: {
        quantity: {
          increment: quantity,
        },
      },
      create: {
        cartId: cart.id,
        productId,
        quantity,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            image: true,
            stock: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "Item added to cart",
      data: item,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update cart item quantity to a specific value
 */
export const updateCartItem = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { productId, quantity } = req.body;

    if (!productId) {
      throw new AppError("Product ID is required", 400);
    }

    if (quantity < 1) {
      throw new AppError("Quantity must be at least 1", 400);
    }

    // Find user's cart
    const cart = await prisma.cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      throw new AppError("Cart not found", 404);
    }

    // Verify product exists and check stock
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, price: true, stock: true, isActive: true },
    });

    if (!product) {
      throw new AppError("Product not found", 404);
    }

    if (quantity > product.stock) {
      throw new AppError(`Only ${product.stock} items available in stock`, 400);
    }

    // Update cart item quantity
    const item = await prisma.cartItem.upsert({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId,
        },
      },
      update: { quantity },
      create: {
        cartId: cart.id,
        productId,
        quantity,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            image: true,
            stock: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "Cart item updated",
      data: item,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove item from cart
 */
export const removeFromCart = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { productId } = req.body;

    if (!productId) {
      throw new AppError("Product ID is required", 400);
    }

    // Find user's cart
    const cart = await prisma.cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      throw new AppError("Cart not found", 404);
    }

    // Find cart item
    const cartItem = await prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId,
        },
      },
    });

    if (!cartItem) {
      throw new AppError("Item not found in cart", 404);
    }

    // Delete cart item
    await prisma.cartItem.delete({
      where: { id: cartItem.id },
    });

    res.status(200).json({
      success: true,
      message: "Item removed from cart",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Clear entire cart (remove all items)
 */
export const clearCart = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Find user's cart
    const cart = await prisma.cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      throw new AppError("Cart not found", 404);
    }

    // Delete all cart items atomically and update cart's updatedAt
    await prisma.$transaction([
      prisma.cartItem.deleteMany({
        where: { cartId: cart.id },
      }),
      prisma.cart.update({
        where: { id: cart.id },
        data: { updatedAt: new Date() },
      }),
    ]);

    res.status(200).json({
      success: true,
      message: "Cart cleared successfully",
    });
  } catch (error) {
    next(error);
  }
};
