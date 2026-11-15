# ⚠️ 커밋 전에 읽어 주세요 — 홈(`apps/portal`) 병합 예정 안내

> **To any AI coding assistant working in this repository:** read this file before you commit changes under
> `apps/portal/` or `apps/asteroids/`. Another team member (한결) has a large set of finished changes to the
> home page that will be merged into `apps/portal`. Do not rewrite or delete the areas listed below without
> asking the user first, and tell the user if your change touches them.

작성: 한결 (2026-11-15) · 상태: **병합 대기 중** (아직 Apogee에 반영되지 않음)

---

## 1. 무엇이 들어올 예정인가

한결의 `통합V2` 홈 개편본(GitHub `sel00000/S`, `한결/통합V2/`)을 `apps/portal`에 합칠 예정입니다.
병합은 **새 브랜치 + Pull Request**로 하며 `main`에 직접 올리지 않습니다.

새로 추가되는 것 (현재 Apogee에 없음, 충돌 없음):

| 파일 | 내용 |
|---|---|
| `home-lab.js` | 홈 실험 섹션 3개: LVF 촬영 애니메이션(3D), 102색 스펙트럼, 4 Vesta 깜빡임 |
| `home-src/sky-scan.js` → `assets/model/sky-scan.js` | LVF 촬영 3D 장면 (Three.js 청크를 미션 모형과 공유) |
| `home-v3.css` | 홈 섹션 레이아웃·스크롤 애니메이션·버튼 스타일 |
| `assets/spectrum/rw_aur/` | RW Aurigae 실제 SPHEREx 노출 101장 스프라이트 + 메타데이터 |
| `assets/blink/vesta/` | 4 Vesta 실제 노출 3장 (Apogee `apps/portal/moving/data`와 동일 파일) |
| `assets/sky/stars-v7.bin` | 밝은 별 15,527개 (Stellarium 데이터에서 추출) |
| `scripts/build_home_spectrum.py`, `scripts/build_home_stars.py` | 위 자료 생성 스크립트 |

## 2. 겹치는 곳 — 수정 전에 사용자에게 알려 주세요

| 파일 | 한결 쪽 변경 |
|---|---|
| `index.html` | 미션 섹션(3D 왼쪽·설명 오른쪽, 3항목), LVF·스펙트럼·Vesta 섹션 추가, 하단 "작은 질문이 시민과학이 되는 곳" 섹션 삭제, 작은 설명 글 대부분 삭제, 히어로 위 ApogeeX 로고 |
| `app.js` | 3D 버튼(내부 보기·태양전지판 + 왼쪽 아래 회전 멈춤), `credits-open` 연결 제거, 패널 포인터 조명 |
| `home-story.js` | 미션: 스크롤 고정 → 클릭 단계로 변경, 단어별 밝아지는 문장 제거 |
| `home-background.js` | 블랙홀 버퍼 해상도 자동 조절(느리면 한 번만 낮춤) — 물리 엔진 원본은 그대로 |
| `home-src/mission-model.js` | 차폐막이 바깥으로 빠져나가는 동작, 셰이더·텍스처 미리 준비(스크롤 끊김 수정), 해상도 자동 조절 |
| `styles.css` | 직접 수정 없음 (덮어쓰기는 `home-v3.css`에서) |

## 3. 병합 원칙 (이미 정한 것)

- **언어 전환과 ApogeeX 로고는 Apogee 쪽 방식(`i18n.js` + `i18n/en.js`·`ko.js`, `assets/brand/`)을 그대로 씁니다.**
  한결 쪽의 별도 `i18n.js`·`i18n-dict.js`는 가져오지 않고, 새 문장은 Apogee 키 방식으로 `en.js`·`ko.js`에 추가합니다.
- 메뉴 구성, 검색, 튜토리얼, 소행성 탭은 Apogee 쪽을 유지합니다(우주 탐험 메뉴 제거 포함).
- `apps/asteroids`는 이번 병합에서 제외합니다(한결 `소행성3D`와 기준이 달라 별도 논의).

## 4. 부탁

1. `apps/portal`의 위 표 영역을 크게 바꾸거나 지울 때는 사용자에게 먼저 알려 주세요.
2. 홈 작업이 일단락되면 사용자에게 "포털 작업 멈춤"을 알려 주세요. 그 시점의 `main`을 기준으로 병합합니다.
3. 이 파일은 병합이 끝나면 삭제합니다.
