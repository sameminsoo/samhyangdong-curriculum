// ⚠️ 이 파일은 "샘플"입니다. 실제 키 값은 절대 여기에 적지 말고 GitHub에 커밋하지 마세요.
// 로컬 개발 시: 이 파일을 복사해서 public/js/firebase-config.js 로 저장한 뒤 실제 값을 채워 넣습니다.
// 운영(Netlify) 배포 시: 이 파일은 scripts/generate-firebase-config.js가
//   Netlify 환경변수(FIREBASE_API_KEY 등)를 읽어 빌드 시점에 자동 생성하므로 직접 만들 필요가 없습니다.

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
