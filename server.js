const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const PI_API_KEY = process.env.PI_API_KEY;
const PI_API_BASE = "https://api.minepi.com";

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function requirePiApiKey(req, res, next) {
  if (!PI_API_KEY) {
    return res.status(500).json({ ok: false, error: "PI_API_KEY is not configured on the server." });
  }
  next();
}

async function piPost(endpoint, body) {
  const response = await fetch(`${PI_API_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${PI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; }
  catch { data = { raw: text }; }

  if (!response.ok) {
    const err = new Error(data?.error || data?.message || `Pi API HTTP ${response.status}`);
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data;
}

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    app: "Blog24",
    network: "Pi Testnet",
    piApiConfigured: Boolean(PI_API_KEY)
  });
});

// User-to-App payment: server-side approval.
app.post("/api/pi/payments/:paymentId/approve", requirePiApiKey, async (req, res) => {
  try {
    const paymentId = req.params.paymentId;
    const payment = await piPost(`/v2/payments/${encodeURIComponent(paymentId)}/approve`);
    res.json({ ok: true, payment });
  } catch (error) {
    console.error("Pi approve error:", error.data || error);
    res.status(error.status || 500).json({ ok: false, error: error.message, details: error.data || null });
  }
});

// User-to-App payment: server-side completion after wallet submits tx.
app.post("/api/pi/payments/:paymentId/complete", requirePiApiKey, async (req, res) => {
  try {
    const paymentId = req.params.paymentId;
    const { txid } = req.body || {};
    if (!txid) return res.status(400).json({ ok: false, error: "txid is required." });

    const payment = await piPost(`/v2/payments/${encodeURIComponent(paymentId)}/complete`, { txid });

    // Never treat a non-verified/non-completed response as a successful order.
    const verified = payment?.status?.transaction_verified === true;
    const completed = payment?.status?.developer_completed === true;
    if (!verified || !completed) {
      return res.status(409).json({ ok: false, error: "Payment was not verified/completed by Pi.", payment });
    }

    res.json({ ok: true, payment });
  } catch (error) {
    console.error("Pi complete error:", error.data || error);
    res.status(error.status || 500).json({ ok: false, error: error.message, details: error.data || null });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Blog24 running on port ${PORT}`);
  console.log(`Pi API configured: ${Boolean(PI_API_KEY)}`);
});
