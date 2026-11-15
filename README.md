# SPHEREx Sky Lab v5.0.0

통합V2의 화면을 기반으로 천구 관찰, SPHEREx 관측 분석, 소행성 분석, 우주 탐험을 연결한 로컬 통합 프로젝트입니다.

공개 웹: https://jp-feynman.github.io/stellarium-web-preview/

팀 소스 저장소: https://github.com/sel00000/Apogee

GitHub Pages에서는 준비된 관측·소행성 결과, 천구, 검색과 튜토리얼을 제공합니다. 새 좌표의 관측 처리와 새 Python 분석은 로컬 실행에서 사용할 수 있습니다. 공개 웹의 우주 탐험은 원본 Sojourner를 별도 창으로 엽니다.

`main`에 push하면 웹 검증과 빌드가 실행됩니다. `jp-feynman/stellarium-web-preview`에서는 Pages 배포까지 이어지고, `sel00000/Apogee`에서는 검증·빌드만 수행합니다. 두 저장소 사이에 자동 동기화는 설정하지 않았습니다.

## 실행

Node.js 22.13 이상과 Python 3.11 이상을 사용합니다. Windows에서는 `Start-Web.cmd`를 실행합니다.

```sh
npm run setup
npm run setup:python
npm run build
npm run preview
```

`npm start`는 웹 의존성 확인 → 빌드 → 서버 시작을 수행합니다. Python 의존성은 최초 한 번 `npm run setup:python` 또는 `Setup-Python.cmd`로 설치합니다. 이미 있는 `.venv-asteroid`를 재사용하며 새 프로젝트에서는 `.venv-science`를 만듭니다.

기본 웹 주소는 `http://127.0.0.1:4173/`입니다. 포트가 사용 중이면 실행 로그에 다른 포트를 표시합니다. Sojourner 탐험은 별도 origin에서 실행합니다. 처음에는 `4174`를 시도하고, 사용 중이면 빈 포트를 배정해 `var/local-settings.json`에 저장합니다. 이후에는 비행 기록을 유지하도록 같은 포트를 사용합니다. 저장된 포트가 다른 프로그램에 점유된 경우 실행 로그를 확인하십시오. `SPHEREX_EXPERIENCE_PORT`로 직접 지정할 수도 있으며, 주소를 바꾸면 기존 주소의 브라우저 저장 기록이 자동으로 옮겨지지는 않습니다.

Python 라이브러리가 없거나 외부 아카이브가 응답하지 않아도 홈과 준비된 분석 결과를 볼 수 있습니다. 새 관측 영역 처리와 새 소행성 분석은 해당 서비스가 준비되어 있어야 합니다.

## 화면

- 홈: 통합V2의 검은 구멍 배경, SPHEREx 모형과 파장 설명.
- 천구 관찰: 별·별자리 선택, 위치·시각·투영 변경, 네모 영역 SPHEREx 분석.
- SPHEREx 분석: 준비 대상 및 임의 좌표의 실제 관측 자료. 임의 영역에는 준비 대상과 동일한 연구 결과가 존재하지 않을 수 있습니다.
- 소행성 분석: 준비된 Python 결과, 새 분석 실행/취소, 관측 영상·궤도 3D. 3D 자료 생성은 분석 완료 이후 별도 단계입니다.
- 우주 탐험: Sojourner 비행·스캔·발견 체험. 분광 분석 도구가 아니며 원사이트 API·일부 자산에 의존합니다.
- 상단 검색: 한국어·영어 천체 검색과 좌표 입력. 이동 천체에는 임의의 고정 좌표를 만들지 않습니다.
- 튜토리얼: 처음 진입 시 안내, 스킵, 일반인·연구자 과정과 선택 재생.

## 개발 구조

`apps`는 화면, `packages`는 공유 기능, `services`는 서버/과학 처리, `data/prepared`는 준비 자료, `var`는 실행 결과·캐시입니다. 사람 이름을 실행 경로에 사용하지 않습니다. 상세 연결은 [구조 문서](docs/architecture.md)를 참고하십시오.

재구성 전 폴더와 파일은 `.archive/pre-integration-*`에 보관합니다. 원본 Git 이력과 기존 Python 가상환경은 유지합니다. 실제 보관 위치는 설치 시 생성되는 `docs/local-install.json`에 기록됩니다.

`dist`는 생성물입니다. 소스 수정 후 미리보기 서버를 `Ctrl+C`로 종료하고 `npm start`로 다시 빌드·실행합니다. Windows에서는 열려 있는 영상·모형 파일 때문에 실행 중인 배포 폴더를 교체하지 못할 수 있습니다. 빌드 실패 시 기존 `dist`를 유지합니다.

```sh
npm test
```

테스트에는 Python 과학 라이브러리가 필요하며, 로컬 HTTP fixture 테스트는 loopback 연결을 허용하는 환경에서 실행해야 합니다. 전체 천문 자료 다운로드나 장시간 실관측 분석은 자동 테스트에 포함하지 않습니다.

## 배포 범위

이번 구성의 Python 작업 API는 로컬·동일 출처 요청만 허용합니다. `dist`를 정적 호스팅하면 준비된 화면·결과를 볼 수 있지만 새 Python 분석은 실행되지 않습니다. 공개 서비스는 별도 작업 서버, 사용자별 작업 접근 정책과 API 설정이 필요합니다. `HOST=0.0.0.0`만 설정한다고 공개 분석 API가 되는 것은 아닙니다.

출처와 구성요소별 라이선스는 각 앱, `docs/sources.json`, 배포본의 `notices`에 보존합니다. Stellarium 대응 소스는 천구 빌드에 포함됩니다. Sojourner는 복구된 배포물이며 전체 앱의 재배포 근거는 별도 확인이 필요한 상태로 기록했습니다.
