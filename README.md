# Blog24 Pi Shopping V1.5.0

V1.4.0 기반 다음 단계 버전업:
- 기존 상품 상세/옵션/수량/공유/정보 기억하기 유지
- 기존 Pi Testnet 결제 승인/완료 로직 유지
- 결제 완료 주문 DB 기록 및 Payment ID/TXID 유지
- Pi 로그인 후 `주문내역` 버튼 표시
- 내 주문내역: 주문번호/상태/상품/금액/송장/Payment ID/TXID 조회
- `/admin` 관리자 주문관리 화면 추가
- 관리자 매출 요약(오늘/월/연/총/순매출)
- 관리자 상품준비 처리 및 택배사/송장 등록
- 관리자 API 보호용 `ADMIN_KEY` 환경변수 추가

## Render 환경변수
기존 `PI_API_KEY`, `DATABASE_URL` 유지 후 `ADMIN_KEY`를 새로 추가하세요.
예: 충분히 긴 임의 문자열. 관리자 화면 `/admin`에서 같은 값을 입력합니다.

## 배포
GitHub 기존 프로젝트에 덮어쓴 뒤 Render 재배포.
