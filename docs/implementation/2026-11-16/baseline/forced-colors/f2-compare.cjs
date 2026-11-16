// Compares f2-before and f2-after: normal-theme screenshot identity, geometry forced on vs off, styles.
const fs = require('node:fs');
const b = require('./f2-before/evidence.json'), a = require('./f2-after/evidence.json');
const key = r => `${r.browser}-${r.viewport}`;
const out = {normalScreenshotsIdentical: [], geometry: [], styles: []};
const bs = Object.fromEntries(b.captures.map(c => [c.file.replace('f2-before/', ''), c.sha256]));
for (const c of a.captures.filter(c => c.file.includes('-normal-'))) { const f = c.file.replace('f2-after/', ''); out.normalScreenshotsIdentical.push([f, bs[f] === c.sha256]); }
const strip = g => ({...g, coverVisible: undefined});
for (const [label, rep] of [['before', b], ['after', a]]) {
  for (const forced of rep.runs.filter(r => r.theme === 'forced')) {
    const normal = rep.runs.find(r => r.theme === 'normal' && key(r) === key(forced));
    for (const s of Object.keys(forced.states)) {
      const f = forced.states[s].geometry, n = normal.states[s].geometry;
      out.geometry.push({build: label, run: key(forced), state: s, sameAsNormal: JSON.stringify(strip(f)) === JSON.stringify(strip(n)),
        spans: f.spans.length, cursorIndex: f.cursorIndex, selection: f.selection, nativeOffsetAtCursor: f.nativeOffsetAtCursor, focus: f.focus});
    }
  }
}
// Normal theme before vs after geometry, too.
for (const r of a.runs.filter(r => r.theme === 'normal')) { const o = b.runs.find(x => x.theme === 'normal' && key(x) === key(r));
  for (const s of Object.keys(r.states)) out.geometry.push({build: 'normal before vs after', run: key(r), state: s, sameAsNormal: JSON.stringify(r.states[s].geometry) === JSON.stringify(o.states[s].geometry)}); }
for (const r of a.runs.filter(r => r.theme === 'forced')) for (const [s, v] of Object.entries(r.states)) out.styles.push({run: key(r), state: s, ...v.styles});
fs.writeFileSync('f2-compare.json', JSON.stringify(out, null, 2));
console.log('normal identical', out.normalScreenshotsIdentical.filter(x => x[1]).length + '/' + out.normalScreenshotsIdentical.length);
console.log('geometry equal', out.geometry.filter(x => x.sameAsNormal).length + '/' + out.geometry.length, out.geometry.filter(x => !x.sameAsNormal).map(x => `${x.build} ${x.run} ${x.state}`).join('; '));
console.log('native offset = cursor', out.geometry.filter(x => x.nativeOffsetAtCursor !== undefined).every(x => x.nativeOffsetAtCursor === x.cursorIndex));
const s = a.runs.find(r => r.theme === 'forced' && r.viewport === '390');
for (const [n, v] of Object.entries(s.states)) console.log(n, JSON.stringify(v.styles));
