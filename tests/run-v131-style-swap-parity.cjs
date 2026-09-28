const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const style1Js = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const style1Css = fs.readFileSync(path.join(root, 'css/app.css'), 'utf8');
const style2Js = fs.readFileSync(path.join(root, 'style-2/js/app-v1.31.js'), 'utf8');

const svgPath = 'M4 8h13m0 0-3-3m3 3-3 3M20 16H7m0 0 3-3m-3 3 3 3';
assert(style2Js.includes(svgPath), 'Style 2 position-swap SVG authority missing');
assert(style1Js.includes(svgPath), 'Style 1 does not reuse Style 2 position-swap SVG');
assert(style1Js.includes('class="position-swap"'), 'Style 1 swap button must use position-swap component class');
assert(!style1Js.includes('>↔</button>'), 'Legacy Style 1 text-glyph swap button still active');

for (const contract of [
  'width:36px;height:36px',
  'border:1px solid #128fd0',
  'border-radius:50%',
  'background:#0aa8f6',
  'box-shadow:0 4px 12px rgba(0,0,0,.35)',
  'width:19px;height:19px',
  'stroke-width:2.25'
]) {
  assert(style1Css.includes(contract), `Style 1 missing Style 2 swap visual contract: ${contract}`);
}
assert(style1Css.includes('@media(max-width:1180px) and (min-width:761px){.formation-grid{grid-template-columns:minmax(0,1fr) 34px minmax(0,1fr) 34px minmax(0,1fr)}.position-swap{width:32px;height:32px}}'), 'Style 1 must match Style 2 tablet swap sizing');
assert(style1Css.includes('.position-swap{display:none}'), 'Style 1 existing mobile layout behavior must remain locked');
console.log('PASS v1.31 Style 1 / Style 2 Hero swap-button visual parity');
