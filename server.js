const express = require("express");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;
const PI_API_KEY = process.env.PI_API_KEY;
const PI_API_BASE = "https://api.minepi.com";

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ======================================================
// Pi API Key 확인
// ======================================================
function requirePiApiKey(req, res, next) {
  if (!PI_API_KEY) {
    console.error("❌ PI_API_KEY is not configured.");

    return res.status(500).json({
      ok: false,
      error: "PI_API_KEY is not configured on the server."
    });
  }

  next();
}


// ======================================================
// Pi API POST 공통 함수
// ======================================================
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

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {
      raw: text
    };
  }

  if (!response.ok) {

    const err = new Error(
      data?.error ||
      data?.message ||
      `Pi API HTTP ${response.status}`
    );

    err.status = response.status;
    err.data = data;

    throw err;
  }

  return data;
}


// ======================================================
// 서버 상태 확인
// ======================================================
app.get("/health", (req, res) => {

  res.json({
    ok: true,
    app: "Blog24",
    network: "Pi Testnet",
    piApiConfigured: Boolean(PI_API_KEY)
  });

});


// ======================================================
// Pi 결제 승인
// User → App
// ======================================================
app.post(
  "/api/pi/payments/:paymentId/approve",
  requirePiApiKey,
  async (req, res) => {

    const paymentId = req.params.paymentId;

    console.log("");
    console.log("==========================================");
    console.log("🟡 Pi APPROVE 요청");
    console.log("Payment ID:", paymentId);
    console.log("Time:", new Date().toISOString());
    console.log("==========================================");

    try {

      const payment = await piPost(
        `/v2/payments/${encodeURIComponent(paymentId)}/approve`
      );

      console.log("");
      console.log("✅ Pi APPROVE 성공");
      console.log("Payment ID:", paymentId);
      console.log("Payment Data:");
      console.log(JSON.stringify(payment, null, 2));
      console.log("==========================================");
      console.log("");

      res.json({
        ok: true,
        payment
      });

    } catch (error) {

      console.error("");
      console.error("❌ Pi APPROVE 실패");
      console.error("Payment ID:", paymentId);
      console.error("Error:", error.message);
      console.error("Details:", error.data || null);
      console.error("==========================================");
      console.error("");

      res.status(error.status || 500).json({
        ok: false,
        error: error.message,
        details: error.data || null
      });

    }
  }
);


// ======================================================
// Pi 결제 완료
// Wallet TX 제출 후 호출
// ======================================================
app.post(
  "/api/pi/payments/:paymentId/complete",
  requirePiApiKey,
  async (req, res) => {

    const paymentId = req.params.paymentId;
    const { txid } = req.body || {};

    console.log("");
    console.log("==========================================");
    console.log("🔵 Pi COMPLETE 요청");
    console.log("Payment ID:", paymentId);
    console.log("TXID:", txid || "NONE");
    console.log("Time:", new Date().toISOString());
    console.log("==========================================");

    if (!txid) {

      console.error("❌ COMPLETE 실패 - TXID 없음");
      console.error("Payment ID:", paymentId);

      return res.status(400).json({
        ok: false,
        error: "txid is required."
      });

    }

    try {

      const payment = await piPost(
        `/v2/payments/${encodeURIComponent(paymentId)}/complete`,
        {
          txid
        }
      );

      // ==================================================
      // Pi 서버에서 실제 결제 검증 여부 확인
      // ==================================================
      const verified =
        payment?.status?.transaction_verified === true;

      const completed =
        payment?.status?.developer_completed === true;


      console.log("");
      console.log("Pi 결제 검증 결과");
      console.log("------------------------------------------");
      console.log("Payment ID:", paymentId);
      console.log("TXID:", txid);
      console.log("Transaction Verified:", verified);
      console.log("Developer Completed:", completed);
      console.log("------------------------------------------");


      // ==================================================
      // 검증 실패
      // ==================================================
      if (!verified || !completed) {

        console.error("");
        console.error("❌ Pi 결제 검증 실패");
        console.error("Payment ID:", paymentId);
        console.error("TXID:", txid);
        console.error("Payment Data:");
        console.error(JSON.stringify(payment, null, 2));
        console.error("==========================================");
        console.error("");

        return res.status(409).json({
          ok: false,
          error: "Payment was not verified/completed by Pi.",
          payment
        });

      }


      // ==================================================
      // 최종 결제 성공
      // ==================================================
      console.log("");
      console.log("🎉 =======================================");
      console.log("🎉 Pi PAYMENT COMPLETE SUCCESS");
      console.log("🎉 =======================================");
      console.log("Payment ID:", paymentId);
      console.log("TXID:", txid);

      if (payment?.amount !== undefined) {
        console.log("Amount:", payment.amount);
      }

      if (payment?.memo !== undefined) {
        console.log("Memo:", payment.memo);
      }

      if (payment?.user_uid !== undefined) {
        console.log("User UID:", payment.user_uid);
      }

      console.log("");
      console.log("Full Payment Data:");
      console.log(JSON.stringify(payment, null, 2));
      console.log("==========================================");
      console.log("");


      res.json({
        ok: true,
        payment
      });

    } catch (error) {

      console.error("");
      console.error("❌ Pi COMPLETE API 오류");
      console.error("Payment ID:", paymentId);
      console.error("TXID:", txid);
      console.error("Error:", error.message);
      console.error("Details:", error.data || null);
      console.error("==========================================");
      console.error("");

      res.status(error.status || 500).json({
        ok: false,
        error: error.message,
        details: error.data || null
      });

    }
  }
);


// ======================================================
// 나머지 주소 → 쇼핑몰
// ======================================================
app.get("*", (req, res) => {

  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );

});


// ======================================================
// 서버 시작
// ======================================================
app.listen(PORT, "0.0.0.0", () => {

  console.log("");
  console.log("==========================================");
  console.log("🚀 Blog24 Server Started");
  console.log(`🚀 Port: ${PORT}`);
  console.log(`🚀 Pi API configured: ${Boolean(PI_API_KEY)}`);
  console.log("🚀 Network: Pi Testnet");
  console.log("==========================================");
  console.log("");

});