const fs=require('fs');
const r=JSON.parse(fs.readFileSync('recipe-base.json'));
const rename=(suf)=>({script:`const n=project.elements.length;for(const i of [n-3,n-2,n-1]){project.elements[i].name=project.elements[i].name+' ${suf}';}return 1`});
const out=[]; let c=0; const sufs=['Mag','Cyan','Main','Aod'];
for(const s of r.steps){ out.push(s); if(s.preset==='clock') out.push(rename(sufs[c++])); }
const X=45, SZ=130;
const d=(n,dx,y,color,show,a)=>({edit:n,set:{x:X+dx,y,show,alpha:a},glyph:{color,size:SZ}});
out.push(...['Mag','Cyan','Main','Aod'].map(s=>({remove:'Colon '+s})));
const cfg={Mag:[-4,'#ff2bd6','normal',200],Cyan:[4,'#18e6ff','normal',200],Main:[0,'#f4fbff','normal',255],Aod:[0,'#3f4a55','aod',255]};
for(const [s,[dx,col,show,a]] of Object.entries(cfg)){
  out.push(d('Hour '+s,dx,50,col,show,a), d('Minute '+s,dx,195,col,show,a));
}
out.push({edit:'Weekday',glyph:{color:'#18e6ff',size:34},set:{x:45,y:355}});
out.push({edit:'Steps',glyph:{color:'#ff2bd6',size:34},set:{x:45,y:400}});
r.steps=out; fs.writeFileSync('recipe.json',JSON.stringify(r,null,1));
const r2=JSON.parse(fs.readFileSync('recipe.json'));
for(const s of r2.steps){ if(s.edit==='Hour Aod'){s.glyph.size=100;s.set.x=60;s.set.y=95;} if(s.edit==='Minute Aod'){s.glyph.size=100;s.set.x=60;s.set.y=215;} }
fs.writeFileSync('recipe.json',JSON.stringify(r2,null,1));
