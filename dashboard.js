/* Jenkins CI/CD Dashboard — logic */

const JOB_NAME = "jenkins-ci-demo";
const USERNAME = "admin";
const API_TREE = "builds[number,result,timestamp,duration,building,changeSet[items[comment]]]";
const HISTORY_LIMIT = 6;

let API_TOKEN = "PASTE_TOKEN_HERE";
const REFRESH_INTERVAL = 30;

let countdown = REFRESH_INTERVAL;
let countdownTimer = null;
let clockTimer = null;
let lastBuilds = [];
let useSessionAuth = false;
let lastSuccessRate = 0;

const $ = (id) => document.getElementById(id);

const COLORS = {
  success: "#2ea043",
  failure: "#f85149",
  warning: "#d29922",
  accent: "#58a6ff",
  grid: "#2d3a4f",
  muted: "#8b9cb3",
  track: "#243044",
};

function buildApiUrl() {
  return `/job/${encodeURIComponent(JOB_NAME)}/api/json`
    + `?tree=${encodeURIComponent(API_TREE)}&depth=2`;
}

function hasValidToken() {
  return API_TOKEN && API_TOKEN !== "PASTE_TOKEN_HERE" && API_TOKEN.trim().length > 0;
}

function setConnectionStatus(connected) {
  const badge = $("connBadge");
  badge.textContent = connected ? "CONNECTED" : "DISCONNECTED";
  badge.className = "conn-badge " + (connected ? "connected" : "disconnected");
}

function showError(msg) {
  $("errorBanner").classList.add("show");
  $("errorBanner").textContent = msg;
}

function hideError() {
  $("errorBanner").classList.remove("show");
}

function formatDuration(ms) {
  if (ms == null || ms < 0) return "—";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function timeAgo(ts) {
  if (!ts) return "—";
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function formatDateShort(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function getCommit(build) {
  const items = build?.changeSet?.items;
  if (!items?.length) return "—";
  const msg = items[0].comment || "—";
  return msg.length > 50 ? msg.slice(0, 47) + "…" : msg;
}

function resolveStatus(build) {
  if (!build) return { label: "UNKNOWN", cls: "unknown" };
  if (build.building) return { label: "RUNNING", cls: "progress" };
  if (build.result === "SUCCESS") return { label: "SUCCESS", cls: "success" };
  if (build.result === "FAILURE") return { label: "FAILURE", cls: "failure" };
  if (build.result === "UNSTABLE") return { label: "UNSTABLE", cls: "failure" };
  return { label: build.result || "?", cls: "unknown" };
}

function rowClass(cls) {
  if (cls === "success") return "row-success";
  if (cls === "failure") return "row-failure";
  return "";
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

async function fetchJenkinsData() {
  const headers = { Accept: "application/json" };
  if (!useSessionAuth && hasValidToken()) {
    headers.Authorization = "Basic " + btoa(`${USERNAME}:${API_TOKEN}`);
  }
  const response = await fetch(buildApiUrl(), {
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} — ${response.statusText}`);
  return response.json();
}

function drawDonut(pct) {
  const canvas = $("donutChart");
  const dpr = window.devicePixelRatio || 1;
  const size = 72;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const cx = size / 2;
  const cy = size / 2;
  const r = 28;
  const lw = 8;
  const start = -Math.PI / 2;
  const pass = (pct / 100) * Math.PI * 2;

  ctx.clearRect(0, 0, size, size);

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.track;
  ctx.lineWidth = lw;
  ctx.stroke();

  if (pct > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, start + pass);
    ctx.strokeStyle = COLORS.success;
    ctx.lineWidth = lw;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  if (pct < 100) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, start + pass, start + Math.PI * 2);
    ctx.strokeStyle = COLORS.failure;
    ctx.lineWidth = lw;
    ctx.lineCap = "round";
    ctx.stroke();
  }
}

function drawChart(builds) {
  const canvas = $("trendChart");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const W = rect.width;
  const H = rect.height;
  const pad = { top: 10, right: 10, bottom: 24, left: 38 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;

  ctx.clearRect(0, 0, W, H);

  if (!builds.length) {
    ctx.fillStyle = COLORS.muted;
    ctx.font = "14px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("No data", W / 2, H / 2);
    return;
  }

  const secs = builds.map((b) => Math.max(0, Math.round((b.duration || 0) / 1000)));
  const niceMax = Math.ceil(Math.max(...secs, 1) * 1.15);
  const barGap = 10;
  const barW = Math.min(52, (chartW - barGap * (builds.length - 1)) / builds.length);

  ctx.strokeStyle = COLORS.grid;
  ctx.fillStyle = COLORS.muted;
  ctx.font = "11px Segoe UI, sans-serif";
  ctx.textAlign = "right";

  for (let i = 0; i <= 4; i++) {
    const y = pad.top + chartH - (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + chartW, y);
    ctx.stroke();
    ctx.fillText(`${Math.round((niceMax / 4) * i)}s`, pad.left - 4, y + 3);
  }

  const offsetX = pad.left + (chartW - builds.length * barW - (builds.length - 1) * barGap) / 2;

  builds.forEach((b, i) => {
    const sec = secs[i];
    const barH = (sec / niceMax) * chartH;
    const x = offsetX + i * (barW + barGap);
    const y = pad.top + chartH - barH;
    const s = resolveStatus(b);

    ctx.fillStyle = s.cls === "success" ? COLORS.success
                  : s.cls === "failure" ? COLORS.failure
                  : COLORS.warning;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, 5);
    ctx.fill();

    ctx.fillStyle = COLORS.muted;
    ctx.font = "11px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`#${b.number}`, x + barW / 2, pad.top + chartH + 16);

    if (barH > 18) {
      ctx.fillStyle = "#e8edf4";
      ctx.font = "10px Segoe UI, sans-serif";
      ctx.fillText(`${sec}s`, x + barW / 2, y - 4);
    }
  });
}

function renderDashboard(data) {
  const builds = (data.builds || []).slice().sort((a, b) => b.number - a.number);
  lastBuilds = builds.slice(0, HISTORY_LIMIT);

  const latest = builds[0];
  const st = resolveStatus(latest);

  $("statusBadge").textContent = latest ? st.label : "NO BUILDS";
  $("statusBadge").className = "status-badge " + (latest ? st.cls : "unknown");
  $("statusBuildNum").textContent = latest ? `#${latest.number}` : "—";
  $("statusAgo").textContent = latest ? timeAgo(latest.timestamp) : "—";
  $("statusDuration").textContent = latest ? formatDuration(latest.duration) : "—";

  const finished = builds.filter((b) => b.result && !b.building);
  const successes = finished.filter((b) => b.result === "SUCCESS");
  const failures = finished.filter((b) => b.result === "FAILURE" || b.result === "UNSTABLE");
  const rate = finished.length ? Math.round((successes.length / finished.length) * 100) : 0;
  lastSuccessRate = rate;

  const durations = finished.map((b) => b.duration).filter((d) => d >= 0);
  const avgMs = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;

  $("statTotal").textContent = builds.length;
  $("statRate").textContent = finished.length ? `${rate}%` : "—";
  $("statCommit").textContent = latest ? getCommit(latest) : "—";
  $("statAvg").textContent = avgMs != null ? formatDuration(avgMs) : "—";
  $("statFailed").textContent = failures.length;

  drawDonut(rate);

  const tbody = $("historyBody");
  if (!lastBuilds.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">No builds</td></tr>';
  } else {
    tbody.innerHTML = lastBuilds.map((b) => {
      const s = resolveStatus(b);
      return `<tr class="${rowClass(s.cls)}">
        <td><strong>#${b.number}</strong></td>
        <td><span class="badge ${s.cls}">${s.label}</span></td>
        <td>${formatDateShort(b.timestamp)}</td>
        <td>${formatDuration(b.duration)}</td>
        <td>${escapeHtml(getCommit(b))}</td>
      </tr>`;
    }).join("");
  }

  drawChart(builds.slice(0, HISTORY_LIMIT).reverse());
}

async function refresh() {
  if (!useSessionAuth && !hasValidToken()) return;
  hideError();
  try {
    renderDashboard(await fetchJenkinsData());
    setConnectionStatus(true);
    $("connectPanel").classList.add("hidden");
  } catch (err) {
    setConnectionStatus(false);
    showError(`API error: ${err.message}`);
    console.error(err);
  }
  resetCountdown();
}

function resetCountdown() {
  countdown = REFRESH_INTERVAL;
  $("countdown").textContent = countdown;
  $("refreshProgress").value = countdown;
}

function startTimers() {
  const tick = () => { $("clock").textContent = new Date().toLocaleTimeString(); };
  tick();
  clockTimer = setInterval(tick, 1000);
  countdownTimer = setInterval(() => {
    countdown--;
    $("countdown").textContent = Math.max(countdown, 0);
    $("refreshProgress").value = countdown;
    if (countdown <= 0) refresh();
  }, 1000);
}

async function connect(token) {
  const trimmed = (token || "").trim();
  if (!trimmed) { showError("Paste your API token first."); return; }
  API_TOKEN = trimmed;
  useSessionAuth = false;
  $("connectBtn").disabled = true;
  $("connectBtn").textContent = "…";
  await refresh();
  $("connectBtn").disabled = false;
  $("connectBtn").textContent = "Connect";
}

async function init() {
  startTimers();
  useSessionAuth = true;
  hideError();
  try {
    renderDashboard(await fetchJenkinsData());
    setConnectionStatus(true);
    $("connectPanel").classList.add("hidden");
    return;
  } catch (_) { useSessionAuth = false; }
  if (hasValidToken()) { await refresh(); return; }
  setConnectionStatus(false);
}

$("connectBtn").addEventListener("click", () => connect($("tokenInput").value));
$("tokenInput").addEventListener("keydown", (e) => { if (e.key === "Enter") connect($("tokenInput").value); });
$("refreshNow").addEventListener("click", refresh);
window.addEventListener("resize", () => {
  drawDonut(lastSuccessRate);
  if (lastBuilds.length) drawChart(lastBuilds.slice().reverse());
});

init();
