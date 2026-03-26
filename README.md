# 못다 한 연구들의 쉼터 — 배포 가이드

익명으로 연구 이야기를 남기고, 정해진 시간 후 자동 삭제되는 웹사이트입니다.

---

## 1단계: Supabase 설정 (무료, 5분)

### 1-1. 프로젝트 생성
1. [supabase.com](https://supabase.com) 접속 → **Start your project** (GitHub 계정으로 가입)
2. **New Project** 클릭
3. 이름: `unfinished-research`, 비밀번호 설정, Region: **Northeast Asia (Tokyo)** 선택
4. 생성 완료까지 1-2분 대기

### 1-2. 테이블 생성
1. 좌측 메뉴에서 **SQL Editor** 클릭
2. 아래 SQL을 복사해서 붙여넣고 **Run** 클릭:

```sql
-- 엔트리 테이블
CREATE TABLE entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  plan TEXT DEFAULT '',
  reflection TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  recycle_count INTEGER DEFAULT 0,
  rip_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- 만료된 글 자동 삭제를 위한 인덱스
CREATE INDEX idx_entries_expires_at ON entries (expires_at);

-- 태그 검색 인덱스
CREATE INDEX idx_entries_tags ON entries USING GIN (tags);

-- RLS (Row Level Security) 활성화
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기/쓰기 가능 (익명 서비스)
CREATE POLICY "Anyone can read entries"
  ON entries FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert entries"
  ON entries FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can delete expired entries"
  ON entries FOR DELETE
  USING (expires_at <= now());
```

### 1-3. API 키 확인
1. 좌측 메뉴 **Settings** → **API**
2. 다음 두 값을 메모:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGc...` (긴 문자열)

---

## 2단계: 로컬에서 테스트 (선택)

```bash
# 프로젝트 폴더에서
cp .env.example .env

# .env 파일을 열고 3개 값 입력
# VITE_SUPABASE_URL=https://xxxxx.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJhbGc...
# VITE_ENCRYPTION_KEY=아무-랜덤-문자열 (브라우저 콘솔에서 crypto.randomUUID() 실행)

npm install
npm run dev
```

브라우저에서 `http://localhost:5173` 확인

---

## 3단계: GitHub에 올리기

```bash
# GitHub에서 새 레포지토리 생성 (예: unfinished-research)
# 그 다음:

cd unfinished-research
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/unfinished-research.git
git push -u origin main
```

---

## 4단계: Vercel 배포 (무료, 3분)

1. [vercel.com](https://vercel.com) 접속 → GitHub 계정으로 로그인
2. **Add New → Project**
3. GitHub에서 `unfinished-research` 레포 선택 → **Import**
4. **Environment Variables** 섹션에서 세 개 추가:
   - `VITE_SUPABASE_URL` → Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` → Supabase anon key
   - `VITE_ENCRYPTION_KEY` → 암호화 키 (crypto.randomUUID()로 생성)
5. **Deploy** 클릭

배포 완료 후 `unfinished-research.vercel.app` 같은 주소가 생깁니다.

---

## 5단계: 자동 삭제 크론잡 (선택사항)

현재 구조에서는 사용자가 접속할 때마다 만료된 글이 정리됩니다.
더 깔끔하게 하려면 Supabase의 pg_cron 확장을 사용할 수 있습니다:

```sql
-- Supabase SQL Editor에서 실행
SELECT cron.schedule(
  'purge-expired-entries',
  '0 * * * *',  -- 매시간 정각
  $$DELETE FROM entries WHERE expires_at <= now()$$
);
```

이렇게 하면 매시간 만료된 글이 서버에서 자동 삭제됩니다.

---

## 구조 요약

```
unfinished-research/
├── index.html
├── package.json
├── vite.config.js
├── .env.example
├── .gitignore
└── src/
    ├── main.jsx
    ├── index.css
    ├── App.jsx
    ├── supabaseClient.js
    ├── crypto.js          ← 클라이언트 사이드 암호화
    ├── storage.js
    └── components/
        ├── WarmBackground.jsx
        ├── TagCloud.jsx
        └── EntryCloud.jsx
```

## 암호화 구조

이 사이트는 **클라이언트 사이드 암호화**를 사용합니다.

- **암호화 대상**: 제목, 연구 계획, 소회 (본문 전체)
- **평문 유지**: 태그 (태그 구름 기능을 위해)
- **방식**: AES-256-GCM (Web Crypto API + PBKDF2 키 파생)
- **결과**: Supabase DB에는 base64로 인코딩된 암호문만 저장됨

운영자가 Supabase 대시보드에서 DB를 열어도 이렇게 보입니다:

```
title: "dG9pYXNkZmFzZGZhc2RmYXNkZmFzZGY..."
reflection: "YWxza2RqZmFsc2tkamZhbHNrZGpm..."
tags: ["질적연구", "민족지"]  ← 이것만 읽을 수 있음
```

**주의사항**:
- `VITE_ENCRYPTION_KEY`를 변경하면 기존 글을 읽을 수 없게 됩니다
- 키는 프론트엔드 빌드에 포함되므로, 브라우저 개발자 도구로 추출 가능합니다
- 이 구조의 목적은 "DB를 들여다봐도 본문을 읽을 수 없다"는 것입니다

## 비용

- **Supabase 무료 플랜**: 500MB DB, 월 50만 요청
- **Vercel 무료 플랜**: 월 100GB 대역폭
- 소규모 커뮤니티 운영에는 충분합니다.

## 커스텀 도메인 (선택)

Vercel 대시보드 → Settings → Domains에서 직접 도메인을 연결할 수 있습니다.
도메인만 별도 구매하면 됩니다 (연 1-2만원).
