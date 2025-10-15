import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middleware/auth";

const router = express.Router();
const prisma = new PrismaClient();

const calculatePayouts = async (wagerId: number, winningSide: string) => {
  try {
    const wager = await prisma.wager.findUnique({
      where: { id: wagerId },
    });

    if (!wager) {
      throw new Error("Wager not found");
    }

    const T = wager.side1Amount + wager.side2Amount;
    const P = T * 0.89;
    const C = winningSide === "side1" ? wager.side1Amount : wager.side2Amount;
    const R = 0.00002;

    const transactions = await prisma.transaction.findMany({
      where: {
        wagerId: wagerId,
        type: "prediction",
        currency: "VS",
        side: winningSide,
      } as any,
    });

    const userWagers = new Map<number, number>();
    transactions.forEach((transaction) => {
      const current = userWagers.get(transaction.userId) || 0;
      userWagers.set(
        transaction.userId,
        current + Math.abs(transaction.amount)
      );
    });

    const payouts = [];
    for (const [userId, userWagered] of userWagers) {
      const Ui = userWagered;
      const Wi = (Ui / C) * P * R;

      if (Wi > 0) {
        payouts.push({
          userId,
          payoutUsdc: Wi,
          wageredTokens: Ui,
        });
      }
    }

    return payouts;
  } catch (error) {
    console.error("Error calculating payouts:", error);
    throw error;
  }
};

const distributePayouts = async (wagerId: number, payouts: any[]) => {
  try {
    for (const payout of payouts) {
      await prisma.wallet.updateMany({
        where: { userId: payout.userId },
        data: {
          usdcAmount: {
            increment: payout.payoutUsdc,
          },
          updatedAt: new Date(),
        },
      });

      const user = await prisma.user.findUnique({
        where: { id: payout.userId },
        include: { wallet: true },
      });

      if (user && user.wallet) {
        await prisma.transaction.create({
          data: {
            userId: payout.userId,
            walletId: user.wallet.id,
            wagerId: wagerId,
            type: "payout",
            currency: "USDC",
            amount: payout.payoutUsdc,
            vsAmount: 0,
            usdValue: payout.payoutUsdc,
            side: null,
            status: "completed",
            updatedAt: new Date(),
          } as any,
        });
      }
    }
  } catch (error) {
    console.error("Error distributing payouts:", error);
    throw error;
  }
};

const updateExpiredWagers = async () => {
  try {
    const now = new Date();
    const expiredWagers = await prisma.wager.findMany({
      where: {
        wagerStatus: "active",
        wagerEndTime: {
          lt: now,
        },
      },
    });

    if (expiredWagers.length > 0) {
      for (const wager of expiredWagers) {
        await prisma.wager.update({
          where: { id: wager.id },
          data: {
            wagerStatus: "ended",
            winningSide: "side1",
            updatedAt: new Date(),
          },
        });

        try {
          const payouts = await calculatePayouts(wager.id, "side1");
          await distributePayouts(wager.id, payouts);
          console.log(`Distributed payouts for wager ${wager.id}`);
        } catch (error) {
          console.error(
            `Error processing payouts for wager ${wager.id}:`,
            error
          );
        }
      }

      console.log(
        `Updated ${expiredWagers.length} expired wagers to ended status`
      );
    }
  } catch (error) {
    console.error("Error updating expired wagers:", error);
  }
};

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
          updatedAt: new Date(),
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
    await updateExpiredWagers();

    const { status, category, isPublic } = req.query;

    const where: any = {};

    if (status) {
      where.wagerStatus = status;
    } else {
      where.wagerStatus = "active";
    }

    if (category) {
      where.category = category;
    }

    if (isPublic !== undefined) {
      where.isPublic = isPublic === "true";
    }

    const wagers = await prisma.wager.findMany({
      where,
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
    await updateExpiredWagers();

    const { id } = req.params;

    const wager = await prisma.wager.findUnique({
      where: { id: parseInt(id) },
    });

    if (!wager) {
      return res.status(404).json({ error: "Wager not found" });
    }

    if (wager.wagerStatus === "ended") {
      return res.status(404).json({ error: "Wager has ended" });
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

    if (wagerStatus === "ended" && !winningSide) {
      updateData.winningSide = "side1";
    }

    const wager = await prisma.wager.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    if (wagerStatus === "ended") {
      const finalWinningSide = winningSide || "side1";
      try {
        const payouts = await calculatePayouts(parseInt(id), finalWinningSide);
        await distributePayouts(parseInt(id), payouts);
        console.log(
          `Distributed payouts for wager ${id} with winning side: ${finalWinningSide}`
        );
      } catch (error) {
        console.error(`Error processing payouts for wager ${id}:`, error);
      }
    }

    res.json({ success: true, wager });
  } catch (error) {
    console.error("Update wager error:", error);
    res.status(500).json({ error: "Failed to update wager" });
  }
});

router.post("/:id/predict", authenticateToken, async (req: any, res) => {
  try {
    await updateExpiredWagers();

    const { id } = req.params;
    const { side, amount } = req.body;

    if (!side || !amount) {
      return res.status(400).json({ error: "Side and amount are required" });
    }

    if (side !== "side1" && side !== "side2") {
      return res.status(400).json({ error: "Side must be 'side1' or 'side2'" });
    }

    const wager = await prisma.wager.findUnique({
      where: { id: parseInt(id) },
    });

    if (!wager) {
      return res.status(404).json({ error: "Wager not found" });
    }

    if (wager.wagerStatus !== "active") {
      return res.status(400).json({ error: "Wager is not active" });
    }

    const now = new Date();
    const endTime = new Date(wager.wagerEndTime);
    if (now >= endTime) {
      await prisma.wager.update({
        where: { id: parseInt(id) },
        data: {
          wagerStatus: "ended",
          updatedAt: new Date(),
        },
      });
      return res.status(400).json({ error: "Wager has ended" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { wallet: true },
    });

    if (!user || !user.wallet) {
      return res.status(400).json({ error: "User wallet not found" });
    }

    const predictionAmount = parseFloat(amount);
    if (user.wallet.vsAmount < predictionAmount) {
      return res.status(400).json({ error: "Insufficient VS tokens" });
    }

    const updatedWager = await prisma.wager.update({
      where: { id: parseInt(id) },
      data: {
        [side === "side1" ? "side1Amount" : "side2Amount"]: {
          increment: predictionAmount,
        },
        updatedAt: new Date(),
      },
    });

    const updatedWallet = await prisma.wallet.update({
      where: { id: user.wallet.id },
      data: {
        vsAmount: user.wallet.vsAmount - predictionAmount,
        updatedAt: new Date(),
      },
    });

    await prisma.transaction.create({
      data: {
        userId: req.user.id,
        walletId: user.wallet.id,
        type: "prediction",
        currency: "VS",
        amount: predictionAmount,
        vsAmount: -predictionAmount,
        wagerId: parseInt(id),
        side: side,
        status: "completed",
        updatedAt: new Date(),
      } as any,
    });

    res.json({
      success: true,
      message: "Prediction placed successfully",
      wager: updatedWager,
      wallet: updatedWallet,
    });
  } catch (error) {
    console.error("Make prediction error:", error);
    res.status(500).json({ error: "Failed to make prediction" });
  }
});

export default router;
