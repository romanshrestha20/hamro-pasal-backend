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
import crypto from "crypto";
import {
  sendPasswordResetEmail,
  sendPasswordResetConfirmation,
} from "../utils/emailService.js";

// Resolve JWT secret at call time to allow tests to override env per test

// Build the public origin from request (works behind proxies/CDNs)
const getBaseOrigin = (req) => {
  const proto = req?.headers?.["x-forwarded-proto"] || req?.protocol || "http";
  const forwardedHost = req?.headers?.["x-forwarded-host"];
  const headerHost = req?.headers?.host;
  let host = forwardedHost || headerHost;
  if (!host && typeof req?.get === "function") {
    host = req.get("host");
  }
  if (!host) host = "localhost:4000";
  return `${proto}://${host}`;
};

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
        image: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) return next(new AppError("User not found", 404));

    const origin = getBaseOrigin(req);
    const profileUrl = user.image
      ? `${origin}/uploads/${user.image}`
      : undefined;

    res.status(200).json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      address: user.address,
      isAdmin: user.isAdmin,
      profilePicture: profileUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    console.error("Get current user error:", error);
    next(error);
  }
};

// ----------------------------
// Forgot Password (Request Reset)
// ----------------------------
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return next(new AppError("Email is required", 400));
    }

    // Find user by email
    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success (security: don't reveal if email exists)
    if (!user) {
      return res.status(200).json({
        success: true,
        message: "If that email exists, a password reset link has been sent.",
      });
    }

    // Delete old Otps
    await prisma.otp.deleteMany({
      where: { email: user.email },
    });

    const otpPlain = Math.floor(100000 + Math.random() * 900000).toString();

    const otpHashed = crypto
      .createHash("sha256")
      .update(otpPlain)
      .digest("hex");

    // Set expiration (1 hour from now)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create new reset token in database
    await prisma.otp.create({
      data: {
        email: user.email,
        otp: otpHashed,
        expiresAt,
      },
    });

    // Send email with random 6-digit token
    const emailSent = await sendPasswordResetEmail(email, otpPlain);

    if (!emailSent) {
      console.error("Failed to send password reset email");
      // Don't fail the request - token is still created
    }

    res.status(200).json({
      success: true,
      message: "If that email exists, an OTP has been sent.",
    });
  } catch (error) {
    next(error);
  }
};

// verify OTP  -> return reset token
export const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return next(new AppError("Email and OTP are required", 400));
    }

    // Hash the incoming OTP to compare with stored hash
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    // Find valid OTP
    const otpRecord = await prisma.otp.findFirst({
      where: {
        email,
        otp: hashedOtp,
        consumed: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!otpRecord) {
      return next(new AppError("Invalid or expired OTP", 400));
    }

    // Mark OTP as consumed
    await prisma.otp.update({
      where: { id: otpRecord.id },
      data: { consumed: true },
    });

    // Generate reset token
    const resetTokenPlain = crypto.randomBytes(32).toString("hex");
    const resetTokenHashed = crypto
      .createHash("sha256")
      .update(resetTokenPlain)
      .digest("hex");

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: resetTokenHashed,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully. You may now reset your password.",
      resetToken: resetTokenPlain,
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    next(error);
  }
};
// ----------------------------
// Reset Password (With Token)
// ----------------------------
export const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword)
      return next(new AppError("Token and new password required", 400));

    if (newPassword.length < 6)
      return next(new AppError("Password must be at least 6 chars", 400));

    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const tokenRecord = await prisma.passwordResetToken.findFirst({
      where: {
        token: hashedToken,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!tokenRecord)
      return next(new AppError("Invalid or expired reset token", 400));

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: tokenRecord.userId },
      data: { password: hashedPassword },
    });

    await prisma.passwordResetToken.delete({
      where: { id: tokenRecord.id },
    });

    await sendPasswordResetConfirmation(tokenRecord.user.email);

    return res.json({
      success: true,
      message: "Password reset successful.",
    });
  } catch (error) {
    next(error);
  }
};
