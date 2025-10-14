import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middleware/auth";

const router = express.Router();
const prisma = new PrismaClient();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `wager-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

router.post(
  "/",
  authenticateToken,
  (req: any, res: any, next: any) => {
    upload.single("image")(req, res, (err: any) => {
      if (err) {
        console.error("Multer error:", err);
        if (err.code === "LIMIT_FILE_SIZE") {
          return res
            .status(400)
            .json({ error: "File too large. Maximum size is 5MB." });
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return res.status(400).json({ error: "Unexpected file field." });
        }
        return res
          .status(400)
          .json({ error: err.message || "File upload error" });
      }
      next();
    });
  },
  async (req: any, res) => {
    try {
      const {
        name,
        description,
        category,
        side1,
        side2,
        wagerEndTime,
        isPublic,
      } = req.body;

      console.log("Received data:", {
        name,
        category,
        side1,
        side2,
        wagerEndTime,
        isPublic,
      });
      console.log("File:", req.file);

      if (!name || !category || !side1 || !side2 || !wagerEndTime) {
        return res.status(400).json({
          error:
            "Missing required fields: name, category, side1, side2, wagerEndTime",
        });
      }

      if (!req.file) {
        return res.status(400).json({ error: "Image file is required" });
      }

      const imageUrl = `/uploads/${req.file.filename}`;

      const wager = await prisma.wager.create({
        data: {
          name,
          description: description || null,
          imageUrl,
          category,
          side1,
          side2,
          wagerEndTime: new Date(wagerEndTime),
          isPublic: isPublic === "true" || isPublic === true,
          createdById: req.user.id,
        },
      });

      res.status(201).json({
        success: true,
        wager,
      });
    } catch (error) {
      console.error("Create wager error:", error);
      res.status(500).json({ error: "Failed to create wager" });
    }
  }
);

router.get("/", async (req, res) => {
  try {
    const { status, category, isPublic } = req.query;

    const where: any = {};

    if (status) {
      where.wagerStatus = status;
    }

    if (category) {
      where.category = category;
    }

    if (isPublic !== undefined) {
      where.isPublic = isPublic === "true";
    }

    const wagers = await prisma.wager.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(wagers);
  } catch (error) {
    console.error("Get wagers error:", error);
    res.status(500).json({ error: "Failed to fetch wagers" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const wager = await prisma.wager.findUnique({
      where: { id: parseInt(id) },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    if (!wager) {
      return res.status(404).json({ error: "Wager not found" });
    }

    res.json(wager);
  } catch (error) {
    console.error("Get wager error:", error);
    res.status(500).json({ error: "Failed to fetch wager" });
  }
});

router.put("/:id", authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { winningSide, wagerStatus } = req.body;

    const existingWager = await prisma.wager.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingWager) {
      return res.status(404).json({ error: "Wager not found" });
    }

    if (existingWager.createdById !== req.user.id) {
      return res
        .status(403)
        .json({ error: "Not authorized to update this wager" });
    }

    const updateData: any = {};
    if (winningSide !== undefined) updateData.winningSide = winningSide;
    if (wagerStatus !== undefined) updateData.wagerStatus = wagerStatus;

    const wager = await prisma.wager.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    res.json({ success: true, wager });
  } catch (error) {
    console.error("Update wager error:", error);
    res.status(500).json({ error: "Failed to update wager" });
  }
});

export default router;
