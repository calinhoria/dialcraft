// After face-cli: add the sensor permissions this face needs to the exported app.json (Dialcraft's export does not write them for custom code; the watch
// answers "PERMISSION DENIED data:user.hd.step / heart_rate / calorie" to new Step() / new HeartRate() / new Calorie() without them).
const fs = require('fs'), p = __dirname + '/out/terminal-ascii/app.json', j = JSON.parse(fs.readFileSync(p, 'utf8'))
const need = ['data:user.hd.step', 'data:user.hd.heart_rate', 'data:user.hd.calorie']
j.permissions = Array.from(new Set((j.permissions || []).concat(need)))
fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n'); console.log('permissions:', j.permissions.join(', '))
