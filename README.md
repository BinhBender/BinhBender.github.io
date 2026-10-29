<<<<<<< HEAD
# BinhBender.github.io
=======
# Recall

A static Anki-style study app for GitHub Pages. Repository owners curate decks; visitors have no upload or deck-editing controls. Card progress and daily study counts live in localStorage on the visitor's browser. No accounts or backend are needed.

## Run locally

```sh
python -m pip install -r requirements.txt
python scripts/build.py
python -m http.server 8000 --directory site
```

Open http://localhost:8000. Use HTTP instead of opening index.html directly.

## Bulk import

Place any number of `.apkg` files in `decks/` or its subdirectories, then run the build or push to `main`. Every package and its internal decks are imported automatically. Do not add exports containing private material: GitHub Pages publishes the cards and media for everyone who can visit the site.

In Anki, export decks as `.apkg`. Both legacy-compatible exports and modern compressed `collection.anki21b` packages (including schema 18 metadata and protobuf media maps) are supported. The importer supports standard front/back templates, reversed cards, cloze deletions, conditional fields, embedded styling, images, and sound. Custom JavaScript templates, image occlusion, and advanced template filters are not supported. Import failures identify the package filename in the build logs. Imported Anki scheduling is intentionally ignored: each visitor starts fresh.

Keep package paths and note GUIDs stable when updating a deck to preserve visitor progress. Moving or renaming an APKG creates new card identities. Removed cards no longer appear; their local history is retained in case they return.

You can also commit JSON decks:

```json
{"id":"biology","name":"Biology","cards":[{"id":"biology:cell","front":"What is a cell?","back":"The basic unit of life."}]}
```

IDs must be globally unique and stable. A JSON file may contain one deck or an array of decks. Card `front`, `back`, and optional `css` accept HTML/CSS. Put manually maintained media in `site/assets/` and reference `assets/filename.png`. Delete `decks/welcome.json` when you no longer need the sample deck.

## Videos beside flashcards

Edit `deck-videos.csv` in the repository root. It lists every APKG path relative to `decks/`, with a `video_url` column beside it:

```csv
file,video_url
Day 01 Flashcards - Network Devices.apkg,https://www.youtube.com/watch?v=YOUR_VIDEO_ID
Day 02 Flashcards - Interfaces and Cables.apkg,
```

Use an actual video URL in place of the example. YouTube watch/share/embed/shorts links, Vimeo links, and HTTPS MP4/WebM/OGG file links are supported. YouTube timestamps (`t=90` or `t=1m30s`) are retained. Leave the URL blank for no video. CSV filenames containing commas must stay quoted; a spreadsheet editor can handle quoting for you.

Run `python scripts/build.py` after adding packages or editing URLs, then commit and push `deck-videos.csv` along with any new APKGs. Each build appends missing APKGs with blank video URLs and preserves existing rows, including removed packages. GitHub Actions also discovers new packages, but changes made during CI are not automatically committed back; run the build locally to refresh your editable inventory.

All subdecks from the same APKG share that package's video. Videos appear beside the flashcards on wide screens and below them on smaller screens. Revealing or rating a card keeps the video playing; leaving the deck stops it. Some owners disable embedding, so the panel also provides a link to open the video separately. No video URLs or files can be uploaded or edited from the frontend. Your `site/index.html` text does not need to change.

## GitHub Pages

1. Push this project to a GitHub repository with a `main` branch.
2. In **Settings → Pages → Build and deployment**, select **GitHub Actions**.
3. Push a change or run **Build and deploy flashcards** from Actions.

The included workflow imports all decks and deploys `site/`. Relative URLs support both `username.github.io` and repository project paths. If your default branch differs, update the workflow branch filter. There is no server process on GitHub Pages: the build generates the card catalog ahead of time.

## Study behavior and storage

New cards enter learning when rated Again (1 minute) or Hard (6 minutes). Good graduates them to review in 1 day; Easy in 4 days. Subsequent Good answers multiply the previous interval by 2.5; Easy by 3. Again and Hard return a card to learning. Due cards are served before new cards. Future cards are held until their due time. This is a small spaced repetition scheduler, not Anki's FSRS algorithm or a sync service. Space reveals answers; keys 1–4 rate them. Keyboard shortcuts work when focus is outside the embedded card.

Progress belongs to the browser and origin. Clearing site data, private browsing, switching browsers, or changing the domain can lose or separate progress. The page reports unavailable storage. **Back up progress** downloads a JSON snapshot; recovery can be done in the browser console by setting `recall.progress.v1` in localStorage to that JSON and reloading (there is no frontend import control). Avoid studying in multiple tabs simultaneously; storage events update tabs, but simultaneous writes can race.

Cards render in sandboxed iframes with scripts, forms, external images, and network requests disabled. Repository content should still be reviewed before publishing. Deck files and study history are separate: visitors cannot modify the repository through this app.

## Checks

```sh
python -m unittest discover -s tests
node --test tests/*.test.mjs
```
>>>>>>> 7f9385c (first com)
