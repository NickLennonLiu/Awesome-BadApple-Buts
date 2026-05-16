import "./styles.css";

type Language = "zh" | "en";
type Page = "videos" | "about";

type CategorySummary = {
  id: string;
  label: string;
  labelZh: string;
  labelEn: string;
  count: number;
};

type Summary = {
  generatedAt: string;
  sourceVideos: number;
  totalVideos: number;
  titleMatchedVideos: number;
  removedUnavailableVideos: number;
  sourcePlaylists: number;
  externalSourceVideos: number;
  externalOnlyVideos: number;
  needsReviewVideos: number;
  categories: CategorySummary[];
};

type SourcePlaylist = {
  id: string;
  title: string;
  url: string;
  uploader: string;
  uploaderId: string;
  channelUrl: string;
  viewCount: number;
  viewLabelZh: string;
  viewLabelEn: string;
  itemsCollected: number;
  publicItems: number;
  relevantItems: number;
  descriptionZh: string;
  descriptionEn: string;
};

type Video = {
  id: string;
  url: string;
  title: string;
  channel: string;
  channelUrl: string;
  thumbnailUrl: string;
  description: string;
  descriptionZh: string;
  descriptionEn: string;
  category: string;
  categoryLabel: string;
  categoryLabelZh: string;
  categoryLabelEn: string;
  tags: string[];
  durationSeconds: number;
  durationLabel: string;
  viewCount: number;
  viewLabelZh: string;
  viewLabelEn: string;
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

type SortMode = "featured" | "views" | "playlists" | "duration" | "title";

const fallbackThumbnail =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
    <rect width="640" height="360" fill="#111318"/>
    <path d="M337 83c-25 16-39 39-38 71 37 2 70-27 71-71h-33Z" fill="#f5f7fb"/>
    <path d="M297 151c-81 0-144 61-144 151 0 78 52 133 112 133 27 0 38-16 55-16s29 16 55 16c62 0 112-66 112-143 0-83-57-141-136-141-20 0-38 8-54 8Z" fill="#f5f7fb"/>
  </svg>`);

const text = {
  zh: {
    eyebrow: "Bad Apple!! YouTube 快照",
    tagline: "来自公开播放列表的 Bad Apple!! 视频集合 — 按播放量、来源次数、时长浏览数百个复刻。",
    videoStat: "视频",
    titleMatchStat: "标题匹配",
    sourceStat: "来源列表",
    videosTab: "视频",
    aboutTab: "关于",
    classifyTab: "分类标注",
    searchLabel: "搜索",
    searchPlaceholder: "标题、频道、播放列表",
    categoryLabel: "分类",
    allCategories: "全部分类",
    sortLabel: "排序",
    sortFeatured: "推荐顺序",
    sortViews: "播放量",
    sortPlaylists: "来源次数",
    sortDuration: "时长",
    sortTitle: "标题",
    onlyTitleMatches: "只看标题匹配",
    videosSuffix: "个视频",
    snapshotDate: "数据生成于",
    noResults: "没有符合条件的视频。",
    unknownChannel: "未知频道",
    viewsSuffix: "播放",
    loadErrorTitle: "数据加载失败",
    unpublished: "未公开",
    languageLabel: "语言",
    aboutTitle: "关于这个视频库",
    aboutIntro:
      "这个网站展示的是从公开 YouTube 播放列表快照中整理出的 Bad Apple!! 相关视频。原始采集以播放列表为入口，去重后保留公开视频，并过滤私密、删除或不可用的占位条目。",
    aboutSourceSummary: "本页列出当前数据集中使用的来源播放列表。",
    playlistSourcesTitle: "来源播放列表",
    uploaderLabel: "整理者",
    itemsLabel: "候选条目",
    publicItemsLabel: "公开视频",
    relevantItemsLabel: "标题匹配",
    playlistViewsLabel: "播放列表观看",
    openPlaylist: "打开播放列表",
    footerCredit: "由公开 YouTube 数据构建",
    footerNote: "© Bad Apple But"
  },
  en: {
    eyebrow: "Bad Apple!! YouTube Snapshot",
    tagline: "A curated archive of Bad Apple!! videos from public playlists — browse hundreds of recreations by views, source frequency, and duration.",
    videoStat: "Videos",
    titleMatchStat: "Title matches",
    sourceStat: "Source playlists",
    videosTab: "Videos",
    aboutTab: "About",
    classifyTab: "Classification",
    searchLabel: "Search",
    searchPlaceholder: "Title, channel, playlist",
    categoryLabel: "Category",
    allCategories: "All categories",
    sortLabel: "Sort",
    sortFeatured: "Featured",
    sortViews: "Views",
    sortPlaylists: "Source frequency",
    sortDuration: "Duration",
    sortTitle: "Title",
    onlyTitleMatches: "Title matches only",
    videosSuffix: "videos",
    snapshotDate: "Data generated",
    noResults: "No videos match the current filters.",
    unknownChannel: "Unknown channel",
    viewsSuffix: "views",
    loadErrorTitle: "Failed to load data",
    unpublished: "Unavailable",
    languageLabel: "Language",
    aboutTitle: "About This Gallery",
    aboutIntro:
      "This site presents Bad Apple!! related videos collected from public YouTube playlist snapshots. The collection starts from playlists, deduplicates videos, keeps public entries, and filters out private, deleted, or unavailable placeholders.",
    aboutSourceSummary: "The source playlists used in the current dataset are listed below.",
    playlistSourcesTitle: "Source Playlists",
    uploaderLabel: "Curator",
    itemsLabel: "Candidate entries",
    publicItemsLabel: "Public videos",
    relevantItemsLabel: "Title matches",
    playlistViewsLabel: "Playlist views",
    openPlaylist: "Open playlist",
    footerCredit: "Built from public YouTube data",
    footerNote: "© Bad Apple But"
  }
} satisfies Record<Language, Record<string, string>>;

const state = {
  videos: [] as Video[],
  playlists: [] as SourcePlaylist[],
  summary: null as Summary | null,
  query: "",
  category: "all",
  sort: "featured" as SortMode,
  onlyTitleMatches: false,
  language: "zh" as Language,
  page: "videos" as Page
};

function t(key: keyof typeof text.zh) {
  return text[state.language][key];
}

function numberFormatter() {
  return new Intl.NumberFormat(state.language === "zh" ? "zh-CN" : "en-US");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function compactNumber(value: number) {
  if (!Number.isFinite(value) || value <= 0) return t("unpublished");
  return new Intl.NumberFormat(state.language === "zh" ? "zh-CN" : "en-US", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

function categoryLabel(category: CategorySummary) {
  return state.language === "zh" ? category.labelZh : category.labelEn;
}

function videoCategoryLabel(video: Video) {
  return state.language === "zh" ? video.categoryLabelZh : video.categoryLabelEn;
}

function videoDescription(video: Video) {
  return state.language === "zh" ? video.descriptionZh || video.description : video.descriptionEn || video.description;
}

function videoViewLabel(video: Video) {
  return state.language === "zh" ? video.viewLabelZh : video.viewLabelEn;
}

function playlistDescription(playlist: SourcePlaylist) {
  return state.language === "zh" ? playlist.descriptionZh : playlist.descriptionEn;
}

function playlistViewLabel(playlist: SourcePlaylist) {
  return state.language === "zh" ? playlist.viewLabelZh : playlist.viewLabelEn;
}

function searchable(video: Video) {
  return [
    video.title,
    video.channel,
    video.descriptionZh,
    video.descriptionEn,
    video.categoryLabelZh,
    video.categoryLabelEn,
    video.playlistTitles.slice(0, 4).join(" ")
  ]
    .join(" ")
    .toLowerCase();
}

function compareVideos(left: Video, right: Video) {
  if (state.sort === "views") return right.viewCount - left.viewCount;
  if (state.sort === "playlists") return right.playlistCount - left.playlistCount || right.viewCount - left.viewCount;
  if (state.sort === "duration") return right.durationSeconds - left.durationSeconds;
  if (state.sort === "title") return left.title.localeCompare(right.title, state.language === "zh" ? "zh-CN" : "en-US");
  return (
    Number(right.titleMatchesBadApple) - Number(left.titleMatchesBadApple) ||
    right.playlistCount - left.playlistCount ||
    right.viewCount - left.viewCount ||
    left.title.localeCompare(right.title, state.language === "zh" ? "zh-CN" : "en-US")
  );
}

function filteredVideos() {
  const query = state.query.trim().toLowerCase();
  return state.videos
    .filter((video) => (state.category === "all" ? true : video.category === state.category))
    .filter((video) => (state.onlyTitleMatches ? video.titleMatchesBadApple : true))
    .filter((video) => (query ? searchable(video).includes(query) : true))
    .sort(compareVideos);
}

function renderShell() {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app || !state.summary) return;
  document.documentElement.lang = state.language === "zh" ? "zh-CN" : "en";

  app.innerHTML = `
    <header class="app-header">
      <div class="brand">
        <div class="brand-mark">
          <span class="silhouette" aria-hidden="true">
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
              <path class="stem" d="M35 12c-3 2-5 5-5 9 5 0 9-4 9-9h-4Z" />
              <path class="body" d="M30 21c-9 0-16 7-16 17 0 9 6 15 13 15 3 0 4-2 6-2s3 2 6 2c7 0 11-8 11-16 0-9-6-16-15-16-2 0-4 1-5 1Z" />
            </svg>
          </span>
          <p class="eyebrow">${t("eyebrow")}</p>
        </div>
        <h1>Bad Apple But</h1>
        <p class="tagline">${t("tagline")}</p>
      </div>
      <div class="header-actions">
        <div class="language-switch" role="group" aria-label="${t("languageLabel")}">
          <button class="${state.language === "zh" ? "active" : ""}" data-language="zh" type="button">中文</button>
          <button class="${state.language === "en" ? "active" : ""}" data-language="en" type="button">EN</button>
        </div>
        <dl class="stats" aria-label="dataset statistics">
          <div><dt>${t("videoStat")}</dt><dd>${numberFormatter().format(state.summary.totalVideos)}</dd></div>
          <div><dt>${t("titleMatchStat")}</dt><dd>${numberFormatter().format(state.summary.titleMatchedVideos)}</dd></div>
          <div><dt>${t("sourceStat")}</dt><dd>${numberFormatter().format(state.summary.sourcePlaylists)}</dd></div>
        </dl>
      </div>
    </header>

    <main>
      <nav class="tab-nav" aria-label="sections">
        <button class="${state.page === "videos" ? "active" : ""}" data-page="videos" type="button">${t("videosTab")}</button>
        <button class="${state.page === "about" ? "active" : ""}" data-page="about" type="button">${t("aboutTab")}</button>
        <a href="./classify.html">${t("classifyTab")}</a>
      </nav>
      <div id="page-root"></div>
      <footer class="site-footer">
        <span>${t("footerNote")}</span>
        <span class="accent">${t("footerCredit")}</span>
      </footer>
    </main>
  `;

  document.querySelectorAll<HTMLButtonElement>("[data-language]").forEach((button) => {
    button.addEventListener("click", () => {
      state.language = button.dataset.language === "en" ? "en" : "zh";
      renderShell();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-page]").forEach((button) => {
    button.addEventListener("click", () => {
      state.page = button.dataset.page === "about" ? "about" : "videos";
      renderShell();
    });
  });

  renderPage();
}

function renderPage() {
  if (state.page === "about") {
    renderAboutPage();
    return;
  }
  renderVideosPage();
}

function renderVideosPage() {
  const root = document.querySelector<HTMLElement>("#page-root");
  if (!root || !state.summary) return;

  root.innerHTML = `
    <section class="toolbar" aria-label="filters">
      <label class="search-field">
        <span>${t("searchLabel")}</span>
        <span class="search-input">
          <input id="search" type="search" autocomplete="off" placeholder="${t("searchPlaceholder")}" value="${escapeHtml(state.query)}" />
        </span>
      </label>
      <label>
        <span>${t("categoryLabel")}</span>
        <select id="category">
          <option value="all">${t("allCategories")}</option>
          ${state.summary.categories
            .map(
              (category) =>
                `<option value="${escapeHtml(category.id)}" ${state.category === category.id ? "selected" : ""}>${escapeHtml(categoryLabel(category))} (${category.count})</option>`
            )
            .join("")}
        </select>
      </label>
      <label>
        <span>${t("sortLabel")}</span>
        <select id="sort">
          <option value="featured" ${state.sort === "featured" ? "selected" : ""}>${t("sortFeatured")}</option>
          <option value="views" ${state.sort === "views" ? "selected" : ""}>${t("sortViews")}</option>
          <option value="playlists" ${state.sort === "playlists" ? "selected" : ""}>${t("sortPlaylists")}</option>
          <option value="duration" ${state.sort === "duration" ? "selected" : ""}>${t("sortDuration")}</option>
          <option value="title" ${state.sort === "title" ? "selected" : ""}>${t("sortTitle")}</option>
        </select>
      </label>
      <label class="check-row">
        <input id="title-match" type="checkbox" ${state.onlyTitleMatches ? "checked" : ""} />
        <span>${t("onlyTitleMatches")}</span>
      </label>
    </section>

    <section class="result-head">
      <h2 id="result-count"><strong>0</strong> ${t("videosSuffix")}</h2>
      <p id="snapshot-date"></p>
    </section>

    <section id="video-grid" class="video-grid" aria-live="polite"></section>
  `;

  const search = document.querySelector<HTMLInputElement>("#search");
  const category = document.querySelector<HTMLSelectElement>("#category");
  const sort = document.querySelector<HTMLSelectElement>("#sort");
  const titleMatch = document.querySelector<HTMLInputElement>("#title-match");

  search?.addEventListener("input", () => {
    state.query = search.value;
    renderVideos();
  });
  category?.addEventListener("change", () => {
    state.category = category.value;
    renderVideos();
  });
  sort?.addEventListener("change", () => {
    state.sort = sort.value as SortMode;
    renderVideos();
  });
  titleMatch?.addEventListener("change", () => {
    state.onlyTitleMatches = titleMatch.checked;
    renderVideos();
  });

  const snapshotDate = document.querySelector<HTMLParagraphElement>("#snapshot-date");
  if (snapshotDate) {
    snapshotDate.textContent = `${t("snapshotDate")} ${new Date(state.summary.generatedAt).toLocaleString(state.language === "zh" ? "zh-CN" : "en-US")}`;
  }

  renderVideos();
}

function renderVideos() {
  const videos = filteredVideos();
  const grid = document.querySelector<HTMLElement>("#video-grid");
  const resultCount = document.querySelector<HTMLElement>("#result-count");
  if (!grid || !resultCount) return;

  resultCount.innerHTML = `<strong>${numberFormatter().format(videos.length)}</strong> ${t("videosSuffix")}`;

  if (!videos.length) {
    grid.innerHTML = `<div class="empty-state">${t("noResults")}</div>`;
    return;
  }

  grid.innerHTML = videos.map(renderVideoCard).join("");

  grid.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
    image.addEventListener("error", () => {
      image.src = fallbackThumbnail;
      image.classList.add("thumb-fallback");
    });
  });
}

function renderVideoCard(video: Video) {
  const title = escapeHtml(video.title);
  const channel = escapeHtml(video.channel || t("unknownChannel"));
  const viewLabel = videoViewLabel(video) || compactNumber(video.viewCount);
  const viewBadge =
    video.viewCount > 0
      ? `<span class="badge">${escapeHtml(viewLabel)} ${t("viewsSuffix")}</span>`
      : "";
  const duration = video.durationLabel
    ? `<span class="thumb-duration">${escapeHtml(video.durationLabel)}</span>`
    : "";

  return `
    <article class="video-card">
      <a class="thumb-link" href="${escapeHtml(video.url)}" target="_blank" rel="noreferrer" aria-label="${title}">
        <div class="thumb-badges">
          ${viewBadge}
        </div>
        <img src="${escapeHtml(video.thumbnailUrl || fallbackThumbnail)}" alt="${title}" loading="lazy" referrerpolicy="no-referrer" />
        ${duration}
        <span class="play-overlay" aria-hidden="true">
          <span class="play-button">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M8 5v14l11-7z"/></svg>
          </span>
        </span>
      </a>
      <div class="card-body">
        <h3><a href="${escapeHtml(video.url)}" target="_blank" rel="noreferrer">${title}</a></h3>
        <div class="meta">
          <span class="channel">${channel}</span>
        </div>
      </div>
    </article>
  `;
}

function renderAboutPage() {
  const root = document.querySelector<HTMLElement>("#page-root");
  if (!root || !state.summary) return;

  root.innerHTML = `
    <section class="about-panel">
      <div class="about-copy">
        <h2>${t("aboutTitle")}</h2>
        <p>${t("aboutIntro")}</p>
        <p>${t("aboutSourceSummary")}</p>
      </div>
      <div class="about-facts">
        <div><span>${t("videoStat")}</span><strong>${numberFormatter().format(state.summary.totalVideos)}</strong></div>
        <div><span>${t("titleMatchStat")}</span><strong>${numberFormatter().format(state.summary.titleMatchedVideos)}</strong></div>
        <div><span>${t("sourceStat")}</span><strong>${numberFormatter().format(state.summary.sourcePlaylists)}</strong></div>
      </div>
    </section>

    <section class="playlist-section">
      <h2>${t("playlistSourcesTitle")}</h2>
      <div class="playlist-grid">
        ${state.playlists.map(renderPlaylistCard).join("")}
      </div>
    </section>
  `;
}

function renderPlaylistCard(playlist: SourcePlaylist) {
  const playlistViews = playlistViewLabel(playlist);
  const viewText = playlistViews ? `<span>${escapeHtml(playlistViews)} ${t("playlistViewsLabel")}</span>` : "";
  return `
    <article class="playlist-card">
      <h3><a href="${escapeHtml(playlist.url)}" target="_blank" rel="noreferrer">${escapeHtml(playlist.title)}</a></h3>
      <p>${escapeHtml(playlistDescription(playlist))}</p>
      <dl>
        <div><dt>${t("uploaderLabel")}</dt><dd>${escapeHtml(playlist.uploader || t("unknownChannel"))}</dd></div>
        <div><dt>${t("itemsLabel")}</dt><dd>${numberFormatter().format(playlist.itemsCollected)}</dd></div>
        <div><dt>${t("publicItemsLabel")}</dt><dd>${numberFormatter().format(playlist.publicItems)}</dd></div>
        <div><dt>${t("relevantItemsLabel")}</dt><dd>${numberFormatter().format(playlist.relevantItems)}</dd></div>
      </dl>
      <div class="playlist-actions">
        ${viewText}
        <a href="${escapeHtml(playlist.url)}" target="_blank" rel="noreferrer">${t("openPlaylist")}</a>
      </div>
    </article>
  `;
}

async function loadData() {
  const [videosResponse, summaryResponse, playlistsResponse] = await Promise.all([
    fetch("./data/videos.json"),
    fetch("./data/summary.json"),
    fetch("./data/playlists.json")
  ]);
  if (!videosResponse.ok || !summaryResponse.ok || !playlistsResponse.ok) {
    throw new Error("Failed to load gallery data");
  }
  state.videos = (await videosResponse.json()) as Video[];
  state.summary = (await summaryResponse.json()) as Summary;
  state.playlists = (await playlistsResponse.json()) as SourcePlaylist[];
}

loadData()
  .then(renderShell)
  .catch((error) => {
    const app = document.querySelector<HTMLDivElement>("#app");
    if (app) {
      app.innerHTML = `<main class="load-error"><h1>${t("loadErrorTitle")}</h1><p>${escapeHtml(error instanceof Error ? error.message : String(error))}</p></main>`;
    }
  });
