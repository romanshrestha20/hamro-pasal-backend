Great! Based on your project structure and code from the Hamro Pasal backend repo, here's a tailored `README.md` and documentation draft that clearly explains setup, usage, and architecture.

---

## 📦 Hamro Pasal Backend

A Node.js + Express backend for Hamro Pasal, a user-centric e-commerce platform. Built with Prisma ORM, JWT-based authentication, and modular route/controllers architecture.

---

### 🚀 Features

- 🔐 JWT Authentication (Register, Login, Logout, Password Change)
- 👤 User CRUD operations
- 🖼️ Profile image upload via Multer
- 🧪 Unit & integration tests with Jest
- 🛡️ Centralized error handling
- 🧩 Prisma ORM with PostgreSQL
- 🧰 Zod-based request validation

---

### 🛠️ Tech Stack

| Layer        | Technology            |
|--------------|------------------------|
| Runtime      | Node.js (ESM Modules)  |
| Framework    | Express.js             |
| ORM          | Prisma                 |
| Auth         | JWT + bcryptjs         |
| Validation   | Zod                    |
| File Upload  | Multer                 |
| Testing      | Jest                   |
| Environment  | dotenv                 |

---

### 📁 Project Structure

```
hamro-pasal-backend/
├── app.js                 # Express app setup
├── server.js              # Server entry point
├── controllers/           # Auth and user logic
├── routes/                # API route definitions
├── middlewares/           # Auth & error handling
├── utils/                 # Custom error, JWT debug, uploads
├── prisma/                # Prisma schema & migrations
├── validators/            # Zod schemas
├── lib/                   # Prisma client
├── __tests__/             # Jest test setup
└── uploads/               # Uploaded images
```

---

### ⚙️ Setup Instructions

1. **Clone the repo**  
   ```bash
   git clone https://github.com/romanshrestha20/hamro-pasal-backend.git
   cd hamro-pasal-backend
   ```

2. **Install dependencies**  
   ```bash
   npm install
   ```

3. **Configure environment**  
   Create a `.env` file:
   ```env
   DATABASE_URL=your_postgres_url
   JWT_SECRET=your_jwt_secret
   ```

4. **Generate Prisma client**  
   ```bash
   npx prisma generate
   ```

5. **Run migrations**  
   ```bash
   npx prisma migrate dev --name init
   ```

6. **Start the server**  
   ```bash
   npm run start
   ```

---

### 🧪 Testing

Run unit tests:
```bash
npm test
```

Test coverage reports are available in `/coverage`.

---

### 📌 API Endpoints

#### Auth Routes (`/api/auth`)
- `POST /register` – Register new user
- `POST /login` – Login and receive JWT
- `POST /logout` – Logout
- `PATCH /change-password` – Change password
- `GET /me` – Get current user info

#### User Routes (`/api/users`)
- `GET /` – Get all users
- `GET /:id` – Get user by ID
- `PATCH /:id` – Update user
- `DELETE /:id` – Delete user
- `POST /upload-profile-image` – Upload profile image

---

### 📎 Notes

- Ensure Prisma migrations match your schema before deploying.
- CORS is configured for `http://localhost:3000` by default.
- JWT secret must be defined in `.env`.

---
