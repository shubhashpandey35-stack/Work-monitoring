import { z } from "zod";
import AppError from "../utils/AppError.js";

// Runs a Zod schema; throws a 400 error with the first message if invalid.
export const parse = (schema, data) => {
  const result = schema.safeParse(data);
  if (!result.success) throw new AppError(result.error.issues[0].message, 400);
  return result.data;
};

const email = z
  .string({ required_error: "Email is required" })
  .trim()
  .toLowerCase()
  .email("Please enter a valid email address");

export const registerSchema = z
  .object({
    name: z
      .string({ required_error: "Name is required" })
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(60, "Name is too long"),
    email,
    password: z
      .string({ required_error: "Password is required" })
      .min(8, "Password must be at least 8 characters")
      .max(72, "Password is too long")
      .regex(/[A-Za-z]/, "Password must contain at least one letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string({ required_error: "Please confirm your password" }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email,
  password: z.string({ required_error: "Password is required" }).min(1, "Password is required"),
});
