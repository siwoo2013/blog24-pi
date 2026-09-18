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

function confirmOrderBeforePi(shipping){
 return new Promise(resolve=>{const m=document.createElement("div");m.className="shipping-modal";const total=cart.reduce((a,p)=>a+Number(p.price)*(p.qty||1),0);const rows=cart.map(p=>`<div class="confirm-item"><div><b>${p.name}</b><small>옵션: ${p.option||"기본"} · 수량 ${p.qty||1}</small></div><b>${(Number(p.price)*(p.qty||1)).toFixed(2)} π</b></div>`).join("");m.innerHTML=`<div class="shipping-box final-confirm"><h2>최종 주문 확인</h2><div class="confirm-section"><h3>주문상품</h3>${rows}</div><div class="confirm-section"><h3>주문자</h3><p>${shipping.ordererName} · ${shipping.ordererPhone}</p></div><div class="confirm-section"><h3>배송정보</h3><p>${shipping.recipientName} · ${shipping.phone}</p><p>${shipping.postalCode||""} ${shipping.address} ${shipping.addressDetail||""}</p><p>${shipping.deliveryMemo||""}</p></div><div class="confirm-total"><span>결제 예정금액</span><b>${total.toFixed(2)} π</b></div><div class="shipping-actions"><button id="confirmBack">이전</button><button id="confirmPi">Pi 결제 진행</button></div></div>`;document.body.appendChild(m);m.querySelector("#confirmBack").onclick=()=>{m.remove();resolve(false)};m.querySelector("#confirmPi").onclick=()=>{m.remove();resolve(true)};});
}

async function checkout(skipCartReview=false){
  if (!cart.length || paymentInProgress) return;
  if (!currentUser) { toast("먼저 Pi 로그인을 해주세요."); return; }
  if (!piReady) { toast("Pi Sandbox 연결 상태를 확인해주세요."); return; }

  if(!skipCartReview){
    const proceed = await openCartReview();
    if (!proceed || !cart.length) return;
  }
  const shipping = await askShippingInfo();
  if (!shipping) return;
  const confirmed = await confirmOrderBeforePi(shipping);
  if (!confirmed) return;

  const orderId = `BLOG24-${Date.now()}`;
  const expandedItems = cart.map(p => ({id:p.id,option:p.option||"기본",qty:p.qty||1}));

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
      memo: `Blog24 상품 ${expandedItems.reduce((a,x)=>a+(x.qty||1),0)}개 결제`,
      metadata: { orderId, itemIds: expandedItems.map(x=>x.id), quantities: expandedItems.map(x=>x.qty) }
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


function youtubeEmbedUrl(url){
 if(!url)return "";
 try{
  if(url.includes("youtube.com/embed/")) return url;
  const u=new URL(url);
  let id="";
  if(u.hostname.includes("youtu.be")) id=u.pathname.replace("/","");
  else if(u.pathname.includes("/shorts/")) id=u.pathname.split("/shorts/")[1].split("/")[0];
  else id=u.searchParams.get("v")||"";
  return id?`https://www.youtube.com/embed/${id}`:"";
 }catch(e){return ""}
}
function openProductDetail(id){
 const p=products.find(x=>x.id===id);if(!p)return;
 const images=(p.images||[]).slice(0,3);
 const yt=youtubeEmbedUrl(p.youtube||"");
 const thumbImages=yt?images.slice(0,2):images.slice(0,3);
 const m=document.createElement("div");m.className="shipping-modal product-modal";
 const first=thumbImages[0]||images[0]||"";
 m.innerHTML=`<div class="shipping-box product-detail">
 <button class="detail-close" aria-label="상품 상세 닫기">✕</button>
 <div class="detail-media">
   ${first?`<img class="detail-main" src="${first}" alt="${p.name}">`:`<div class="detail-icon">${p.icon||"🛍️"}</div>`}
   <iframe class="detail-video-main hidden" title="${p.name} 상품 영상" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
 </div>
 <div class="detail-thumbs">
   ${thumbImages.map((x,i)=>`<button class="media-thumb image-thumb" data-src="${x}" aria-label="상품 이미지 ${i+1}"><img src="${x}" alt="상품 이미지 ${i+1}"></button>`).join("")}
   ${yt?`<button class="media-thumb youtube-thumb" data-youtube="${yt}" aria-label="상품 영상"><span>▶</span><small>YouTube</small></button>`:""}
 </div>
 <h2>${p.name}</h2><p>${p.detail||p.desc||""}</p><b class="detail-price">${Number(p.price).toFixed(2)} π</b>
 <label>옵션<select id="detailOption">${(p.options||["기본"]).map(x=>`<option value="${x}">${x}</option>`).join("")}</select></label>
 <label>수량<div class="detail-qty"><button id="dqMinus">−</button><b id="dqValue">1</b><button id="dqPlus">＋</button></div></label>
 <div class="detail-actions"><button id="detailShare">상품 공유하기</button><button id="detailAdd">장바구니 담기</button></div>
 </div>`;
 document.body.appendChild(m);let qty=1;
 const main=m.querySelector(".detail-main"),video=m.querySelector(".detail-video-main");
 m.querySelector(".detail-close").onclick=()=>m.remove();
 m.querySelectorAll(".image-thumb").forEach(b=>b.onclick=()=>{if(main){main.src=b.dataset.src;main.classList.remove("hidden")}video.classList.add("hidden");video.src="";});
 const yb=m.querySelector(".youtube-thumb");if(yb)yb.onclick=()=>{if(main)main.classList.add("hidden");video.src=yb.dataset.youtube;video.classList.remove("hidden");};
 m.querySelector("#dqMinus").onclick=()=>{qty=Math.max(1,qty-1);m.querySelector("#dqValue").textContent=qty};
 m.querySelector("#dqPlus").onclick=()=>{qty=Math.min(99,qty+1);m.querySelector("#dqValue").textContent=qty};
 m.querySelector("#detailShare").onclick=async()=>{const u=new URL(location.href);u.searchParams.set("product",p.id);const d={title:p.name,text:`${p.name} · ${Number(p.price).toFixed(2)} π`,url:u.toString()};try{if(navigator.share)await navigator.share(d);else{await navigator.clipboard.writeText(d.url);toast("상품 링크를 복사했습니다.");}}catch(e){}};
 m.querySelector("#detailAdd").onclick=()=>{const opt=m.querySelector("#detailOption").value,f=cart.find(x=>x.id===p.id&&(x.option||"기본")===opt);if(f)f.qty=(f.qty||1)+qty;else cart.push({...p,option:opt,qty});updateCart();m.remove();toast(`${p.name} 장바구니에 담음`);};
}
window.openProductDetail=openProductDetail;

function updateTopCart(){const e=document.getElementById("topCartCount");if(e)e.textContent=cart.reduce((a,p)=>a+(p.qty||1),0);}
const _oldUpdateCart=updateCart; updateCart=function(){_oldUpdateCart();updateTopCart();};
const topCartBtn=document.getElementById("topCartBtn");
if(topCartBtn)topCartBtn.addEventListener("click",async()=>{
 if(!cart.length){toast("장바구니가 비어 있습니다.");return;}
 const proceed=await openCartReview();
 if(proceed && cart.length) checkout(true);
});
updateTopCart();


// V1.6.5 Chrome visible viewport correction
(function(){
 const ua=navigator.userAgent||"";
 const isKakao=/KAKAOTALK/i.test(ua), isPiBrowser=/PiBrowser/i.test(ua), isChrome=/Chrome|CriOS/i.test(ua);
 if(isChrome && !isKakao && !isPiBrowser) document.documentElement.classList.add("external-chrome");
 function syncVisibleViewport(){
   const vv=window.visualViewport, h=vv?vv.height:window.innerHeight;
   document.documentElement.style.setProperty("--visible-vh",`${h}px`);
 }
 syncVisibleViewport(); window.addEventListener("resize",syncVisibleViewport,{passive:true});
 if(window.visualViewport){visualViewport.addEventListener("resize",syncVisibleViewport,{passive:true});visualViewport.addEventListener("scroll",syncVisibleViewport,{passive:true});}
})();

// ===== V1.6.6 Product Share =====
async function shareProductV166(product){
  const title = product?.name || product?.title || "Blog24 상품";
  const price = product?.price != null ? `${product.price} π` : "";
  const text = `${title}${price ? " · " + price : ""}`;
  const url = location.href.split("#")[0];

  try{
    if(navigator.share){
      await navigator.share({title, text, url});
      return;
    }
  }catch(e){
    if(e && e.name === "AbortError") return;
  }

  try{
    await navigator.clipboard.writeText(`${text}\n${url}`);
    if(typeof toast==="function") toast("상품 링크를 복사했습니다. 카카오톡에서 공유해 주세요.");
    else alert("상품 링크를 복사했습니다.");
  }catch(e){
    prompt("상품 링크를 복사해 공유해 주세요.", `${text}\n${url}`);
  }
}

// 기존 공유 버튼을 캡처 단계에서 통일 처리
document.addEventListener("click", function(e){
  const b=e.target.closest("button");
  if(!b) return;
  const t=(b.textContent||"").replace(/\s+/g," ").trim();
  if(t!=="상품 공유하기") return;
  e.preventDefault();
  e.stopImmediatePropagation();

  let product=null;
  try{
    if(typeof selectedProduct!=="undefined") product=selectedProduct;
    else if(typeof currentProduct!=="undefined") product=currentProduct;
  }catch(_){}
  shareProductV166(product);
}, true);
