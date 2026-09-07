import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

// ============================================================
// CLOUDINARY CONFIG — handles image uploads
// Free plan: 25GB storage, 25GB bandwidth/month
// Works locally AND on Render in production
// ============================================================

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;