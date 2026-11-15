# v5 포털 인수인계

이 문서는 통합 후 `apps/portal`의 현재 연결 구조를 설명합니다. 통합V2의 과거 단독 실행 지침을 대체합니다. 원래 팀원 이름과 경로는 자료 출처 기록에만 남깁니다.

## 실행과 검증

저장소 루트에서 `Start-Web.cmd` 또는 `npm start`를 실행합니다. 공통 빌드는 루트 `npm run build`, 통합 검증은 루트 `npm test`입니다. 포털 자체 검사만 실행하려면 루트에서 `npm --prefix apps/portal test`를 사용합니다.

예전 `server.py`, `launch_preview.py`, macOS 전용 실행기, 포털 안의 별도 천구 구현은 제거했습니다. 포털 폴더에서 Python 서버를 따로 띄우지 않습니다. 서버 구성과 Python 설치는 루트 README를 따릅니다.

## 소스와 배포 URL

| 화면 | 현재 소스 | 화면 주소 |
|---|---|---|
| 홈·공통 메뉴 | `apps/portal` | `#home` |
| 천구 | `apps/planetarium`, 포털 `adapters/planetarium.js` | `#planetarium` |
| 관측 분석 | `apps/analysis` | `#analysis` |
| 소행성 3D·결과 | `apps/asteroids` | `#asteroids?tab=orbit` / `tab=research` |
| 기존 이동 천체 자료 | `apps/portal/moving` | `#asteroids?tab=observations` |
| 우주 탐험 | `apps/experience`, `services/experience` | `#experience` |
| 공통 검색 | `packages/search` | 상단 검색 |
| 튜토리얼 | `packages/tutorial` | 첫 진입·상단 재보기 |

포털은 배포 루트에, 독립 화면은 `analysis/`, `planetarium/`, `asteroids/`에 생성됩니다. Sojourner는 `config.json`의 별도 origin에 연결합니다. 소스 폴더 상대 경로를 배포 URL로 사용하지 않습니다.

## 유지해야 할 동작

- 실제 자료 조회 실패를 대체 데이터로 감추지 않습니다.
- 좌표계·시점·관측자·시야 크기를 화면 간 전달에서 유지합니다.
- 별·별자리 일반 선택과 SPHEREx 분석 영역 선택을 구분합니다.
- 천구는 숨긴 동안 정지하지만 선택·카메라 상태를 보존합니다.
- 분석·소행성 iframe은 이탈 시 정리합니다. 탐험은 기록 저장 응답을 받은 뒤 이탈하고 영상 생성 중에는 기다립니다.
- 검색·튜토리얼을 열면 활성 화면의 렌더링·재생을 일시정지합니다.
- iframe 메시지는 실제 자식 창과 허용된 origin을 모두 검증합니다.
- 기존 `#moving` 링크는 이동 천체 관측 화면으로 연결합니다.

## 홈 자산

홈의 블랙홀 배경, 글라스 카드, 미션 이야기, 전천 비교와 출처 설명을 보존했습니다. 망원경 모형 소스는 `home-src/mission-model.js`, 배포 번들은 `assets/model/mission-model.js`입니다. 루트 설치 후 이 폴더에서 `node scripts/build-home-model.mjs`로 재생성할 수 있습니다. 스크립트는 이웃 `apps/analysis`의 Vite와 포털의 vendored Three.js를 사용합니다.

3D 모형 자산: `assets/model/`에는 Hero(`spherex-hero.glb`)와 Lite(`spherex-lite.glb`), 키트의 `manifest.json`(revision `panel-clearance-2`)이 키트 원본 그대로 들어 있습니다. 화면 폭 700px 이하(`matchMedia('(max-width:700px)')`)에서는 Lite, 그 밖에는 Hero를 불러오며, `mountMissionModel`의 `quality` 옵션이 픽셀 비율 상한(Hero 1.75, Lite 1.25)을 정합니다. 모형을 바꾸면 `node scripts/build-home-model.mjs`로 번들을 다시 만들고, `tests/model-assets.test.js`가 두 GLB의 sha256을 `manifest.json`과 대조합니다. 포스터 `spherex-hero-poster.webp`는 키트의 `preview/spherex-hero.png`와 같은 형상(태양전지판 위치 동일)이라 그대로 둡니다.

`docs/verification.md`는 통합 전 V1의 역사적 검증 기록입니다. 그곳의 테스트 수·옛 경로·서버 명령을 현재 상태로 인용하지 않습니다. 원본 자료의 라이선스·측정 방법·기여자 표시는 삭제하지 않습니다.
