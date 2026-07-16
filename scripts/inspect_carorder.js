const XLSX = require('xlsx');
const wb = XLSX.readFile('D:/DB/수원용인 카 오더.xlsx');
console.log('시트:', wb.SheetNames);
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  console.log(`\n=== 시트 "${name}" : ${rows.length}행 ===`);
  rows.slice(0, 8).forEach((r, i) => console.log(`  [${i}]`, JSON.stringify(r)));
}
