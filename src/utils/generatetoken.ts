import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Response } from "express";


// GENERATE JWT — used after login / setting password

export const generateJWT = (adminId: string, role: string): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not defined");

  return jwt.sign({ id: adminId, role }, secret, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  } as jwt.SignOptions);
};

// SET TOKEN COOKIE — sends the JWT as an httpOnly cookie
// The browser stores it automatically and sends it on every request.
// JavaScript on the frontend cannot read it (httpOnly) = safer.
export const sendTokenCookie = (res: Response, token: string): void => {
  res.cookie("token", token, {
    httpOnly: true, // JS can't access it — protects against XSS
    secure: process.env.NODE_ENV === "production", // HTTPS only in production
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  });
};


// GENERATE RANDOM TOKEN — for invite links & password reset
// Raw token goes in the email link; hashed version stored in DB

export const generateRandomToken = (): string => {
  return crypto.randomBytes(32).toString("hex");
};


// HASH TOKEN — before storing in database

export const hashToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};