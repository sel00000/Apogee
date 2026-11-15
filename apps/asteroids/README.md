# SPHEREx Sky Lab · 소행성 분석

JPL Horizons 태양 중심 실제 궤도와 NASA/IPAC IRSA SPHEREx 개별 관측을 연결하는 통합 작업 공간입니다. 연구 탭은 Python 분석 결과·새 작업·보고서·CSV를, 궤도 탭은 실제 관측과 3D 시점을 제공합니다. 3D 화면은 들어갈 때만 로드합니다. 네 계열의 저폴리 암석은 설명용이며 실제 소행성 형상이나 분류가 아닙니다.

현재 번들: 소행성 24개와 행성 8개의 궤도, 관측 메타데이터 7,488행. 실제 사진을 볼 수 있는 소행성은 23개이며, 22개 대상의 고정 하늘 비교 96장과 Hygiea의 개별 사진 2장으로 총 98개 촬영 화면을 제공합니다. 913 Otila는 궤도만 제공하며 준비된 사진이 없습니다.

이번 추가 대상은 **64 Angelina, 216 Kleopatra, 596 Scheila, 2566 Kirghizia, 35107 (1991 VH)**입니다. 모두 SPHEREx 시점, 실제 사진 켜기·끄기, ePSF 모형 겹치기, 촬영별 이동 원과 고정 하늘 재생을 지원합니다.

| 추가 대상 | 고정 하늘 비교 촬영 |
| --- | ---: |
| 64 Angelina | 6장 |
| 216 Kleopatra | 5장 |
| 596 Scheila | 5장 |
| 2566 Kirghizia | 3장 |
| 35107 (1991 VH) | 2장 |

## 실행

Node.js **22.13 이상**을 준비하세요. 프로젝트 루트에서 `npm start` 또는 `Start-Web.cmd`를 사용하면 통합 화면과 분석 API를 함께 실행합니다. 새 Python 분석에 필요한 환경은 루트의 `npm run setup:python`으로 준비합니다. 준비된 결과와 3D만 확인할 때는 Python 분석 환경이 필요하지 않습니다. 이 화면만 정적으로 확인할 때는 이 폴더에서:

```sh
npm ci
npm run build
python3 scripts/serve.py
```

macOS에서는 `START.command`, Windows에서는 `START.cmd`도 사용할 수 있습니다. 두 파일은 프로젝트 루트의 실행 절차를 호출하며 필요한 npm 설치와 빌드를 수행합니다. 준비된 관측 번들은 포함되므로 JPL/IRSA 조회 없이 재생할 수 있습니다. HTML 파일을 직접 더블클릭하지 마세요. 위의 단독 정적 서버는 새 분석 API를 제공하지 않습니다.

개발: `npm run dev -- --port 5188`. 기존 팀 앱의 빌드/서버와 독립되어 있습니다.

## 조작

- 이름 검색 또는 암석 클릭으로 대상 선택. 태양계 / 따라가기 / SPHEREx 시점으로 전환합니다.
- 태양계 재생은 실제 JPL 위치·속도를 보간합니다. 옅은 완전한 선은 최초 기준일의 순간 궤도(2체 근사), 밝은 선은 준비된 기간의 실제 위치 경로입니다. 원형 좌표 격자는 제거했습니다.
- 소행성 암석은 지구 표시 반경의 1/13 이하로 줄였습니다. ‘따라가기’로 가까이 볼 수 있으며 전체 보기에서 선택했다고 크기를 키우지 않습니다. 실제 천체 크기의 축척은 아닙니다.
- **SPHEREx 시점 → 고정 하늘 재생**: 같은 하늘 영역의 실제 연속 촬영을 0.75초/장으로 재생합니다. 실제 촬영 간격은 균일하지 않습니다. 시각은 각 프레임의 실제 UTC이고, 아래 슬라이더는 촬영 프레임을 선택합니다.
- **SPHEREx 시점**: 자유롭게 움직이던 3D 카메라가 촬영 시각의 실제 우주선 위치로 이동하고, 선택 영상의 WCS 방향·회전·각도 범위를 바라봅니다. 중앙의 **관측 사진 켜기 / 사진 투명도**는 카메라를 움직이지 않고 3D 공간의 영상 평면만 조절합니다. **이전 자유 시점**으로 직접 조작했던 위치로 돌아갑니다.
- 오른쪽 **실제 사진 / 모형만 / 겹쳐보기**는 별도의 ePSF 비교 미리보기입니다. 중앙의 사진 켜기/끄기와 독립적입니다.
- 준비된 공통 영역이 없는 대상은 개별 촬영만 보이고, 고정 하늘 재생·모형 전환은 비활성화됩니다. 서로 다른 별 영역을 이어 붙이지 않습니다.
- 저전력 모드는 픽셀 배율을 1로 제한합니다.

## 과학적 의미

태양계는 태양 중심 J2000 황도 좌표, AU 선형 축척입니다. 천체의 표시 크기는 설명용입니다. 위치는 JPL Horizons 위치·속도를 cubic Hermite 보간합니다. UI는 UTC, 벡터는 TDB이며 이 기간 UTC→TDB 변환의 주기항 생략 오차는 약 2ms 이내입니다. 순간 궤도는 기준일의 JPL 상태벡터로 구한 참고 타원으로, 장기 정밀 예측선이 아닙니다.

공통 하늘 영상은 같은 검출기의 가까운 시각 촬영들을 고정 ICRS TAN 격자(128×128, 6.15 arcsec/pixel)에 재투영합니다. 모든 프레임의 공통 유효 영역만 표시하며, 동일한 asinh 대비와 중앙 배경값 보정을 적용합니다. 별의 **위치**가 고정되는 것이고 잡음·파장 차이에 따른 밝기 변화는 남습니다. 실제 배경을 합성하거나 교체하지 않습니다.

사진 속 모형은 SPHEREx 관측자(`500@-163182`) 기준 노출 중간 시각의 JPL astrometric ICRF 방향을 FITS WCS에 투영하고, 원본 FITS의 **ePSF**를 해당 검출기 위치에서 선택해 만듭니다. 관측값과 예측값을 섞어 위치를 맞추지 않으며, 분산 가중 최소제곱으로 밝기와 상수 배경만 맞춥니다. 원본 영상과 같은 WCS로 모형을 재투영합니다. 모형만 보기의 밝기는 배경을 제거한 방출량 기준이므로 실제 사진의 배경 밝기와 일치하지 않습니다. 적합 χ²/자유도를 표시하며, 혼잡·포화·노출 중 이동(현재 trail convolution 미적용) 때문에 차이가 남을 수 있습니다.

관측 모드의 3D 암석은 원본 JPL astrometric ICRF 방향(광행시간 보정 포함)을 사용합니다. 태양계 모드의 동시각 기하학적 위치를 그대로 투영하지 않습니다. 선택 영상의 FITS WCS(SIP 포함)를 16×16 삼각형 격자로 변환해 같은 광선 위의 3D 영상 평면에 배치합니다. 영상 평면까지의 거리는 표시용이며, 관측 모드 암석도 약 1픽셀 반경의 설명용 크기로 표시합니다. 고정 하늘 영상은 북쪽 위로 재투영한 잘라낸 영역의 시야이며, 위성 전체 검출기 자세를 재현한다는 의미는 아닙니다.

3D의 네 종류 암석은 설명용 형상입니다. SPHEREx 영상의 점광원 모형은 암석 표면 모양 재현이나 독립적 검출 확정을 뜻하지 않습니다. 물성·분류·크기 추정값은 별도 연구 결과 탭에서 출처·불확실성·보류 상태와 함께 제공합니다. 공식 ePSF 설명: [IRSA 튜토리얼](https://caltech-ipac.github.io/irsa-tutorials/spherex-psf/).

## 데이터 재생성

기본 입력은 프로젝트 루트의 `data/prepared/asteroids`입니다. SQLite는 `SPHEREX_SCENE_DB`, 원본 자료는 `SPHEREX_SCENE_SOURCE`, 출력은 `SPHEREX_SCENE_OUT`, 캐시는 `SPHEREX_SCENE_CACHE`, 출처 식별자는 `SPHEREX_SCENE_SOURCE_COMMIT`으로 지정합니다. 경로는 절대 경로를 권장합니다. 기본 SQLite는 입력 폴더의 `asteroids.sqlite`, 기본 출력은 이 앱의 `public/data`, 기본 캐시는 프로젝트 루트의 `var/cache/asteroid-scene`입니다. 재생성 Python 환경에는 `requests numpy scipy astropy pillow`가 필요하며 루트의 `npm run setup:python`으로 설치할 수 있습니다.

현재 번들의 역사적 입력은 GitHub 커밋 `324e485b579c78e776c088a7ba5fc0a2f3455ae3`의 `지호/spherex-asteroid-analysis/outputs/`였습니다. 이 경로는 당시 커밋을 재현할 때만 사용합니다. `snapshot_source.py`의 현재 기본 경로는 `data/prepared/asteroids/`이며, 과거 커밋에는 `--prefix`를 명시해야 합니다. 저장소에 해당 커밋을 가져온 뒤 이 앱 폴더에서 아래 PowerShell 예시를 실행하면 공유 체크아웃을 변경하지 않고 입력을 `.cache/source-<commit>/outputs`에 복사합니다. 별도 Git 체크아웃을 읽으려면 `--repo <checkout>`을 추가하세요.

```powershell
$scenePython = (Resolve-Path '..\..\.venv-asteroid\Scripts\python.exe').Path
& $scenePython -X utf8 -B scripts/snapshot_source.py 324e485b579c78e776c088a7ba5fc0a2f3455ae3 --prefix '지호/spherex-asteroid-analysis/outputs/'
$env:SPHEREX_SCENE_SOURCE = (Resolve-Path '.cache/source-324e485b579c78e776c088a7ba5fc0a2f3455ae3/outputs').Path
$env:SPHEREX_SCENE_DB = Join-Path $env:SPHEREX_SCENE_SOURCE 'asteroids.sqlite'
$env:SPHEREX_SCENE_SOURCE_COMMIT = '324e485b579c78e776c088a7ba5fc0a2f3455ae3'
```

아래 명령은 전체 준비 번들을 재생성합니다. PowerShell 예시는 앞서 지정한 과학 Python을 사용합니다. 현재 `data/prepared/asteroids`를 사용할 경우 스냅샷 단계와 입력 환경변수 설정을 생략하세요. 기존 번들을 유지하려면 `SPHEREX_SCENE_OUT`을 별도 폴더로 지정하세요. 지정하지 않으면 `public/data`를 갱신합니다. 웹에서 실행하는 개별 작업은 아래의 통합 생성기를 통해 별도 폴더에서 완성된 후에만 공개됩니다.

```powershell
$scenePython = (Resolve-Path '..\..\.venv-asteroid\Scripts\python.exe').Path
& $scenePython -X utf8 -B scripts/prepare.py
& $scenePython -X utf8 -B scripts/enrich.py
& $scenePython -X utf8 -B scripts/fixed_sky.py
& $scenePython -X utf8 -B scripts/model_sky.py
& $scenePython -X utf8 -B scripts/prepare_sightlines.py
& $scenePython -X utf8 -B scripts/prepare_trails.py
& $scenePython -X utf8 -B -m unittest discover -s tests -p 'test_*.py'
npm test
npm run build
```

처음 준비할 때 외부 조회로 시간이 걸립니다. 지정한 캐시 폴더의 원본 응답을 재사용하며 JPL 요청은 순차 실행됩니다. 초기 번들 실패는 manifest에, 연속 영상 준비 실패는 콘솔에 남고 가짜 영상으로 대체하지 않습니다. 기본 결과는 `public/data`입니다. 개별 촬영 번들은 소행성마다 최대 3장, Eros 최대 8장입니다. 고정 하늘 묶음은 동일 검출기의 0.12일 이내 촬영 중 공통 영역 75% 이상·3~6장을 우선 사용합니다. 검출기 가장자리 프레임은 제외해 공통 영역과 대상 위치가 유효한 가장 큰 부분 묶음을 사용하고, 부족하면 다른 촬영 조합을 시도합니다. 이동량이 사실상 같은 후보끼리는 별 배경을 더 잘 볼 수 있는 짧은 파장 검출기를 우선합니다. 긴 묶음이 없는 경우 같은 품질 기준(GOOD, SNR ≥ 5)을 통과한 실제 2장으로 비교합니다. 준비된 모든 관측을 보여주는 앱은 아닙니다. SQLite에만 남은 대상은 관측 목록과 궤도를 제공하며 준비된 사진이 없을 수 있습니다.

원본 출처: [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/), [NASA/IPAC IRSA MOST](https://irsa.ipac.caltech.edu/applications/MOST/), [SPHEREx](https://irsa.ipac.caltech.edu/Missions/spherex.html). 기존 팀 데이터 기준 커밋은 manifest에 기록합니다. 영상은 재투영·배경 레벨 보정·asinh 대비를 적용한 적외선 흑백 영상이며 자연색이 아닙니다. FITS 링크·해시·관측 파라미터·WCS는 번들에 보존합니다.

## 성능 설계

네 개의 instanced rock mesh, 공유 재질, 그림자/후처리 없음. 참고 궤도는 두 개의 LineSegments로 묶고 선택 경로만 강조. 정지와 숨김 탭에서는 렌더링 중단. 재생 중 API 요청 없음. 128×128 사진과 모형을 하나의 atlas에 담아 이미지 캐시는 최대 8장(연속 영상 기준 1 MiB), 새 선택 시 기존 요청 취소, 늦게 도착한 응답 무시. 검사 결과와 알려진 제한은 `docs/VALIDATION.md`에 기록합니다.

## 촬영별 이동 흔적

모든 준비된 대상에 공통으로 작은 원을 표시합니다. 금색은 이전 촬영, 민트색은 현재 촬영, 옅은 회색은 다음 촬영입니다. 숫자는 촬영 순서입니다. 사진에 기록된 천체를 새로 검출한 결과가 아니라 해당 촬영 시각의 JPL 예측 위치이며, 각 위치를 현재 사진의 WCS로 다시 투영합니다. 원 중앙의 실제 신호는 가리지 않습니다.

`촬영별 이동 흔적 표시`로 중앙 3D 영상 평면과 오른쪽 미리보기의 원을 함께 켜고 끌 수 있습니다. 사진 투명도와 독립적입니다. 사진 밖에 있는 위치는 가장자리에 억지로 붙이지 않고 개수만 안내합니다. 촬영 한 장인 대상은 현재 위치만 표시하며, 사진이 없는 대상은 기능을 비활성화합니다.

데이터를 재생성할 때 `python3 scripts/prepare_trails.py`도 실행하세요. 런타임에는 좌표 재계산이나 외부 API 요청 없이 준비된 좌표와 하나의 투명 텍스처를 재사용합니다.

## 통합 분석과 3D 생성

`public/analysis-data/index.json`은 준비된 결과 목록입니다. 대상의 영구 식별자, 파일 ID와 숫자 번호는 구분합니다. 같은 대상의 새 분석은 별도 run ID를 가집니다. `Complete`는 처리 상태이며 높은 신뢰도를 뜻하지 않습니다. 열모델/통계/결합/카탈로그 지름은 따로 표시합니다.

새 분석은 `/api/asteroid-analysis`의 capabilities/jobs/status/cancel을 사용합니다. 완료 후 사용자가 3D 생성 버튼을 누르면 원본 분석 폴더와 SQLite를 별도 입력으로 받아 6단계 자료 생성을 실행합니다. 결과가 완성되기 전에 웹 경로에 공개하지 않습니다. 취소와 실패는 과학 분석 결과를 지우지 않습니다. 실시간 신규 자료 생성에는 JPL/IRSA 연결이 필요하며 외부 장애가 발생하면 오류로 표시합니다.

```text
node scripts/generate-scene.mjs --source-dir <raw-target-folder> --source-root <raw-outputs> --db-path <sqlite> --output-dir <new-scene-directory> --python <python-executable>
```

현재 3D 재생의 UTC/TDB 근사는 2025–2026 범위에서 검증되어 있습니다. 이 범위를 벗어난 신규 3D 생성은 명시적으로 거절하며 분석 결과는 계속 볼 수 있습니다.

검증: `npm test`, `npm run test:scene`, 과학 Python 환경에서 `python -X utf8 -B -m unittest discover -s tests -p "test_*.py"`.
