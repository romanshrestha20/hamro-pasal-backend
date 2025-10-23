import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

export const authenticate = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ message: "No token provided" });
  if (!JWT_SECRET)
    return res
      .status(500)
      .json({ message: "JWT_SECRET is not defined in environment variables" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });

    req.user = user; // attach user to request
    next();
  });
};

export const authorizeAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Not authenticated" });
  if (!req.user.isAdmin)
    return res.status(403).json({ message: "Forbidden: Admins only" });

  next();
};
