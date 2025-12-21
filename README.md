Great! Based on your project structure and code from the Hamro Pasal backend repo, here's a tailored `README.md` and documentation draft that clearly explains setup, usage, and architecture.

---

## Hamro Pasal Backend

Node.js + Express API for the Hamro Pasal platform. Provides auth, users, products, cart, orders, reviews, and media handling backed by PostgreSQL via Prisma. Uses JWT sessions, cloud storage for images, and includes test and seed tooling.

---

### Contents

- Overview
- Features
- Tech Stack
- Project Structure
- Getting Started
- Scripts
- Environment Variables
- Database & Migrations
- Seeding
- API & Docs
- Security & Hardening
- Logging & Monitoring
- Testing
- Deployment
- Troubleshooting

---

### Overview

- Express 5 (ESM) with modular routes, controllers, and middleware
- Prisma ORM on PostgreSQL with migrations tracked under `prisma/migrations`
- Auth via JWT (HTTP-only cookies) with Google/Apple hooks available
- Media uploads via Multer + Cloudinary storage
- Validation with Zod; centralized error handling
- CORS configured for frontend origins; helmet + rate limiting enabled

---

### Features

- Auth: register, login, logout, change password, profile fetch
- Users: CRUD plus profile image upload
- Catalog: products, categories, search, filters (see controllers/routes)
- Cart & orders: add/update cart items, create and manage orders
- Reviews: product reviews, likes, replies
- Notifications: email (SendGrid) and SMS (Twilio) ready
- Observability: pino + pino-http structured logs
- Testability: Jest with Supertest harness

---

### Tech Stack

| Area | Technologies |
| --- | --- |
| Runtime | Node.js 20+ (ESM) |
| Framework | Express 5 |
| ORM | Prisma 6 (PostgreSQL) |
| Auth | JWT + bcryptjs; Google/Apple OAuth libraries present |
| Validation | Zod |
| File Storage | Multer + Cloudinary (storage adapter) |
| Security | helmet, express-rate-limit, CORS, cookie-parser |
| Mail/SMS | SendGrid, Twilio |
| Logging | pino, pino-http |
| Testing | Jest, Supertest |

---

### Project Structure

```
hamro-pasal-backend/
├── src/
│   ├── server.js           # Entry point (creates HTTP server)
│   ├── app.js              # Express app wiring
│   ├── controllers/        # Route handlers (auth, users, products, orders, etc.)
│   ├── routes/             # Express routers per domain
│   ├── middlewares/        # Auth, error handling, validation, rate limits
│   ├── validators/         # Zod schemas
│   ├── utils/              # Helpers (errors, uploads, tokens)
│   ├── lib/                # Prisma client
│   └── config/             # CORS, rate limit, mail/SMS, cloud storage
├── prisma/                 # schema.prisma, migrations, seeds
├── scripts/                # Seed scripts
├── swagger.yaml            # OpenAPI spec
├── jest.config.js          # Jest setup
└── babel.config.js         # Babel for Jest
```

---

### Getting Started

Prerequisites
- Node.js 20+
- PostgreSQL 14+ (or compatible)

Setup
```bash
git clone https://github.com/romanshrestha20/hamro-pasal-backend.git
cd hamro-pasal-backend
npm install

# Copy env template
cp .env.example .env
# then edit values (database, JWT, mail/SMS, OAuth, Cloudinary, CORS origins)

# Generate Prisma client
npx prisma generate

# Apply migrations (creates DB if needed)
npx prisma migrate dev --name init

# (Optional) seed baseline data
npm run db:seed

# Start development server
npm run dev
# Server listens on PORT (default 5000)
```

---

### Scripts

- `npm run dev` — nodemon with NODE_ENV=development
- `npm start` — production start
- `npm test` — Jest test suite
- `npm run test:watch` — watch mode
- `npm run test:coverage` — coverage report
- `npm run db:seed` — seed core data (see prisma/seed.js)
- `npm run db:seed:dummy` — seed sample products (see prisma/seedDummyProducts.js)

---

### Environment Variables

See [.env.example](.env.example) for the full list. Key values:

- `PORT` — API port (default 5000)
- `DATABASE_URL`, `DIRECT_URL`, `SHADOW_DATABASE_URL` — PostgreSQL connections
- `JWT_SECRET`, `JWT_EXPIRES_IN` — JWT signing
- `FRONTEND_ORIGIN`, `FRONTEND_ORIGIN_1`, `FRONTEND_ORIGIN_2` — allowed CORS origins
- `SENDGRID_API_KEY`, `FROM_EMAIL` — email delivery
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` — SMS delivery
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google OAuth
- `APPLE_*` — Apple OAuth (optional)
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — media storage

Missing critical values will cause startup errors (e.g., JWT_SECRET). Ensure database URLs are reachable from the runtime environment.

---

### Database & Migrations

- Prisma schema lives in [prisma/schema.prisma](prisma/schema.prisma).
- Local dev: `npx prisma migrate dev` applies migrations and updates Prisma Client.
- Deploy: `npx prisma migrate deploy` in your CI/CD pipeline before starting the app.
- Migration history is tracked under [prisma/migrations](prisma/migrations); do not edit existing migrations—create new ones.

---

### Seeding

- Baseline seed: `npm run db:seed` (runs [prisma/seed.js](prisma/seed.js)).
- Dummy catalog data: `npm run db:seed:dummy` (runs [prisma/seedDummyProducts.js](prisma/seedDummyProducts.js)).
- Seeds expect a reachable `DATABASE_URL` and an initialized schema.

---

### API & Docs

- OpenAPI definition at [swagger.yaml](swagger.yaml). Import into Postman or Swagger UI.
- Core route groups (prefixes may be `/api`): auth, users, products, categories, cart, orders, reviews, uploads.
- Auth flow: login/register issue JWT; cookies recommended for browser clients. Refresh endpoints may be handled by the frontend via re-login.

---

### Security & Hardening

- CORS: configured for allowed origins from env vars; update when deploying.
- Cookies: serve JWT tokens as HTTP-only; set `secure` and `sameSite` appropriately per environment.
- Rate limiting: express-rate-limit configured in middleware.
- Headers: helmet applied globally.
- Secrets: never commit `.env`; rotate JWT_SECRET if leaked.

---

### Logging & Monitoring

- pino and pino-http emit structured JSON logs.
- In production, ship logs to your aggregator (Datadog, ELK, etc.).

---

### Testing

- Run `npm test` for Jest + Supertest suites.
- `npm run test:coverage` to view coverage reports (see `coverage/`).
- Tests assume a test database; configure `DATABASE_URL`/`SHADOW_DATABASE_URL` for NODE_ENV=test.

---

### Deployment

- Ensure DATABASE_URL and JWT_SECRET are set in the target environment.
- Run `npx prisma migrate deploy` before starting the app.
- Set CORS origins to your frontend domain(s); enable HTTPS and secure cookies.
- Configure Cloudinary credentials for uploads in production.

---

### Troubleshooting

- `PrismaClientInitializationError`: verify database credentials and network access.
- 401/403 responses: confirm JWT_SECRET matches tokens issued; check cookie settings and CORS.
- Upload failures: ensure Cloudinary env vars are set and the account allows uploads.
- OAuth issues: confirm Google client ID/secret match the backend redirect URIs; allow popups on the frontend.

