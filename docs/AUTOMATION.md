# 오름국어 자동화용 API 명세

자동화 스크립트(Node/Python 등)로 PDF→문항 등록을 자동으로 처리하려는 분을 위한 문서입니다.
이 문서 하나면 외부 스크립트에서 모든 작업이 가능합니다.

---

## 0. 환경

- **Production URL**: `https://korean-kkk.vercel.app`
- **인증 방식**: 세션 쿠키 (httpOnly, sameSite=strict)
- **DB**: Prisma + Neon PostgreSQL (직접 접근 불가, 반드시 API 경유)
- **이미지 저장소**: Vercel Blob (퍼블릭 URL)

---

## 1. 인증 (반드시 먼저)

### 로그인

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "<관리자 이메일>", "password": "<비밀번호>" }
```

성공 시 `Set-Cookie: session=<JWT>` 헤더 옴.
이후 모든 요청에 이 쿠키 첨부.

```js
// Node 예시 (fetch + cookie 수동 관리)
const loginRes = await fetch('https://korean-kkk.vercel.app/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const cookie = loginRes.headers.get('set-cookie').split(';')[0]; // "session=..."
// 이후 모든 fetch에 headers.Cookie 로 첨부
```

### 권한

- 모든 `/api/admin/*` 엔드포인트 → **관리자 전용** (role: ADMIN)
- 일반 USER 계정으론 자동화 불가능. ADMIN 계정 필요.

---

## 2. 데이터 모델 (요약)

```
PdfDocument  ─┬─< Passage ─┬─< PassageImage   (지문은 여러 단으로 쪼개질 수 있음)
              │            ├─< Question       (지문에 딸린 문제)
              │            └─< PassageTag ─── Tag
              └─< Question (단독 문제도 직접 연결 가능)
                          ├─< QuestionTag ─── Tag
                          └─< QuestionGrammarCategory ─── GrammarCategory
```

### Passage 필드

| 필드 | 타입 | 비고 |
|---|---|---|
| `year` `month` `grade` | Int? | 2025, 9, 3 등 |
| `area` | String? | 문학 / 독서 / 화작 / 언매 |
| `startNo` `endNo` | Int? | 지문이 다루는 문제 번호 (예: 4~7) |
| `questionRange` | String? | "4~7" 자동 생성됨 |
| `ocrText` | String? | OCR 본문 |
| `images: PassageImage[]` | 여러 단별 이미지 |
| `tags: PassageTag[]` | 태그 (다대다) |

### Question 필드

| 필드 | 타입 | 비고 |
|---|---|---|
| `passageId` | Int? | null이면 단독 문제 |
| `imageUrl` | String | (필수) Vercel Blob URL |
| `ocrText` | String? | OCR 본문 |
| `questionNo` | Int? | 문항 번호 |
| `answer` | String? | "①" ~ "⑤" (특수문자) |
| `difficulty` | String? | "상" / "중" / "하" |
| `tags: QuestionTag[]` | 태그 |
| `grammarCategories: QuestionGrammarCategory[]` | 문법 카테고리 |

### GrammarCategory 계층 (2단계)

```
1. 단어편 → 품사, 형태소와 단어, 단어의 짜임새
2. 문장편 → 문장 성분, 문장의 짜임새, 문법요소, 담화 표현
3. 음운편 → 음운의 정의와 체계, 음운변동
4. 기타 → 한글맞춤법, 로마자표기법/외래어표기법, 중의성 외
```

DB 시드는 이미 들어가 있음. `GET /api/grammar/categories` 로 트리 + 각 카테고리 id 조회 가능.

---

## 3. 이미지 업로드 + OCR

문항/지문 이미지 파일(PNG/JPEG)을 multipart로 전송하면 Vercel Blob에 업로드되고 CLOVA OCR이 한글 본문을 추출합니다.

```http
POST /api/admin/upload
Cookie: session=...
Content-Type: multipart/form-data

file=<image binary>
```

응답:
```json
{
  "imageUrl": "https://...vercel-storage.com/uploads/uuid-foo.png",
  "ocrText": "추출된 본문 텍스트"
}
```

제약:
- 파일 크기: 15MB 이하
- MIME: `image/png`, `image/jpeg`, `image/webp` 만

---

## 4. PDF 업로드

```http
POST /api/admin/pdf
Cookie: session=...
Content-Type: multipart/form-data

file=<pdf binary>
pageCount=<숫자> (선택)
```

응답:
```json
{ "id": 12, "name": "...", "blobUrl": "...", "fileHash": "...", "deduped": false }
```

같은 PDF(SHA-256 해시) 재업로드 시 `deduped: true`로 기존 레코드 반환.

---

## 5. 지문 등록

```http
POST /api/admin/passage
Cookie: session=...
Content-Type: application/json

{
  "year": 2025, "month": 9, "grade": 3,
  "area": "독서",
  "startNo": 4, "endNo": 7,
  "tags": ["#비문학", "#경제"],          // 문자열 배열 (자동 upsert)
  "pdfDocumentId": 12,                  // 선택
  "images": [
    {
      "imageUrl": "https://.../left.png",
      "ocrText": "(좌단 본문)",
      "order": 0,
      "pageNum": 2,
      "boxX": 100, "boxY": 200, "boxW": 400, "boxH": 800
    },
    {
      "imageUrl": "https://.../right.png",
      "ocrText": "(우단 본문)",
      "order": 1, "pageNum": 2, "boxX": 520, "boxY": 200, "boxW": 400, "boxH": 800
    }
  ]
}
```

응답: 생성된 Passage 객체 (id 포함).

---

## 6. 문항 등록

```http
POST /api/admin/question
Cookie: session=...
Content-Type: application/json

{
  "passageId": 123,                      // 단독 문제면 null
  "pdfDocumentId": 12,                   // 선택
  "imageUrl": "https://.../q4.png",      // 필수
  "ocrText": "...",
  "questionNo": 4,
  "answer": "③",
  "difficulty": "중",                    // "상"/"중"/"하"
  "tags": ["#논리적사고"],
  "grammarCategoryIds": [5, 9],          // GrammarCategory.id 배열
  "pageNum": 2,
  "boxX": 100, "boxY": 100, "boxW": 400, "boxH": 300
}
```

### 수정

`PUT /api/admin/question` (같은 URL, 본문에 `id` 추가)
- `tags` 또는 `grammarCategoryIds` 배열 보내면 **전체 교체**
- 누락된 필드는 변경 없음
- 화이트리스트: `ocrText, answer, difficulty, questionNo, keywords` 만 적용

---

## 7. 문법 카테고리 조회

```http
GET /api/grammar/categories
Cookie: session=...
```

응답:
```json
{
  "tree": [
    {
      "id": 1, "name": "단어편", "order": 0, "count": 0,
      "children": [
        { "id": 5, "name": "품사", "order": 0, "count": 42 },
        ...
      ]
    },
    ...
  ]
}
```

→ 자동화 스크립트에서 카테고리 이름 → id 매핑 후 `grammarCategoryIds`에 사용.

---

## 8. 일괄 처리

### 문법 일괄 추가 (병합)

```http
POST /api/admin/question/bulk
Cookie: session=...
Content-Type: application/json

{ "questionIds": [501, 502, 503], "categoryIds": [5, 9] }
```

→ 각 문항의 기존 카테고리 유지하고 신규 카테고리 추가 (이미 있는 건 skip).

### 일괄 삭제

```http
DELETE /api/admin/question/bulk
Cookie: session=...
Content-Type: application/json

{ "questionIds": [501, 502, 503] }
```

---

## 9. 검색

```http
GET /api/search?q=<쿼리>
Cookie: session=...  (USER 권한도 OK)
```

토큰 분리(공백/콤마), 각 토큰을 OR 매칭 후 AND 조합. `#` 접두사는 자동 제거.

---

## 10. 전체 자동화 워크플로우 예시

```
1) POST /api/auth/login → session 쿠키 획득
2) POST /api/admin/pdf  → PDF 업로드 → pdfDocumentId
3) 페이지 이미지를 클라이언트에서 잘라낸 후:
   - 지문 단별 이미지마다 POST /api/admin/upload → imageUrl + ocrText
4) GET /api/grammar/categories → 카테고리 id 매핑
5) 지문 그룹별로 POST /api/admin/passage (images 배열 포함) → passageId
6) 각 문제 이미지마다 POST /api/admin/upload → imageUrl
7) POST /api/admin/question (passageId, tags, grammarCategoryIds 포함)
8) 모든 등록 후 GET /api/search 로 확인
```

---

## 11. 에러 처리

| 코드 | 의미 |
|---|---|
| 401 | 로그인 필요 (쿠키 없음/만료) |
| 403 | 권한 부족 (관리자 아님) |
| 400 | 요청 본문 검증 실패 |
| 413 | 파일 크기 초과 |
| 500 | 서버 오류 (Vercel 로그 확인) |

세션 쿠키는 24시간 후 만료 → 재로그인 필요.

---

## 12. 참고 — Schema 직접 조회

자동화 스크립트가 Prisma 스키마 그대로 보고 싶다면 GitHub의 `prisma/schema.prisma`:

```
https://github.com/cchomath-stack/Korean-kkk/blob/main/prisma/schema.prisma
```

(repo는 private일 수 있음 — 관리자에게 권한 요청)
