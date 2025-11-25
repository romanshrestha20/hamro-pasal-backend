import { prisma } from "../lib/prismaClient.js";
import { AppError } from "../utils/AppError.js";


export const createProduct = async (req, res, next) => {
  try {
    const {
      name,
      description,
      price,
      rating,
      stock,
      isActive,
      tags,
      image,
      galleryImages
    } = extractCreateProductData(req);

    if (!name || !description || price == null) {
      throw new AppError("name, description and price are required", 400);
    }

    const product = await prisma.product.create({
      data: {
        name,
        description,
        price: new prisma.Decimal(String(price)),
        rating: rating || undefined,
        stock: stock || undefined,
        isActive,
        tags,
        image,
        images: {
          create: galleryImages.map((url) => ({ url })),
        },
      },
      include: { images: true }
    });

    res.status(201).json(product);
  } catch (err) {
    next(err);
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

export const getFeaturedProducts = async (req, res, next) => {
  try {
    const response = await prisma.product.findMany({
      where: { isFeatured: true },
      include: { images: true, categories: true },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

export function extractCreateProductData(req) {
  const body = req.body;

  // Convert numeric fields safely
  const toNumber = (val) => {
    if (val === null || val === undefined || val === "") return undefined;
    const num = Number(val);
    return isNaN(num) ? undefined : num;
  };

  // Convert boolean safely
  const toBoolean = (val) => {
    if (val === "true" || val === true) return true;
    if (val === "false" || val === false) return false;
    return undefined;
  };

  // Normalize tags: can be string, CSV, array, or undefined
  let tags = body.tags;
  if (typeof tags === "string") {
    try {
      // If admin sends JSON: "["tag1","tag2"]"
      const parsed = JSON.parse(tags);
      if (Array.isArray(parsed)) tags = parsed;
    } catch {
      // fallback: CSV "tag1, tag2"
      tags = tags.split(",").map((t) => t.trim());
    }
  }
  if (!Array.isArray(tags)) tags = undefined;

  // Normalize gallery URLs if they exist in body (rare for uploads)
  let imagesFromBody = body.images;
  if (typeof imagesFromBody === "string") {
    try {
      const parsed = JSON.parse(imagesFromBody);
      if (Array.isArray(parsed)) imagesFromBody = parsed;
    } catch {
      imagesFromBody = [imagesFromBody];
    }
  }
  if (!Array.isArray(imagesFromBody)) imagesFromBody = [];

  // When using multer: uploaded files go here
  const imagesFromFiles = (req.files || []).map((file) => ({
    url: `/uploads/${file.filename}`
  }));

  return {
    name: body.name || undefined,
    description: body.description || undefined,

    price: toNumber(body.price),
    rating: toNumber(body.rating),
    stock: toNumber(body.stock),

    isActive: toBoolean(body.isActive),

    tags,

    // Main image (optional)
    image: body.image || undefined,

    // Combine body URLs + uploaded files
    galleryImages: [...imagesFromBody, ...imagesFromFiles.map((i) => i.url)],
  };
}
