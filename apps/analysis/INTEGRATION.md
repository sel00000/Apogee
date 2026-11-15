# 통합V1 분석 작업실

이 폴더는 기존 `한결/통합`의 실제 SPHEREx 분석 기능과 자료를 독립 복사한 작업실입니다. 원래 앱은 수정하지 않았습니다.

## 실행 및 경로

- 통합 서버는 `/analysis/`를 이 폴더의 `dist/`로 연결합니다.
- 상위 셸에서 `/analysis/?embed=1&target=barnard`처럼 iframe으로 로드합니다.
- 자료는 Vite의 상대 base(`./`) 아래 `data/`에서 읽습니다. 다섯 준비된 대상의 실제 관측은 오프라인 파일로 포함됩니다.
- 임의 좌표는 `/api/patch` API가 필요합니다. `scripts/server.py --port 8000`이 생성한 `/data/patches/*`까지 통합 서버에서 같은 원점으로 프록시해야 합니다.
- 개발: `npm ci`, `npm run dev`. 배포: `npm run build`.
- 로컬 검증에서는 기존 통합의 설치된 의존성을 `node_modules` 심볼릭 링크로 재사용했습니다. 링크는 Git에서 제외됩니다.

## 셸과의 메시지

모든 메시지는 `location.origin`으로만 전달합니다. 수신 시에는 원점과 `event.source === window.parent`를 검사합니다.

상위 → 분석:

```js
{ type: 'spherex-select-target', target: 'barnard', tab: 'motion' }
{ type: 'spherex-select-target', ra: 83.82208, dec: -5.39111, label: '오리온 성운', tab: 'spectrum' }
{ type: 'spherex-analysis-pause' }
```

대상 ID가 주어지면 준비된 실제 관측 대상에 우선 연결하고, 좌표만 주어지면 API로 실제 관측을 조회합니다. 임의 위치의 예상·측정값을 생성하지 않습니다. 좌표 영역에는 기존 앱의 범위대로 시계열 영상과 관측 표가 있으며, 알려진 대상용 3D 고유운동 모델은 임의로 만들지 않습니다.

분석 → 상위:

```js
{ type: 'spherex-analysis-ready' }
{ type: 'spherex-analysis-loaded', target, label, observations }
{ type: 'spherex-navigate', view: 'planetarium' }
```

쿼리 `ra`, `dec`, `fov`, `label`, `target`, `mode`, `tab`, `lang`, `visit`도 지원합니다. iframe을 숨길 때 상위 셸은 pause 메시지를 보내거나 제거해야 합니다. 기존 3D 캔버스는 `frameloop="demand"`를 유지합니다.

## 바뀐 표현

- 외부 폰트 요청 제거, SF Pro / Apple SD Gothic Neo 우선의 시스템 폰트 스택.
- 공통 차콜 표면과 낮은 채도의 앰버 탐색 강조. 검출기·측정·카탈로그·모델의 과학적 색 의미는 보존.
- 대상 선택, 영상·3D 비교, 시간축, 분석 도구를 순서대로 읽는 계층. 3D·분광·변광 등 기능 제거 없음.
- 임무/탐험과 연구 모드를 유지하고 상세 설정은 기존 접기 구조 유지.
- 3D, 실시간 천구, 연구 도구를 별도 지연 로딩 청크로 분리. 홈에서는 분석 번들을 로드하지 않도록 상위 셸에서 화면 진입 때 iframe을 생성해야 함.

## 검증

- TypeScript + Vite production build 성공.
- 단위 검사 113개 통과(기존 110개 + 메시지 payload 경계 3개).
- 기존 실제 관측 public 파일을 원본과 SHA256 비교해 동일성 확인(`data-integrity.json`).
- 라이브러리/기능의 기존 근거와 고지는 `THIRD_PARTY_NOTICES.md`, `README.md`, `HANDOFF.md`에 유지.
- 실제 Chrome 화면·통합 경로는 상위 통합 서버에서 검증해야 하며 빌드 성공만으로 브라우저 검증을 주장하지 않음.
