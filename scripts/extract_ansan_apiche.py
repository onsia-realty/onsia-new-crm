# -*- coding: utf-8 -*-
"""안산 중앙역 아피체 방명록 xlsx → scripts/ansan_apiche.txt (탭 구분: 이름/지역/번호)"""
import openpyxl, re, io, sys

SRC = r'd:\DB\성진디비\야목\안산 중앙역 아피체 방명록 (중복 수정).xlsx'
OUT = r'D:\claude\onsia_crm2\scripts\ansan_apiche.txt'

wb = openpyxl.load_workbook(SRC, data_only=True, read_only=True)
ws = wb['Sheet1']

rows = []
for r in ws.iter_rows(values_only=True):
    name = (str(r[0]).strip() if r[0] is not None else '')
    area = (str(r[1]).strip() if len(r) > 1 and r[1] is not None else '')
    phone_raw = (str(r[2]).strip() if len(r) > 2 and r[2] is not None else '')
    if not name and not phone_raw:
        continue
    digits = re.sub(r'\D', '', phone_raw)
    rows.append((name, area, digits, phone_raw))

with io.open(OUT, 'w', encoding='utf-8') as f:
    for name, area, digits, _ in rows:
        f.write(f'{name}\t{area}\t{digits}\n')

out = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
print(f'총 행수: {len(rows)}', file=out)

# 리스트 내 중복
from collections import Counter, defaultdict
cnt = Counter(d for _, _, d, _ in rows if d)
dups = {k: v for k, v in cnt.items() if v > 1}
print(f'리스트 내 번호 중복 그룹: {len(dups)} (초과 건수 {sum(v - 1 for v in dups.values())})', file=out)
by = defaultdict(list)
for name, area, d, _ in rows:
    if d in dups:
        by[d].append(name)
for k, v in list(dups.items())[:15]:
    print(f'  {k} x{v} 이름:{by[k]}', file=out)

# 형식 이상
bad = [(n, a, d, raw) for n, a, d, raw in rows if not re.match(r'^010[2-9]\d{7}$', d)]
print(f'형식 이상(010[2-9]xxxxxxx 미통과): {len(bad)}', file=out)
for n, a, d, raw in bad[:40]:
    print(f'  {n} | {a} | {raw} → {d}', file=out)

# 이름/지역 통계
print(f'이름 없음: {sum(1 for n, a, d, _ in rows if not n)}', file=out)
print(f'지역 있음: {sum(1 for n, a, d, _ in rows if a)}', file=out)
out.flush()
