"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const authenticateToken = async (req, res, next) => {
    try {
        const token = req.cookies.token || req.headers.authorization?.replace("Bearer ", "");
        if (!token) {
            return res.status(401).json({ error: "Access token required" });
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        // Verify user still exists
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                email: true,
                role: true,
                name: true,
                avatar: true,
                provider: true,
                solanaPublicKey: true,
            },
        });
        if (!user) {
            return res.status(401).json({ error: "User not found" });
        }
        req.user = user;
        next();
    }
    catch (error) {
        console.error("Auth middleware error:", error);
        return res.status(401).json({ error: "Invalid token" });
    }
};
exports.authenticateToken = authenticateToken;
//# sourceMappingURL=auth.js.map