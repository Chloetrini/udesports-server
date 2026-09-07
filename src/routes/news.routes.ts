import { Router } from "express";
import {
  getAllNews,
  getAllNewsAdmin,
  getNews,
  createNews,
  updateNews,
  deleteNews,
} from "../controllers/news.controller.js";
import { protect, authorize } from "../middlewares/auth.middleware.js";
import { cacheMiddleware, invalidateCache } from "../middlewares/cache.middleware.js";

const router = Router();

// PUBLIC ROUTES (live website — published only)
router.get("/", cacheMiddleware("news", 120), getAllNews);
router.get("/:id", cacheMiddleware("news", 120), getNews);

// PROTECTED ROUTES (admins only)
router.get("/admin/all", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), getAllNewsAdmin);
router.post("/", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), invalidateCache("news"), createNews);
router.put("/:id", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), invalidateCache("news"), updateNews);
router.delete("/:id", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), invalidateCache("news"), deleteNews);

export default router;