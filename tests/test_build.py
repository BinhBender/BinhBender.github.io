import importlib.util, json, sqlite3, tempfile, unittest, zipfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('build',Path(__file__).resolve().parents[1]/'scripts/build.py')
build=importlib.util.module_from_spec(spec);spec.loader.exec_module(build)
class ImportTests(unittest.TestCase):
    def test_cloze_and_conditionals(self):
        fields={'Text':'The {{c1::cell::unit}} contains {{c2::DNA}}','Extra':'yes'}
        self.assertEqual(build.render('{{cloze:Text}}',fields),'The <b>[unit]</b> contains DNA')
        self.assertEqual(build.render('{{cloze:Text}}',fields,0,True),'The <b>cell</b> contains DNA')
        self.assertEqual(build.render('{{#Extra}}present{{/Extra}}{{^Missing}} absent{{/Missing}}',fields),'present absent')
    def test_package_and_media(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'decks').mkdir();out=root/'site';out.mkdir()
            db=sqlite3.connect(root/'collection.anki2')
            db.executescript('CREATE TABLE col(models TEXT,decks TEXT); CREATE TABLE notes(id INTEGER,guid TEXT,mid INTEGER,flds TEXT); CREATE TABLE cards(did INTEGER,ord INTEGER,nid INTEGER);')
            model={'1':{'type':0,'flds':[{'name':'Front'},{'name':'Back'}],'tmpls':[{'qfmt':'{{Front}}','afmt':'{{FrontSide}}<hr>{{Back}}'}],'css':'.card{color:red}'}}
            db.execute('INSERT INTO col VALUES (?,?)',(json.dumps(model),json.dumps({'1':{'name':'Science'}})))
            db.execute('INSERT INTO notes VALUES (1,?,1,?)',('stable','Question\x1f<img src="picture.png">[sound:audio.mp3]'))
            db.execute('INSERT INTO cards VALUES (1,0,1)');db.commit();db.close()
            path=root/'decks'/'test.apkg'
            with zipfile.ZipFile(path,'w') as z:
                z.write(root/'collection.anki2','collection.anki2');z.writestr('media',json.dumps({'0':'picture.png','1':'audio.mp3'}));z.writestr('0',b'image');z.writestr('1',b'audio')
            old=build.ROOT;build.ROOT=root
            try:
                result=build.convert(path,out);again=build.convert(path,out)
            finally:build.ROOT=old
            self.assertEqual(result[0]['name'],'Science');card=result[0]['cards'][0]
            self.assertIn('Question<hr>',card['back']);self.assertIn('data/media/',card['back']);self.assertIn('<audio controls',card['back'])
            self.assertEqual(card['id'],again[0]['cards'][0]['id'])
if __name__=='__main__':unittest.main()
