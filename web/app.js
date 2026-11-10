/* ================= 우울 평가 웹앱 ================= */

const STORAGE_KEY = "depeval-web-v1";

/* ---- 매일 기분 모니터링 체크리스트 (PHQ-2) ---- */
const DAILY_QUESTIONS = [
  "기분이 가라앉거나, 우울하거나, 희망이 없다고 느꼈다.",
  "평소 하던 일에 대한 흥미나 즐거움이 거의 없었다.",
];
const DAILY_OPTIONS = ["전혀 없음", "약간", "상당히", "매우 심함"];

/* ---- PHQ-9 (주 1회) ---- */
const PHQ9_QUESTIONS = [
  "일 또는 여가 활동을 하는 데 흥미나 즐거움을 느끼지 못함",
  "기분이 가라앉거나, 우울하거나, 희망이 없음",
  "잠이 들거나 계속 잠을 자는 것이 어려움, 또는 잠을 너무 많이 잠",
  "피곤하다고 느끼거나 기운이 거의 없음",
  "입맛이 없거나 과식을 함",
  "자신을 부정적으로 봄 – 혹은 자신이 실패자라고 느끼거나 자신 또는 가족을 실망시켰다고 느낌",
  "신문을 읽거나 텔레비전 보는 것과 같은 일에 집중하는 것이 어려움",
  "다른 사람들이 주목할 정도로 너무 느리게 움직이거나 말을 함. 또는 반대로 평상시보다 많이 움직여서, 너무 안절부절 못하거나 들떠 있음",
  "자신이 죽는 것이 더 낫다고 생각하거나 어떤 식으로든 자신을 해칠 것이라고 생각함",
];
const PHQ9_OPTIONS = ["전혀 방해 받지 않았다", "며칠 동안 방해 받았다", "7일 이상 방해 받았다", "거의 매일 방해 받았다"];

function phq9Severity(t) {
  if (t <= 4) return "우울 아님 (0–4)";
  if (t <= 9) return "가벼운 우울 (5–9)";
  if (t <= 14) return "중간 정도 우울 (10–14)";
  if (t <= 19) return "약간 심한 우울 (15–19)";
  return "심한 우울 (20–27)";
}

/* ================= 저장 ================= */
function loadData() {
  try {
    const d = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { daily: d?.daily || [], weekly: d?.weekly || [] };
  } catch {
    return { daily: [], weekly: [] };
  }
}
function saveData() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }
  catch { alert("기록을 저장하지 못했습니다. 브라우저 저장 공간 설정을 확인해 주세요."); }
}
let store = loadData();

/* ---- 유틸 ---- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function todayInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const byDate = (a, b) => a.date.localeCompare(b.date);

/* ================= 탭 ================= */
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    $(tab.dataset.tab).classList.add("active");
    if (tab.dataset.tab === "analysis") renderAnalysis();
  });
});

/* ================= 0~3점 문항 공통 ================= */
function buildQuestions(olId, prefix, questions, options, onChange) {
  const ol = $(olId);
  ol.innerHTML = "";
  questions.forEach((q, i) => {
    const li = document.createElement("li");
    li.className = "q-item";
    const opts = options
      .map((o, v) => `<label><input type="radio" name="${prefix}${i}" value="${v}" />` +
        `<span class="opt-btn"><span class="pt">${v}</span>${o}</span></label>`)
      .join("");
    li.innerHTML = `<div class="q-text"><span class="q-num">${i + 1}.</span>${q}</div>
      <div class="opt-group" role="radiogroup">${opts}</div>`;
    ol.appendChild(li);
  });
  ol.addEventListener("change", onChange);
}
function readAnswers(prefix, n) {
  return Array.from({ length: n }, (_, i) => {
    const sel = document.querySelector(`input[name="${prefix}${i}"]:checked`);
    return sel ? parseInt(sel.value, 10) : null;
  });
}
const sum = (arr) => arr.reduce((s, v) => s + (v || 0), 0);

/* 같은 날짜 기록이 있으면 덮어쓸지 확인 후 저장 */
function upsertByDate(list, rec, label) {
  const idx = list.findIndex((r) => r.date === rec.date);
  if (idx >= 0) {
    if (!confirm(`${rec.date} ${label} 기록이 이미 있습니다. 새 내용으로 바꿀까요?`)) return false;
    rec.id = list[idx].id;
    list[idx] = rec;
  } else {
    list.push(rec);
  }
  list.sort(byDate);
  return true;
}

/* ================= 매일 기분 체크 ================= */
function updateDaily() {
  $("phq2-total").textContent = sum(readAnswers("d", DAILY_QUESTIONS.length));
  $("mood-value").textContent = $("mood-range").value;
}
$("mood-range").addEventListener("input", updateDaily);

$("daily-save").addEventListener("click", () => {
  const answers = readAnswers("d", DAILY_QUESTIONS.length);
  if (answers.some((a) => a === null)) { alert("1, 2번 문항에 모두 응답해 주세요."); return; }
  const hoursRaw = $("sleep-hours").value.trim();
  const hours = hoursRaw === "" ? null : parseFloat(hoursRaw);
  if (hours !== null && (isNaN(hours) || hours < 0 || hours > 24)) { alert("수면 시간은 0~24 사이로 입력해 주세요."); return; }
  const q = document.querySelector('input[name="sleep-q"]:checked');
  const rec = {
    id: uid(),
    date: $("daily-date").value || todayInput(),
    answers,
    phq2: sum(answers),
    mood: parseInt($("mood-range").value, 10),
    sleepHours: hours,
    sleepQuality: q ? q.value : "",
    event: $("daily-event").value.trim(),
  };
  if (!upsertByDate(store.daily, rec, "매일 기분")) return;
  saveData();
  resetDailyForm();
  renderDailyTable();
});
$("daily-reset").addEventListener("click", resetDailyForm);

function resetDailyForm() {
  document.querySelectorAll('#daily input[type="radio"]').forEach((r) => (r.checked = false));
  $("mood-range").value = 5;
  $("sleep-hours").value = "";
  $("daily-event").value = "";
  $("daily-date").value = todayInput();
  updateDaily();
}

function renderDailyTable() {
  const tbody = document.querySelector("#daily-table tbody");
  tbody.innerHTML = "";
  const has = store.daily.length > 0;
  $("daily-empty").style.display = has ? "none" : "block";
  $("daily-table").style.display = has ? "" : "none";
  [...store.daily].sort(byDate).reverse().forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(r.date)}</td><td>${r.answers[0]}</td><td>${r.answers[1]}</td>
      <td class="total-cell">${r.phq2}</td><td>${r.mood}</td>
      <td>${r.sleepHours ?? "—"}${r.sleepHours != null ? "h" : ""}</td><td>${esc(r.sleepQuality) || "—"}</td>
      <td class="note-cell">${esc(r.event) || "—"}</td>
      <td><button class="btn link" data-del-daily="${esc(r.id)}">삭제</button></td>`;
    tbody.appendChild(tr);
  });
}

/* ================= 주간 PHQ-9 ================= */
function updateWeekly() {
  const answers = readAnswers("w", PHQ9_QUESTIONS.length);
  const t = sum(answers);
  $("phq9-total").textContent = t;
  const answered = answers.filter((a) => a !== null).length;
  $("phq9-severity").innerHTML = answered === PHQ9_QUESTIONS.length
    ? `해석: <strong>${phq9Severity(t)}</strong>`
    : `${answered} / ${PHQ9_QUESTIONS.length} 문항 응답`;
  $("phq9-alert").hidden = !(answers[8] > 0);
}

$("weekly-save").addEventListener("click", () => {
  const answers = readAnswers("w", PHQ9_QUESTIONS.length);
  if (answers.some((a) => a === null)) { alert("9개 문항에 모두 응답해 주세요."); return; }
  const rec = { id: uid(), date: $("weekly-date").value || todayInput(), answers, total: sum(answers) };
  if (!upsertByDate(store.weekly, rec, "PHQ-9")) return;
  saveData();
  resetWeeklyForm();
  renderWeeklyTable();
});
$("weekly-reset").addEventListener("click", resetWeeklyForm);

function resetWeeklyForm() {
  document.querySelectorAll('#weekly-questions input[type="radio"]').forEach((r) => (r.checked = false));
  $("weekly-date").value = todayInput();
  updateWeekly();
}

function renderWeeklyTable() {
  const tbody = document.querySelector("#weekly-table tbody");
  tbody.innerHTML = "";
  const has = store.weekly.length > 0;
  $("weekly-empty").style.display = has ? "none" : "block";
  $("weekly-table").style.display = has ? "" : "none";
  [...store.weekly].sort(byDate).reverse().forEach((r) => {
    const cells = r.answers.map((a) => `<td>${a}</td>`).join("");
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(r.date)}</td>${cells}
      <td class="total-cell">${r.total}</td><td>${phq9Severity(r.total).replace(/ \(.*\)/, "")}</td>
      <td><button class="btn link" data-del-weekly="${esc(r.id)}">삭제</button></td>`;
    tbody.appendChild(tr);
  });
}

/* ================= 삭제 / 전체삭제 ================= */
document.addEventListener("click", (e) => {
  const dd = e.target.getAttribute("data-del-daily");
  const dw = e.target.getAttribute("data-del-weekly");
  if (dd && confirm("이 기록을 삭제할까요?")) { store.daily = store.daily.filter((r) => r.id !== dd); saveData(); renderDailyTable(); }
  if (dw && confirm("이 기록을 삭제할까요?")) { store.weekly = store.weekly.filter((r) => r.id !== dw); saveData(); renderWeeklyTable(); }
});
$("clear-all").addEventListener("click", () => {
  if (confirm("모든 매일 기분 기록과 PHQ-9 기록을 삭제합니다. 계속할까요?")) {
    store = { daily: [], weekly: [] };
    saveData();
    renderDailyTable();
    renderWeeklyTable();
    renderAnalysis();
  }
});

/* ================= 결과 분석 ================= */
function mergedTimeline() {
  const map = new Map();
  const get = (date) => {
    if (!map.has(date)) map.set(date, { date, phq2: null, mood: null, sleep: null, phq9: null });
    return map.get(date);
  };
  store.daily.forEach((r) => { const o = get(r.date); o.phq2 = r.phq2; o.mood = r.mood; o.sleep = r.sleepHours; });
  store.weekly.forEach((r) => { get(r.date).phq9 = r.total; });
  return [...map.values()].sort(byDate);
}

function renderAnalysis() {
  renderAnalysisTable();
  renderChart();
}

function renderAnalysisTable() {
  const tbody = document.querySelector("#analysis-table tbody");
  const rows = mergedTimeline();
  tbody.innerHTML = "";
  const has = rows.length > 0;
  $("analysis-empty").style.display = has ? "none" : "block";
  $("analysis-table").style.display = has ? "" : "none";
  const v = (x, suf = "") => (x !== null && x !== undefined ? x + suf : "—");
  [...rows].reverse().forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${esc(r.date)}</td><td>${v(r.phq2)}</td><td>${v(r.mood)}</td><td>${v(r.sleep, "h")}</td><td>${v(r.phq9)}</td>`;
    tbody.appendChild(tr);
  });
}

/* 그래프에 표시할 계열(범례 체크박스로 켜고 끔) */
const chartSeries = { phq2: true, mood: true, phq9: true };
document.querySelectorAll(".legend input[data-series]").forEach((cb) => {
  cb.addEventListener("change", () => { chartSeries[cb.dataset.series] = cb.checked; renderChart(); });
});

/* 이중 축 선 그래프 — 외부 라이브러리 없이 SVG로 직접 렌더링.
   왼쪽 축 0~10: PHQ-2(/6), 기분 점수(/10) · 오른쪽 축 0~27: PHQ-9
   · 기본: 한 화면에 7개(넓은 화면 14개) 데이터가 보이도록 간격 자동 설정
   · 두 손가락(핀치)으로 데이터 간격을 좁히거나 넓힘 · 좌우로 밀어서 이동 */
const CHART_M = { top: 24, right: 52, bottom: 60, left: 44 };
const CHART_H = 340;
const CHART_WIDE_BP = 600;
const CHART_MIN_PX = 14;
const CHART_MAX_PX = 240;
let chartPxPerPoint = null;
let chartScrollToEnd = true;

const clampNum = (v, a, b) => Math.max(a, Math.min(b, v));
function chartDefaultVisible(cw) { return cw >= CHART_WIDE_BP ? 14 : 7; }

function renderChart() {
  const container = $("chart-container");
  const rows = mergedTimeline();
  container.innerHTML = "";
  if (rows.length === 0) { $("chart-empty").style.display = "block"; return; }
  $("chart-empty").style.display = "none";

  const css = getComputedStyle(document.documentElement);
  const col = (name, fb) => css.getPropertyValue(name).trim() || fb;
  const phq2Color = col("--phq2", "#e0553b");
  const moodColor = col("--mood", "#1f9d6b");
  const phq9Color = col("--phq9", "#6c4bd4");
  const gridColor = col("--border", "#dde3ec");
  const textColor = col("--muted", "#6b7688");

  const m = CHART_M, H = CHART_H, n = rows.length;
  const LEFT_MAX = 10, RIGHT_MAX = 27;
  const cw = container.clientWidth || 600;
  const availW = Math.max(120, cw - m.left - m.right);

  const visible = chartDefaultVisible(cw);
  const defaultPx = n > 1 ? availW / (visible - 1) : availW;
  if (chartPxPerPoint == null) chartPxPerPoint = defaultPx;
  chartPxPerPoint = clampNum(chartPxPerPoint, CHART_MIN_PX, CHART_MAX_PX);
  const px = chartPxPerPoint;

  const iw = n > 1 ? px * (n - 1) : 0;
  const plotW = Math.max(iw, availW);
  const W = m.left + plotW + m.right;
  const ih = H - m.top - m.bottom;

  const x = (i) => (n === 1 ? m.left + plotW / 2 : m.left + px * i);
  const yLeft = (v) => m.top + ih - (ih * v) / LEFT_MAX;
  const yRight = (v) => m.top + ih - (ih * v) / RIGHT_MAX;

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("width", W);
  svg.setAttribute("height", H);
  const el = (tag, attrs, text) => {
    const e = document.createElementNS(svgNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    return e;
  };

  const steps = 5;
  for (let s = 0; s <= steps; s++) {
    const yy = m.top + (ih * s) / steps;
    svg.appendChild(el("line", { x1: m.left, y1: yy, x2: m.left + plotW, y2: yy, stroke: gridColor, "stroke-width": 1 }));
    svg.appendChild(el("text", { x: m.left - 8, y: yy + 4, "text-anchor": "end", "font-size": 11, fill: textColor },
      Math.round(LEFT_MAX - (LEFT_MAX * s) / steps)));
    svg.appendChild(el("text", { x: m.left + plotW + 8, y: yy + 4, "text-anchor": "start", "font-size": 11, fill: phq9Color },
      (RIGHT_MAX - (RIGHT_MAX * s) / steps).toFixed(1).replace(/\.0$/, "")));
  }
  svg.appendChild(el("text", { x: m.left, y: 14, "text-anchor": "start", "font-size": 11, fill: textColor }, "PHQ-2 · 기분"));
  svg.appendChild(el("text", { x: m.left + plotW, y: 14, "text-anchor": "end", "font-size": 11, fill: phq9Color }, "PHQ-9 /27"));

  // x축 라벨(날짜): 간격이 좁으면 일정 간격마다만 표시(마지막은 항상)
  const labelStep = Math.max(1, Math.ceil(68 / px));
  rows.forEach((r, i) => {
    const isLast = i === n - 1;
    if (!isLast && (i % labelStep !== 0 || (n - 1 - i) < labelStep)) return;
    const [yy, mm, dd] = r.date.split("-");
    [`${mm}-${dd}`, yy].forEach((p, k) => {
      svg.appendChild(el("text", { x: x(i), y: m.top + ih + 18 + k * 14, "text-anchor": "middle", "font-size": 10, fill: textColor }, p));
    });
  });

  const showValues = px >= 34;
  // connect: true면 값이 없는 날을 건너 선을 이어 그림(주 1회 PHQ-9용)
  function drawSeries(accessor, yFn, color, connect) {
    let d = "", started = false;
    rows.forEach((r, i) => {
      const v = accessor(r);
      if (v === null || v === undefined) { if (!connect) started = false; return; }
      d += (started ? " L" : " M") + x(i) + " " + yFn(v);
      started = true;
    });
    if (d) svg.appendChild(el("path", { d: d.trim(), fill: "none", stroke: color, "stroke-width": 2.5, "stroke-linejoin": "round", "stroke-linecap": "round", ...(connect ? { "stroke-dasharray": "6 4" } : {}) }));
    rows.forEach((r, i) => {
      const v = accessor(r);
      if (v === null || v === undefined) return;
      svg.appendChild(el("circle", { cx: x(i), cy: yFn(v), r: px < 24 ? 3 : 4, fill: color }));
      if (showValues) svg.appendChild(el("text", { x: x(i), y: yFn(v) - 9, "text-anchor": "middle", "font-size": 10, "font-weight": 700, fill: color }, v));
    });
  }
  if (chartSeries.mood) drawSeries((r) => r.mood, yLeft, moodColor, false);
  if (chartSeries.phq2) drawSeries((r) => r.phq2, yLeft, phq2Color, false);
  if (chartSeries.phq9) drawSeries((r) => r.phq9, yRight, phq9Color, true);
  container.appendChild(svg);

  if (chartScrollToEnd) { container.scrollLeft = container.scrollWidth; chartScrollToEnd = false; }
}

/* 뷰포트 중앙을 기준으로 간격 확대/축소(+/− 버튼) */
function zoomChart(factor) {
  const c = $("chart-container");
  const old = chartPxPerPoint || 40;
  const neu = clampNum(old * factor, CHART_MIN_PX, CHART_MAX_PX);
  if (neu === old) return;
  const centerContent = c.scrollLeft + c.clientWidth / 2;
  chartPxPerPoint = neu;
  renderChart();
  const newCenter = CHART_M.left + (centerContent - CHART_M.left) * (neu / old);
  c.scrollLeft = newCenter - c.clientWidth / 2;
}

/* 핀치 중심(focusContent: 핀치 시작 당시 콘텐츠 좌표, focusViewport: 화면 내 x)을
   기준으로 간격을 newPx로 바꾸고, 그 지점이 손가락 아래 그대로 머무르도록 스크롤 보정 */
function applyChartSpacing(newPx, startPx, focusContent, focusViewport) {
  const c = $("chart-container");
  newPx = clampNum(newPx, CHART_MIN_PX, CHART_MAX_PX);
  if (newPx === chartPxPerPoint) return;
  chartPxPerPoint = newPx;
  renderChart();
  const newContent = CHART_M.left + (focusContent - CHART_M.left) * (newPx / startPx);
  c.scrollLeft = newContent - focusViewport;
}

/* 그래프 영역 안에서만 동작 (iOS Safari 포함, Touch 이벤트 기반):
   · 한 손가락 가로 드래그 → 좌우로 이동(팬)  / 세로 드래그는 페이지 스크롤에 양보
   · 두 손가락 핀치 → 데이터 간격 확대/축소(양방향)
   · 마우스 드래그 → 좌우 이동(데스크톱)
   그래프 밖에서는 핸들러가 없어 브라우저 기본 동작(페이지 확대/축소)이 그대로 작동한다. */
function setupChartGestures() {
  const c = $("chart-container");
  if (!c) return;

  const dist2 = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  let mode = 0;                          // 0=없음, 1=팬, 2=핀치
  let startX = 0, startY = 0, startScroll = 0, panLocked = false;
  let pinchDist = 0, pinchPx = 0, focusContent = 0, focusViewport = 0;

  const beginPan = (x, y) => { mode = 1; panLocked = false; startX = x; startY = y; startScroll = c.scrollLeft; };
  const beginPinch = (t) => {
    mode = 2;
    pinchDist = dist2(t);
    pinchPx = chartPxPerPoint || 40;
    const rect = c.getBoundingClientRect();
    focusViewport = (t[0].clientX + t[1].clientX) / 2 - rect.left;
    focusContent = c.scrollLeft + focusViewport;
  };

  c.addEventListener("touchstart", (e) => {
    if (e.touches.length === 2) { e.preventDefault(); beginPinch(e.touches); }
    else if (e.touches.length === 1) { beginPan(e.touches[0].clientX, e.touches[0].clientY); }
  }, { passive: false });

  c.addEventListener("touchmove", (e) => {
    if (mode === 2 && e.touches.length >= 2) {
      e.preventDefault(); // 그래프 위 핀치 → 간격 조절 (페이지 확대 안 함)
      applyChartSpacing(pinchPx * (dist2(e.touches) / pinchDist), pinchPx, focusContent, focusViewport);
    } else if (mode === 1 && e.touches.length === 1) {
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (!panLocked) {
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 6) panLocked = true;        // 가로 → 팬 확정
        else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 6) { mode = 0; return; } // 세로 → 페이지 스크롤 양보
        else return;
      }
      e.preventDefault();
      c.scrollLeft = startScroll - dx; // 한 손가락 좌우 이동
    }
  }, { passive: false });

  const onTouchEnd = (e) => {
    if (e.touches.length === 1) beginPan(e.touches[0].clientX, e.touches[0].clientY); // 핀치→한 손가락 전환
    else if (e.touches.length === 0) mode = 0;
  };
  c.addEventListener("touchend", onTouchEnd);
  c.addEventListener("touchcancel", onTouchEnd);

  // 데스크톱 마우스 드래그로 좌우 이동
  let mouseDown = false, mStartX = 0, mStartScroll = 0;
  c.addEventListener("mousedown", (e) => { mouseDown = true; mStartX = e.clientX; mStartScroll = c.scrollLeft; e.preventDefault(); });
  window.addEventListener("mousemove", (e) => { if (mouseDown) c.scrollLeft = mStartScroll - (e.clientX - mStartX); });
  window.addEventListener("mouseup", () => { mouseDown = false; });

  // iOS Safari: 그래프 위 핀치가 페이지 확대로 번지지 않도록 차단(간격 조절은 touchmove가 담당)
  ["gesturestart", "gesturechange", "gestureend"].forEach((ev) =>
    c.addEventListener(ev, (e) => e.preventDefault(), { passive: false })
  );
}

/* ================= 데이터 내보내기 / 가져오기 ================= */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
const fileStamp = () => todayInput() + "-" + new Date().toTimeString().slice(0, 5).replace(":", "");

$("export-data").addEventListener("click", () => {
  const payload = { app: "depeval", version: 1, exportedAt: new Date().toISOString(), daily: store.daily, weekly: store.weekly };
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), `우울평가-백업-${fileStamp()}.json`);
});

$("import-data").addEventListener("click", () => $("import-file").click());

const validDate = (r) => r && typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date);
const validScores = (a, n) => Array.isArray(a) && a.length === n && a.every((v) => Number.isInteger(v) && v >= 0 && v <= 3);

$("import-file").addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const inDaily = (Array.isArray(data.daily) ? data.daily : [])
        .filter((r) => validDate(r) && validScores(r.answers, DAILY_QUESTIONS.length))
        .map((r) => ({
          id: String(r.id || uid()), date: r.date, answers: r.answers, phq2: sum(r.answers),
          mood: clampNum(parseInt(r.mood, 10) || 5, 1, 10),
          sleepHours: typeof r.sleepHours === "number" ? r.sleepHours : null,
          sleepQuality: ["만족", "보통", "불만족"].includes(r.sleepQuality) ? r.sleepQuality : "",
          event: String(r.event || "").slice(0, 200),
        }));
      const inWeekly = (Array.isArray(data.weekly) ? data.weekly : [])
        .filter((r) => validDate(r) && validScores(r.answers, PHQ9_QUESTIONS.length))
        .map((r) => ({ id: String(r.id || uid()), date: r.date, answers: r.answers, total: sum(r.answers) }));
      if (!inDaily.length && !inWeekly.length) {
        alert("가져올 기록이 없습니다. 올바른 백업 파일인지 확인해 주세요.");
        return;
      }
      const ok = confirm(
        `가져올 기록: 매일 기분 ${inDaily.length}건, PHQ-9 ${inWeekly.length}건\n\n` +
        "확인 = 현재 기록에 병합(이미 기록이 있는 날짜는 건너뜀), 취소 = 가져오기 중단"
      );
      if (!ok) return;
      const merge = (list, incoming) => {
        const seen = new Set(list.map((r) => r.date));
        incoming.forEach((r) => { if (!seen.has(r.date)) { list.push(r); seen.add(r.date); } });
        list.sort(byDate);
      };
      merge(store.daily, inDaily);
      merge(store.weekly, inWeekly);
      saveData();
      renderDailyTable();
      renderWeeklyTable();
      renderAnalysis();
      alert("가져오기가 완료되었습니다.");
    } catch {
      alert("파일을 읽을 수 없습니다. 올바른 JSON 백업 파일인지 확인해 주세요.");
    } finally {
      e.target.value = "";
    }
  };
  reader.readAsText(file);
});

/* ================= CSV 저장 / 메일 보내기 ================= */
function csvEscape(v) {
  v = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(v) && isNaN(Number(v))) v = "'" + v; // 스프레드시트 수식 실행 방지
  return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}
const csvFilename = () => `우울평가-${fileStamp()}.csv`;

/* 매일 기록과 PHQ-9 기록을 날짜 기준으로 합쳐 하나의 CSV로 만든다(Excel용 BOM 포함) */
function buildCSV() {
  const map = new Map();
  const get = (date) => { if (!map.has(date)) map.set(date, { date }); return map.get(date); };
  store.daily.forEach((r) => { get(r.date).d = r; });
  store.weekly.forEach((r) => { get(r.date).w = r; });
  const headers = ["날짜", "매일1(우울)", "매일2(흥미)", "PHQ-2(/6)", "기분점수(1-10)", "수면시간", "수면의질", "특별한사건",
    ...PHQ9_QUESTIONS.map((_, i) => `PHQ9-${i + 1}`), "PHQ-9총점(/27)", "PHQ-9해석"];
  const lines = [headers.join(",")];
  [...map.values()].sort(byDate).forEach(({ date, d, w }) => {
    const cells = [
      date,
      d ? d.answers[0] : "", d ? d.answers[1] : "", d ? d.phq2 : "", d ? d.mood : "",
      d ? d.sleepHours ?? "" : "", d ? d.sleepQuality : "", d ? d.event : "",
      ...PHQ9_QUESTIONS.map((_, i) => (w ? w.answers[i] : "")),
      w ? w.total : "", w ? phq9Severity(w.total) : "",
    ];
    lines.push(cells.map(csvEscape).join(","));
  });
  return "﻿" + lines.join("\r\n"); // BOM → Excel 한글 깨짐 방지
}

function hasRecords() { return store.daily.length > 0 || store.weekly.length > 0; }

$("export-csv").addEventListener("click", () => {
  if (!hasRecords()) { alert("저장된 기록이 없습니다."); return; }
  downloadBlob(new Blob([buildCSV()], { type: "text/csv;charset=utf-8" }), csvFilename());
});

$("email-csv").addEventListener("click", async () => {
  if (!hasRecords()) { alert("보낼 기록이 없습니다."); return; }
  const csv = buildCSV();
  const name = csvFilename();

  // 1) 파일 공유 지원 시(아이폰/안드로이드): 공유 시트 → 메일 앱에 CSV 첨부
  try {
    const file = new File([csv], name, { type: "text/csv" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "우울 평가 데이터", text: "우울 평가 CSV 데이터입니다." });
      return;
    }
  } catch (err) {
    if (err && err.name === "AbortError") return; // 사용자가 취소
  }

  // 2) 폴백(주로 데스크톱): CSV를 내려받고 메일 작성 창을 연다(첨부는 수동)
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), name);
  const subject = encodeURIComponent("우울 평가 데이터");
  const body = encodeURIComponent(`방금 내려받은 CSV 파일(${name})을 이 메일에 첨부해 보내세요.`);
  location.href = `mailto:?subject=${subject}&body=${body}`;
});

/* ================= PWA: 서비스워커 등록 + 설치 안내 ================= */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  $("install-app").hidden = false;
});
$("install-app").addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  $("install-app").hidden = true;
});
window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  $("install-app").hidden = true;
});

/* ================= 그래프 확대/축소 버튼 + 제스처 ================= */
$("chart-zoom-in").addEventListener("click", () => zoomChart(1.3));
$("chart-zoom-out").addEventListener("click", () => zoomChart(1 / 1.3));
$("chart-zoom-reset").addEventListener("click", () => {
  chartPxPerPoint = null;     // 기본(7개 맞춤)으로
  chartScrollToEnd = true;
  renderChart();
});
setupChartGestures();

// 창 크기·방향이 바뀌면 그래프를 기본 간격(세로 7 / 넓으면 14)으로 다시 맞춤
function resetChartDefault() {
  chartPxPerPoint = null;
  chartScrollToEnd = true;
  if (document.getElementById("analysis").classList.contains("active")) renderChart();
}
window.addEventListener("resize", resetChartDefault);
window.addEventListener("orientationchange", resetChartDefault);

/* ================= 초기화 ================= */
buildQuestions("daily-questions", "d", DAILY_QUESTIONS, DAILY_OPTIONS, updateDaily);
buildQuestions("weekly-questions", "w", PHQ9_QUESTIONS, PHQ9_OPTIONS, updateWeekly);
resetDailyForm();
resetWeeklyForm();
renderDailyTable();
renderWeeklyTable();
