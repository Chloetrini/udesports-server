import { Request, Response } from "express";
import { UploadedFile } from "express-fileupload";
import { prisma } from "../config/prisma.js";
import cloudinary from "../config/cloudinary.js";
import tryCatchWrapper from "../lib/tryCatchWrapper.js";
import { sendTsRestSuccess, sendTsRestError } from "../lib/responseHandler.js";

// Uploads a single image field (if present in req.files) to Cloudinary and
// returns its secure URL. Shared by playerPhoto and both club-logo fields so
// the upload_stream boilerplate isn't repeated for every field.
async function uploadImageField(
  req: Request,
  field: string,
  folder: string
): Promise<string | null> {
  if (!req.files || !req.files[field]) return null;

  const file = (Array.isArray(req.files[field])
    ? req.files[field][0]
    : req.files[field]) as UploadedFile;

  const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder, transformation: [{ width: 400, quality: "auto", fetch_format: "auto" }] }, (error, result) => {
        if (error || !result) reject(error);
        else resolve(result);
      })
      .end(file.data);
  });

  return result.secure_url;
}

// GET ALL PLAYERS (public — only published players are visible on the live site)
export const getPlayers = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const players = await prisma.player.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
  });

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Players fetched successfully",
    body: { count: players.length, players },
  });
});

// GET ALL PLAYERS (admin — includes drafts, so a saved-as-draft player is
// still visible in the admin list even though it's hidden from the public site)
export const getPlayersAdmin = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const players = await prisma.player.findMany({
    orderBy: { createdAt: "desc" },
  });

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Players fetched successfully",
    body: { count: players.length, players },
  });
});

// GET SINGLE PLAYER
export const getPlayer = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const player = await prisma.player.findUnique({
    where: { id: req.params.id as string },
  });

  if (!player) {
    return sendTsRestError(res, 404, "Player not found");
  }

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Player fetched successfully",
    body: { player },
  });
});

// CREATE PLAYER
export const createPlayer = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const {
    playerName,
    playerFullName,
    DOB,
    nationality,
    height,
    preferredFoot,
    ageGroup,
    status,
    position,
    goals,
    assists,
    saves,
    cleanSheets,
    rating,
    previousClubName,
    previousClubLogo,
    currentClubName,
    currentClubLogo,
    playerHistory,
    playerAppearance,
    isFeatured,
    published,
  } = req.body;

  // prevent duplicate player names
  const existingName = await prisma.player.findFirst({ where: { playerName } });
  if (existingName) {
    return sendTsRestError(res, 400, "Player name already exists");
  }

  // Upload player image to Cloudinary — only if a file was sent
  let playerPhoto: string | null = null;

  if (req.files && req.files.playerPhoto) {
    const file = (Array.isArray(req.files.playerPhoto)
      ? req.files.playerPhoto[0]
      : req.files.playerPhoto) as UploadedFile;

    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { folder: "udesport/players", transformation: [{ width: 800, quality: "auto", fetch_format: "auto" }] },
          (error, result) => {
            if (error || !result) reject(error);
            else resolve(result);
          }
        )
        .end(file.data);
    });
    playerPhoto = result.secure_url;
  }

  // Club logos: an uploaded file (if provided) wins over a pasted URL.
  const uploadedPreviousClubLogo = await uploadImageField(req, "previousClubLogo", "udesport/clubs");
  const uploadedCurrentClubLogo = await uploadImageField(req, "currentClubLogo", "udesport/clubs");

  const player = await prisma.player.create({
    data: {
      playerName,
      playerFullName: playerFullName || null,
      DOB: new Date(DOB),
      nationality,
      height: height ? Number(height) : null,
      preferredFoot,
      ageGroup,
      status: status || "FREE",
      position,
      goals: goals ? Number(goals) : 0,
      assists: assists ? Number(assists) : 0,
      saves: saves ? Number(saves) : 0,
      cleanSheets: cleanSheets ? Number(cleanSheets) : 0,
      rating: rating ? Number(rating) : null,
      previousClubName: previousClubName || null,
      previousClubLogo: uploadedPreviousClubLogo || previousClubLogo || null,
      currentClubName: currentClubName || null,
      currentClubLogo: uploadedCurrentClubLogo || currentClubLogo || null,
      playerHistory: playerHistory || null,
      playerAppearance: playerAppearance ? String(playerAppearance) : "0",
      isFeatured: isFeatured === "true" || isFeatured === true ? true : false,
      // Defaults to published so a plain create (no publish flag sent) never
      // silently hides a player; the admin form's Save as Draft button is
      // what explicitly sends published: false.
      published: published === undefined ? true : published === "true" || published === true,
      playerPhoto,
    },
  });

  sendTsRestSuccess(res, 201, {
    success: true,
    message: "Player added successfully",
    body: { player },
  });
});

// BULK CREATE PLAYERS — for importing many players at once (e.g. from a
// CSV) instead of filling the Add Player form one at a time. Text/JSON
// only, no photo/logo file uploads here (those still go through the
// per-player edit form afterward). Every row is processed independently
// so one bad/duplicate row doesn't block the rest of the batch — the
// response reports success/failure per row.
export const createPlayersBulk = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const { players } = req.body;

  if (!Array.isArray(players) || players.length === 0) {
    return sendTsRestError(res, 400, 'Expected a non-empty "players" array');
  }
  if (players.length > 200) {
    return sendTsRestError(res, 400, "Too many players in one batch (max 200) — split into smaller batches");
  }

  const REQUIRED_FIELDS = ["playerName", "DOB", "nationality", "preferredFoot", "ageGroup", "position"] as const;

  const results: { playerName: string; success: boolean; error?: string }[] = [];

  for (const raw of players) {
    const row = (raw ?? {}) as Record<string, unknown>;
    const label =
      typeof row.playerName === "string" && row.playerName.trim() ? row.playerName.trim() : "(unnamed row)";

    const missing = REQUIRED_FIELDS.filter(
      (field) => row[field] === undefined || row[field] === null || row[field] === ""
    );
    if (missing.length > 0) {
      results.push({ playerName: label, success: false, error: `Missing required field(s): ${missing.join(", ")}` });
      continue;
    }

    const dobDate = new Date(row.DOB as string);
    if (Number.isNaN(dobDate.getTime())) {
      results.push({ playerName: label, success: false, error: "Invalid DOB" });
      continue;
    }

    try {
      const existingName = await prisma.player.findFirst({ where: { playerName: row.playerName as string } });
      if (existingName) {
        results.push({ playerName: label, success: false, error: "Player name already exists" });
        continue;
      }

      await prisma.player.create({
        data: {
          playerName: row.playerName as string,
          playerFullName: (row.playerFullName as string) || null,
          DOB: dobDate,
          nationality: row.nationality as string,
          height: row.height ? Number(row.height) : null,
          preferredFoot: row.preferredFoot as string,
          ageGroup: row.ageGroup as string,
          // Cast to `any` here to match createPlayer's behavior above — its
          // destructured `status` is implicitly `any` (from the untyped
          // Express req.body), which Prisma's generated PlayerStatus enum
          // type accepts; `row` here is explicitly typed, so the same value
          // needs an explicit escape hatch to satisfy the compiler the
          // same way.
          status: (row.status as any) || "FREE",
          position: row.position as string,
          goals: row.goals ? Number(row.goals) : 0,
          assists: row.assists ? Number(row.assists) : 0,
          saves: row.saves ? Number(row.saves) : 0,
          cleanSheets: row.cleanSheets ? Number(row.cleanSheets) : 0,
          rating: row.rating ? Number(row.rating) : null,
          previousClubName: (row.previousClubName as string) || null,
          previousClubLogo: (row.previousClubLogo as string) || null,
          currentClubName: (row.currentClubName as string) || null,
          currentClubLogo: (row.currentClubLogo as string) || null,
          playerHistory: (row.playerHistory as string) || null,
          playerAppearance: row.playerAppearance ? String(row.playerAppearance) : "0",
          isFeatured: row.isFeatured === true || row.isFeatured === "true",
          // Bulk-imported players always land as drafts — this endpoint
          // is for getting a lot of data in quickly (e.g. from a CSV)
          // before photos/logos/final review are ready. Nothing goes
          // live from here automatically; publish each one individually
          // from the admin edit form once it's ready.
          published: false,
          playerPhoto: null,
        },
      });

      results.push({ playerName: label, success: true });
    } catch (err) {
      results.push({
        playerName: label,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;

  sendTsRestSuccess(res, 201, {
    success: true,
    message: `${successCount}/${players.length} players created as drafts`,
    body: { results },
  });
});

// UPDATE PLAYER
export const updatePlayer = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const existing = await prisma.player.findUnique({
    where: { id: req.params.id as string },
  });

  if (!existing) {
    return sendTsRestError(res, 404, "Player not found");
  }

  const {
    playerName,
    playerFullName,
    DOB,
    nationality,
    height,
    preferredFoot,
    ageGroup,
    status,
    position,
    goals,
    assists,
    saves,
    cleanSheets,
    rating,
    previousClubName,
    previousClubLogo,
    currentClubName,
    currentClubLogo,
    playerHistory,
    playerAppearance,
    isFeatured,
    published,
  } = req.body;

  // keep current photo; replace only if a new one is uploaded
  let playerPhoto = existing.playerPhoto;

  if (req.files && req.files.playerPhoto) {
    const file = (Array.isArray(req.files.playerPhoto)
      ? req.files.playerPhoto[0]
      : req.files.playerPhoto) as UploadedFile;

    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { folder: "udesport/players", transformation: [{ width: 800, quality: "auto", fetch_format: "auto" }] },
          (error, result) => {
            if (error || !result) reject(error);
            else resolve(result);
          }
        )
        .end(file.data);
    });
    playerPhoto = result.secure_url;
  }

  // Club logos: an uploaded file (if provided) wins over a pasted URL;
  // otherwise fall back to whatever was sent as a plain string (or leave
  // untouched, same as every other field, if nothing was sent at all).
  const uploadedPreviousClubLogo = await uploadImageField(req, "previousClubLogo", "udesport/clubs");
  const uploadedCurrentClubLogo = await uploadImageField(req, "currentClubLogo", "udesport/clubs");

  // Prisma ignores `undefined`, so unsent fields stay untouched
  const player = await prisma.player.update({
    where: { id: req.params.id as string },
    data: {
      playerName: playerName ?? undefined,
      playerFullName: playerFullName ?? undefined,
      DOB: DOB ? new Date(DOB) : undefined,
      nationality: nationality ?? undefined,
      height: height !== undefined ? Number(height) : undefined,
      preferredFoot: preferredFoot ?? undefined,
      ageGroup: ageGroup ?? undefined,
      status: status ?? undefined,
      position: position ?? undefined,
      goals: goals !== undefined ? Number(goals) : undefined,
      assists: assists !== undefined ? Number(assists) : undefined,
      saves: saves !== undefined ? Number(saves) : undefined,
      cleanSheets: cleanSheets !== undefined ? Number(cleanSheets) : undefined,
      rating: rating !== undefined ? Number(rating) : undefined,
      previousClubName: previousClubName ?? undefined,
      previousClubLogo: uploadedPreviousClubLogo ?? previousClubLogo ?? undefined,
      currentClubName: currentClubName ?? undefined,
      currentClubLogo: uploadedCurrentClubLogo ?? currentClubLogo ?? undefined,
      playerHistory: playerHistory ?? undefined,
      playerAppearance: playerAppearance !== undefined ? String(playerAppearance) : undefined,
      isFeatured:
        isFeatured === undefined ? undefined : isFeatured === "true" || isFeatured === true,
      published:
        published === undefined ? undefined : published === "true" || published === true,
      playerPhoto,
    },
  });

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Player updated successfully",
    body: { player },
  });
});

// DELETE PLAYER
export const deletePlayer = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const existing = await prisma.player.findUnique({
    where: { id: req.params.id as string },
  });

  if (!existing) {
    return sendTsRestError(res, 404, "Player not found");
  }

  await prisma.player.delete({ where: { id: req.params.id as string } });

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Player deleted successfully",
  });
});

// DASHBOARD STATS — powers the Overview screen
export const getDashboardStats = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const calcPercent = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  // ---- TOP CARDS ----
  const totalPlayers = await prisma.player.count();
  const lastMonthPlayers = await prisma.player.count({
    where: { createdAt: { lt: startOfThisMonth } },
  });

  const publishedArticles = await prisma.news.count({
    where: { published: true },
  });
  const articlesToday = await prisma.news.count({
    where: { published: true, createdAt: { gte: startOfToday } },
  });

  // ---- AGE GROUP STATS ----
  const u17 = await prisma.player.count({ where: { ageGroup: "U-17" } });
  const u21 = await prisma.player.count({ where: { ageGroup: "U-21" } });
  const u23 = await prisma.player.count({ where: { ageGroup: "U-23" } });
  const professional = await prisma.player.count({ where: { ageGroup: "Professional" } });
  const freeAgents = await prisma.player.count({ where: { status: "FREE" } });

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Dashboard stats fetched successfully",
    body: {
      stats: {
        playersThisSeason: {
          count: totalPlayers,
          percent: calcPercent(totalPlayers, lastMonthPlayers),
        },
        completedTransfers: { count: 0 },
        liveNegotiations: { count: 0 },
        publishedArticles: { count: publishedArticles, today: articlesToday },
        transferStats: {
          totalTransfers: 0,
          thisSeason: 0,
          inNegotiation: 0,
        },
        ageGroupStats: { u17, u21, u23, professional, freeAgents },
      },
    },
  });
});
