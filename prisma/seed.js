import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const categories = [
  { name: "Electronics" },
  { name: "Audio" },
  { name: "Gaming" },
  { name: "Accessories" },
  { name: "Storage" },
  { name: "Display" },
];

const products = [
  {
    name: "Wireless Headphones",
    description:
      "Comfortable over-ear Bluetooth headphones with noise cancellation.",
    price: new Prisma.Decimal("99.99"),
    rating: 4.5,
    stock: 120,
    image:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop",
    tags: ["electronics", "audio"],
    isActive: true,
  },
  {
    name: "Smart Watch",
    description:
      "Fitness tracking, heart-rate monitor, and notifications on your wrist.",
    price: new Prisma.Decimal("149.99"),
    rating: 4.2,
    stock: 80,
    image:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop",
    tags: ["electronics", "wearable"],
    isActive: true,
  },
  {
    name: "Gaming Mouse",
    description:
      "High-precision optical sensor with customizable DPI and RGB lighting.",
    price: new Prisma.Decimal("39.99"),
    rating: 4.6,
    stock: 200,
    image:
      "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400&h=400&fit=crop",
    tags: ["gaming", "accessories"],
    isActive: true,
  },
  {
    name: "Mechanical Keyboard",
    description: "Tactile switches, full-size layout, and per-key RGB.",
    price: new Prisma.Decimal("79.99"),
    rating: 4.7,
    stock: 150,
    image:
      "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&h=400&fit=crop",
    tags: ["gaming", "accessories"],
    isActive: true,
  },
  {
    name: "4K Monitor",
    description: "27-inch IPS panel with HDR support and thin bezels.",
    price: new Prisma.Decimal("299.99"),
    rating: 4.4,
    stock: 60,
    image:
      "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400&h=400&fit=crop",
    tags: ["electronics", "display"],
    isActive: true,
  },
  {
    name: "USB-C Hub",
    description: "7-in-1 hub with HDMI, USB 3.0, and SD card reader.",
    price: new Prisma.Decimal("29.99"),
    rating: 4.1,
    stock: 300,
    image:
      "https://images.unsplash.com/photo-1625948515291-69613efd103f?w=400&h=400&fit=crop",
    tags: ["accessories"],
    isActive: true,
  },
  {
    name: "Portable SSD",
    description: "1TB NVMe portable SSD with USB 3.2 Gen 2 performance.",
    price: new Prisma.Decimal("119.99"),
    rating: 4.8,
    stock: 90,
    image:
      "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=400&h=400&fit=crop",
    tags: ["storage"],
    isActive: true,
  },
  {
    name: "Bluetooth Speaker",
    description: "Water-resistant speaker with deep bass and 12-hour battery.",
    price: new Prisma.Decimal("49.99"),
    rating: 4.3,
    stock: 180,
    image:
      "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&h=400&fit=crop",
    tags: ["audio"],
    isActive: true,
  },
];

async function main() {
  console.log("Seeding database...");

  // Clear existing data (order matters for foreign keys)
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();

  // Create categories first
  console.log("Creating categories...");
  const createdCategories = await prisma.category.createMany({
    data: categories,
    skipDuplicates: true,
  });
  console.log(`Created ${createdCategories.count} categories.`);

  // Fetch created categories to get their IDs
  const allCategories = await prisma.category.findMany();
  const categoryMap = {
    Electronics: allCategories.find((c) => c.name === "Electronics")?.id,
    Audio: allCategories.find((c) => c.name === "Audio")?.id,
    Gaming: allCategories.find((c) => c.name === "Gaming")?.id,
    Accessories: allCategories.find((c) => c.name === "Accessories")?.id,
    Storage: allCategories.find((c) => c.name === "Storage")?.id,
    Display: allCategories.find((c) => c.name === "Display")?.id,
  };

  // Create products with category associations
  console.log("Creating products...");

  await prisma.product.create({
    data: {
      ...products[0],
      categories: {
        connect: [{ id: categoryMap.Electronics }, { id: categoryMap.Audio }],
      },
    },
  });

  await prisma.product.create({
    data: {
      ...products[1],
      categories: {
        connect: [{ id: categoryMap.Electronics }],
      },
    },
  });

  await prisma.product.create({
    data: {
      ...products[2],
      categories: {
        connect: [{ id: categoryMap.Gaming }, { id: categoryMap.Accessories }],
      },
    },
  });

  await prisma.product.create({
    data: {
      ...products[3],
      categories: {
        connect: [{ id: categoryMap.Gaming }, { id: categoryMap.Accessories }],
      },
    },
  });

  await prisma.product.create({
    data: {
      ...products[4],
      categories: {
        connect: [{ id: categoryMap.Electronics }, { id: categoryMap.Display }],
      },
    },
  });

  await prisma.product.create({
    data: {
      ...products[5],
      categories: {
        connect: [{ id: categoryMap.Accessories }],
      },
    },
  });

  await prisma.product.create({
    data: {
      ...products[6],
      categories: {
        connect: [{ id: categoryMap.Electronics }, { id: categoryMap.Storage }],
      },
    },
  });

  await prisma.product.create({
    data: {
      ...products[7],
      categories: {
        connect: [{ id: categoryMap.Audio }],
      },
    },
  });

  const productCount = await prisma.product.count();
  console.log(`Seeded ${productCount} products with categories.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
