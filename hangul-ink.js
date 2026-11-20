/* Unicode modern Hangul decomposition and handwritten component placement. */
(() => {
  const initials = [...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'];
  const vowels = [...'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'];
  const finals = ['', ...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'];
  const compoundV = {'ㅘ':['ㅗ','ㅏ'],'ㅙ':['ㅗ','ㅐ'],'ㅚ':['ㅗ','ㅣ'],'ㅝ':['ㅜ','ㅓ'],'ㅞ':['ㅜ','ㅔ'],'ㅟ':['ㅜ','ㅣ'],'ㅢ':['ㅡ','ㅣ']};
  const compoundT = {'ㄳ':['ㄱ','ㅅ'],'ㄵ':['ㄴ','ㅈ'],'ㄶ':['ㄴ','ㅎ'],'ㄺ':['ㄹ','ㄱ'],'ㄻ':['ㄹ','ㅁ'],'ㄼ':['ㄹ','ㅂ'],'ㄽ':['ㄹ','ㅅ'],'ㄾ':['ㄹ','ㅌ'],'ㄿ':['ㄹ','ㅍ'],'ㅀ':['ㄹ','ㅎ'],'ㅄ':['ㅂ','ㅅ']};
  const basicVowels = vowels.filter(v => !compoundV[v]);
  function parts(ch) {
    const n = ch.codePointAt(0) - 0xac00;
    return n < 0 || n >= 11172 ? null : [initials[Math.floor(n / 588)], vowels[Math.floor(n / 28) % 21], finals[n % 28]];
  }
  function dependencies(ch) {
    const p = parts(ch);
    return p ? [p[0], ...(compoundV[p[1]] || [p[1]]), ...(p[2] ? compoundT[p[2]] || [p[2]] : [])] : [ch];
  }
  function compose(ch, lookup, createCanvas) {
    const p = parts(ch);
    if (!p || !dependencies(ch).every(c => lookup(c))) return null;
    const cv = createCanvas(); cv.width = cv.height = 128;
    const cx = cv.getContext('2d');
    const put = (c,x,y,w,h) => cx.drawImage(lookup(c),13,13,102,102,x,y,w,h);
    const [l,v,t] = p, height = t ? 76 : 110, top = 7;
    if (compoundV[v]) {
      const [horizontal, vertical] = compoundV[v];
      put(l,10,top,57,height * .63);
      put(horizontal,9,top + height * .72,67,height * .24);
      put(vertical,83,top,31,height);
    } else if ('ㅗㅛㅜㅠㅡ'.includes(v)) {
      put(l,22,top,83,height * .56);
      put(v,13,top + height * .68,102,height * .27);
    } else {
      put(l,10,top,57,height);
      put(v,80,top,34,height);
    }
    if (t) {
      const group = compoundT[t];
      if (group) {put(group[0],22,94,36,26);put(group[1],71,94,36,26);}
      else put(t,24,94,80,26);
    }
    return cv;
  }
  window.HangulInk = {initials,basicVowels,parts,dependencies,compose};
})();
