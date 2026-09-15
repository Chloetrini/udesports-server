import { Router } from "express";
import {
  getStaff,
  getStaffAdmin,
  createStaffMember,
  updateStaffMember,
  deleteStaffMember,
} from "../controllers/staff.controller.js";
import { protect, authorize } from "../middlewares/auth.middleware.js";
import { cacheMiddleware, invalidateCache } from "../middlewares/cache.middleware.js";

const router = Router();

// PUBLIC ROUTES (live website — published only)
router.get("/", cacheMiddleware("staff", 120), getStaff);

// PROTECTED ROUTES (admins only)
router.get("/admin/all", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), getStaffAdmin);
router.post("/", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), invalidateCache("staff"), createStaffMember);
router.put("/:id", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), invalidateCache("staff"), updateStaffMember);
router.delete("/:id", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), invalidateCache("staff"), deleteStaffMember);

export default router;
