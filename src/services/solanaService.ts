import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import axios from "axios";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");

export interface SolanaBalance {
  sol: number;
  lamports: number;
}

export interface SolUsdPrice {
  price: number;
  currency: string;
  timestamp: number;
}

/**
 * Get SOL balance from Solana devnet
 */
export const getSolBalance = async (
  publicKey: string
): Promise<SolanaBalance> => {
  try {
    const pubKey = new PublicKey(publicKey);
    const lamports = await connection.getBalance(pubKey);
    const sol = lamports / LAMPORTS_PER_SOL;

    return {
      sol,
      lamports,
    };
  } catch (error) {
    console.error("Error fetching SOL balance:", error);
    throw new Error("Failed to fetch SOL balance");
  }
};

/**
 * Get SOL to USD price from CoinGecko
 */
export const getSolUsdPrice = async (): Promise<SolUsdPrice> => {
  try {
    const response = await axios.get(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
      {
        timeout: 10000,
        headers: {
          Accept: "application/json",
        },
      }
    );

    const price = response.data.solana.usd;

    return {
      price,
      currency: "USD",
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Error fetching SOL price:", error);
    return {
      price: 100,
      currency: "USD",
      timestamp: Date.now(),
    };
  }
};

/**
 * Verify if a wallet has sufficient SOL balance
 */
export const hasSufficientBalance = async (
  publicKey: string,
  requiredSol: number
): Promise<boolean> => {
  try {
    const balance = await getSolBalance(publicKey);
    return balance.sol >= requiredSol;
  } catch (error) {
    console.error("Error checking balance:", error);
    return false;
  }
};

/**
 * Get wallet info including balance and USD value
 */
export const getWalletInfo = async (publicKey: string) => {
  try {
    const balance = await getSolBalance(publicKey);
    const priceData = await getSolUsdPrice();
    const usdValue = balance.sol * priceData.price;

    console.log(
      `Wallet Info - SOL Balance: ${balance.sol}, Price: $${priceData.price}, USD Value: $${usdValue}`
    );

    return {
      publicKey,
      balance: {
        sol: balance.sol,
        lamports: balance.lamports,
        usd: usdValue,
      },
      price: priceData,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Error getting wallet info:", error);
    throw new Error("Failed to get wallet information");
  }
};
