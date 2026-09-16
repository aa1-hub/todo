# 메모장 투두 (자연어 입력 To-Do 웹앱)

문장에 날짜·요일·시간을 자연스럽게 쓰고 Enter만 누르면 마감일이 자동으로 등록되는
반응형 웹앱입니다. 지금 버전은 **이 기기(브라우저)에만 저장**되는 1단계 버전입니다.

## 로컬에서 실행해보기

```bash
npm install
npm run dev
```

`npm run dev`가 알려주는 주소(보통 http://localhost:5173)를 열면 바로 확인할 수 있습니다.

## 내 PC·모바일에서 접속할 수 있게 배포하기 (Vercel 예시)

1. 이 폴더를 GitHub 저장소로 올립니다.
   ```bash
   git init
   git add .
   git commit -m "메모장 투두 초기 버전"
   git branch -M main
   git remote add origin <내 GitHub 저장소 주소>
   git push -u origin main
   ```
2. https://vercel.com 에 접속해 GitHub 계정으로 로그인합니다.
3. "Add New… → Project"에서 방금 올린 저장소를 선택합니다.
4. Framework Preset은 자동으로 **Vite**로 인식됩니다. Build Command는
   `npm run build`, Output Directory는 `dist` 그대로 두고 "Deploy"를 누릅니다.
5. 배포가 끝나면 `https://프로젝트이름.vercel.app` 형태의 주소가 생깁니다. 이 주소로
   PC·모바일·태블릿 어디서나 같은 화면에 접속할 수 있습니다. (단, 지금 버전은
   기기별로 각자 브라우저에 저장되므로, 기기마다 저장된 목록은 서로 다릅니다.)

Netlify도 방식은 동일합니다: 저장소 연결 → Build command `npm run build` →
Publish directory `dist`.

## 다음 단계 (필요해지면 알려주세요)

- **여러 기기에서 같은 목록 보기**: Vercel KV, Supabase 같은 무료 저장소를 연결하면
  PC에서 입력한 항목을 모바일에서도 그대로 볼 수 있습니다.
- **매일 아침 이메일 알림**: 본인 이메일 계정(앱 비밀번호) 또는 발신 전용 이메일
  서비스(Resend 등)를 연결하고, Vercel Cron으로 매일 아침 8시에 미완료 업무를
  자동으로 메일로 보내도록 만들 수 있습니다.
- **CFS 실적 자동 정리**: 지금도 완료+CFS 대상 항목을 텍스트로 복사하는 기능은
  들어있습니다. 나중에 엑셀(xlsx) 파일로 바로 내보내는 기능도 추가할 수 있습니다.
