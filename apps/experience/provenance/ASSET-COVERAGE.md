# 실행 자산과 원본 출처

`web/`는 공개 배포 프런트엔드와 자산을 기반으로 한다. 요청에 따라 제작자 표시와 소셜 아이콘·링크를 제거했다. 천체, 비행, 기본 그래픽 효과와 과학 자료 출처는 유지했다. 표시 정리로 바꾼 파일3개의 원본/배포 해시는 [display-customizations.json](../display-customizations.json)에 있다.

파일별 원본 URL, SHA-256, 바이트 크기, 취득/확인 시각, 발견 근거, HTTP 상태와 로컬 보유 여부는 [runtime-assets.json](../runtime-assets.json)에 있다. `availability: "on-demand"`인 항목의 SHA-256/크기는 취득 후 검증한 원본을 가리키며, 해당 파일은 `web/`에 포함하지 않는다.

## 확인된 범위

2026-11-15 취득 기준:

| 항목 | 결과 |
| --- | ---: |
| 코드·매니페스트·기존 브라우저 캡처에서 확인한 정적 경로 | 389개 |
| `web/`에 저장한 파일 | 385개, 78,326,435바이트 (표시 정리 후) |
| 요청 시 원본에서 가져오는 정적 파일 | 우주선 모델 4개 |
| 확인된 정적 파일의 취득 실패 | 0개 |
| 기존 브라우저 캡처 3개의 정적 경로 | 89개, 전부 로컬 보유 |
| HTML·JavaScript·CSS 원본 대조 | 수집 시26개 모두 일치; 표시 정리로3개 변경 |
| 원본 자산 매니페스트의 공개 SHA-256 대조 | 48개 전부 일치 |
| 초기 취득/재검증 과정의 다운로드 | 107,560,513바이트 (약 102.58 MiB) |

저장한 파일은 원본 HTML 2개, JavaScript 9개, CSS 15개와 필요한 데이터·미디어다. 별 데이터와 좌표계 변환 바이너리 2개, 글꼴 15개, 행성/달/배경 JPEG 43개, 관측 영역 PNG 4개, MP3 263개(그중 ASTRA 녹음 250개)를 포함한다. Records의 `data/codex-facts.json`과 두 가지 Codex CSS도 포함한다.

원래 분석 보관본의 `public/`에서 가져온 원본 파일은 31개다. 분석용 `*.readable.js`, `data-summary.json` 및 과거 응답인 `public/api/live/*.json`은 실행 문서 루트에 넣지 않았다. 새로 취득한 358개 중 아래 모델 4개를 제외한 354개를 로컬 보유한다.

## 요청 시 가져오는 파일

확인한 기본 시작 화면, 비행, 스캔 및 Records의 자산 경로는 모두 로컬에 보유한다. 선택한 우주선 근처에 접근할 때 필요한 다음 모델 4개는 저장소 크기를 줄이기 위해 실행 서버의 원본 전용 스트리밍 프록시가 처리한다. 원본 파일을 임의의 저해상도 대체물로 바꾸지 않는다.

| 요청 경로 | 원본 바이트 크기 |
| --- | ---: |
| `/assets/spacecraft/juno.glb` | 9,731,820 |
| `/assets/spacecraft/jwst-light.glb` | 10,484,028 |
| `/assets/spacecraft/mars-odyssey.glb` | 6,047,180 |
| `/assets/spacecraft/mro.glb` | 5,798,208 |

네 파일도 처음 취득할 때 원본 매니페스트의 SHA-256과 일치함을 확인했다. 총 18개 GLB를 검사했으며 모두 glTF 2.0이고 외부 buffer/image URI를 포함하지 않는다. 런타임 Draco 디코더 의존성도 없으며, Psyche만 `KHR_texture_transform`을 필수 확장으로 선언한다.

취득 스크립트는 파일당 50 MiB 이상인 파일을 저장하지 않고 요청 시 취득 대상으로 남긴다. 이번에 확인한 경로 중 그 제한에 해당하는 파일은 없었다. 기본 로컬 크기 목표인 80 MiB에 맞추기 위해 위 모델 4개만 제외했다.

## 동적으로 구성되는 경로

정적 문자열뿐 아니라 공유 청크의 `tt`, `Ja`, `Fe`, `ne`, `pe`, `et`, `vt`, `Xn` 선택자를 따라 경로를 확장했다. 읽기 쉬운 분석본의 위치는 `public/shared.readable.js:2056`, `:3197`, `:3351`, `:4706`, `:4720`이며 실행은 수정하지 않은 원본 청크를 사용한다.

| 용도 | 경로 |
| --- | --- |
| 행성 표면 | `/assets/{mercury,venus,earth,moon,mars,jupiter,saturn,uranus,neptune}.jpg` |
| 달 표면 | `/assets/moons/{lowercaseName}.jpg`, 선택자에 선언된 21개 |
| 절차적/재구성 표면 | `/assets/procedural/{lowercaseName}.jpg`, 선택자에 선언된 11개 |
| 소행성/Phobos 형상 | `/assets/{bennu,eros,ryugu,phobos}.glb` 및 Gaspra/Ida procedural GLB |
| 관측 영역 | `/assets/{venus,saturn,uranus,neptune}-coverage.png` |
| 우주선 | `/assets/spacecraft/{model}.glb`, 원본 모델 매니페스트와 일치 |
| GLTF 로더 | `/chunk.MMA2UXXD.js`, 로컬 Three.js 청크에서 재수출 |
| MP4 내보내기 모듈 | `/chunk.6FP2ZNOZ.js`, 로컬 보유 |

MP4 모듈은 `public/app.readable.js:11599`의 동적 import 대상이다. 소스에 있는 `sojourner-journey-home.mp4`는 브라우저가 생성하는 다운로드 이름이며 서버에서 내려받는 입력 영상이 아니다. 모듈 취득은 내보내기 동작이나 브라우저 WebCodecs 지원을 시험했다는 의미는 아니다.

## 실시간 API 및 동일 출처 동작

현재 천체 위치를 요청하는 API는 다음과 같다. 과거 보관 응답을 이 경로에 대신 제공해서는 안 된다.

```text
/api/live/system
/api/live/spacecraft
/api/live/asteroids
/api/live/satellites
/api/live/solar
/api/live/body/{encodeURIComponent(id)}
```

`public/app.readable.js:6180`의 `Hn`은 `cache: "no-store"`, 180초 요청 제한을 사용한다. 원본이 JSON과 HTTP 202를 반환하면 3초 후 다시 요청한다. 실행 서버는 성공 상태만 200으로 바꾸거나 API 실패를 정적 페이지로 바꾸지 않고 이 상태를 보존해야 한다. `:6247`과 `:6325`에서 body ID를 `encodeURIComponent`로 인코딩하므로 `1;`, `101955;` 같은 ID의 `%3B`를 보존해야 한다.

Records iframe은 `/codex-ingame.html?epoch=...&focus=...`를 같은 출처에서 연다. 자식은 `location.origin`을 대상으로 메시지를 보내고(`public/codex-ingame.readable.js:1250`), 부모도 `location.origin`과 iframe 창을 검사한다(`public/app.readable.js:28914`). 검토한 코드에서 원본 도메인 문자열에 고정된 hostname 제한은 없었다. 따라서 앱과 Records를 같은 로컬 포트에서 제공하면 이 메시지 계약을 유지한다.

정적 자산의 버전 쿼리는 경로에 대응하는 동일 파일을 제공하는 데 사용된다. `/`는 `web/index.html`에 대응한다. 캡처에서는 실행 리소스를 요청하는 외부 출처가 관찰되지 않았으며, 외부 연구/크레딧 링크는 별도 런타임 프록시 대상으로 취급하지 않았다. 전체 앱은 실시간 API 때문에 네트워크 연결이 필요하다.

## 다시 취득하고 대조하기

저장소 루트에서 다음을 실행한다.

```bash
python3 경보/sojourner/scripts/acquire-web-assets.py --verify-upstream
```

스크립트는 원본 HTTPS 출처만 허용하고 다른 출처로의 리디렉션을 거부한다. HTML을 비HTML 자산으로 잘못 저장하지 않으며, 실행 HTML/JS/CSS가 현재 원본과 달라지면 과거와 새 빌드를 섞지 않고 보관 바이트와 불일치 기록을 유지한다. 반복 실행 시 이미 있는 미디어는 재사용하고 원본 대조가 필요한 실행 텍스트만 다시 내려받는다.

`acquire-web-assets.py`는 취득이 끝나면 `customize-display.py`를 실행하여 표시 정리를 다시 적용한다.

이 목록은 공급된 배포 코드, 매니페스트 및 캡처 3개에 의해 한정된다. 미방문 기능의 임의 경로나 향후 원본 빌드에 생기는 자산을 전부 안다는 뜻은 아니다. 실행 중 새로운 경로가 필요한 경우 서버가 원본 출처에서 가져와야 하며, 실제 브라우저 기능 검증 결과는 별도 실행 보고서를 따른다.
