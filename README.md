# Blog24 Pi Shopping Mall V1.0

Pi Browser용 쇼핑몰 시작 프로젝트입니다.

## 로컬 실행

1. Node.js 18 이상 설치
2. 프로젝트 폴더에서:
   npm install
   npm start
3. 브라우저에서 http://localhost:3000

## Render

- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/health`

## Pi SDK

현재 V1.0은 Pi SDK를 로드하고 Testnet sandbox 초기화 구조를 포함합니다.
실제 결제 완료/승인 서버 API는 다음 단계에서 Pi Developer 설정 및 API Key와 함께 연결합니다.

중요: API Key, Secret Seed 등 비밀값을 public 폴더나 GitHub에 올리지 마세요.


## V1.2
주문/배송정보, PostgreSQL 주문 DB, 배송상태 기반, 전체/부분환불 기록, 환불지갑/TXID, 일·월·년·총매출/환불/순매출 API 기반 추가.
Render PostgreSQL 생성 후 Web Service에 DATABASE_URL 환경변수를 등록해야 주문 DB 기능이 활성화됩니다.
