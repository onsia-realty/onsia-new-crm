# -*- coding: utf-8 -*-
"""보니타가 디비정리 xlsx → scripts/bonitaga.txt
원본 열: 1=구분 2=이름 3=전화번호(8자리 정수, 앞 010 생략) 4=TM일자
         5,6,7=관심도 A/B/C  8=삭제요청 9=부재 10=결번  11=상담내용
출력 탭 구분: 이름 / 번호숫자 / 관심도 / 플래그 / 상담내용
"""
import openpyxl, re, io, sys
from collections import Counter, defaultdict

SRC = r'd:\DB\성진디비\야목\보니타가 디비정리.xlsx'
OUT = r'D:\claude\onsia_crm2\scripts\bonitaga.txt'
out = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

wb = openpyxl.load_workbook(SRC, data_only=True, read_only=True)
ws = wb['Sheet1']


def cell(r, i):
    if len(r) <= i or r[i] is None:
        return ''
    v = r[i]
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v).strip()


rows = []
blank_run = 0
last_row = 0
for idx, r in enumerate(ws.iter_rows(values_only=True), start=1):
    if idx <= 3:
        continue
    if all(x is None for x in r):
        blank_run += 1
        if blank_run > 50:
            break
        continue
    blank_run = 0
    last_row = idx
    name = cell(r, 1)
    phone_raw = cell(r, 2)
    tm = cell(r, 3)
    grade = 'A' if cell(r, 4) else ('B' if cell(r, 5) else ('C' if cell(r, 6) else ''))
    flags = []
    if cell(r, 7):
        flags.append('삭제요청')
    if cell(r, 8):
        flags.append('부재')
    if cell(r, 9):
        flags.append('결번')
    memo = cell(r, 10)
    digits = re.sub(r'\D', '', phone_raw)
    rows.append({'row': idx, 'name': name, 'raw': phone_raw, 'digits': digits,
                 'tm': tm, 'grade': grade, 'flags': flags, 'memo': memo})

print(f'마지막 데이터 행: {last_row}', file=out)
print(f'수집 행수: {len(rows)}', file=out)


def normalize(d):
    """8자리 → 010 붙임. 이미 11자리 010이면 그대로."""
    if len(d) == 8:
        return '010' + d
    if len(d) == 11 and d.startswith('010'):
        return d
    if len(d) == 10 and d.startswith('10'):
        return '0' + d
    return d


for x in rows:
    x['phone'] = normalize(x['digits'])

print(f"\n원본 자릿수 분포: {Counter(len(x['digits']) for x in rows).most_common()}", file=out)

flag_cnt = Counter()
for x in rows:
    for f in x['flags']:
        flag_cnt[f] += 1
    if not x['flags']:
        flag_cnt['(플래그없음)'] += 1
print(f'플래그 분포: {flag_cnt.most_common()}', file=out)
print(f"관심도 분포: {Counter(x['grade'] or '(없음)' for x in rows).most_common()}", file=out)
print(f"상담내용 있음: {sum(1 for x in rows if x['memo'])}", file=out)
print(f"이름 없음: {sum(1 for x in rows if not x['name'])}", file=out)

bad = [x for x in rows if not re.match(r'^010[2-9]\d{7}$', x['phone'])]
print(f'\n정규화 후 형식 이상: {len(bad)}', file=out)
for x in bad[:30]:
    print(f"  행{x['row']} {x['name']} | 원본 {x['raw']} → {x['phone']}", file=out)

cnt = Counter(x['phone'] for x in rows)
dups = {k: v for k, v in cnt.items() if v > 1}
print(f'\n리스트 내 중복 그룹: {len(dups)} (초과 {sum(v - 1 for v in dups.values())})', file=out)
by = defaultdict(list)
for x in rows:
    if x['phone'] in dups:
        by[x['phone']].append(x['name'] or '(이름없음)')
for k, v in list(sorted(dups.items(), key=lambda kv: -kv[1]))[:8]:
    print(f'  {k} x{v} 이름:{by[k][:8]}', file=out)

with io.open(OUT, 'w', encoding='utf-8') as f:
    for x in rows:
        memo = x['memo'].replace('\t', ' ').replace('\n', ' ')
        f.write(f"{x['name']}\t{x['phone']}\t{x['grade']}\t{'|'.join(x['flags'])}\t{memo}\n")
print(f'\n저장: {OUT}', file=out)
out.flush()
