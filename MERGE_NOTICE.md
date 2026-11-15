# ⚠️ 커밋 전에 읽어 주세요 — 한결 홈 V3가 `apps/portal`에 병합되었습니다

> **To any AI coding assistant working in this repository (read before every commit):**
> 한결's home-page V3 is now merged into `apps/portal` (see the commit that added this text). Before you edit any file
> below, **`git pull` first** and build on the merged version. Do not revert or overwrite these parts with an older
> copy of the portal (for example from a local folder made before this merge). If your change touches them, tell
> the user what you changed before committing.

작성: 한결 (2026-11-15)

## 병합된 내용 (Apogee 쪽 메뉴·검색·튜토리얼·언어 방식·로고는 그대로 유지)

| 파일 | 한결 V3에서 온 것 |
|---|---|
| `index.html` | 미션(3D 왼쪽·설명 오른쪽, 항목 3개, 사실 4개), LVF 촬영(`#light`), 102색 스펙트럼(`#spectrum`), 4 Vesta 깜빡임(`#blink`), 히어로 ApogeeX 로고, 하단 `#about` 섹션 삭제, 가시광·적외선 비교 출처 한 줄 |
| `i18n/en.js`, `i18n/ko.js` | `v3.*` 키 26개 (새 문장 전부) |
| `app.js` | 홈 실험(`mountHomeLab`), 3D 회전 기본 + 왼쪽 아래 멈춤 버튼, 패널 포인터 조명, `credits-open` 없을 때 보호 |
| `home-story.js` | 미션: 스크롤 고정 → 클릭 단계, 단어별 문장 제거 |
| `home-background.js` | 블랙홀 버퍼 해상도 자동 조절 (느릴 때 한 번만) |
| `home-src/mission-model.js` | 차폐막 바깥으로 빠짐, 셰이더·텍스처 사전 준비, 해상도 자동 조절 |
| `routing.js` | `HOME_ANCHORS` = mission, light, spectrum, blink, sky |
| `scripts/build-home-model.mjs` | `sky-scan` 진입점 추가, Three.js 청크 공유 |
| `../../scripts/build.mjs` | 배포 목록에 `home-lab.js`, `home-v3.css` 추가 |
| 새 파일 | `home-lab.js`, `home-v3.css`, `home-src/sky-scan.js`, `assets/model/sky-scan.js`, `assets/model/three-*.js`, `assets/spectrum/`, `assets/blink/`, `assets/sky/stars-v7.*`, `assets/brand/apogeex-logo-ivory.png`, `scripts/build_home_*.py` |

## 지켜 주세요

1. 위 파일을 고치기 전에 `git pull`. 병합 이전 사본으로 덮어쓰지 않기.
2. `home-src/*.js`를 고치면 `node apps/portal/scripts/build-home-model.mjs`로 `assets/model/`을 다시 만들기.
3. 홈 문장은 `i18n/en.js`·`ko.js` 키로만 추가 (`index.html`에는 영어 + `data-i18n`).
4. 과학 자료(RW Aurigae 101장, Vesta 3장, 밝은 별)는 실측이며 생성 스크립트가 함께 있음. 가짜 값으로 바꾸지 않기.
5. `apps/portal`에서 `npm test` 통과 확인 후 커밋.
