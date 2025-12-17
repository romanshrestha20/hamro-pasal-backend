import {
  getUserById,
  getAllUsers,
  deleteUser,
  updateUser,
  uploadUserProfileImage,
} from "../usersController.js";
import { prisma } from "../../lib/prismaClient.js";
import { AppError } from "../../utils/AppError.js";

// Mock dependencies
jest.mock("../../lib/prismaClient.js", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
    image: {
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

// Mock validators
jest.mock("../../validators/userValidators.ts", () => ({
  updateUserSchema: {
    parse: jest.fn((data) => data),
  },
}));

describe("UsersController", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      params: {},
      body: {},
      user: {},
      file: null,
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe("getUserById", () => {
    const mockUser = {
      id: "1",
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      phone: "1234567890",
      address: "123 Test St",
      image: "https://res.cloudinary.com/demo/image/upload/avatar.jpg",
      isAdmin: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("should get user by id successfully", async () => {
      req.params.id = "1";

      prisma.user.findUnique.mockResolvedValue(mockUser);

      await getUserById(req, res, next);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "1" },
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
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "1",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          phone: "1234567890",
          address: "123 Test St",
          isAdmin: false,
          image: "https://res.cloudinary.com/demo/image/upload/avatar.jpg",
          profilePicture:
            "https://res.cloudinary.com/demo/image/upload/avatar.jpg",
        })
      );
    });

    it("should return error if user not found", async () => {
      req.params.id = "999";

      prisma.user.findUnique.mockResolvedValue(null);

      await getUserById(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe("User not found");
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });

    it("should handle database errors", async () => {
      req.params.id = "1";

      const dbError = new Error("Database error");
      prisma.user.findUnique.mockRejectedValue(dbError);

      await getUserById(req, res, next);

      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  describe("getAllUsers", () => {
    const mockUsers = [
      {
        id: "1",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        phone: "1234567890",
        address: "123 Test St",
        image: "https://res.cloudinary.com/demo/image/upload/avatar1.jpg",
        isAdmin: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "2",
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@example.com",
        phone: "0987654321",
        address: "456 Test Ave",
        image: "https://res.cloudinary.com/demo/image/upload/avatar2.jpg",
        isAdmin: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it("should get all users successfully", async () => {
      prisma.user.findMany.mockResolvedValue(mockUsers);

      await getAllUsers(req, res, next);

      expect(prisma.user.findMany).toHaveBeenCalledWith({
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
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: "1",
            image: "https://res.cloudinary.com/demo/image/upload/avatar1.jpg",
            profilePicture:
              "https://res.cloudinary.com/demo/image/upload/avatar1.jpg",
          }),
          expect.objectContaining({
            id: "2",
            image: "https://res.cloudinary.com/demo/image/upload/avatar2.jpg",
            profilePicture:
              "https://res.cloudinary.com/demo/image/upload/avatar2.jpg",
          }),
        ])
      );
    });

    it("should return empty array if no users exist", async () => {
      prisma.user.findMany.mockResolvedValue([]);

      await getAllUsers(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([]);
    });

    it("should handle database errors", async () => {
      const dbError = new Error("Database error");
      prisma.user.findMany.mockRejectedValue(dbError);

      await getAllUsers(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe("deleteUser", () => {
    it("should delete user successfully", async () => {
      req.params.id = "1";

      prisma.user.delete.mockResolvedValue({});

      await deleteUser(req, res, next);

      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: "1" },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "User deleted successfully",
      });
    });

    it("should return error if user not found", async () => {
      req.params.id = "999";

      const error = new Error("Record not found");
      error.code = "P2025";
      prisma.user.delete.mockRejectedValue(error);

      await deleteUser(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("should handle database errors", async () => {
      req.params.id = "1";

      const dbError = new Error("Database error");
      prisma.user.delete.mockRejectedValue(dbError);

      await deleteUser(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe("updateUser", () => {
    const updateData = {
      firstName: "UpdatedJohn",
      lastName: "UpdatedDoe",
      phone: "9999999999",
      address: "789 New St",
    };

    const updatedUser = {
      id: "1",
      firstName: updateData.firstName,
      lastName: updateData.lastName,
      email: "john@example.com",
      phone: updateData.phone,
      address: updateData.address,
      isAdmin: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("should update user successfully", async () => {
      req.params.id = "1";
      req.body = updateData;

      prisma.user.update.mockResolvedValue(updatedUser);

      await updateUser(req, res, next);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "1" },
        data: expect.objectContaining(updateData),
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
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "User updated successfully",
        user: updatedUser,
      });
    });

    it("should return error if user not found", async () => {
      req.params.id = "999";
      req.body = updateData;

      const error = new Error("Record not found");
      error.code = "P2025";
      prisma.user.update.mockRejectedValue(error);

      await updateUser(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("should handle validation errors", async () => {
      req.params.id = "1";
      req.body = { firstName: "" }; // Invalid data

      await updateUser(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("should handle database errors", async () => {
      req.params.id = "1";
      req.body = updateData;

      const dbError = new Error("Database error");
      prisma.user.update.mockRejectedValue(dbError);

      await updateUser(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe("uploadUserProfileImage", () => {
    const mockFile = {
      filename: "cloudinary-public-id",
      path: "https://res.cloudinary.com/demo/image/upload/v123/avatar.jpg",
    };

    const mockImage = {
      id: "1",
      url: mockFile.path,
      publicId: mockFile.filename,
      userId: "1",
    };

    it("should upload profile image successfully", async () => {
      req.user = { id: "1" };
      req.file = mockFile;

      prisma.image.create.mockResolvedValue(mockImage);
      prisma.user.update.mockResolvedValue({});

      await uploadUserProfileImage(req, res, next);

      expect(prisma.image.create).toHaveBeenCalledWith({
        data: {
          url: mockFile.path,
          publicId: mockFile.filename,
          userId: "1",
        },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "1" },
        data: {
          image: mockFile.path,
          imagePublicId: mockFile.filename,
        },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Profile image uploaded successfully",
        data: {
          url: mockFile.path,
          publicId: mockFile.filename,
        },
      });
    });

    it("should return error if user not authenticated", async () => {
      req.user = {};
      req.file = mockFile;

      await uploadUserProfileImage(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe("User not authenticated");
    });

    it("should return error if no file uploaded", async () => {
      req.user = { id: "1" };
      req.file = null;

      await uploadUserProfileImage(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe("No file uploaded");
    });

    it("should handle errors during upload", async () => {
      req.user = { id: "1" };
      req.file = mockFile;

      const error = new Error("Database error");
      prisma.image.create.mockRejectedValue(error);

      await uploadUserProfileImage(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe(
        "Server error during image upload"
      );
    });
  });
});
