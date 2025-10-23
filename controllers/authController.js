// controllers/authControllers.js
import { prisma } from "../lib/prismaClient.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  createUserSchema,
  loginUserSchema,
  changePasswordSchema,
  userIdParamSchema,
} from "../validators/userValidators.ts";
import { AppError } from "../utils/AppError.js";

const JWT_SECRET = process.env.JWT_SECRET;

// ----------------------------
// Register User
// ----------------------------

// --- REGISTER USER ---
export const registerUser = async (req, res, next) => {
  try {
    // 1️⃣ Validate request body
    const validatedData = createUserSchema.parse(req.body);
    const { email, password, firstName, lastName, phone, address, isAdmin } =
      validatedData;

    console.log("Registering user:", {
      firstName,
      lastName,
      email,
      phone,
      address,
      isAdmin,
    });

    // 2️⃣ Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return next(new AppError("User already exists", 400));
    }

    // 3️⃣ Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // 4️⃣ Prepare data for Prisma (do NOT include `id`)
    const prismaData = {
      firstName,
      lastName,
      email,
      password: passwordHash,
      phone: phone || null,
      address: address || null,
      isAdmin: isAdmin || false,
    };

    console.log("Data sent to Prisma:", prismaData);

    // 5️⃣ Create user
    const user = await prisma.user.create({ data: prismaData });

    // 6️⃣ Generate JWT
    if (!JWT_SECRET) {
      return next(
        new AppError("JWT_SECRET is not defined in environment variables", 500)
      );
    }

    const token = jwt.sign(
      { userId: user.id, isAdmin: user.isAdmin },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 7️⃣ Respond
    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin,
      },
      token,
    });
  } catch (error) {
    console.error("Register error:", error);

    // 8️⃣ Handle Zod validation errors separately for clarity
    if (error.name === "ZodError") {
      return res
        .status(400)
        .json({ message: "Invalid input", errors: error.errors });
    }

    next(error);
  }
};

// ----------------------------
// Login User
// ----------------------------
export const loginUser = async (req, res, next) => {
  try {
    const validatedData = loginUserSchema.parse(req.body);
    const { email, password } = validatedData;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return next(new AppError("Invalid credentials", 401));

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return next(new AppError("Invalid credentials", 401));

    if (!JWT_SECRET)
      return next(
        new AppError("JWT_SECRET is not defined in environment variables", 500)
      );

    const token = jwt.sign(
      { userId: user.id, isAdmin: user.isAdmin },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(200).json({
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    next(error);
  }
};

// ----------------------------
// Change Password
// ----------------------------
export const changeUserPassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = changePasswordSchema.parse(req.body);
    const userId = req.user.userId;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return next(new AppError("User not found", 404));

    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isMatch) return next(new AppError("Old password is incorrect", 400));

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedNewPassword },
    });

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    next(error);
  }
};

// ----------------------------
// Logout User
// ----------------------------
export const logoutUser = async (req, res, next) => {
  try {
    // Token invalidation is handled on client side
    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    next(error);
  }
};

// ----------------------------
// Get Current User
// ----------------------------
export const getCurrentUser = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    if (!userId) return next(new AppError("Invalid user", 400));

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        address: true,
        isAdmin: true,
      },
    });

    if (!user) return next(new AppError("User not found", 404));

    res.status(200).json(user);
  } catch (error) {
    console.error("Get current user error:", error);
    next(error);
  }
};
