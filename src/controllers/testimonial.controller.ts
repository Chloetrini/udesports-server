import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import tryCatchWrapper from "../lib/tryCatchWrapper.js";
import { sendTsRestSuccess, sendTsRestError } from "../lib/responseHandler.js";

// GET ALL TESTIMONIALS (public — only published, powers the home page carousel)
export const getAllTestimonials = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const testimonials = await prisma.testimonial.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
  });

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Testimonials fetched successfully",
    body: { count: testimonials.length, testimonials },
  });
});

// GET ALL TESTIMONIALS (admin — includes drafts)
export const getAllTestimonialsAdmin = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const testimonials = await prisma.testimonial.findMany({
    orderBy: { createdAt: "desc" },
  });

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Testimonials fetched successfully",
    body: { count: testimonials.length, testimonials },
  });
});

// CREATE TESTIMONIAL
export const createTestimonial = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const { quote, author, club, country, isDraft } = req.body;

  if (!quote || !author || !club || !country) {
    return sendTsRestError(res, 400, "Quote, author, club, and country are required");
  }

  const testimonial = await prisma.testimonial.create({
    data: {
      quote,
      author,
      club,
      country,
      published: isDraft === "true" || isDraft === true ? false : true,
    },
  });

  sendTsRestSuccess(res, 201, {
    success: true,
    message: testimonial.published ? "Testimonial published successfully" : "Testimonial saved to drafts",
    body: { testimonial },
  });
});

// UPDATE TESTIMONIAL
export const updateTestimonial = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;

  const existing = await prisma.testimonial.findUnique({ where: { id } });
  if (!existing) {
    return sendTsRestError(res, 404, "Testimonial not found");
  }

  const { quote, author, club, country, isDraft } = req.body;

  const testimonial = await prisma.testimonial.update({
    where: { id },
    data: {
      quote: quote ?? undefined,
      author: author ?? undefined,
      club: club ?? undefined,
      country: country ?? undefined,
      published: isDraft === undefined ? undefined : !(isDraft === "true" || isDraft === true),
    },
  });

  sendTsRestSuccess(res, 200, {
    success: true,
    message: "Testimonial updated successfully",
    body: { testimonial },
  });
});

// DELETE TESTIMONIAL
export const deleteTestimonial = tryCatchWrapper(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;

  const existing = await prisma.testimonial.findUnique({ where: { id } });
  if (!existing) {
    return sendTsRestError(res, 404, "Testimonial not found");
  }

  await prisma.testimonial.delete({ where: { id } });

  sendTsRestSuccess(res, 200, { success: true, message: "Testimonial deleted successfully" });
});
