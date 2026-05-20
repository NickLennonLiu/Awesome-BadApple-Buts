import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const videosPath = path.join(root, "data", "bad-apple-youtube", "videos.json");

const defaults = {
  outputDir: path.join(root, "data", "runs", "bad-apple-but-lowest"),
  max: Infinity,
  sleepRequests: "2",
  sleepMin: "30",
  sleepMax: "90",
  rate: "500K",
  retries: "3",
  fragmentRetries: "3",
  dryRun: false,
  stopOnBotCheck: true,
  cookies: ""
};

function usage() {
  return `Usage: node scripts/download-but-videos.mjs [options]

Download public Bad Apple entries whose local title contains "but", one video at a time.

Options:
  --dry-run                 Write the queue and print the yt-dlp command shape without downloading
  --max N                   Process at most N queue entries
  --output-dir DIR          Output directory (default: data/runs/bad-apple-but-lowest)
  --sleep-requests SEC      yt-dlp sleep between extraction requests (default: 2)
  --sleep-min SEC           Minimum sleep before each download (default: 30)
  --sleep-max SEC           Maximum sleep before each download (default: 90)
  --rate RATE               Maximum download rate passed to yt-dlp (default: 500K)
  --retries N               HTTP retry count (default: 3)
  --fragment-retries N      Fragment retry count (default: 3)
  --cookies FILE            Optional Netscape cookies file for videos you are authorized to download
  --continue-on-bot-check   Continue after a YouTube bot-check error instead of stopping
  --help                    Show this help
`;
}

function parseArgs(argv) {
  const options = { ...defaults };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} requires a value`);
      }
      index += 1;
      return value;
    };

    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--max") options.max = Number(next());
    else if (arg === "--output-dir") options.outputDir = path.resolve(root, next());
    else if (arg === "--sleep-requests") options.sleepRequests = next();
    else if (arg === "--sleep-min") options.sleepMin = next();
    else if (arg === "--sleep-max") options.sleepMax = next();
    else if (arg === "--rate") options.rate = next();
    else if (arg === "--retries") options.retries = next();
    else if (arg === "--fragment-retries") options.fragmentRetries = next();
    else if (arg === "--cookies") options.cookies = path.resolve(root, next());
    else if (arg === "--continue-on-bot-check") options.stopOnBotCheck = false;
    else if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!Number.isFinite(options.max) && options.max !== Infinity) {
    throw new Error("--max must be a number");
  }
  if (options.max <= 0) {
    throw new Error("--max must be greater than 0");
  }

  return options;
}

function isUnavailable(video) {
  const title = String(video.title || "");
  return video.unavailable === "yes" || /^\[(private|deleted|unavailable) video\]$/i.test(title);
}

function queueVideos(videos) {
  const seen = new Set();
  return videos
    .filter((video) => /but/i.test(String(video.title || "")))
    .filter((video) => !isUnavailable(video))
    .filter((video) => video.video_id && video.video_url)
    .filter((video) => {
      if (seen.has(video.video_id)) return false;
      seen.add(video.video_id);
      return true;
    })
    .map((video, index) => ({
      index: index + 1,
      video_id: video.video_id,
      title: video.title,
      url: video.video_url,
      duration_seconds: Number(video.duration_seconds) || null,
      view_count: Number(video.view_count) || 0,
      category: video.category || "",
      channel: video.channel || ""
    }));
}

function ytDlpArgs(video, options, paths) {
  const args = [
    "--no-playlist",
    "--continue",
    "--part",
    "--no-overwrites",
    "--restrict-filenames",
    "--trim-filenames",
    "180",
    "--download-archive",
    paths.archivePath,
    "-N",
    "1",
    "--limit-rate",
    options.rate,
    "--retries",
    options.retries,
    "--fragment-retries",
    options.fragmentRetries,
    "--retry-sleep",
    "http:exp=10:120:2",
    "--retry-sleep",
    "fragment:exp=5:60:2",
    "--sleep-requests",
    options.sleepRequests,
    "--sleep-interval",
    options.sleepMin,
    "--max-sleep-interval",
    options.sleepMax,
    "--format",
    "bv*+ba/b",
    "--format-sort",
    "+size,+br,+res,+fps",
    "--format-sort-force",
    "-P",
    `home:${paths.downloadDir}`,
    "-P",
    `temp:${paths.tempDir}`,
    "-o",
    "%(id)s - %(title).160B.%(ext)s",
    video.url
  ];

  if (options.cookies) {
    args.splice(args.length - 1, 0, "--cookies", options.cookies);
  }

  return args;
}

function run(command, args, logPath) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";

    const capture = (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
      void appendFile(logPath, text);
    };

    child.stdout.on("data", capture);
    child.stderr.on("data", capture);
    child.on("close", (code) => resolve({ code, output }));
  });
}

function hasBotCheck(output) {
  return /sign in to confirm you.?re not a bot|not a bot|bot-check|confirm.*bot/i.test(output);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const paths = {
    outputDir: options.outputDir,
    downloadDir: path.join(options.outputDir, "videos"),
    tempDir: path.join(options.outputDir, "tmp"),
    archivePath: path.join(options.outputDir, "download-archive.txt"),
    queuePath: path.join(options.outputDir, "queue.json"),
    failuresPath: path.join(options.outputDir, "failures.jsonl"),
    logPath: path.join(options.outputDir, "yt-dlp.log")
  };

  await mkdir(paths.downloadDir, { recursive: true });
  await mkdir(paths.tempDir, { recursive: true });

  const videos = JSON.parse(await readFile(videosPath, "utf8"));
  const queue = queueVideos(videos).slice(0, options.max);
  await writeFile(paths.queuePath, `${JSON.stringify(queue, null, 2)}\n`);

  console.log(`Queue: ${queue.length} videos`);
  console.log(`Output: ${path.relative(root, paths.outputDir)}`);
  console.log(`Queue file: ${path.relative(root, paths.queuePath)}`);

  if (queue.length === 0) return;

  const sampleArgs = ytDlpArgs(queue[0], options, paths);
  console.log(`Format strategy: smallest playable video+audio via -f "bv*+ba/b" -S "+size,+br,+res,+fps"`);
  console.log(`First command shape: yt-dlp ${sampleArgs.map((arg) => JSON.stringify(arg)).join(" ")}`);

  if (options.dryRun) return;

  await appendFile(paths.logPath, `\n=== Run started ${new Date().toISOString()} ===\n`);

  for (const [index, video] of queue.entries()) {
    console.log(`\n[${index + 1}/${queue.length}] ${video.video_id} ${video.title}`);
    await appendFile(paths.logPath, `\n=== ${index + 1}/${queue.length} ${video.video_id} ${video.title} ===\n`);

    const result = await run("yt-dlp", ytDlpArgs(video, options, paths), paths.logPath);
    const botCheck = hasBotCheck(result.output);
    if (result.code !== 0 || botCheck) {
      await appendFile(
        paths.failuresPath,
        `${JSON.stringify({
          at: new Date().toISOString(),
          video_id: video.video_id,
          title: video.title,
          url: video.url,
          code: result.code,
          reason: botCheck ? "bot_check" : "yt_dlp_error"
        })}\n`
      );
    }

    if (botCheck && options.stopOnBotCheck) {
      console.error("Stopped after YouTube bot-check response. Retry later with a lower rate or an authorized official source.");
      process.exitCode = 2;
      return;
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
