// Netlify 빌드 커맨드에서 실행됩니다 (netlify.toml 참고).
// Netlify 대시보드 > Site configuration > Environment variables 에 아래 키들을 등록해 두면
// 빌드할 때마다 이 스크립트가 public/js/firebase-config.js 를 자동 생성합니다.
// 로컬 개발 환경에서는 그냥 firebase-config.sample.js를 복사해서 값만 채워 쓰면 됩니다.

const fs = require("fs");
const path = require("path");

const required = [
  "FIREBASE_API_KEY",
  "FIREBASE_AUTH_DOMAIN",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_STORAGE_BUCKET",
  "FIREBASE_MESSAGING_SENDER_ID",
  "FIREBASE_APP_ID",
];

const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.warn(
    "[generate-firebase-config] 다음 환경변수가 없어 샘플 설정으로 빌드합니다:",
    missing.join(", ")
  );
}

const cfg = {
  apiKey: process.env.FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "YOUR_SENDER_ID",
  appId: process.env.FIREBASE_APP_ID || "YOUR_APP_ID",
};

const out = `// 이 파일은 빌드 시 scripts/generate-firebase-config.js 가 자동 생성합니다. 직접 수정하지 마세요.
export const firebaseConfig = ${JSON.stringify(cfg, null, 2)};
`;

const outPath = path.join(__dirname, "..", "public", "js", "firebase-config.js");
fs.writeFileSync(outPath, out, "utf-8");
console.log("[generate-firebase-config] firebase-config.js 생성 완료 ->", outPath);
