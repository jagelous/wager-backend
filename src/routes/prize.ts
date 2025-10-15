import express from "express";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

function getBiweeklyPeriod(): { start: Date; end: Date } {
  const anchor = new Date("2024-09-01T00:00:00Z");
  const now = new Date();
  const daysDiff = Math.floor(
    (now.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24)
  );
  const periodsPassed = Math.floor(daysDiff / 14);
  const start = new Date(anchor);
  start.setDate(anchor.getDate() + periodsPassed * 14);
  const end = new Date(start);
  end.setDate(start.getDate() + 13);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function computeS(periodStart: Date, periodEnd: Date): Promise<number> {
  const transactions = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: {
      type: "prediction",
      currency: "VS",
      createdAt: { gte: periodStart, lte: periodEnd },
    },
  });
  return Math.max(0, transactions._sum.amount || 0);
}

async function getUsersInPeriod(
  periodStart: Date,
  periodEnd: Date
): Promise<number[]> {
  const users = await prisma.transaction.findMany({
    where: {
      type: "prediction",
      currency: "VS",
      createdAt: { gte: periodStart, lte: periodEnd },
    },
    distinct: ["userId"],
    select: { userId: true },
  });
  return users.map((u) => u.userId);
}

async function computeUserStats(
  userId: number,
  periodStart: Date,
  periodEnd: Date
) {
  const baseAgg = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: {
      userId,
      type: "prediction",
      currency: "VS",
      createdAt: { gte: periodStart, lte: periodEnd },
    },
  });
  const baseTokens = Math.max(0, baseAgg._sum.amount || 0);

  const correctTransactions = await (prisma.transaction as any).findMany({
    where: {
      userId,
      type: "prediction",
      currency: "VS",
      createdAt: { gte: periodStart, lte: periodEnd },
    },
  });

  let correctTokens = 0;
  if (correctTransactions.length > 0) {
    const wagerIds = Array.from(
      new Set(
        (correctTransactions as any[])
          .map((t: any) => t.wagerId)
          .filter((id: any): id is number => typeof id === "number")
      )
    );
    const wagers = await prisma.wager.findMany({
      where: { id: { in: wagerIds }, winningSide: { not: null } },
      select: { id: true, winningSide: true },
    });
    const wagerIdToWinning = new Map<number, string | null>();
    wagers.forEach((w) => wagerIdToWinning.set(w.id, w.winningSide));
    (correctTransactions as any[]).forEach((t: any) => {
      if (t.wagerId && t.side && wagerIdToWinning.get(t.wagerId) === t.side) {
        correctTokens += Math.abs(t.amount);
      }
    });
  }

  const earlyCutoff = new Date(periodStart);
  earlyCutoff.setHours(earlyCutoff.getHours() + 24);
  const earlyCount = await prisma.transaction.count({
    where: {
      userId,
      type: "prediction",
      currency: "VS",
      createdAt: { gte: periodStart, lte: earlyCutoff },
    },
  });
  const totalCount = await prisma.transaction.count({
    where: {
      userId,
      type: "prediction",
      currency: "VS",
      createdAt: { gte: periodStart, lte: periodEnd },
    },
  });
  const earlyMultiplier = totalCount > 0 && earlyCount > 0 ? 2.0 : 1.0;
  const referralMultiplier = 1.0;
  const accuracy = baseTokens > 0 ? correctTokens / baseTokens : 0;
  const totalPoints =
    baseTokens * referralMultiplier * earlyMultiplier * accuracy;

  return {
    baseTokens,
    correctTokens,
    accuracy,
    referralMultiplier,
    earlyMultiplier,
    totalPoints,
  };
}

router.get("/prize/preview", async (req, res) => {
  try {
    const startParam = req.query.start as string | undefined;
    const endParam = req.query.end as string | undefined;
    const period =
      startParam && endParam
        ? { start: new Date(startParam), end: new Date(endParam) }
        : getBiweeklyPeriod();

    const S = await computeS(period.start, period.end);
    const biweeklyPrizeUSDC = S * 0.075 * 0.00002;

    const userIds = await getUsersInPeriod(period.start, period.end);
    const userStats = await Promise.all(
      userIds.map(async (userId) => {
        const stats = await computeUserStats(userId, period.start, period.end);
        return { userId, ...stats };
      })
    );

    const totalPoints = userStats.reduce((sum, u) => sum + u.totalPoints, 0);
    const distributions = userStats.map((u) => ({
      userId: u.userId,
      totalPoints: u.totalPoints,
      prizeSharePct: totalPoints > 0 ? (u.totalPoints / totalPoints) * 100 : 0,
      prizeAmountUSDC:
        totalPoints > 0 ? (u.totalPoints / totalPoints) * biweeklyPrizeUSDC : 0,
      baseTokens: u.baseTokens,
      correctTokens: u.correctTokens,
      accuracy: u.accuracy,
      referralMultiplier: u.referralMultiplier,
      earlyMultiplier: u.earlyMultiplier,
    }));

    res.json({
      success: true,
      period,
      totalTokensSpent: S,
      biweeklyPrizeUSDC,
      totalPoints,
      users: distributions,
    });
  } catch (error) {
    console.error("Preview biweekly prize error:", error);
    res.status(500).json({ success: false, error: "Failed to preview prize" });
  }
});

router.post("/prize/execute", async (req, res) => {
  try {
    const startParam = req.body?.start as string | undefined;
    const endParam = req.body?.end as string | undefined;
    const period =
      startParam && endParam
        ? { start: new Date(startParam), end: new Date(endParam) }
        : getBiweeklyPeriod();

    const S = await computeS(period.start, period.end);
    const biweeklyPrizeUSDC = S * 0.075 * 0.00002;

    const userIds = await getUsersInPeriod(period.start, period.end);
    const userStats = await Promise.all(
      userIds.map(async (userId) => {
        const stats = await computeUserStats(userId, period.start, period.end);
        return { userId, ...stats };
      })
    );
    const totalPoints = userStats.reduce((sum, u) => sum + u.totalPoints, 0);

    const distributions = await Promise.all(
      userStats.map(async (u) => {
        const prizeAmountUSDC =
          totalPoints > 0
            ? (u.totalPoints / totalPoints) * biweeklyPrizeUSDC
            : 0;
        if (prizeAmountUSDC <= 0) {
          return { userId: u.userId, prizeAmountUSDC: 0 };
        }
        const user = await prisma.user.findUnique({
          where: { id: u.userId },
          include: { wallet: true },
        });
        if (!user || !user.wallet) {
          return { userId: u.userId, prizeAmountUSDC: 0 };
        }
        await prisma.wallet.update({
          where: { id: user.wallet.id },
          data: {
            usdcAmount: user.wallet.usdcAmount + prizeAmountUSDC,
            updatedAt: new Date(),
          },
        });
        await prisma.transaction.create({
          data: {
            userId: u.userId,
            walletId: user.wallet.id,
            wagerId: null,
            type: "biweekly_prize",
            currency: "USDC",
            amount: prizeAmountUSDC,
            vsAmount: 0,
            usdValue: prizeAmountUSDC,
            status: "completed",
            updatedAt: new Date(),
          } as any,
        });
        return { userId: u.userId, prizeAmountUSDC };
      })
    );

    res.json({
      success: true,
      period,
      totalTokensSpent: S,
      biweeklyPrizeUSDC,
      totalPoints,
      distributions,
    });
  } catch (error) {
    console.error("Execute biweekly prize error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to execute prize distribution" });
  }
});

export default router;
