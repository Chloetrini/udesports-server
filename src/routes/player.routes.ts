import { Router } from "express";
import {
  getPlayers,
  getPlayersAdmin,
  getPlayer,
  createPlayer,
  updatePlayer,
  deletePlayer,
  getDashboardStats,
} from "../controllers/player.controller.js";
import { protect, authorize } from "../middlewares/auth.middleware.js";
import { cacheMiddleware, invalidateCache } from "../middlewares/cache.middleware.js";

const router = Router();

// PUBLIC ROUTES (anyone can view — your live website; published players only)
router.get("/", cacheMiddleware("players", 60), getPlayers);
router.get("/:id", cacheMiddleware("players", 60), getPlayer);

// PROTECTED ROUTES (logged-in admins only)
router.get("/admin/all", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), getPlayersAdmin);
router.get("/stats/overview", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), getDashboardStats);
router.post("/", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), invalidateCache("players"), createPlayer);
router.put("/:id", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), invalidateCache("players"), updatePlayer);
router.delete("/:id", protect, authorize("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), invalidateCache("players"), deletePlayer);

export default router;
