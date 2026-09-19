# 공모 카드 표시 정보 API

구현일: 2026-09-19. 계약: `src/contracts/competition-presentation.ts`. migration 039가 필요하다.

## 결정

카드 표시 정보를 별도 테이블과 계약으로 분리했다. 제목·참가비·마감·공모 상태·readiness·allowedActions는 기존 Competition에서 가져온다. 공개 요약이나 포스터를 바꾸려고 접수 정책과 기존 제출 snapshot을 변경하지 않는다.

| 메서드·경로 | 응답 / 요청 |
| --- | --- |
| GET `/api/v1/content/competition-cards?limit=20&cursor=...` | `{data:{items:[{competition,presentation}],nextCursor},meta}` |
| GET `/api/v1/admin/competitions/{competitionId}/presentation` | `{competitionId,revision,content,updatedAt,allowedActions}`를 data에 반환 |
| PUT `/api/v1/admin/competitions/{competitionId}/presentation` | `{expectedRevision,content,evidenceReference}`를 저장하고 최신 관리자 응답 반환 |

관리자 경로는 competition editor 권한, PUT은 동일 Origin이 필요하다. 표시 정보가 없으면 관리자 revision은 0, updatedAt은 null이다. content의 네 필드 모두 null이다. 첫 저장은 expectedRevision 0, 이후에는 조회한 revision을 사용한다.

```json
{
  "expectedRevision": 0,
  "content": {
    "summary": {"en": "Development example", "ko": "개발 예시"},
    "category": {"en": "Book awards", "ko": "도서 공모전"},
    "city": null,
    "cover": null
  },
  "evidenceReference": "internal-record:card-copy-reviewed"
}
```

summary/category/city는 `{en,ko}|null`, cover는 `{src,alt:{en,ko},caption:{en,ko}|null}|null`이다. 미디어 URL 제한은 [아카이브](project-archive.md)와 같다. 본문에 fee, status 등 운영 필드를 넣으면 422다.

## 프런트 연결 규칙

1. `CompetitionCardsPageSchema`로 응답을 검증한다. 레이아웃은 유지하고 데이터 공급만 바꾼다.
2. `presentation.summary/category/cover`가 null이면 해당 부가 요소를 숨기거나 디자인의 중립 placeholder를 사용한다. mock 문구·도시·수상 실적을 live 공모에 섞지 않는다.
3. **period는 새 자유입력 필드로 만들지 않았다.** 접수 기간은 competition의 실제 시작·종료시각과 timezone, 전시 기간은 승인된 exhibition.period, 다른 일정은 keyDates로 표시한다. 별도 홍보 기간 문자열로 마감과 모순되는 날짜를 만들지 않는다.
4. **city는 exhibition.approvalStatus가 approved일 때만 공개된다.** 관리자가 미리 입력할 수 있지만 승인 전 public 응답은 null이다. summary/category/cover의 자유 콘텐츠를 서버가 의미적으로 검열하지는 않으므로 미승인 장소를 우회 기재하지 않는다.
5. Apply 버튼은 중첩 `competition`의 서버 status/readiness/allowedActions를 사용한다. 카드 존재나 포스터 등록은 접수 개방을 뜻하지 않는다.
6. 공모 자체가 published이고 public_content가 있는 경우만 목록에 나온다. 표시 정보 미등록 공모도 제외하지 않는다. ID 오름차순, 기본 20·최대 50, nextCursor를 그대로 다음 요청에 전달한다. 중복·알 수 없는 query는 422다.
7. 표시 정보 저장은 기존 공모의 revision·참가비·정책을 바꾸지 않는다. 공개된 공모에는 저장 내용이 즉시 반영되므로 별도 카드 발행 버튼을 만들지 않는다. 저장 시 evidenceReference와 불변 변경 이력을 남긴다.
8. PUT에는 actionId가 없다. 통신 결과가 불명확하면 GET으로 상태를 확인하고, 409 REVISION_CONFLICT 시 최신 내용과 비교한다. 무조건 재저장하지 않는다.

검증: `tests/competition-presentation.test.mjs` — 기존 데이터의 null 기본값, 공개 필터, 권한·저장·revision 충돌, 미승인 도시 비노출, 운영 필드 변경 차단, 불변 이력. 운영 DB 적용과 프런트 화면 연결은 아직 수행하지 않았다.
