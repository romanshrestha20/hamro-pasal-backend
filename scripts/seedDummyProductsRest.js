import "dotenv/config";

// Uses REST API endpoints to seed products from DummyJSON
// Requires an admin user. Provide either:
// 1) ADMIN_JWT in env (already logged in) OR
// 2) SEED_ADMIN_EMAIL & SEED_ADMIN_PASSWORD for automatic login

const API_BASE = process.env.API_BASE_URL || "http://localhost:4000/api";
const DUMMY_API_URL = process.env.DUMMYJSON_API_URL || "https://dummyjson.com";
const LIMIT = Number(process.env.DUMMY_SEED_LIMIT || 50);
const FEATURED_MIN_RATING = Number(
  process.env.DUMMY_FEATURED_MIN_RATING || 4.6
);

async function loginIfNeeded() {
  if (process.env.ADMIN_JWT) {
    return process.env.ADMIN_JWT;
  }
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Provide ADMIN_JWT or SEED_ADMIN_EMAIL & SEED_ADMIN_PASSWORD in .env for seeding"
    );
  }
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login failed: ${res.status}`);
  }
  const data = await res.json();
  if (!data.token) throw new Error("Login response missing token");
  return data.token;
}

async function fetchExistingProducts(token) {
  const res = await fetch(`${API_BASE}/products`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok)
    throw new Error(`Failed to fetch existing products: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function fetchDummyProducts(limit) {
  const res = await fetch(`${DUMMY_API_URL}/products?limit=${limit}`);
  if (!res.ok) throw new Error(`Failed to fetch dummy products: ${res.status}`);
  const data = await res.json();
  return data.products || [];
}

function transform(p) {
  return {
    name: p.title,
    description: p.description,
    price: p.price,
    rating: p.rating,
    stock: p.stock,
    isActive: true,
    tags: [p.category, p.brand].filter(Boolean),
    image: p.thumbnail,
    galleryImages: p.images || [],
    isFeatured: (p.rating ?? 0) >= FEATURED_MIN_RATING,
  };
}

async function ensureCategory(name, token) {
  if (!name) return;
  // Create category; duplicates will error -> ignore
  const res = await fetch(`${API_BASE}/products/categories`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name }),
  });
  // Ignore non-201 responses (category may already exist)
}

async function createProduct(prod, token) {
  const res = await fetch(`${API_BASE}/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(prod),
  });
  if (res.status === 400 || res.status === 409) {
    const msg = await res.text();
    return { skipped: true, reason: msg };
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function run() {
  console.log("Starting REST dummy product seeding...");
  const token = await loginIfNeeded();
  console.log("Authenticated as admin.");

  const existing = await fetchExistingProducts(token);
  const existingNames = new Set(existing.map((p) => p.name));
  console.log(`Loaded ${existingNames.size} existing product names.`);

  const dummyProducts = await fetchDummyProducts(LIMIT);
  console.log(`Fetched ${dummyProducts.length} dummy products.`);

  // Ensure categories first
  const categorySet = new Set(
    dummyProducts.map((p) => p.category).filter(Boolean)
  );
  for (const cat of categorySet) {
    await ensureCategory(cat, token);
  }
  console.log(`Ensured ${categorySet.size} categories.`);

  let created = 0,
    skipped = 0,
    failed = 0;

  for (const raw of dummyProducts) {
    if (existingNames.has(raw.title)) {
      skipped++;
      continue;
    }
    const prod = transform(raw);
    try {
      const result = await createProduct(prod, token);
      if (result.skipped) {
        skipped++;
        continue;
      }
      created++;
      existingNames.add(prod.name);
      console.log(`✔ Created: ${prod.name}`);
    } catch (e) {
      failed++;
      console.error(`✖ ${prod.name}: ${e.message}`);
    }
  }

  console.log(
    `Seeding complete. Created=${created}, Skipped=${skipped}, Failed=${failed}`
  );
}

run().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
