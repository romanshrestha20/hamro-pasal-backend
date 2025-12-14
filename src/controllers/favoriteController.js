import { prisma } from "../lib/prismaClient.js";
import { AppError } from "../utils/AppError.js";

export const addToFavorites = async (req, res, next) => {
  try {
    const { productId } = req.body;
    const userId = req?.user?.id;
    if (!userId) throw new AppError("Unauthorized", 401);
    if (!productId) throw new AppError("Product ID is required", 400);

    // Ensure product exists and is active (optional: enforce isActive)
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, isActive: true },
    });
    if (!product) throw new AppError("Product not found", 404);
    if (product.isActive === false) {
      throw new AppError("Cannot favorite inactive product", 400);
    }

    try {
      const created = await prisma.favorite.create({
        data: { userId, productId },
        include: { product: true },
      });
      return res.status(201).json(created);
    } catch (err) {
      // Handle unique constraint (already favorited) idempotently
      if (err && err.code === "P2002") {
        const existing = await prisma.favorite.findUnique({
          where: { userId_productId: { userId, productId } },
          include: { product: true },
        });
        return res.status(200).json(existing);
      }
      throw err;
    }
  } catch (error) {
    next(error);
  }
};

// List current user's favorites
export const getMyFavorites = async (req, res, next) => {
  try {
    const userId = req?.user?.id;
    if (!userId) throw new AppError("Unauthorized", 401);

    const favorites = await prisma.favorite.findMany({
      where: { userId },
      include: { product: true },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json(favorites);
  } catch (error) {
    next(error);
  }
};

// Optional: admin list of all favorites
export const getAllFavorites = async (_req, res, next) => {
  try {
    const favorites = await prisma.favorite.findMany({
      include: { product: true, user: { select: { id: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json(favorites);
  } catch (error) {
    next(error);
  }
};

export const removeFromFavorites = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const userId = req?.user?.id;
    if (!userId) throw new AppError("Unauthorized", 401);
    if (!productId) throw new AppError("Product ID is required", 400);

    const removed = await prisma.favorite.delete({
      where: { userId_productId: { userId, productId } },
    });
    res.status(200).json({ message: "Removed from favorites", data: removed });
  } catch (error) {
    // If record not found, surface a 404
    if (error && error.code === "P2025") {
      return next(new AppError("Favorite not found", 404));
    }
    next(error);
  }
};

// Get a specific favorite (by product) for current user
export const getMyFavoriteByProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const userId = req?.user?.id;
    if (!userId) throw new AppError("Unauthorized", 401);
    if (!productId) throw new AppError("Product ID is required", 400);

    const favorite = await prisma.favorite.findUnique({
      where: { userId_productId: { userId, productId } },
      include: { product: true },
    });
    if (!favorite) return res.status(404).json({ message: "Not favorited" });
    res.status(200).json(favorite);
  } catch (error) {
    next(error);
  }
};

// Toggle favorite: if exists remove, otherwise add
export const toggleFavorite = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const userId = req?.user?.id;
    if (!userId) throw new AppError("Unauthorized", 401);
    if (!productId) throw new AppError("Product ID is required", 400);

    const existing = await prisma.favorite.findUnique({
      where: { userId_productId: { userId, productId } },
    });

    if (existing) {
      const removed = await prisma.favorite.delete({
        where: { userId_productId: { userId, productId } },
      });
      return res.status(200).json({ toggled: "removed", data: removed });
    }

    // Ensure product exists and is active before creating
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, isActive: true },
    });
    if (!product) throw new AppError("Product not found", 404);
    if (product.isActive === false) {
      throw new AppError("Cannot favorite inactive product", 400);
    }

    const created = await prisma.favorite.create({
      data: { userId, productId },
      include: { product: true },
    });
    return res.status(201).json({ toggled: "added", data: created });
  } catch (error) {
    if (error && error.code === "P2025") {
      return next(new AppError("Favorite not found", 404));
    }
    next(error);
  }
};
