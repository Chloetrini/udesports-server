import { Router } from "express";
import {
  subscribe,
  unsubscribe,
  getAllSubscribersAdmin,
} from "../controllers/newsletter.controller.js";
import { protect, authorize } from "../middlewares/auth.middleware.js";

const router = Router();

// PUBLIC ROUTES
router.post("/subscribe", subscribe);
router.get("/unsubscribe/:token", unsubscribe);

// PROTECTED ROUTES (admins only)
router.get("/admin/all", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), getAllSubscribersAdmin);

export default router;
