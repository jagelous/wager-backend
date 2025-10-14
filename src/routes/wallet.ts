import express from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middleware/auth";
import {
  getSolBalance,
  getSolUsdPrice,
  hasSufficientBalance,
  getWalletInfo,
} from "../services/solanaService";

const router = express.Router();
const prisma = new PrismaClient();

router.post("/connect", authenticateToken, async (req: any, res) => {
  try {
    const { publicKey } = req.body;

    if (!publicKey) {
      return res.status(400).json({ error: "Public key is required" });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { solanaPublicKey: publicKey },
    });

    res.json({
      success: true,
      message: "Wallet connected successfully",
      user: {
        id: user.id,
        solanaPublicKey: user.solanaPublicKey,
      },
    });
  } catch (error) {
    console.error("Connect wallet error:", error);
    res.status(500).json({ error: "Failed to connect wallet" });
  }
});

router.get("/info", authenticateToken, async (req: any, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        solanaPublicKey: true,
        name: true,
        email: true,
        wallet: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    let wallet = user.wallet;
    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          userId: user.id,
          solAmount: 0,
          usdcAmount: 0,
          vsAmount: 0,
        },
      });
    }

    let solanaInfo = null;
    if (user.solanaPublicKey) {
      try {
        solanaInfo = await getWalletInfo(user.solanaPublicKey);
        console.log(
          `API Response - SOL Price: $${solanaInfo.price.price}, Balance: ${solanaInfo.balance.sol} SOL`
        );
      } catch (error) {
        console.error("Error fetching Solana balance:", error);
      }
    }

    res.json({
      hasWallet: !!user.solanaPublicKey,
      publicKey: user.solanaPublicKey,
      balances: {
        sol: wallet.solAmount,
        usdc: wallet.usdcAmount,
        vs: wallet.vsAmount,
      },
      solana: solanaInfo,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Get wallet info error:", error);
    res.status(500).json({ error: "Failed to get wallet info" });
  }
});

router.post("/purchase", authenticateToken, async (req: any, res) => {
  try {
    const { amount, currency, vsAmount, transactionSignature } = req.body;

    if (!amount || !currency || !vsAmount) {
      return res.status(400).json({
        error: "Amount, currency, and vsAmount are required",
      });
    }

    if (!req.user.solanaPublicKey) {
      return res.status(400).json({
        error: "Solana wallet not connected",
      });
    }

    let wallet = await prisma.wallet.findUnique({
      where: { userId: req.user.id },
    });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          userId: req.user.id,
          solAmount: 0,
          usdcAmount: 0,
          vsAmount: 0,
        },
      });
    }

    let updatedWallet;
    let solanaInfo = null;

    if (currency === "SOL") {
      const requiredSol = parseFloat(amount);
      const hasBalance = await hasSufficientBalance(
        req.user.solanaPublicKey,
        requiredSol
      );

      if (!hasBalance) {
        return res.status(400).json({
          error: "Insufficient SOL balance for this purchase",
        });
      }

      if (!transactionSignature) {
        return res.status(400).json({
          error: "Transaction signature is required for SOL purchases",
        });
      }

      const solPrice = await getSolUsdPrice();
      const solUsdValue = requiredSol * solPrice.price;

      updatedWallet = await prisma.wallet.update({
        where: { userId: req.user.id },
        data: {
          vsAmount: wallet.vsAmount + parseFloat(vsAmount),
        },
      });

      await prisma.transaction.create({
        data: {
          userId: req.user.id,
          walletId: wallet.id,
          type: "purchase",
          currency: "SOL",
          amount: requiredSol,
          vsAmount: parseFloat(vsAmount),
          solPrice: solPrice.price,
          usdValue: solUsdValue,
          status: "completed",
          transactionHash:
            typeof transactionSignature === "string"
              ? transactionSignature
              : transactionSignature?.signature || null,
        },
      });

      solanaInfo = await getWalletInfo(req.user.solanaPublicKey);

      console.log("SOL purchase completed:", {
        userId: req.user.id,
        walletAddress: req.user.solanaPublicKey,
        solAmount: requiredSol,
        solUsdValue,
        vsAmount,
        currentSolBalance: solanaInfo.balance.sol,
        solPrice: solPrice.price,
      });
    } else {
      if (wallet.usdcAmount < parseFloat(amount)) {
        return res.status(400).json({
          error: "Insufficient USDC balance for this purchase",
        });
      }

      updatedWallet = await prisma.wallet.update({
        where: { userId: req.user.id },
        data: {
          vsAmount: wallet.vsAmount + parseFloat(vsAmount),
          usdcAmount: Math.max(0, wallet.usdcAmount - parseFloat(amount)),
        },
      });

      await prisma.transaction.create({
        data: {
          userId: req.user.id,
          walletId: wallet.id,
          type: "purchase",
          currency: "USDC",
          amount: parseFloat(amount),
          vsAmount: parseFloat(vsAmount),
          usdValue: parseFloat(amount),
          status: "completed",
        },
      });

      console.log("USDC purchase completed:", {
        userId: req.user.id,
        walletAddress: req.user.solanaPublicKey,
        usdcAmount: parseFloat(amount),
        vsAmount,
        newBalances: {
          sol: updatedWallet.solAmount,
          usdc: updatedWallet.usdcAmount,
          vs: updatedWallet.vsAmount,
        },
      });
    }

    res.json({
      success: true,
      message: `Successfully purchased ${vsAmount} $VS tokens`,
      balances: {
        sol: updatedWallet.solAmount,
        usdc: updatedWallet.usdcAmount,
        vs: updatedWallet.vsAmount,
      },
      solana: solanaInfo,
      transaction: {
        id: `tx_${Date.now()}`,
        amount,
        currency,
        vsAmount,
        walletAddress: req.user.solanaPublicKey,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Purchase tokens error:", error);
    res.status(500).json({ error: "Failed to purchase tokens" });
  }
});

router.get("/transactions", authenticateToken, async (req: any, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    res.json({
      success: true,
      transactions,
    });
  } catch (error) {
    console.error("Get transactions error:", error);
    res.status(500).json({ error: "Failed to get transactions" });
  }
});

router.put("/balances", authenticateToken, async (req: any, res) => {
  try {
    const { solAmount, usdcAmount, vsAmount } = req.body;

    let wallet = await prisma.wallet.findUnique({
      where: { userId: req.user.id },
    });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          userId: req.user.id,
          solAmount: 0,
          usdcAmount: 0,
          vsAmount: 0,
        },
      });
    }

    const updatedWallet = await prisma.wallet.update({
      where: { userId: req.user.id },
      data: {
        solAmount:
          solAmount !== undefined ? parseFloat(solAmount) : wallet.solAmount,
        usdcAmount:
          usdcAmount !== undefined ? parseFloat(usdcAmount) : wallet.usdcAmount,
        vsAmount:
          vsAmount !== undefined ? parseFloat(vsAmount) : wallet.vsAmount,
      },
    });

    res.json({
      success: true,
      message: "Wallet balances updated successfully",
      balances: {
        sol: updatedWallet.solAmount,
        usdc: updatedWallet.usdcAmount,
        vs: updatedWallet.vsAmount,
      },
    });
  } catch (error) {
    console.error("Update balances error:", error);
    res.status(500).json({ error: "Failed to update balances" });
  }
});

export default router;
