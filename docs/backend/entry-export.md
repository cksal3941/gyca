# 관리자 접수 CSV 내보내기

2026-09-19. 운영자가 현재 관리자 접수 목록과 같은 검색·필터·정렬 조건으로 접수 자료를 내려받을 수 있는 동기식 내보내기 API다.

## API

`POST /api/v1/admin/competitions/{competitionId}/entries/export`

요청 본문은 `src/contracts/entry-export.ts`의 `EntryExportRequestSchema`를 사용한다.

```json
{
  "q": "검색어",
  "entryStatus": "received",
  "paymentState": "succeeded",
  "publishedResult": "official_selection",
  "sort": "created_desc"
}
```

모든 필드는 선택이다. 필터 값과 정렬은 관리자 접수 목록 API와 같다. 성공 응답은 `{data,meta}` JSON이 아니라 UTF-8 BOM이 포함된 `text/csv` 원문이다. 브라우저는 응답을 `Blob`으로 내려받는다.

- 파일명: `gyca-entries.csv`
- `X-GYCA-Export-ID`: 불변 감사 기록 ID
- `X-GYCA-Export-Rows`: 헤더를 제외한 행 수
- 최대 10,000행, 최대 20 MiB
- 캐시 금지: `Cache-Control: private, no-store`

오류 응답은 기존 `{error,meta}` JSON이다. 인증 없음 401, 운영자 권한 없음 403, 공모 없음 404, 잘못된 필터나 행 한도 초과 422, 바이트 한도 초과 413이다. POST이므로 동일 Origin을 요구한다.

## 포함 범위와 데이터 기준

계정 이메일, 참가자·보호자 정보, 학교·학년, 작품·부문·연령 그룹, 접수/제출/접수확정 시각, 접수번호, 결제 상태·금액·검토 여부, 심사·공개 결과를 포함한다. 제출 기록이 있는 접수는 제출 시점의 동결 snapshot을 사용하고 초안만 현재 값을 사용한다.

PG 결제키·가맹점 ID·공급자 원문, 저장소 key/version, 동의 토큰·전문, 비밀번호·세션은 포함하지 않는다. CSV에는 개인정보가 포함되므로 관리자 화면에서 용도를 알리고 필요한 사람만 내려받아야 한다.

## 안전 경계와 감사

- 모든 셀을 큰따옴표로 감싸고 큰따옴표를 이스케이프한다.
- 사용자 입력이 공백 뒤 `=`, `+`, `-`, `@`로 시작하거나 탭/개행으로 시작하면 작은따옴표를 붙여 스프레드시트 수식 실행을 막는다.
- 생성한 정확한 바이트의 SHA-256, 필터, 행 수, 실행 계정, 시각을 migration 033의 `gyca_entry_exports`에 기록한다.
- 감사 행은 UPDATE/DELETE할 수 없다. CSV 원문 자체는 서버에 별도로 보관하지 않는다.
- 행·용량 제한을 넘는 대규모 추출은 일부 파일로 잘라 반환하지 않고 실패한다. 향후 실제 운영 규모가 이를 넘으면 비동기 작업과 만료되는 비공개 다운로드로 확장한다.

## 검증 범위

PGlite에서 동결 snapshot, 검색 조건, 수식 주입 방어, 민감한 공급자 값 비노출, 바이트 해시와 불변 감사, 인증·권한·Origin·엄격한 요청 검사를 확인했다. Excel/Sheets 수동 열람, 운영 PostgreSQL 부하와 대규모 내보내기는 아직 검증하지 않았다.
