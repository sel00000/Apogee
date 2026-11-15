# SPHEREx Experience Service

Sojourner를 SPHEREx Sky Lab 안에서 실행하는 스트리밍 중계 서비스입니다. Worker 루트에서 화면과 Records iframe, 실시간 API를 같은 출처로 제공하므로 기존 절대 경로와 통합 lifecycle 메시지를 유지합니다. npm 의존성은 없습니다.

## 경로와 데이터

- `/`와 등록된 정적 파일 387개: `https://jp-feynman.github.io/stellarium-web-preview/experience/`의 통합 버전을 전달합니다. 원작 JavaScript로 대체하지 않습니다.
- `/api/live/system`, `spacecraft`, `asteroids`, `satellites`, `solar`, `body/{id}`: 원작 `https://sojourner.artificialisabel.com` API를 실시간 요청합니다. 응답은 `no-store`이며 202 대기 상태와 Retry-After, 오류 상태를 그대로 유지합니다.
- 누락된 `juno.glb`, `jwst-light.glb`, `mars-odyssey.glb`, `mro.glb`만 원작 모델 경로를 사용합니다.
- 나머지 경로는 404입니다. 임의 URL 프록시 기능은 없으며 원작 페이지로 이동하지 않습니다. 외부·내부 upstream redirect는 모두 502로 거절합니다.
- GET/HEAD만 허용합니다. 모델 Range 요청, 조건부 요청, 바이너리·압축 응답을 보존합니다. 본문을 메모리에 모으지 않고 원본 스트림을 직접 반환합니다.
- 원작 API 및 GitHub Pages가 중단되면 해당 기능도 영향을 받습니다. API 원본 관측 시각과 표시 문구는 변경하지 않습니다. 과거 스냅샷을 실시간 값으로 바꾸지 않습니다.

## 검증과 빌드

```sh
npm test
npm run build
npm run validate
```

Windows에서도 Node로 빌드합니다. Sites 게시 명령 배열은 다음과 같습니다.

```json
[
  ["node", "scripts/build.mjs"],
  ["node", "scripts/validate-artifact.mjs"]
]
```

산출물에는 작은 Worker 코드와 프로젝트 식별 설정만 포함됩니다. 약 75 MiB의 정적 콘텐츠나 모델을 JavaScript에 넣지 않습니다.

```text
dist/
├── .openai/
│   └── hosting.json
└── server/
    └── index.js
```

수정은 `worker/index.js`에서 합니다. 파일 목록은 v5.0.0의 `apps/experience/web` 실제 파일 목록을 기준으로 고정되어 있습니다. 새 리소스를 추가할 때 allowlist도 함께 갱신해야 합니다.

180초 제한은 응답 헤더 대기와 스트림 전달에 적용됩니다. 헤더 전 시간 초과는 504, 네트워크 오류는 502입니다. 이미 전달을 시작한 스트림이 제한 시간을 넘으면 연결이 실패하며 상태 코드를 뒤늦게 변경하지 않습니다. 클라이언트 취소는 upstream에 전달됩니다.

압축된 본문은 읽거나 변환하지 않고 Content-Encoding과 함께 전달합니다. 이는 [Cloudflare Fetch passthrough](https://developers.cloudflare.com/workers/runtime-apis/fetch/#passthrough-behavior) 방식입니다. 큰 파일도 전체 크기만큼 Worker 메모리를 사용하지 않습니다. Node mock 테스트는 경로·헤더·상태·취소·스트리밍을 검증하며, 실제 플랫폼 압축·iframe 동작은 게시 후 브라우저 검증이 필요합니다.

GitHub에 소스만 올리는 것으로 이 서비스가 실행되지는 않습니다. Worker 게시 후 포털의 `experienceUrl`을 서비스 HTTPS 주소로 설정해야 합니다. 공개 포털 사용자에게 제공하려면 서비스도 공개 접근이 가능해야 합니다. `.openai/hosting.json`의 프로젝트 식별자는 배포 담당자가 관리합니다.

원작의 저작자 표시와 통합 페이지의 안내를 유지합니다. Python 소행성 분석 서버는 이 서비스의 범위에 포함되지 않습니다.
