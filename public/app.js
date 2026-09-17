const products = [
  { id: 1, name: "Blog24 머그컵", price: 1.2, icon: "☕", desc: "Blog24 데일리 머그", detail: "Blog24 로고 감성으로 가볍게 사용할 수 있는 데일리 머그컵입니다.", options: ["기본", "화이트", "퍼플"] },
  { id: 2, name: "Pi 데스크 패드", price: 2.5, icon: "🖥️", desc: "책상을 깔끔하게 정리하는 패드", detail: "키보드와 마우스를 함께 올려두기 좋은 데스크 패드입니다.", options: ["기본", "소형", "대형"] },
  { id: 3, name: "스마트 파우치", price: 3.8, icon: "🎒", desc: "작은 소지품을 담는 데일리 파우치", detail: "케이블, 충전기 등 작은 소지품을 정리하기 좋은 파우치입니다.", options: ["기본", "블랙", "퍼플"] },
  { id: 4, name: "Blog24 노트", price: 0.8, icon: "📒", desc: "아이디어 기록용 노트", detail: "간단한 메모와 아이디어 기록에 적합한 Blog24 노트입니다.", options: ["기본"] },
  { id: 5, name: "휴대폰 거치대", price: 1.6, icon: "📱", desc: "간편한 데스크용 거치대", detail: "책상 위에서 휴대폰을 편하게 세워둘 수 있는 거치대입니다.", options: ["기본"] },
  { id: 6, name: "테스트 상품", price: 0.1, icon: "🧪", desc: "Pi Testnet 결제 테스트용", detail: "Pi Testnet 결제 흐름을 빠르게 확인하기 위한 테스트 상품입니다.", options: ["기본"] }
];


const V16_PRODUCT_MEDIA = {
  1:{images:["/images/sample-1.svg","/images/sample-2.svg","/images/sample-3.svg"],youtube:"https://www.youtube.com/embed/dQw4w9WgXcQ",options:["화이트","블랙"]},
  2:{images:["/images/sample-2.svg","/images/sample-3.svg","/images/sample-1.svg"],youtube:"",options:["기본"]},
  3:{images:["/images/sample-3.svg","/images/sample-1.svg","/images/sample-2.svg"],youtube:"",options:["기본"]}
};
products.forEach(p=>Object.assign(p,V16_PRODUCT_MEDIA[p.id]||{images:["/images/sample-1.svg","/images/sample-2.svg","/images/sample-3.svg"],youtube:"",options:["기본"]}));

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
    <article class="card" onclick="openProductDetail(${p.id})">
      <div class="product-img">${p.icon}</div>
      <div class="card-body">
        <h3>${p.name}</h3>
        <div class="desc">${p.desc}</div>
        <div class="price-row">
          <span class="price">${p.price.toFixed(2)} π</span>
          <button class="add" onclick="event.stopPropagation(); addToCart(${p.id})">담기</button>
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


window.openProductDetail = function(id){
  const p = products.find(x => x.id === id);
  if (!p) return;
  const m = document.createElement("div");
  m.className = "shipping-modal";
  m.innerHTML = `<div class="shipping-box product-detail-box">
    <button class="detail-close" aria-label="닫기">×</button>
    <div class="detail-icon">${p.icon}</div>
    <h2>${p.name}</h2>
    <div class="detail-price">${p.price.toFixed(2)} π</div>
    <p class="detail-desc">${p.detail || p.desc}</p>
    <label class="field-label">옵션</label>
    <select id="detailOption">${(p.options || ["기본"]).map(o=>`<option value="${o}">${o}</option>`).join("")}</select>
    <label class="field-label">수량</label>
    <div class="detail-qty"><button id="dqMinus">−</button><b id="dqValue">1</b><button id="dqPlus">＋</button></div>
    <div class="detail-actions"><button id="shareProduct" class="share-btn">상품 공유하기</button><button id="detailAdd" class="primary-detail">장바구니 담기</button></div>
  </div>`;
  document.body.appendChild(m);
  let qty=1; const qv=m.querySelector("#dqValue");
  m.querySelector(".detail-close").onclick=()=>m.remove();
  m.onclick=e=>{if(e.target===m)m.remove()};
  m.querySelector("#dqMinus").onclick=()=>{qty=Math.max(1,qty-1);qv.textContent=qty};
  m.querySelector("#dqPlus").onclick=()=>{qty+=1;qv.textContent=qty};
  m.querySelector("#detailAdd").onclick=()=>{
    const option=m.querySelector("#detailOption").value;
    const found=cart.find(x=>x.id===p.id&&x.option===option);
    if(found) found.qty+=qty; else cart.push({...p,option,qty});
    updateCart(); m.remove(); toast(`${p.name} ${qty}개 장바구니에 담음`);
  };
  m.querySelector("#shareProduct").onclick=async()=>{
    const url=`${location.origin}${location.pathname}?product=${p.id}`;
    try{
      if(navigator.share) await navigator.share({title:p.name,text:`${p.name} · ${p.price.toFixed(2)} π`,url});
      else { await navigator.clipboard.writeText(url); toast("상품 링크를 복사했습니다."); }
    }catch(e){ if(e?.name!=="AbortError") toast("공유를 완료하지 못했습니다."); }
  };
};

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
    document.getElementById("ordersBtn").classList.remove("hidden");
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
  const savedRecipient=JSON.parse(localStorage.getItem("blog24_recipient")||"null");
  const savedOrderer=JSON.parse(localStorage.getItem("blog24_orderer")||"null");
  const recipient=savedRecipient||{recipientName:"홍길동",phone:"010-0000-8282",postalCode:"08282",address:"서울시 관악구 주문로 8282",addressDetail:"8282호",deliveryMemo:"테스트 주문입니다"};
  const orderer=savedOrderer||{ordererName:"홍길동",ordererPhone:"010-0000-8282"};
  const m=document.createElement("div");m.className="shipping-modal";
  m.innerHTML=`<div class="shipping-box"><h2>주문자 · 배송정보</h2>
  <h3 class="form-subtitle">주문자 정보</h3>
  <input id="on" value="${orderer.ordererName||""}" placeholder="주문자 이름"><input id="op" value="${orderer.ordererPhone||""}" placeholder="주문자 휴대폰 번호">
  <label class="remember-row"><input type="checkbox" id="rememberOrderer" ${savedOrderer?"checked":""}> 주문자 정보 기억하기</label>
  <h3 class="form-subtitle">받는 사람 정보</h3>
  <input id="sn" value="${recipient.recipientName||""}" placeholder="받는 분 이름"><input id="sp" value="${recipient.phone||""}" placeholder="휴대폰 번호">
  <input id="sz" value="${recipient.postalCode||""}" placeholder="우편번호"><input id="sa" value="${recipient.address||""}" placeholder="배송 주소">
  <input id="sd" value="${recipient.addressDetail||""}" placeholder="상세 주소"><input id="sm" value="${recipient.deliveryMemo||""}" placeholder="배송 메모 (선택)">
  <label class="remember-row"><input type="checkbox" id="rememberRecipient" ${savedRecipient?"checked":""}> 받는 사람 정보 기억하기</label>
  <div class="shipping-actions"><button id="sc">취소</button><button id="so">주문 확인 및 Pi 결제</button></div></div>`;
  document.body.appendChild(m);
  m.querySelector("#sc").onclick=()=>{m.remove();resolve(null)};
  m.querySelector("#so").onclick=()=>{
    const ordererInfo={ordererName:m.querySelector("#on").value.trim(),ordererPhone:m.querySelector("#op").value.trim()};
    const v={recipientName:m.querySelector("#sn").value.trim(),phone:m.querySelector("#sp").value.trim(),postalCode:m.querySelector("#sz").value.trim(),address:m.querySelector("#sa").value.trim(),addressDetail:m.querySelector("#sd").value.trim(),deliveryMemo:m.querySelector("#sm").value.trim(),...ordererInfo};
    if(!ordererInfo.ordererName||!ordererInfo.ordererPhone||!v.recipientName||!v.phone||!v.address){toast("주문자/받는 분 이름, 휴대폰, 주소는 필수입니다.");return}
    if(m.querySelector("#rememberOrderer").checked)localStorage.setItem("blog24_orderer",JSON.stringify(ordererInfo));else localStorage.removeItem("blog24_orderer");
    const recipientInfo={recipientName:v.recipientName,phone:v.phone,postalCode:v.postalCode,address:v.address,addressDetail:v.addressDetail,deliveryMemo:v.deliveryMemo};
    if(m.querySelector("#rememberRecipient").checked)localStorage.setItem("blog24_recipient",JSON.stringify(recipientInfo));else localStorage.removeItem("blog24_recipient");
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



function statusKo(s){return ({PENDING:"결제대기",PAID:"결제완료",PREPARING:"상품준비중",SHIPPED:"배송중",DELIVERED:"배송완료",CONFIRMED:"구매확정"})[s]||s||"-"}
function fmtDate(v){try{return new Date(v).toLocaleString("ko-KR")}catch{return v||"-"}}
async function openMyOrders(){
 if(!currentUser?.uid){toast("먼저 Pi 로그인을 해주세요.");return}
 const m=document.createElement("div");m.className="shipping-modal";
 m.innerHTML=`<div class="shipping-box"><h2>내 주문내역</h2><div id="myOrders" class="orders-list"><div>불러오는 중...</div></div><div class="shipping-actions"><button id="ordersClose">닫기</button></div></div>`;
 document.body.appendChild(m);m.querySelector("#ordersClose").onclick=()=>m.remove();
 try{
  const r=await fetch(`/api/orders/mine?uid=${encodeURIComponent(currentUser.uid)}`);const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||`HTTP ${r.status}`);
  const box=m.querySelector("#myOrders");
  if(!d.orders.length){box.innerHTML="<div>아직 주문내역이 없습니다.</div>";return}
  box.innerHTML=d.orders.map(o=>`<div class="order-card"><div class="order-card-head"><b>${o.order_id}</b><span class="order-status">${statusKo(o.order_status)}</span></div><small>${fmtDate(o.ordered_at)} · ${Number(o.paid_total).toFixed(2)} π</small><div class="order-items">${(o.items||[]).map(i=>`${i.productName} × ${i.quantity} · ${(Number(i.unitPrice)*Number(i.quantity)).toFixed(2)} π`).join("<br>")}</div>${o.tracking_number?`<div class="order-meta">${o.courier||"택배"} · 송장 ${o.tracking_number}</div>`:""}<div class="order-meta">Payment ID: ${o.payment_id||"-"}<br>TXID: ${o.txid||"-"}</div></div>`).join("");
 }catch(e){m.querySelector("#myOrders").innerHTML=`<div>주문내역을 불러오지 못했습니다.<br>${e.message}</div>`}
}

document.getElementById("shopBtn").addEventListener("click", () => {
  document.getElementById("products").scrollIntoView({ behavior: "smooth" });
});
loginBtn.addEventListener("click", loginPi);
document.getElementById("ordersBtn").addEventListener("click", openMyOrders);
document.getElementById("checkoutBtn").addEventListener("click", checkout);

renderProducts();
initPi();
const sharedProductId=Number(new URLSearchParams(location.search).get("product"));
if(sharedProductId && products.some(p=>p.id===sharedProductId)) setTimeout(()=>openProductDetail(sharedProductId),250);


function openProductDetail(id){
 const p=products.find(x=>x.id===id); if(!p)return;
 const media=p.images||[]; const m=document.createElement("div");m.className="shipping-modal";
 m.innerHTML=`<div class="shipping-box product-detail"><button class="detail-close">✕</button>
 <img class="detail-main" src="${media[0]||""}" alt="${p.name}">
 <div class="detail-thumbs">${media.slice(0,3).map((x,i)=>`<img src="${x}" data-src="${x}" alt="상품 이미지 ${i+1}">`).join("")}</div>
 <h2>${p.name}</h2><p>${p.desc||""}</p><b class="detail-price">${Number(p.price).toFixed(2)} π</b>
 <label>옵션<select id="detailOption">${(p.options||["기본"]).map(x=>`<option>${x}</option>`).join("")}</select></label>
 <label>수량<input id="detailQty" type="number" min="1" value="1"></label>
 ${p.youtube?`<div class="video-wrap"><iframe src="${p.youtube}" title="상품 영상" allowfullscreen></iframe></div>`:""}
 <div class="detail-actions"><button id="detailShare">공유하기</button><button id="detailAdd">장바구니 담기</button></div></div>`;
 document.body.appendChild(m);
 m.querySelector(".detail-close").onclick=()=>m.remove();
 m.querySelectorAll(".detail-thumbs img").forEach(x=>x.onclick=()=>m.querySelector(".detail-main").src=x.dataset.src);
 m.querySelector("#detailShare").onclick=async()=>{const data={title:p.name,text:`${p.name} ${Number(p.price).toFixed(2)} π`,url:location.href};
  try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(location.href);toast("상품 링크를 복사했습니다.");}}catch(e){}};
 m.querySelector("#detailAdd").onclick=()=>{const q=Math.max(1,parseInt(m.querySelector("#detailQty").value||"1"));const opt=m.querySelector("#detailOption").value;
  const f=cart.find(x=>x.id===p.id&&x.option===opt);if(f)f.qty=(f.qty||1)+q;else cart.push({...p,option:opt,qty:q});updateCart();m.remove();toast(`${p.name} 장바구니에 담음`);};
}
window.openProductDetail=openProductDetail;

function ensureV16Header(){
 const h=document.querySelector("header")||document.body;
 const box=document.createElement("div");box.className="v16-tools";
 box.innerHTML=`<button id="externalOpenBtn">🌐 Google로 열기</button><button id="installBtn">📲 홈 화면 바로가기</button><button id="topCartBtn">🛒 장바구니 <b id="topCartCount">0</b></button>`;
 h.appendChild(box);
 document.getElementById("topCartBtn").onclick=()=>{if(cart.length)openCartReview();else toast("장바구니가 비어 있습니다.");};
 document.getElementById("externalOpenBtn").onclick=()=>openExternalBrowser();
 document.getElementById("installBtn").onclick=()=>installShortcut();
 updateTopCart();
}
function updateTopCart(){const e=document.getElementById("topCartCount");if(e)e.textContent=cart.reduce((a,p)=>a+(p.qty||1),0);}
const _oldUpdateCart=updateCart; updateCart=function(){_oldUpdateCart();updateTopCart();};

function openExternalBrowser(){
 const u=location.href.replace(/^https?:\/\//,"");
 if(/Android/i.test(navigator.userAgent)){
   location.href=`intent://${u}#Intent;scheme=https;package=com.android.chrome;end`;
   setTimeout(()=>toast("열리지 않으면 주소를 복사해 Chrome에서 열어주세요."),1200);
 } else window.open(location.href,"_blank");
}
let deferredInstallPrompt=null;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstallPrompt=e;});
async function installShortcut(){
 if(deferredInstallPrompt){deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;}
 else toast("브라우저 메뉴에서 '홈 화면에 추가'를 선택해주세요.");
}


window.addEventListener("DOMContentLoaded",()=>{try{ensureV16Header()}catch(e){console.error(e)}});
