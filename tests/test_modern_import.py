"""Regression coverage for schema-18 packages with empty legacy JSON columns."""
import importlib.util
import sqlite3
import tempfile
import unittest
import zipfile
from pathlib import Path
import zstandard

spec = importlib.util.spec_from_file_location('build', Path(__file__).resolve().parents[1]/'scripts/build.py')
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)
from anki_format import protobuf_fields


def varint(value):
    output = bytearray()
    while value > 127:
        output.append((value & 127) | 128)
        value >>= 7
    output.append(value)
    return bytes(output)


def field(number, value):
    if isinstance(value, int):
        return varint(number << 3) + varint(value)
    if isinstance(value, str):
        value = value.encode()
    return varint((number << 3) | 2) + varint(len(value)) + value


class ModernImportTests(unittest.TestCase):
    def test_schema18_with_compressed_media_and_cloze(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root/'decks').mkdir()
            output = root/'site'
            output.mkdir()
            db = sqlite3.connect(root/'collection.db')
            db.executescript('''
                CREATE TABLE col(models TEXT, decks TEXT);
                INSERT INTO col VALUES ('','');
                CREATE TABLE notetypes(id INTEGER, name TEXT, config BLOB);
                CREATE TABLE fields(ntid INTEGER, ord INTEGER, name TEXT);
                CREATE TABLE templates(ntid INTEGER, ord INTEGER, name TEXT, config BLOB);
                CREATE TABLE decks(id INTEGER, name TEXT);
                CREATE TABLE notes(id INTEGER, guid TEXT, mid INTEGER, flds TEXT);
                CREATE TABLE cards(did INTEGER, ord INTEGER, nid INTEGER);
            ''')
            db.execute('INSERT INTO notetypes VALUES (1,?,?)', ('Cloze', field(1,1)+field(3,'.card{color:green}')+field(255,'ignored')))
            db.execute("INSERT INTO fields VALUES (1,0,'Text')")
            db.execute('INSERT INTO templates VALUES (1,0,?,?)', ('Card',field(1,'{{cloze:Text}}')+field(2,'{{cloze:Text}}')))
            db.execute('INSERT INTO decks VALUES (1,?)', ('Networking\x1fTCP',))
            db.execute('INSERT INTO notes VALUES (1,?,1,?)', ('stable','{{c1::TCP}}<img src="picture.png">[sound:voice.mp3]'))
            db.execute('INSERT INTO cards VALUES (1,0,1)')
            db.commit()
            db.close()
            compressor = zstandard.ZstdCompressor(write_content_size=False)
            entries = field(1,field(1,'picture.png')+field(2,5)) + field(1,field(1,'voice.mp3')+field(2,5))
            package = root/'decks'/'modern.apkg'
            with zipfile.ZipFile(package,'w') as z:
                z.writestr('collection.anki21b',compressor.compress((root/'collection.db').read_bytes()))
                z.writestr('collection.anki2',b'Ignore this compatibility placeholder')
                z.writestr('media',compressor.compress(entries))
                z.writestr('0',compressor.compress(b'image'))
                z.writestr('1',compressor.compress(b'audio'))
            original = build.ROOT
            build.ROOT = root
            try:
                decks = build.convert(package,output)
            finally:
                build.ROOT = original
            self.assertEqual(decks[0]['name'],'Networking::TCP')
            card = decks[0]['cards'][0]
            self.assertIn('<b>[…]</b>',card['front'])
            self.assertIn('<b>TCP</b>',card['back'])
            self.assertIn('<audio controls',card['back'])
            self.assertIn('color:green',card['css'])
            self.assertEqual({p.read_bytes() for p in (output/'media').rglob('*') if p.is_file()}, {b'image',b'audio'})

    def test_invalid_protobuf_is_rejected(self):
        for data in [b'\x80',b'\x0a\x05a',b'\x00',b'\x0f']:
            with self.subTest(data=data), self.assertRaises(ValueError):
                list(protobuf_fields(data))

if __name__ == '__main__':
    unittest.main()
