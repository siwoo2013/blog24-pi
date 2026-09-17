const products = [
  { id: 1, name: "Blog24 머그컵", price: 1.2, icon: "☕", desc: "Blog24 데일리 머그" },
  { id: 2, name: "Pi 데스크 패드", price: 2.5, icon: "🖥️", desc: "책상을 깔끔하게 정리하는 패드" },
  { id: 3, name: "스마트 파우치", price: 3.8, icon: "🎒", desc: "작은 소지품을 담는 데일리 파우치" },
  { id: 4, name: "Blog24 노트", price: 0.8, icon: "📒", desc: "아이디어 기록용 노트" },
  { id: 5, name: "휴대폰 거치대", price: 1.6, icon: "📱", desc: "간편한 데스크용 거치대" },
  { id: 6, name: "테스트 상품", price: 0.1, icon: "🧪", desc: "Pi Testnet 결제 테스트용" }
];

let cart = [];
let piReady = false;
let currentUser = null;
let paymentInProgress = false;

const grid = document.getElementById("productGrid");
const cartBar = document.getElementById("cartBar");
const cartCount = document.getElementById("cartCount");
const cartTotal = document.getElementById("cartTotal");
const loginBtn = document.getElementById("loginBtn");
const checkoutBtn = document.getElementById("checkoutBtn");

function toast(message){
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3200);
}

function renderProducts(){
  grid.innerHTML = products.map(p => `
    <article class="card">
      <div class="product-img">${p.icon}</div>
      <div class="card-body">
        <h3>${p.name}</h3>
        <div class="desc">${p.desc}</div>
        <div class="price-row">
          <span class="price">${p.price.toFixed(2)} π</span>
          <button class="add" onclick="addToCart(${p.id})">담기</button>
        </div>
      </div>
    </article>
  `).join("");
}

window.addToCart = function(id){
  const p = products.find(x => x.id === id);
  cart.push(p);
  updateCart();
  toast(`${p.name} 장바구니에 담음`);
}

function updateCart(){
  const total = cart.reduce((sum,p) => sum + p.price, 0);
  cartCount.textContent = cart.length;
  cartTotal.textContent = total.toFixed(2);
  cartBar.classList.toggle("hidden", cart.length === 0);
}

async function initPi(){
  if (!window.Pi) {
    toast("일반 브라우저 모드입니다. Pi Browser에서 Pi 기능을 테스트하세요.");
    return;
  }
  try {
    Pi.init({ version: "2.0", sandbox: true });
    piReady = true;
  } catch (e) {
    console.error(e);
    toast("Pi SDK 초기화에 실패했습니다.");
  }
}

async function loginPi(){
  if (!piReady) {
    toast("Pi Browser/Sandbox 연결 후 로그인할 수 있습니다.");
    return;
  }
  try {
    const scopes = ["username", "payments"];
    const auth = await Pi.authenticate(scopes, onIncompletePaymentFound);
    currentUser = auth.user;
    loginBtn.textContent = currentUser.username || "로그인 완료";
    toast(`Pi 로그인 완료: ${currentUser.username || ""}`);
  } catch (e) {
    console.error(e);
    toast("Pi 로그인에 실패했습니다.");
  }
}

async function postJSON(url, body = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data;
}

async function approvePayment(paymentId) {
  return postJSON(`/api/pi/payments/${encodeURIComponent(paymentId)}/approve`);
}

async function completePayment(paymentId, txid) {
  return postJSON(`/api/pi/payments/${encodeURIComponent(paymentId)}/complete`, { txid });
}

async function onIncompletePaymentFound(payment){
  console.log("Incomplete Pi payment:", payment);
  try {
    if (payment?.transaction?.txid && payment?.status?.developer_completed !== true) {
      toast("이전 미완료 결제를 확인하고 있습니다...");
      await completePayment(payment.identifier, payment.transaction.txid);
      toast("이전 Testnet 결제를 정상 완료했습니다.");
    }
  } catch (e) {
    console.error("Incomplete payment completion failed:", e);
    toast("이전 미완료 결제 확인에 실패했습니다.");
  }
}

async function checkout(){
  if (!cart.length || paymentInProgress) return;
  if (!currentUser) {
    toast("먼저 Pi 로그인을 해주세요.");
    return;
  }
  if (!piReady) {
    toast("Pi Sandbox 연결 상태를 확인해주세요.");
    return;
  }

  const items = cart.map(p => ({ id: p.id, name: p.name, price: p.price }));
  const amount = Number(cart.reduce((sum, p) => sum + p.price, 0).toFixed(2));
  const orderId = `BLOG24-${Date.now()}`;

  paymentInProgress = true;
  checkoutBtn.disabled = true;
  checkoutBtn.textContent = "결제 진행중";

  try {
    Pi.createPayment({
      amount,
      memo: `Blog24 상품 ${items.length}개 결제`,
      metadata: {
        orderId,
        itemIds: items.map(item => item.id),
        itemNames: items.map(item => item.name)
      }
    }, {
      onReadyForServerApproval: async function(paymentId) {
        try {
          await approvePayment(paymentId);
          toast("결제 승인 완료 · Pi Wallet에서 결제를 진행하세요.");
        } catch (e) {
          console.error("Approval failed:", e);
          toast(`서버 결제 승인 실패: ${e.message}`);
          throw e;
        }
      },

      onReadyForServerCompletion: async function(paymentId, txid) {
        try {
          await completePayment(paymentId, txid);
          cart = [];
          updateCart();
          toast(`Testnet 결제 완료: ${amount.toFixed(2)} π`);
        } catch (e) {
          console.error("Completion failed:", e);
          toast(`결제 완료 확인 실패: ${e.message}`);
          throw e;
        } finally {
          paymentInProgress = false;
          checkoutBtn.disabled = false;
          checkoutBtn.textContent = "Pi로 결제";
        }
      },

      onCancel: function(paymentId) {
        console.log("Payment cancelled:", paymentId);
        paymentInProgress = false;
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = "Pi로 결제";
        toast("결제가 취소되었습니다.");
      },

      onError: function(error, payment) {
        console.error("Pi payment error:", error, payment);
        paymentInProgress = false;
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = "Pi로 결제";
        toast(`Pi 결제 오류: ${error?.message || "알 수 없는 오류"}`);
      }
    });
  } catch (e) {
    console.error(e);
    paymentInProgress = false;
    checkoutBtn.disabled = false;
    checkoutBtn.textContent = "Pi로 결제";
    toast(`결제를 시작하지 못했습니다: ${e.message}`);
  }
}

document.getElementById("shopBtn").addEventListener("click", () => {
  document.getElementById("products").scrollIntoView({ behavior: "smooth" });
});
loginBtn.addEventListener("click", loginPi);
checkoutBtn.addEventListener("click", checkout);

renderProducts();
initPi();
