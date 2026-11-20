/* Measure whitespace between handwritten components in a normalized 128px tile. */
(() => {
  const H = window.HangulInk;
  const vowelGroups = ['ㅏㅓㅣㅐㅔㅑㅕㅒㅖ', 'ㅗㅜㅡㅛㅠ', 'ㅘㅝㅚㅟㅢㅙㅞ'];
  const vowels = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
  const tails = ' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';
  const singles = 'ㄱㄴㄹㅁㅂㅅㅇㄷㅈㅊㅋㅌㅍㅎㄲㅆ';
  const samples = [];
  for(let i=0;i<19;i++) for(let group=0;group<3;group++) for(let final=0;final<2;final++) {
    const pool=vowelGroups[group], vowel=pool[(i+final)%pool.length];
    const tail=final ? singles[(i*3+group)%singles.length] : ' ';
    samples.push(String.fromCharCode(0xac00+(i*21+vowels.indexOf(vowel))*28+tails.indexOf(tail)));
  }
  samples.push(...'값앉읽닭삶많');
  // Spread initials and layouts across the first three sheets.
  const original=samples.slice(0,114);
  for(let pass=0;pass<6;pass++)for(let i=0;i<19;i++){
    samples[pass*19+i]=original[i*6+(i+pass)%6];
  }
  const donors=new Map(), images=new Map(), plans=new Map();
  function structure(ch) {
    const [initial,vowel,tail]=H.parts(ch);
    return {initial,vowel,tail,group:vowelGroups.findIndex(group=>group.includes(vowel))};
  }
  function forget(ch) {
    for(const piece of donors.get(ch)?.pieces||[]) images.delete(piece.key);
    donors.delete(ch);plans.clear();
  }
  function learn(ch,image) {
    if(!samples.includes(ch))return;
    forget(ch);
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
    const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,128,128);
    const data=ctx.getImageData(0,0,128,128), ink=[];
    for(let i=0;i<16384;i++)if(data.data[i*4+3]>=48)ink.push(i);
    const s=structure(ch);
    // Find a valley in the ink projection near the expected boundary.
    function cut(points,axis,low,high,ideal) {
      const counts=new Uint16Array(128);
      for(const p of points)counts[axis==='x'?p%128:p>>7]++;
      let best=ideal,score=Infinity;
      for(let n=low;n<=high;n++){
        const cost=counts[n-1]+2*counts[n]+counts[n+1]+Math.abs(n-ideal)*0.16;
        if(cost<score){score=cost;best=n;}
      }
      return best;
    }
    const bottom=s.tail?cut(ink,'y',69,99,84):128;
    const upper=ink.filter(p=>(p>>7)<bottom);
    const right=s.group===1?128:cut(upper,'x',48,86,68);
    const left=upper.filter(p=>p%128<right);
    const lower=s.group===0?128:cut(left,'y',Math.round(bottom*.39),Math.round(bottom*.75),Math.round(bottom*.58));
    const masks=[[],[],[]];
    for(const p of ink){
      const x=p%128,y=p>>7;
      masks[y>=bottom?2:(x>=right||y>=lower)?1:0].push(p);
    }
    const pieces=[];
    for(const [role,part] of [s.initial,s.vowel,s.tail].entries()){
      const pixels=masks[role];if(!part||pixels.length<4)continue;
      let x=127,y=127,r=0,b=0;
      const layer=ctx.createImageData(128,128);
      for(const p of pixels){const px=p%128,py=p>>7;x=Math.min(x,px);y=Math.min(y,py);r=Math.max(r,px);b=Math.max(b,py);layer.data[p*4+3]=data.data[p*4+3];}
      const w=r-x+1,h=b-y+1,key=ch+'/'+role;
      ctx.putImageData(layer,0,0);
      const tile=document.createElement('canvas');tile.width=tile.height=128;
      tile.getContext('2d').drawImage(canvas,x,y,w,h,13,13,102,102);
      images.set(key,tile);pieces.push({role,part,key,x,y,w,h});
    }
    donors.set(ch,{...s,ch,pieces});
  }
  function layout(ch) {
    if(plans.has(ch))return plans.get(ch);
    const s=structure(ch), result=[];
    const ranked=[...donors.values()].sort((a,b)=>score(b)-score(a)||a.ch.charCodeAt(0)-b.ch.charCodeAt(0));
    function score(d){return 16*(s.group===d.group)+8*(!!s.tail===!!d.tail)+4*(s.initial===d.initial)+2*(s.vowel===d.vowel)+(s.tail===d.tail);}
    const template=ranked.find(d=>d.group===s.group&&!!d.tail===!!s.tail&&d.pieces.length===(s.tail?3:2));
    if(template)for(const slot of template.pieces){
      const part=[s.initial,s.vowel,s.tail][slot.role];
      const find=(component)=>ranked.map(d=>d.pieces.find(p=>p.role===slot.role&&p.part===component)).find(Boolean);
      const piece=find(part);
      if(piece)result.push({...slot,char:piece.key});
      else if(slot.role===2){
        const split=H.placements(ch).slice(-2);
        if(!split.every(p=>find(p.char)))break;
        if(split.some(p=>p.y!==94)||split.length!==2)break;
        split.forEach((p,i)=>result.push({...slot,char:find(p.char).key,x:slot.x+i*slot.w*.52,w:slot.w*.48}));
      }else break;
      if(slot===template.pieces[template.pieces.length-1]){plans.set(ch,result);return result;}
    }
    plans.set(ch,null);return null;
  }
  window.SampleInk={samples,learn,forget,layout,images,reset(){donors.clear();images.clear();plans.clear();}};
})();
