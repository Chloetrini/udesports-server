import { Router } from "express";
import {
  getGallery,
  getGalleryAdmin,
  createGalleryItem,
  updateGalleryItem,
  deleteGalleryItem,
} from "../controllers/gallery.controller.js";
import { protect, authorize } from "../middlewares/auth.middleware.js";
import { cacheMiddleware, invalidateCache } from "../middlewares/cache.middleware.js";

const router = Router();

// PUBLIC
router.get("/", cacheMiddleware("gallery", 120), getGallery);

// PROTECTED — admins only
router.get("/admin/all", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), getGalleryAdmin);
router.post("/", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), invalidateCache("gallery"), createGalleryItem);
router.put("/:id", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), invalidateCache("gallery"), updateGalleryItem);
router.delete("/:id", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), invalidateCache("gallery"), deleteGalleryItem);

export default router;