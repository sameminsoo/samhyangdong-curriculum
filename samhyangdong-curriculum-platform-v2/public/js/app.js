import {
  auth, db, watchAuth, signInWithEmailAndPassword, signOut,
  doc, getDoc, collection, onSnapshot,
} from "./firebase.js";
import { renderEditor, disposeEditor } from "./editor.js";

let structure = null;
let planStatusMap = {}; // docId -> status (대시보드 진행률 표시용)

const els = {
  app: document.getElementById("app"),
  sidebar: document.getElementById("sidebarMenu"),
  main: document.getElementById("mainView"),
  userBox: document.getElementById("userBox"),
  loginScreen: document.getElementById("loginScreen"),
};

async function loadStructure() {
  const res = await fetch("./js/data/curriculum-structure.json");
  structure = await res.json();
}

function buildSidebar() {
  const groups = {};
  structure.plans.forEach((p) => {
    groups[p.dept] = groups[p.dept] || [];
    groups[p.dept].push(p);
  });

  els.sidebar.innerHTML = `
    <button class="menu-item" data-route="dashboard">대시보드</button>
    <button class="menu-item" data-route="survey">설문조사</button>
    <button class="menu-item" data-route="guideline">교육청 지침</button>
    <button class="menu-item" data-route="export">최종 취합(.hwpx)</button>
    <div class="menu-divider">PART 03 · Ⅵ 교육과정 운영지원 (19개 세부계획)</div>
    ${Object.entries(groups).map(([dept, items]) => `
      <div class="menu-group">
        <div class="menu-group-title">${dept}</div>
        ${items.map((p) => `
          <button class="menu-item menu-item-plan" data-route="editor" data-no="${p.no}">
            <span class="plan-no">${String(p.no).padStart(2, "0")}</span>
            <span class="plan-title">${p.title}</span>
            <span class="plan-status" id="menuStatus-${p.no}"></span>
          </button>
        `).join("")}
      </div>
    `).join("")}
  `;

  els.sidebar.addEventListener("click", (e) => {
    const btn = e.target.closest(".menu-item");
    if (!btn) return;
    route(btn.dataset.route, btn.dataset.no);
  });
}

function watchAllPlanStatus() {
  onSnapshot(collection(db, "opsPlans"), (qs) => {
    qs.forEach((d) => {
      planStatusMap[d.id] = d.data().status || "draft";
      const no = Number(d.id);
      const badge = document.getElementById(`menuStatus-${no}`);
      if (badge) {
        badge.textContent = planStatusMap[d.id] === "submitted" ? "제출완료" : "작성중";
        badge.className = "plan-status " + (planStatusMap[d.id] === "submitted" ? "plan-status-done" : "plan-status-draft");
      }
    });
    if (location.hash === "#dashboard" || location.hash === "") renderDashboard();
  });
}

function renderDashboard() {
  disposeEditor();
  const total = structure.plans.length;
  const done = structure.plans.filter((p) => planStatusMap[p.docId] === "submitted").length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  els.main.innerHTML = `
    <h1>2026학년도 교육과정 수립 대시보드</h1>
    <div class="card-grid">
      <div class="metric-card">
        <div class="metric-number">${pct}%</div>
        <div class="metric-label">부서별 세부계획 제출률 (${done}/${total})</div>
      </div>
      <div class="metric-card">
        <div class="metric-number">${total - done}</div>
        <div class="metric-label">작성 중 / 미제출 세부계획</div>
      </div>
    </div>
    <h2>부서별 진행 현황</h2>
    <table class="status-table">
      <thead><tr><th>번호</th><th>세부계획명</th><th>담당부서</th><th>담당자</th><th>상태</th></tr></thead>
      <tbody>
        ${structure.plans.map((p) => `
          <tr>
            <td>${String(p.no).padStart(2, "0")}</td>
            <td><a href="#editor-${p.no}">${p.title}</a></td>
            <td>${p.dept}</td>
            <td>${p.owners.join(", ")}</td>
            <td>${planStatusMap[p.docId] === "submitted" ? '<span class="plan-status-done">제출완료</span>' : '<span class="plan-status-draft">작성중</span>'}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function route(name, no) {
  disposeEditor();
  if (name === "editor") {
    location.hash = `editor-${no}`;
    renderEditor(els.main, no, auth.currentUser);
  } else {
    location.hash = name;
    if (name === "dashboard") renderDashboard();
    else els.main.innerHTML = `<p class="empty">[${name}] 화면은 다음 단계에서 연동 예정입니다.</p>`;
  }
}

function handleInitialHash() {
  const h = location.hash.replace("#", "");
  if (h.startsWith("editor-")) {
    route("editor", h.split("-")[1]);
  } else if (h) {
    route(h);
  } else {
    route("dashboard");
  }
}

// ---------------- 로그인 ----------------
function showLogin(show) {
  els.loginScreen.style.display = show ? "flex" : "none";
  els.app.style.display = show ? "none" : "grid";
}

els.loginScreen?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value;
  const pw = document.getElementById("loginPassword").value;
  const errBox = document.getElementById("loginError");
  errBox.textContent = "";
  try {
    await signInWithEmailAndPassword(auth, email, pw);
  } catch (err) {
    errBox.textContent = "로그인 실패: 이메일/비밀번호를 확인해주세요.";
  }
});

document.getElementById("btnLogout")?.addEventListener("click", () => signOut(auth));

watchAuth(async (user) => {
  if (!user) {
    showLogin(true);
    return;
  }
  showLogin(false);
  els.userBox.textContent = `${user.displayName || user.email} 님`;
  if (!structure) {
    await loadStructure();
    buildSidebar();
    watchAllPlanStatus();
    handleInitialHash();
  }
});

window.addEventListener("hashchange", () => {
  if (auth.currentUser) handleInitialHash();
});
