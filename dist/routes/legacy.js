"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
// NOTE: These are development stubs to keep the admin UI working
// until real backend logic is wired. They return minimal shapes
// expected by the UI and should be replaced with real implementations.
// General data
router.get("/allcampaigns", (req, res) => {
    res.json([
        { campaign_id: "demo-1", name: "Demo Campaign 1" },
        { campaign_id: "demo-2", name: "Demo Campaign 2" },
    ]);
});
router.get("/categories", (req, res) => {
    res.json([
        { id: "cat-1", name: "General" },
        { id: "cat-2", name: "Sports" },
    ]);
});
router.get("/campaign/:id", (req, res) => {
    const { id } = req.params;
    res.json({
        id,
        name: `Campaign ${id}`,
        description: "Demo campaign",
        left_button: "Left",
        right_button: "Right",
        status: "pending",
        lock_at: null,
        expiresAt: null,
        ai_prediction: "",
        AiPrediction: "",
        AIReason: "",
        category_id: "cat-1",
        image_url: "",
    });
});
router.post("/campaign", (req, res) => {
    res.json({ message: "Campaign created" });
});
router.put("/campaign/:id", (req, res) => {
    res.json({ message: "Campaign updated" });
});
router.delete("/campaign/:id", (req, res) => {
    res.json({ message: "Campaign deleted" });
});
// Distribution summary
router.get("/campaignTotals", (req, res) => {
    res.json({
        leftButton: "Left",
        rightButton: "Right",
        leftTotal: 1000,
        rightTotal: 800,
        web2leftTotal: 500,
        web3leftTotal: 500,
        web2rightTotal: 300,
        web3rightTotal: 500,
    });
});
router.get("/walletWagers", (req, res) => {
    res.json([]);
});
router.post("/send-sol", (req, res) => {
    res.json({ ok: true });
});
router.post("/transfer-winner-to-winners", (req, res) => {
    res.json({ ok: true });
});
router.post("/draw/send-vs", (req, res) => {
    res.json({ ok: true });
});
router.post("/send-refund", (req, res) => {
    res.json({ message: "Refund sent", transaction_hash: "demo-tx-hash" });
});
// External points
router.post("/add-external-points", (req, res) => {
    res.json({ message: "Points added successfully" });
});
// Venmo payouts
router.get("/admin/venmo-payouts-store", (req, res) => {
    res.json([
        { id: 1, username: "alice", amount: 25, source: "web", created_at: new Date().toISOString() },
        { id: 2, username: "bob", amount: 42, source: "web", created_at: new Date().toISOString() },
    ]);
});
router.post("/admin/mark-venmo-paid/:id", (req, res) => {
    res.json({ ok: true });
});
// Upload + products
router.post("/upload", (req, res) => {
    res.json({ url: "mock-image.png" });
});
router.post("/products", (req, res) => {
    res.json({ message: "Product saved" });
});
// Web2 distribution
router.get("/web2/distribution-candidates", (req, res) => {
    res.json({ left_button: "Left", right_button: "Right" });
});
router.get("/web2/distribution-summary", (req, res) => {
    res.json([
        { wallet_id: "wallet-1", total_amount: 100.5 },
        { wallet_id: "wallet-2", total_amount: 250.0 },
    ]);
});
router.post("/web2/distribute-vschips", (req, res) => {
    res.json({ ok: true });
});
// Reconciliation
router.get("/admin/reconciliation-list", (req, res) => {
    res.json({
        success: true,
        wallets: [
            { wallet: "wallet-1", recorded: 1000, computed: 990, discrepancy: -10 },
            { wallet: "wallet-2", recorded: 2000, computed: 2000, discrepancy: 0 },
        ],
    });
});
router.post("/admin/reconcile/:wallet", (req, res) => {
    res.json({ success: true });
});
// Airdrop
router.get("/airdropUsers", (req, res) => {
    res.json([
        { walletID: "wallet-1", xPoints: 1234 },
        { walletID: "wallet-2", xPoints: 9876 },
    ]);
});
exports.default = router;
//# sourceMappingURL=legacy.js.map