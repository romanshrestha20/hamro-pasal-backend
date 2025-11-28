import crypto from "crypto";

// Generate a simple numeric OTP code
export function generateOtpCode(length = 6): string {
  // simple numeric code
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return Math.floor(min + Math.random() * (max - min)).toString();
}

// Add minutes to a date
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

// Plain random token to send to client (you may hash in DB)
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}
