import { Router } from "express";
import { getSettings, updateSettings } from "../controllers/settings.controller.js";
import { protect, authorize } from "../middlewares/auth.middleware.js";
import { cacheMiddleware, invalidateCache } from "../middlewares/cache.middleware.js";

const router = Router();

// PUBLIC — site title & socials display on the live website
router.get("/", cacheMiddleware("settings", 300), getSettings);

// PROTECTED — only Super Admin edits site settings
router.put("/", protect, authorize("SUPER_ADMIN"), invalidateCache("settings"), updateSettings);

export default router;