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

// Resolve JWT secret at call time to allow tests to override env per test

// ----------------------------
// Register User
// ----------------------------

// --- REGISTER USER ---
export const registerUser = async (req, res, next) => {
  try {
    const JWT_SECRET = process.env.JWT_SECRET;
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
      {
        id: user.id, // Change from userId to id for consistency
        isAdmin: user.isAdmin,
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Set HTTP-only cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 1000, // 1 hour (matches JWT expiry)
    });

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
    const JWT_SECRET = process.env.JWT_SECRET;
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
      {
        id: user.id, // Change from userId to id for consistency
        isAdmin: user.isAdmin,
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Set HTTP-only cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 1000, // 1 hour (matches JWT expiry)
    });

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
    // Debug: Check what's in req.user
    console.log("Request user:", req.user);

    if (!req.user || !req.user.userId) {
      return next(new AppError("Authentication required", 401));
    }

    // Validate request body
    const validationResult = changePasswordSchema.safeParse(req.body);

    if (!validationResult.success) {
      console.log("Validation errors:", validationResult.error.errors);
      return next(validationResult.error);
    }

    const { oldPassword, newPassword } = validationResult.data;
    const userId = req.user.userId;

    console.log("Looking for user with ID:", userId); // Debug log

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      console.log("User not found with ID:", userId); // Debug log
      return next(new AppError("User not found", 404));
    }

    // Verify old password
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return next(new AppError("Old password is incorrect", 400));
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
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
    // Clear the HTTP-only cookie
    res.clearCookie("token", {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production", // Match cookie settings
    });

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
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
    console.log("Full user object from request:", req.user); // Debug log

    // Try different possible properties
    const userId = req.user.id;
    console.log("Extracted userId:", userId); // Debug log

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
