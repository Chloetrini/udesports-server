import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Extend Express Request to carry the logged-in admin's info
export interface AuthRequest extends Request {
  admin?: {
    id: string;
    role: string;
  };
}

// ============================================================
// PROTECT — verifies the JWT from the httpOnly cookie.
// Add to any route that requires a logged-in admin.
// ============================================================
export const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // the token now comes from the cookie, not the Authorization header
    const token = req.cookies?.token;

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Not authorized - please log in",
      });
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET not set");

    // verify and decode
    const decoded = jwt.verify(token, secret) as { id: string; role: string };

    // attach admin info to the request for later handlers
    req.admin = { id: decoded.id, role: decoded.role };
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Not authorized - invalid or expired session",
    });
  }
};

// ============================================================
// AUTHORIZE — restricts a route to specific roles.
// Usage: authorize("SUPER_ADMIN")  or  authorize("SUPER_ADMIN", "ADMIN")
// ============================================================
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.admin || !roles.includes(req.admin.role)) {
      res.status(403).json({
        success: false,
        message: "Access denied - insufficient permissions",
      });
      return;
    }
    next();
  };
};