// utils/emailService.js

import nodemailer from "nodemailer";

const emailSendingEnabled = () =>
  Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  );

const createTransporter = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

/**
 * Send password reset OTP (6-digit)
 * @param {string} email
 * @param {string} otp - 6-digit code
 */
export const sendPasswordResetEmail = async (email, otp) => {
  try {
    console.log("\n=== PASSWORD RESET OTP EMAIL ===");
    console.log(`To: ${email}`);
    console.log(`OTP Code: ${otp}`);
    console.log(`Expires: 10 minutes\n`);

    if (!emailSendingEnabled()) return true;

    const transporter = createTransporter();

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: "Password Reset Code - Hamro Pasal",
      text: `Your password reset code is: ${otp}. It expires in 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Password Reset Code</h2>
          <p>Your verification code is:</p>
          <h1 style="padding: 10px; background: #eee; display: inline-block;">
            ${otp}
          </h1>
          <p>This code expires in 10 minutes.</p>
        </div>
      `,
    });

    return true;
  } catch (error) {
    console.error("Error sending reset OTP:", error);
    return false;
  }
};


// Send confirmation email after password has been reset
export const sendPasswordResetConfirmation = async (email) => {
  try {
    console.log("\n=== PASSWORD RESET CONFIRMATION ===");
    console.log(`To: ${email}`);
    console.log("Message: Password has been reset.\n");

    if (!emailSendingEnabled()) return true;

    const transporter = createTransporter();

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: "Your Password Was Reset",
      text: `Your password has been successfully reset.`,
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Password Reset Successful</h2>
          <p>Your password has been updated.</p>
          <p>If this wasn't you, contact support immediately.</p>
        </div>
      `,
    });

    return true;
  } catch (error) {
    console.error("Error sending confirmation:", error);
    return false;
  }
};
