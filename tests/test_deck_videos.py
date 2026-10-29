import csv
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'scripts'))
from deck_videos import load_videos

class DeckVideoTests(unittest.TestCase):
    def test_inventory_preserves_urls_and_adds_packages(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            packages = [root/'decks'/'Day 1, intro.apkg',root/'decks'/'nested'/'Day 2.apkg']
            load_videos(root,packages[:1])
            path = root/'deck-videos.csv'
            with path.open('w',newline='') as stream:
                writer = csv.writer(stream)
                writer.writerows([['file','video_url'],['Day 1, intro.apkg','https://youtu.be/abcdefghijk']])
            result = load_videos(root, packages)
            self.assertEqual(result,{'Day 1, intro.apkg':'https://youtu.be/abcdefghijk','nested/Day 2.apkg':''})
            before = path.read_bytes()
            load_videos(root,packages)
            self.assertEqual(before,path.read_bytes())
            # Removing a package doesn't discard the maintainer's video association.
            self.assertIn('Day 1, intro.apkg',load_videos(root,packages[1:]))

    def test_duplicate_and_insecure_urls_fail_clearly(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for rows in ['file,video_url\na.apkg,\na.apkg,\n','file,video_url\na.apkg,javascript:alert(1)\n']:
                (root/'deck-videos.csv').write_text(rows)
                with self.assertRaises(ValueError):load_videos(root,[])
