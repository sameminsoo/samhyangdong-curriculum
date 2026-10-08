# 삼향동초 2026학년도 교육과정 수립 플랫폼

## 1단계 (완료)
- 작년(2026학년도) 교육계획 문서(PART 03 - Ⅵ. 교육과정 운영지원) 분석
- 19개 세부계획 + 업무분장표 구조 파악 → `public/js/data/curriculum-structure.json`
- 대시보드/사이드바 메뉴 뼈대 HTML/CSS/JS

## 2단계 (이번 업데이트)
- 부서별 온라인 에디터를 **Firestore 실데이터**와 연동 (`public/js/editor.js`)
  - 문서 경로: `opsPlans/{01~19}` (docId = 2자리 번호)
  - 가/나/다/라 섹션(세부계획마다 실제 라벨이 달라 구조적으로 가변 처리, 예: 06번은 "보결 수업 배당 원칙/수당")
  - 입력 멈춘 뒤 1.5초 후 자동 임시저장(autosave) + 수동 "임시저장"/"작성 완료·제출" 버튼
  - 상태 배지: 저장됨 / 저장 중 / 변경사항 있음 / 임시저장됨 N분 전 / 오류 / 제출완료(잠김)
  - 실시간 리스너(onSnapshot)로 다른 교사가 저장하면 "마지막 저장자/시간" 즉시 갱신
- Firebase 설정값 분리
  - `public/js/firebase-config.sample.js` : 커밋되는 템플릿
  - `public/js/firebase-config.js` : 실제 키(절대 커밋 금지, `.gitignore` 처리)
  - Netlify 배포 시 `scripts/generate-firebase-config.js`가 **빌드 시점에 환경변수→설정파일**로 자동 변환
- `firestore.rules` : 역할(`teachers/{uid}.role`)과 담당 세부계획(`assignedPlans`) 기반 권한 분리
  - 교사: 자신이 배정된 세부계획만, `approved` 상태가 아닐 때만 본문 수정 가능
  - 관리자: 모든 세부계획 열람/수정/승인 가능
  - 핵심 메타(제목/부서/담당자/번호)는 교사가 변경 불가 (관리자만)

## Firestore 데이터 모델
```
teachers/{uid}
  name, email, role: 'teacher' | 'admin', assignedPlans: ['01','06', ...]

opsPlans/{01..19}
  no, title, dept, owners[], status: 'draft'|'submitted'|'approved',
  sections: [{key:'가', label:'목적', content:'...'}, ...],
  updatedAt, updatedBy: {uid, name}

surveys/{surveyId}
  title, targetGroup, questions[], ...
surveys/{surveyId}/responses/{responseId}
  respondentId, answers, submittedAt

guidelines/{guidelineId}
  title, fileUrl, summary, uploadedAt
```

## Netlify 환경변수 (Site settings > Environment variables)
```
FIREBASE_API_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_PROJECT_ID
FIREBASE_STORAGE_BUCKET
FIREBASE_MESSAGING_SENDER_ID
FIREBASE_APP_ID
```
빌드 커맨드(`netlify.toml`에 설정됨): `node scripts/generate-firebase-config.js`

## 로컬 개발
```
cp public/js/firebase-config.sample.js public/js/firebase-config.js
# firebase-config.js 안의 값을 Firebase 콘솔 > 프로젝트 설정 값으로 채운 뒤
npx serve public      # 또는 선호하는 정적 서버
```

## Firestore 초기 세팅 체크리스트 (Firebase 콘솔에서 1회 작업)
1. Authentication > Email/Password 로그인 방식 활성화, 교직원 계정 생성
2. Firestore에 `teachers/{uid}` 문서 수동 생성 — 최소 관리자 1명 `role:'admin'` 지정
3. `firebase deploy --only firestore:rules,storage:rules` 로 보안 규칙 배포
4. (선택) 19개 세부계획 담당자(assignedPlans)를 관리자가 `teachers/{uid}` 문서에 입력

## 다음 단계(3단계) TODO
- 설문조사 Chart.js 실시간 시각화 연동
- 교육청 지침 파일 업로드 → 요약(AI) 파이프라인
- 부서별 작성 완료본을 원본 서식(표/폰트) 유지한 채 `.hwpx`로 자동 취합/다운로드
