const state = {
  token: localStorage.getItem("shorty.token") || "",
  tokenRequired: false,
  username: "admin",
  authError: "",
  system: null,
  jobs: [],
  selectedJob: null,
  selectedJobId: null,
  toast: "",
  isCreating: false
};

const appRoot = document.getElementById("app");

function escapeHtml(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function readRoute() {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) {
    return { screen: "generate" };
  }
  if (hash === "review") {
    return { screen: "review" };
  }
  if (hash.startsWith("review/")) {
    return { screen: "review", jobId: hash.replace("review/", "") };
  }
  if (hash === "drafts") {
    return { screen: "drafts" };
  }
  return { screen: "generate" };
}

function setRoute(route) {
  if (route.screen === "review" && route.jobId) {
    window.location.hash = `review/${route.jobId}`;
    return;
  }
  window.location.hash = route.screen;
}

function withToken(url) {
  if (!url) {
    return "";
  }
  if (!state.tokenRequired || !state.token) {
    return url;
  }
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}token=${encodeURIComponent(state.token)}`;
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (state.token) {
    headers.set("x-shorty-token", state.token);
  }

  const response = await fetch(path, {
    ...options,
    headers
  });

  if (response.status === 401) {
    state.authError = "Token gecersiz ya da eksik.";
    render();
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "Istek basarisiz." }));
    throw new Error(payload.error || "Istek basarisiz.");
  }

  return await response.json();
}

function showToast(message) {
  state.toast = message;
  render();
  window.clearTimeout(showToast._timeout);
  showToast._timeout = window.setTimeout(() => {
    state.toast = "";
    render();
  }, 2600);
}

async function loadAuthStatus() {
  const response = await fetch("/api/auth/status");
  const payload = await response.json();
  state.tokenRequired = payload.tokenRequired;
  state.username = payload.username || "admin";
}

async function loadSystem() {
  try {
    state.system = await api("/api/system");
    state.authError = "";
  } catch (error) {
    if (error.message !== "Unauthorized") {
      showToast(error.message);
    }
  }
}

async function loadJobs() {
  try {
    const payload = await api("/api/jobs");
    state.jobs = payload.jobs || [];
    const route = readRoute();
    if (route.screen === "review" && route.jobId) {
      state.selectedJobId = route.jobId;
      await loadSelectedJob(route.jobId);
    }
  } catch (error) {
    if (error.message !== "Unauthorized") {
      showToast(error.message);
    }
  }
}

async function loadSelectedJob(jobId) {
  try {
    const payload = await api(`/api/jobs/${jobId}`);
    state.selectedJob = payload.job;
  } catch (error) {
    if (error.message !== "Unauthorized") {
      showToast(error.message);
    }
  }
}

function integrationChip(label, enabled) {
  return `<span class="chip ${enabled ? "status-pill status-uploaded_private" : "status-pill status-needs_attention"}">${escapeHtml(
    label
  )}: ${enabled ? "hazir" : "eksik"}</span>`;
}

function renderSidebar(route) {
  return `
    <aside class="panel stack">
      <div>
        <div class="badge">PWA Control</div>
        <h2>Kontrol Paneli</h2>
        <p>Telefonundan tek tusla is baslat, draftlari izle ve YouTube private yuklemelerini kontrol et.</p>
      </div>
      <div class="token-bar">
        <label class="field">
          <span>Panel token</span>
          <input class="token-input" name="token" value="${escapeHtml(state.token)}" placeholder="${
            state.tokenRequired ? "SHORTY_ADMIN_TOKEN gir" : "Opsiyonel"
          }" />
        </label>
        <button class="secondary-button" data-action="save-token">Tokeni Kaydet</button>
        ${state.authError ? `<p class="status-note">${escapeHtml(state.authError)}</p>` : ""}
      </div>
      <nav class="nav-list">
        <button class="nav-button ${route.screen === "generate" ? "is-active" : ""}" data-route="generate">Generate</button>
        <button class="nav-button ${route.screen === "drafts" ? "is-active" : ""}" data-route="drafts">Drafts</button>
        <button class="nav-button ${route.screen === "review" ? "is-active" : ""}" data-route="review">Review</button>
      </nav>
    </aside>
  `;
}

function renderHero() {
  const integrations = state.system?.integrations || { gemini: false, pexels: false, youtube: false };
  return `
    <section class="hero">
      <div class="hero-card stack">
        <div class="badge">Turkce 35-45 sn</div>
        <h1>Motivasyon hikayesini sec, gerisini sistem halletsin.</h1>
        <p>Pipeline script, TTS, altyazi, stok gorsel, render ve private YouTube upload adimlarini tek queue uzerinden yurutur.</p>
        <div class="hero-badges">
          <span class="badge">Gemini script + TTS</span>
          <span class="badge">Pexels vertical B-roll</span>
          <span class="badge">FFmpeg karaoke captions</span>
        </div>
      </div>
      <div class="hero-card stack">
        <div class="panel-header">
          <h2>Sistem Durumu</h2>
          <span class="status-pill ${state.system?.queueBusy ? "status-writing" : "status-uploaded_private"}">${
            state.system?.queueBusy ? "Calisiyor" : "Hazir"
          }</span>
        </div>
        <div class="status-list">
          ${integrationChip("Gemini", integrations.gemini)}
          ${integrationChip("Pexels", integrations.pexels)}
          ${integrationChip("YouTube", integrations.youtube)}
        </div>
        <p class="status-note">Tailscale uzerinden telefondan baglan, private videoyu izledikten sonra Studio linkinden yayina al.</p>
      </div>
    </section>
  `;
}

function renderGenerateView() {
  return `
    <section class="stack">
      <div class="panel stack">
        <div class="panel-header">
          <h2>Generate</h2>
          <span class="status-pill status-queued">Tek tus workflow</span>
        </div>
        <p>Seed topic bos kalirsa sistem yeni bir motivasyon/hikaye konusu uretir. Yuklemeler varsayilan olarak private gider.</p>
        <form class="stack" id="generate-form">
          <label class="field">
            <span>Seed / topic</span>
            <input name="seedTopic" maxlength="140" placeholder="Ornek: sabah disiplini, gec baslayanlar, sessiz ozguven" />
          </label>
          <div class="grid-two">
            <label class="field">
              <span>Privacy</span>
              <select name="privacy">
                <option value="private">private</option>
                <option value="unlisted">unlisted</option>
              </select>
            </label>
            <div class="field">
              <span>&nbsp;</span>
              <button class="primary-button" type="submit" ${state.isCreating ? "disabled" : ""}>
                ${state.isCreating ? "Olusturuluyor..." : "Videoyu Uret"}
              </button>
            </div>
          </div>
        </form>
      </div>
      <div class="grid-three">
        <article class="status-card">
          <h3>Kalite standardi</h3>
          <p>Hook + 3 beat + kapanis yapisinda, buyuk okunur altyazili, dikey 1080x1920 draft uretilir.</p>
        </article>
        <article class="status-card">
          <h3>Private review</h3>
          <p>Video once private yuklenir. Studio linkinden once sen bakarsin, sonra manuel publish edersin.</p>
        </article>
        <article class="status-card">
          <h3>Ucretsiz mod</h3>
          <p>Free-tier API kotalari ve yerel FFmpeg render kullanilir. Kota hatalari needs_attention olarak gorunur.</p>
        </article>
      </div>
    </section>
  `;
}

function renderDraftCard(job) {
  return `
    <article class="job-card stack">
      <div class="job-header">
        <div>
          <h3>${escapeHtml(job.title || job.topic || "Yeni draft")}</h3>
          <p>${escapeHtml(job.seedTopic || job.topic || "Otomatik konu")}</p>
        </div>
        <span class="status-pill status-${escapeHtml(job.status)}">${escapeHtml(job.status)}</span>
      </div>
      <div class="meta-list">
        <span class="chip">${new Date(job.createdAt).toLocaleString("tr-TR")}</span>
        <span class="chip">${escapeHtml(job.privacy)}</span>
      </div>
      ${job.lastError ? `<p>${escapeHtml(job.lastError)}</p>` : ""}
      <div class="job-actions">
        <button class="secondary-button" data-open-job="${escapeHtml(job.id)}">Review</button>
        ${job.previewUrl ? `<a class="ghost-button muted-link" href="${withToken(job.previewUrl)}" target="_blank" rel="noreferrer">Preview</a>` : ""}
        ${job.youtubeUrl ? `<a class="ghost-button muted-link" href="${escapeHtml(job.youtubeUrl)}" target="_blank" rel="noreferrer">YouTube</a>` : ""}
      </div>
    </article>
  `;
}

function renderDraftsView() {
  if (!state.jobs.length) {
    return `
      <section class="panel empty-state">
        <h2>Henuz draft yok</h2>
        <p>Generate ekranindan ilk isi baslat. Job olusunca burada durum kartlari gorunecek.</p>
      </section>
    `;
  }

  return `
    <section class="stack">
      <div class="panel-header">
        <h2>Drafts</h2>
        <span class="status-pill">${state.jobs.length} is</span>
      </div>
      <div class="job-list">
        ${state.jobs.map(renderDraftCard).join("")}
      </div>
    </section>
  `;
}

function renderReviewView() {
  const job = state.selectedJob;
  if (!job) {
    return `
      <section class="panel empty-state">
        <h2>Review secili degil</h2>
        <p>Drafts ekranindan bir job ac ya da Generate ile yeni bir is baslat.</p>
      </section>
    `;
  }

  const previewUrl = withToken(job.render?.previewUrl);
  const hashtags = job.content?.hashtags || [];
  const creditsText = job.content?.creditsText || "Pexels credit hazir degil.";
  return `
    <section class="review-card stack">
      <div class="review-header">
        <div>
          <div class="badge">Review</div>
          <h2>${escapeHtml(job.content?.title || job.content?.topic || "Draft")}</h2>
          <p>${escapeHtml(job.content?.shortSummary || job.content?.topic || "")}</p>
        </div>
        <span class="status-pill status-${escapeHtml(job.status)}">${escapeHtml(job.status)}</span>
      </div>
      <div class="grid-two">
        <div class="stack">
          <div class="video-frame">
            ${
              previewUrl
                ? `<video controls playsinline preload="metadata" src="${escapeHtml(previewUrl)}"></video>`
                : `<div class="empty-state"><p>Preview hazir degil. Status degisince tekrar yuklenecek.</p></div>`
            }
          </div>
          <div class="review-actions">
            <button class="secondary-button" data-regenerate-audio="${escapeHtml(job.id)}">Regenerate audio</button>
            <button class="secondary-button" data-regenerate-visuals="${escapeHtml(job.id)}">Regenerate visuals</button>
            ${
              job.youtube?.studioUrl
                ? `<a class="primary-button muted-link" href="${escapeHtml(job.youtube.studioUrl)}" target="_blank" rel="noreferrer">Open in YouTube Studio</a>`
                : ""
            }
          </div>
        </div>
        <div class="stack">
          <article class="panel stack">
            <div class="panel-header">
              <h3>Metadata</h3>
              <span class="chip">${escapeHtml(job.input?.privacy || "private")}</span>
            </div>
            <p><strong>Title:</strong> ${escapeHtml(job.content?.title || "-")}</p>
            <p><strong>Description:</strong> ${escapeHtml(job.content?.description || "-")}</p>
            <div class="hashtag-list">${hashtags.map((tag) => `<span class="badge">${escapeHtml(tag)}</span>`).join("")}</div>
          </article>
          <article class="panel stack">
            <h3>Pexels Credits</h3>
            <p>${escapeHtml(creditsText)}</p>
          </article>
          <article class="panel stack">
            <h3>Upload</h3>
            <p><strong>Video ID:</strong> ${escapeHtml(job.youtube?.videoId || "-")}</p>
            <p><strong>Processing:</strong> ${escapeHtml(job.youtube?.processingStatus || job.status)}</p>
            ${
              job.youtube?.url
                ? `<a class="muted-link" href="${escapeHtml(job.youtube.url)}" target="_blank" rel="noreferrer">Private YouTube linkini ac</a>`
                : `<p>Yukleme henuz tamamlanmadi.</p>`
            }
          </article>
        </div>
      </div>
    </section>
  `;
}

function renderMain(route) {
  if (route.screen === "drafts") {
    return renderDraftsView();
  }
  if (route.screen === "review") {
    return renderReviewView();
  }
  return renderGenerateView();
}

function render() {
  const route = readRoute();
  const content = `
    <main class="app-shell">
      ${renderHero()}
      <section class="layout">
        ${renderSidebar(route)}
        <section class="stack">
          ${renderMain(route)}
        </section>
      </section>
    </main>
    ${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}
  `;
  appRoot.innerHTML = content;
}

async function handleGenerateSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  state.isCreating = true;
  render();
  try {
    const payload = await api("/api/jobs", {
      method: "POST",
      body: JSON.stringify({
        seedTopic: (formData.get("seedTopic") || "").toString().trim() || undefined,
        privacy: (formData.get("privacy") || "private").toString(),
        trigger: "pwa"
      })
    });
    state.isCreating = false;
    state.selectedJob = payload.job;
    state.selectedJobId = payload.job.id;
    showToast("Is kuyruga eklendi.");
    await loadJobs();
    setRoute({ screen: "review", jobId: payload.job.id });
  } catch (error) {
    state.isCreating = false;
    render();
    if (error.message !== "Unauthorized") {
      showToast(error.message);
    }
  }
}

async function handleActionClick(event) {
  const button = event.target.closest("button, a");
  if (!button) {
    return;
  }

  const route = button.getAttribute("data-route");
  if (route) {
    if (route === "review" && state.selectedJobId) {
      setRoute({ screen: "review", jobId: state.selectedJobId });
    } else {
      setRoute({ screen: route });
    }
    await loadJobs();
    render();
    return;
  }

  if (button.hasAttribute("data-open-job")) {
    const jobId = button.getAttribute("data-open-job");
    await loadSelectedJob(jobId);
    state.selectedJobId = jobId;
    setRoute({ screen: "review", jobId });
    render();
    return;
  }

  if (button.hasAttribute("data-regenerate-audio")) {
    const jobId = button.getAttribute("data-regenerate-audio");
    await api(`/api/jobs/${jobId}/regenerate-audio`, { method: "POST" });
    await loadSelectedJob(jobId);
    await loadJobs();
    showToast("Ses yenileme kuyruga alindi.");
    render();
    return;
  }

  if (button.hasAttribute("data-regenerate-visuals")) {
    const jobId = button.getAttribute("data-regenerate-visuals");
    await api(`/api/jobs/${jobId}/regenerate-visuals`, { method: "POST" });
    await loadSelectedJob(jobId);
    await loadJobs();
    showToast("Gorsel yenileme kuyruga alindi.");
    render();
    return;
  }

  if (button.hasAttribute("data-action") && button.getAttribute("data-action") === "save-token") {
    const input = document.querySelector('input[name="token"]');
    state.token = input?.value?.trim?.() || "";
    localStorage.setItem("shorty.token", state.token);
    state.authError = "";
    await Promise.all([loadSystem(), loadJobs()]);
    showToast("Token kaydedildi.");
    render();
  }
}

async function bootstrap() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }

  await loadAuthStatus();
  render();
  await Promise.all([loadSystem(), loadJobs()]);
  render();

  appRoot.addEventListener("click", (event) => {
    void handleActionClick(event);
  });

  appRoot.addEventListener("submit", (event) => {
    if (event.target?.id === "generate-form") {
      void handleGenerateSubmit(event);
    }
  });

  window.addEventListener("hashchange", async () => {
    const route = readRoute();
    if (route.screen === "review" && route.jobId) {
      await loadSelectedJob(route.jobId);
    }
    render();
  });

  window.setInterval(async () => {
    await loadSystem();
    await loadJobs();
    render();
  }, 5000);
}

void bootstrap();
