// After face-cli: put the Open Sans file into the saved project (face-cli's save writes no fonts), so the project reopens with it.
const fs = require('fs'), D = __dirname + '/project/';
const f = fs.readdirSync(D).find((n) => n.endsWith('.wfproj.json')), pr = JSON.parse(fs.readFileSync(D + f, 'utf8'));
fs.mkdirSync(D + 'fonts', { recursive: true });
fs.copyFileSync(__dirname + '/build/open-sans-400.ttf', D + 'fonts/open-sans-400.ttf');
fs.writeFileSync(D + 'fonts/LICENSE-open-sans.txt', 'Open Sans Regular (open-sans-400.ttf) - SIL Open Font License 1.1, from Fontsource (fonts.google.com). Used only to draw the digit and weekday pictures; no font is shipped in the watchface.\n');
pr.fonts = [{ name: 'open-sans-400.ttf', family: 'Open Sans Regular' }]; pr.font = 'Open Sans Regular';
fs.writeFileSync(D + f, JSON.stringify(pr, null, 2));
console.log('fonts added to', f);
