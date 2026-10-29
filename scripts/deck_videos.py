"""Maintain an editable APKG inventory without overwriting existing video URLs."""
import csv
from urllib.parse import urlparse


def load_videos(root, packages):
    path = root / 'deck-videos.csv'
    rows = []
    if path.exists():
        with path.open(newline='', encoding='utf-8-sig') as stream:
            reader = csv.DictReader(stream)
            if reader.fieldnames != ['file', 'video_url']:
                raise ValueError('deck-videos.csv must have exactly these columns: file,video_url')
            rows = list(reader)
    seen = set()
    for row in rows:
        filename, url = row.get('file'), row.get('video_url')
        if not filename or url is None or None in row:
            raise ValueError('Invalid row in deck-videos.csv; quote filenames containing commas')
        if filename in seen:
            raise ValueError(f'Duplicate file in deck-videos.csv: {filename}')
        seen.add(filename)
        if url.strip():
            parsed = urlparse(url.strip())
            if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
                raise ValueError(f'{filename}: video_url must be an HTTPS video URL')
    missing = [p.relative_to(root / 'decks').as_posix() for p in packages
               if p.relative_to(root / 'decks').as_posix() not in seen]
    if missing or not path.exists():
        rows.extend({'file': name, 'video_url': ''} for name in missing)
        with path.open('w', newline='', encoding='utf-8') as stream:
            writer = csv.DictWriter(stream, fieldnames=['file', 'video_url'])
            writer.writeheader()
            writer.writerows(rows)
    return {row['file']: row['video_url'].strip() for row in rows}
