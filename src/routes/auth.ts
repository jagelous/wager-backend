import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

const client = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI,
});

router.post("/google", async (req, res) => {
  try {
    const { userInfo, accessToken } = req.body;
    if (!userInfo || !accessToken)
      return res
        .status(400)
        .json({ message: "Missing user info or access token" });

    const response = await fetch(
      `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`
    );
    if (!response.ok) {
      return res.status(401).json({ message: "Invalid access token" });
    }

    const googleUserInfo = (await response.json()) as {
      id: string;
      email: string;
      name: string;
      picture: string;
    };

    if (
      googleUserInfo.id !== userInfo.id ||
      googleUserInfo.email !== userInfo.email
    ) {
      return res.status(401).json({ message: "User info mismatch" });
    }

    const { email, name, picture, id } = userInfo;

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name,
          avatar: picture,
          googleId: id,
          provider: "google",
          updatedAt: new Date(),
        },
      });
    } else {
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: id,
            provider: "google",
            name: user.name || name,
            avatar: user.avatar || picture,
            lastLogin: new Date(),
            updatedAt: new Date(),
          },
        });
      } else {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            lastLogin: new Date(),
            name: user.name || name,
            avatar: user.avatar || picture,
            updatedAt: new Date(),
          },
        });
      }
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
      expiresIn: "7d",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Google auth failed" });
  }
});

router.get("/google/callback", async (req, res) => {
  try {
    const code = req.query.code as string | undefined;
    if (!code) return res.status(400).send("Missing code");

    const { tokens } = await client.getToken({
      code,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    });

    const idToken = tokens.id_token;
    if (!idToken)
      return res.status(400).send("No ID token returned from Google");

    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload) return res.status(401).send("Invalid ID token");

    const {
      sub: googleId,
      email,
      email_verified,
      name,
      picture,
    } = payload as any;

    if (!email || !email_verified) {
      return res.status(400).send("Email not verified by Google");
    }

    let user = await prisma.user.findUnique({ where: { googleId } });

    if (!user) {
      user = await prisma.user.findUnique({ where: { email } });

      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId,
            provider: "google",
            lastLogin: new Date(),
            name: user.name || name,
            avatar: user.avatar || picture,
          },
        });
      } else {
        user = await prisma.user.create({
          data: {
            googleId,
            email,
            name,
            avatar: picture,
            provider: "google",
            lastLogin: new Date(),
            updatedAt: new Date(),
          },
        });
      }
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLogin: new Date(),
          name: user.name || name,
          avatar: user.avatar || picture,
          updatedAt: new Date(),
        },
      });
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.redirect(`${process.env.CLIENT_URL}/auth/success`);
  } catch (err: any) {
    console.error("Google callback error:", err);
    return res.status(500).send("Authentication error");
  }
});

router.get("/me", authenticateToken, (req: any, res) => {
  const u = req.user;
  res.json({
    user: {
      id: u.id,
      email: u.email,
      name: u.name,
      avatar: u.avatar,
      provider: u.provider,
      solanaPublicKey: u.solanaPublicKey,
    },
  });
});

router.post("/solana", async (req, res) => {
  try {
    const { publicKey, signature, message } = req.body;

    if (!publicKey || !signature || !message) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    let user = await prisma.user.findFirst({
      where: {
        OR: [{ solanaPublicKey: publicKey }, { googleId: null, email: null }],
      },
    });

    if (!user) {
      const username = `Solana User ${publicKey.slice(0, 8)}`;
      const firstLetter = username.charAt(0).toUpperCase();
      const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
        firstLetter
      )}&background=9A2BD8&color=ffffff&size=96`;

      user = await prisma.user.create({
        data: {
          solanaPublicKey: publicKey,
          name: username,
          avatar: avatarUrl,
          provider: "solana",
          lastLogin: new Date(),
          updatedAt: new Date(),
        },
      });
    } else {
      const fallbackUsername = `Solana User ${publicKey.slice(0, 8)}`;
      const firstLetter = (user.name || fallbackUsername)
        .charAt(0)
        .toUpperCase();
      const generatedAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
        firstLetter
      )}&background=9A2BD8&color=ffffff&size=96`;

      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          solanaPublicKey: publicKey,
          provider: "solana",
          lastLogin: new Date(),
          avatar: user.avatar ?? generatedAvatar,
          name: user.name ?? fallbackUsername,
          updatedAt: new Date(),
        },
      });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
      expiresIn: "7d",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ user });
  } catch (err) {
    console.error("Solana auth error:", err);
    res.status(500).json({ message: "Solana authentication failed" });
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("token", {
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
  });
  res.json({ message: "Logged out" });
});

export default router;
