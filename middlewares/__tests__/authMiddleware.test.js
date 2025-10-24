import jwt from "jsonwebtoken";
import {
  authenticate,
  authorizeAdmin,
  requireAuth,
} from "../authMiddleware.js";
import { prisma } from "../../lib/prismaClient.js";
import { AppError } from "../../utils/AppError.js";

// Mock dependencies
jest.mock("jsonwebtoken");
jest.mock("../../lib/prismaClient.js", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

describe("Auth Middleware", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      header: jest.fn(),
      user: null,
      cookies: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
  });

  describe("authenticate", () => {
    it("should authenticate user with valid token", async () => {
      const token = "valid-token";
      const decoded = {
        id: "1",
        isAdmin: false,
      };

      req.header.mockReturnValue(`Bearer ${token}`);
      jwt.verify.mockReturnValue(decoded);

      await authenticate(req, res, next);

      expect(req.header).toHaveBeenCalledWith("Authorization");
      expect(jwt.verify).toHaveBeenCalledWith(token, process.env.JWT_SECRET);
      expect(req.user).toEqual({
        id: "1",
        userId: "1",
        isAdmin: false,
      });
      expect(next).toHaveBeenCalledWith();
    });

    it("should return error if no token provided", async () => {
      req.header.mockReturnValue(undefined);

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe(
        "Access denied. No token provided."
      );
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });

    it("should return error if token is empty", async () => {
      req.header.mockReturnValue("Bearer ");

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe(
        "Access denied. No token provided."
      );
    });

    it("should return error if token payload is invalid (missing id)", async () => {
      const token = "invalid-token";
      const decoded = {
        isAdmin: false,
        // missing id
      };

      req.header.mockReturnValue(`Bearer ${token}`);
      jwt.verify.mockReturnValue(decoded);

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe("Invalid token payload");
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });

    it("should handle JsonWebTokenError", async () => {
      const token = "malformed-token";
      const error = new Error("jwt malformed");
      error.name = "JsonWebTokenError";

      req.header.mockReturnValue(`Bearer ${token}`);
      jwt.verify.mockImplementation(() => {
        throw error;
      });

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe("Invalid token");
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });

    it("should handle TokenExpiredError", async () => {
      const token = "expired-token";
      const error = new Error("jwt expired");
      error.name = "TokenExpiredError";

      req.header.mockReturnValue(`Bearer ${token}`);
      jwt.verify.mockImplementation(() => {
        throw error;
      });

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe("Token expired");
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });

    it("should handle generic authentication errors", async () => {
      const token = "error-token";
      const error = new Error("Some other error");

      req.header.mockReturnValue(`Bearer ${token}`);
      jwt.verify.mockImplementation(() => {
        throw error;
      });

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe("Authentication failed");
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });

    it("should set both id and userId in req.user for compatibility", async () => {
      const token = "valid-token";
      const decoded = {
        id: "user123",
        isAdmin: true,
      };

      req.header.mockReturnValue(`Bearer ${token}`);
      jwt.verify.mockReturnValue(decoded);

      await authenticate(req, res, next);

      expect(req.user.id).toBe("user123");
      expect(req.user.userId).toBe("user123");
      expect(req.user.isAdmin).toBe(true);
    });
  });

  describe("authorizeAdmin", () => {
    it("should allow access for admin users", () => {
      req.user = {
        id: "1",
        isAdmin: true,
      };

      authorizeAdmin(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should deny access for non-admin users", () => {
      req.user = {
        id: "1",
        isAdmin: false,
      };

      authorizeAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Forbidden: Admins only",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should deny access if user is not authenticated", () => {
      req.user = null;

      authorizeAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "Not authenticated",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should deny access if req.user is undefined", () => {
      // req.user is undefined by default

      authorizeAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "Not authenticated",
      });
    });
  });

  describe("requireAuth", () => {
    it("should authenticate user with valid cookie token", async () => {
      const token = "valid-cookie-token";
      const decoded = {
        id: "user123",
        isAdmin: false,
      };

      req.cookies.token = token;
      jwt.verify.mockReturnValue(decoded);

      await requireAuth(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith(token, process.env.JWT_SECRET);
      expect(req.user).toEqual({
        id: "user123",
        userId: "user123",
        isAdmin: false,
      });
      expect(next).toHaveBeenCalledWith();
    });

    it("should return error if no cookie token provided", async () => {
      req.cookies = {}; // no token in cookies

      await requireAuth(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe(
        "Unauthorized - No token in cookie"
      );
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });

    it("should return error if cookie token is undefined", async () => {
      req.cookies.token = undefined;

      await requireAuth(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe(
        "Unauthorized - No token in cookie"
      );
    });

    it("should return error if cookie token is empty string", async () => {
      req.cookies.token = "";

      await requireAuth(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe(
        "Unauthorized - No token in cookie"
      );
    });

    it("should return error if token payload is invalid (missing id)", async () => {
      const token = "invalid-token";
      const decoded = {
        isAdmin: false,
        // missing id
      };

      req.cookies.token = token;
      jwt.verify.mockReturnValue(decoded);

      await requireAuth(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe("Invalid token payload");
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });

    it("should handle JsonWebTokenError", async () => {
      const token = "malformed-cookie-token";
      const error = new Error("jwt malformed");
      error.name = "JsonWebTokenError";

      req.cookies.token = token;
      jwt.verify.mockImplementation(() => {
        throw error;
      });

      await requireAuth(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe("Invalid token");
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });

    it("should handle TokenExpiredError", async () => {
      const token = "expired-cookie-token";
      const error = new Error("jwt expired");
      error.name = "TokenExpiredError";

      req.cookies.token = token;
      jwt.verify.mockImplementation(() => {
        throw error;
      });

      await requireAuth(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe("Token expired");
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });

    it("should handle generic authentication errors", async () => {
      const token = "error-cookie-token";
      const error = new Error("Some other error");

      req.cookies.token = token;
      jwt.verify.mockImplementation(() => {
        throw error;
      });

      await requireAuth(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe("Authentication failed");
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });

    it("should set both id and userId in req.user for compatibility", async () => {
      const token = "valid-cookie-token";
      const decoded = {
        id: "user456",
        isAdmin: true,
      };

      req.cookies.token = token;
      jwt.verify.mockReturnValue(decoded);

      await requireAuth(req, res, next);

      expect(req.user.id).toBe("user456");
      expect(req.user.userId).toBe("user456");
      expect(req.user.isAdmin).toBe(true);
    });

    it("should authenticate admin user from cookie", async () => {
      const token = "admin-cookie-token";
      const decoded = {
        id: "admin789",
        isAdmin: true,
      };

      req.cookies.token = token;
      jwt.verify.mockReturnValue(decoded);

      await requireAuth(req, res, next);

      expect(req.user).toEqual({
        id: "admin789",
        userId: "admin789",
        isAdmin: true,
      });
      expect(next).toHaveBeenCalledWith();
    });

    it("should preserve isAdmin false for regular users", async () => {
      const token = "regular-user-token";
      const decoded = {
        id: "regular123",
        isAdmin: false,
      };

      req.cookies.token = token;
      jwt.verify.mockReturnValue(decoded);

      await requireAuth(req, res, next);

      expect(req.user.isAdmin).toBe(false);
    });
  });
});
