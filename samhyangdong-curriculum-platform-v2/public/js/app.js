import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase 설정 (복사해 오신 진짜 키 적용)
const firebaseConfig = {
  apiKey: "AIzaSyCguRGFdOjO7ezQjOcrKTUwqICABZlXVb0",
  authDomain: "samhyangdong-curriculum-604b2.firebaseapp.com",
  projectId: "samhyangdong-curriculum-604b2",
  storageBucket: "samhyangdong-curriculum-604b2.firebasestorage.app",
  messagingSenderId: "957384809335",
  appId: "1:957384809335:web:4f81449831187c07c51f72"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let curriculumData = null;
let currentView = 'dashboard';
let currentDeptId = null;

const sidebarNav = document.getElementById('sidebarNav');
const opsPlanTable = document.getElementById('opsPlanTable');
const viewDashboard = document.getElementById('view-dashboard');
const viewEditor = document.getElementById('view-editor');
const pageTitle = document.getElementById('pageTitle');
const editorTitle = document.getElementById('editorTitle');
const editorArea = document.getElementById('editorArea');
const btnSaveEditor = document.getElementById('btnSaveEditor');
const editorSaveStatus = document.getElementById('editorSaveStatus');
const userNameBtn = document.getElementById('userName');

// 로그인 상태 감지
onAuthStateChanged(auth, (user) => {
  if (user && userNameBtn) {
    const userEmailPrefix = user.email.split('@')[0];
    userNameBtn.innerText = `👤 ${userEmailPrefix} (로그아웃)`;
  } else if (userNameBtn) {
    userNameBtn.innerText = "🔑 교사 로그인";
  }
});

// 앱 초기화 (경로를 현재 폴더 구조에 맞춰 ./js/data/... 로 수정함)
async function initApp() {
  try {
    const res = await fetch('./js/data/curriculum-structure.json');
    if (!res.ok) throw new Error("JSON 로드 실패");
    curriculumData = await res.json();
    
    renderSidebar();
    renderDashboardTable();
    setupEventListeners();
  } catch (err) {
    console.error("앱 초기화 오류:", err);
  }
}

function renderSidebar() {
  if (!sidebarNav || !curriculumData) return;
  let html = `<div class="nav-item active" data-view="dashboard">📊 대시보드</div>`;
  if (curriculumData.parts) {
    curriculumData.parts.forEach(part => {
      html += `<div class="nav-group-title">${part.title}</div>`;
      if (part.departments) {
        part.departments.forEach(dept => {
          html += `<div class="nav-item" data-view="editor" data-dept-id="${dept.id}">${dept.name}</div>`;
        });
      }
    });
  }
  sidebarNav.innerHTML = html;
}

function renderDashboardTable() {
  if (!opsPlanTable || !curriculumData) return;
  const tbody = opsPlanTable.querySelector('tbody');
  if (!tbody) return;

  let rows = '';
  let index = 1;
  if (curriculumData.parts) {
    curriculumData.parts.forEach(part => {
      if (part.departments) {
        part.departments.forEach(dept => {
          rows += `
            <tr style="cursor:pointer;" data-dept-id="${dept.id}">
              <td>${index++}</td>
              <td><strong>${dept.name}</strong></td>
              <td>${dept.owner || '담당자'}</td>
              <td>${dept.team || '교무부'}</td>
              <td><span class="badge">작성전</span></td>
              <td><button class="btn btn--sm">편집</button></td>
            </tr>
          `;
        });
      }
    });
  }
  tbody.innerHTML = rows;
}

function switchView(viewName, deptId = null) {
  currentView = viewName;
  currentDeptId = deptId;

  if (viewName === 'dashboard') {
    if (viewDashboard) viewDashboard.classList.remove('view--hidden');
    if (viewEditor) viewEditor.classList.add('view--hidden');
    if (pageTitle) pageTitle.innerText = "대시보드";
  } else if (viewName === 'editor') {
    if (viewDashboard) viewDashboard.classList.add('view--hidden');
    if (viewEditor) viewEditor.classList.remove('view--hidden');
    
    let deptInfo = null;
    curriculumData.parts.forEach(p => {
      if (p.departments) {
        const found = p.departments.find(d => d.id === deptId);
        if (found) deptInfo = found;
      }
    });

    if (pageTitle) pageTitle.innerText = `${deptInfo ? deptInfo.name : '업무'} 편집`;
    if (editorTitle) editorTitle.innerText = deptInfo ? deptInfo.name : '업무 편집';
    
    loadDeptContent(deptId);
  }
}

async function loadDeptContent(deptId) {
  if (!deptId) return;
  if (editorSaveStatus) editorSaveStatus.innerText = "⏳ 데이터 불러오는 중...";

  try {
    const docRef = doc(db, "curriculum", deptId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists() && editorArea) {
      editorArea.innerHTML = docSnap.data().content || getInitialTemplate();
      if (editorSaveStatus) editorSaveStatus.innerText = "🟢 Cloud Firestore 동기화됨";
    } else if (editorArea) {
      editorArea.innerHTML = getInitialTemplate();
      if (editorSaveStatus) editorSaveStatus.innerText = "⚪ 작성된 내용이 없습니다.";
    }
  } catch (err) {
    console.error("부서 읽기 오류:", err);
    if (editorSaveStatus) editorSaveStatus.innerText = "🔴 불러오기 실패";
  }
}

function getInitialTemplate() {
  return `
    <h3>가. 목적</h3><p>1) </p>
    <h3>나. 방침</h3><p>1) </p>
    <h3>다. 세부 계획</h3><p>※ 세부 추진 내용을 입력하세요.</p>
    <h3>라. 기대 효과</h3><p>1) </p>
  `;
}

function setupEventListeners() {
  if (userNameBtn) {
    userNameBtn.addEventListener('click', async () => {
      if (auth.currentUser) {
        if (confirm("로그아웃 하시겠습니까?")) {
          await signOut(auth);
        }
      } else {
        const email = prompt("이메일 주소를 입력하세요:");
        if (!email) return;
        const password = prompt("비밀번호를 입력하세요:");
        if (!password) return;

        try {
          await signInWithEmailAndPassword(auth, email, password);
          alert("로그인되었습니다.");
        } catch (err) {
          alert("로그인 실패: " + err.message);
        }
      }
    });
  }

  if (sidebarNav) {
    sidebarNav.addEventListener('click', (e) => {
      const item = e.target.closest('.nav-item');
      if (!item) return;
      switchView(item.dataset.view, item.dataset.deptId);
    });
  }

  if (opsPlanTable) {
    opsPlanTable.addEventListener('click', (e) => {
      const tr = e.target.closest('tr');
      if (tr && tr.dataset.deptId) switchView('editor', tr.dataset.deptId);
    });
  }

  if (btnSaveEditor) {
    btnSaveEditor.addEventListener('click', async () => {
      if (!currentDeptId) return;
      if (editorSaveStatus) editorSaveStatus.innerText = "⏳ 저장 중...";

      try {
        const content = editorArea ? editorArea.innerHTML : '';
        await setDoc(doc(db, "curriculum", currentDeptId), {
          content: content,
          updatedAt: new Date().toISOString(),
          updatedBy: auth.currentUser ? auth.currentUser.email : "익명"
        }, { merge: true });

        if (editorSaveStatus) editorSaveStatus.innerText = "✅ Firestore 실시간 저장 완료!";
      } catch (err) {
        if (editorSaveStatus) editorSaveStatus.innerText = "❌ 저장 실패: " + err.message;
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', initApp);
