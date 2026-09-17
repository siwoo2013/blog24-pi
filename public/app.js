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

const grid = document.getElementById("productGrid");
const cartBar = document.getElementById("cartBar");
const cartCount = document.getElementById("cartCount");
const cartTotal = document.getElementById("cartTotal");
const loginBtn = document.getElementById("loginBtn");

function toast(message){
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2400);
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
    // Testnet 개발 단계: sandbox true
    Pi.init({ version: "2.0", sandbox: true });
    piReady = true;
  } catch (e) {
    console.error(e);
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

function onIncompletePaymentFound(payment){
  console.log("Incomplete Pi payment:", payment);
  // 다음 버전에서 서버 승인/완료 API와 연결
}

async function checkout(){
  if (!cart.length) return;
  if (!currentUser) {
    toast("먼저 Pi 로그인을 해주세요.");
    return;
  }
  // V1.0에서는 실제 createPayment 호출 전 단계까지만 구성.
  // 다음 단계에서 Render 서버의 Pi API 승인/완료 엔드포인트와 함께 활성화.
  toast(`결제 준비 완료: ${cartTotal.textContent} π · 다음 단계에서 Testnet 결제 연결`);
}

document.getElementById("shopBtn").addEventListener("click", () => {
  document.getElementById("products").scrollIntoView({ behavior: "smooth" });
});
loginBtn.addEventListener("click", loginPi);
document.getElementById("checkoutBtn").addEventListener("click", checkout);

renderProducts();
initPi();
