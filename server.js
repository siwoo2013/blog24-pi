const express=require("express");
const path=require("path");
const {Pool}=require("pg");
const app=express();
const PORT=process.env.PORT||3000;
const PI_API_KEY=process.env.PI_API_KEY;
const PI_API_BASE="https://api.minepi.com";
const ADMIN_KEY=process.env.ADMIN_KEY||"";
const pool=process.env.DATABASE_URL?new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}):null;

app.use(express.json());
app.use(express.static(path.join(__dirname,"public")));

const PRODUCTS=[
 {id:1,name:"Blog24 머그컵",price:1.2,shipping:0},
 {id:2,name:"Pi 데스크 패드",price:2.5,shipping:0},
 {id:3,name:"스마트 파우치",price:3.8,shipping:0},
 {id:4,name:"Blog24 노트",price:0.8,shipping:0},
 {id:5,name:"휴대폰 거치대",price:1.6,shipping:0},
 {id:6,name:"테스트 상품",price:0.1,shipping:0}
];

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
 `);
 await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS orderer_name TEXT");
 await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS orderer_phone TEXT");
 console.log("DB tables ready");
}
function needKey(req,res,next){if(!PI_API_KEY)return res.status(500).json({ok:false,error:"PI_API_KEY missing"});next()}
function needDb(req,res,next){if(!pool)return res.status(503).json({ok:false,error:"DATABASE_URL missing"});next()}
function needAdmin(req,res,next){if(!ADMIN_KEY)return res.status(503).json({ok:false,error:"ADMIN_KEY missing"});const key=req.get("x-admin-key")||req.query.adminKey;if(key!==ADMIN_KEY)return res.status(401).json({ok:false,error:"관리자 인증 실패"});next()}
async function piPost(ep,body){
 const r=await fetch(PI_API_BASE+ep,{method:"POST",headers:{Authorization:`Key ${PI_API_KEY}`,"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
 const t=await r.text();let d;try{d=t?JSON.parse(t):{}}catch{d={raw:t}}
 if(!r.ok){const e=new Error(d?.error||d?.message||`Pi API HTTP ${r.status}`);e.status=r.status;e.data=d;throw e}return d;
}
app.get("/health",(req,res)=>res.json({ok:true,app:"Blog24",network:"Pi Testnet",piApiConfigured:!!PI_API_KEY,databaseConfigured:!!pool}));

app.post("/api/orders/draft",needDb,async(req,res)=>{
 try{
  const {orderId,username,uid,shipping,items}=req.body||{};
  if(!orderId||!shipping?.recipientName||!shipping?.phone||!shipping?.address||!items?.length)
   return res.status(400).json({ok:false,error:"주문/배송 정보가 부족합니다."});
  const counts={}; for(const x of items) counts[x.id]=(counts[x.id]||0)+1;
  let itemTotal=0,shippingTotal=0; const verified=[];
  for(const [id0,qty] of Object.entries(counts)){
   const p=PRODUCTS.find(x=>x.id===Number(id0)); if(!p)return res.status(400).json({ok:false,error:"잘못된 상품입니다."});
   itemTotal+=p.price*qty; shippingTotal+=p.shipping*qty; verified.push({...p,qty});
  }
  const total=Number((itemTotal+shippingTotal).toFixed(7)); const c=await pool.connect();
  try{await c.query("BEGIN");
   await c.query(`INSERT INTO orders(order_id,pi_username,pi_uid,orderer_name,orderer_phone,recipient_name,phone,postal_code,address,address_detail,delivery_memo,item_total,shipping_total,paid_total)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT(order_id) DO NOTHING`,
    [orderId,username||null,uid||null,shipping.ordererName||null,shipping.ordererPhone||null,shipping.recipientName,shipping.phone,shipping.postalCode||null,shipping.address,shipping.addressDetail||null,shipping.deliveryMemo||null,itemTotal,shippingTotal,total]);
   for(const p of verified) await c.query(`INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price,shipping_fee)
    VALUES($1,$2,$3,$4,$5,$6)`,[orderId,p.id,p.name,p.qty,p.price,p.shipping]);
   await c.query("COMMIT");
  }catch(e){await c.query("ROLLBACK");throw e}finally{c.release()}
  res.json({ok:true,orderId,amount:total});
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
 try{
  const uid=String(req.query.uid||"").trim();
  if(!uid)return res.status(400).json({ok:false,error:"uid required"});
  const r=await pool.query(`SELECT o.*,COALESCE(json_agg(json_build_object('id',i.id,'productId',i.product_id,'productName',i.product_name,'quantity',i.quantity,'unitPrice',i.unit_price,'shippingFee',i.shipping_fee,'itemStatus',i.item_status) ORDER BY i.id) FILTER (WHERE i.id IS NOT NULL),'[]') items FROM orders o LEFT JOIN order_items i ON i.order_id=o.order_id WHERE o.pi_uid=$1 GROUP BY o.id ORDER BY o.ordered_at DESC LIMIT 100`,[uid]);
  res.json({ok:true,orders:r.rows});
 }catch(e){console.error(e);res.status(500).json({ok:false,error:e.message})}
});

app.get("/api/orders/:orderId",needDb,async(req,res)=>{
 try{const uid=String(req.query.uid||"").trim();if(!uid)return res.status(400).json({ok:false,error:"uid required"});
  const o=await pool.query("SELECT * FROM orders WHERE order_id=$1 AND pi_uid=$2",[req.params.orderId,uid]);if(!o.rows.length)return res.status(404).json({ok:false,error:"주문을 찾을 수 없습니다."});
  const i=await pool.query("SELECT * FROM order_items WHERE order_id=$1 ORDER BY id",[req.params.orderId]);res.json({ok:true,order:{...o.rows[0],items:i.rows}});
 }catch(e){res.status(500).json({ok:false,error:e.message})}
});

app.get("/api/admin/orders",needDb,needAdmin,async(req,res)=>{const r=await pool.query("SELECT * FROM orders ORDER BY ordered_at DESC LIMIT 500");res.json({ok:true,orders:r.rows})});
app.post("/api/admin/orders/:orderId/preparing",needDb,needAdmin,async(req,res)=>{
 await pool.query("UPDATE orders SET order_status='PREPARING',preparing_at=NOW() WHERE order_id=$1",[req.params.orderId]);res.json({ok:true});
});
app.post("/api/admin/orders/:orderId/ship",needDb,needAdmin,async(req,res)=>{
 const {courier,trackingNumber}=req.body||{};if(!trackingNumber)return res.status(400).json({ok:false,error:"송장번호 필요"});
 await pool.query("UPDATE orders SET order_status='SHIPPED',courier=$1,tracking_number=$2,shipped_at=NOW() WHERE order_id=$3",[courier||null,trackingNumber,req.params.orderId]);res.json({ok:true});
});
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
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,"0.0.0.0",async()=>{console.log(`Blog24 running on port ${PORT}`);console.log(`Pi API configured: ${!!PI_API_KEY}`);console.log(`Database configured: ${!!pool}`);console.log(`Admin configured: ${!!ADMIN_KEY}`);try{await initDb()}catch(e){console.error("DB init failed:",e)}});
