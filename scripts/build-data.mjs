import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outputDir = path.resolve(root, "public", "data");

const requiredSourceFiles = ["videos.json", "playlists.json"];
const configuredDataDir = process.env.BAD_APPLE_YOUTUBE_DATA_DIR
  ? path.resolve(process.env.BAD_APPLE_YOUTUBE_DATA_DIR)
  : null;
const candidateSourceDirs = [
  configuredDataDir,
  path.resolve(root, "data", "bad-apple-youtube"),
  path.resolve(root, "..", "data", "bad-apple-youtube")
].filter(Boolean);

async function findSourceDir() {
  for (const candidate of candidateSourceDirs) {
    try {
      await Promise.all(requiredSourceFiles.map((file) => access(path.join(candidate, file))));
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error(
    [
      "Unable to find Bad Apple YouTube source data.",
      "Expected videos.json and playlists.json in one of:",
      ...candidateSourceDirs.map((dir) => `- ${dir}`),
      "Set BAD_APPLE_YOUTUBE_DATA_DIR to override this path."
    ].join("\n")
  );
}

const categoryLabels = {
  other_recreation: { zh: "创意复刻", en: "Creative recreation" },
  ai_or_voice_cover: { zh: "翻唱与声音", en: "Covers and audio" },
  game_or_game_engine: { zh: "游戏与引擎", en: "Games and engines" },
  hardware_physical: { zh: "硬件与实体设备", en: "Hardware and physical devices" },
  fandom_animation: { zh: "同人与动画", en: "Fandom and animation" },
  software_platform: { zh: "软件平台", en: "Software platforms" },
  meta_compilation: { zh: "合辑与元编辑", en: "Compilations and meta edits" }
};

function compactNumber(value, locale = "zh-CN") {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "";
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(number);
}

function durationLabel(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return "未知时长";
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const rest = Math.floor(value % 60);
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  }
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function isUnavailable(video) {
  const title = String(video.title || "");
  return video.unavailable === "yes" || /^\[(private|deleted|unavailable) video\]$/i.test(title);
}

function splitList(value) {
  return String(value || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function makeDescriptionZh(video, categoryLabel) {
  const channel = video.channel || "未知频道";
  const views = compactNumber(video.view_count, "zh-CN");
  const viewText = views ? `约 ${views} 次观看` : "播放量未公开";
  const duration = durationLabel(video.duration_seconds);
  const titleNote = video.title_matches_bad_apple ? "" : "标题未直接包含 Bad Apple，作为播放列表夹带条目保留。";
  return [`${categoryLabel}视频，来自 ${channel}，${duration}，${viewText}。`, titleNote]
    .filter(Boolean)
    .join(" ");
}

function makeDescriptionEn(video, categoryLabel) {
  const channel = video.channel || "Unknown channel";
  const views = compactNumber(video.view_count, "en-US");
  const viewText = views ? `about ${views} views` : "view count unavailable";
  const duration = durationLabel(video.duration_seconds);
  const titleNote = video.title_matches_bad_apple ? "" : "The title does not explicitly mention Bad Apple, so this is kept as a playlist-adjacent entry.";
  return [`${categoryLabel} video from ${channel}, ${duration}, ${viewText}.`, titleNote]
    .filter(Boolean)
    .join(" ");
}

const sourceDir = await findSourceDir();
const sourcePath = path.join(sourceDir, "videos.json");
const playlistsPath = path.join(sourceDir, "playlists.json");
const rawVideos = JSON.parse(await readFile(sourcePath, "utf8"));
const rawPlaylists = JSON.parse(await readFile(playlistsPath, "utf8"));
const availableRawVideos = rawVideos.filter((video) => !isUnavailable(video));
const videos = availableRawVideos.map((video) => {
  const playlists = splitList(video.playlist_titles);
  const labels = categoryLabels[video.category] || { zh: "未分类", en: "Uncategorized" };
  return {
    id: video.video_id,
    url: video.video_url,
    title: video.title || "Untitled video",
    channel: video.channel || "",
    channelUrl: video.uploader_url || "",
    thumbnailUrl: video.thumbnail_url,
    description: makeDescriptionZh(video, labels.zh),
    descriptionZh: makeDescriptionZh(video, labels.zh),
    descriptionEn: makeDescriptionEn(video, labels.en),
    category: video.category,
    categoryLabel: labels.zh,
    categoryLabelZh: labels.zh,
    categoryLabelEn: labels.en,
    tags: splitList(video.tags),
    durationSeconds: Number(video.duration_seconds) || 0,
    durationLabel: durationLabel(video.duration_seconds),
    viewCount: Number(video.view_count) || 0,
    viewLabelZh: compactNumber(video.view_count, "zh-CN"),
    viewLabelEn: compactNumber(video.view_count, "en-US"),
    playlistCount: Number(video.playlist_count) || playlists.length,
    playlistTitles: playlists,
    titleMatchesBadApple: video.title_matches_bad_apple === "yes"
  };
});

const playlists = rawPlaylists.map((playlist) => {
  const items = Number(playlist.items_collected) || 0;
  const publicItems = Number(playlist.public_items) || 0;
  const relevantItems = Number(playlist.relevant_items) || 0;
  return {
    id: playlist.playlist_id,
    title: playlist.title || "Untitled playlist",
    url: playlist.url,
    uploader: playlist.uploader || "",
    uploaderId: playlist.uploader_id || "",
    channelUrl: playlist.channel_url || "",
    viewCount: Number(playlist.view_count) || 0,
    viewLabelZh: compactNumber(playlist.view_count, "zh-CN"),
    viewLabelEn: compactNumber(playlist.view_count, "en-US"),
    itemsCollected: items,
    publicItems,
    relevantItems,
    descriptionZh: `这个播放列表贡献了 ${items} 条候选条目，其中 ${relevantItems} 条标题明确匹配 Bad Apple。`,
    descriptionEn: `This playlist contributed ${items} candidate entries, with ${relevantItems} titles explicitly matching Bad Apple.`
  };
});

const categories = Object.entries(
  videos.reduce((counts, video) => {
    counts[video.category] = (counts[video.category] || 0) + 1;
    return counts;
  }, {})
)
  .map(([id, count]) => ({
    id,
    label: categoryLabels[id]?.zh || id,
    labelZh: categoryLabels[id]?.zh || id,
    labelEn: categoryLabels[id]?.en || id,
    count
  }))
  .sort((left, right) => right.count - left.count);

const summary = {
  generatedAt: new Date().toISOString(),
  sourceVideos: rawVideos.length,
  totalVideos: videos.length,
  titleMatchedVideos: videos.filter((video) => video.titleMatchesBadApple).length,
  removedUnavailableVideos: rawVideos.length - availableRawVideos.length,
  sourcePlaylists: playlists.length,
  categories
};

await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, "videos.json"), `${JSON.stringify(videos, null, 2)}\n`);
await writeFile(path.join(outputDir, "playlists.json"), `${JSON.stringify(playlists, null, 2)}\n`);
await writeFile(path.join(outputDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);

console.log(`Generated ${videos.length} videos into ${path.relative(process.cwd(), outputDir)}`);
console.log(`Source data: ${path.relative(process.cwd(), sourceDir) || "."}`);
