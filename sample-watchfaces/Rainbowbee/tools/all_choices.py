"""Makes every complication slot of a Dialcraft project draw every choice it lists.
A choice only shows something when layers are tied to it (Properties → Complication). For each (slot, choice) that has none, this
copies the layers of the same choice from another slot and moves them by the slots' y distance. Idempotent.
usage: all_choices.py <project .wfproj.json>"""
import copy, json, random, string, sys
f = sys.argv[1]; P = json.load(open(f)); els = P['elements']
rid = lambda: 'elm' + ''.join(random.choice(string.ascii_lowercase + string.digits) for _ in range(11))
slots = {e['editId']: e for e in els if e['kind'] == 'EDIT_SLOT'}
tied = lambda sid, t: [e for e in els if e.get('editSlot') == sid and e.get('editType') == t]
added = 0
for sid, slot in slots.items():
    for o in slot['optionalTypes']:
        t = o['type']
        if tied(sid, t): continue
        src_id = next((s for s in slots if s != sid and tied(s, t)), None)
        if src_id is None: print('no source layers for', t); continue
        dy = slot['y'] - slots[src_id]['y']
        new = []
        for e in tied(src_id, t):
            c = copy.deepcopy(e); c['id'] = rid(); c['editSlot'] = sid; c['y'] = int(c['y']) + dy
            c['name'] = f"{e['name']} (slot {sid})"; new.append(c)
        last = max(els.index(e) for e in els if e.get('editSlot') == sid or e is slot)   # right after this slot's last layer
        els[last + 1:last + 1] = new; added += len(new)
        print(f'slot {sid}: {t} <- {len(new)} layers from slot {src_id} (dy {dy:+d})')
json.dump(P, open(f, 'w')); print('layers added:', added)
