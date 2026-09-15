import { Router } from "express";
import {
  getAllQuickUpdates,
  getAllQuickUpdatesAdmin,
  createQuickUpdate,
  updateQuickUpdate,
  deleteQuickUpdate,
} from "../controllers/quickUpdate.controller.js";
import { protect, authorize } from "../middlewares/auth.middleware.js";
import { cacheMiddleware, invalidateCache } from "../middlewares/cache.middleware.js";

const router = Router();

// PUBLIC ROUTES (live website — published only)
router.get("/", cacheMiddleware("quickUpdates", 120), getAllQuickUpdates);

// PROTECTED ROUTES (admins only)
router.get("/admin/all", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), getAllQuickUpdatesAdmin);
router.post("/", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), invalidateCache("quickUpdates"), createQuickUpdate);
router.put("/:id", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), invalidateCache("quickUpdates"), updateQuickUpdate);
router.delete("/:id", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), invalidateCache("quickUpdates"), deleteQuickUpdate);

export default router;
