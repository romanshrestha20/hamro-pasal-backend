import jwt from "jsonwebtoken";
import { prisma } from "../lib/prismaClient.js";
import { AppError } from "../utils/AppError.js";




export const authenticate = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return next(new AppError("Access denied. No token provided.", 401));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verify that the token has the required id field
    if (!decoded.id) {
      return next(new AppError("Invalid token payload", 401));
    }

    // Set req.user with both id and userId for compatibility
    req.user = {
      id: decoded.id,
      userId: decoded.id, // Include for compatibility with changePassword
      isAdmin: decoded.isAdmin,
    };

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return next(new AppError("Invalid token", 401));
    }

    if (error.name === "TokenExpiredError") {
      return next(new AppError("Token expired", 401));
    }

    next(new AppError("Authentication failed", 401));
  }
};

export const authorizeAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  if (!req.user.isAdmin) {
    return res.status(403).json({ message: "Forbidden: Admins only" });
  }

  next();
};

// Cookie-based authentication middleware
export const requireAuth = (req, res, next) => {
  try {
    const token = req.cookies.token; // 👈 from cookie

    if (!token) {
      return next(new AppError("Unauthorized - No token in cookie", 401));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verify that the token has the required id field
    if (!decoded.id) {
      return next(new AppError("Invalid token payload", 401));
    }

    // Set req.user with both id and userId for compatibility
    req.user = {
      id: decoded.id,
      userId: decoded.id,
      isAdmin: decoded.isAdmin,
    };

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return next(new AppError("Invalid token", 401));
    }

    if (error.name === "TokenExpiredError") {
      return next(new AppError("Token expired", 401));
    }

    next(new AppError("Authentication failed", 401));
  }
};
const PUBLIC_ROUTES = [
  "/api/auth/forgot-password",
  "/api/auth/verify-otp",
  "/api/auth/reset-password",
];


export const authEither = async (req, res, next) => {
  try {
    const cleanUrl = req.originalUrl.split("?")[0];

    if (PUBLIC_ROUTES.some((route) => cleanUrl.startsWith(route))) {
      return next(); // LET OTP ROUTES PASS
    }
    console.log("authEither invoked for URL:", cleanUrl);

    // Cookie token exists?
    if (req.cookies?.token) {
      return requireAuth(req, res, next);
    }

    // Bearer token exists?
    const header = req.header("Authorization");
    if (header?.startsWith("Bearer ")) {
      return authenticate(req, res, next);
    }

    return next(new AppError("Access denied. No token provided.", 401));
  } catch (err) {
    next(err);
  }
};

