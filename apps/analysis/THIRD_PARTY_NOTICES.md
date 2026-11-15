# 제3자 코드 고지 / Third-party notices

## TrueBlink (팀원 경보, `경보/trueblink`, Apache License 2.0)

아래 파일은 TrueBlink에서 가져왔습니다. 첫 줄의 "AI-assisted code (Claude)" 고지와 원래 주석을 그대로 두었고, 바꾼 곳은 아래에 적었습니다. 전체 라이선스는 `경보/trueblink/LICENSE`에 있습니다.

| 이 폴더 | 원본 | 바꾼 점 |
|---|---|---|
| `src/gl/SkyGlobe.ts` | `src/gl/SkyGlobe.ts` | 타입 경로(`./skyTypes`), 사용하지 않던 필드를 읽는 `element` 접근자 추가 |
| `src/gl/globe/healpix.ts`, `tiles.ts`, `view.ts` | `src/gl/globe/*` | 없음 |
| `src/gl/globe/healpix.test.ts`, `fixtures/golden_cube.json` | `tests/healpix.test.ts`, `tests/fixtures/golden_cube.json` | import 경로 |
| `src/lib/catalogNet.ts` | `src/core/catalogs/net.ts` | 없음 |

다시 구현한 아이디어(코드 복사 아님): 같은 파장끼리 비교하는 블링크, 탐험/연구 모드, 임무 카드, 발견 목록, 안내 카드, 차가운 천체 필터, 링크 공유, VizieR·Sesame 미러 목록과 Gaia 고유운동 이동(`src/lib/sky.ts`), SPHEREx 102채널 파장표(`hips-rewrite.mjs`의 값).

## 자료

- 영상: NASA/IPAC Infrared Science Archive, SPHEREx DR1·QR3 (L2 영상, 전천 HiPS 큐브 `spherex_allsky_cube`).
- Gaia DR3 (ESA/DPAC) via VizieR I/355/gaiadr3, CDS Sesame/SIMBAD: 위치·운동 값과 이름 찾기에만 사용.
