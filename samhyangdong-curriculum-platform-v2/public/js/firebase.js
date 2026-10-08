// Firebase 초기화 모듈. 다른 js 파일에서는 이 파일에서 app/auth/db만 import해서 쓴다.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  collection,
  addDoc,
  enableIndexedDbPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// 오프라인 중 작성한 내용도 끊기지 않고 로컬 캐시 후 재연결 시 동기화되도록 설정
try {
  enableIndexedDbPersistence(db);
} catch (e) {
  console.warn("[firebase] 오프라인 캐시를 켤 수 없습니다(다중 탭 등):", e.message);
}

export {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  collection,
  addDoc,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
};

// 로그인한 교사 정보를 앱 전역에서 쓸 수 있게 간단히 캐싱
export let currentUser = null;
export function watchAuth(onChange) {
  return onAuthStateChanged(auth, (user) => {
    currentUser = user;
    onChange(user);
  });
}
