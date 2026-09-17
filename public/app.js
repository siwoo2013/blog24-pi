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
  const option = p.id === 1 ? "기본" : "기본";
  const found = cart.find(x => x.id === id && x.option === option);
  if (found) found.qty += 1;
  else cart.push({...p, option, qty: 1});
  updateCart();
  toast(`${p.name} 장바구니에 담음`);
}

function updateCart(){
  const total = cart.reduce((sum,p) => sum + (p.price * (p.qty || 1)), 0);
  cartCount.textContent = cart.reduce((n,p)=>n+(p.qty||1),0);
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

async function postJSON(url, body = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

async function approvePayment(paymentId) {
  return postJSON(`/api/pi/payments/${encodeURIComponent(paymentId)}/approve`);
}

async function completePayment(paymentId, txid, orderId) {
  return postJSON(`/api/pi/payments/${encodeURIComponent(paymentId)}/complete`, { txid, orderId });
}

async function onIncompletePaymentFound(payment){
  console.log("Incomplete Pi payment:", payment);
  try {
    const orderId = payment?.metadata?.orderId;
    if (payment?.transaction?.txid && payment?.status?.developer_completed !== true) {
      toast("이전 미완료 결제를 확인하고 있습니다...");
      await completePayment(payment.identifier, payment.transaction.txid, orderId);
      toast("이전 Testnet 결제를 정상 완료했습니다.");
    }
  } catch (e) {
    console.error(e);
    toast("이전 미완료 결제 확인에 실패했습니다.");
  }
}

function openCartReview(){
 return new Promise(resolve=>{
  const m=document.createElement("div");m.className="shipping-modal";
  const rows=cart.map((p,i)=>`<div class="cart-review-row">
    <div><b>${p.name}</b><small>옵션: ${p.option||"기본"}</small></div>
    <div class="qtyctl"><button data-i="${i}" data-d="-1">−</button><b>${p.qty||1}</b><button data-i="${i}" data-d="1">＋</button></div>
    <div>${(p.price*(p.qty||1)).toFixed(2)} π</div>
    <button class="delitem" data-del="${i}">삭제</button>
  </div>`).join("");
  const total=cart.reduce((a,p)=>a+p.price*(p.qty||1),0);
  m.innerHTML=`<div class="shipping-box cart-review"><h2>장바구니</h2>${rows}
   <div class="cart-review-total">상품 합계 <b>${total.toFixed(2)} π</b></div>
   <div class="shipping-actions"><button id="ccancel">계속 쇼핑</button><button id="corder">주문하기</button></div></div>`;
  document.body.appendChild(m);
  m.querySelectorAll("[data-d]").forEach(b=>b.onclick=()=>{const i=+b.dataset.i,d=+b.dataset.d;cart[i].qty=Math.max(1,(cart[i].qty||1)+d);m.remove();updateCart();openCartReview().then(resolve)});
  m.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{cart.splice(+b.dataset.del,1);m.remove();updateCart();if(cart.length)openCartReview().then(resolve);else resolve(false)});
  m.querySelector("#ccancel").onclick=()=>{m.remove();resolve(false)};
  m.querySelector("#corder").onclick=()=>{m.remove();resolve(true)};
 });
}

function askShippingInfo(){
 return new Promise(resolve=>{
  const m=document.createElement("div");m.className="shipping-modal";
  m.innerHTML=`<div class="shipping-box"><h2>배송정보</h2>
  <input id="sn" value="홍길동" placeholder="받는 분 이름"><input id="sp" value="010-0000-8282" placeholder="휴대폰 번호">
  <input id="sz" value="08282" placeholder="우편번호"><input id="sa" value="서울시 관악구 주문로 8282" placeholder="배송 주소">
  <input id="sd" value="8282호" placeholder="상세 주소"><input id="sm" value="테스트 주문입니다" placeholder="배송 메모 (선택)">
  <div class="shipping-actions"><button id="sc">취소</button><button id="so">주문 확인 및 Pi 결제</button></div></div>`;
  document.body.appendChild(m);
  m.querySelector("#sc").onclick=()=>{m.remove();resolve(null)};
  m.querySelector("#so").onclick=()=>{
    const v={recipientName:m.querySelector("#sn").value.trim(),phone:m.querySelector("#sp").value.trim(),postalCode:m.querySelector("#sz").value.trim(),address:m.querySelector("#sa").value.trim(),addressDetail:m.querySelector("#sd").value.trim(),deliveryMemo:m.querySelector("#sm").value.trim()};
    if(!v.recipientName||!v.phone||!v.address){toast("받는 분, 휴대폰, 주소는 필수입니다.");return}
    m.remove();resolve(v);
  };
 });
}

async function checkout(){
  if (!cart.length || paymentInProgress) return;
  if (!currentUser) { toast("먼저 Pi 로그인을 해주세요."); return; }
  if (!piReady) { toast("Pi Sandbox 연결 상태를 확인해주세요."); return; }

  const proceed = await openCartReview();
  if (!proceed || !cart.length) return;
  const shipping = await askShippingInfo();
  if (!shipping) return;

  const orderId = `BLOG24-${Date.now()}`;
  const expandedItems = [];
  cart.forEach(p => { for(let i=0;i<(p.qty||1);i++) expandedItems.push({id:p.id}); });

  paymentInProgress = true;
  const checkoutBtn = document.getElementById("checkoutBtn");
  checkoutBtn.disabled = true;
  checkoutBtn.textContent = "결제 준비중";

  try {
    const draft = await postJSON("/api/orders/draft", {
      orderId,
      username: currentUser.username,
      uid: currentUser.uid,
      shipping,
      items: expandedItems
    });
    const amount = Number(draft.amount);

    Pi.createPayment({
      amount,
      memo: `Blog24 상품 ${expandedItems.length}개 결제`,
      metadata: { orderId, itemIds: expandedItems.map(x=>x.id) }
    }, {
      onReadyForServerApproval: async paymentId => {
        await approvePayment(paymentId);
        toast("결제 승인 완료 · Pi Wallet에서 결제를 진행하세요.");
      },
      onReadyForServerCompletion: async (paymentId, txid) => {
        try {
          await completePayment(paymentId, txid, orderId);
          cart = [];
          updateCart();
          toast(`Testnet 결제 완료: ${amount.toFixed(2)} π`);
        } finally {
          paymentInProgress = false;
          checkoutBtn.disabled = false;
          checkoutBtn.textContent = "Pi로 결제";
        }
      },
      onCancel: paymentId => {
        console.log("Payment cancelled:", paymentId);
        paymentInProgress = false; checkoutBtn.disabled=false; checkoutBtn.textContent="Pi로 결제";
        toast("결제가 취소되었습니다.");
      },
      onError: (error,payment) => {
        console.error("Pi payment error:",error,payment);
        paymentInProgress = false; checkoutBtn.disabled=false; checkoutBtn.textContent="Pi로 결제";
        toast(`Pi 결제 오류: ${error?.message || "알 수 없는 오류"}`);
      }
    });
  } catch(e) {
    console.error(e);
    paymentInProgress = false; checkoutBtn.disabled=false; checkoutBtn.textContent="Pi로 결제";
    toast(`결제를 시작하지 못했습니다: ${e.message}`);
  }
}

document.getElementById("shopBtn").addEventListener("click", () => {
  document.getElementById("products").scrollIntoView({ behavior: "smooth" });
});
loginBtn.addEventListener("click", loginPi);
document.getElementById("checkoutBtn").addEventListener("click", checkout);

renderProducts();
initPi();
