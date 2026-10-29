"""Read Anki's normalized SQLite metadata and protobuf media maps.

Field numbers follow Anki's proto/anki/{notetypes,import_export}.proto.
Unknown protobuf fields are skipped so unrelated metadata stays optional.
"""


def protobuf_fields(data):
    offset = 0

    def varint():
        nonlocal offset
        value = 0
        for shift in range(0, 70, 7):
            if offset >= len(data):
                raise ValueError('Truncated protobuf varint')
            byte = data[offset]
            offset += 1
            value |= (byte & 127) << shift
            if byte < 128:
                return value
        raise ValueError('Oversized protobuf varint')

    while offset < len(data):
        tag = varint()
        number, wire = tag >> 3, tag & 7
        if number == 0:
            raise ValueError('Invalid protobuf field number')
        if wire == 0:
            value = varint()
        elif wire in (1, 2, 5):
            length = varint() if wire == 2 else (8 if wire == 1 else 4)
            end = offset + length
            if end > len(data):
                raise ValueError('Truncated protobuf field')
            value = data[offset:end]
            offset = end
        else:
            raise ValueError(f'Unsupported protobuf wire type {wire}')
        yield number, value


def config(data):
    return dict(protobuf_fields(data))


def modern_metadata(db):
    models = {}
    for row in db.execute('SELECT id, name, config FROM notetypes'):
        settings = config(row['config'])
        kind = settings.get(1, 0)
        if kind not in (0, 1):
            raise ValueError(f"Unsupported Anki note type: {row['name']}")
        model = {'type': kind, 'css': settings.get(3, b'').decode('utf-8'), 'flds': [], 'tmpls': []}
        for field in db.execute('SELECT name FROM fields WHERE ntid=? ORDER BY ord', (row['id'],)):
            model['flds'].append({'name': field['name']})
        for template in db.execute('SELECT name, config FROM templates WHERE ntid=? ORDER BY ord', (row['id'],)):
            settings = config(template['config'])
            model['tmpls'].append({'name': template['name'], 'qfmt': settings.get(1, b'').decode('utf-8'), 'afmt': settings.get(2, b'').decode('utf-8')})
        models[str(row['id'])] = model
    decks = {str(row['id']): {'name': row['name'].replace('\x1f', '::')}
             for row in db.execute('SELECT id, name FROM decks')}
    return models, decks


def media_entries(data):
    entries = {}
    for number, message in protobuf_fields(data):
        if number != 1:
            continue
        fields = config(message)
        name = fields.get(1, b'').decode('utf-8')
        if not name:
            raise ValueError('Anki media entry has no name')
        index = fields.get(255, len(entries))
        entries[str(index)] = name
    return entries


def decompress(data):
    import zstandard
    return zstandard.ZstdDecompressor().decompress(data, max_output_size=1024**3)
