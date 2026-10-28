"""Bulk convert repository APKG files to static JSON. No runtime uploads."""
import hashlib, json, re, sqlite3, tempfile, zipfile
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
def render(template, fields, ordinal=0, answer=False):
    section = re.compile(r'{{([#^])([^{}]+)}}((?:(?!{{[#^]).)*?){{/\2}}', re.S)
    while section.search(template):
        template = section.sub(lambda m: m[3] if bool(fields.get(m[2], '')) == (m[1] == '#') else '', template)
    def replace(m):
        key = m[1].strip()
        value = fields.get(key.split(':')[-1], '')
        if key.startswith('cloze:'):
            def cloze(c):
                if int(c[1]) != ordinal + 1: return c[2]
                return '<b>' + (c[2] if answer else '[' + (c[3] or '…') + ']') + '</b>'
            value = re.sub(r'{{c(\d+)::(.*?)(?:::(.*?))?}}', cloze, value, flags=re.S)
        if key.startswith('text:'): value = re.sub('<[^>]+>', '', value)
        return value
    return re.sub(r'{{([^{}]+)}}', replace, template)
def convert(path, output):
    with zipfile.ZipFile(path) as z, tempfile.TemporaryDirectory() as temp:
        name = next((n for n in ['collection.anki21b','collection.anki21','collection.anki2'] if n in z.namelist()), None)
        if not name: raise ValueError(f'{path}: missing Anki collection')
        raw = z.read(name)
        if name.endswith('21b'):
            import zstandard
            raw = zstandard.ZstdDecompressor().decompress(raw, max_output_size=1024**3)
        dbpath = Path(temp)/'collection.db'; dbpath.write_bytes(raw)
        db = sqlite3.connect(dbpath); db.row_factory = sqlite3.Row
        try:
            col = db.execute('SELECT models, decks FROM col').fetchone()
        except sqlite3.OperationalError as exc:
            db.close()
            raise ValueError(f'{path}: re-export APKG with older Anki version compatibility enabled') from exc
        models, decks = json.loads(col['models']), json.loads(col['decks'])
        if not models or not decks: raise ValueError(f'{path}: re-export APKG with older Anki version compatibility enabled')
        package = hashlib.sha256(str(path.relative_to(ROOT/'decks')).encode()).hexdigest()[:16]
        mapping = {}
        if 'media' in z.namelist():
            try: entries = json.loads(z.read('media'))
            except (ValueError, UnicodeDecodeError): raise ValueError(f'{path}: re-export with older Anki version compatibility enabled')
            folder = output/'media'/package; folder.mkdir(parents=True,exist_ok=True)
            for number, original in entries.items():
                safe = hashlib.sha256(original.encode()).hexdigest()[:20] + Path(original).suffix
                (folder/safe).write_bytes(z.read(number)); mapping[original] = f'data/media/{package}/{safe}'
        def media(text):
            for original, target in mapping.items():
                text = text.replace('"'+original+'"','"'+target+'"').replace("'"+original+"'", "'"+target+"'")
                text = text.replace('[sound:'+original+']','<audio controls src="'+target+'"></audio>')
            return text
        result = {}
        for row in db.execute('SELECT c.did,c.ord,n.guid,n.mid,n.flds FROM cards c JOIN notes n ON n.id=c.nid'):
            model = models[str(row['mid'])]; ordinal = row['ord']
            fields = dict(zip((f['name'] for f in model['flds']),row['flds'].split('\x1f')))
            deck = decks.get(str(row['did']),{}).get('name',path.stem)
            template = model['tmpls'][0 if model['type']==1 else ordinal]
            fields.update(Deck=deck,Subdeck=deck.split('::')[-1],Card=template.get('name',''))
            front = render(template['qfmt'],fields,ordinal)
            fields['FrontSide'] = front
            back = render(template['afmt'],fields,ordinal,True)
            result.setdefault(deck,[]).append(dict(id=f"{package}:{row['guid']}:{ordinal}",front=media(front),back=media(back),css=media(model.get('css',''))))
        db.close()
        return [dict(id=f'{package}:{name}',name=name,source=path.name,cards=cards) for name,cards in result.items()]
def build():
    output=ROOT/'site'/'data'; output.mkdir(parents=True,exist_ok=True)
    decks=[]
    for path in sorted((ROOT/'decks').rglob('*.apkg')): decks.extend(convert(path,output))
    for path in sorted((ROOT/'decks').rglob('*.json')):
        data=json.loads(path.read_text()); decks.extend(data if isinstance(data,list) else [data])
    ids=[]
    for deck in decks:
        assert deck['id'] and deck['name']
        for card in deck['cards']:
            assert card['id'] and isinstance(card['front'],str) and isinstance(card['back'],str)
            ids.append(card['id'])
    if len(ids)!=len(set(ids)): raise ValueError('Duplicate card IDs')
    if len({d['id'] for d in decks})!=len(decks): raise ValueError('Duplicate deck IDs')
    (output/'catalog.json').write_text(json.dumps(decks,ensure_ascii=False))
    print(f'Built {len(decks)} decks and {len(ids)} cards')
if __name__=='__main__': build()
