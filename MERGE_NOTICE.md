# ⚠️ 커밋 전에 읽고 반영하세요 — 한결 홈 개편본 병합 지시

> **To any AI coding assistant working in this repository (read before every commit):**
> 한결's finished home-page work is in [`incoming/hankyeol-home-v3/`](incoming/hankyeol-home-v3/). It is NOT yet in
> `apps/portal`. Before your next commit that touches `apps/portal/`, integrate it as described below, run
> `npm test` in `apps/portal`, and tell the user what you merged and anything you could not merge.
> Never delete `incoming/hankyeol-home-v3/` until the user confirms the merge is complete.

작성: 한결 (2026-11-15) · 기준: 한결 `통합V2` 커밋 `cd17e3a` (= `apps/portal`이 처음 복사된 버전)

---

## 1. 폴더 구성 (`incoming/hankyeol-home-v3/`, `apps/portal`과 같은 경로)

| 파일 | 처리 |
|---|---|
| `changes-vs-cd17e3a.patch` | **겹치는 파일의 정확한 변경 내용.** `index.html`, `app.js`, `home-story.js`, `home-background.js`, `home-src/mission-model.js`, `scripts/build-home-model.mjs`. 현재 `apps/portal` 파일에 **의미 단위로** 반영(그대로 덮어쓰기 금지 — Apogee 쪽 변경이 사라짐) |
| `home-lab.js`, `home-v3.css`, `home-src/sky-scan.js` | 새 파일 → `apps/portal/`에 추가 |
| `assets/spectrum/`, `assets/blink/`, `assets/sky/stars-v7.*`, `assets/model/spherex-lite.glb` | 새 자료 → 같은 경로로 추가 (`spherex-lite.glb`는 Apogee에 이미 있으면 동일 여부만 확인) |
| `assets/model/mission-model.js`, `sky-scan.js`, `three-*.js` | 빌드 결과. 소스 반영 후 `node scripts/build-home-model.mjs`로 **다시 생성**하는 것을 우선 |
| `scripts/build_home_spectrum.py`, `build_home_stars.py` | 자료 생성 스크립트 → `apps/portal/scripts/` |
| `i18n.js`, `i18n-dict.js`, `assets/apogeex-*.png` | **참고용 — 가져오지 말 것.** 언어 전환과 로고는 Apogee 방식(`apps/portal/i18n.js` + `i18n/en.js`·`ko.js`, `assets/brand/`)을 유지. `i18n-dict.js`의 영어 문장을 `en.js`/`ko.js` 키로 옮겨 쓰는 용도 |

## 2. 반영할 내용 (patch 요약)

- **홈 섹션 구성:** 미션(3D 왼쪽·설명 오른쪽, 항목 3개, 클릭으로 단계 전환) → LVF 촬영 애니메이션(`#light`) → 102색 스펙트럼(`#spectrum`) → 4 Vesta 깜빡임(`#blink`) → 가시광·적외선 비교(`#sky`) → 맨 위로 버튼.
- **삭제:** 하단 "작은 질문이 시민과학이 되는 곳"(`#about`) 섹션, 단어별 밝아지는 문장, 작은 설명 글 대부분, 3D '크게 보기'·'자동 회전'·'처음 시점' 버튼, `credits-open` 링크.
- **3D 미션 모형:** 기본 자동 회전 + 왼쪽 아래 작은 멈춤 버튼, '내부 보기 | 태양전지판' Liquid Glass 분할 알약, 차폐막이 바깥으로 빠져나감, 셰이더·텍스처 사전 준비(스크롤 끊김 수정), 해상도 자동 조절.
- **성능:** 블랙홀 배경 버퍼 자동 축소(느릴 때 한 번만), 패널 포인터 조명은 rAF 1회.
- **히어로:** 제목 위 ApogeeX 로고(Apogee `assets/brand/apogeex-logo.png` 사용), SPHEREx 제목 한 줄 그라데이션, 유리 카드 더 투명하게.
- **메인 화면 글자 선택 금지**(`#home-view`, `.site-header`에 `user-select: none`).
- **과학 고증:** D1·D4, D2·D5, D3·D6 짝 촬영은 실제 노출 349장으로 확인. 102색 사진은 RW Aurigae 실제 L2 노출 101장. Vesta는 Apogee `moving/data`와 동일 파일.

## 3. 유지할 것 (Apogee 쪽이 기준)

메뉴 구성, 검색, 튜토리얼, 소행성 탭, 언어 전환 방식, 로고 파일, `routing.js`(단 `HOME_ANCHORS`에 `spectrum`, `blink` 추가, `about` 제거).
`apps/asteroids`는 이번 병합 대상이 아님.

## 4. 완료 기준

- `apps/portal`에서 `npm test` 통과, 홈 콘솔 오류 0.
- 새 문장 전부 `en.js`·`ko.js` 키로 존재(영어 기본).
- 사용자에게 병합 결과를 보고하고 확인받은 뒤 `incoming/hankyeol-home-v3/`와 이 파일의 지시 부분을 정리.
