import e from "express";
import { prisma } from "../lib/prismaClient.js";
import { AppError } from "../utils/AppError.js";
import { updateUserSchema } from "../validators/userValidators.ts";

// --- GET SINGLE USER ---
export const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) throw new AppError("User not found", 404);
    res.status(200).json(user);
  } catch (error) {
    console.error(error);
    next(error);
  }
};

// --- GET ALL USERS ---
export const getAllUsers = async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(200).json(users);
  } catch (error) {
    console.error(error);
    next(error);
  }
};

// --- DELETE USER ---
export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.user.delete({
      where: { id },
    });

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error(error);

    if (error.code === "P2025") {
      return next(new AppError("User not found", 404));
    }

    next(error);
  }
};

// --- UPDATE USER ---
export const updateUser = async (req, res, next) => {
  try {
    // validate and parse parameters and body
    const { id } = req.params;
    const validatedData = updateUserSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id },
      data: { ...validatedData },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(200).json({ message: "User updated successfully", user });
  } catch (error) {
    console.error(error);

    if (error.code === "P2025") {
      return next(new AppError("User not found", 404));
    }
    // ✅ Handle Zod validation errors
    if (error.errors) {
      return next(new AppError("Validation failed", 400, error.errors));
    }

    next(error);
  }
};

export const uploadUserProfileImage = async (req, res, next) => {
  try {
    console.log("Request user object:", req.user); // Debug log

    const userId = req.user.id;

    if (!userId) {
      console.error("No user ID found in request");
      return next(new AppError("User not authenticated", 401));
    }

    if (!req.file) {
      return next(new AppError("No file uploaded", 400));
    }

    const { filename } = req.file;

    // Verify user exists (double check)
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userExists) {
      return next(new AppError("User not found", 404));
    }

    // Delete all existing images for this user
    const deleteResult = await prisma.image.deleteMany({
      where: { userId: userId },
    });

    console.log(
      `Deleted ${deleteResult.count} existing images for user ${userId}`
    );

    // Create new image
    const newImage = await prisma.image.create({
      data: {
        url: filename,
        userId: userId,
      },
    });

    console.log("Successfully created image with userId:", newImage.userId);

    res.status(200).json({
      success: true,
      message: "Profile image uploaded successfully",
      data: newImage,
    });
  } catch (error) {
    console.error("Upload profile image error:", error);

    if (error.code === "P2002") {
      return next(new AppError("Image already exists", 400));
    }

    if (error.code === "P2003") {
      return next(new AppError("Invalid user reference", 400));
    }

    next(new AppError("Server error during image upload", 500));
  }
};
