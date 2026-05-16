import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const videosPath = path.join(root, "data", "bad-apple-youtube", "videos.json");
const externalSourcesPath = path.join(root, "data", "external-awesome-sources.json");
const externalOembedPath = path.join(root, "data", "external-awesome-oembed.json");

const categories = ["software", "hardware", "audio", "real_world", "animation", "meta", "unclassified"];

const previousCategoryMap = {
  software_platform: "software",
  game_or_game_engine: "software",
  hardware_physical: "hardware",
  ai_or_voice_cover: "audio",
  fandom_animation: "animation",
  meta_compilation: "meta",
  other_recreation: "animation"
};

const legacyTagMap = Object.fromEntries(
  Object.entries(previousCategoryMap).map(([legacyCategory, category]) => [
    `legacy-${legacyCategory.replaceAll("_", "-")}`,
    category
  ])
);

const ruleSets = [
  {
    category: "hardware",
    weight: 8,
    tags: [
      ["e-ink", /\be[- ]?ink\b|e paper|epaper/i],
      ["flip-dot", /flip[ -]?(dot|display)|electromagnetic display/i],
      ["plasma", /plasma panel|ussr plasma/i],
      ["led", /\bled\b|rgb keyboard|neopixel|diode|matrix display/i],
      ["tesla-coil", /tesla coil/i],
      ["laser", /laser scanner|laser/i],
      ["oscilloscope", /oscilloscope/i],
      ["retro-computer", /apple (ii|\/\/e)|ibm (pc|xt)|cffa|risc[ -]?v|hand drawn cpu|c1-65a/i],
      ["console", /gameboy|game boy|nintendo ds|snes|super famicom|dezaemon|vectrex|console/i],
      ["wearable", /pinetime|smartwatch|watch/i],
      ["keyboard", /keyboard/i],
      ["display", /display|screen|monitor|portable tv|titlebars/i],
      ["calculator", /calculator|ti-?84|ti-?83/i],
      ["printer", /printer|plotter|receipt/i],
      ["microcontroller", /arduino|raspberry pi|fpga|cpld|microcontroller|esp32/i]
    ]
  },
  {
    category: "software",
    weight: 7,
    tags: [
      ["game", /minecraft|roblox|terraria|osu!?|beat saber|valorant|cs:?go|counter[ -]?strike|apex legends|rocket league|hearts of iron|minesweeper|doom|factorio|geometry dash|scratch/i],
      ["minecraft", /minecraft|creeper|trapdoor|armor stand|sheep/i],
      ["roblox", /roblox/i],
      ["web", /google maps|google sheets|youtube captions|github contribution|desmos|browser|firefox|webapp|website|html|css|javascript/i],
      ["chat", /discord|chat/i],
      ["editor", /notepad|visual studio code|vs code|pycharm|text editor/i],
      ["terminal", /command prompt|terminal|cmd|shell|console/i],
      ["os-ui", /windows|ubuntu|task manager|file explorer|titlebar|paint|desktop/i],
      ["algorithm", /fourier|prime number|ray ?trac|path ?trac|shader|renderer|rendered as|ascii|qr code|barcode/i],
      ["spreadsheet", /spreadsheet|google sheets|excel/i],
      ["maps", /google maps/i],
      ["github", /github/i],
      ["synthesia", /synthesia/i]
    ]
  },
  {
    category: "audio",
    weight: 7,
    tags: [
      ["cover", /cover|feat\.|featuring|sung by|歌って|歌わせ|翻唱/i],
      ["instrument", /piano|violin|guitar|bass|drum|koto|shamisen|shakuhachi|flute|orchestra|orchestral|synthesia/i],
      ["midi", /\bmidi\b|black midi|soundfont/i],
      ["vocal-cover", /english cover|vocal|voice|ai cover|jubyphonic|nomico|miku|初音ミク|sekai|25時/i],
      ["metal", /metal cover|rock cover/i],
      ["ai-audio", /ai generated|jukebox|ai cover|voicebank/i],
      ["frequency", /frequency|radio|hijacked/i],
      ["beatbox", /beatbox/i],
      ["punched-cards", /punched cards?/i]
    ]
  },
  {
    category: "real_world",
    weight: 7,
    tags: [
      ["stop-motion", /stop motion|stop-motion/i],
      ["nature", /grass|cloud|nature/i],
      ["food", /spaghetti|food|rice|bread|\bon an apple\b|\bwith an apple\b|\busing an apple\b/i],
      ["paper", /paper|post[- ]?it|sticky note|cardboard|punched cards?/i],
      ["drawing", /hand[ -]?drawn|drawn|drawing/i],
      ["pin-art", /pin ?art/i],
      ["physical-object", /real life|irl|physical|object|domino|lego|blocks/i]
    ]
  },
  {
    category: "meta",
    weight: 6,
    tags: [
      ["compilation", /compilation|playlist|every version|all versions|different versions|pack \d|with everything/i],
      ["frame-switching", /every frame|each frame|every line|switches/i],
      ["recursive", /recursive|recursion/i],
      ["meme", /meme|shitpost|ytpmv/i]
    ]
  },
  {
    category: "animation",
    weight: 5,
    tags: [
      ["touhou", /touhou|東方|霊夢|reimu|marisa|nomico/i],
      ["pv", /\bpv\b|shadow art|影絵|bad apple!! ＰＶ/i],
      ["mmd", /\bmmd\b|mikumikudance/i],
      ["lyrics", /lyrics|romaji|translation|subtitles/i],
      ["fandom", /fandom|fanmade|anime|animation|animated|手書き/i],
      ["vocaloid", /vocaloid|miku|初音ミク/i]
    ]
  }
];

function splitList(value) {
  return String(value || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeTag(tag) {
  return String(tag || "")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-")
    .replaceAll(/[^a-z0-9-]+/g, "-")
    .replaceAll(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function sourceListTitle(ref) {
  return `${ref.source_repo} / ${ref.source_section}`;
}

function bestReferenceTitle(refs) {
  return refs.find((ref) => ref.link_role === "primary")?.title || refs[0]?.title || "";
}

function externalCategoryScores(refs) {
  const scores = Object.fromEntries(categories.map((category) => [category, 0]));
  for (const ref of refs.filter((item) => item.link_role === "primary")) {
    if (ref.source_category && ref.source_category !== "unclassified") {
      scores[ref.source_category] += 4;
    }
  }
  return scores;
}

function classify(video, refs) {
  const scores = Object.fromEntries(categories.map((category) => [category, 0]));
  const incomingTags = splitList(video.tags).map(normalizeTag);
  const tags = new Set(incomingTags.filter((tag) => tag.startsWith("legacy-")));
  const notes = [];
  const text = [
    video.title,
    video.channel,
    video.category,
    video.external_source_titles,
    refs.map((ref) => `${ref.title} ${ref.source_section}`).join(" ")
  ]
    .join(" ")
    .toLowerCase();

  for (const tag of incomingTags) {
    const legacyCategory = tag.replaceAll("-", "_");
    if (previousCategoryMap[legacyCategory]) {
      tags.add(`legacy-${tag}`);
    }
  }

  const previous = previousCategoryMap[video.category];
  const legacyFromTags = [...tags].map((tag) => legacyTagMap[tag]).find(Boolean);
  if (previous || legacyFromTags) {
    scores[previous || legacyFromTags] += 4;
  }
  if (previous) {
    tags.add(`legacy-${video.category.replaceAll("_", "-")}`);
  }

  const sourceScores = externalCategoryScores(refs);
  for (const category of categories) {
    scores[category] += sourceScores[category] || 0;
  }
  if (refs.some((ref) => ref.link_role === "primary")) {
    tags.add("awesome-list");
    for (const ref of refs.filter((item) => item.link_role === "primary")) {
      tags.add(normalizeTag(ref.source_section));
      tags.add(normalizeTag(ref.source_repo.split("/")[0]));
    }
  }

  for (const ruleSet of ruleSets) {
    let matched = false;
    for (const [tag, pattern] of ruleSet.tags) {
      if (pattern.test(text)) {
        matched = true;
        tags.add(tag);
      }
    }
    if (matched) {
      scores[ruleSet.category] += ruleSet.weight;
    }
  }

  if (/\bminecraft\b/i.test(text)) {
    scores.software += 5;
    scores.real_world -= 2;
  }
  if (/fourier|prime number|qr code|ascii|shader|renderer/i.test(text)) {
    scores.software += 4;
    scores.real_world -= 3;
  }
  if (/piano|violin|guitar|bass|drum|koto|shamisen|cover|orchestral|midi|feat\.|miku|初音ミク/i.test(text)) {
    scores.audio += 4;
  }
  if (/e[- ]?ink|display|smartwatch|apple \/\/e|dezaemon|snes|keyboard|plasma|tesla|laser|oscilloscope/i.test(text)) {
    scores.hardware += 4;
  }

  let category = categories
    .filter((item) => item !== "unclassified")
    .sort((left, right) => scores[right] - scores[left])[0];
  const confidenceScore = scores[category] || 0;
  if (!confidenceScore || confidenceScore < 3) {
    category = "unclassified";
  }

  const confidence = category === "unclassified" ? "low" : confidenceScore >= 10 ? "high" : "medium";
  if (category === "unclassified") {
    notes.push("Automatic rules did not find a strong category signal.");
  }
  if (video.title_matches_bad_apple !== "yes") {
    notes.push("Title does not explicitly contain Bad Apple; keep for review.");
  }
  if (video.external_only === "yes") {
    notes.push("Added from an external awesome list; full YouTube metadata still needs refresh.");
  }
  if (video.unavailable === "yes") {
    notes.push("The external metadata check reported this video as unavailable or private.");
  }

  return {
    category,
    tags: unique([...tags].map(normalizeTag)).sort(),
    classification_confidence: confidence,
    classification_status: category === "unclassified" || notes.length ? "needs_review" : "auto",
    classification_notes: notes.join(" ")
  };
}

function buildExternalVideo(id, refs, oembed) {
  const primaryRefs = refs.filter((ref) => ref.link_role === "primary");
  const bestRef = primaryRefs[0] || refs[0];
  const metadata = oembed[id] || {};
  const unavailable = metadata.error ? "yes" : "";
  const title = metadata.title || bestReferenceTitle(primaryRefs) || `External Bad Apple video ${id}`;
  const authorName = metadata.author_name || "";
  const authorUrl = metadata.author_url || "";
  return {
    video_id: id,
    video_url: `https://www.youtube.com/watch?v=${id}`,
    title,
    channel: authorName,
    channel_id: "",
    uploader_id: authorUrl ? authorUrl.replace("https://www.youtube.com/", "") : "",
    uploader_url: authorUrl,
    duration_seconds: 0,
    view_count: 0,
    category: bestRef?.source_category || "unclassified",
    tags: unique(["external-awesome", bestRef?.source_category, bestRef?.source_section?.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")]).join(";"),
    title_matches_bad_apple: /bad\s*apple/i.test(title) || /bad\s*apple/i.test(bestReferenceTitle(primaryRefs)) ? "yes" : "",
    thumbnail_url: metadata.thumbnail_url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    unavailable,
    playlist_count: primaryRefs.length,
    playlist_ids: primaryRefs.map((ref) => `external:${ref.source_repo}`).join(";"),
    playlist_titles: primaryRefs.map(sourceListTitle).join(";"),
    playlist_positions: "",
    external_only: "yes",
    external_source_count: primaryRefs.length,
    external_source_titles: primaryRefs.map(sourceListTitle).join(";"),
    external_source_repos: unique(primaryRefs.map((ref) => ref.source_repo)).join(";"),
    metadata_status: metadata.error ? metadata.error : "oembed_only"
  };
}

const videos = JSON.parse(await readFile(videosPath, "utf8"));
const externalSources = JSON.parse(await readFile(externalSourcesPath, "utf8"));
const externalOembed = JSON.parse(await readFile(externalOembedPath, "utf8"));
const refsByVideoId = Map.groupBy(externalSources, (ref) => ref.video_id);
const existingIds = new Set(videos.map((video) => video.video_id));
const primaryMissingIds = unique(
  externalSources
    .filter((ref) => ref.link_role === "primary" && !existingIds.has(ref.video_id))
    .map((ref) => ref.video_id)
);

for (const id of primaryMissingIds) {
  videos.push(buildExternalVideo(id, refsByVideoId.get(id) || [], externalOembed[id]));
}

for (const video of videos) {
  const refs = refsByVideoId.get(video.video_id) || [];
  const primaryRefs = refs.filter((ref) => ref.link_role === "primary");
  const externalMetadata = externalOembed[video.video_id];
  if (video.external_only === "yes" && externalMetadata) {
    video.unavailable = externalMetadata.error ? "yes" : "";
    video.metadata_status = externalMetadata.error ? externalMetadata.error : "oembed_only";
    video.title = externalMetadata.title || video.title;
    video.channel = externalMetadata.author_name || video.channel || "";
    video.uploader_url = externalMetadata.author_url || video.uploader_url || "";
    video.uploader_id = video.uploader_url ? video.uploader_url.replace("https://www.youtube.com/", "") : video.uploader_id || "";
    video.thumbnail_url = externalMetadata.thumbnail_url || video.thumbnail_url || `https://i.ytimg.com/vi/${video.video_id}/hqdefault.jpg`;
  }
  if (primaryRefs.length) {
    video.external_source_count = primaryRefs.length;
    video.external_source_titles = primaryRefs.map(sourceListTitle).join(";");
    video.external_source_repos = unique(primaryRefs.map((ref) => ref.source_repo)).join(";");
  } else if (!video.external_only) {
    delete video.external_source_count;
    delete video.external_source_titles;
    delete video.external_source_repos;
  }

  const result = classify(video, refs);
  video.category = result.category;
  video.tags = result.tags.join(";");
  video.classification_confidence = result.classification_confidence;
  video.classification_status = result.classification_status;
  video.classification_notes = result.classification_notes;
}

videos.sort((left, right) => {
  const leftViews = Number(left.view_count) || 0;
  const rightViews = Number(right.view_count) || 0;
  return rightViews - leftViews || String(left.title).localeCompare(String(right.title), "en-US");
});

await writeFile(videosPath, `${JSON.stringify(videos, null, 2)}\n`);

const categoryCounts = videos.reduce((counts, video) => {
  counts[video.category] = (counts[video.category] || 0) + 1;
  return counts;
}, {});
const unavailableCount = videos.filter((video) => video.unavailable === "yes").length;
const externalOnlyCount = videos.filter((video) => video.external_only === "yes").length;

console.log(`Wrote ${videos.length} videos to ${path.relative(process.cwd(), videosPath)}`);
console.log(`Added ${primaryMissingIds.length} external-list videos (${externalOnlyCount} external-only total).`);
console.log(`Unavailable/private rows: ${unavailableCount}`);
console.log(categoryCounts);
