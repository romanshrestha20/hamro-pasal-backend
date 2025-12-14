import e from "express";
import { prisma } from "../lib/prismaClient.js";
import { AppError } from "../utils/AppError.js";
import { updateUserSchema } from "../validators/userValidators.ts";
import { deleteFile } from "../utils/uploads.js";
import { mapImageToDto } from "../utils/imageMapper.js";

export const getBaseOrigin = (req) => {
  const proto = req?.headers?.["x-forwarded-proto"] || req?.protocol || "http";
  const forwardedHost = req?.headers?.["x-forwarded-host"];
  const headerHost = req?.headers?.host;
  let host = forwardedHost || headerHost;
  if (!host && typeof req?.get === "function") {
    host = req.get("host");
  }
  if (!host) host = "localhost:4000"; // sensible default for tests/dev
  return `${proto}://${host}`;
};

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
        image: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) throw new AppError("User not found", 404);
    const origin = getBaseOrigin(req);
    const profilePicture = user.image
      ? `${origin}/uploads/${user.image}`
      : undefined;

    res.status(200).json({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      address: user.address,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      profilePicture,
    });
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
        image: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    const origin = getBaseOrigin(_req);
    const mapped = users.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      phone: u.phone,
      address: u.address,
      isAdmin: u.isAdmin,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      profilePicture: u.image ? `${origin}/uploads/${u.image}` : undefined,
    }));

    res.status(200).json(mapped);
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

    const userId = req?.user?.id;

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
    if (userExists.image) deleteFile(userExists.image);

    // Delete all existing images for this user
    const deleteResult = await prisma.image.deleteMany({
      where: { userId: userId },
    });

    console.log(
      `Deleted ${deleteResult.count} existing images for user ${userId}`
    );

    // Create new image record
    const newImage = await prisma.image.create({
      data: {
        url: filename,
        userId: userId,
      },
    });
    // Also persist on User.image for easy access in auth/me
    await prisma.user.update({
      where: { id: userId },
      data: { image: filename },
    });

    const dto = mapImageToDto(req, newImage);
    console.log("Successfully created image with userId:", newImage.userId);

    res.status(200).json({
      success: true,
      message: "Profile image uploaded successfully",
      data: dto,
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

export const removeUserProfileImage = async (req, res, next) => {
  try {
    // Get userId from URL params or from authenticated user
    const userId = req.params.userId || req?.user?.id;

    if (!userId) {
      return next(new AppError("User not authenticated", 401));
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    if (user.image) deleteFile(user.image);
    // Delete all existing images for this user
    const deleteResult = await prisma.image.deleteMany({
      where: { userId: userId },
    });

    // Also remove reference from User.image
    await prisma.user.update({
      where: { id: userId },
      data: { image: null },
    });

    res.status(200).json({
      success: true,
      message: `Deleted ${deleteResult.count} profile image(s) successfully`,
      data: null,
    });
  } catch (error) {
    console.error("Remove profile image error:", error);
    next(new AppError("Server error during image removal", 500));
  }
};