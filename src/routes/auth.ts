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

    // Verify the access token with Google
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

    // Verify that the user info matches what was sent
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
        },
      });
    } else {
      // Update existing user with Google info if not already linked
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: id,
            provider: "google",
            name: user.name || name,
            avatar: user.avatar || picture,
            lastLogin: new Date(),
          },
        });
      } else {
        // Update last login for existing Google user
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            lastLogin: new Date(),
            name: user.name || name,
            avatar: user.avatar || picture,
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

// 2) Callback endpoint that receives 'code' from Google
router.get("/google/callback", async (req, res) => {
  try {
    const code = req.query.code as string | undefined;
    if (!code) return res.status(400).send("Missing code");

    // Exchange code for tokens
    const { tokens } = await client.getToken({
      code,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    });

    // tokens contains: access_token, id_token, refresh_token (maybe)
    const idToken = tokens.id_token;
    if (!idToken)
      return res.status(400).send("No ID token returned from Google");

    // Verify ID token and parse payload
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

    // Upsert user in DB
    let user = await prisma.user.findUnique({ where: { googleId } });

    if (!user) {
      // If user with this googleId not found, maybe a user exists with same email — link
      user = await prisma.user.findUnique({ where: { email } });

      if (user) {
        // link googleId
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
        // create new user
        user = await prisma.user.create({
          data: {
            googleId,
            email,
            name,
            avatar: picture,
            provider: "google",
            lastLogin: new Date(),
          },
        });
      }
    } else {
      // existing google user — update lastLogin/profile
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLogin: new Date(),
          name: user.name || name,
          avatar: user.avatar || picture,
        },
      });
    }

    // TODO: store refresh_token if you requested offline access and need long-term Google API access:
    // tokens.refresh_token may be present on first consent.

    // Issue our own JWT
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" }
    );

    // Set HttpOnly cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Redirect back to client app (frontend). You can pass state or token if needed; prefer cookie/session.
    return res.redirect(`${process.env.CLIENT_URL}/auth/success`);
  } catch (err: any) {
    console.error("Google callback error:", err);
    return res.status(500).send("Authentication error");
  }
});

// 3) get current user
router.get("/me", authenticateToken, (req: any, res) => {
  const u = req.user;
  res.json({
    user: {
      id: u.id,
      email: u.email,
      name: u.name,
      avatar: u.avatar,
      provider: u.provider,
    },
  });
});

// 4) logout
router.post("/logout", (req, res) => {
  res.clearCookie("token", {
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
  });
  res.json({ message: "Logged out" });
});

export default router;
