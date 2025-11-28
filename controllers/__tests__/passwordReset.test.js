// controllers/__tests__/passwordReset.test.js
import { expect, jest } from "@jest/globals";

// Mock Prisma client with the same resolved path used by the controllers
jest.mock("../../lib/prismaClient.js", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    otp: {
      findFirst: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn(),
    },
    passwordResetToken: {
      findFirst: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

// Use Jest's auto-mock for bcrypt to match other tests' pattern
jest.mock("bcryptjs");

// Mock email service to avoid any side effects
jest.mock("../../utils/emailService.js", () => ({
  sendPasswordResetEmail: jest.fn(),
  sendPasswordResetConfirmation: jest.fn(),
}));

import { forgotPassword, resetPassword } from "../authController.js";
import { prisma } from "../../lib/prismaClient.js";
import bcrypt from "bcryptjs";
import {
  sendPasswordResetEmail,
  sendPasswordResetConfirmation,
} from "../../utils/emailService.js";

describe("Password Reset Controllers", () => {
  let req, res, next;

  beforeEach(() => {
    req = { body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe("forgotPassword", () => {
    it("should return success even if email does not exist", async () => {
      req.body = { email: "test@example.com" };
      prisma.user.findUnique.mockResolvedValue(null);

      await forgotPassword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "If that email exists, a password reset link has been sent.",
      });
    });

    it("should create OTP for valid user", async () => {
      req.body = { email: "test@example.com" };
      prisma.user.findUnique.mockResolvedValue({
        id: "user123",
        email: "test@example.com",
      });
      prisma.otp.deleteMany.mockResolvedValue({});
      prisma.otp.create.mockResolvedValue({});
      // No need to mock crypto; we don't assert on the token value.
      sendPasswordResetEmail.mockResolvedValue(true);

      await forgotPassword(req, res, next);

      expect(prisma.otp.create).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("resetPassword", () => {
    it("should reset password with valid token", async () => {
      const futureDate = new Date(Date.now() + 3600000);
      req.body = { token: "plainToken", newPassword: "newpass123" };

      prisma.passwordResetToken.findFirst.mockResolvedValue({
        id: "token123",
        userId: "user123",
        expiresAt: futureDate,
        user: { email: "test@example.com" },
      });

      bcrypt.hash.mockResolvedValue("hashedNewPassword");
      prisma.user.update.mockResolvedValue({});
      prisma.passwordResetToken.delete.mockResolvedValue({});
      sendPasswordResetConfirmation.mockResolvedValue(true);

      await resetPassword(req, res, next);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user123" },
        data: { password: "hashedNewPassword" },
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });
});
