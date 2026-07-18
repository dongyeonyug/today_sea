# 오늘의 바다

공식 해양 데이터를 바탕으로 지금 물놀이와 갯벌체험이 가능한지 `가능`, `주의`, `불가`로 판정하는 Next.js 앱입니다.

## Features

- 물놀이: 파고, 수온, 기상특보, 이안류, 해수욕지수 기반 판정
- 갯벌체험: 조석, 갯벌체험지수, 기상특보 기반 판정
- 시간대별 종합 위험도와 갯벌 물때 곡선
- 판정 근거만 사용하는 안전 챗봇

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

필수 환경변수:

- `ANTHROPIC_API_KEY`
- `DATA_GO_KR_SERVICE_KEY`

## Scripts

```bash
npm run build
npm run verify:sources
npm run verify:verdict
npm run verify:chat
```
