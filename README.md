# Bad Apple Video Gallery

Static frontend for browsing a Bad Apple!! YouTube video snapshot.

This directory is self-contained and can be used as its own GitHub repository. It includes the source snapshot under `data/bad-apple-youtube/`, generates browser-ready JSON into `public/data/`, and builds a static Vite site into `dist/`.

## Commands

```bash
npm install
npm run dev
npm run build
```

`npm run build` first regenerates `public/data/*.json`, then emits static files under `dist/`.

By default the data generator looks for `data/bad-apple-youtube/` inside this repo. For local development inside the original BadAppleBench workspace it can also fall back to `../data/bad-apple-youtube/`. To use a different snapshot, set:

```bash
BAD_APPLE_YOUTUBE_DATA_DIR=/path/to/bad-apple-youtube npm run build
```

## GitHub Pages

The repo includes `.github/workflows/deploy-pages.yml`. After pushing this directory as a standalone GitHub repo, enable Pages with GitHub Actions as the source:

1. Open the repository on GitHub.
2. Go to `Settings` -> `Pages`.
3. Set `Build and deployment` source to `GitHub Actions`.
4. Push to `main`, or run the `Deploy GitHub Pages` workflow manually.

The Vite `base` is `./`, so the build works both at `https://<user>.github.io/<repo>/` and at a custom domain.

One-shot repo setup with GitHub CLI:

```bash
git init
git add .
git commit -m "Initial video gallery"
gh repo create video-gallery --public --source=. --remote=origin --push
```

## Data

The source snapshot does not include full YouTube descriptions because it was collected through flat playlist extraction. The generated video `description` field is derived from collected metadata: channel, duration, views, category, and whether the title explicitly matches Bad Apple.

Private, deleted, or otherwise unavailable YouTube placeholder rows are removed during data generation. The generated video records include Chinese and English category labels plus Chinese and English metadata-derived descriptions, and the UI can switch between both languages.

The About tab lists the source playlists used for the current dataset, including playlist links, curator names, collected item counts, public item counts, and title-match counts.
