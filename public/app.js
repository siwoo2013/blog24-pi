let products = [];
let storeSettings={slideYoutube:"",shortsUrl:"",footerText:"회사명: Blog24\n고객센터: 02-000-8282",copyright:"Copyright © 2026 Blog24. All rights reserved.",terms:"",privacy:""};
async function loadStoreData(){
 try{const [pr,sr,cr]=await Promise.all([fetch('/api/products').then(r=>r.json()),fetch('/api/store-settings').then(r=>r.json()),fetch('/api/categories').then(r=>r.json())]);if(pr.ok)products=pr.products||[];if(sr.ok)storeSettings=sr.settings||storeSettings;if(cr.ok)renderCategoryNav(cr.categories||[]);}catch(e){console.error(e)}
 renderProducts();setupCategories();setupHero();setupShorts();setTimeout(applyFooter,0);
 const shared=Number(new URLSearchParams(location.search).get('product'));if(shared&&products.some(p=>p.id===shared))setTimeout(()=>openProductDetail(shared),250);
}

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

function renderProducts(list=products){
  grid.innerHTML = list.map(p => `<article class="card" onclick="openProductDetail(${p.id})"><div class="product-img"><img src="${(p.images&&p.images[0])||'/images/sample-1.svg'}" alt="${p.name}"></div><div class="card-body"><h3>${p.name}</h3><div class="desc">${p.desc||''}</div><div class="ship-badge">${Number(p.shipping||0)===0?'무료배송':`배송 ${Number(p.shipping).toFixed(2)} π`}</div><div class="price-row"><span class="price">${Number(p.price).toFixed(2)} π</span><button class="add" onclick="event.stopPropagation(); addToCart(${p.id})">담기</button></div></div></article>`).join("");
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

initPi();
loadStoreData();


function youtubeVideoId(url){if(!url)return "";try{const u=new URL(url);if(u.hostname.includes("youtu.be"))return u.pathname.replace("/","").split("?")[0];if(u.pathname.includes("/shorts/"))return u.pathname.split("/shorts/")[1].split("/")[0];return u.searchParams.get("v")||""}catch{return ""}}
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
   ${yt?`<button class="media-thumb youtube-thumb" data-youtube="${yt}" aria-label="상품 영상"><img src="https://img.youtube.com/vi/${youtubeVideoId(p.youtube||"")}/hqdefault.jpg" alt="상품 영상 미리보기"><span>▶</span></button>`:""}
 </div>
 <h2>${p.name}</h2><p>${p.detail||p.desc||""}</p><b class="detail-price">${Number(p.price).toFixed(2)} π</b>
 <label>옵션<select id="detailOption">${(p.options||["기본"]).map(x=>`<option value="${x}">${x}</option>`).join("")}</select></label>
 <label>수량<div class="detail-qty"><button id="dqMinus">−</button><b id="dqValue">1</b><button id="dqPlus">＋</button></div></label>
 ${(p.detailImages||[]).length?`<div class="detail-description-images">${p.detailImages.map(x=>`<img src="${x}" alt="${p.name} 상세설명">`).join("")}</div>`:""}<div class="detail-actions"><button id="detailShare">상품 공유하기</button><button id="detailAdd">장바구니 담기</button></div>
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

// V1.6.7 store UI / category / banner / Shorts
function renderCategoryNav(cats){const nav=document.querySelector('.store-nav');if(nav)nav.innerHTML='<button class="active" data-cat="전체">홈</button>'+cats.map(c=>`<button data-cat="${c}">${c}</button>`).join('');}
function setupCategories(){document.querySelectorAll('.store-nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.store-nav button').forEach(x=>x.classList.remove('active'));b.classList.add('active');const c=b.dataset.cat||'전체';renderProducts(c==='전체'?products:products.filter(p=>p.category===c));});}
function setupHero(){
 const track=document.querySelector('.hero-track');if(!track)return;let slides=[...track.querySelectorAll('.hero-slide')],i=0,timer=null,videoPlaying=false;
 const yt=youtubeEmbedUrl(storeSettings.slideYoutube||'');
 if(yt){const d=document.createElement('div');d.className='hero-slide hero-video-slide';const id='heroYT';d.innerHTML=`<iframe id="${id}" src="${yt}${yt.includes('?')?'&':'?'}enablejsapi=1" title="메인 영상" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;track.appendChild(d);slides=[...track.querySelectorAll('.hero-slide')];setTimeout(()=>document.getElementById(id)?.contentWindow?.postMessage(JSON.stringify({event:'listening',id}),'*'),800)}
 const go=n=>{i=(n+slides.length)%slides.length;track.style.transform=`translateX(-${i*100}%)`};
 const stop=()=>{if(timer){clearInterval(timer);timer=null}};
 const start=()=>{stop();if(videoPlaying||slides.length<2)return;timer=setInterval(()=>go(i+1),5000)};
 let sx=0,sy=0;track.addEventListener('touchstart',e=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY;stop()},{passive:true});track.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)){go(i+(dx<0?1:-1));videoPlaying=false;start()}else if(!videoPlaying)start()},{passive:true});
 window.addEventListener('message',e=>{try{const m=typeof e.data==='string'?JSON.parse(e.data):e.data;if(m?.event==='onStateChange'){if(m.info===1||m.info===2){videoPlaying=true;stop()}if(m.info===0){videoPlaying=false;start()}}}catch{}});start();
}
function setupShorts(){const b=document.getElementById('quickShorts');if(!b)return;const u=storeSettings.shortsUrl||'';b.classList.toggle('hidden',!u);if(!u)return;let id='';try{const x=new URL(u);if(x.pathname.includes('/shorts/'))id=x.pathname.split('/shorts/')[1].split('/')[0];else id=x.searchParams.get('v')||''}catch{}if(id)b.innerHTML=`<img src="https://img.youtube.com/vi/${id}/hqdefault.jpg" alt="Shorts"><span>▶</span>`;b.onclick=()=>{const y=youtubeEmbedUrl(u);if(!y)return;const m=document.createElement('div');m.className='shorts-modal';m.innerHTML=`<div class="shorts-player"><button>✕</button><iframe src="${y}" allowfullscreen></iframe></div>`;document.body.appendChild(m);m.querySelector('button').onclick=()=>m.remove();};}

// V1.6.9 install / footer / policy / lively Shorts
let deferredInstallPrompt=null;const installBtn=document.getElementById('installBtn');
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;if(installBtn)installBtn.classList.remove('hidden')});
if(installBtn)installBtn.onclick=async()=>{if(deferredInstallPrompt){deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;installBtn.classList.add('hidden')}else toast('브라우저 메뉴의 홈 화면에 추가/앱 설치를 이용해주세요.')};
function policyModal(title,text){const m=document.createElement('div');m.className='shipping-modal';m.innerHTML=`<div class="shipping-box policy-box"><h2>${title}</h2><div class="policy-text"></div><div class="shipping-actions"><button>닫기</button></div></div>`;m.querySelector('.policy-text').textContent=text||'내용을 준비 중입니다.';document.body.appendChild(m);m.querySelector('button').onclick=()=>m.remove()}
function applyFooter(){const f=document.getElementById('footerCopy'),c=document.getElementById('footerCopyright');if(f)f.textContent=storeSettings.footerText||'';if(c)c.textContent=storeSettings.copyright||'';document.getElementById('termsBtn')?.addEventListener('click',()=>policyModal('이용약관',storeSettings.terms));document.getElementById('privacyBtn')?.addEventListener('click',()=>policyModal('개인정보처리방침',storeSettings.privacy));}
setTimeout(applyFooter,700);
window.addEventListener('scroll',()=>{const q=document.getElementById('quickShorts');if(!q||q.classList.contains('hidden'))return;const y=Math.max(-36,Math.min(36,(window.scrollY%500-250)*.10));q.style.transform=`translateY(${y}px)`},{passive:true});
