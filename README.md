# Study Planner (Next.js + Supabase + Vercel)

## 0) Reset / 초기화 가이드

### Supabase 초기화
1. SQL Editor 에서 핵심 테이블 **드롭** 후 재생성하거나, **새 프로젝트**를 만듭니다.
   ```sql
   drop table if exists evaluations cascade;
   drop table if exists sessions cascade;
   drop table if exists plans cascade;
   drop table if exists profiles cascade;
   drop type if exists user_role cascade;
   ```
2. `schema.sql` 파일을 그대로 실행하여 스키마/RLS를 재구성합니다.
3. Auth > Users 에서 기존 테스트 계정을 삭제하여 토큰/프로필을 정리합니다.

### Git 초기화
- 새로운 저장소로 시작하려면:
  ```bash
  rm -rf .git
  git init
  git add .
  git commit -m "init: clean slate"
  git branch -M main
  git remote add origin <your_repo_url>
  git push -u origin main
  ```

### Vercel 초기화
- 기존 프로젝트 연결을 끊고 새로 Import 하거나,
- 같은 repo 를 연결한 상태에서 **Environment Variables** 를 최신 값으로 업데이트한 뒤 **Redeploy** 하세요.
- 캐시 이슈가 의심되면 **Project Settings > Git > Ignore Build Step** 등을 활용해 클린 빌드를 유도합니다.

---

## 1) 설치
```bash
npm i
cp .env.example .env.local   # 값 채우기
npm run dev
```

## 2) 배포
- GitHub 푸시 → Vercel Import → ENV 세팅 → Deploy

## 3) Supabase 스키마
- `schema.sql` 참고
