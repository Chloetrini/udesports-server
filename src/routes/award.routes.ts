import { Router } from "express";
import {
  getAwards,
  getAwardsAdmin,
  createAward,
  updateAward,
  deleteAward,
} from "../controllers/award.controller.js";
import { protect, authorize } from "../middlewares/auth.middleware.js";
import { cacheMiddleware, invalidateCache } from "../middlewares/cache.middleware.js";

const router = Router();

// PUBLIC ROUTES (live website — published only)
router.get("/", cacheMiddleware("awards", 300), getAwards);

// PROTECTED ROUTES (admins only)
router.get("/admin/all", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), getAwardsAdmin);
router.post("/", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), invalidateCache("awards"), createAward);
router.put("/:id", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), invalidateCache("awards"), updateAward);
router.delete("/:id", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), invalidateCache("awards"), deleteAward);

export default router;

