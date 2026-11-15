# 소행성 3D · SPHEREx 팀 병합 인계

작성일: 2026-11-15. 이 문서는 팀 저장소의 연구·API 구조를 유지하면서 독립 소행성 3D의 표시 기능과 정적 자산을 선별 이식한 기준을 기록한다. 앱 사용법·데이터 생성·API 설정은 [앱 README](../README.md)를 함께 읽는다.

## 기준 저장소와 범위

| 구분 | 고정 기준 |
| --- | --- |
| 병합 대상 | [sel00000/Apogee](https://github.com/sel00000/Apogee), `apps/asteroids/` |
| 팀 기준 커밋 | `e885b1fcbde09e8527f4e649061189f8009064eb` |
| 작업 중 도착한 팀 main | `93998d85b40faac16896eafcfb692c8173f2074c` — `6faf879`의 analysis V10과 `93998d8`의 dark select 변경을 모두 반영했다. |
| 통합 브랜치 | `codex/integrate-asteroid-spherex` |
| 가져온 소스 | [sel00000/S, 커밋 4a47ed1](https://github.com/sel00000/S/tree/4a47ed19c42ded84cb6f2633e4d81b94279331cc/%ED%95%9C%EA%B2%B0/%EC%86%8C%ED%96%89%EC%84%B13D), `한결/소행성3D/` |
| 소스 전체 SHA | `4a47ed19c42ded84cb6f2633e4d81b94279331cc` |
| 관측 번들의 역사적 입력 SHA | `324e485b579c78e776c088a7ba5fc0a2f3455ae3` — `public/data/manifest.json`에 기록된 과학 입력 출처이며, 위 UI 이식 커밋과 구분한다. |

독립 앱 디렉터리를 통째로 덮어쓰지 않는다. SBDB 소행성 배경, SPHEREx GLB, 상대 측광 보정 산출물, 촬영별 흔적, 시야 확대·재생 제어만 팀의 `mountOrbit()` 생명주기에 맞춰 결합한다. 팀의 연구 작업 공간, 런타임 API 설정, 새 분석의 3D 생성, 언어 전환, Gaia 배경·행성 지도, WASD 비행은 계속 유지한다.

포털의 **Asteroid Analysis 진입은 Orbit 3D로 통일**한다. 포털 상단의 Orbit 3D / Results / Observations 전환 막대와 포털 내부 앱의 연구·궤도 탭 막대를 제거한다. `#asteroids`, 과거 `#moving`, 명시적인 `tab=research`·`tab=observations`도 포털에서는 `tab=orbit`으로 정규화한다. 포털의 자식 URL은 `orbitOnly=1`을 전달하고, `workspace.ts`는 이를 존중한다. 독립 앱에서 사용하는 연구 화면과 API 코드는 삭제하지 않는다. 이후 병합에서 이전 포털 라우팅이나 독립 앱의 탭 UI를 복사해 이 결정을 되돌리지 않는다.

## 파일·함수별 책임 경계

이 표의 담당은 사람 이름이 아닌 코드 책임이다. 작업을 시작할 때 PR에 실제 담당자를 적고, 같은 파일을 동시에 수정해야 하면 함수 단위로 먼저 나눈다.

| 코드 책임 | 파일·주요 함수 | 변경 계약 |
| --- | --- | --- |
| 포털 통합 담당 | `apps/portal/routing.js`, `app.js`, `index.html`, `tests/routing.test.js` | 소행성 진입 정규화와 `orbitOnly=1` 전달을 관리한다. 다른 앱의 경로·탭 동작을 바꾸지 않는다. |
| 작업 공간·연구 담당 | `src/main.ts`, `workspace.ts`의 `openOrbit()`·`setTab()`·`onOrbit`, `research.ts`, `research-model.ts`, `research.css` | 팀 구현을 기준으로 유지한다. `main.ts`를 독립 3D 부트스트랩으로 교체하지 않는다. `workspace.ts` 변경은 포털 `orbitOnly` 통합처럼 필요한 부분에 한정한다. |
| API·생성기 담당 | `src/api-config.ts`, `src/env.d.ts`, `scripts/generate-scene.mjs`, `scripts/prepare.py` 등 과학 생성 단계, `services/gateway/` | `dataBase`, API origin/prefix 검증, 세션, 취소, 완성 후 공개 계약을 유지한다. 정적 번들 경로를 새 작업 경로에 강제하지 않는다. |
| 3D 통합 담당 | `src/orbit.ts`의 `mountOrbit()`·관측 선택·재생·`dispose()`, `types.ts` | workspace가 전달한 대상·`dataBase`·`AbortSignal`을 사용한다. 정적·생성형 번들 모두 열 수 있어야 한다. |
| 좌표·카메라 담당 | `src/scene.ts`의 `loadCraft()`·`placeCraft()`·`view()`·관측 투영, `spacecraft.ts` | 실제 태양 중심 위치와 표시 크기를 분리한다. Earth 위치는 원본 궤도에 고정하고, craft 근접 보기에서 지구는 물리 반경을 사용한다. 우주선의 확대 표시만 허용한다. |
| 배경·입력 담당 | `src/sky.ts`, `flight.ts`, `scene.ts`의 관련 블록, `public/sky/` | 팀의 좌표 회전·지도 출처·비행 키·포커스 처리·저전력 정책을 보존한다. 파일 전체를 S 버전으로 교체하지 않는다. |
| 영상·과학 자료 담당 | `src/observations.ts`의 `ObservationViewer`, `trails.ts`, `public/data/` | 원본 이미지·WCS를 유지한 채 보정 atlas와 흔적을 결합한다. 캐시 제한, 취소, 늦은 응답 무시를 유지한다. |
| 번역·UI 담당 | `src/i18n.ts`, `style.css` | 번역은 기존 사전에 키를 추가한다. 사전 전체 교체나 문자열 하드코딩으로 언어 전환을 깨뜨리지 않는다. 새 Liquid Glass 스타일은 `#orbit-workspace` 아래에 제한하고, 포털 전용 탭 숨김·높이는 `orbitOnly` 상태에 맞춘다. |

`main.ts`, workspace/research 모듈, i18n 사전, sky/flight 모듈, API·빌드 설정, 패키지/잠금 파일을 소스 앱 버전으로 일괄 덮어쓰지 않는다. 변경이 필요하면 팀 기준에서 필요한 함수·키·규칙만 패치한다. `dist/`, `public/analysis-data/`, 새 분석의 생성된 장면과 과학 원본 출력은 서로 다른 생성기 소유이므로 수동 복사 대상으로 취급하지 않는다. 팀 빌드가 내보내는 결과는 팀 생성기로 다시 만든다.

## 경로와 자산 계약

| 자산 | 기준 경로·형식 | 소비 지점 |
| --- | --- | --- |
| 장면 번들 | `options.dataBase` 아래의 `manifest.json`, `bodies.json`, `observations.json`, `comparisons.json`, `sightlines.json`, `trails.json` | `mountOrbit()`가 `new URL(name, dataBase)`로 요청한다. 기본은 앱의 `./data/`, 새 분석은 검증된 API 작업의 장면 URL이다. |
| 보정표 | 같은 `dataBase`의 선택 파일 `corrections.json`; 키는 **원본** `image.path`, 값의 `path`는 보정 atlas | 보정표를 읽을 수 없으면 원본 영상으로 동작한다. 새 분석 번들에 기존 정적 보정표를 붙이지 않는다. |
| 보정 영상 | `images/corrected-*.png`, 원본 너비의 4배 × 원본 높이 | 왼쪽부터 원본 사진 / 보정 사진 / 원본 모형 / gain 보정 모형. `ObservationViewer`는 해당 `dataBase`에서 읽는다. |
| 보정 수치 | 같은 이름의 `.npz` | `original`, `corrected`, `variance`, `valid` 배열. PNG는 화면 방향, NPZ는 FITS 방식의 아래에서 위로 증가하는 방향이다. 브라우저는 NPZ를 처리하지 않는다. |
| 관측 기하·흔적 | `sightlines.json`, `trails.json`; 키는 원본 `image.path` | 보정 모드를 바꿔도 WCS·카메라·표적 위치를 재계산하거나 바꾸지 않는다. 흔적은 현재 영상 WCS에 투영한 JPL 예측 위치다. |
| SBDB 배경 | 앱 자산 기준 `data/background.bin`, `background-class.bin`, `background.json` | `import.meta.env.BASE_URL` 기준으로 읽는다. 40,000행, 행마다 little-endian Float32 7개와 Uint8 궤도 분류 1개. 생성형 장면에도 앱의 공용 배경을 사용한다. |
| SPHEREx 모델 | 앱 자산 기준 `model/spherex-lite.glb` | `GLTFLoader`, `import.meta.env.BASE_URL` 기준. 모델 중심을 정규화하며 boresight는 +Y, 패널 법선은 −Z. |
| Gaia·행성 지도 | 앱 자산 기준 `sky/`, 출처·라이선스는 `sky/SOURCES.json` | 기존 단계적 로드·실패 시 단색 대체를 유지한다. |

시간은 UI/노출 시각의 MJD UTC와 궤도 벡터의 MJD TDB를 구분한다. 장면 좌표는 태양 중심 J2000 황도 좌표, AU다. 위치를 화면을 맞추기 위해 지구 중심으로 재배치하지 않는다. 우주선 자세는 영상 WCS 방향과 태양 방향으로 구성한 표시용 자세이며 실제 위성 텔레메트리 전체를 복원한 결과가 아니다.

## 2026-11-15 정적 자료 대조 결과

소스 작업 폴더의 최신 상태 대신 **고정 커밋 `4a47ed19…`의 Git blob**과 직접 대조했다. 총 609개 파일이 모두 일치했다: 원본 PNG/NPZ 263개, 보정 PNG/NPZ 334개, 데이터 JSON·BIN 11개, GLB 1개. 원본 263개와 보정 167쌍은 작업 폴더 간 SHA-256도 일치했다.

현재 S 작업 폴더에는 고정 커밋 이후 `913` 및 영상 없는 관측 295행을 제거한 별도 변경이 있었다. 이 작업 폴더와 비교하면 `manifest.json`, `bodies.json`, `observations.json`이 다르게 보이지만, Apogee의 세 파일은 고정 커밋과 **바이트 단위로 일치**한다. 이번 표시 기능 이식에 그 별도 카탈로그 변경을 섞지 않았다. 후속 정리는 과학 자료 담당자가 원본 DB·별칭·README·검증 수를 함께 확인하는 별도 변경으로 처리한다.

팀 main의 후속 analysis V10·dark select 변경은 별도로 보존한다. `style.css` 끝부분의 select 규칙이 겹치면 새 Orbit 스타일과 팀의 dark select 규칙을 함께 유지하고, 반영 후 전체 테스트를 다시 실행한다.

| 검증 항목 | 확인 결과 |
| --- | --- |
| 번들 규모 | 행성 8개 + 소행성 24개, 관측 메타데이터 7,488행, 고정 하늘 비교 22개 대상 / 96프레임 |
| 보정 대응 | 관측과 비교 프레임의 고유 이미지 167개와 correction·sightline·trail의 키 집합이 정확히 일치 |
| 보정 상태 | accepted 45, rejected 29, reference 22, single-frame 71 |
| 경로·출처 | 모든 보정 `.path` PNG와 대응 NPZ 존재; 167개 `fitsSHA256`가 원본 영상 메타데이터와 일치; WCS 누락 0 |
| 수치 검사 | 모든 유효 픽셀의 original/corrected/variance가 유한하고 variance > 0; 비승인 결과는 유효 픽셀의 원본 강도를 보존하고 gain = 1 |
| 승인 조건 | 45개 승인 결과 모두 gain 0.5–2와 검증 잔차 2% 이상 개선 조건 충족 |
| 영상 크기 | 167개 PNG가 각각 `4 × image.width` by `image.height`; NPZ 배열은 원본 영상 크기와 일치 |
| WCS 기록 | 최대 roundtrip 오차 `8.56791490288959e-6` arcsec, 최대 mesh 오차 `6.875775663086093e-5` pixel |
| SBDB | 원소 40,000 × 7개와 분류 40,000개; 전 값 유한; a > 0, 0 ≤ e < 1; 분류 코드 범위 0–11 |

재대조용 주요 SHA-256:

```text
manifest.json       50299cb00d52aaf4bf5edf8ddb417f003d0cf41a9c939020f40b01aef5cdbf88
bodies.json         d9b9331d8e50d98a7203489b7d8eaea85759e1bbcfe42f5a6bafb752c99d8299
observations.json   30d7942998835d8af37f4f0bb52845595c10734a411da5fcf085083d033bef98
comparisons.json    75c6bd9d4df3c886da9530bd21fb3e7836ffcf33a7376c121b9a6478c0a70fcc
sightlines.json     fbccdfced2e9cce3113fc8149d287c77be49144ac127bcbe5acc135f6aebe808
trails.json         f98ed05af709d80b3a1562798334bb80613561a94c213ec4e57969b72667d50d
corrections.json    eaa06610d2c92d37b728ac521409e6adf8c5c28113ededca405f79f91300aba8
background.bin     86baf1b05d5010893bbb46697fa35e438d827874079ed4933584d4e551d18a27
background-class.bin ab66b75a3974a6b2d3c3547d51da23875e598255dc431a564fa98ef071bbe9fe
spherex-lite.glb    f04528a2a2dbbef34e31191b8f49b36fe6021ab861b93d33cf67d188042d574f
```

## 검증과 알려진 한계

프로젝트 루트에서 기본 확인:

```sh
npm --prefix apps/asteroids test
npm --prefix apps/asteroids run test:scene
npm --prefix apps/asteroids run build
npm run build
npm run test:web
```

`test:web`는 먼저 전체 빌드를 완료한 상태에서 실행한다. 최종 실행 결과는 **706개 통과, 실패 0**이다(노드 370개 + Vitest 336개). 전체 사이트 빌드와 최종 소행성 TypeScript/Vite 빌드도 성공했다. macOS의 `/var`→`/private/var` 임시 디렉터리 심볼릭 링크 때문에 기존 경로 비교 테스트가 달라지는 문제는 코드 변경 없이 `TMPDIR=/private/tmp npm run test:web`로 검증했다.

실제 Chromium에서 24개 대상 선택, 사진이 있는 23개 대상의 첫·마지막 촬영 전환, 지구·SPHEREx 표시 좌표와 실제 좌표의 일치, 본체 보기, 원본/보정 전환, 0.5–8× 확대, 재생 속도, 한국어 전환을 확인했다. 이 흐름의 콘솔 오류와 HTTP 실패는 0개다. 1100px·390px 화면에서 시점 버튼과 관측 도구가 겹치지 않았고, WASD 이동·태양계 시간 재생·40,000개 배경 점·일반 모션의 SPHEREx 진입도 확인했다. 원격 API는 두 실제 origin의 모의 작업으로 CORS·인증·결과·생성 장면 등 12개 검사를 통과했다. 새 실제 아카이브 분석은 실행하지 않았다.

자세한 결과는 [integration-validation.json](integration-validation.json), 화면은 [40,000개 태양계](integration-system.png), [실제 지구·위성 위치](integration-earth.png), [모바일](integration-mobile.png)에 있다. 복사된 `correction-validation.json`은 원본 자료의 역사적 검증이며 위 통합 검증과 구분한다.

브라우저에서는 포털 진입·뒤로 가기, 레거시 주소의 Orbit 정규화, 사라진 탭 막대, 독립 연구 화면·언어 전환, 생성형 `dataBase` 장면의 보정표 없는 원본 재생을 확인한다. 3D에서는 원본/보정 전환, 빠른 대상·촬영 변경과 취소, 재생 정지, 사진 표시/투명도/흔적/확대의 독립 동작, SPHEREx 시점과 본체 보기, 모바일 폭, 저전력·reduced-motion 동작을 확인한다. 기존 `tests/workspace.browser.mjs` 및 `remote-api.browser.mjs`는 `CHROME_PATH`를 사용하는 환경별 브라우저 검사이며, 포털 모드와 독립 앱 모드의 기대값을 구분해 실행한다.

보정 알고리즘·자료 제한은 [IMAGE_CORRECTION.md](IMAGE_CORRECTION.md)에 있다. 보정은 품질 플래그 마스킹과 상대 gain/background 적합이다. 재표본화 공분산·모수 불확실성·PSF 차이를 모두 반영하지 않으며, 검출 유의도나 소행성 독립 검출을 의미하지 않는다. 보라색 마스크는 사용할 수 없는 픽셀이다. 낮아진 잔차만으로 바뀐 픽셀을 모두 잡음이라고 판정하지 않는다.

40,000개 배경은 SBDB 궤도 원소를 GPU에서 2체 전파한 설명용 분포로, 선택 대상의 Horizons 보간과 동일한 정밀도를 보장하지 않는다. 행성·소행성·우주선 표시 크기의 대부분은 설명용이며, 본체 근접 보기의 지구 물리 반경과 구분한다. 사진 속 이동 원은 JPL 예측 위치이고 실제 신호 중심의 독립 측정값이 아니다.

보정 산출물은 이번 정적 번들에 이식했지만 팀의 `generate-scene.mjs` 6단계 생성기에 보정 단계를 추가하지 않았다. 새 분석에는 보정표가 없을 수 있으며 원본 표시가 정상 동작이어야 한다. 소스 문서의 재생성 명령에는 과거 `S/한결/한결소행성/` 경로가 남아 있다. 그대로 팀 경로에서 실행하지 말고, 향후 보정 생성기를 이식할 때 `SPHEREX_SCENE_*` 입력·출력 계약에 맞춰 별도 출력 폴더에서 검증한다.

## 팀 병합 순서

1. PR에 이 문서의 기준 SHA, 수정 파일, 담당 함수를 적는다. `git status`로 다른 사람의 진행 중인 변경을 먼저 확인한다. 공유 작업 폴더를 초기화하거나 다른 사람의 수정 파일을 복원하지 않는다.
2. 자기 변경을 안전하게 보존한 상태에서 `git fetch origin`, `git rebase origin/main`으로 최신 팀 기준을 반영한다. 충돌은 이 문서의 책임 경계를 따라 해당 담당자와 해결한다. 작업 폴더가 더럽다면 자기 변경을 별도 커밋/작업 트리에 보존한 뒤 진행한다.
3. 독립 S 소스는 위 전체 SHA로 고정해서 읽는다. S의 현재 HEAD나 미커밋 작업 폴더를 그대로 동기화하지 않는다. 기존 팀 파일 전체 교체와 생성된 과학 결과의 수동 덮어쓰기를 피한다.
4. 원본 image path·FITS hash·WCS가 바뀌면 관련 correction·trail을 자동 재사용하지 않는다. 같은 입력임을 재검증하거나 새 보정 자료를 생성한다. `dataBase` 기반 자산과 앱 공용 `BASE_URL` 자산을 구분한다.
5. 전체 빌드·관련 테스트·위 브라우저 흐름을 확인하고 실제 결과를 PR에 기록한다. 언어별 문구·자료 수·과학적 표시 제한이 현재 코드와 맞는지 함께 확인한다.
6. 일반 `git push`와 리뷰 PR로 전달한다. 강제 푸시를 사용하지 않는다. 이미 공유된 브랜치를 rebase해서 일반 push가 불가능하면 새 `codex/` 브랜치로 옮겨 일반 push하고 PR을 갱신한다.

이 통합은 위 최신 팀 main을 기준으로 검증했다. 적용 커밋은 이 문서의 Git 이력으로 확인한다. 이후 팀 main이 바뀌면 해당 차이를 다시 비교하고 회귀 검증한다.
