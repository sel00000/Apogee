# v5.0.0 통합 구조

## 원본과 기능 경계

| 원본 | 현재 소유 경로 |
|---|---|
| 추가/한결/통합V2 홈·메뉴 | apps/portal |
| 통합V2/analysis | apps/analysis + services/observations |
| 통합V2/planetarium-original | apps/planetarium |
| 추가/한결/소행성3D | apps/asteroids |
| 추가/지호/spherex-asteroid-analysis | services/asteroids |
| trueblink-live의 검색 핵심과 인덱스 | packages/search |
| 추가/경보/sojourner | apps/experience + services/experience |
| 기존 tutorial | packages/tutorial |

기존 정밀 천구 엔진·좌표 선택·웹 분석 bridge와 회귀 보호는 필요한 기능 단위로 이관했습니다. 독립 trueblink/skylab-spherex 앱은 빌드나 실행 의존성에 포함하지 않습니다.

## 브라우저와 서버

포털의 해시 라우트는 `home`, `planetarium`, `analysis`, `asteroids`, `experience`입니다. 소스 폴더와 공개 URL은 별개입니다. 빌드본은 포털이 루트, 하위 앱은 `/planetarium/`, `/analysis/`, `/asteroids/`에서 실행됩니다. 검색과 튜토리얼은 `/search/`, `/tutorial/`입니다.

포털은 화면 수명주기를 소유합니다. 천구 프레임은 선택 상태를 유지하면서 비활성 렌더링을 멈추고, 다른 화면은 해제합니다. 분석·탐험 프레임 메시지는 출처와 자식 창을 검증합니다. Sojourner와 Records는 같은 탐험 origin을 유지합니다.

`scripts/serve.mjs`가 정적 웹, 관측 Python 서비스, 소행성 작업 API, 별도 탐험 서버를 시작·정리합니다. 관측 서비스 포트는 OS가 배정하고 포털 gateway가 중계합니다. 탐험 포트는 저장 상태 유지 때문에 고정합니다.

## API

| 경로 | 역할 |
|---|---|
| /config.json | 실행 환경과 탐험 URL |
| /api/health | 통합 서버 상태 |
| /api/resolve | 천체 이름·카탈로그 좌표 조회 |
| /api/patch | 관측 영역 작업 생성/조회 |
| /api/observations/data/patches/... | 생성된 관측 자료 |
| /api/asteroid-analysis/capabilities | Python 분석 가능 여부 |
| /api/asteroid-analysis/jobs | 소행성 작업 생성 |
| /api/asteroid-analysis/jobs/:id | 진행/취소/완성 결과 |
| 탐험 origin의 /api/live/* | 원사이트 허용 endpoint 중계 |

관측 요청과 소행성 작업 요청은 로컬 동일 출처에 한정합니다. 서버 코드·원본 Python 결과 디렉터리는 정적 웹 루트가 아닙니다. API에서 허용된 결과만 제공합니다.

## 자료 계약

카탈로그 식별자, 표시 이름, 분석 실행 ID를 구분합니다. 좌표에는 단위·frame·epoch를, 시간에는 UTC/TDB와 관측자를 명시합니다. 고정 ICRS 영역과 이동 천체의 겉보기 방향을 혼동하지 않습니다. 각도는 기본 도 단위이며 영역 선택기의 arcsec는 전달 경계에서 한 번 변환합니다.

소행성 원본 결과는 `data/prepared/asteroids`, 새 작업은 `var/jobs/asteroids/<UUID>`입니다. 원본 분석 결과에서 웹 결과와 3D 자료를 각각 생성합니다. 3D 자료가 실패하더라도 완성된 분석 결과를 실패로 바꾸지 않습니다. 완료 manifest를 마지막에 공개합니다.

물성값은 값·단위·불확실성·방법·출처·보류 사유를 보존합니다. thermal/statistical/combined/catalogue 지름은 서로 다른 결과입니다. 처리 완료와 과학적 신뢰도는 독립 상태이며, 절차적 3D 암석은 실제 표면 복원이 아닙니다.

## 과학 품질과 오류 처리

스펙트럼에는 품질 불량 측광과 유효한 오차가 없는 판정을 구분합니다. 차영상은 탐색용이며 파장·PSF 등의 차이를 검출 확정으로 표시하지 않습니다. 다운로드 실패는 자료 없음과 분리하고 실패 캐시를 정상 결과로 영구 재사용하지 않습니다.

천구 엔진 JS/WASM와 대응 소스·카탈로그를 같은 보정 버전으로 관리합니다. 실제 별 좌표 및 투영·터치 회귀 검증을 유지합니다. Python에서는 Horizons 반환 시각 대조, RA 경계 처리, 결과 원자적 공개와 DB 일관성 보호를 유지합니다.

## 배포와 출처

웹 빌드는 완성된 staging 출력으로 교체하며, 빌드 실패 시 직전 dist를 유지합니다. 자료 생성은 일반 프런트 빌드와 구분합니다. 네트워크 API를 사용하는 기능은 오프라인 동작을 보장하지 않습니다.

원본과 변경 출처는 sources.json과 모듈별 NOTICE에 기록합니다. Sojourner의 원본 백엔드는 포함되지 않으며 공개 배포 전 원본 앱·음성·자산의 재배포 조건을 확인해야 합니다.
