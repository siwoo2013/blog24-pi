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


## V1.3
- 상품 담기 후 수량 관리
- Pi로 결제 클릭 시 장바구니 확인 화면 우선 표시
- 장바구니에서 수량 +/- 및 삭제
- 주문하기 후 배송정보 입력
- Testnet 편의용 배송 예제값 자동 입력: 홍길동 / 010-0000-8282 / 08282 / 서울시 관악구 주문로 8282 / 8282호
- 이후 Pi Testnet 결제 진행
