// src/ 의 조각들을 하나의 index.html 로 합칩니다:  node build.js  (고칠 때는 src/ 를 고치고 다시 합치세요)
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, 'src');
const css = fs.readFileSync(path.join(src, 'style.css'), 'utf8');
const js = fs.readdirSync(path.join(src, 'js')).filter((f) => f.endsWith('.js')).sort()
  .map((f) => fs.readFileSync(path.join(src, 'js', f), 'utf8')).join('\n');
if (js.includes('</script')) throw new Error('script 닫는 태그가 JS 안에 있습니다');
let html = fs.readFileSync(path.join(src, 'index.template.html'), 'utf8');
html = html.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js);

fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('index.html', (html.length / 1024).toFixed(1) + ' KB');
