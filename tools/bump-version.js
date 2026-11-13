// index.html의 ?v= 값을 지금 시각으로 바꾼다. 배포(main에 올리기) 전에 실행하면
// 브라우저가 캐시해 둔 예전 JS·CSS 대신 새 파일을 받는다. 사용: node tools/bump-version.js
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../index.html', import.meta.url);
const v = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12); // 예: 202611131530
const html = readFileSync(file, 'utf8');
const next = html.replace(/\?v=[\w.-]+/g, `?v=${v}`);
writeFileSync(file, next);
// 게임이 켜질 때 이 파일을 캐시 없이 읽어, 자기 버전과 다르면 새로 연다(index.html이 캐시된 경우 대비).
writeFileSync(new URL('../version.json', import.meta.url), JSON.stringify({ v }) + '\n');
console.log(`버전 ${v} (${(html.match(/\?v=/g) || []).length}곳)`);
