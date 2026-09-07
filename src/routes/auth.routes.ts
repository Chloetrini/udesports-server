import { Router } from "express";
import {
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  inviteAdmin,
  setPassword,
  getAllAdmins,
  deleteAdmin,
  verifyResetCode,
  updateAdmin,
  updateProfile,
} from "../controllers/auth.controller.js";
import { protect, authorize } from "../middlewares/auth.middleware.js";

const router = Router();

// PUBLIC ROUTES (no login needed)
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-code", verifyResetCode);
router.put("/reset-password", resetPassword);
router.put("/set-password/:token", setPassword);

// PROTECTED ROUTES (must be logged in)
router.post("/logout", protect, logout);
router.get("/me", protect, getMe);

// SUPER ADMIN ONLY
router.post("/invite", protect, authorize("SUPER_ADMIN"), inviteAdmin);
router.get("/admins", protect, authorize("SUPER_ADMIN"), getAllAdmins);
router.delete("/admins/:id", protect, authorize("SUPER_ADMIN"), deleteAdmin);

// PROFILE / ADMIN MANAGEMENT
router.put("/profile", protect, updateProfile);
router.put("/admins/:id", protect, authorize("SUPER_ADMIN"), updateAdmin);

export default router;