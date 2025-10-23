import { z } from "zod";

// --- 1️⃣ Create User Schema ---
export const createUserSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().optional(),
  address: z.string().optional(),
  isAdmin: z.boolean().optional().default(false),
});

export const userIdParamSchema = z.object({
  id: z.string().uuid("Invalid user ID"),
});
export type UserIdParam = z.infer<typeof userIdParamSchema>;


// --- 2️⃣ Update User Schema (partial) ---
export const updateUserSchema = createUserSchema.partial();

// --- 3️⃣ Login Schema ---
export const loginUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// --- 4️⃣ TypeScript types ---
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type LoginUserInput = z.infer<typeof loginUserSchema>;


export const userEmailParamSchema = z.object({
  email: z.string().email("Invalid email address"),
});
export type UserEmailParam = z.infer<typeof userEmailParamSchema>;

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, "Old password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
}).strict();

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;