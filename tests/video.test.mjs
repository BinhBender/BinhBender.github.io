import {test} from 'node:test';
import assert from 'node:assert/strict';
import {videoSource} from '../site/video.js';
test('YouTube links normalize and retain timestamps',()=>{
  const expected='https://www.youtube-nocookie.com/embed/abcdefghijk?start=90';
  assert.equal(videoSource('https://youtu.be/abcdefghijk?t=1m30s').src,expected);
  assert.equal(videoSource('https://www.youtube.com/watch?v=abcdefghijk&t=90').src,expected);
  assert.equal(videoSource('https://www.youtube.com/embed/abcdefghijk?start=90').src,expected);
  assert.equal(videoSource('https://www.youtube.com/shorts/abcdefghijk').type,'iframe');
});
test('Vimeo unlisted hash and direct video files work',()=>{
  assert.equal(videoSource('https://vimeo.com/12345/secret').src,'https://player.vimeo.com/video/12345?h=secret');
  assert.equal(videoSource('https://player.vimeo.com/video/12345?h=secret').src,'https://player.vimeo.com/video/12345?h=secret');
  assert.equal(videoSource('https://cdn.example.com/lesson.mp4?signature=test').type,'video');
});
test('unsupported and unsafe inputs never become embeds',()=>{
  for(const url of ['', 'javascript:alert(1)','http://youtube.com/watch?v=abcdefghijk','https://youtube.com.evil.com/watch?v=abcdefghijk','https://youtube.com/watch?v=bad','https://example.com/page','https://user:pass@example.com/lesson.mp4']) assert.equal(videoSource(url),null);
});
