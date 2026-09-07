import { Router } from "express";
import {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from "../controllers/notification.controller.js";
import { protect, authorize } from "../middlewares/auth.middleware.js";

const router = Router();

// PUBLIC — website contact form submits here (no login)
router.post("/", createNotification);

// PROTECTED — admin inbox
router.get("/", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), getNotifications);
router.put("/read-all", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), markAllAsRead);
router.put("/:id/read", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), markAsRead);
router.delete("/:id", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), deleteNotification);

export default router;