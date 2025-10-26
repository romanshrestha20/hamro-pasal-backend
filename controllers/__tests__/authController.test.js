import {
  registerUser,
  loginUser,
  changeUserPassword,
  logoutUser,
  getCurrentUser,
} from "../authController.js";
import { prisma } from "../../lib/prismaClient.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AppError } from "../../utils/AppError.js";
import * as validators from "../../validators/userValidators.ts";

// Mock dependencies
jest.mock("../../lib/prismaClient.js", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("bcryptjs");
jest.mock("jsonwebtoken");

// Mock validators
jest.mock("../../validators/userValidators.ts", () => ({
  createUserSchema: {
    parse: jest.fn((data) => data),
  },
  loginUserSchema: {
    parse: jest.fn((data) => data),
  },
  changePasswordSchema: {
    safeParse: jest.fn((data) => ({
      success: true,
      data: data,
    })),
  },
  userIdParamSchema: {
    parse: jest.fn((data) => data),
  },
}));

describe("AuthController", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      user: {},
      params: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
  });

  describe("registerUser", () => {
    const validUserData = {
      email: "test@example.com",
      password: "Password123!",
      firstName: "John",
      lastName: "Doe",
      phone: "1234567890",
      address: "123 Test St",
      isAdmin: false,
    };

    it("should register a new user successfully", async () => {
      req.body = validUserData;

      prisma.user.findUnique.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue("hashedPassword");
      prisma.user.create.mockResolvedValue({
        id: "1",
        email: validUserData.email,
        firstName: validUserData.firstName,
        lastName: validUserData.lastName,
        isAdmin: false,
      });
      jwt.sign.mockReturnValue("test-token");

      await registerUser(req, res, next);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: validUserData.email },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(validUserData.password, 10);
      expect(prisma.user.create).toHaveBeenCalled();
      expect(res.cookie).toHaveBeenCalledWith("token", "test-token", {
        httpOnly: true,
        secure: false,
        sameSite: "strict",
        maxAge: 60 * 60 * 1000, // 1 hour
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: "User registered successfully",
        user: expect.objectContaining({
          email: validUserData.email,
          firstName: validUserData.firstName,
          lastName: validUserData.lastName,
        }),
        token: "test-token",
      });
    });

    it("should return error if user already exists", async () => {
      req.body = validUserData;

      prisma.user.findUnique.mockResolvedValue({
        id: "1",
        email: validUserData.email,
      });

      await registerUser(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe("User already exists");
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    });

    it("should handle validation errors", async () => {
      req.body = { email: "invalid-email" };
      // Force the validator to throw a ZodError
      validators.createUserSchema.parse.mockImplementationOnce(() => {
        const err = new Error("Invalid input");
        err.name = "ZodError";
        err.errors = [{ path: ["email"], message: "Invalid email" }];
        throw err;
      });

      await registerUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Invalid input",
        })
      );
    });

    it("should handle missing JWT_SECRET", async () => {
      req.body = validUserData;
      delete process.env.JWT_SECRET;

      prisma.user.findUnique.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue("hashedPassword");
      prisma.user.create.mockResolvedValue({
        id: "1",
        email: validUserData.email,
        firstName: validUserData.firstName,
        lastName: validUserData.lastName,
        isAdmin: false,
      });

      await registerUser(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toContain("JWT_SECRET");
    });
  });

  describe("loginUser", () => {
    const loginData = {
      email: "test@example.com",
      password: "Password123!",
    };

    const mockUser = {
      id: "1",
      email: loginData.email,
      password: "hashedPassword",
      firstName: "John",
      lastName: "Doe",
      isAdmin: false,
    };

    it("should login user successfully", async () => {
      req.body = loginData;

      prisma.user.findUnique.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue("test-token");

      await loginUser(req, res, next);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: loginData.email },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginData.password,
        mockUser.password
      );
      expect(res.cookie).toHaveBeenCalledWith("token", "test-token", {
        httpOnly: true,
        secure: false,
        sameSite: "strict",
        maxAge: 60 * 60 * 1000, // 1 hour
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Login successful",
        user: expect.objectContaining({
          id: mockUser.id,
          email: mockUser.email,
        }),
        token: "test-token",
      });
    });

    it("should return error if user not found", async () => {
      req.body = loginData;

      prisma.user.findUnique.mockResolvedValue(null);

      await loginUser(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe("Invalid credentials");
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });

    it("should return error if password is incorrect", async () => {
      req.body = loginData;

      prisma.user.findUnique.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      await loginUser(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe("Invalid credentials");
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });

    it("should handle missing JWT_SECRET", async () => {
      req.body = loginData;
      delete process.env.JWT_SECRET;

      prisma.user.findUnique.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);

      await loginUser(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toContain("JWT_SECRET");
    });
  });

  describe("changeUserPassword", () => {
    const passwordData = {
      oldPassword: "OldPassword123!",
      newPassword: "NewPassword123!",
    };

    const mockUser = {
      id: "1",
      password: "hashedOldPassword",
    };

    it("should change password successfully", async () => {
      req.body = passwordData;
      req.user = { userId: "1" };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue("hashedNewPassword");
      prisma.user.update.mockResolvedValue({});

      await changeUserPassword(req, res, next);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "1" },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        passwordData.oldPassword,
        mockUser.password
      );
      expect(bcrypt.hash).toHaveBeenCalledWith(passwordData.newPassword, 10);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "1" },
        data: { password: "hashedNewPassword" },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Password updated successfully",
      });
    });

    it("should return error if user not authenticated", async () => {
      req.body = passwordData;
      req.user = {};

      await changeUserPassword(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe("Authentication required");
    });

    it("should return error if user not found", async () => {
      req.body = passwordData;
      req.user = { userId: "1" };

      prisma.user.findUnique.mockResolvedValue(null);

      await changeUserPassword(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe("User not found");
    });

    it("should return error if old password is incorrect", async () => {
      req.body = passwordData;
      req.user = { userId: "1" };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      await changeUserPassword(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe("Old password is incorrect");
    });
  });

  describe("logoutUser", () => {
    it("should logout user successfully", async () => {
      await logoutUser(req, res, next);

      expect(res.clearCookie).toHaveBeenCalledWith("token", {
        httpOnly: true,
        sameSite: "strict",
        secure: false, // NODE_ENV is not production in tests
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Logged out successfully",
      });
    });

    it("should logout user with secure cookie in production", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      await logoutUser(req, res, next);

      expect(res.clearCookie).toHaveBeenCalledWith("token", {
        httpOnly: true,
        sameSite: "strict",
        secure: true, // Should be true in production
      });
      expect(res.status).toHaveBeenCalledWith(200);

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("getCurrentUser", () => {
    const mockUser = {
      id: "1",
      email: "test@example.com",
      firstName: "John",
      lastName: "Doe",
      phone: "1234567890",
      address: "123 Test St",
      image: "avatar.jpg",
      isAdmin: false,
    };

    it("should get current user successfully", async () => {
      req.user = { id: "1" };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      await getCurrentUser(req, res, next);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "1" },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          address: true,
          image: true,
          isAdmin: true,
        },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "1",
          email: "test@example.com",
          firstName: "John",
          lastName: "Doe",
          phone: "1234567890",
          address: "123 Test St",
          isAdmin: false,
          profilePicture: expect.stringContaining("/uploads/avatar.jpg"),
        })
      );
    });

    it("should return error if user ID is missing", async () => {
      req.user = {};

      await getCurrentUser(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe("Invalid user");
    });

    it("should return error if user not found", async () => {
      req.user = { id: "1" };

      prisma.user.findUnique.mockResolvedValue(null);

      await getCurrentUser(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe("User not found");
    });
  });
});
