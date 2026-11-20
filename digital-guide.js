window.initDigitalGuide = ({H,LAYOUT,glyphData,saveGlyphs,eraseGlyph,imageGlyph,toast,isPersistent}) => {
  const $ = id=>document.getElementById(id);
  const pages=[];
  function addPages(title,chars,size) {
    for(let i=0;i<chars.length;i+=size) pages.push({title:`${title} ${Math.floor(i/size)+1}`,chars:chars.slice(i,i+size)});
  }
  addPages('필수 · 자음',H.initials,10);
  addPages('필수 · 모음',H.basicVowels,7);
  LAYOUT.pages.forEach((chars,i)=>addPages(`선택 · 완성 글자 용지 ${i+1}`,chars,12));
  let page=0, saving=Promise.resolve();
  const cells=new Map(),drafts=new Map(),dirty=new Set();
  for(let i=0;i<pages.length;i++) {
    const option=document.createElement('option');option.value=i;option.textContent=pages[i].title;
    $('guideTabs').appendChild(option);
  }
  $('pencilOnly').checked=localStorage.getItem('pilche-pencil-only')==='true';
  $('pencilOnly').addEventListener('change',()=>localStorage.setItem('pilche-pencil-only',$('pencilOnly').checked));
  function save() {
    const items=[],empty=[];
    for(const ch of dirty) {
      const cv=cells.get(ch),url=cv && imageGlyph(cv.getContext('2d').getImageData(0,0,350,350).data,350,350,true);
      if(url) {items.push({char:ch,dataUrl:url});drafts.set(ch,cv.toDataURL());}
      else if(cv) {empty.push(ch);drafts.set(ch,cv.toDataURL());}
    }
    dirty.clear();
    if(!items.length&&!empty.length)return saving;
    $('guideSaveStatus').textContent='필체 저장 중…';
    saving=saving.then(async()=>{await saveGlyphs(items);for(const ch of empty)await eraseGlyph(ch);}).then(()=>{
      $('guideSaveStatus').textContent=isPersistent()?`✓ 저장 완료 · ${new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}`:'이 환경에서는 임시 보관돼요. 내 글씨 백업을 내려받아 주세요.';
    }).catch(()=>{$('guideSaveStatus').textContent='저장하지 못했어요. 칸에 다시 써주세요.';});
    return saving;
  }
  function showPage() {
    cells.clear();$('digitalGrid').replaceChildren();$('guideTabs').value=String(page);
    $('guideHelp').textContent=page<4 ? '예시와 같은 자음·모음을 빈 칸에 크게 써주세요. 획을 마치면 자동 저장돼요. 화면을 넘기려면 칸 바깥을 밀어주세요.' : '완성 글자는 선택 사항이에요. 자주 쓰는 글자를 통째로 쓰면 조합 없이 원본 글씨를 사용해요.';
    for(const ch of pages[page].chars) {
      const tile=document.createElement('div');tile.className='digital-cell';
      const heading=document.createElement('div');heading.className='cell-heading';
      const label=document.createElement('strong');label.textContent=ch;
      const actions=document.createElement('div');
      const undo=document.createElement('button');undo.textContent='획 취소';undo.type='button';undo.setAttribute('aria-label',`${ch} 마지막 획 취소`);
      const clear=document.createElement('button');clear.textContent='다시 쓰기';clear.type='button';clear.setAttribute('aria-label',`${ch} 다시 쓰기`);
      actions.append(undo,clear);heading.append(label,actions);
      const cv=document.createElement('canvas');cv.width=cv.height=350;cv.setAttribute('aria-label',`${ch} 필기 칸`);
      const cx=cv.getContext('2d');let active=null,previous=null,history=[],touched=false;
      const initial=drafts.get(ch)||glyphData.get(ch);
      if(initial){const img=new Image();img.onload=()=>{if(!touched)cx.drawImage(img,0,0,350,350);};img.src=initial;}
      const coord=e=>{const r=cv.getBoundingClientRect();return {x:(e.clientX-r.left)*350/r.width,y:(e.clientY-r.top)*350/r.height};};
      const width=e=>e.pointerType==='pen'?3+Math.max(.1,e.pressure)*10:7;
      const remember=()=>{history.push(cx.getImageData(0,0,350,350));if(history.length>12)history.shift();};
      cv.addEventListener('pointerdown',e=>{
        if(active!==null || ($('pencilOnly').checked && e.pointerType!=='pen'))return;
        e.preventDefault();touched=true;remember();active=e.pointerId;previous=coord(e);cv.setPointerCapture(active);
        cx.fillStyle='#181412';cx.beginPath();cx.arc(previous.x,previous.y,width(e)/2,0,Math.PI*2);cx.fill();
      });
      cv.addEventListener('pointermove',e=>{
        if(active!==e.pointerId)return;e.preventDefault();
        const samples=e.getCoalescedEvents?.();
        for(const sample of (samples?.length ? samples : [e])) {
          const p=coord(sample);cx.strokeStyle='#181412';cx.lineWidth=width(sample);cx.lineCap='round';cx.lineJoin='round';
          cx.beginPath();cx.moveTo(previous.x,previous.y);cx.lineTo(p.x,p.y);cx.stroke();previous=p;
        }
      });
      const finish=e=>{if(active!==e.pointerId)return;active=null;dirty.add(ch);save();};
      for(const type of ['pointerup','pointercancel','lostpointercapture'])cv.addEventListener(type,finish);
      undo.addEventListener('click',()=>{if(!history.length)return;touched=true;cx.putImageData(history.pop(),0,0);dirty.add(ch);save();});
      clear.addEventListener('click',()=>{touched=true;remember();cx.clearRect(0,0,350,350);drafts.delete(ch);$('guideSaveStatus').textContent='다시 써주세요. 새 획을 쓰면 이전 글씨를 교체해요.';});
      tile.append(heading,cv);$('digitalGrid').appendChild(tile);cells.set(ch,cv);
    }
  }
  $('saveGuide').addEventListener('click',()=>save().then(()=>toast('작성한 글씨를 저장했어요.')));
  $('guideTabs').addEventListener('change',async e=>{const next=Number(e.target.value);await save();page=next;showPage();});
  $('nextGuide').addEventListener('click',async()=>{await save();page=(page+1)%pages.length;showPage();$('guideTabs').scrollIntoView({block:'start'});});
  window.addEventListener('pilche-guide-refresh',()=>{drafts.clear();dirty.clear();showPage();});
  showPage();
};
