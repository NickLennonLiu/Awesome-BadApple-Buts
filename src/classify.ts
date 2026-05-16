import "./classify.css";

type Category = {
  id: string;
  labelZh: string;
  labelEn: string;
  descriptionZh: string;
  descriptionEn: string;
};

type Summary = {
  generatedAt: string;
  totalVideos: number;
  externalOnlyVideos: number;
  needsReviewVideos: number;
};

type Video = {
  id: string;
  url: string;
  title: string;
  channel: string;
  channelUrl: string;
  thumbnailUrl: string;
  category: string;
  categoryLabelZh: string;
  categoryLabelEn: string;
  tags: string[];
  durationLabel: string;
  viewCount: number;
  viewLabelZh: string;
  playlistCount: number;
  playlistTitles: string[];
  titleMatchesBadApple: boolean;
  classificationConfidence: string;
  classificationStatus: string;
  classificationNotes: string;
  externalOnly: boolean;
  metadataStatus: string;
  externalSourceCount: number;
  externalSourceTitles: string[];
  externalSourceRepos: string[];
};

type AnnotationStatus = "auto" | "confirmed" | "needs_review" | "rejected";

type Annotation = {
  category?: string;
  tags?: string[];
  status?: AnnotationStatus;
  notes?: string;
  updatedAt?: string;
};

type EffectiveVideo = Video & {
  effectiveCategory: string;
  effectiveTags: string[];
  effectiveStatus: AnnotationStatus;
  effectiveNotes: string;
  dirty: boolean;
};

type SortMode = "views" | "title" | "category" | "status" | "external";

const storageKey = "awesome-badapples.annotations.v1";
const fallbackThumbnail =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 270">
    <rect width="480" height="270" fill="#111318"/>
    <path d="M250 62c-19 12-29 30-28 53 27 1 51-20 52-53h-24Z" fill="#f5f7fb"/>
    <path d="M220 113c-60 0-106 45-106 111 0 57 38 97 82 97 20 0 28-12 41-12s21 12 41 12c46 0 82-49 82-105 0-61-42-103-100-103-15 0-28 6-40 6Z" fill="#f5f7fb"/>
  </svg>`);

const state = {
  videos: [] as Video[],
  categories: [] as Category[],
  summary: null as Summary | null,
  annotations: {} as Record<string, Annotation>,
  query: "",
  category: "all",
  status: "all",
  source: "all",
  sort: "views" as SortMode
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function number(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function parseTags(value: string) {
  return value
    .split(/[;,，、]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function loadAnnotations() {
  try {
    const raw = localStorage.getItem(storageKey);
    state.annotations = raw ? (JSON.parse(raw) as Record<string, Annotation>) : {};
  } catch {
    state.annotations = {};
  }
}

function saveAnnotations() {
  localStorage.setItem(storageKey, JSON.stringify(state.annotations));
}

function categoryLabel(id: string) {
  return state.categories.find((category) => category.id === id)?.labelZh || id;
}

function statusLabel(status: string) {
  if (status === "confirmed") return "已确认";
  if (status === "needs_review") return "待复核";
  if (status === "rejected") return "剔除";
  return "自动";
}

function effectiveVideo(video: Video): EffectiveVideo {
  const annotation = state.annotations[video.id] || {};
  const status = annotation.status || (video.classificationStatus as AnnotationStatus) || "auto";
  const notes = annotation.notes ?? video.classificationNotes ?? "";
  return {
    ...video,
    effectiveCategory: annotation.category || video.category,
    effectiveTags: annotation.tags || video.tags,
    effectiveStatus: status,
    effectiveNotes: notes,
    dirty: Boolean(annotation.updatedAt)
  };
}

function searchable(video: EffectiveVideo) {
  return [
    video.title,
    video.channel,
    video.effectiveCategory,
    categoryLabel(video.effectiveCategory),
    video.effectiveTags.join(" "),
    video.externalSourceTitles.join(" "),
    video.playlistTitles.slice(0, 3).join(" ")
  ]
    .join(" ")
    .toLowerCase();
}

function filteredVideos() {
  const query = state.query.trim().toLowerCase();
  return state.videos
    .map(effectiveVideo)
    .filter((video) => (state.category === "all" ? true : video.effectiveCategory === state.category))
    .filter((video) => (state.status === "all" ? true : video.effectiveStatus === state.status))
    .filter((video) => {
      if (state.source === "external") return video.externalSourceCount > 0;
      if (state.source === "external-only") return video.externalOnly;
      if (state.source === "dirty") return video.dirty;
      return true;
    })
    .filter((video) => (query ? searchable(video).includes(query) : true))
    .sort(compareVideos);
}

function compareVideos(left: EffectiveVideo, right: EffectiveVideo) {
  if (state.sort === "title") return left.title.localeCompare(right.title, "zh-CN");
  if (state.sort === "category") {
    return (
      categoryLabel(left.effectiveCategory).localeCompare(categoryLabel(right.effectiveCategory), "zh-CN") ||
      right.viewCount - left.viewCount
    );
  }
  if (state.sort === "status") return left.effectiveStatus.localeCompare(right.effectiveStatus) || right.viewCount - left.viewCount;
  if (state.sort === "external") return right.externalSourceCount - left.externalSourceCount || right.viewCount - left.viewCount;
  return right.viewCount - left.viewCount;
}

function setAnnotation(id: string, patch: Annotation) {
  const current = state.annotations[id] || {};
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  state.annotations[id] = next;
  saveAnnotations();
  renderCounters();
}

function clearAnnotations() {
  state.annotations = {};
  saveAnnotations();
  renderShell();
}

function annotationPayload() {
  return Object.entries(state.annotations)
    .filter(([, annotation]) => annotation.updatedAt)
    .map(([videoId, annotation]) => ({
      video_id: videoId,
      category: annotation.category,
      tags: annotation.tags,
      classification_status: annotation.status,
      classification_notes: annotation.notes,
      updated_at: annotation.updatedAt
    }));
}

function exportAnnotations() {
  const payload = annotationPayload();
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bad-apple-classification-annotations-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function copyAnnotations() {
  const payload = annotationPayload();
  await navigator.clipboard.writeText(`${JSON.stringify(payload, null, 2)}\n`);
  const button = document.querySelector<HTMLButtonElement>("[data-action='copy']");
  if (button) {
    button.textContent = "已复制";
    setTimeout(() => {
      button.textContent = "复制 JSON";
    }, 1200);
  }
}

function renderShell() {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app || !state.summary) return;

  app.innerHTML = `
    <header class="classify-header">
      <div>
        <a class="back-link" href="./index.html">Bad Apple But</a>
        <h1>分类标注台</h1>
      </div>
      <dl class="classify-stats">
        <div><dt>公开视频</dt><dd>${number(state.summary.totalVideos)}</dd></div>
        <div><dt>待复核</dt><dd>${number(state.summary.needsReviewVideos)}</dd></div>
        <div><dt>外部补充</dt><dd>${number(state.summary.externalOnlyVideos)}</dd></div>
        <div><dt>本地修改</dt><dd data-counter="dirty">${number(annotationPayload().length)}</dd></div>
      </dl>
    </header>

    <main class="classify-main">
      <section class="filters" aria-label="classification filters">
        <label class="search-control">
          <span>搜索</span>
          <input id="query" type="search" value="${escapeHtml(state.query)}" placeholder="标题、频道、tag、来源" />
        </label>
        <label>
          <span>分类</span>
          <select id="category">
            <option value="all">全部分类</option>
            ${state.categories.map((category) => `<option value="${category.id}" ${state.category === category.id ? "selected" : ""}>${escapeHtml(category.labelZh)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>状态</span>
          <select id="status">
            <option value="all">全部状态</option>
            <option value="auto" ${state.status === "auto" ? "selected" : ""}>自动</option>
            <option value="confirmed" ${state.status === "confirmed" ? "selected" : ""}>已确认</option>
            <option value="needs_review" ${state.status === "needs_review" ? "selected" : ""}>待复核</option>
            <option value="rejected" ${state.status === "rejected" ? "selected" : ""}>剔除</option>
          </select>
        </label>
        <label>
          <span>来源</span>
          <select id="source">
            <option value="all">全部来源</option>
            <option value="external" ${state.source === "external" ? "selected" : ""}>参考列表</option>
            <option value="external-only" ${state.source === "external-only" ? "selected" : ""}>外部补充</option>
            <option value="dirty" ${state.source === "dirty" ? "selected" : ""}>本地修改</option>
          </select>
        </label>
        <label>
          <span>排序</span>
          <select id="sort">
            <option value="views" ${state.sort === "views" ? "selected" : ""}>播放量</option>
            <option value="title" ${state.sort === "title" ? "selected" : ""}>标题</option>
            <option value="category" ${state.sort === "category" ? "selected" : ""}>分类</option>
            <option value="status" ${state.sort === "status" ? "selected" : ""}>状态</option>
            <option value="external" ${state.sort === "external" ? "selected" : ""}>参考来源</option>
          </select>
        </label>
        <div class="actions">
          <button data-action="export" type="button">导出 JSON</button>
          <button data-action="copy" type="button">复制 JSON</button>
          <button data-action="clear" type="button">清空修改</button>
        </div>
      </section>

      <section class="table-meta">
        <strong data-counter="filtered">0</strong>
        <span>条结果</span>
        <span>生成于 ${new Date(state.summary.generatedAt).toLocaleString("zh-CN")}</span>
      </section>

      <section class="table-shell">
        <table>
          <thead>
            <tr>
              <th class="col-video">视频</th>
              <th>当前分类</th>
              <th>Tags</th>
              <th>标注状态</th>
              <th>备注</th>
              <th>来源</th>
            </tr>
          </thead>
          <tbody id="video-rows"></tbody>
        </table>
      </section>
    </main>
  `;

  bindShellEvents();
  renderTable();
}

function bindShellEvents() {
  document.querySelector<HTMLInputElement>("#query")?.addEventListener("input", (event) => {
    state.query = (event.currentTarget as HTMLInputElement).value;
    renderTable();
  });
  document.querySelector<HTMLSelectElement>("#category")?.addEventListener("change", (event) => {
    state.category = (event.currentTarget as HTMLSelectElement).value;
    renderTable();
  });
  document.querySelector<HTMLSelectElement>("#status")?.addEventListener("change", (event) => {
    state.status = (event.currentTarget as HTMLSelectElement).value;
    renderTable();
  });
  document.querySelector<HTMLSelectElement>("#source")?.addEventListener("change", (event) => {
    state.source = (event.currentTarget as HTMLSelectElement).value;
    renderTable();
  });
  document.querySelector<HTMLSelectElement>("#sort")?.addEventListener("change", (event) => {
    state.sort = (event.currentTarget as HTMLSelectElement).value as SortMode;
    renderTable();
  });
  document.querySelector<HTMLTableSectionElement>("#video-rows")?.addEventListener("change", handleRowChange);
  document.querySelector<HTMLTableSectionElement>("#video-rows")?.addEventListener("input", handleRowInput);
  document.querySelector<HTMLButtonElement>("[data-action='export']")?.addEventListener("click", exportAnnotations);
  document.querySelector<HTMLButtonElement>("[data-action='copy']")?.addEventListener("click", () => void copyAnnotations());
  document.querySelector<HTMLButtonElement>("[data-action='clear']")?.addEventListener("click", clearAnnotations);
}

function renderCounters(filteredCount?: number) {
  const dirty = document.querySelector<HTMLElement>("[data-counter='dirty']");
  const filtered = document.querySelector<HTMLElement>("[data-counter='filtered']");
  if (dirty) dirty.textContent = number(annotationPayload().length);
  if (filtered && typeof filteredCount === "number") filtered.textContent = number(filteredCount);
}

function renderTable() {
  const rows = document.querySelector<HTMLTableSectionElement>("#video-rows");
  if (!rows) return;
  const videos = filteredVideos();
  renderCounters(videos.length);
  rows.innerHTML = videos.map(renderRow).join("");
  rows.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
    image.addEventListener("error", () => {
      image.src = fallbackThumbnail;
    });
  });
}

function categoryOptions(selected: string) {
  return state.categories
    .map((category) => `<option value="${category.id}" ${selected === category.id ? "selected" : ""}>${escapeHtml(category.labelZh)}</option>`)
    .join("");
}

function tagText(video: EffectiveVideo) {
  return video.effectiveTags.join("; ");
}

function renderRow(video: EffectiveVideo) {
  const source = video.externalSourceTitles.length
    ? video.externalSourceTitles.map(escapeHtml).join("<br />")
    : video.playlistTitles.slice(0, 2).map(escapeHtml).join("<br />");
  const sourceBadge = video.externalOnly
    ? `<span class="pill warning">外部补充</span>`
    : video.externalSourceCount > 0
      ? `<span class="pill">参考列表</span>`
      : "";
  const dirty = video.dirty ? `<span class="pill dirty">已改</span>` : "";
  const views = video.viewLabelZh ? `${escapeHtml(video.viewLabelZh)} 播放` : "播放量未知";
  return `
    <tr data-video-id="${escapeHtml(video.id)}">
      <td class="video-cell">
        <a class="thumb" href="${escapeHtml(video.url)}" target="_blank" rel="noreferrer">
          <img src="${escapeHtml(video.thumbnailUrl || fallbackThumbnail)}" alt="${escapeHtml(video.title)}" loading="lazy" referrerpolicy="no-referrer" />
        </a>
        <div class="video-copy">
          <a class="video-title" href="${escapeHtml(video.url)}" target="_blank" rel="noreferrer">${escapeHtml(video.title)}</a>
          <div class="video-sub">
            <span>${escapeHtml(video.channel || "未知频道")}</span>
            <span>${escapeHtml(video.durationLabel || "未知时长")}</span>
            <span>${views}</span>
          </div>
          <div class="row-pills">
            <span class="pill">${escapeHtml(video.classificationConfidence)}</span>
            ${sourceBadge}
            ${dirty}
          </div>
        </div>
      </td>
      <td>
        <select data-field="category" aria-label="分类">${categoryOptions(video.effectiveCategory)}</select>
      </td>
      <td>
        <textarea data-field="tags" aria-label="tags" rows="3">${escapeHtml(tagText(video))}</textarea>
      </td>
      <td>
        <select data-field="status" aria-label="状态">
          <option value="auto" ${video.effectiveStatus === "auto" ? "selected" : ""}>${statusLabel("auto")}</option>
          <option value="confirmed" ${video.effectiveStatus === "confirmed" ? "selected" : ""}>${statusLabel("confirmed")}</option>
          <option value="needs_review" ${video.effectiveStatus === "needs_review" ? "selected" : ""}>${statusLabel("needs_review")}</option>
          <option value="rejected" ${video.effectiveStatus === "rejected" ? "selected" : ""}>${statusLabel("rejected")}</option>
        </select>
      </td>
      <td>
        <textarea data-field="notes" aria-label="备注" rows="3">${escapeHtml(video.effectiveNotes)}</textarea>
      </td>
      <td class="source-cell">${source || "播放列表快照"}</td>
    </tr>
  `;
}

function handleRowChange(event: Event) {
  const target = event.target as HTMLSelectElement | HTMLTextAreaElement;
  const row = target.closest<HTMLTableRowElement>("tr[data-video-id]");
  const id = row?.dataset.videoId;
  const field = target.dataset.field;
  if (!id || !field) return;
  if (field === "category") {
    setAnnotation(id, { category: target.value, status: "confirmed" });
  } else if (field === "status") {
    setAnnotation(id, { status: target.value as AnnotationStatus });
  } else if (field === "tags") {
    setAnnotation(id, { tags: parseTags(target.value) });
  } else if (field === "notes") {
    setAnnotation(id, { notes: target.value });
  }
  renderTable();
}

function handleRowInput(event: Event) {
  const target = event.target as HTMLTextAreaElement;
  const row = target.closest<HTMLTableRowElement>("tr[data-video-id]");
  const id = row?.dataset.videoId;
  const field = target.dataset.field;
  if (!id || !field) return;
  if (field === "tags") {
    setAnnotation(id, { tags: parseTags(target.value) });
  }
  if (field === "notes") {
    setAnnotation(id, { notes: target.value });
  }
}

async function loadData() {
  const [videosResponse, taxonomyResponse, summaryResponse] = await Promise.all([
    fetch("./data/videos.json"),
    fetch("./data/taxonomy.json"),
    fetch("./data/summary.json")
  ]);
  if (!videosResponse.ok || !taxonomyResponse.ok || !summaryResponse.ok) {
    throw new Error("Failed to load classification data");
  }
  state.videos = (await videosResponse.json()) as Video[];
  state.categories = (await taxonomyResponse.json()) as Category[];
  state.summary = (await summaryResponse.json()) as Summary;
  loadAnnotations();
}

loadData()
  .then(renderShell)
  .catch((error) => {
    const app = document.querySelector<HTMLDivElement>("#app");
    if (app) {
      app.innerHTML = `<main class="load-error"><h1>数据加载失败</h1><p>${escapeHtml(error instanceof Error ? error.message : String(error))}</p></main>`;
    }
  });
