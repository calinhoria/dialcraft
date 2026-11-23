import sys
sys.argv = ['x']
from lib import *
import cand1, cand3, cand5
OUT = '/Volumes/Projects/Projects/dialcraft/previews/'
import os; os.makedirs(OUT, exist_ok=True)
t = cand1.table
sheet([t(200, 2), t(200, 3), t(300, 51)], OUT + 'effect-1-times-table.png')
h = cand3.harmono
sheet([h(1), h(3), h(7)], OUT + 'effect-3-harmonograph.png')
sheet([cand5.style(cand5.pack(5), 'donut'), cand5.style(cand5.pack(8), 'bubble'), cand5.style(cand5.pack(11), 'target')], OUT + 'effect-5-circle-packing.png')
print('done')
