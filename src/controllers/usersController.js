import { prisma } from "../lib/prismaClient.js";
import { AppError } from "../utils/AppError.js";
import { updateUserSchema } from "../validators/userValidators.ts";
import cloudinary from "../lib/cloudinary.js";

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

    const profilePicture = user.image?.startsWith("https://res.cloudinary.com")
      ? user.image
      : undefined;

    res.status(200).json({
      ...user,
      profilePicture,
    });
    console.log("User image URL:", user.image);
  } catch (error) {
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

    const sanitizedUsers = users.map((u) => {
      const profilePicture = u.image?.startsWith("https://res.cloudinary.com")
        ? u.image
        : undefined;
      return {
        ...u,
        profilePicture,
      };
    });

    res.status(200).json(sanitizedUsers);
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
    const userId = req.user?.id;
    if (!userId) return next(new AppError("User not authenticated", 401));
    if (!req.file) return next(new AppError("No file uploaded", 400));

    console.log("Uploaded file object:", req.file);

    const imageUrl = req.file.path;    // Cloudinary URL
    const publicId = req.file.filename; // Cloudinary public ID

    // Update Image table
    await prisma.image.create({
      data: { url: imageUrl, publicId, userId },
    });

    // Update User record
    await prisma.user.update({
      where: { id: userId },
      data: { image: imageUrl, imagePublicId: publicId },
    });

    res.status(200).json({
      success: true,
      message: "Profile image uploaded successfully",
      data: { url: imageUrl, publicId },
    });
  } catch (error) {
    console.error("Upload profile image error:", error);
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

    if (user.imagePublicId) {
      await cloudinary.uploader.destroy(user.imagePublicId);
    }

    // Delete all existing images for this user
    const deleteResult = await prisma.image.deleteMany({
      where: { userId: userId },
    });

    // Also remove reference from User.image
    await prisma.user.update({
      where: { id: userId },
      data: {
        image: null,
        imagePublicId: null,
      },
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
