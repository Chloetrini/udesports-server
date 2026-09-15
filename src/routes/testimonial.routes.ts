import { Router } from "express";
import {
  getAllTestimonials,
  getAllTestimonialsAdmin,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
} from "../controllers/testimonial.controller.js";
import { protect, authorize } from "../middlewares/auth.middleware.js";
import { cacheMiddleware, invalidateCache } from "../middlewares/cache.middleware.js";

const router = Router();

// PUBLIC ROUTES (live website — published only)
router.get("/", cacheMiddleware("testimonials", 120), getAllTestimonials);

// PROTECTED ROUTES (admins only)
router.get("/admin/all", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), getAllTestimonialsAdmin);
router.post("/", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), invalidateCache("testimonials"), createTestimonial);
router.put("/:id", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), invalidateCache("testimonials"), updateTestimonial);
router.delete("/:id", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), invalidateCache("testimonials"), deleteTestimonial);

export default router;
