import { PrismaClient, Prisma } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient();

// Configuration
const DUMMY_API_URL = process.env.DUMMYJSON_API_URL || "https://dummyjson.com";
const PRODUCT_LIMIT = 100; // adjust as needed
const FEATURED_MIN_RATING = 4.6; // mark high-rated as featured

async function fetchDummyProducts(limit = 50) {
  const url = `${DUMMY_API_URL}/products?limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch dummy products: ${res.status}`);
  const data = await res.json();
  return data.products || [];
}

function transformDummyProduct(p) {
  return {
    name: p.title,
    description: p.description,
    price: new Prisma.Decimal(p.price),
    rating: p.rating ?? 0,
    stock: p.stock ?? 0,
    isActive: true,
    isFeatured: (p.rating ?? 0) >= FEATURED_MIN_RATING,
    tags: [p.category, p.brand].filter(Boolean),
    image: p.thumbnail,
    images: p.images || [],
    categoryName: p.category, // for relation handling
  };
}

async function ensureCategory(name) {
  if (!name) return null;
  const existing = await prisma.category.findUnique({ where: { name } });
  if (existing) return existing.id;
  const created = await prisma.category.create({ data: { name } });
  return created.id;
}

async function upsertProduct(prod) {
  // Check for existing by name (simple heuristic)
  const existing = await prisma.product.findFirst({
    where: { name: prod.name },
  });
  const categoryId = await ensureCategory(prod.categoryName);

  if (existing) {
    // Update minimal mutable fields, skip images to avoid duplicates
    return prisma.product.update({
      where: { id: existing.id },
      data: {
        description: prod.description,
        price: prod.price,
        rating: prod.rating,
        stock: prod.stock,
        isActive: true,
        isFeatured: prod.isFeatured,
        tags: prod.tags,
        image: prod.image,
        categories: categoryId ? { connect: [{ id: categoryId }] } : undefined,
      },
    });
  }

  return prisma.product.create({
    data: {
      name: prod.name,
      description: prod.description,
      price: prod.price,
      rating: prod.rating,
      stock: prod.stock,
      isActive: true,
      isFeatured: prod.isFeatured,
      tags: prod.tags,
      image: prod.image,
      categories: categoryId ? { connect: [{ id: categoryId }] } : undefined,
      images: prod.images.length
        ? { create: prod.images.map((url) => ({ url })) }
        : undefined,
    },
  });
}

async function seedDummyProducts() {
  console.log(`Fetching up to ${PRODUCT_LIMIT} dummy products...`);
  const raw = await fetchDummyProducts(PRODUCT_LIMIT);
  console.log(`Fetched ${raw.length} products.`);

  let created = 0;
  let updated = 0;

  // Process sequentially to avoid overwhelming DB (can batch if needed)
  for (const p of raw) {
    const transformed = transformDummyProduct(p);
    try {
      const result = await upsertProduct(transformed);
      if (result.createdAt === result.updatedAt) created += 1;
      else updated += 1;
      console.log(`✔ ${transformed.name}`);
    } catch (err) {
      console.error(`✖ Failed for ${transformed.name}:`, err.message);
    }
  }

  const total = await prisma.product.count();
  console.log(
    `Dummy seed complete. Created: ${created}, Updated: ${updated}. Total products now: ${total}.`
  );
}

seedDummyProducts()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
