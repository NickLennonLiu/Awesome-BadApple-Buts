import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const videosPath = path.join(root, "data", "bad-apple-youtube", "videos.json");
const sampleDir = path.join(root, "data", "runs", "download-sample");
const logPath = path.join(sampleDir, "yt-dlp-download.log");
const outputJsonPath = path.join(root, "data", "download-size-estimate.json");
const outputMarkdownPath = path.join(root, "data", "download-size-estimate.md");

const qualityProfiles = [
  { id: "worst_144p", label: "最低品质 / 144p 级", assumedKbps: 200 },
  { id: "360p", label: "360p", assumedKbps: 600 },
  { id: "480p", label: "480p", assumedKbps: 1100 },
  { id: "720p", label: "720p", assumedKbps: 2800 },
  { id: "1080p", label: "1080p", assumedKbps: 5000 }
];

function isUnavailable(video) {
  const title = String(video.title || "");
  return video.unavailable === "yes" || /^\[(private|deleted|unavailable) video\]$/i.test(title);
}

function bytesFor(seconds, kbps) {
  return (seconds * kbps * 1000) / 8;
}

function gib(bytes) {
  return bytes / 1024 ** 3;
}

function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

function durationLabel(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = Math.floor(seconds % 60);
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

async function downloadedFiles() {
  try {
    const entries = await readdir(sampleDir);
    const files = [];
    for (const entry of entries) {
      if (entry.endsWith(".txt") || entry.endsWith(".log")) continue;
      const fullPath = path.join(sampleDir, entry);
      const info = await stat(fullPath);
      if (info.isFile()) {
        files.push({ file: path.relative(root, fullPath), bytes: info.size });
      }
    }
    return files;
  } catch {
    return [];
  }
}

const rawVideos = JSON.parse(await readFile(videosPath, "utf8"));
const publicVideos = rawVideos.filter((video) => !isUnavailable(video));
const knownDurations = publicVideos.map((video) => Number(video.duration_seconds) || 0).filter((seconds) => seconds > 0);
const sortedDurations = [...knownDurations].sort((left, right) => left - right);
const medianDurationSeconds = sortedDurations[Math.floor(sortedDurations.length / 2)] || 0;
const knownDurationSeconds = knownDurations.reduce((total, seconds) => total + seconds, 0);
const unknownDurationCount = publicVideos.length - knownDurations.length;
const imputedDurationSeconds = knownDurationSeconds + unknownDurationCount * medianDurationSeconds;
const files = await downloadedFiles();
let log = "";
try {
  log = await readFile(logPath, "utf8");
} catch {
  // The estimate can still be generated before a sample download attempt.
}
const botCheckFailures = (log.match(/Sign in to confirm you.re not a bot/g) || []).length;
const topTen = [...publicVideos]
  .sort((left, right) => (Number(right.view_count) || 0) - (Number(left.view_count) || 0))
  .slice(0, 10)
  .map((video) => ({
    video_id: video.video_id,
    title: video.title,
    url: video.video_url,
    view_count: Number(video.view_count) || 0,
    duration_seconds: Number(video.duration_seconds) || 0,
    downloaded: files.some((file) => file.file.includes(video.video_id))
  }));

const estimates = qualityProfiles.map((profile) => ({
  ...profile,
  estimatedKnownDurationGiB: round(gib(bytesFor(knownDurationSeconds, profile.assumedKbps))),
  estimatedWithMedianImputationGiB: round(gib(bytesFor(imputedDurationSeconds, profile.assumedKbps))),
  estimatedPerFourMinuteVideoMiB: round(bytesFor(240, profile.assumedKbps) / 1024 ** 2, 1)
}));

const result = {
  generatedAt: new Date().toISOString(),
  publicVideoCount: publicVideos.length,
  knownDurationCount: knownDurations.length,
  unknownDurationCount,
  knownDurationSeconds,
  knownDurationHours: round(knownDurationSeconds / 3600, 2),
  medianDurationSeconds,
  imputedDurationSeconds,
  imputedDurationHours: round(imputedDurationSeconds / 3600, 2),
  downloadAttempt: {
    attemptedTopVideos: topTen.length,
    sampleDir: path.relative(root, sampleDir),
    downloadedFileCount: files.length,
    downloadedFiles: files,
    botCheckFailures,
    logFile: path.relative(root, logPath)
  },
  topTen,
  estimates,
  assumptions: [
    "yt-dlp sampling was attempted with worstvideo*+worstaudio/worst, but YouTube returned bot-check errors in this environment.",
    "The estimate therefore uses total public-video duration and fixed combined audio+video bitrate assumptions.",
    "The 16 public external-list additions have no duration metadata yet, so they are imputed with the median known duration."
  ]
};

const markdown = `# Download Size Estimate

Generated: ${result.generatedAt}

## Sampling Attempt

- Top videos attempted: ${result.downloadAttempt.attemptedTopVideos}
- Downloaded files: ${result.downloadAttempt.downloadedFileCount}
- Bot-check failures in log: ${result.downloadAttempt.botCheckFailures}
- Log: \`${result.downloadAttempt.logFile}\`

## Duration Basis

- Public videos: ${result.publicVideoCount}
- Known durations: ${result.knownDurationCount}
- Unknown durations: ${result.unknownDurationCount}
- Known total duration: ${durationLabel(result.knownDurationSeconds)} (${result.knownDurationHours} hours)
- Median duration used for unknown rows: ${result.medianDurationSeconds} seconds
- Imputed total duration: ${durationLabel(result.imputedDurationSeconds)} (${result.imputedDurationHours} hours)

## Estimates

| Quality | Assumed combined bitrate | Total, known durations | Total, with median imputation | Approx per 4 min |
| --- | ---: | ---: | ---: | ---: |
${estimates
  .map(
    (estimate) =>
      `| ${estimate.label} | ${estimate.assumedKbps} kbps | ${estimate.estimatedKnownDurationGiB} GiB | ${estimate.estimatedWithMedianImputationGiB} GiB | ${estimate.estimatedPerFourMinuteVideoMiB} MiB |`
  )
  .join("\n")}

## Top 10 Attempted

| Rank | Video | Views | Duration | Downloaded |
| ---: | --- | ---: | ---: | --- |
${topTen
  .map(
    (video, index) =>
      `| ${index + 1} | [${video.title}](${video.url}) | ${video.view_count} | ${video.duration_seconds || "unknown"}s | ${video.downloaded ? "yes" : "no"} |`
  )
  .join("\n")}
`;

await writeFile(outputJsonPath, `${JSON.stringify(result, null, 2)}\n`);
await writeFile(outputMarkdownPath, markdown);

console.log(`Wrote ${path.relative(process.cwd(), outputJsonPath)}`);
console.log(`Wrote ${path.relative(process.cwd(), outputMarkdownPath)}`);
