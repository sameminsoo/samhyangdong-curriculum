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
let currentDeptId = null;

const sidebarNav = document.getElementById('sidebarNav');
const opsPlanTable = document.getElementById('opsPlanTable');
const viewLogin = document.getElementById('view-login');
const viewDashboard = document.getElementById('view-dashboard');
const viewEditor = document.getElementById('view-editor');
const pageTitle = document.getElementById('pageTitle');
const editorTitle = document.getElementById('editorTitle');
const editorArea = document.getElementById('editorArea');
const btnSaveEditor = document.getElementById('btnSaveEditor');
const editorSaveStatus = document.getElementById('editorSaveStatus');
const userName = document.getElementById('userName');
const btnLogout = document.getElementById('btnLogout');

const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginBtn = document.getElementById('btnLoginSubmit');
const loginMessage = document.getElementById('loginMessage');

// 로그인 상태 감지
onAuthStateChanged(auth, (user) => {
  if (user) {
    const userEmailPrefix = user.email.split('@')[0];
    if (userName) userName.innerText = `👤 ${userEmailPrefix} 선생님`;
    if (btnLogout) btnLogout.classList.remove('view--hidden');
    
    if (viewLogin) viewLogin.classList.add('view--hidden');
    if (viewDashboard) viewDashboard.classList.remove('view--hidden');
    
    initAppContent();
  } else {
    if (userName) userName.innerText = "";
    if (btnLogout) btnLogout.classList.add('view--hidden');
    
    if (viewLogin) viewLogin.classList.remove('view--hidden');
    if (viewDashboard) viewDashboard.classList.add('view--hidden');
    if (viewEditor) viewEditor.classList.add('view--hidden');
  }
});

async function initAppContent() {
  try {
    const res = await fetch('./js/data/curriculum-structure.json');
    if (!res.ok) throw new Error("JSON 로드 실패");
    curriculumData = await res.json();
    
    renderSidebar();
    renderDashboardTable();
  } catch (err) {
    console.error("데이터 로드 오류:", err);
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
  currentDeptId = deptId;

  if (viewName === 'dashboard') {
    if (viewDashboard) viewDashboard.classList.remove('view--hidden');
    if (viewEditor) viewEditor.classList.add('view--hidden');
    if (pageTitle) pageTitle.innerText = "대시보드";
  } else if (viewName === 'editor') {
    if (viewDashboard) viewDashboard.classList.add('view--hidden');
    if (viewEditor) viewEditor.classList.remove('view--hidden');
    
    let deptInfo = null;
    if (curriculumData && curriculumData.parts) {
      curriculumData.parts.forEach(p => {
        if (p.departments) {
          const found = p.departments.find(d => d.id === deptId);
          if (found) deptInfo = found;
        }
      });
    }

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

// 로그인 실행 함수
async function handleLogin() {
  const email = loginEmail.value.trim();
  const password = loginPassword.value.trim();

  if (!email || !password) {
    if (loginMessage) {
      loginMessage.style.color = "#e74c3c";
      loginMessage.innerText = "⚠️ 이메일과 비밀번호를 모두 입력해주세요.";
    }
    return;
  }

  if (loginMessage) {
    loginMessage.style.color = "#3498db";
    loginMessage.innerText = "⏳ 로그인 처리 중입니다...";
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    if (loginMessage) loginMessage.innerText = "";
  } catch (err) {
    console.error(err);
    if (loginMessage) {
      loginMessage.style.color = "#e74c3c";
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        loginMessage.innerText = "❌ 이메일 또는 비밀번호가 올바르지 않습니다.";
      } else {
        loginMessage.innerText = "❌ 로그인 오류: " + err.message;
      }
    }
  }
}

// 이벤트 등록
if (loginBtn) {
  loginBtn.addEventListener('click', handleLogin);
}

if (loginPassword) {
  loginPassword.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
}

if (btnLogout) {
  btnLogout.addEventListener('click', async () => {
    if (confirm("로그아웃 하시겠습니까?")) {
      await signOut(auth);
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
