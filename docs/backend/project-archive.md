# 완료 프로젝트 아카이브 API

구현일: 2026-09-19. 계약: `src/contracts/project-archive.ts`, 공통 미디어: `src/contracts/public-media.ts`. migration 038이 필요하다.

## 결정

클림트 빌라와 이후 국제 프로그램은 **완료 프로젝트의 편집 아카이브**로 관리한다. 접수·심사·결제 원장에서 참가자 정보나 원본 작품을 자동 공개하지 않는다. 운영자가 공개용 사본과 설명을 등록하고 자료 출처·이용 권한 확인 기록을 근거로 발행한다. 신규 모집이나 작품 구매 결제 기능은 이 계약에 포함하지 않는다.

공개 상태는 항상 `completed`다. 관리자 편집 상태 `draft/published/archived`와 접수·심사 상태는 서로 다른 개념이다.

## 엔드포인트

성공은 기존 `{data, meta}`, 오류는 `{error, meta}` 봉투다. 관리자 작업은 로그인과 `gyca_competition_editors` 권한이 필요하며 쓰기는 동일 Origin을 검사한다.

| 메서드·경로 | 동작 |
| --- | --- |
| GET `/api/v1/content/projects` | 발행 프로젝트 목록 |
| GET `/api/v1/content/projects/{slug}` | 발행 프로젝트 상세; 미발행·보관은 404 |
| GET `/api/v1/content/winners` | `selection`이 ready인 프로젝트, 해당 섹션만 반환 |
| GET `/api/v1/content/exhibitions` | `exhibition_photos`가 ready인 프로젝트, 해당 섹션만 반환 |
| GET/POST `/api/v1/admin/content/projects` | 관리자 목록 / 초안 생성 |
| GET/PATCH `/api/v1/admin/content/projects/{projectId}` | 관리자 상세 / 본문 전체 수정 |
| POST `/api/v1/admin/content/projects/{projectId}/publish` | 현재 초안에 공개 근거 기록 후 발행 |
| POST `/api/v1/admin/content/projects/{projectId}/archive` | 공개 제거 및 편집 종료 |

목록은 ID 오름차순, `limit` 기본 10·최대 20, `cursor` 선택이다. 공개 cursor는 서버가 제공하는 불투명 문자열이며 winners/exhibitions/projects 간 재사용하면 422다. 관리자 cursor는 ID이며 관리자 목록에만 `status` 필터가 있다. 필터를 바꾸면 cursor를 초기화한다. 알 수 없거나 중복된 목록 query는 422다.

**winners/exhibitions는 프로젝트 단위 컬렉션이다.** 개별 수상자 검색·학년 필터·심사 점수 조회 API가 아니며, UI에서 기존 개별 수상작 모델로 억지 변환하지 않는다. 필요하면 승인된 selection 자료를 프로젝트 카드 안에서 표시한다.

## 콘텐츠 구조

- `projectType`: art / book / composition / performance / interdisciplinary.
- `completionYear`: 완료 연도 또는 null. `hero`: program, summary, location, period, operated[], image.
- 문구는 `{en,ko}`이며 두 언어 모두 필요하다. 없는 선택 필드는 null, 목록은 빈 배열이다.
- `sections`는 1~10개. kind와 order는 각각 중복 불가. 화면은 order로 정렬한다.
- 각 섹션은 title, optional, pendingNote, status와 intro / gallery / documents / quotes / stats를 가진다. ready는 최소 하나의 콘텐츠가 필요하다.
- 종류: intro, process, selection, exhibition_photos, ceremony_photos, sales, buyer_interviews, exhibition_certificate, sales_certificate, results.
- 미디어는 `{src,alt:{en,ko},caption:{en,ko}|null}`. quotes는 `{quote,attribution}`, stats는 `{label,value}`이며 내부 값은 모두 다국어 문구다.
- ready 섹션이 하나 이상 있어야 발행 가능하다. 모든 10개 섹션의 자료를 억지로 채울 필요는 없다.

공개 API는 필수 pending 섹션의 제목·순서·안내만 반환하며 본문·파일·인터뷰 등 미완성 payload를 제거한다. optional pending 섹션은 통째로 제외한다. 내부 draft에 저장한 인터뷰가 공개 응답에 새어나오지 않도록 서버에서 처리한다. `pendingNote` 자체는 공개 안내 문구이므로 내부 메모를 넣지 않는다.

## 생성 예시

아래 문구는 개발 예시이며 운영 자료로 발행하지 않는다. `actionId`는 클라이언트에서 새로운 UUID를 생성한다.

```json
{
  "actionId": "67d29f35-7836-447d-9b12-ef7a46170cab",
  "slug": "example-completed-project",
  "content": {
    "projectType": "art",
    "completionYear": null,
    "hero": {
      "program": {"en": "Example project", "ko": "개발 예시 프로젝트"},
      "summary": {"en": "Development example only", "ko": "개발 예시입니다"},
      "location": null, "period": null, "operated": [], "image": null
    },
    "sections": [{
      "kind": "intro", "order": 1,
      "title": {"en": "Introduction", "ko": "프로젝트 소개"},
      "optional": false, "pendingNote": null, "status": "ready",
      "intro": {"en": "Development example only", "ko": "개발 예시입니다"},
      "gallery": [], "documents": [], "quotes": [], "stats": []
    }]
  }
}
```

수정은 `{actionId,expectedRevision,content}`. 발행은 다음 형태다.

```json
{
  "actionId": "5ac6f661-cdbb-4ca7-a60c-ccbd49c6680a",
  "expectedRevision": 1,
  "evidence": {
    "sourceReference": "internal-record:project-materials-reviewed",
    "rightsReference": "internal-record:publication-permissions-reviewed",
    "confirmedForPublication": true
  }
}
```

근거는 실제 내부 검토 기록의 식별자다. API는 그 기록의 존재나 법적 효력을 자동 확인하지 않는다. 보호자 연락처·계약 원문·신분증 번호를 참조 값에 넣지 않는다. 보관은 `{actionId,expectedRevision}`다.

## 편집·발행 규칙

1. 생성하면 draft, revision 1이다. 이후 작업마다 revision이 1 증가한다.
2. **발행된 콘텐츠를 수정하면 즉시 draft로 돌아가 공개 API에서 사라진다.** 기존 공개본을 유지하는 병행 초안 기능은 없다. 편집 저장 전에 이 동작을 관리자에게 안내하고, 자료를 다시 확인해 발행한다.
3. archived는 종료 상태다. 복구·삭제 API는 없다. 아카이브 전에는 이 결과를 관리자에게 안내한다.
4. 버튼은 `allowedActions`로 표시한다. 발행 시 근거 입력과 ready 섹션 조건도 충족해야 한다.
5. 409 REVISION_CONFLICT는 다시 조회 후 사용자 수정 내용을 비교한다. 자동 덮어쓰기는 하지 않는다.
6. 같은 요청을 재시도할 때 actionId와 본문을 그대로 보낸다. 같은 actionId에 다른 작업/본문은 IDEMPOTENCY_CONFLICT다. 성공 후에는 새 actionId를 사용한다. 재시도 응답은 최초 작업 결과이므로 이후 최신 상태는 GET으로 확인한다.
7. 변경 snapshot, 발행 근거, 멱등 응답은 불변 이력이다. 공개 응답에는 근거·운영자·revision을 포함하지 않는다. API는 `no-store`이며 프런트도 공개 데이터 장기 캐시를 추가하지 않는다.

## 공개 파일 경계와 프런트 인계

`src`는 `/media/...` 같은 사이트 절대경로나 HTTPS URL만 허용한다. 상대경로, HTTP, protocol-relative, 인증정보·query·fragment·경로 이동이 있는 URL은 거절한다. 임시 서명 URL은 저장하지 않는다. 별도로 공개 승인한 파일의 안정적인 URL을 입력한다. 이 기능은 접수 원본의 접근권한이나 S3 ACL을 변경하지 않으며 파일 업로더도 제공하지 않는다.

화면 어댑터는 `ArchivePublicItemSchema`를 검증하고 기존 아카이브 레이아웃에 매핑한다. `hero.eyebrow` 같은 화면 전용 고정 라벨은 UI 번역에 둔다. 모든 문자열은 일반 텍스트로 렌더링한다. 실제 클림트 자료 등록, 관리자 편집 화면, 공개 화면 배선은 후속 작업이다. mock의 사진·성과 숫자를 live DB에 자동 복사하지 않는다.

검증: `tests/project-archive.test.mjs` — PGlite 전체 migration, 권한·Origin, 초안 비노출, 발행 근거, pending 비노출, revision·동시 재시도, 보관, 불변 이력, 목록 cursor, 실제 로컬 HTTP 읽기. 운영 PostgreSQL과 실제 파일 권한은 별도 검증 대상이다.
