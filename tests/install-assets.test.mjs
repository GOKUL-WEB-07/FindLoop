import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';

test('mobile manifest icons exist as transparent PNGs at their declared sizes',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../public/manifest.json',import.meta.url),'utf8'));
  assert.equal(manifest.id,'./','Keep the installed app identity stable');
  for(const required of ['192x192','512x512'])assert.ok(manifest.icons.some(icon=>icon.sizes===required));
  for(const icon of manifest.icons){
    const png=await readFile(new URL('../public/'+icon.src,import.meta.url));
    assert.equal(png.subarray(1,4).toString(),'PNG');
    const [width,height]=icon.sizes.split('x').map(Number);
    assert.equal(png.readUInt32BE(16),width);assert.equal(png.readUInt32BE(20),height);
    assert.equal(png[25],6,'Launcher artwork must retain its requested alpha channel');
  }
});

test('favicon and Apple icon links point to files included in the deployment',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const matches=[...html.matchAll(/<link rel="(?:icon|shortcut icon|apple-touch-icon)"[^>]*href="([^"]+)"/g)];
  assert.ok(matches.length>=4,'Include SVG, PNG, ICO, and Apple fallbacks');
  for(const [,href] of matches)await access(new URL('../public/'+href.replace('%BASE_URL%','').split('?')[0],import.meta.url));
});
