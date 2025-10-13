"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const router = (0, express_1.Router)();
// Admin login (dev-only when ALLOW_ANY_ADMIN_LOGIN is true)
router.post("/login", (req, res) => {
    if (!process.env.ALLOW_ANY_ADMIN_LOGIN || !/^(1|true)$/i.test(process.env.ALLOW_ANY_ADMIN_LOGIN)) {
        return res.status(403).json({ error: "Admin dev login disabled" });
    }
    const { username, password } = req.body || {};
    if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
    }
    try {
        const token = jsonwebtoken_1.default.sign({ role: "admin", username }, process.env.JWT_SECRET, { expiresIn: "7d" });
        return res.json({ token });
    }
    catch (err) {
        console.error("Admin login error:", err);
        return res.status(500).json({ error: "Login failed" });
    }
});
// Middleware to verify the admin JWT without DB lookup.
function requireAdmin(req, res, next) {
    try {
        const auth = req.headers.authorization || "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
        if (!token)
            return res.status(401).json({ error: "Missing token" });
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        if (!decoded || decoded.role !== "admin") {
            return res.status(401).json({ error: "Unauthorized" });
        }
        req.admin = { username: decoded.username };
        next();
    }
    catch (err) {
        return res.status(401).json({ error: "Invalid token" });
    }
}
// Simple protected endpoint used by admin/checkAuth.js
router.get("/data", requireAdmin, (req, res) => {
    return res.json({ ok: true, admin: req.admin?.username || "admin" });
});
exports.default = router;
//# sourceMappingURL=admin.js.map