// 부서별(19개 세부계획) 온라인 에디터
// - Firestore(opsPlans/{docId})와 실시간 연동
// - 입력 멈춘 뒤 자동 임시저장(autosave), 수동 "임시저장"/"제출" 버튼 제공
// - 상단에 저장 상태 배지(저장됨 / 저장 중 / 임시저장됨 N분 전 / 오류 / 제출완료) 표시

import {
  db, doc, getDoc, setDoc, onSnapshot, serverTimestamp, currentUser,
} from "./firebase.js";

const AUTOSAVE_DELAY_MS = 1500; // 입력이 멈춘 뒤 1.5초 후 자동 임시저장

let structureCache = null;
let activeUnsub = null;       // 현재 열려있는 에디터의 onSnapshot 구독 해제 함수
let autosaveTimer = null;
let dirty = false;            // 마지막 저장 이후 변경 여부

async function loadStructure() {
  if (structureCache) return structureCache;
  const res = await fetch("./js/data/curriculum-structure.json");
  structureCache = await res.json();
  return structureCache;
}

function planMeta(no) {
  return structureCache.plans.find((p) => p.no === Number(no));
}

// ---------- 상태 배지 ----------
function setStatusBadge(el, state, extra = "") {
  const map = {
    saved:    { text: "저장됨", cls: "badge-saved" },
    saving:   { text: "저장 중…", cls: "badge-saving" },
    dirty:    { text: "변경사항 있음 (자동저장 대기)", cls: "badge-dirty" },
    draftSaved: { text: `임시저장됨 · ${extra}`, cls: "badge-draft" },
    error:    { text: "저장 실패 — 다시 시도해주세요", cls: "badge-error" },
    submitted:{ text: "제출 완료 (잠김)", cls: "badge-submitted" },
    offline:  { text: "오프라인 — 연결되면 자동 동기화됩니다", cls: "badge-error" },
  };
  const info = map[state] || map.saved;
  el.textContent = info.text;
  el.className = "status-badge " + info.cls;
}

function timeAgo(ts) {
  if (!ts) return "방금 전";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diffSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (diffSec < 60) return "방금 전";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`;
  return `${Math.floor(diffSec / 3600)}시간 전`;
}

// ---------- 에디터 렌더링 ----------
export async function renderEditor(container, planNo, user) {
  await loadStructure();
  const meta = planMeta(planNo);
  if (!meta) {
    container.innerHTML = `<p class="empty">해당 세부계획(${planNo})을 찾을 수 없습니다.</p>`;
    return;
  }

  // 이전에 열려있던 에디터 구독 정리 (메모리 누수/중복 저장 방지)
  if (activeUnsub) { activeUnsub(); activeUnsub = null; }
  clearTimeout(autosaveTimer);
  dirty = false;

  const docRef = doc(db, "opsPlans", meta.docId);
  let snap = await getDoc(docRef);

  // 최초 1회도 열린 적 없는 세부계획이면 구조 메타로 초기 문서 생성
  if (!snap.exists()) {
    const initial = {
      no: meta.no,
      title: meta.title,
      dept: meta.dept,
      owners: meta.owners,
      status: "draft",
      sections: meta.sections.map((s) => ({ key: s.key, label: s.label, content: "" })),
      updatedAt: serverTimestamp(),
      updatedBy: { uid: user?.uid || "unknown", name: user?.displayName || user?.email || "익명" },
      version: 1,
    };
    await setDoc(docRef, initial);
    snap = await getDoc(docRef);
  }

  const data = snap.data();
  const locked = data.status === "submitted" || data.status === "approved";

  container.innerHTML = `
    <div class="editor-head">
      <div>
        <h2>${meta.no}. ${meta.title}</h2>
        <p class="editor-meta">담당부서: ${meta.dept} · 담당자: ${meta.owners.join(", ")}</p>
      </div>
      <span class="status-badge" id="statusBadge">불러오는 중…</span>
    </div>

    <div class="editor-toolbar">
      <span id="lastSavedInfo" class="last-saved-info"></span>
      <div class="toolbar-actions">
        <button id="btnDraftSave" class="btn btn-secondary">임시저장</button>
        <button id="btnSubmit" class="btn btn-primary">${locked ? "제출 취소(다시 작성)" : "작성 완료 · 제출"}</button>
      </div>
    </div>

    <div class="editor-sections" id="editorSections"></div>
  `;

  const sectionsWrap = container.querySelector("#editorSections");
  const statusBadge = container.querySelector("#statusBadge");
  const lastSavedInfo = container.querySelector("#lastSavedInfo");

  data.sections.forEach((sec, idx) => {
    const block = document.createElement("div");
    block.className = "editor-block";
    block.innerHTML = `
      <label class="editor-block-label">${sec.key}. ${sec.label}</label>
      <textarea class="editor-textarea" data-idx="${idx}"
        ${locked ? "readonly" : ""}
        placeholder="${sec.label} 내용을 입력하세요. (예: 1) 2) 번호를 붙여 줄바꿈하면 원문 서식과 동일하게 표시됩니다.)">${sec.content || ""}</textarea>
      <div class="char-count" data-idx="${idx}">${(sec.content || "").length}자</div>
    `;
    sectionsWrap.appendChild(block);
  });

  if (locked) setStatusBadge(statusBadge, "submitted");
  else setStatusBadge(statusBadge, "saved");
  lastSavedInfo.textContent = data.updatedAt
    ? `마지막 저장: ${data.updatedBy?.name || ""} · ${timeAgo(data.updatedAt)}`
    : "";

  // ---------- 입력 -> 자동 임시저장(debounce) ----------
  function collectSections() {
    return Array.from(sectionsWrap.querySelectorAll(".editor-textarea")).map((ta, idx) => ({
      key: data.sections[idx].key,
      label: data.sections[idx].label,
      content: ta.value,
    }));
  }

  async function doSave({ markSubmitted } = {}) {
    clearTimeout(autosaveTimer);
    setStatusBadge(statusBadge, "saving");
    try {
      await setDoc(
        docRef,
        {
          sections: collectSections(),
          status: markSubmitted === true ? "submitted" : markSubmitted === false ? "draft" : data.status,
          updatedAt: serverTimestamp(),
          updatedBy: { uid: user?.uid || "unknown", name: user?.displayName || user?.email || "익명" },
        },
        { merge: true }
      );
      dirty = false;
      if (markSubmitted === true) {
        setStatusBadge(statusBadge, "submitted");
      } else {
        setStatusBadge(statusBadge, "draftSaved", "방금 전");
      }
    } catch (err) {
      console.error(err);
      setStatusBadge(
        statusBadge,
        navigator.onLine ? "error" : "offline"
      );
    }
  }

  if (!locked) {
    sectionsWrap.addEventListener("input", (e) => {
      if (!e.target.classList.contains("editor-textarea")) return;
      dirty = true;
      const idx = e.target.dataset.idx;
      sectionsWrap.querySelector(`.char-count[data-idx="${idx}"]`).textContent = `${e.target.value.length}자`;
      setStatusBadge(statusBadge, "dirty");
      clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(() => doSave(), AUTOSAVE_DELAY_MS);
    });

    container.querySelector("#btnDraftSave").addEventListener("click", () => doSave({ markSubmitted: false }));
    container.querySelector("#btnSubmit").addEventListener("click", async () => {
      const emptyCount = collectSections().filter((s) => !s.content.trim()).length;
      if (emptyCount > 0 && !confirm(`비어있는 항목이 ${emptyCount}개 있습니다. 그래도 제출하시겠습니까?`)) return;
      await doSave({ markSubmitted: true });
      renderEditor(container, planNo, user); // 잠금 상태로 재렌더
    });
  } else {
    container.querySelector("#btnSubmit").addEventListener("click", async () => {
      await doSave({ markSubmitted: false });
      renderEditor(container, planNo, user); // 다시 편집 가능 상태로 재렌더
    });
  }

  // ---------- 다른 교사가 같은 문서를 수정하면 실시간으로 안내 ----------
  activeUnsub = onSnapshot(docRef, (liveSnap) => {
    const live = liveSnap.data();
    if (!live) return;
    const myUid = user?.uid || "unknown";
    if (live.updatedBy && live.updatedBy.uid !== myUid && !dirty) {
      lastSavedInfo.textContent = `마지막 저장: ${live.updatedBy.name} · ${timeAgo(live.updatedAt)}`;
    }
    if (live.status !== data.status) {
      data.status = live.status; // 다른 탭/관리자가 상태를 바꾼 경우 동기화
    }
  });

  // 페이지 이탈 시 저장 안 된 변경사항 경고
  window.onbeforeunload = () => (dirty ? "저장하지 않은 변경사항이 있습니다." : undefined);
}

export function disposeEditor() {
  if (activeUnsub) { activeUnsub(); activeUnsub = null; }
  clearTimeout(autosaveTimer);
  window.onbeforeunload = null;
}
