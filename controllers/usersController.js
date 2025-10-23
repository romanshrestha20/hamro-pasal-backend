import { prisma } from "../lib/prismaClient.js";
import { AppError } from "../utils/AppError.js";
import { updateUserSchema } from "../validators/userValidators.ts";

// --- GET SINGLE USER ---
export const getUserById = async (req, res) => {
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
export const getAllUsers = async (_req, res) => {
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
export const deleteUser = async (req, res) => {
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
export const updateUser = async (req, res) => {
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
    const userId = req.user?.id; //

    if (!req.file) {
      return next(new AppError("No file uploaded", 400));
    }

    const { path: filePath, size } = req.file;

    // 1️⃣ Optional: Remove existing profile image for this user
    await prisma.image.updateMany({
      where: { userId, isMain: true },
      data: { isMain: false },
    });

    // 2️⃣ Create new image record
    const newImage = await prisma.image.create({
      data: {
        url: filePath,
        userId: userId,
        isMain: true,
        fileSize: size,
      },
    });

    res.status(200).json({
      message: "Profile image uploaded successfully",
      image: newImage,
    });
  } catch (error) {
    console.error(error);
    next(error);
  }
};
