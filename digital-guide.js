window.initDigitalGuide = ({H,LAYOUT,glyphData,saveGlyphs,eraseGlyph,imageGlyph,toast,isPersistent}) => {
  const $ = id=>document.getElementById(id);
  const pages=[];
  function addPages(title,chars,size) {
    for(let i=0;i<chars.length;i+=size) pages.push({title:`${title} ${Math.floor(i/size)+1}`,chars:chars.slice(i,i+size)});
  }
  addPages('완성 글자',window.SampleInk.samples,10);
  addPages('기존 방식 · 자음',H.initials,10);
  addPages('기존 방식 · 모음',H.basicVowels,7);
  LAYOUT.pages.forEach((chars,i)=>addPages(`선택 · 완성 글자 용지 ${i+1}`,chars,12));
  let page=0, saving=Promise.resolve();
  const cells=new Map(),drafts=new Map(),dirty=new Set();
  let saveTimer, focusIndex=0, movedTile, placeholder;
  const dialog=$('focusPad');
  function restoreTile(){
    if(placeholder?.isConnected)placeholder.replaceWith(movedTile);
    placeholder=null;movedTile=null;
  }
  function displayFocus(){
    restoreTile();
    const chars=pages[page].chars,ch=chars[focusIndex];
    movedTile=cells.get(ch).parentElement;placeholder=document.createComment('필기 칸');
    movedTile.replaceWith(placeholder);$('focusSurface').appendChild(movedTile);
    const example=$('focusExample'),ctx=example.getContext('2d');
    ctx.clearRect(0,0,420,120);ctx.fillStyle='#352d27';ctx.font='bold 80px sans-serif';ctx.fillText(ch,8,87);
    ctx.font='30px sans-serif';ctx.fillText(page<12?`${page*10+focusIndex+1} / 120`:`${focusIndex+1} / ${chars.length}`,126,76);
    example.setAttribute('aria-label',ch+' 작성');
    $('focusPrev').disabled=page===0&&focusIndex===0;
    $('focusNext').textContent=focusIndex===chars.length-1&&(page===11||page===pages.length-1)?'완료':'다음';
  }
  function exitFocus(){save();restoreTile();dialog.close();}
  function moveFocus(step){
    save();restoreTile();focusIndex+=step;
    if(focusIndex===pages[page].chars.length){
      if(page===11||page===pages.length-1){dialog.close();return;}
      page++;focusIndex=0;showPage();
    }else if(focusIndex<0){page--;focusIndex=pages[page].chars.length-1;showPage();}
    displayFocus();
  }
  $('openFocus').onclick=()=>{focusIndex=pages[page].chars.findIndex(ch=>!glyphData.has(ch)&&!dirty.has(ch));if(focusIndex<0)focusIndex=0;dialog.showModal();displayFocus();};
  $('focusPrev').onclick=()=>moveFocus(-1);$('focusNext').onclick=()=>moveFocus(1);
  $('focusUndo').onclick=()=>movedTile?.querySelector('.cell-heading button').click();
  $('closeFocus').onclick=exitFocus;
  dialog.addEventListener('cancel',e=>{e.preventDefault();exitFocus();});
  for(const name of ['selectstart','dragstart','contextmenu']){
    document.querySelector('.digital-guide').addEventListener(name,e=>e.preventDefault());
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
  window.addEventListener('pagehide',()=>save());
  for(let i=0;i<pages.length;i++) {
    const option=document.createElement('option');option.value=i;option.textContent=pages[i].title;
    $('guideTabs').appendChild(option);
  }
  $('pencilOnly').checked=localStorage.getItem('pilche-pencil-only')==='true';
  $('pencilOnly').addEventListener('change',()=>localStorage.setItem('pilche-pencil-only',$('pencilOnly').checked));
  function save() {
    clearTimeout(saveTimer);
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
    }).catch(()=>{$('guideSaveStatus').textContent='저장하지 못했어요. 칸에 다시 써주세요.';return false;});
    return saving;
  }
  function showPage() {
    cells.clear();$('digitalGrid').replaceChildren();$('guideTabs').value=String(page);
    $('guideHelp').textContent=page<12 ? '한 칸에 완성된 글자 하나를 평소처럼 써주세요. 3페이지(30자) 뒤 문장 써보기에서 조합 결과를 확인하세요.' : page<16 ? '예시와 같은 자음·모음을 빈 칸에 크게 써주세요. 획을 마치면 자동 저장돼요. 화면을 넘기려면 칸 바깥을 밀어주세요.' : '완성 글자는 선택 사항이에요. 자주 쓰는 글자를 통째로 쓰면 조합 없이 원본 글씨를 사용해요.';
    for(const ch of pages[page].chars) {
      const tile=document.createElement('div');tile.className='digital-cell';
      const heading=document.createElement('div');heading.className='cell-heading';
      const label=document.createElement('strong');label.textContent=ch;
      const actions=document.createElement('div');
      const undo=document.createElement('button');undo.textContent='획 취소';undo.type='button';undo.setAttribute('aria-label',`${ch} 마지막 획 취소`);
      const clear=document.createElement('button');clear.textContent='다시 쓰기';clear.type='button';clear.setAttribute('aria-label',`${ch} 다시 쓰기`);
      actions.append(undo,clear);heading.append(label,actions);
      const cv=document.createElement('canvas');cv.width=cv.height=350;cv.setAttribute('aria-label',`${ch} 필기 칸`);
      // The guide is a painted CSS background, outside the saved ink bitmap.
      const guide=document.createElementNS('http://www.w3.org/2000/svg','svg');
      guide.setAttribute('viewBox','0 0 350 350');
      const reference=document.createElementNS(guide.namespaceURI,'text');
      for(const [name,value] of Object.entries({x:175,y:267,'text-anchor':'middle','font-family':'sans-serif','font-size':254,'font-weight':400,fill:'#dcd6cf'})){
        reference.setAttribute(name,String(value));
      }
      reference.textContent=ch;guide.appendChild(reference);
      const guideUrl='data:image/svg+xml,'+encodeURIComponent(new XMLSerializer().serializeToString(guide));
      cv.style.setProperty('--letter-guide','url("'+guideUrl+'")');
      const cx=cv.getContext('2d');let active=null,previous=null,history=[],touched=false;
      const initial=drafts.get(ch)||glyphData.get(ch);
      if(initial){const img=new Image();img.onload=()=>{if(!touched)cx.drawImage(img,0,0,350,350);};img.src=initial;}
      let rect;
      const coord=e=>({x:(e.clientX-rect.left)*350/rect.width,y:(e.clientY-rect.top)*350/rect.height});
      const width=e=>e.pointerType==='pen'?3+Math.max(.1,e.pressure)*10:7;
      const remember=()=>{const copy=document.createElement('canvas');copy.width=copy.height=350;copy.getContext('2d').drawImage(cv,0,0);history.push(copy);if(history.length>12)history.shift();};
      cv.addEventListener('pointerdown',e=>{
        if(active!==null || ($('pencilOnly').checked && e.pointerType!=='pen') || (dialog.open&&e.pointerType==='touch'))return;
        clearTimeout(saveTimer);rect=cv.getBoundingClientRect();
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
      const finish=e=>{if(active!==e.pointerId)return;active=null;dirty.add(ch);clearTimeout(saveTimer);saveTimer=setTimeout(save,850);};
      for(const type of ['pointerup','pointercancel','lostpointercapture'])cv.addEventListener(type,finish);
      undo.addEventListener('click',()=>{if(!history.length)return;touched=true;cx.clearRect(0,0,350,350);cx.drawImage(history.pop(),0,0);dirty.add(ch);save();});
      clear.addEventListener('click',()=>{touched=true;save();remember();cx.clearRect(0,0,350,350);drafts.delete(ch);$('guideSaveStatus').textContent='다시 써주세요. 새 획을 쓰면 이전 글씨를 교체해요.';});
      tile.append(heading,cv);$('digitalGrid').appendChild(tile);cells.set(ch,cv);
    }
  }
  $('saveGuide').addEventListener('click',()=>save().then(result=>{if(result!==false)toast('작성한 글씨를 저장했어요.');}));
  $('guideTabs').addEventListener('change',async e=>{const next=Number(e.target.value);await save();page=next;showPage();});
  $('nextGuide').addEventListener('click',async()=>{await save();page=(page+1)%pages.length;showPage();$('guideTabs').scrollIntoView({block:'start'});});
  window.addEventListener('pilche-guide-refresh',()=>{drafts.clear();dirty.clear();showPage();});
  showPage();
  if(location.hash==='#pen'){
    const unfinished=pages.slice(0,12).findIndex(sheet=>sheet.chars.some(ch=>!glyphData.has(ch)));
    if(unfinished>0){page=unfinished;showPage();}
    $('openFocus').click();
  }
};
