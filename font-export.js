/* Trace binary ink boundaries to closed TrueType contours, preserving holes. */
(() => {
  function trace(rgba,width=128,height=128) {
    const dark=(x,y)=>x>=0&&y>=0&&x<width&&y<height&&rgba[(y*width+x)*4+3]>=96;
    const edges=[],starts=new Map(),stride=width+1;
    function edge(x,y,ex,ey,dir) {
      const e={x,y,ex,ey,dir,used:false};edges.push(e);
      const key=y*stride+x;if(!starts.has(key))starts.set(key,[]);starts.get(key).push(e);
    }
    for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(dark(x,y)) {
      if(!dark(x,y-1))edge(x,y,x+1,y,0);
      if(!dark(x+1,y))edge(x+1,y,x+1,y+1,1);
      if(!dark(x,y+1))edge(x+1,y+1,x,y+1,2);
      if(!dark(x-1,y))edge(x,y+1,x,y,3);
    }
    const contours=[];
    for(const first of edges) {
      if(first.used)continue;
      const points=[];let e=first;
      do {
        e.used=true;points.push({x:e.x*8,y:(height-e.y)*8,onCurve:true});
        if(e.ex===first.x&&e.ey===first.y)break;
        const options=(starts.get(e.ey*stride+e.ex)||[]).filter(n=>!n.used);
        const order=[(e.dir+1)%4,e.dir,(e.dir+3)%4,(e.dir+2)%4];
        e=order.map(d=>options.find(n=>n.dir===d)).find(Boolean);
        if(!e)throw new Error('글씨 윤곽을 연결하지 못했어요. 해당 칸을 다시 써주세요.');
      } while(e!==first);
      const compact=points.filter((p,i)=>{
        const a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length];
        return (p.x-a.x)*(b.y-p.y)!==(p.y-a.y)*(b.x-p.x);
      });
      if(compact.length>=3)contours.push(compact);
    }
    return contours;
  }
  function bounds(contours) {
    let xMin=Infinity,yMin=Infinity,xMax=-Infinity,yMax=-Infinity;
    for(const contour of contours)for(const p of contour){xMin=Math.min(xMin,p.x);yMin=Math.min(yMin,p.y);xMax=Math.max(xMax,p.x);yMax=Math.max(yMax,p.y);}
    return Number.isFinite(xMin)?{xMin,yMin,xMax,yMax}:{xMin:0,yMin:0,xMax:0,yMax:0};
  }
  async function build({glyphs,H,family='나의 필체',progress=()=>{}}) {
    const required=[...H.initials,...H.basicVowels],missing=required.filter(c=>!glyphs.has(c));
    if(missing.length)throw new Error(`필수 가이드 ${missing.length}칸을 먼저 써주세요: ${missing.join(' ')}`);
    const font=JSON.parse(JSON.stringify(window.PilcheEmptyFont));
    const uid=Date.now().toString(36),psName='Pilche-'+uid;
    font.name={fontFamily:family,fontSubFamily:'Regular',fullName:family+' Regular',uniqueSubFamily:psName,postScriptName:psName,version:'Version 2.1'};
    font.head.unitsPerEm=1024;font.head.created=font.head.modified=Date.now();
    font.hhea.ascent=1024;font.hhea.descent=-128;font.hhea.lineGap=0;
    Object.assign(font['OS/2'],{usWeightClass:400,usWidthClass:5,fsType:0,fsSelection:64,sTypoAscender:1024,sTypoDescender:-128,sTypoLineGap:0,usWinAscent:1024,usWinDescent:128});
    font.post.format=3;
    font.glyf=[font.glyf[0],{name:'space',unicode:[32],contours:[],advanceWidth:512,leftSideBearing:0,xMin:0,yMin:0,xMax:0,yMax:0}];
    const indexes=new Map();
    for(const [ch,contours] of glyphs) {
      const cp=ch.codePointAt(0);
      if([...ch].length!==1||cp===32||cp>0xffff||!contours.length)continue;
      const box=bounds(contours);
      indexes.set(ch,font.glyf.length);
      font.glyf.push({name:'uni'+cp.toString(16).toUpperCase(),unicode:[cp],contours,...box,advanceWidth:1024,leftSideBearing:box.xMin});
    }
    for(let cp=0xac00;cp<=0xd7a3;cp++) {
      const ch=String.fromCodePoint(cp);
      if(!indexes.has(ch)) {
        const components=H.placements(ch).map(p=>{
          const sx=Math.round(p.w/102*16384)/16384,sy=Math.round(p.h/102*16384)/16384;
          return {glyphIndex:indexes.get(p.char),transform:{a:sx,b:0,c:0,d:sy,e:Math.round(p.x*8-104*sx),f:Math.round((128-p.y-p.h)*8-104*sy)}};
        });
        const boxes=components.map(g=>{const b=font.glyf[g.glyphIndex],t=g.transform;return {xMin:Math.floor(b.xMin*t.a+t.e),xMax:Math.ceil(b.xMax*t.a+t.e),yMin:Math.floor(b.yMin*t.d+t.f),yMax:Math.ceil(b.yMax*t.d+t.f)};});
        const box={xMin:Math.min(...boxes.map(b=>b.xMin)),xMax:Math.max(...boxes.map(b=>b.xMax)),yMin:Math.min(...boxes.map(b=>b.yMin)),yMax:Math.max(...boxes.map(b=>b.yMax))};
        font.glyf.push({name:'uni'+cp.toString(16).toUpperCase(),unicode:[cp],compound:true,glyfs:components,...box,advanceWidth:1024,leftSideBearing:box.xMin});
      }
      if(cp%512===0){progress(Math.round((cp-0xac00)/11172*85));await new Promise(r=>setTimeout(r,0));}
    }
    progress(90);await new Promise(r=>setTimeout(r,0));
    const writer=new window.PilcheTtfWriter({hinting:false,support:{hhea:{ascent:1024,descent:-128,lineGap:0}}});
    const buffer=writer.write(font);progress(100);
    return {buffer,glyphCount:font.glyf.length,family};
  }
  window.PilcheFont={trace,bounds,build};
})();
