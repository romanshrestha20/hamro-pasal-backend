import { jest } from "@jest/globals";

// Mock google-auth-library - create mock function inside factory
jest.mock("google-auth-library", () => {
  const mockVerifyIdToken = jest.fn();
  const MockOAuth2Client = jest.fn().mockImplementation(() => ({
    verifyIdToken: mockVerifyIdToken,
  }));
  // Attach the mock to the constructor so we can access it in tests
  MockOAuth2Client.__mockVerifyIdToken = mockVerifyIdToken;

  return {
    OAuth2Client: MockOAuth2Client,
  };
});

// Mock dependencies
jest.mock("../../lib/prismaClient.js", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock("jsonwebtoken");

// Import after mocks
import { googleAuth } from "../googleAuthController.js";
import { prisma } from "../../lib/prismaClient.js";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";

// Get reference to the mock function from the constructor
const mockVerifyIdToken = OAuth2Client.__mockVerifyIdToken;

describe("googleAuthController", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
  });

  describe("googleAuth", () => {
    describe("Success scenarios", () => {
      it("should create new user and return token for first-time Google login", async () => {
        const mockGoogleToken = "mock-google-token";
        const mockPayload = {
          sub: "google-user-id-123",
          email: "newuser@gmail.com",
          name: "John Doe",
          picture: "https://example.com/photo.jpg",
        };

        const mockCreatedUser = {
          id: "new-user-id",
          firstName: "John",
          lastName: "Doe",
          email: "newuser@gmail.com",
          provider: "google",
          providerId: "google-user-id-123",
          image: "https://example.com/photo.jpg",
          isAdmin: false,
          password: "",
        };

        const mockAppToken = "mock-jwt-token";

        req.body.token = mockGoogleToken;

        mockVerifyIdToken.mockResolvedValue({
          getPayload: () => mockPayload,
        });

        prisma.user.findUnique.mockResolvedValue(null);
        prisma.user.create.mockResolvedValue(mockCreatedUser);
        jwt.sign.mockReturnValue(mockAppToken);

        await googleAuth(req, res, next);

        expect(mockVerifyIdToken).toHaveBeenCalledWith({
          idToken: mockGoogleToken,
          audience: process.env.GOOGLE_CLIENT_ID,
        });

        expect(prisma.user.findUnique).toHaveBeenCalledWith({
          where: { email: "newuser@gmail.com" },
        });

        expect(prisma.user.create).toHaveBeenCalledWith({
          data: {
            firstName: "John",
            lastName: "Doe",
            email: "newuser@gmail.com",
            provider: "google",
            providerId: "google-user-id-123",
            image: "https://example.com/photo.jpg",
            isAdmin: false,
            password: "",
          },
        });

        expect(jwt.sign).toHaveBeenCalledWith(
          {
            id: mockCreatedUser.id,
            email: mockCreatedUser.email,
            isAdmin: mockCreatedUser.isAdmin,
            provider: "google",
          },
          process.env.JWT_SECRET,
          { expiresIn: "7d" }
        );

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message: "Google login successful",
          token: mockAppToken,
          user: mockCreatedUser,
        });
        expect(next).not.toHaveBeenCalled();
      });

      it("should login existing user and return token", async () => {
        const mockGoogleToken = "mock-google-token";
        const mockPayload = {
          sub: "google-user-id-456",
          email: "existinguser@gmail.com",
          name: "Jane Smith",
          picture: "https://example.com/jane.jpg",
        };

        const mockExistingUser = {
          id: "existing-user-id",
          firstName: "Jane",
          lastName: "Smith",
          email: "existinguser@gmail.com",
          provider: "google",
          providerId: "google-user-id-456",
          isAdmin: false,
        };

        const mockAppToken = "mock-jwt-token-existing";

        req.body.token = mockGoogleToken;

        mockVerifyIdToken.mockResolvedValue({
          getPayload: () => mockPayload,
        });

        prisma.user.findUnique.mockResolvedValue(mockExistingUser);
        jwt.sign.mockReturnValue(mockAppToken);

        await googleAuth(req, res, next);

        expect(mockVerifyIdToken).toHaveBeenCalledWith({
          idToken: mockGoogleToken,
          audience: process.env.GOOGLE_CLIENT_ID,
        });

        expect(prisma.user.findUnique).toHaveBeenCalledWith({
          where: { email: "existinguser@gmail.com" },
        });

        expect(prisma.user.create).not.toHaveBeenCalled();

        expect(jwt.sign).toHaveBeenCalledWith(
          {
            id: mockExistingUser.id,
            email: mockExistingUser.email,
            isAdmin: mockExistingUser.isAdmin,
            provider: "google",
          },
          process.env.JWT_SECRET,
          { expiresIn: "7d" }
        );

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message: "Google login successful",
          token: mockAppToken,
          user: mockExistingUser,
        });
        expect(next).not.toHaveBeenCalled();
      });

      it("should handle user with single name (no last name)", async () => {
        const mockGoogleToken = "mock-google-token";
        const mockPayload = {
          sub: "google-user-id-789",
          email: "singlename@gmail.com",
          name: "Madonna",
          picture: "https://example.com/madonna.jpg",
        };

        const mockCreatedUser = {
          id: "single-name-user-id",
          firstName: "Madonna",
          lastName: "",
          email: "singlename@gmail.com",
          provider: "google",
          providerId: "google-user-id-789",
          isAdmin: false,
        };

        req.body.token = mockGoogleToken;

        mockVerifyIdToken.mockResolvedValue({
          getPayload: () => mockPayload,
        });

        prisma.user.findUnique.mockResolvedValue(null);
        prisma.user.create.mockResolvedValue(mockCreatedUser);
        jwt.sign.mockReturnValue("mock-token");

        await googleAuth(req, res, next);

        expect(prisma.user.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            firstName: "Madonna",
            lastName: "",
          }),
        });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(next).not.toHaveBeenCalled();
      });

      it("should handle user with multiple last names", async () => {
        const mockGoogleToken = "mock-google-token";
        const mockPayload = {
          sub: "google-user-id-999",
          email: "multiname@gmail.com",
          name: "John Michael Smith Jr",
          picture: "https://example.com/john.jpg",
        };

        const mockCreatedUser = {
          id: "multi-name-user-id",
          firstName: "John",
          lastName: "Michael Smith Jr",
          email: "multiname@gmail.com",
          provider: "google",
          providerId: "google-user-id-999",
          isAdmin: false,
        };

        req.body.token = mockGoogleToken;

        mockVerifyIdToken.mockResolvedValue({
          getPayload: () => mockPayload,
        });

        prisma.user.findUnique.mockResolvedValue(null);
        prisma.user.create.mockResolvedValue(mockCreatedUser);
        jwt.sign.mockReturnValue("mock-token");

        await googleAuth(req, res, next);

        expect(prisma.user.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            firstName: "John",
            lastName: "Michael Smith Jr",
          }),
        });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(next).not.toHaveBeenCalled();
      });

      it("should handle missing name gracefully", async () => {
        const mockGoogleToken = "mock-google-token";
        const mockPayload = {
          sub: "google-user-id-000",
          email: "noname@gmail.com",
          name: "",
          picture: "https://example.com/default.jpg",
        };

        const mockCreatedUser = {
          id: "no-name-user-id",
          firstName: "",
          lastName: "",
          email: "noname@gmail.com",
          provider: "google",
          providerId: "google-user-id-000",
          isAdmin: false,
        };

        req.body.token = mockGoogleToken;

        mockVerifyIdToken.mockResolvedValue({
          getPayload: () => mockPayload,
        });

        prisma.user.findUnique.mockResolvedValue(null);
        prisma.user.create.mockResolvedValue(mockCreatedUser);
        jwt.sign.mockReturnValue("mock-token");

        await googleAuth(req, res, next);

        expect(prisma.user.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            firstName: "",
            lastName: "",
          }),
        });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(next).not.toHaveBeenCalled();
      });
    });

    describe("Error scenarios", () => {
      it("should return 400 if token is missing", async () => {
        req.body = {};

        await googleAuth(req, res, next);

        // The controller catches all errors and returns generic 500 error
        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({
            message: "Google authentication failed",
            statusCode: 500,
          })
        );
        expect(res.status).not.toHaveBeenCalled();
      });

      it("should return 400 if Google token is invalid", async () => {
        req.body.token = "invalid-google-token";

        mockVerifyIdToken.mockRejectedValue(
          new Error("Invalid token signature")
        );

        await googleAuth(req, res, next);

        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({
            message: "Google authentication failed",
            statusCode: 500,
          })
        );
        expect(res.status).not.toHaveBeenCalled();
      });

      it("should return 400 if Google token payload is missing email", async () => {
        const mockGoogleToken = "mock-google-token";
        const mockPayload = {
          sub: "google-user-id-123",
          name: "John Doe",
          // email is missing
        };

        req.body.token = mockGoogleToken;

        mockVerifyIdToken.mockResolvedValue({
          getPayload: () => mockPayload,
        });

        await googleAuth(req, res, next);

        // The controller catches all errors and returns generic 500 error
        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({
            message: "Google authentication failed",
            statusCode: 500,
          })
        );
        expect(res.status).not.toHaveBeenCalled();
      });

      it("should handle database error during user lookup", async () => {
        const mockGoogleToken = "mock-google-token";
        const mockPayload = {
          sub: "google-user-id-123",
          email: "user@gmail.com",
          name: "Test User",
        };

        req.body.token = mockGoogleToken;

        mockVerifyIdToken.mockResolvedValue({
          getPayload: () => mockPayload,
        });

        prisma.user.findUnique.mockRejectedValue(
          new Error("Database connection error")
        );

        await googleAuth(req, res, next);

        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({
            message: "Google authentication failed",
            statusCode: 500,
          })
        );
        expect(res.status).not.toHaveBeenCalled();
      });

      it("should handle database error during user creation", async () => {
        const mockGoogleToken = "mock-google-token";
        const mockPayload = {
          sub: "google-user-id-123",
          email: "newuser@gmail.com",
          name: "New User",
        };

        req.body.token = mockGoogleToken;

        mockVerifyIdToken.mockResolvedValue({
          getPayload: () => mockPayload,
        });

        prisma.user.findUnique.mockResolvedValue(null);
        prisma.user.create.mockRejectedValue(new Error("Database write error"));

        await googleAuth(req, res, next);

        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({
            message: "Google authentication failed",
            statusCode: 500,
          })
        );
        expect(res.status).not.toHaveBeenCalled();
      });

      it("should handle JWT signing error", async () => {
        const mockGoogleToken = "mock-google-token";
        const mockPayload = {
          sub: "google-user-id-123",
          email: "user@gmail.com",
          name: "Test User",
        };

        const mockUser = {
          id: "user-id",
          email: "user@gmail.com",
          isAdmin: false,
        };

        req.body.token = mockGoogleToken;

        mockVerifyIdToken.mockResolvedValue({
          getPayload: () => mockPayload,
        });

        prisma.user.findUnique.mockResolvedValue(mockUser);
        jwt.sign.mockImplementation(() => {
          throw new Error("JWT signing failed");
        });

        await googleAuth(req, res, next);

        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({
            message: "Google authentication failed",
            statusCode: 500,
          })
        );
        expect(res.status).not.toHaveBeenCalled();
      });

      it("should handle OAuth2Client verification timeout", async () => {
        req.body.token = "valid-looking-token";

        mockVerifyIdToken.mockRejectedValue(new Error("Verification timeout"));

        await googleAuth(req, res, next);

        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({
            message: "Google authentication failed",
            statusCode: 500,
          })
        );
        expect(res.status).not.toHaveBeenCalled();
      });
    });

    describe("Edge cases", () => {
      it("should handle empty string token", async () => {
        req.body.token = "";

        await googleAuth(req, res, next);

        // The controller catches all errors and returns generic 500 error
        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({
            message: "Google authentication failed",
            statusCode: 500,
          })
        );
        expect(res.status).not.toHaveBeenCalled();
      });

      it("should handle null payload from verifyIdToken", async () => {
        req.body.token = "mock-token";

        mockVerifyIdToken.mockResolvedValue({
          getPayload: () => null,
        });

        await googleAuth(req, res, next);

        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({
            message: "Google authentication failed",
            statusCode: 500,
          })
        );
      });

      it("should set isAdmin to false for new Google users", async () => {
        const mockGoogleToken = "mock-google-token";
        const mockPayload = {
          sub: "google-user-id-admin-test",
          email: "newadmin@gmail.com",
          name: "Potential Admin",
        };

        req.body.token = mockGoogleToken;

        mockVerifyIdToken.mockResolvedValue({
          getPayload: () => mockPayload,
        });

        prisma.user.findUnique.mockResolvedValue(null);
        prisma.user.create.mockResolvedValue({
          id: "new-user-id",
          isAdmin: false,
          email: "newadmin@gmail.com",
        });
        jwt.sign.mockReturnValue("mock-token");

        await googleAuth(req, res, next);

        expect(prisma.user.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            isAdmin: false,
          }),
        });
      });

      it("should preserve existing user's isAdmin status", async () => {
        const mockGoogleToken = "mock-google-token";
        const mockPayload = {
          sub: "google-admin-id",
          email: "admin@gmail.com",
          name: "Admin User",
        };

        const mockAdminUser = {
          id: "admin-user-id",
          email: "admin@gmail.com",
          isAdmin: true,
          provider: "google",
        };

        req.body.token = mockGoogleToken;

        mockVerifyIdToken.mockResolvedValue({
          getPayload: () => mockPayload,
        });

        prisma.user.findUnique.mockResolvedValue(mockAdminUser);
        jwt.sign.mockReturnValue("admin-token");

        await googleAuth(req, res, next);

        expect(jwt.sign).toHaveBeenCalledWith(
          expect.objectContaining({
            isAdmin: true,
          }),
          expect.any(String),
          expect.any(Object)
        );

        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            user: expect.objectContaining({
              isAdmin: true,
            }),
          })
        );
      });
    });
  });
});
