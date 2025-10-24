import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prismaClient.js";
import { AppError } from "../utils/AppError.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleAuth = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      throw new AppError("Missing Google token", 400);
    }

    // ✅ Verify the Google ID token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    // ✅ Extract user info from payload
    const payload = ticket.getPayload();
    const { sub, email, name, picture } = payload;

    if (!email) throw new AppError("Google token missing email", 400);

    // ✅ Check if user exists in DB
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      const [firstName, ...lastNameParts] = (name || "").split(" ");
      user = await prisma.user.create({
        data: {
          firstName: firstName || "",
          lastName: lastNameParts.join(" "),
          email,
          provider: "google",
          providerId: sub,
          image: picture,
          isAdmin: false,
          password: "",
        },
      });
    }

    // ✅ Generate your app JWT
    const appToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
        provider: "google",
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // ✅ Respond with your app token + user data
    res.status(200).json({
      success: true,
      message: "Google login successful",
      token: appToken,
      user,
    });
  } catch (error) {
    console.error("Google authentication error:", error);
    next(new AppError("Google authentication failed", 500));
  }
};
