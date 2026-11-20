/* Generated matching layout for the three printable sheets. */
const LAYOUT = {"version":1,"paperMm":[210,297],"markersMm":[[12,13],[198,13],[198,284],[12,284]],"grid":{"x":20,"y":54,"w":18.9,"h":19.55,"cols":9,"rows":9},"pages":[["안","녕","하","세","요","반","갑","습","니","다","오","늘","도","좋","은","루","보","내","사","랑","고","맙","행","복","나","의","손","글","씨","로","쓰","는","마","음","편","지","우","리","함","께","래","즐","겁","게","이","상","모","든","순","간","을","기","억","해","언","제","따","뜻","한","람","되","싶","어","날","가","아","서","분","입","작","일","에","웃","으","며","살","너","전","야","있","정"],["말","많","워","더","멋","진","될","거","예","생","축","합","새","받","를","당","신","시","됩","름","운","결","혼","식","초","대","소","중","여","겨","울","봄","별","달","바","꽃","무","햇","친","구","족","엄","빠","형","동","누","천","히","씩","면","괜","찮","커","피","잔","과","책","권","그","조","용","후","만","남","했","수","잘","쁘","슬","프","설","레","쉽","둘","셋","넷","섯","곱","덟","홉","열"],["라","자","차","카","타","파","러","머","버","저","처","터","퍼","허","노","코","토","포","호","두","부","주","추","쿠","투","푸","디","미","비","치","키","티","각","갈","감","강","갇","갔","갚","갠","걱","걷","건","걸","검","것","겠","격","경","계","관","광","교","국","군","굴","궁","귀","균","0","1","2","3","4","5","6","7","8","9",".",",","!","?","-",":","(",")","/","&","+","%"]]};
/*
 * 필체연구소 — Browser-only handwriting glyph collector and canvas letter editor.
 * No server calls or AI APIs. Unlike a TTF generator, this first MVP uses bitmap glyphs.
 */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const S = 4; // warped A4 sampling density, pixels per millimeter
  const PAGE_W = 210 * S, PAGE_H = 297 * S;
  const DB_NAME = 'pilche-lab-v1', STORE = 'glyphs';
  const glyphData = new Map(); // char => PNG data URL
  const glyphImages = new Map();
  const tintedCache = new Map();
  const H = window.HangulInk, samples = window.SampleInk;
  let db = null, currentPage = -1, calibrationImage = null;
  let markerPoints = [], warpedPage = null, calibrationMode = 'choose';
  let pendingChar = '', drawing = false, previousDrawPoint = null;
  let toastTimer = null;
  const pageStats = JSON.parse(localStorage.getItem('pilche-page-stats') || '[null,null,null]');
  const paperColors = {cream:'#fffaf1',white:'#ffffff',lined:'#fffdfa'};
  const settings = {size:58, spacing:1, naturalness:2, color:'#312e33', paper:'cream'};

  function toast(message) {
    const el = $('toast'); el.textContent = message; el.classList.add('shown');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('shown'), 3600);
  }
  function downloadBlob(blob, filename) {
    const url=URL.createObjectURL(blob), a=document.createElement('a');
    a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
  function requestAsPromise(req) {return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
  async function initDb() {
    if (!('indexedDB' in window)) return;
    try {
      const request=indexedDB.open(DB_NAME,1);
      request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'char'});
      db=await requestAsPromise(request);
      const tx=db.transaction(STORE,'readonly');
      const data=await requestAsPromise(tx.objectStore(STORE).getAll());
      for(const item of data) setGlyphInMemory(item.char,item.dataUrl);
    } catch(e) {console.warn('IndexedDB is unavailable:',e);toast('이 환경에서는 영구 저장이 제한될 수 있어요. 백업을 내려받아 주세요.');}
  }
  function setGlyphInMemory(ch,url) {
    glyphData.set(ch,url);
    const img=new Image();
    img.onload=()=>{if(glyphData.get(ch)!==url)return;glyphImages.set(ch,img);samples.learn(ch,img);clearTintCache();renderLetter();renderMissing();};
    img.src=url;
  }
  function clearTintCache(){tintedCache.clear();}
  async function saveGlyphs(items) {
    for(const item of items) setGlyphInMemory(item.char,item.dataUrl);
    if(db){
      try{
        await new Promise((resolve,reject)=>{
          const tx=db.transaction(STORE,'readwrite');
          tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error);
          for(const item of items) tx.objectStore(STORE).put(item);
        });
      }catch(e){console.error(e);toast('글자 저장에 문제가 생겼어요. JSON 백업을 확인해 주세요.');throw e;}
    }
    updateCoverage();
  }
  function updateCoverage() {
    $('coverage').textContent = `등록된 글자 ${glyphData.size}개`;
    for(let i=0;i<3;i++){
      const stat=pageStats[i],card=document.querySelector(`[data-upload-card="${i}"]`),status=$(`pageStatus${i}`);
      if(stat){card.classList.add('done');status.textContent=`✓ 글자 ${stat.count}개 추출 · 다시 올리기 가능`;}
      else{card.classList.remove('done');status.textContent='사진 선택하기 ↗';}
    }
    renderMissing();
    $('guideProgress').textContent = `완성 글자 ${samples.samples.filter(c=>glyphData.has(c)).length} / 120`;
  }

  // A sheet must be photographed with its four black registration squares visible.
  function loadImage(file){return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{
      const sc=Math.min(1,1900/Math.max(img.naturalWidth,img.naturalHeight));
      const w=Math.round(img.naturalWidth*sc),h=Math.round(img.naturalHeight*sc);
      const cv=document.createElement('canvas');cv.width=w;cv.height=h;
      const cx=cv.getContext('2d',{willReadFrequently:true});
      cx.drawImage(img,0,0,w,h);URL.revokeObjectURL(url);
      resolve({canvas:cv, width:w,height:h,pixels:cx.getImageData(0,0,w,h)});
    };
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('이 이미지 파일을 열 수 없어요. JPG 또는 PNG로 변환해 주세요.'));};
    img.src=url;
  });}
  async function startCalibration(page, file){
    if(!file)return;
    try{
      currentPage=page;calibrationImage=await loadImage(file);markerPoints=[];warpedPage=null;calibrationMode='choose';
      $('calibrationHeading').textContent=`${page+1}번째 용지 · 네 모서리 지정`;
      $('calibrationHelp').innerHTML='사진의 <b>검은 사각 마커 가운데</b>를 <b>왼쪽 위 → 오른쪽 위 → 오른쪽 아래 → 왼쪽 아래</b> 순서로 눌러주세요.';
      $('confirmCalibration').disabled=true;$('confirmCalibration').textContent='4개 마커 지정하기';
      drawCalibration();$('calibrationDialog').showModal();
    }catch(e){toast(e.message);}
  }
  function drawCalibration(){
    const cv=$('calibrationCanvas'),cx=cv.getContext('2d');
    if(calibrationMode==='review' && warpedPage){
      cv.width=PAGE_W;cv.height=PAGE_H;cx.drawImage(warpedPage,0,0);
      const g=LAYOUT.grid;
      cx.strokeStyle='#d97759';cx.lineWidth=1.5;
      for(let r=0;r<g.rows;r++)for(let col=0;col<g.cols;col++){
        cx.strokeRect((g.x+col*g.w)*S,(g.y+r*g.h)*S,g.w*S,g.h*S);
      }
      return;
    }
    if(!calibrationImage)return;
    cv.width=calibrationImage.width;cv.height=calibrationImage.height;
    cx.drawImage(calibrationImage.canvas,0,0);
    const names=['① 왼쪽 위','② 오른쪽 위','③ 오른쪽 아래','④ 왼쪽 아래'];
    markerPoints.forEach((p,i)=>{
      cx.beginPath();cx.arc(p.x,p.y,11,0,Math.PI*2);cx.fillStyle='#bd6145';cx.fill();
      cx.lineWidth=3;cx.strokeStyle='#fff';cx.stroke();
      cx.font='bold 17px sans-serif';cx.textAlign='center';cx.textBaseline='middle';cx.fillStyle='#fff';cx.fillText(String(i+1),p.x,p.y);
      cx.font='bold 15px sans-serif';cx.textAlign='left';cx.textBaseline='alphabetic';
      cx.strokeStyle='#fff';cx.lineWidth=4;cx.strokeText(names[i],p.x+18,p.y+5);cx.fillStyle='#963c26';cx.fillText(names[i],p.x+18,p.y+5);
    });
    if(markerPoints.length>1){
      cx.beginPath();cx.moveTo(markerPoints[0].x,markerPoints[0].y);
      markerPoints.slice(1).forEach(p=>cx.lineTo(p.x,p.y));
      cx.strokeStyle='#d66d50';cx.lineWidth=3;cx.stroke();
    }
  }
  $('calibrationCanvas').addEventListener('click',event=>{
    if(calibrationMode!=='choose'||markerPoints.length>=4)return;
    const cv=event.currentTarget,rect=cv.getBoundingClientRect();
    const x=(event.clientX-rect.left)*cv.width/rect.width;
    const y=(event.clientY-rect.top)*cv.height/rect.height;
    markerPoints.push({x,y});drawCalibration();
    $('calibrationSteps').textContent=`마커 ${markerPoints.length} / 4개 선택됨`;
    if(markerPoints.length===4){$('confirmCalibration').disabled=false;$('confirmCalibration').textContent='사진 정렬하기 →';}
  });
  $('resetPoints').addEventListener('click',()=>{
    markerPoints=[];calibrationMode='choose';warpedPage=null;
    $('calibrationSteps').textContent='마커 0 / 4개 선택됨';
    $('confirmCalibration').disabled=true;$('confirmCalibration').textContent='4개 마커 지정하기';
    $('calibrationHelp').innerHTML='사진의 <b>검은 사각 마커 가운데</b>를 <b>왼쪽 위 → 오른쪽 위 → 오른쪽 아래 → 왼쪽 아래</b> 순서로 눌러주세요.';
    drawCalibration();
  });
  $('closeCalibration').addEventListener('click',()=>$('calibrationDialog').close());
  $('confirmCalibration').addEventListener('click',async()=>{
    const btn=$('confirmCalibration');
    if(calibrationMode==='choose'){
      btn.disabled=true;btn.textContent='사진 보정 중...';
      await new Promise(resolve=>setTimeout(resolve,40));
      try{
        warpedPage=warpPhoto(calibrationImage,markerPoints);
        calibrationMode='review';drawCalibration();
        $('calibrationHelp').textContent='빨간 격자와 글씨 칸이 맞는지 확인하세요. 어긋나면 다시 지정해 주세요.';
        $('calibrationSteps').textContent='사진 정렬 완료 · 빨간 격자 검수';
        btn.disabled=false;btn.textContent='이대로 글자 추출하기 ✓';
      }catch(e){console.error(e);toast('사진 정렬에 실패했어요. 마커 위치를 다시 선택해 주세요.');$('resetPoints').click();}
    } else {
      btn.disabled=true;btn.textContent='글자 추출 중...';
      await new Promise(resolve=>setTimeout(resolve,40));
      try{
        const items=extractPage(warpedPage,currentPage);
        await saveGlyphs(items);
        pageStats[currentPage]={count:items.length,updatedAt:new Date().toISOString()};
        localStorage.setItem('pilche-page-stats',JSON.stringify(pageStats));
        $('calibrationDialog').close();updateCoverage();renderLetter();
        toast(`${currentPage+1}번 용지에서 ${items.length}개 글자를 추출했어요!`);
      }catch(e){console.error(e);toast('글자 추출 중 오류가 생겼어요. 다시 시도해 주세요.');}
      finally{btn.disabled=false;btn.textContent='이대로 글자 추출하기 ✓';}
    }
  });
  document.querySelectorAll('.upload-input').forEach(input=>input.addEventListener('change',()=>{
    const file=input.files?.[0];if(file)startCalibration(Number(input.dataset.page),file);
    input.value='';
  }));
  // Solves a projective transform mapping the normalized A4 marker positions
  // back into the uploaded image. Eight unknowns, Gaussian elimination.
  function solveHomography(dst,src){
    const A=[];
    for(let i=0;i<4;i++){
      const {x,y}=dst[i], u=src[i].x,v=src[i].y;
      A.push([x,y,1,0,0,0,-x*u,-y*u,u]);
      A.push([0,0,0,x,y,1,-x*v,-y*v,v]);
    }
    for(let col=0;col<8;col++){
      let pivot=col;for(let row=col+1;row<8;row++)if(Math.abs(A[row][col])>Math.abs(A[pivot][col]))pivot=row;
      if(Math.abs(A[pivot][col])<1e-8)throw new Error('Invalid marker geometry');
      [A[col],A[pivot]]=[A[pivot],A[col]];
      const factor=A[col][col];for(let k=col;k<=8;k++)A[col][k]/=factor;
      for(let row=0;row<8;row++)if(row!==col){const v=A[row][col];for(let k=col;k<=8;k++)A[row][k]-=v*A[col][k];}
    }
    return A.map(row=>row[8]);
  }
  function warpPhoto(im,markers){
    const dst=LAYOUT.markersMm.map(([x,y])=>({x:x*S,y:y*S}));
    const h=solveHomography(dst,markers);
    const out=document.createElement('canvas');out.width=PAGE_W;out.height=PAGE_H;
    const cx=out.getContext('2d',{willReadFrequently:true}),result=cx.createImageData(PAGE_W,PAGE_H);
    const d=result.data,src=im.pixels.data,sw=im.width,sh=im.height;
    for(let y=0;y<PAGE_H;y++)for(let x=0;x<PAGE_W;x++){
      const div=h[6]*x+h[7]*y+1,xx=(h[0]*x+h[1]*y+h[2])/div,yy=(h[3]*x+h[4]*y+h[5])/div;
      const p=(y*PAGE_W+x)*4;
      if(xx<0||yy<0||xx>=sw-1||yy>=sh-1){d[p]=d[p+1]=d[p+2]=255;d[p+3]=255;continue;}
      const ix=Math.floor(xx),iy=Math.floor(yy),ax=xx-ix,ay=yy-iy;
      const p0=(iy*sw+ix)*4,p1=p0+4,p2=p0+sw*4,p3=p2+4;
      for(let c=0;c<3;c++){
        const t0=src[p0+c]*(1-ax)+src[p1+c]*ax;
        const t1=src[p2+c]*(1-ax)+src[p3+c]*ax;
        d[p+c]=t0*(1-ay)+t1*ay;
      }
      d[p+3]=255;
    }
    cx.putImageData(result,0,0);return out;
  }
  function imageGlyph(ink,width,height,alphaMode){
    const output=document.createElement('canvas');output.width=128;output.height=128;
    const cx=output.getContext('2d');
    let left=width,top=height,right=-1,bottom=-1,amount=0;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const i=(y*width+x)*4;
      const a=alphaMode?ink[i+3]:(255-(.299*ink[i]+.587*ink[i+1]+.114*ink[i+2]));
      if(a>(alphaMode?30:120)){left=Math.min(x,left);right=Math.max(x,right);top=Math.min(y,top);bottom=Math.max(y,bottom);amount++;}
    }
    if(amount < (alphaMode?20:34) || right<left)return null;
    // Keep some outer margin, normalize legibility to approximately one Hangul character.
    const rw=right-left+1,rh=bottom-top+1;
    const inset=13,scale=Math.min((128-2*inset)/rw,(128-2*inset)/rh);
    const ox=(128-rw*scale)/2,oy=(128-rh*scale)/2;
    const source=document.createElement('canvas');source.width=width;source.height=height;
    const sx=source.getContext('2d'),img=sx.createImageData(width,height);
    for(let i=0;i<ink.length;i+=4){
      img.data[i]=img.data[i+1]=img.data[i+2]=0;
      const gray=.299*ink[i]+.587*ink[i+1]+.114*ink[i+2];
      img.data[i+3]=alphaMode?ink[i+3]:(gray<144?Math.min(255,(171-gray)*5):0);
    }
    sx.putImageData(img,0,0);cx.imageSmoothingQuality='high';
    cx.drawImage(source,left,top,rw,rh,ox,oy,rw*scale,rh*scale);
    return output.toDataURL('image/png');
  }
  function extractPage(warped,page){
    const gx=LAYOUT.grid,ctx=warped.getContext('2d',{willReadFrequently:true});
    const full=ctx.getImageData(0,0,PAGE_W,PAGE_H),src=full.data;
    const items=[];
    for(let index=0;index<81;index++){
      const ch=LAYOUT.pages[page][index],col=index%9,row=Math.floor(index/9);
      // The printed, pale reference character is deliberately above the crop.
      const x=Math.round((gx.x+col*gx.w+1.4)*S);
      const y=Math.round((gx.y+row*gx.h+5.2)*S);
      const w=Math.round((gx.w-2.8)*S),h=Math.round((gx.h-6.8)*S);
      const pixels=new Uint8ClampedArray(w*h*4);
      for(let py=0;py<h;py++)for(let px=0;px<w;px++){
        const from=((y+py)*PAGE_W+x+px)*4,to=(py*w+px)*4;
        pixels[to]=src[from];pixels[to+1]=src[from+1];pixels[to+2]=src[from+2];pixels[to+3]=255;
      }
      const dataUrl=imageGlyph(pixels,w,h,false);
      if(dataUrl)items.push({char:ch,dataUrl});
    }
    return items;
  }
  // Canvas renderer: recorded glyph bitmap first, system font for missing chars.
  function getTintedGlyph(ch){
    const key=ch+'|'+settings.color;
    if(tintedCache.has(key))return tintedCache.get(key);
    let measured=null;
    const layout=!glyphImages.has(ch)&&H.parts(ch)&&samples.layout(ch);
    if(layout){measured=document.createElement('canvas');measured.width=measured.height=128;const ctx=measured.getContext('2d');for(const p of layout)ctx.drawImage(samples.images.get(p.char),13,13,102,102,p.x,p.y,p.w,p.h);}
    const image=glyphImages.get(ch) || measured || H.compose(ch,c=>glyphImages.get(c),()=>document.createElement('canvas'));if(!image)return null;
    const cv=document.createElement('canvas');cv.width=128;cv.height=128;
    const cx=cv.getContext('2d');cx.drawImage(image,0,0,128,128);
    cx.globalCompositeOperation='source-in';cx.fillStyle=settings.color;cx.fillRect(0,0,128,128);
    tintedCache.set(key,cv);return cv;
  }
  function hash(index,ch){
    let n=((index+1)*2654435761+ch.codePointAt(0)*97)>>>0;
    n^=n<<13;n^=n>>>17;n^=n<<5;
    return (n>>>0)/4294967296;
  }
  function renderLetter(){
    const cv=$('letterCanvas'),cx=cv.getContext('2d'),W=cv.width,H=cv.height;
    cx.clearRect(0,0,W,H);cx.fillStyle=paperColors[settings.paper];cx.fillRect(0,0,W,H);
    if(settings.paper==='lined'){
      cx.strokeStyle='#e6e2df';cx.lineWidth=1;
      for(let y=97;y<H;y+=70){cx.beginPath();cx.moveTo(60,y);cx.lineTo(W-60,y);cx.stroke();}
    }
    const text=$('editorText').value,size=settings.size,spacing=settings.spacing;
    const lineHeight=size*1.58;
    let x=75,y=120;
    const maxX=W-75;
    let index=0;
    for(const ch of text){
      if(ch==='\n'){x=75;y+=lineHeight;continue;}
      const half=/[\u0000-\u007f]/.test(ch);
      const w=ch===' '?size*.42 : half?size*.65 :size*1.02;
      if(ch!==' '&&x+w+spacing>maxX){x=75;y+=lineHeight;}
      if(y>H-50)break;
      if(ch===' '){x+=w+spacing;index++;continue;}
      const jitter=settings.naturalness;
      const angle=(hash(index,ch)-.5)*jitter*Math.PI/180;
      const dx=(hash(index+31,ch)-.5)*jitter*.55;
      const dy=(hash(index+17,ch)-.5)*jitter*.45;
      cx.save();cx.translate(x+dx,y+dy);cx.rotate(angle);
      const glyph=getTintedGlyph(ch);
      if(glyph){
        cx.drawImage(glyph,0,-size*.89,w*.98,size*.98);
      }else{
        cx.fillStyle=settings.color;cx.globalAlpha=.66;
        cx.font=`${size*.88}px 'Noto Sans KR', sans-serif`;cx.textBaseline='alphabetic';
        cx.fillText(ch,0,0);cx.globalAlpha=1;
        cx.strokeStyle='#c98a65';cx.lineWidth=1;
        cx.beginPath();cx.moveTo(1,8);cx.lineTo(Math.max(8,w-7),8);cx.stroke();
      }
      cx.restore();x+=w+spacing;index++;
    }
    // Decorative footer: only on canvas; exported with the image.
    cx.fillStyle='#b8a99c';cx.font='13px DM Sans, sans-serif';cx.textAlign='right';
    cx.fillText('made with my handwriting  ·  pilche lab',W-45,H-32);cx.textAlign='left';
  }
  function renderMissing(){
    const text=$('editorText').value;
    const isReady = ch => glyphData.has(ch) || (H.parts(ch) && (samples.layout(ch)||H.dependencies(ch).every(c=>glyphData.has(c))));
    const chars = [...text].filter(ch=>ch.trim());
    const direct = chars.filter(ch=>glyphData.has(ch)).length;
    const combined = chars.filter(ch=>!glyphData.has(ch)&&isReady(ch)).length;
    $('coverage').textContent = `직접 쓴 글자 ${direct} · 조합 ${combined} · 기본 글꼴 ${chars.length-direct-combined}`;
    const missing=[...new Set(chars.filter(ch=>!isReady(ch)))];
    const parent=$('missingGlyphs');parent.replaceChildren();
    if(!missing.length){
      const el=document.createElement('span');el.className='missing-none';el.textContent='✓ 이 문장을 내 글씨로 표현할 준비가 됐어요.';parent.appendChild(el);return;
    }
    for(const ch of missing.slice(0,60)){
      const btn=document.createElement('button');btn.className='missing-glyph';btn.textContent=ch;
      btn.type='button';btn.title=`'${ch}' 직접 쓰기`;btn.addEventListener('click',()=>openDraw(ch));parent.appendChild(btn);
    }
    if(missing.length>60){const el=document.createElement('small');el.textContent=`외 ${missing.length-60}개`;parent.appendChild(el);}
  }
  function openDraw(ch){
    pendingChar=ch;$('drawCharTitle').textContent=ch;
    const cv=$('drawCanvas'),cx=cv.getContext('2d');cx.clearRect(0,0,cv.width,cv.height);
    $('drawDialog').showModal();
  }
  const drawCanvas=$('drawCanvas'),drawCtx=drawCanvas.getContext('2d');
  function drawCoord(event){const r=drawCanvas.getBoundingClientRect();return {x:(event.clientX-r.left)*drawCanvas.width/r.width,y:(event.clientY-r.top)*drawCanvas.height/r.height};}
  drawCanvas.addEventListener('pointerdown',e=>{
    drawing=true;previousDrawPoint=drawCoord(e);drawCanvas.setPointerCapture(e.pointerId);
    drawCtx.beginPath();drawCtx.arc(previousDrawPoint.x,previousDrawPoint.y,5.5,0,Math.PI*2);drawCtx.fillStyle='#111';drawCtx.fill();
  });
  drawCanvas.addEventListener('pointermove',e=>{
    if(!drawing)return;
    const cur=drawCoord(e);drawCtx.beginPath();drawCtx.moveTo(previousDrawPoint.x,previousDrawPoint.y);drawCtx.lineTo(cur.x,cur.y);
    drawCtx.lineWidth=11;drawCtx.lineCap='round';drawCtx.lineJoin='round';drawCtx.strokeStyle='#111';drawCtx.stroke();previousDrawPoint=cur;
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])drawCanvas.addEventListener(type,()=>drawing=false);
  $('clearDrawing').addEventListener('click',()=>drawCtx.clearRect(0,0,350,350));
  $('closeDraw').addEventListener('click',()=>$('drawDialog').close());
  $('saveDrawing').addEventListener('click',async()=>{
    const pixels=drawCtx.getImageData(0,0,350,350).data;
    const dataUrl=imageGlyph(pixels,350,350,true);
    if(!dataUrl){toast('글자를 먼저 써주세요.');return;}
    await saveGlyphs([{char:pendingChar,dataUrl}]);$('drawDialog').close();renderLetter();toast(`'${pendingChar}' 글자를 등록했어요!`);
  });
  // Controls / backup / reset
  function syncRange(id,property,suffix=''){
    const element=$(id),label=$(id+'Label');
    element.addEventListener('input',()=>{
      settings[property]=Number(element.value);label.textContent=element.value+suffix;renderLetter();
    });
  }
  syncRange('fontSize','size','px');syncRange('letterSpacing','spacing','px');syncRange('naturalness','naturalness');
  $('editorText').addEventListener('input',()=>{renderLetter();renderMissing();});
  let fontDownloadUrl=null,lastFontFace=null;
  $('samplePreview').addEventListener('click',()=>{
    const examples=[];
    const candidates='오늘도 좋은 하루 보내세요 사랑하는 우리 가족과 함께 걷는 길 마음 가득 기쁜 봄 햇살 꽃잎 한글 편지'+Array.from({length:11172},(_,i)=>String.fromCharCode(0xac00+i)).join('');
    for(const ch of candidates){
      if(examples.length===8)break;
      if(H.parts(ch)&&!glyphData.has(ch)&&!examples.includes(ch)&&samples.layout(ch))examples.push(ch);
    }
    if(!examples.length){$('samplePreviewStatus').textContent='아직 조합할 자모가 부족해요. 다음 칸도 채워주세요.';return;}
    const preview=document.createElement('canvas');preview.width=examples.length*82;preview.height=88;
    const ctx=preview.getContext('2d');
    examples.forEach((ch,i)=>ctx.drawImage(getTintedGlyph(ch),i*82,4,80,80));
    preview.style.maxWidth='100%';preview.style.height='auto';preview.setAttribute('aria-label',examples.join(' '));
    $('samplePreviewStatus').replaceChildren('직접 쓰지 않은 글자 · '+examples.join(' '),document.createElement('br'),preview);
  });
  $('generateTtf').addEventListener('click',async()=>{
    const button=$('generateTtf'),status=$('ttfStatus');
    const missing=[...H.initials,...H.basicVowels].filter(ch=>!glyphData.has(ch));
    const remaining=samples.samples.filter(c=>!glyphData.has(c));
    if(missing.length&&remaining.length){status.textContent=`완성 글자 ${remaining.length}칸을 더 작성해 주세요. 다음 글자: ${remaining.slice(0,6).join(' ')}`;return;}
    button.disabled=true;$('downloadTtf').hidden=true;$('ttfPreview').hidden=true;
    try {
      const family=$('fontFamilyName').value.trim()||'나의 필체';
      const snapshot=[...glyphData.entries()],outlines=new Map();
      status.textContent='손글씨 윤곽을 만드는 중…';
      const cv=document.createElement('canvas');cv.width=cv.height=128;const cx=cv.getContext('2d');
      for(let i=0;i<snapshot.length;i++) {
        const [ch,url]=snapshot[i],image=new Image();
        await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error(`‘${ch}’ 이미지를 읽지 못했어요. 다시 써주세요.`));image.src=url;});
        cx.clearRect(0,0,128,128);cx.drawImage(image,0,0,128,128);
        const contours=window.PilcheFont.trace(cx.getImageData(0,0,128,128).data);
        if(contours.length)outlines.set(ch,contours);
        if(i%8===0)await new Promise(r=>setTimeout(r,0));
      }
      const measuredPlans=new Map();
      for(let cp=0xac00;cp<=0xd7a3;cp++){const ch=String.fromCharCode(cp);if(outlines.has(ch))continue;const plan=samples.layout(ch);if(plan)measuredPlans.set(ch,plan);else if(missing.length)throw new Error(`‘${ch}’의 자모 분리가 어려워요. ${H.parts(ch).filter(Boolean).join(' · ')} 획 사이에 여백을 두고 해당 용지를 확인해 주세요.`);}
      for(const [key,tile] of samples.images)outlines.set(key,window.PilcheFont.trace(tile.getContext('2d').getImageData(0,0,128,128).data));
      const result=await window.PilcheFont.build({glyphs:outlines,H,family,measuredPlans,progress:p=>{status.textContent=`한글 폰트 만드는 중… ${p}%`;}});
      const face=new FontFace('PilchePreview'+Date.now(),result.buffer);await face.load();
      if(lastFontFace)document.fonts.delete(lastFontFace);document.fonts.add(face);lastFontFace=face;
      if(fontDownloadUrl)URL.revokeObjectURL(fontDownloadUrl);
      fontDownloadUrl=URL.createObjectURL(new Blob([result.buffer],{type:'font/ttf'}));
      const link=$('downloadTtf');link.href=fontDownloadUrl;link.download=family.replace(/[\\/:*?"<>|]/g,'_')+'.ttf';link.hidden=false;
      $('ttfPreview').style.fontFamily=`"${face.family}", sans-serif`;$('ttfPreview').textContent=$('editorText').value||'나의 손글씨로 쓰는 오늘';$('ttfPreview').hidden=false;
      status.textContent=`✓ ‘${family}’ TTF 생성·폰트 로딩 확인 완료. 아래 버튼으로 파일을 저장하세요. (한글 11,172자 포함)`;
    } catch(e) {status.textContent=e.message||'폰트를 만들지 못했어요. 다시 시도해 주세요.';}
    finally {button.disabled=false;}
  });
  document.querySelectorAll('.swatch').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('.swatch').forEach(btn=>btn.classList.remove('selected'));
    b.classList.add('selected');settings.color=b.dataset.color;clearTintCache();renderLetter();
  }));
  document.querySelectorAll('.paper-option').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('.paper-option').forEach(btn=>btn.classList.remove('selected'));
    b.classList.add('selected');settings.paper=b.dataset.paper;renderLetter();
  }));
  $('downloadPng').addEventListener('click',()=>{
    renderLetter();$('letterCanvas').toBlob(blob=>{
      if(!blob){toast('이미지를 저장할 수 없어요.');return;}
      downloadBlob(blob,'나의_손글씨_편지.png');toast('손글씨 PNG 파일이 저장되었어요.');
    },'image/png');
  });
  function exportBackup(){
    const backup={type:'pilche-lab-glyph-backup',version:1,createdAt:new Date().toISOString(),pageStats,glyphs:Object.fromEntries(glyphData)};
    downloadBlob(new Blob([JSON.stringify(backup)],{type:'application/json'}),'나의_손글씨_백업.json');toast('손글씨 백업을 다운로드했어요.');
  }
  $('exportBackup').addEventListener('click',exportBackup);$('exportBackupTop').addEventListener('click',exportBackup);
  $('importBackup').addEventListener('change',async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try{
      const parsed=JSON.parse(await file.text());
      if(parsed.type!=='pilche-lab-glyph-backup'||!parsed.glyphs||typeof parsed.glyphs!=='object')throw new Error('필체연구소 백업 형식이 아니에요.');
      const items=Object.entries(parsed.glyphs).filter(([ch,url])=>ch.length>0&&ch.length<=2&&typeof url==='string'&&url.startsWith('data:image/png;base64,')).map(([char,dataUrl])=>({char,dataUrl}));
      await saveGlyphs(items);
      if(Array.isArray(parsed.pageStats)){for(let i=0;i<3;i++)pageStats[i]=parsed.pageStats[i]||null;localStorage.setItem('pilche-page-stats',JSON.stringify(pageStats));}
      updateCoverage();renderLetter();toast(`백업에서 글자 ${items.length}개를 복구했어요.`);
      window.dispatchEvent(new Event('pilche-guide-refresh'));
    }catch(err){toast(err.message||'백업을 불러오지 못했어요.');}
    e.target.value='';
  });
  $('clearData').addEventListener('click',async()=>{
    if(!confirm('등록된 손글씨를 모두 삭제할까요? 먼저 JSON 백업을 받는 것을 추천해요.'))return;
    if(db){await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
    samples.reset();glyphData.clear();glyphImages.clear();clearTintCache();
    for(let i=0;i<3;i++)pageStats[i]=null;
    localStorage.removeItem('pilche-page-stats');updateCoverage();renderLetter();toast('등록된 손글씨가 초기화되었어요.');
    window.dispatchEvent(new Event('pilche-guide-refresh'));
  });
  // Mini printed sheet display preview.
  for(const ch of LAYOUT.pages[0]){
    const el=document.createElement('div');el.textContent=ch;$('miniGrid').appendChild(el);
  }
  document.querySelectorAll('.side-nav a').forEach(a=>a.addEventListener('click',()=>{
    document.querySelectorAll('.side-nav a').forEach(x=>x.classList.remove('active'));a.classList.add('active');
  }));
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('./sw.js').catch(err=>console.info('Offline installation is not available:',err));
  }
  async function eraseGlyph(ch) {
    if(db) await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(ch);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
    samples.forget(ch);glyphData.delete(ch);glyphImages.delete(ch);clearTintCache();updateCoverage();renderLetter();
  }
  initDb().finally(()=>{updateCoverage();renderLetter();window.initDigitalGuide({H,LAYOUT,glyphData,saveGlyphs,eraseGlyph,imageGlyph,toast,isPersistent:()=>!!db});});
})();
