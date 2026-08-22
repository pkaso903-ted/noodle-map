# 🍜 면요리 지도 (Noodle Map)

연남 · 홍대 · 합정 · 망원 일대 라멘/면요리 맛집 지도 웹앱.

- **데이터**: 네이버 지도 기준 112곳 (라멘 · 우동/소바 · 국수/면 · 칼국수 · 냉면/막국수)
- **정보**: 영업시간(요일별·브레이크·임시휴무), 대표메뉴 가격, 네이버 평점/리뷰수, 미쉐린 가이드, 방송 출연 이력
- **평가표**: 국물 / 면 / 토핑 / 가성비 / 재방문 5개 항목 × 5점 → 100점 환산 (브라우저 localStorage 저장)
- **모바일 최적화 + PWA**: 홈 화면에 추가하면 앱처럼 실행

## 네이버 지도 API 연결

`config.js` 파일의 `naverKeyId` 에 네이버 클라우드 플랫폼에서 발급받은
Maps **Client ID(ncpKeyId)** 를 넣으면 네이버 지도로 동작합니다.
비워두면 OpenStreetMap으로 동작합니다.

```js
window.NOODLE_CONFIG = { naverKeyId: '발급받은키' };
```

발급 경로: 네이버 클라우드 플랫폼 → Services → **Maps** → Application 등록 →
Web Dynamic Map 체크 → 서비스 URL에 `https://pkaso903-ted.github.io` 등록

## 데이터 갱신

`data.json` 하나만 교체하면 됩니다. 구조:

```
{ updated, count, places: [{ id, n(이름), g(장르), a(지역), cat, ad, rd, x, y,
  sc(평점), vr(방문리뷰), br(블로그리뷰), mi(한줄), ph(전화), kw(키워드),
  h(영업시간), m(메뉴), mich(미쉐린), tv(방송), img }] }
```

`id` 는 네이버 지도 place ID이며 `https://map.naver.com/p/entry/place/{id}` 로 바로 연결됩니다.

## 주의

평점·리뷰수·영업시간·메뉴가격은 수집 시점(2026-08-22) 기준이라 실제와 다를 수 있습니다.
방문 전 네이버 지도에서 확인하세요.
