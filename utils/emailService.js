// utils/emailService.js
// Side-effect-free email service with optional SMTP sending.
// The functions below log useful information in development and
// only send real emails when SMTP_* env variables are configured.

import nodemailer from "nodemailer";

const emailSendingEnabled = () =>
  Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  );

const createTransporter = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true", // true for 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

/**
 * Send password reset email
 * @param {string} email - Recipient email
 * @param {string} resetToken - Plain text reset token (not hashed)
 * @returns {Promise<boolean>}
 */
export const sendPasswordResetEmail = async (email, resetToken) => {
  try {
    const resetLink = `${
      process.env.FRONTEND_URL || "http://localhost:3000"
    }/auth/reset-password?token=${resetToken}`;

    // Development diagnostics
    console.log("\n=== PASSWORD RESET EMAIL ===");
    console.log(`To: ${email}`);
    console.log(`Reset Link: ${resetLink}`);
    console.log(`Expires: 1 hour from now`);
    console.log("============================\n");

    if (!emailSendingEnabled()) {
      // No SMTP configured; treat as success to keep local DX smooth
      return true;
    }

    const transporter = createTransporter();
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: "Password Reset - Hamro Pasal",
      text: `Reset your password: ${resetLink}\nThis link expires in 1 hour.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Reset Your Password</h2>
          <p>You requested to reset your password. Click the link below to create a new password:</p>
          <p><a href="${resetLink}">Reset Password</a></p>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
      `,
    });

    console.log("Password reset email sent successfully");
  } catch (error) {
    console.error("Error sending password reset email:", error);
    return false;
  }
};

/**
 * Send password reset confirmation email
 * @param {string} email - Recipient email
 * @returns {Promise<boolean>}
 */
export const sendPasswordResetConfirmation = async (email) => {
  try {
    console.log("\n=== PASSWORD RESET CONFIRMATION ===");
    console.log(`To: ${email}`);
    console.log("Message: Your password has been successfully reset.");
    console.log("===================================\n");

    if (!emailSendingEnabled()) {
      return true;
    }

    const transporter = createTransporter();
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: "Your Password Was Reset",
      text: `Your password has been successfully reset. If this wasn't you, please contact support immediately.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Confirmation</h2>
          <p>Your password has been successfully reset.</p>
          <p>If this wasn't you, please contact support immediately.</p>
        </div>
      `,
    });

    return true;
  } catch (error) {
    console.error("Error sending confirmation email:", error);
    return false;
  }
};
