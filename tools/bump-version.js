// index.html의 ?v= 값을 지금 시각으로 바꾼다. 배포(main에 올리기) 전에 실행하면
// 브라우저가 캐시해 둔 예전 JS·CSS 대신 새 파일을 받는다. 사용: node tools/bump-version.js
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../index.html', import.meta.url);
const v = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12); // 예: 202611131530
const html = readFileSync(file, 'utf8');
const next = html.replace(/\?v=[\w.-]+/g, `?v=${v}`);
writeFileSync(file, next);
console.log(`버전 ${v} (${(html.match(/\?v=/g) || []).length}곳)`);
