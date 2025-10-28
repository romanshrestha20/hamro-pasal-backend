import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const products = [
  {
    name: "Wireless Headphones",
    description:
      "Comfortable over-ear Bluetooth headphones with noise cancellation.",
    price: new Prisma.Decimal("99.99"),
    rating: 4.5,
    stock: 120,
    image: "headphones.jpg",
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
    image: "smartwatch.jpg",
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
    image: "mouse.jpg",
    tags: ["gaming", "accessories"],
    isActive: true,
  },
  {
    name: "Mechanical Keyboard",
    description: "Tactile switches, full-size layout, and per-key RGB.",
    price: new Prisma.Decimal("79.99"),
    rating: 4.7,
    stock: 150,
    image: "keyboard.jpg",
    tags: ["gaming", "accessories"],
    isActive: true,
  },
  {
    name: "4K Monitor",
    description: "27-inch IPS panel with HDR support and thin bezels.",
    price: new Prisma.Decimal("299.99"),
    rating: 4.4,
    stock: 60,
    image: "monitor.jpg",
    tags: ["electronics", "display"],
    isActive: true,
  },
  {
    name: "USB-C Hub",
    description: "7-in-1 hub with HDMI, USB 3.0, and SD card reader.",
    price: new Prisma.Decimal("29.99"),
    rating: 4.1,
    stock: 300,
    image: "hub.jpg",
    tags: ["accessories"],
    isActive: true,
  },
  {
    name: "Portable SSD",
    description: "1TB NVMe portable SSD with USB 3.2 Gen 2 performance.",
    price: new Prisma.Decimal("119.99"),
    rating: 4.8,
    stock: 90,
    image: "ssd.jpg",
    tags: ["storage"],
    isActive: true,
  },
  {
    name: "Bluetooth Speaker",
    description: "Water-resistant speaker with deep bass and 12-hour battery.",
    price: new Prisma.Decimal("49.99"),
    rating: 4.3,
    stock: 180,
    image: "speaker.jpg",
    tags: ["audio"],
    isActive: true,
  },
];

async function main() {
  console.log("Seeding products...");
  // Clear existing data (order matters if there are FKs)
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.product.deleteMany();

  await prisma.product.createMany({ data: products });

  const count = await prisma.product.count();
  console.log(`Seeded ${count} products.`);
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
