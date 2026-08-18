# -*- coding: utf-8 -*-
"""안산 힐스테이트 오피스텔 방문자 디비 xlsx → scripts/hillstate.txt
탭 구분: 이름 / 성별 / 나이대 / 번호숫자 / 지역(시도 시군구 읍면동)"""
import openpyxl, re, io, sys
from collections import Counter, defaultdict

SRC = r'd:\DB\성진디비\야목\안산 힐스테이트 오피스텔 방문자 디비.xlsx'
OUT = r'D:\claude\onsia_crm2\scripts\hillstate.txt'
out = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

wb = openpyxl.load_workbook(SRC, data_only=True, read_only=True)
ws = wb['Sheet1']

def cell(r, i):
    return str(r[i]).strip() if len(r) > i and r[i] is not None else ''

rows = []
skipped_header = []
for idx, r in enumerate(ws.iter_rows(values_only=True), start=1):
    name = cell(r, 0)
    gender = cell(r, 1)
    age = cell(r, 2)
    phone_raw = cell(r, 3)
    area = ' '.join(x for x in (cell(r, 4), cell(r, 5), cell(r, 6)) if x)
    digits = re.sub(r'\D', '', phone_raw)
    if not digits:
        if name or gender or age or area:
            skipped_header.append((idx, name, gender, age, phone_raw, area))
        continue
    rows.append({'row': idx, 'name': name, 'gender': gender, 'age': age,
                 'phone': digits, 'raw': phone_raw, 'area': area})

with io.open(OUT, 'w', encoding='utf-8') as f:
    for x in rows:
        f.write(f"{x['name']}\t{x['gender']}\t{x['age']}\t{x['phone']}\t{x['area']}\n")

print(f'번호 있는 행: {len(rows)}', file=out)
print(f'번호 없는 행(제목/공백 등): {len(skipped_header)}', file=out)
for s in skipped_header[:10]:
    print(f'  {s}', file=out)

cnt = Counter(x['phone'] for x in rows)
dups = {k: v for k, v in cnt.items() if v > 1}
print(f'\n리스트 내 번호 중복 그룹: {len(dups)} (초과 건수 {sum(v - 1 for v in dups.values())})', file=out)
by = defaultdict(list)
for x in rows:
    if x['phone'] in dups:
        by[x['phone']].append(x['name'] or '(이름없음)')
for k, v in list(sorted(dups.items(), key=lambda kv: -kv[1]))[:10]:
    print(f'  {k} x{v} 이름:{by[k]}', file=out)

bad = [x for x in rows if not re.match(r'^010[2-9]\d{7}$', x['phone'])]
print(f'\n형식 이상: {len(bad)}', file=out)
for x in bad[:40]:
    print(f"  행{x['row']} {x['name']} | {x['raw']} → {x['phone']}", file=out)

print(f"\n이름 없음: {sum(1 for x in rows if not x['name'])}", file=out)
print(f"지역 있음: {sum(1 for x in rows if x['area'])}", file=out)
print(f"성별 값 분포: {Counter(x['gender'] for x in rows).most_common()}", file=out)
print(f"나이대 값 분포: {Counter(x['age'] for x in rows).most_common()}", file=out)
out.flush()
