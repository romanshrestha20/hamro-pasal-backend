import { prisma } from "../lib/prismaClient.js";
import { AppError } from "../utils/AppError.js";

export const createProduct = async (req, res, next) => {
  const {
    name,
    description,
    price,
    rating,
    stock,
    image,
    images,
    tags,
    isActive,
  } = req.body;

  try {
    if (!name || !description || price == null) {
      throw new AppError("name, description and price are required", 400);
    }

    const data = {
      name,
      description,
      price: new Prisma.Decimal(String(price)),
      rating: typeof rating === "number" ? rating : undefined,
      stock: typeof stock === "number" ? stock : undefined,
      image: image || undefined,
      tags: Array.isArray(tags) ? tags : undefined,
      isActive: typeof isActive === "boolean" ? isActive : undefined,
    };

    // Nested images create if provided as array of URLs
    if (Array.isArray(images) && images.length > 0) {
      data.images = {
        create: images.filter(Boolean).map((url) => ({ url })),
      };
    }

    const response = await prisma.product.create({
      data,
      include: { images: true, categories: true },
    });

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

export const getProducts = async (req, res, next) => {
  try {
    const response = await prisma.product.findMany({
      include: { images: true, categories: true },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

export const getProductById = async (req, res, next) => {
  const { id } = req.params;

  try {
    const response = await prisma.product.findUnique({
      where: { id },
      include: { images: true, categories: true },
    });
    if (!response) {
      throw new AppError("Product not found", 404);
    }
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req, res, next) => {
  const { id } = req.params;
  const { name, description, price, stock, tags, isActive, image } = req.body;

  try {
    const response = await prisma.product.update({
      where: { id },
      data: {
        name,
        description,
        price: price != null ? new Prisma.Decimal(String(price)) : undefined,
        stock: typeof stock === "number" ? stock : undefined,
        tags: Array.isArray(tags) ? tags : undefined,
        isActive: typeof isActive === "boolean" ? isActive : undefined,
        image: image || undefined,
      },
      include: { images: true, categories: true },
    });
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};
export const deleteProduct = async (req, res, next) => {
  const { id } = req.params;

  try {
    const response = await prisma.product.delete({
      where: { id },
    });
    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    next(error);
  }
};

export const searchProducts = async (req, res, next) => {
  // Support both /search?q=query and /search/:query formats
  const q = req.query.q || req.params.query;

  try {
    if (!q || String(q).trim().length === 0) {
      return res.status(200).json([]);
    }
    const response = await prisma.product.findMany({
      where: {
        OR: [
          {
            name: {
              contains: q,
              mode: "insensitive",
            },
          },
          {
            categories: {
              some: {
                name: {
                  contains: q,
                  mode: "insensitive",
                },
              },
            },
          },
          {
            description: {
              contains: q,
              mode: "insensitive",
            },
          },
          {
            tags: {
              hasSome: [q],
            },
          },
        ],
      },
      include: { images: true, categories: true },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

export const getAllCategories = async (req, res, next) => {
  try {
    const response = await prisma.category.findMany({
      orderBy: { name: "asc" },
    });
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req, res, next) => {
  const { name } = req.body;

  try {
    const response = await prisma.category.create({
      data: {
        name,
      },
    });
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

export const getProductsbyCategory = async (req, res, next) => {
  const categoryId = req.params.categoryId;

  try {
    const response = await prisma.product.findMany({
      where: {
        categories: {
          some: {
            id: categoryId,
          },
        },
      },
      include: { images: true, categories: true },
    });
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};
