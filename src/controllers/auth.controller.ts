import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../config/prisma.js";
import { generateJWT, sendTokenCookie, generateRandomToken, hashToken } from "../utils/generatetoken.js";
import { sendEmailToRecipient as sendEmail } from "../email/send-email.js";
import { inviteEmailTemplate, passwordResetEmailTemplate } from "../lib/emailTemplate.js";
import { EmailService } from "../services/email.service.js";
import { AuthRequest } from "../middlewares/auth.middleware.js";
import tryCatchWrapper from "../lib/tryCatchWrapper.js";
import { sendTsRestSuccess, sendTsRestError } from "../lib/responseHandler.js";

// Only these two roles can ever be granted through invite/edit — a Super
// Admin can promote someone to Admin or Sub Admin, but never to Super
// Admin. There's exactly one Super Admin: whoever is set up via
// ADMIN_EMAIL/ADMIN_PASSWORD at first boot.
const GRANTABLE_ROLES = ["ADMIN", "SUB_ADMIN"] as const;
type GrantableRole = (typeof GRANTABLE_ROLES)[number];
const isGrantableRole = (value: unknown): value is GrantableRole =>
  typeof value === "string" && (GRANTABLE_ROLES as readonly string[]).includes(value);

// LOGIN — checks credentials, sets httpOnly cookie
export const login = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    return sendTsRestError(res, 400, "Email and password are required");
  }

  const admin = await prisma.admin.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!admin) {
    return sendTsRestError(res, 401, "Invalid email or password");
  }

  // invited-but-not-activated admins have no password yet
  if (!admin.isActive || !admin.password) {
    return sendTsRestError(res, 401, "Account not activated. Please set your password from your invite email.");
  }

  const isMatch = await bcrypt.compare(password, admin.password);
  if (!isMatch) {
    return sendTsRestError(res, 401, "Invalid email or password");
  }

  // sign JWT and set it as an httpOnly cookie
  const token = generateJWT(admin.id, admin.role);
  sendTokenCookie(res, token);

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Login successful",
    body: { admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } },
  });
});

// LOGOUT — clears the cookie
export const logout = tryCatchWrapper(async (_req: Request, res: Response): Promise<void> => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });
  sendTsRestSuccess(res, 200, { success: true, message: "Logged out successfully" });
});

// GET ME — returns the currently logged-in admin
export const getMe = tryCatchWrapper(async (req: AuthRequest, res: Response): Promise<void> => {
  const admin = await prisma.admin.findUnique({
    where: { id: req.admin?.id },
    select: { id: true, name: true, email: true, role: true }, // never return password
  });

  if (!admin) {
    return sendTsRestError(res, 404, "Admin not found");
  }

  sendTsRestSuccess(res, 200, { success: true, message: "Admin fetched", body: { admin } });
});

// FORGOT PASSWORD — emails a 4-digit code
export const forgotPassword = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  if (!email) {
    return sendTsRestError(res, 400, "Email is required");
  }

  const admin = await prisma.admin.findUnique({
    where: { email: email.toLowerCase() },
  });

  // always return success — don't leak which emails exist
  if (!admin) {
    return sendTsRestSuccess(res, 200, {
      success: true,
      message: "If that email is registered, a code has been sent.",
    });
  }

  // generate a random 4-digit code (1000–9999)
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  const hashedCode = hashToken(code); // store hashed, never plain

  await prisma.admin.update({
    where: { id: admin.id },
    data: {
      resetPasswordToken: hashedCode,
      resetPasswordExpire: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    },
  });

  const { subject, html } = passwordResetEmailTemplate(admin.name, code);
  await sendEmail({ to: admin.email, subject, html });

  sendTsRestSuccess(res, 200, { success: true, message: "A 4-digit code has been sent to your email." });
});

// VERIFY RESET CODE — checks the 4-digit code (Verification screen)
export const verifyResetCode = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const { email, code } = req.body;

  if (!email || !code) {
    return sendTsRestError(res, 400, "Email and code are required");
  }

  const hashedCode = hashToken(code);

  const admin = await prisma.admin.findFirst({
    where: {
      email: email.toLowerCase(),
      resetPasswordToken: hashedCode,
      resetPasswordExpire: { gt: new Date() },
    },
  });

  if (!admin) {
    return sendTsRestError(res, 400, "Invalid or expired code");
  }

  sendTsRestSuccess(res, 200, { success: true, message: "Code verified. You can set a new password." });
});

// RESET PASSWORD — sets new password after code is verified
export const resetPassword = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const { email, code, password, confirmPassword } = req.body;

  if (!email || !code || !password || !confirmPassword) {
    return sendTsRestError(res, 400, "All fields are required");
  }
  if (password !== confirmPassword) {
    return sendTsRestError(res, 400, "Passwords do not match");
  }
  if (password.length < 8) {
    return sendTsRestError(res, 400, "Password must be at least 8 characters");
  }

  const hashedCode = hashToken(code);

  // re-verify the code at the final step too (security)
  const admin = await prisma.admin.findFirst({
    where: {
      email: email.toLowerCase(),
      resetPasswordToken: hashedCode,
      resetPasswordExpire: { gt: new Date() },
    },
  });

  if (!admin) {
    return sendTsRestError(res, 400, "Invalid or expired code");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.admin.update({
    where: { id: admin.id },
    data: {
      password: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpire: null,
    },
  });

  sendTsRestSuccess(res, 200, { success: true, message: "Password reset successful! You can log in now." });
});

// INVITE ADMIN — Super Admin invites a new admin/sub-admin (sends email)
export const inviteAdmin = tryCatchWrapper(async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, email, role } = req.body;

  if (!name || !email || !role) {
    return sendTsRestError(res, 400, "Name, email, and role are required");
  }

  // a Super Admin can only ever grant Admin or Sub Admin — never another
  // Super Admin (there's exactly one, set up via ADMIN_EMAIL/ADMIN_PASSWORD)
  if (!isGrantableRole(role)) {
    return sendTsRestError(res, 400, "Role must be either ADMIN or SUB_ADMIN");
  }

  // prevent duplicates
  const existing = await prisma.admin.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (existing) {
    return sendTsRestError(res, 400, "An admin with this email already exists");
  }

  const rawToken = generateRandomToken();
  const hashedToken = hashToken(rawToken);

  // create the admin row WITHOUT a password yet; inactive until they set it
  const admin = await prisma.admin.create({
    data: {
      name,
      email: email.toLowerCase(),
      role,
      isActive: false,
      inviteToken: hashedToken,
      inviteExpire: new Date(Date.now() + Number(process.env.INVITE_TOKEN_EXPIRE || 86400000)), // 24h
    },
  });

  // invite link → frontend set-password page (admin/new-password reads
  // the `token` query param and calls PUT /auth/set-password/:token)
  const inviteUrl = `${process.env.CLIENT_URL}/admin/new-password?token=${rawToken}`;
  const inviter = req.admin ? await prisma.admin.findUnique({ where: { id: req.admin.id }, select: { name: true } }) : null;

  // Route through EmailService (not a raw sendEmail call): it checks whether
  // Brevo actually accepted the send and, if not, queues the email for the
  // retry cron instead of silently dropping it — the previous version here
  // called sendEmail and ignored the result entirely, so a failed send still
  // reported "Invite sent" with no record of it anywhere.
  const { success, queued } = await EmailService.sendInviteEmail({
    name: admin.name,
    email: admin.email,
    invitedBy: inviter?.name || "Super Admin",
    inviteUrl,
    role: admin.role,
  });

  sendTsRestSuccess(res, 201, {
    success: true,
    message: success
      ? `Invite sent to ${admin.email}`
      : `Admin account created, but the invite email couldn't be sent right now — it's queued and will retry automatically. (${admin.email})`,
    body: { admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role }, emailSent: success, emailQueued: queued },
  });
});

// SET PASSWORD — invited admin sets their first password & activates
export const setPassword = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const token = req.params.token as string;
  const { password, confirmPassword } = req.body;

  if (!password || !confirmPassword) {
    return sendTsRestError(res, 400, "Both password fields are required");
  }
  if (password !== confirmPassword) {
    return sendTsRestError(res, 400, "Passwords do not match");
  }
  if (password.length < 8) {
    return sendTsRestError(res, 400, "Password must be at least 8 characters");
  }

  const hashedToken = hashToken(token);

  const admin = await prisma.admin.findFirst({
    where: {
      inviteToken: hashedToken,
      inviteExpire: { gt: new Date() },
    },
  });

  if (!admin) {
    return sendTsRestError(res, 400, "Invalid or expired invite link");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  // set password, activate the account, clear the invite token
  await prisma.admin.update({
    where: { id: admin.id },
    data: {
      password: hashedPassword,
      isActive: true,
      inviteToken: null,
      inviteExpire: null,
    },
  });

  sendTsRestSuccess(res, 200, { success: true, message: "Password set! You can now log in." });
});

// GET ALL ADMINS — for the Settings page admin list (Super Admin)
export const getAllAdmins = tryCatchWrapper(async (_req: Request, res: Response): Promise<void> => {
  const admins = await prisma.admin.findMany({
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Admins fetched successfully",
    body: { count: admins.length, admins },
  });
});

// DELETE ADMIN — Super Admin removes an admin
export const deleteAdmin = tryCatchWrapper(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;

  // safety: don't let a super admin delete their own account
  if (id === req.admin?.id) {
    return sendTsRestError(res, 400, "You cannot delete your own account");
  }

  const existing = await prisma.admin.findUnique({ where: { id } });
  if (!existing) {
    return sendTsRestError(res, 404, "Admin not found");
  }

  // The frontend already hides the delete control for Super Admin rows —
  // this is the backend half of that same rule, so it holds even if the
  // endpoint is ever called directly (e.g. with more than one Super Admin
  // account on the team).
  if (existing.role === "SUPER_ADMIN") {
    return sendTsRestError(res, 400, "Super Admin accounts can't be deleted from here");
  }

  await prisma.admin.delete({ where: { id } });

  sendTsRestSuccess(res, 200, { success: true, message: "Admin deleted successfully" });
});

// UPDATE OWN PROFILE — the logged-in admin edits their own
// name/email, and optionally changes their password
export const updateProfile = tryCatchWrapper(async (req: AuthRequest, res: Response): Promise<void> => {
  const adminId = req.admin!.id;
  const { name, email, currentPassword, newPassword } = req.body;

  const admin = await prisma.admin.findUnique({ where: { id: adminId } });
  if (!admin) {
    return sendTsRestError(res, 404, "Admin not found");
  }

  // build the update data
  const data: {
    name?: string;
    email?: string;
    password?: string;
  } = {};

  if (name) data.name = name;

  // if changing email, make sure it's not taken by someone else
  if (email && email.toLowerCase() !== admin.email) {
    const taken = await prisma.admin.findUnique({ where: { email: email.toLowerCase() } });
    if (taken) {
      return sendTsRestError(res, 400, "Email already in use");
    }
    data.email = email.toLowerCase();
  }

  // if changing password, require the current one to be correct
  if (newPassword) {
    if (!currentPassword) {
      return sendTsRestError(res, 400, "Current password is required to set a new one");
    }
    if (!admin.password) {
      return sendTsRestError(res, 400, "No password set on this account");
    }
    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      return sendTsRestError(res, 401, "Current password is incorrect");
    }
    if (newPassword.length < 8) {
      return sendTsRestError(res, 400, "New password must be at least 8 characters");
    }
    data.password = await bcrypt.hash(newPassword, 10);
  }

  const updated = await prisma.admin.update({
    where: { id: adminId },
    data,
    select: { id: true, name: true, email: true, role: true },
  });

  sendTsRestSuccess(res, 200, { success: true, message: "Profile updated", body: { admin: updated } });
});

// UPDATE ANOTHER ADMIN — Super Admin edits an admin's
// name/email/role (the "Edit" button on the invite list)
export const updateAdmin = tryCatchWrapper(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const { name, email, role } = req.body;

  const admin = await prisma.admin.findUnique({ where: { id } });
  if (!admin) {
    return sendTsRestError(res, 404, "Admin not found");
  }

  // same rule as invite — this endpoint can only ever set ADMIN or SUB_ADMIN
  if (role !== undefined && !isGrantableRole(role)) {
    return sendTsRestError(res, 400, "Role must be either ADMIN or SUB_ADMIN");
  }

  // if changing email, ensure it's not taken by another admin
  if (email && email.toLowerCase() !== admin.email) {
    const taken = await prisma.admin.findUnique({ where: { email: email.toLowerCase() } });
    if (taken) {
      return sendTsRestError(res, 400, "Email already in use");
    }
  }

  const updated = await prisma.admin.update({
    where: { id },
    data: {
      name: name ?? undefined,
      email: email ? email.toLowerCase() : undefined,
      role: role ?? undefined,
    },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  sendTsRestSuccess(res, 200, { success: true, message: "Admin updated", body: { admin: updated } });
});
