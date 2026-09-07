import "dotenv/config";
import bcrypt from "bcrypt";
import { prisma } from "../config/prisma";


// SEED SUPER ADMIN — run once to create the first admin account.
// All other admins are created via the invite flow afterward.

const seedAdmin = async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || "admin@udesport.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
    const adminName = process.env.ADMIN_NAME || "Super Admin";

    // check if this admin already exists
    const existing = await prisma.admin.findUnique({
      where: { email: adminEmail.toLowerCase() },
    });

    if (existing) {
      console.log("⚠️  Super Admin already exists:", existing.email);
      process.exit(0);
    }

    // hash the password before storing
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // create the Super Admin — active immediately, no invite needed
    const admin = await prisma.admin.create({
      data: {
        name: adminName,
        email: adminEmail.toLowerCase(),
        password: hashedPassword,
        role: "SUPER_ADMIN",
        isActive: true, // seeded admin is active right away
      },
    });

    console.log(`✅ Super Admin created: ${admin.email}`);
    console.log(`   Role: ${admin.role}`);
    console.log(`   You can now log in with these credentials.`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeder error:", error);
    process.exit(1);
  }
};

seedAdmin();