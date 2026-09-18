const express=require("express");
const path=require("path");
const crypto=require("crypto");
const {Pool}=require("pg");
const app=express();
const PORT=process.env.PORT||3000;
const PI_API_KEY=process.env.PI_API_KEY;
const PI_API_BASE="https://api.minepi.com";
const ADMIN_KEY=process.env.ADMIN_KEY||"";
const pool=process.env.DATABASE_URL?new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}):null;

app.use(express.json());

function escHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function xmlEsc(v){return escHtml(v);}
function siteBase(req){return String(process.env.SITE_URL||`${req.protocol}://${req.get("host")}`).replace(/\/$/,"");}
function absoluteUrl(base,u){if(!u)return `${base}/images/sns-share.svg`;if(/^https?:\/\//i.test(u))return u;return `${base}${u.startsWith('/')?'':'/'}${u}`;}
function seoLayout({title,description,canonical,image,body,jsonLd=''}){return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escHtml(title)}</title><meta name="description" content="${escHtml(description)}"><link rel="canonical" href="${escHtml(canonical)}"><meta name="robots" content="index,follow,max-image-preview:large"><meta property="og:type" content="website"><meta property="og:site_name" content="Blog24 Pi Shopping"><meta property="og:title" content="${escHtml(title)}"><meta property="og:description" content="${escHtml(description)}"><meta property="og:url" content="${escHtml(canonical)}"><meta property="og:image" content="${escHtml(image)}"><meta name="twitter:card" content="summary_large_image">${jsonLd?`<script type="application/ld+json">${jsonLd.replace(/<\//g,'<\\/')}</script>`:''}<link rel="stylesheet" href="/style.css?v=1.6.17"></head><body>${body}</body></html>`;}

app.get('/robots.txt',(req,res)=>{const b=siteBase(req);res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: ${b}/sitemap.xml\n`)});
app.get('/sitemap.xml',async(req,res)=>{const b=siteBase(req);const ps=(await effectiveProducts()).filter(x=>x.active!==false);const cats=[...new Set(ps.map(x=>x.category).filter(Boolean))];const urls=[`${b}/`,...cats.map(c=>`${b}/category/${encodeURIComponent(c)}`),...ps.map(p=>`${b}/product/${p.id}`)];res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u,i)=>`<url><loc>${xmlEsc(u)}</loc><changefreq>${i?'daily':'hourly'}</changefreq><priority>${i?0.8:1.0}</priority></url>`).join('')}</urlset>`)});
app.get('/product/:id',async(req,res)=>{const p=await effectiveProduct(req.params.id);if(!p||p.active===false)return res.status(404).send('상품을 찾을 수 없습니다.');const b=siteBase(req),canonical=`${b}/product/${p.id}`,img=absoluteUrl(b,(p.images||[])[0]);const desc=(p.desc||p.detail||`${p.name} - Blog24 Pi Shopping`).slice(0,180);const ld=JSON.stringify({'@context':'https://schema.org','@type':'Product',name:p.name,description:desc,image:(p.images||[]).map(x=>absoluteUrl(b,x)),category:p.category||'',offers:{'@type':'Offer',url:canonical,price:Number(p.price),priceCurrency:'XPI',availability:Number(p.stock||0)>0?'https://schema.org/InStock':'https://schema.org/OutOfStock'}});const body=`<main class="seo-product-page"><a href="/" class="seo-back">← Blog24 쇼핑몰</a><article><img src="${escHtml(img)}" alt="${escHtml(p.name)}"><div><p>${escHtml(p.category||'상품')}</p><h1>${escHtml(p.name)}</h1><p>${escHtml(desc)}</p><strong>${Number(p.price).toFixed(2)} π</strong><p>${escHtml(p.shippingText||'')}</p><a class="seo-open" href="/?product=${p.id}">Blog24에서 상품 보기</a></div></article></main>`;res.send(seoLayout({title:`${p.name} | Blog24`,description:desc,canonical,image:img,body,jsonLd:ld}));});
app.get('/category/:name',async(req,res)=>{const name=decodeURIComponent(req.params.name),b=siteBase(req);const ps=(await effectiveProducts()).filter(x=>x.active!==false&&x.category===name);if(!ps.length)return res.status(404).send('카테고리를 찾을 수 없습니다.');const canonical=`${b}/category/${encodeURIComponent(name)}`;const cards=ps.map(p=>`<a class="seo-card" href="/product/${p.id}"><img src="${escHtml(absoluteUrl(b,(p.images||[])[0]))}" alt="${escHtml(p.name)}"><h2>${escHtml(p.name)}</h2><strong>${Number(p.price).toFixed(2)} π</strong></a>`).join('');res.send(seoLayout({title:`${name} 상품 | Blog24`,description:`Blog24 ${name} 카테고리 상품을 확인하세요.`,canonical,image:`${b}/images/sns-share.svg`,body:`<main class="seo-category-page"><a href="/" class="seo-back">← Blog24 쇼핑몰</a><h1>${escHtml(name)} 상품</h1><div class="seo-grid">${cards}</div></main>`}));});

app.use(express.static(path.join(__dirname,"public")));

const DEFAULT_PRODUCTS=require("./public/default-products.json");
async function effectiveProducts(){
 if(!pool)return DEFAULT_PRODUCTS;
 try{
  const r=await pool.query("SELECT * FROM products ORDER BY sort_order,id");
  if(!r.rows.length)return DEFAULT_PRODUCTS;
  return r.rows.map(x=>({id:x.id,name:x.name,price:Number(x.price),shipping:Number(x.shipping||0),shippingText:x.shipping_text||'',category:x.category||'기타',desc:x.description||'',detail:x.detail||'',options:x.options||['기본'],images:x.images||[],detailImages:x.detail_images||[],youtube:x.youtube_url||'',active:x.active!==false,sortOrder:x.sort_order||x.id,stock:Number.isFinite(Number(x.stock))?Number(x.stock):9999}));
 }catch(e){console.error('products fallback',e.message);return DEFAULT_PRODUCTS}
}
async function effectiveProduct(id){return (await effectiveProducts()).find(x=>Number(x.id)===Number(id));}

async function initDb(){
 if(!pool)return;
 await pool.query(`
 CREATE TABLE IF NOT EXISTS orders(
  id BIGSERIAL PRIMARY KEY, order_id TEXT UNIQUE NOT NULL,
  pi_username TEXT,pi_uid TEXT,orderer_name TEXT,orderer_phone TEXT,recipient_name TEXT NOT NULL,phone TEXT NOT NULL,
  postal_code TEXT,address TEXT NOT NULL,address_detail TEXT,delivery_memo TEXT,
  item_total NUMERIC(18,7) NOT NULL DEFAULT 0,shipping_total NUMERIC(18,7) NOT NULL DEFAULT 0,
  paid_total NUMERIC(18,7) NOT NULL DEFAULT 0,payment_id TEXT UNIQUE,txid TEXT,
  payment_status TEXT NOT NULL DEFAULT 'PENDING',order_status TEXT NOT NULL DEFAULT 'PENDING',
  courier TEXT,tracking_number TEXT,ordered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  preparing_at TIMESTAMPTZ,shipped_at TIMESTAMPTZ,delivered_at TIMESTAMPTZ,confirmed_at TIMESTAMPTZ);
 CREATE TABLE IF NOT EXISTS order_items(
  id BIGSERIAL PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  product_id INT NOT NULL,product_name TEXT NOT NULL,quantity INT NOT NULL DEFAULT 1,
  unit_price NUMERIC(18,7) NOT NULL,shipping_fee NUMERIC(18,7) NOT NULL DEFAULT 0,
  item_status TEXT NOT NULL DEFAULT 'PAID');
 CREATE TABLE IF NOT EXISTS refunds(
  id BIGSERIAL PRIMARY KEY,refund_id TEXT UNIQUE NOT NULL,order_id TEXT NOT NULL REFERENCES orders(order_id),
  order_item_id BIGINT REFERENCES order_items(id),refund_type TEXT NOT NULL,
  product_amount NUMERIC(18,7) NOT NULL DEFAULT 0,shipping_amount NUMERIC(18,7) NOT NULL DEFAULT 0,
  refund_amount NUMERIC(18,7) NOT NULL,refund_wallet TEXT NOT NULL,reason TEXT,
  status TEXT NOT NULL DEFAULT 'REQUESTED',refund_txid TEXT,requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,refunded_at TIMESTAMPTZ);
 CREATE TABLE IF NOT EXISTS products(
  id INT PRIMARY KEY,name TEXT NOT NULL,price NUMERIC(18,7) NOT NULL DEFAULT 0,shipping NUMERIC(18,7) NOT NULL DEFAULT 0,
  shipping_text TEXT,category TEXT,description TEXT,detail TEXT,options JSONB NOT NULL DEFAULT '["기본"]'::jsonb,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,detail_images JSONB NOT NULL DEFAULT '[]'::jsonb,youtube_url TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,sort_order INT NOT NULL DEFAULT 0,stock INT NOT NULL DEFAULT 9999,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
 CREATE TABLE IF NOT EXISTS store_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL DEFAULT '',updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
 CREATE TABLE IF NOT EXISTS categories(name TEXT PRIMARY KEY,active BOOLEAN NOT NULL DEFAULT TRUE,sort_order INT NOT NULL DEFAULT 0,stock INT NOT NULL DEFAULT 9999,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
 `);
 await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS orderer_name TEXT");
 await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS orderer_phone TEXT");
 await pool.query("ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_option TEXT");
 const defaultCats=["생활","디지털","패션","식품","뷰티","기타"]; for(let i=0;i<defaultCats.length;i++) await pool.query("INSERT INTO categories(name,active,sort_order) VALUES($1,TRUE,$2) ON CONFLICT(name) DO NOTHING",[defaultCats[i],i+1]);
 const pc=Number((await pool.query("SELECT COUNT(*)::int n FROM products")).rows[0].n);
 if(pc===0){for(const p of DEFAULT_PRODUCTS){await pool.query(`INSERT INTO products(id,name,price,shipping,shipping_text,category,description,detail,options,images,detail_images,youtube_url,active,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12,$13,$14)`,[p.id,p.name,p.price,p.shipping,p.shippingText,p.category,p.desc,p.detail,JSON.stringify(p.options),JSON.stringify(p.images),JSON.stringify(p.detailImages),p.youtube,p.active,p.sortOrder])}}
 console.log("DB tables ready");
}

async function ensureV16Schema(){
  if(!pool) return;
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS auto_deliver_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS auto_confirm_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS pending_expires_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INT NOT NULL DEFAULT 9999`);
}
async function applyAutomaticOrderStatuses(){
  if(!pool) return;
  await pool.query(`DELETE FROM orders WHERE order_status='PENDING' AND payment_status='PENDING' AND COALESCE(pending_expires_at,ordered_at+INTERVAL '6 hours') <= NOW()`);
  await pool.query(`UPDATE orders
    SET order_status='DELIVERED', delivered_at=COALESCE(delivered_at,NOW()),
        auto_confirm_at=COALESCE(auto_confirm_at,NOW()+INTERVAL '5 days')
    WHERE order_status='SHIPPED' AND shipped_at IS NOT NULL
      AND shipped_at <= NOW()-INTERVAL '3 days'`);
  await pool.query(`UPDATE orders
    SET order_status='CONFIRMED', confirmed_at=COALESCE(confirmed_at,NOW())
    WHERE order_status='DELIVERED' AND delivered_at IS NOT NULL
      AND delivered_at <= NOW()-INTERVAL '5 days'`);
}

function needKey(req,res,next){if(!PI_API_KEY)return res.status(500).json({ok:false,error:"PI_API_KEY missing"});next()}
function needDb(req,res,next){if(!pool)return res.status(503).json({ok:false,error:"DATABASE_URL missing"});next()}
const adminSessions=new Map();
function cookieValue(req,name){const raw=req.headers.cookie||"";for(const part of raw.split(";")){const [k,...v]=part.trim().split("=");if(k===name)return decodeURIComponent(v.join("="));}return "";}
function needAdmin(req,res,next){if(!ADMIN_KEY)return res.status(503).json({ok:false,error:"ADMIN_KEY missing"});const token=cookieValue(req,"blog24_admin_session");const exp=adminSessions.get(token);if(!token||!exp||exp<Date.now()){if(token)adminSessions.delete(token);return res.status(401).json({ok:false,error:"관리자 로그인이 필요합니다."});}adminSessions.set(token,Date.now()+8*60*60*1000);next();}
app.post("/api/admin/login",(req,res)=>{if(!ADMIN_KEY)return res.status(503).json({ok:false,error:"ADMIN_KEY missing"});if(String(req.body?.key||"")!==ADMIN_KEY)return res.status(401).json({ok:false,error:"관리자 키가 올바르지 않습니다."});const token=crypto.randomBytes(32).toString("hex");adminSessions.set(token,Date.now()+8*60*60*1000);res.setHeader("Set-Cookie",`blog24_admin_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`);res.json({ok:true});});
app.get("/api/admin/session",needAdmin,(req,res)=>res.json({ok:true}));
app.post("/api/admin/logout",needAdmin,(req,res)=>{const token=cookieValue(req,"blog24_admin_session");adminSessions.delete(token);res.setHeader("Set-Cookie","blog24_admin_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");res.json({ok:true});});
async function piPost(ep,body){
 const r=await fetch(PI_API_BASE+ep,{method:"POST",headers:{Authorization:`Key ${PI_API_KEY}`,"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
 const t=await r.text();let d;try{d=t?JSON.parse(t):{}}catch{d={raw:t}}
 if(!r.ok){const e=new Error(d?.error||d?.message||`Pi API HTTP ${r.status}`);e.status=r.status;e.data=d;throw e}return d;
}
app.get("/api/products",async(req,res)=>{let products=(await effectiveProducts()).filter(x=>x.active!==false);if(pool){try{const r=await pool.query("SELECT name FROM categories WHERE active=TRUE");const visible=new Set(r.rows.map(x=>x.name));products=products.filter(x=>visible.has(x.category));}catch(e){console.error(e.message)}}res.json({ok:true,products});});
app.get("/api/categories",async(req,res)=>{let categories=["생활","디지털","패션","식품","뷰티","기타"];if(pool){try{const r=await pool.query("SELECT name FROM categories WHERE active=TRUE ORDER BY sort_order,name");categories=r.rows.map(x=>x.name)}catch{}}res.json({ok:true,categories});});
app.get("/api/store-settings",async(req,res)=>{let settings={slideYoutube:"",shortsUrl:"",slidesJson:"[]",slideTime:"5",homeSectionsJson:"[]",footerText:"회사명: Blog24\n고객센터: 02-000-8282",copyright:"Copyright © 2026 Blog24. All rights reserved.",terms:"제1조(목적)\n본 약관은 Blog24 쇼핑몰의 서비스 이용 조건과 절차를 정합니다.\n\n제2조(주문 및 결제)\n상품 주문, 결제, 배송 및 취소는 화면에 표시된 절차와 관련 법령에 따릅니다.\n\n제3조(환불)\n환불 및 교환은 상품 특성과 관련 법령, 판매자가 고지한 기준에 따릅니다.",privacy:"Blog24는 주문 처리와 배송을 위해 필요한 범위에서 개인정보를 처리합니다.\n\n수집 항목: 주문자/수령인 이름, 연락처, 배송지, 주문 및 결제 식별정보\n이용 목적: 주문 확인, 결제 확인, 배송, 고객 문의 처리\n보유 기간: 관련 법령 및 운영상 필요한 기간 동안 보관 후 파기합니다.\n\n이 기본 문안은 운영자가 실제 사업 내용과 적용 법령에 맞게 검토·수정해야 합니다."};if(pool){try{const r=await pool.query("SELECT key,value FROM store_settings");for(const x of r.rows)settings[x.key]=x.value}catch{}}res.json({ok:true,settings});});
app.get("/api/admin/products",needDb,needAdmin,async(req,res)=>res.json({ok:true,products:await effectiveProducts()}));
app.get("/api/admin/categories",needDb,needAdmin,async(req,res)=>{const r=await pool.query("SELECT name,active,sort_order FROM categories ORDER BY sort_order,name");res.json({ok:true,categories:r.rows})});
app.post("/api/admin/categories",needDb,needAdmin,async(req,res)=>{try{const c=req.body||{};const old=String(c.oldName||c.name||'').trim(),name=String(c.name||'').trim();if(!name)return res.status(400).json({ok:false,error:'카테고리명을 입력하세요.'});if(old&&old!==name){await pool.query("UPDATE products SET category=$1 WHERE category=$2",[name,old]);await pool.query("DELETE FROM categories WHERE name=$1",[old]);}await pool.query("INSERT INTO categories(name,active,sort_order,updated_at) VALUES($1,$2,$3,NOW()) ON CONFLICT(name) DO UPDATE SET active=EXCLUDED.active,sort_order=EXCLUDED.sort_order,stock=EXCLUDED.stock,updated_at=NOW()",[name,c.active!==false,Number(c.sortOrder)||0]);res.json({ok:true})}catch(e){res.status(500).json({ok:false,error:e.message})}});
app.delete("/api/admin/categories/:name",needDb,needAdmin,async(req,res)=>{const name=decodeURIComponent(req.params.name);const n=Number((await pool.query("SELECT COUNT(*)::int n FROM products WHERE category=$1",[name])).rows[0].n);if(n)return res.status(400).json({ok:false,error:`등록 상품 ${n}개가 있어 삭제할 수 없습니다. 숨김을 사용하세요.`});await pool.query("DELETE FROM categories WHERE name=$1",[name]);res.json({ok:true})});
app.post("/api/admin/products",needDb,needAdmin,async(req,res)=>{try{const p=req.body||{};const id=Number(p.id)||Number((await pool.query("SELECT COALESCE(MAX(id),0)+1 id FROM products")).rows[0].id);await pool.query(`INSERT INTO products(id,name,price,shipping,shipping_text,category,description,detail,options,images,detail_images,youtube_url,active,sort_order,stock,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12,$13,$14,$15,NOW()) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,price=EXCLUDED.price,shipping=EXCLUDED.shipping,shipping_text=EXCLUDED.shipping_text,category=EXCLUDED.category,description=EXCLUDED.description,detail=EXCLUDED.detail,options=EXCLUDED.options,images=EXCLUDED.images,detail_images=EXCLUDED.detail_images,youtube_url=EXCLUDED.youtube_url,active=EXCLUDED.active,sort_order=EXCLUDED.sort_order,stock=EXCLUDED.stock,updated_at=NOW()`,[id,p.name||'상품',Number(p.price)||0,Number(p.shipping)||0,p.shippingText||'',p.category||'기타',p.desc||'',p.detail||'',JSON.stringify(p.options||['기본']),JSON.stringify(p.images||[]),JSON.stringify(p.detailImages||[]),p.youtube||'',p.active!==false,Number(p.sortOrder)||id,Number.isFinite(Number(p.stock))?Math.max(0,Math.floor(Number(p.stock))):9999]);res.json({ok:true,id})}catch(e){res.status(500).json({ok:false,error:e.message})}});
app.get("/api/admin/products/:id/delete-check",needDb,needAdmin,async(req,res)=>{const id=Number(req.params.id);const r=await pool.query("SELECT COUNT(DISTINCT order_id)::int n FROM order_items WHERE product_id=$1",[id]);res.json({ok:true,orderCount:Number(r.rows[0]?.n||0)})});
app.delete("/api/admin/products/:id",needDb,needAdmin,async(req,res)=>{await pool.query("DELETE FROM products WHERE id=$1",[Number(req.params.id)]);res.json({ok:true})});
app.post("/api/admin/seed-products",needDb,needAdmin,async(req,res)=>{try{for(const p of DEFAULT_PRODUCTS){await pool.query(`INSERT INTO products(id,name,price,shipping,shipping_text,category,description,detail,options,images,detail_images,youtube_url,active,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12,$13,$14) ON CONFLICT(id) DO NOTHING`,[p.id,p.name,p.price,p.shipping,p.shippingText,p.category,p.desc,p.detail,JSON.stringify(p.options),JSON.stringify(p.images),JSON.stringify(p.detailImages),p.youtube,p.active,p.sortOrder])}res.json({ok:true})}catch(e){res.status(500).json({ok:false,error:e.message})}});
app.post("/api/admin/store-settings",needDb,needAdmin,async(req,res)=>{try{for(const [k,v] of Object.entries(req.body||{})){if(!['slideYoutube','shortsUrl','slidesJson','slideTime','homeSectionsJson','footerText','copyright','terms','privacy'].includes(k))continue;await pool.query("INSERT INTO store_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()",[k,String(v||'')])}res.json({ok:true})}catch(e){res.status(500).json({ok:false,error:e.message})}});

app.get("/health",(req,res)=>res.json({ok:true,app:"Blog24",network:"Pi Testnet",piApiConfigured:!!PI_API_KEY,databaseConfigured:!!pool}));

app.post("/api/orders/draft",needDb,async(req,res)=>{
 try{
  const {orderId,username,uid,shipping,items}=req.body||{};
  if(!orderId||!shipping?.recipientName||!shipping?.phone||!shipping?.address||!items?.length)
   return res.status(400).json({ok:false,error:"주문/배송 정보가 부족합니다."});
  let itemTotal=0,shippingTotal=0; const verified=[];
  for(const x of items){
   const p=await effectiveProduct(Number(x.id)); if(!p||p.active===false)return res.status(400).json({ok:false,error:"판매중이 아닌 상품입니다."}); if(Number(p.stock)<Number(x.qty||1))return res.status(409).json({ok:false,error:`${p.name} 재고가 부족합니다.`});
   const qty=Math.max(1,Math.min(99,Number(x.qty)||1)), option=String(x.option||"기본").slice(0,100);
   itemTotal+=p.price*qty; shippingTotal+=p.shipping*qty; verified.push({...p,qty,option});
  }
  const total=Number((itemTotal+shippingTotal).toFixed(7)),c=await pool.connect();
  try{await c.query("BEGIN");
   await c.query(`INSERT INTO orders(order_id,pi_username,pi_uid,orderer_name,orderer_phone,recipient_name,phone,postal_code,address,address_detail,delivery_memo,item_total,shipping_total,paid_total,pending_expires_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW()+INTERVAL '6 hours') ON CONFLICT(order_id) DO NOTHING`,
    [orderId,username||null,uid||null,shipping.ordererName||null,shipping.ordererPhone||null,shipping.recipientName,shipping.phone,shipping.postalCode||null,shipping.address,shipping.addressDetail||null,shipping.deliveryMemo||null,itemTotal,shippingTotal,total]);
   const exists=await c.query("SELECT COUNT(*)::int n FROM order_items WHERE order_id=$1",[orderId]);
   if(Number(exists.rows[0].n)===0) for(const p of verified) await c.query(`INSERT INTO order_items(order_id,product_id,product_name,product_option,quantity,unit_price,shipping_fee)
    VALUES($1,$2,$3,$4,$5,$6,$7)`,[orderId,p.id,p.name,p.option,p.qty,p.price,p.shipping]);
   await c.query("COMMIT");
  }catch(e){await c.query("ROLLBACK");throw e}finally{c.release()}
  res.json({ok:true,orderId,amount:total,itemTotal:Number(itemTotal.toFixed(7)),shippingTotal:Number(shippingTotal.toFixed(7))});
 }catch(e){console.error(e);res.status(500).json({ok:false,error:e.message})}
});

app.post("/api/pi/payments/:paymentId/approve",needKey,async(req,res)=>{
 try{const id=req.params.paymentId;const payment=await piPost(`/v2/payments/${encodeURIComponent(id)}/approve`);console.log("Pi APPROVE success:",id);res.json({ok:true,payment})}
 catch(e){console.error("Pi approve error:",e.data||e);res.status(e.status||500).json({ok:false,error:e.message})}
});
app.post("/api/pi/payments/:paymentId/complete",needKey,async(req,res)=>{
 try{
  const id=req.params.paymentId,{txid,orderId}=req.body||{};if(!txid)return res.status(400).json({ok:false,error:"txid required"});
  const payment=await piPost(`/v2/payments/${encodeURIComponent(id)}/complete`,{txid});
  if(payment?.status?.transaction_verified!==true||payment?.status?.developer_completed!==true)
   return res.status(409).json({ok:false,error:"Payment not verified/completed",payment});
  if(pool&&orderId){
   const q=await pool.query("SELECT paid_total FROM orders WHERE order_id=$1",[orderId]);
   if(!q.rows.length)return res.status(404).json({ok:false,error:"주문을 찾을 수 없습니다."});
   if(Math.abs(Number(q.rows[0].paid_total)-Number(payment.amount))>0.0000001)
    return res.status(409).json({ok:false,error:"주문금액과 Pi 결제금액이 다릅니다."});
   await pool.query("UPDATE orders SET payment_id=$1,txid=$2,payment_status='PAID',order_status='PAID' WHERE order_id=$3",[id,txid,orderId]);
  }
  console.log("Pi PAYMENT COMPLETE SUCCESS:",id,txid,payment.amount);res.json({ok:true,payment});
 }catch(e){console.error("Pi complete error:",e.data||e);res.status(e.status||500).json({ok:false,error:e.message})}
});


app.get("/api/orders/mine",needDb,async(req,res)=>{
 try{await applyAutomaticOrderStatuses();}catch(e){console.error(e)}
 try{
  const uid=String(req.query.uid||"").trim();
  if(!uid)return res.status(400).json({ok:false,error:"uid required"});
  const r=await pool.query(`SELECT o.*,COALESCE(json_agg(json_build_object('id',i.id,'productId',i.product_id,'productName',i.product_name,'option',i.product_option,'quantity',i.quantity,'unitPrice',i.unit_price,'shippingFee',i.shipping_fee,'itemStatus',i.item_status) ORDER BY i.id) FILTER (WHERE i.id IS NOT NULL),'[]') items FROM orders o LEFT JOIN order_items i ON i.order_id=o.order_id WHERE o.pi_uid=$1 GROUP BY o.id ORDER BY o.ordered_at DESC LIMIT 100`,[uid]);
  res.json({ok:true,orders:r.rows});
 }catch(e){console.error(e);res.status(500).json({ok:false,error:e.message})}
});

app.get("/api/orders/:orderId",needDb,async(req,res)=>{
 try{await applyAutomaticOrderStatuses();}catch(e){console.error(e)}
 try{const uid=String(req.query.uid||"").trim();if(!uid)return res.status(400).json({ok:false,error:"uid required"});
  const o=await pool.query("SELECT * FROM orders WHERE order_id=$1 AND pi_uid=$2",[req.params.orderId,uid]);if(!o.rows.length)return res.status(404).json({ok:false,error:"주문을 찾을 수 없습니다."});
  const i=await pool.query("SELECT * FROM order_items WHERE order_id=$1 ORDER BY id",[req.params.orderId]);res.json({ok:true,order:{...o.rows[0],items:i.rows}});
 }catch(e){res.status(500).json({ok:false,error:e.message})}
});

app.get("/api/admin/orders",needDb,needAdmin,async(req,res)=>{
  await applyAutomaticOrderStatuses();
  const status=(req.query.status||"ALL").toUpperCase();
  const allowed=["ALL","PAID","PREPARING","SHIPPED","DELIVERED","CONFIRMED","CANCELLED","REFUND_REQUESTED","REFUNDED"];
  if(!allowed.includes(status)) return res.status(400).json({ok:false,error:"잘못된 상태"});
  const sql=status==="ALL"
    ? "SELECT * FROM orders ORDER BY ordered_at DESC LIMIT 1000"
    : "SELECT * FROM orders WHERE order_status=$1 ORDER BY ordered_at DESC LIMIT 1000";
  const r=await pool.query(sql,status==="ALL"?[]:[status]);
  const counts=(await pool.query(`SELECT order_status,COUNT(*)::int count FROM orders GROUP BY order_status`)).rows;
  res.json({ok:true,orders:r.rows,counts});
});
app.post("/api/admin/orders/:orderId/preparing",needDb,needAdmin,async(req,res)=>{
 const q=await pool.query("UPDATE orders SET order_status='PREPARING',preparing_at=NOW() WHERE order_id=$1 AND order_status IN ('PAID','PENDING') RETURNING order_id,order_status",[req.params.orderId]);
 if(!q.rows.length)return res.status(409).json({ok:false,error:"결제완료 주문만 상품준비 처리할 수 있습니다."});
 res.json({ok:true,order:q.rows[0]});
});
app.post("/api/admin/orders/:orderId/ship",needDb,needAdmin,async(req,res)=>{
 const {courier,trackingNumber}=req.body||{};if(!trackingNumber)return res.status(400).json({ok:false,error:"송장번호 필요"});
 await pool.query("UPDATE orders SET order_status='SHIPPED',courier=$1,tracking_number=$2,shipped_at=NOW(),auto_deliver_at=NOW()+INTERVAL '3 days' WHERE order_id=$3",[courier||null,trackingNumber,req.params.orderId]);res.json({ok:true});
});
app.post("/api/admin/orders/:orderId/delivered",needDb,needAdmin,async(req,res)=>{const q=await pool.query("UPDATE orders SET order_status='DELIVERED',delivered_at=NOW(),auto_confirm_at=NOW()+INTERVAL '5 days' WHERE order_id=$1 AND order_status='SHIPPED' RETURNING order_id",[req.params.orderId]);if(!q.rows.length)return res.status(409).json({ok:false,error:'배송중 주문만 배송완료 처리할 수 있습니다.'});res.json({ok:true});});
app.post("/api/refunds/request",needDb,async(req,res)=>{
 try{
  const {orderId,orderItemId,refundWallet,reason}=req.body||{};if(!orderId||!refundWallet)return res.status(400).json({ok:false,error:"주문번호/환불지갑 필요"});
  let pa=0,sa=0,type="FULL";
  if(orderItemId){type="PARTIAL";const r=await pool.query("SELECT unit_price,quantity,shipping_fee FROM order_items WHERE id=$1 AND order_id=$2",[orderItemId,orderId]);if(!r.rows.length)return res.status(404).json({ok:false,error:"주문상품 없음"});pa=Number(r.rows[0].unit_price)*Number(r.rows[0].quantity);sa=Number(r.rows[0].shipping_fee)*Number(r.rows[0].quantity)}
  else{const r=await pool.query("SELECT item_total,shipping_total FROM orders WHERE order_id=$1",[orderId]);if(!r.rows.length)return res.status(404).json({ok:false,error:"주문 없음"});pa=Number(r.rows[0].item_total);sa=Number(r.rows[0].shipping_total)}
  const amount=Number((pa+sa).toFixed(7)),rid=`RF-${Date.now()}`;
  await pool.query(`INSERT INTO refunds(refund_id,order_id,order_item_id,refund_type,product_amount,shipping_amount,refund_amount,refund_wallet,reason)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[rid,orderId,orderItemId||null,type,pa,sa,amount,refundWallet,reason||null]);
  res.json({ok:true,refundId:rid,refundAmount:amount});
 }catch(e){res.status(500).json({ok:false,error:e.message})}
});
app.post("/api/admin/refunds/:refundId/approve",needDb,needAdmin,async(req,res)=>{
 await pool.query("UPDATE refunds SET status='APPROVED',approved_at=NOW() WHERE refund_id=$1",[req.params.refundId]);res.json({ok:true});
});
app.post("/api/admin/refunds/:refundId/complete",needDb,needAdmin,async(req,res)=>{
 const {txid}=req.body||{};if(!txid)return res.status(400).json({ok:false,error:"환불 TXID 필요"});
 await pool.query("UPDATE refunds SET status='REFUNDED',refund_txid=$1,refunded_at=NOW() WHERE refund_id=$2",[txid,req.params.refundId]);res.json({ok:true});
});
app.get("/api/admin/stats",needDb,needAdmin,async(req,res)=>{
 const s=(await pool.query(`SELECT
 COALESCE(SUM(paid_total) FILTER(WHERE payment_status='PAID' AND ordered_at::date=CURRENT_DATE),0) day_sales,
 COALESCE(SUM(paid_total) FILTER(WHERE payment_status='PAID' AND date_trunc('month',ordered_at)=date_trunc('month',NOW())),0) month_sales,
 COALESCE(SUM(paid_total) FILTER(WHERE payment_status='PAID' AND date_trunc('year',ordered_at)=date_trunc('year',NOW())),0) year_sales,
 COALESCE(SUM(paid_total) FILTER(WHERE payment_status='PAID'),0) gross_sales FROM orders`)).rows[0];
 const refunded=Number((await pool.query("SELECT COALESCE(SUM(refund_amount) FILTER(WHERE status='REFUNDED'),0) refunded FROM refunds")).rows[0].refunded);
 res.json({ok:true,...s,refunded,net_sales:Number(s.gross_sales)-refunded});
});
app.get("/admin",(req,res)=>res.sendFile(path.join(__dirname,"public","admin.html")));

app.post("/api/orders/:orderId/confirm",needDb,async(req,res)=>{
  const {username}=req.body||{};
  const q=await pool.query("SELECT * FROM orders WHERE order_id=$1",[req.params.orderId]);
  if(!q.rows.length) return res.status(404).json({ok:false,error:"주문 없음"});
  const o=q.rows[0];
  if(username && o.pi_username && username!==o.pi_username) return res.status(403).json({ok:false,error:"주문자 불일치"});
  if(o.order_status!=="DELIVERED") return res.status(409).json({ok:false,error:"배송완료 주문만 구매확정할 수 있습니다."});
  await pool.query("UPDATE orders SET order_status='CONFIRMED',confirmed_at=NOW() WHERE order_id=$1",[req.params.orderId]);
  res.json({ok:true});
});

app.get("/api/admin/orders-export.csv",needDb,needAdmin,async(req,res)=>{
  await applyAutomaticOrderStatuses();
  const status=(req.query.status||"ALL").toUpperCase();
  const args=status==="ALL"?[]:[status];
  const where=status==="ALL"?"":"WHERE o.order_status=$1";
  const q=await pool.query(`SELECT o.order_id,o.ordered_at,o.pi_username,o.recipient_name,o.phone,
    o.postal_code,o.address,o.address_detail,o.item_total,o.shipping_total,o.paid_total,o.order_status,
    o.courier,o.tracking_number,o.payment_id,o.txid,
    COALESCE(string_agg(oi.product_name||' x'||oi.quantity, ', '),'') products
    FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.order_id
    ${where} GROUP BY o.id ORDER BY o.ordered_at DESC`,args);
  const heads=["주문번호","주문일시","Pi사용자","수령인","전화번호","우편번호","주소","상세주소","상품","상품금액","배송비","결제금액","상태","택배사","송장번호","Payment ID","TXID"];
  const esc=v=>`"${String(v??"").replace(/"/g,'""')}"`;
  const rows=q.rows.map(o=>[o.order_id,o.ordered_at,o.pi_username,o.recipient_name,o.phone,o.postal_code,o.address,o.address_detail,o.products,o.item_total,o.shipping_total,o.paid_total,o.order_status,o.courier,o.tracking_number,o.payment_id,o.txid].map(esc).join(","));
  res.setHeader("Content-Type","text/csv; charset=utf-8");
  res.setHeader("Content-Disposition",`attachment; filename="blog24-orders-${status}.csv"`);
  res.send("\uFEFF"+heads.map(esc).join(",")+"\n"+rows.join("\n"));
});

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,"0.0.0.0",async()=>{console.log(`Blog24 running on port ${PORT}`);console.log(`Pi API configured: ${!!PI_API_KEY}`);console.log(`Database configured: ${!!pool}`);console.log(`Admin configured: ${!!ADMIN_KEY}`);try{await initDb();await ensureV16Schema();await applyAutomaticOrderStatuses()}catch(e){console.error("DB init failed:",e)}});
