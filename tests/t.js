const fs=require('fs'),path=require('path'),OMR=require('../src/core.js');
const spec=JSON.parse(fs.readFileSync(path.join(__dirname,'../src/layout.json')));
function pgm(f){const b=fs.readFileSync(f);let p=0,t=[];while(t.length<4){let s='';while(b[p]<=32)p++;while(b[p]>32)s+=String.fromCharCode(b[p++]);t.push(s)}p++;return{w:+t[1],h:+t[2],data:new Uint8Array(b.subarray(p))}}
for(const f of process.argv.slice(2)){const g=pgm(f),t0=Date.now(),r=OMR.analyze(g,spec);
 if(!r.ok){console.log(path.basename(f),'NG',r.reason);continue}
 const out=[];for(const q of spec.questions){if(q.type==='text')continue;const c=OMR.classify(r.ratios[q.id],q,0.42,0.12);out.push(q.id+'='+c.marked.join(',')+(c.flags.length?'['+c.flags.map(f=>f==='薄いマーク'?f+':'+c.faint.join(','):f).join('/')+']':''))}
 console.log(path.basename(f),'OK',r.flipped?'(上下逆)':'',r.streaks?'線除外'+r.streaks:'',Date.now()-t0+'ms',out.join(' '))}
