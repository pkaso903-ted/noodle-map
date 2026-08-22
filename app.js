(function(){
'use strict';
var CFG = window.NOODLE_CONFIG || {};
var LS = 'noodlemap.v1';
var DAY = ['일','월','화','수','목','금','토'];
var GENRES = ['라멘','우동·소바','국수·면','칼국수','냉면·막국수','기타 면요리'];
var GEMOJI = {'라멘':'🍜','우동·소바':'🥢','국수·면':'🍲','칼국수':'🥟','냉면·막국수':'🧊','기타 면요리':'🍝'};
var GCOLOR = {'라멘':'#ff6b35','우동·소바':'#4ea8de','국수·면':'#31c48d','칼국수':'#c084fc','냉면·막국수':'#22d3ee','기타 면요리':'#f472b6'};
var AXES = [
 {k:'soup', n:'국물·육수', d:'깊이, 간, 온도'},
 {k:'noodle', n:'면', d:'식감, 삶기, 굵기 궁합'},
 {k:'topping', n:'토핑·고명', d:'차슈, 계란, 채소 완성도'},
 {k:'value', n:'가성비', d:'가격 대비 만족'},
 {k:'again', n:'재방문 의사', d:'또 오고 싶은가'}
];
var PLACES = [], MY = {}, MAP = null, MARKERS = [], PROVIDER = null, MYPOS = null, CUR = null;
var F = {q:'', g:[], a:[], flag:[], sort:'reco'};

function $(s){return document.querySelector(s);}
function el(t,c,h){var e=document.createElement(t); if(c)e.className=c; if(h!=null)e.innerHTML=h; return e;}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function toast(m){var t=$('#toast'); t.textContent=m; t.classList.add('on'); clearTimeout(t._t); t._t=setTimeout(function(){t.classList.remove('on');},1900);}
function loadMy(){ try{ MY = JSON.parse(localStorage.getItem(LS)||'{}'); }catch(e){ MY={}; } }
function saveMy(){ try{ localStorage.setItem(LS, JSON.stringify(MY)); }catch(e){ toast('저장 실패'); } }
function myScore(id){ var r=MY[id]; if(!r)return null; var s=0,c=0; AXES.forEach(function(a){ if(r[a.k]>0){s+=r[a.k];c++;} }); return c? Math.round(s/c*20) : null; }

function hm(t){ if(!t) return null; var p=t.split(':'); return (+p[0])*60+(+p[1]); }
function todayEntry(p, now){
 if(!p.h||!p.h.days) return null;
 var dch = DAY[now.getDay()];
 var e = null;
 for(var i=0;i<p.h.days.length;i++){ var d=p.h.days[i]; if(d.d===dch){ e=d; break; } }
 if(!e){ for(var j=0;j<p.h.days.length;j++){ if(p.h.days[j].d==='매일'){ e=p.h.days[j]; break; } } }
 return e;
}
function openState(p, now){
 now = now || new Date();
 var e = todayEntry(p, now);
 if(!e) return {s:'unknown', t:'영업정보 없음', hh:''};
 if(!e.s || /휴무/.test(e.note||'')) return {s:'closed', t:'오늘 휴무', hh:''};
 var cur = now.getHours()*60+now.getMinutes();
 var st = hm(e.s), en = hm(e.e);
 if(en!=null && en<st) en += 1440;
 var hh = (e.s||'')+'~'+(e.e||'');
 if(cur < st) return {s:'closed', t:'영업 전', sub:e.s+' 오픈', hh:hh};
 if(cur > en) return {s:'closed', t:'영업 종료', sub:'', hh:hh};
 for(var i=0;i<(e.br||[]).length;i++){
  var b=e.br[i].split('-'); var bs=hm(b[0]), be=hm(b[1]);
  if(cur>=bs && cur<be) return {s:'break', t:'브레이크타임', sub:b[1]+' 재오픈', hh:hh};
 }
 var left = en - cur;
 return {s:'open', t:'영업중', sub: left<=60 ? (left+'분 뒤 마감') : ((e.e||'')+' 마감'), hh:hh};
}
function hoursText(p){
 if(!p.h||!p.h.days||!p.h.days.length) return '정보 없음';
 return p.h.days.map(function(d){
  var v = d.s ? (d.s+'~'+d.e + ((d.br&&d.br.length)?(' · 브레이크 '+d.br.join(',')):'')) : (d.note||'휴무');
  return d.d+' '+v;
 }).join('\n');
}
function dist(p){ if(!MYPOS) return null; var R=6371, dLat=(p.y-MYPOS.lat)*Math.PI/180, dLon=(p.x-MYPOS.lng)*Math.PI/180; var a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(MYPOS.lat*Math.PI/180)*Math.cos(p.y*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2); return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))*1000; }
function reco(p){ var s=(p.sc||4)*10; s += Math.log10((p.vr||0)+(p.br||0)+1)*9; if(p.mich) s+=14; if(p.tv&&p.tv.length) s+=4; var m=myScore(p.id); if(m!=null) s+=(m-70)/6; return s; }
function minPrice(p){ if(!p.m||!p.m.length) return null; return Math.min.apply(null,p.m.map(function(x){return x.p;})); }

function filtered(){
 var q = F.q.trim().toLowerCase();
 var now = new Date();
 var out = PLACES.filter(function(p){
  if(F.g.length && F.g.indexOf(p.g)<0) return false;
  if(F.a.length && F.a.indexOf(p.a)<0) return false;
  if(F.flag.indexOf('mich')>=0 && !p.mich) return false;
  if(F.flag.indexOf('tv')>=0 && !(p.tv&&p.tv.length)) return false;
  if(F.flag.indexOf('open')>=0){ var o=openState(p,now); if(o.s!=='open') return false; }
  if(F.flag.indexOf('visited')>=0 && !MY[p.id]) return false;
  if(F.flag.indexOf('new')>=0 && MY[p.id]) return false;
  if(q){
   var hay = (p.n+' '+p.g+' '+p.a+' '+p.cat+' '+p.ad+' '+(p.mi||'')+' '+(p.kw||[]).join(' ')+' '+(p.m||[]).map(function(x){return x.n;}).join(' ')).toLowerCase();
   if(hay.indexOf(q)<0) return false;
  }
  return true;
 });
 var s=F.sort;
 out.sort(function(a,b){
  if(s==='score') return (b.sc||0)-(a.sc||0);
  if(s==='review') return ((b.vr+b.br)-(a.vr+a.br));
  if(s==='name') return a.n.localeCompare(b.n,'ko');
  if(s==='my'){ var ma=myScore(a.id), mb=myScore(b.id); if(ma==null&&mb==null) return reco(b)-reco(a); if(ma==null) return 1; if(mb==null) return -1; return mb-ma; }
  if(s==='dist'){ var da=dist(a), db=dist(b); if(da==null||db==null) return reco(b)-reco(a); return da-db; }
  return reco(b)-reco(a);
 });
 return out;
}

function badges(p){
 var h=[];
 if(p.mich) h.push('<span class="badge b-mich">미쉐린 '+esc(p.mich.year)+(p.mich.bib?' 빕구르망':'')+'</span>');
 if(p.tv&&p.tv.length) h.push('<span class="badge b-tv">'+esc(p.tv[0].p)+'</span>');
 var m=myScore(p.id);
 if(m!=null) h.push('<span class="badge b-my">내 '+m+'점</span>');
 return h.join('');
}
function cardHtml(p){
 var o = openState(p);
 var cls = o.s==='open'?'open-y':(o.s==='break'?'open-b':'open-n');
 var d = dist(p);
 var mp = minPrice(p);
 return '<img class="card-img" loading="lazy" src="'+esc(p.img||'')+'" alt="">'
  +'<div class="card-body">'
  +'<div class="card-t"><span class="card-n">'+esc(p.n)+'</span>'+badges(p)+'</div>'
  +'<div class="card-sub"><span>'+GEMOJI[p.g]+' '+esc(p.g)+'</span><span>'+esc(p.a)+'</span>'+(d!=null?('<span>'+(d<1000?Math.round(d)+'m':(d/1000).toFixed(1)+'km')+'</span>'):'')+'</div>'
  +'<div class="card-meta"><span class="star">★ '+(p.sc!=null?p.sc:'-')+'</span><span class="rev">리뷰 '+((p.vr+p.br).toLocaleString())+'</span>'+(mp?('<span class="rev">'+mp.toLocaleString()+'원~</span>'):'')+'<span class="'+cls+'">'+esc(o.t)+'</span>'+(o.hh?('<span class="rev">'+esc(o.hh)+'</span>'):'')+'</div>'
  +(p.mi?('<div class="card-desc">'+esc(p.mi)+'</div>'):'')
  +'</div>';
}
function renderList(){
 var arr = filtered();
 $('#listCount').textContent = arr.length+'곳';
 var box = $('#list'); box.innerHTML='';
 if(!arr.length){ box.appendChild(el('div','empty','조건에 맞는 가게가 없어.<br>필터를 조금 풀어봐.')); return; }
 var frag = document.createDocumentFragment();
 arr.forEach(function(p){ var c=el('div','card',cardHtml(p)); c.onclick=function(){ openSheet(p.id); }; frag.appendChild(c); });
 box.appendChild(frag);
}

function renderChips(){
 var g=$('#chipsGenre'); g.innerHTML='';
 GENRES.forEach(function(x){ var b=el('button','chip'+(F.g.indexOf(x)>=0?' on':''), GEMOJI[x]+' '+x); b.onclick=function(){ var i=F.g.indexOf(x); if(i>=0)F.g.splice(i,1); else F.g.push(x); refresh(); }; g.appendChild(b); });
 var areas=[]; PLACES.forEach(function(p){ if(areas.indexOf(p.a)<0) areas.push(p.a); });
 areas.sort();
 var a=$('#chipsArea'); a.innerHTML='';
 areas.forEach(function(x){ var b=el('button','chip'+(F.a.indexOf(x)>=0?' on':''), x); b.onclick=function(){ var i=F.a.indexOf(x); if(i>=0)F.a.splice(i,1); else F.a.push(x); refresh(); }; a.appendChild(b); });
 var flags=[['open','🟢 지금 영업중'],['mich','🏅 미쉐린'],['tv','📺 방송출연'],['visited','✅ 방문함'],['new','🆕 미방문']];
 var f=$('#chipsFlag'); f.innerHTML='';
 flags.forEach(function(x){ var b=el('button','chip flag'+(F.flag.indexOf(x[0])>=0?' on':''), x[1]); b.onclick=function(){ var i=F.flag.indexOf(x[0]); if(i>=0)F.flag.splice(i,1); else F.flag.push(x[0]); refresh(); }; f.appendChild(b); });
}

function naverUrl(p){ return 'https://map.naver.com/p/entry/place/'+p.id; }
function naverRoute(p){ return 'nmap://route/public?dlat='+p.y+'&dlng='+p.x+'&dname='+encodeURIComponent(p.n)+'&appname=noodlemap'; }
function naverSearchUrl(p){ return 'https://map.naver.com/p/search/'+encodeURIComponent(p.n); }

function sheetHtml(p){
 var o=openState(p), now=new Date(), tdc=DAY[now.getDay()];
 var r = MY[p.id]||{};
 var h=[];
 h.push('<img class="sh-hero" src="'+esc(p.img||'')+'" alt="">');
 h.push('<div class="sh-n">'+esc(p.n)+'</div>');
 h.push('<div class="card-t" style="margin-top:7px">'+badges(p)+'<span class="badge b-g">'+GEMOJI[p.g]+' '+esc(p.g)+'</span><span class="badge b-g">'+esc(p.a)+'</span></div>');
 h.push('<div class="sh-sub">'+esc(p.cat)+' · '+esc(p.ad)+'</div>');
 if(p.mi) h.push('<div class="sh-sub" style="color:#c9c9d6;margin-top:6px">“'+esc(p.mi)+'”</div>');
 h.push('<div class="card-meta" style="margin-top:10px"><span class="star">★ '+(p.sc!=null?p.sc:'-')+'</span><span class="rev">방문 '+p.vr.toLocaleString()+' · 블로그 '+p.br.toLocaleString()+'</span><span class="'+(o.s==='open'?'open-y':(o.s==='break'?'open-b':'open-n'))+'">'+esc(o.t)+(o.sub?(' · '+esc(o.sub)):'')+'</span></div>');
 h.push('<div class="sh-row"><a class="sh-btn pri" href="'+naverUrl(p)+'" target="_blank" rel="noopener">네이버 지도</a>'
  +'<a class="sh-btn" href="'+naverSearchUrl(p)+'" target="_blank" rel="noopener">길찾기</a>'
  +(p.ph?('<a class="sh-btn" href="tel:'+esc(p.ph)+'">전화</a>'):'')+'</div>');
 h.push('<div class="sec"><div class="sec-t">영업시간</div>');
 if(p.h&&p.h.days.length){
  p.h.days.forEach(function(d){
   var isT = (d.d===tdc)||(d.d==='매일');
   var v = d.s ? (d.s+' ~ '+d.e+((d.br&&d.br.length)?('<br><small style="color:#6e6e80">브레이크 '+d.br.join(', ')+'</small>'):'')) : ('<span style="color:#8a8a99">'+esc(d.note||'휴무')+'</span>');
   h.push('<div class="kv'+(isT?' today':'')+'"><b>'+esc(d.d)+(isT?' (오늘)':'')+'</b><span>'+v+'</span></div>');
  });
 } else { h.push('<div class="kv"><b>정보</b><span>등록된 영업시간 없음</span></div>'); }
 if(p.h&&p.h.free) h.push('<div class="notebox">📢 '+esc(p.h.free)+'</div>');
 if(p.h&&p.h.irr&&p.h.irr.length) h.push('<div class="notebox">🚫 임시휴무 '+esc(p.h.irr.join(', '))+'</div>');
 h.push('</div>');
 if(p.m&&p.m.length){
  h.push('<div class="sec"><div class="sec-t">대표 메뉴</div>');
  p.m.forEach(function(m){ h.push('<div class="kv"><b>'+esc(m.n)+'</b><span>'+m.p.toLocaleString()+'원</span></div>'); });
  h.push('</div>');
 }
 if(p.tv&&p.tv.length){
  h.push('<div class="sec"><div class="sec-t">방송 출연</div>');
  p.tv.forEach(function(t){ h.push('<div class="kv"><b>'+esc(t.c||'')+' '+esc(t.p||'')+'</b><span>'+esc(t.d||'')+(t.m?(' · '+esc(t.m)):'')+'</span></div>'); });
  h.push('</div>');
 }
 if(p.mich) h.push('<div class="sec"><div class="sec-t">미쉐린 가이드</div><div class="kv"><b>'+esc(p.mich.year)+' '+(p.mich.bib?'빕구르망':'셀렉티드')+'</b><span><a style="color:#e5b95c" href="'+esc(p.mich.url)+'" target="_blank" rel="noopener">가이드 보기 ↗</a></span></div></div>');
 if(p.kw&&p.kw.length) h.push('<div class="sec"><div class="sec-t">키워드</div><div class="kwbox">'+p.kw.map(function(k){return '<span>#'+esc(k)+'</span>';}).join('')+'</div></div>');
 h.push('<div class="sec"><div class="sec-t">내 평가표</div><div id="rateBox">');
 AXES.forEach(function(ax){
  var v = r[ax.k]||0;
  var st=[];
  for(var i=1;i<=5;i++) st.push('<button data-k="'+ax.k+'" data-v="'+i+'" class="'+(i<=v?'on':'')+'">★</button>');
  h.push('<div class="rate-row"><div class="rate-lb">'+ax.n+'<em>'+ax.d+'</em></div><div class="stars">'+st.join('')+'</div></div>');
 });
 h.push('</div>');
 var ms = myScore(p.id);
 h.push('<div class="total"><b>총점 (100점 환산)</b><i id="totalNum">'+(ms!=null?ms:'--')+'<small> 점</small></i></div>');
 h.push('<div class="fld"><label>방문일</label><input id="fVisit" type="date" value="'+esc(r.date||'')+'"></div>');
 h.push('<div class="fld"><label>웨이팅 (분)</label><input id="fWait" type="number" min="0" placeholder="0" value="'+esc(r.wait!=null?r.wait:'')+'"></div>');
 h.push('<div class="fld"><label>먹은 메뉴</label><input id="fMenu" type="text" placeholder="예: 이에케라멘 + 차슈추가" value="'+esc(r.menu||'')+'"></div>');
 h.push('<div class="fld"><label>한줄평</label><textarea id="fMemo" rows="3" placeholder="기억하고 싶은 포인트">'+esc(r.memo||'')+'</textarea></div>');
 h.push('<div class="savebar"><button class="bt-save" id="btSave">저장</button>'+(MY[p.id]?'<button class="bt-del" id="btDel">삭제</button>':'')+'</div>');
 h.push('</div>');
 return h.join('');
}
function openSheet(id){
 var p = PLACES.filter(function(x){return x.id===id;})[0]; if(!p) return;
 CUR = p;
 $('#sheetBody').innerHTML = sheetHtml(p);
 $('#sheetBody').scrollTop = 0;
 var w=$('#sheetWrap'); w.hidden=false; requestAnimationFrame(function(){ w.classList.add('on'); });
 var draft = Object.assign({}, MY[id]||{});
 $('#rateBox').onclick = function(ev){
  var b = ev.target.closest('button'); if(!b) return;
  var k=b.dataset.k, v=+b.dataset.v;
  if(draft[k]===v) v=0;
  draft[k]=v;
  var row=b.parentNode.querySelectorAll('button');
  for(var i=0;i<row.length;i++) row[i].classList.toggle('on', (i+1)<=v);
  var s=0,c=0; AXES.forEach(function(a){ if(draft[a.k]>0){s+=draft[a.k];c++;} });
  $('#totalNum').innerHTML = (c? Math.round(s/c*20) : '--')+'<small> 점</small>';
 };
 $('#btSave').onclick = function(){
  var c=0; AXES.forEach(function(a){ if(draft[a.k]>0)c++; });
  if(!c){ toast('별점을 하나 이상 매겨줘'); return; }
  draft.date = $('#fVisit').value; draft.wait = $('#fWait').value===''?null:+$('#fWait').value;
  draft.menu = $('#fMenu').value; draft.memo = $('#fMemo').value; draft.ts = Date.now();
  MY[id]=draft; saveMy(); toast('저장했어 · 총 '+myScore(id)+'점'); closeSheet(); refresh();
 };
 if($('#btDel')) $('#btDel').onclick = function(){ if(confirm('이 가게 평가를 지울까?')){ delete MY[id]; saveMy(); toast('삭제했어'); closeSheet(); refresh(); } };
}
function closeSheet(){ var w=$('#sheetWrap'); w.classList.remove('on'); setTimeout(function(){ w.hidden=true; }, 280); }

function renderMy(){
 var ids = Object.keys(MY);
 var box=$('#myStats'), list=$('#myList');
 if(!ids.length){ box.innerHTML=''; list.innerHTML=''; list.appendChild(el('div','empty','아직 평가한 가게가 없어.<br>가게를 열어서 별점을 매겨봐.')); return; }
 var scores = ids.map(function(i){return myScore(i);}).filter(function(v){return v!=null;});
 var avg = scores.length? Math.round(scores.reduce(function(a,b){return a+b;},0)/scores.length) : 0;
 var best = 0; ids.forEach(function(i){ var s=myScore(i); if(s>best) best=s; });
 box.innerHTML = '<div class="stats"><div class="stat"><b>'+ids.length+'</b><span>방문 가게</span></div>'
  +'<div class="stat"><b>'+avg+'</b><span>평균 점수</span></div>'
  +'<div class="stat"><b>'+best+'</b><span>최고 점수</span></div></div>';
 var byG={};
 ids.forEach(function(i){ var p=PLACES.filter(function(x){return x.id===i;})[0]; if(!p)return; var s=myScore(i); if(s==null)return; (byG[p.g]=byG[p.g]||[]).push(s); });
 var gh=['<div class="gbar"><div class="sec-t">장르별 내 평균</div>'];
 Object.keys(byG).forEach(function(g){ var a=byG[g]; var m=Math.round(a.reduce(function(x,y){return x+y;},0)/a.length);
  gh.push('<div class="gbar-row"><b>'+GEMOJI[g]+' '+g+'</b><div class="gbar-bg"><div class="gbar-fill" style="width:'+m+'%"></div></div><span>'+m+'점</span></div>'); });
 gh.push('</div>');
 box.innerHTML += gh.join('');
 var arr = ids.map(function(i){ return PLACES.filter(function(x){return x.id===i;})[0]; }).filter(Boolean);
 arr.sort(function(a,b){ return (myScore(b.id)||0)-(myScore(a.id)||0); });
 list.innerHTML='';
 arr.forEach(function(p){
  var r=MY[p.id];
  var c=el('div','card', cardHtml(p) );
  if(r.memo){ var d=el('div','card-desc'); }
  c.onclick=function(){ openSheet(p.id); };
  list.appendChild(c);
 });
}

function renderInfo(){
 var n = Object.keys(MY).length;
 $('#infoBody').innerHTML = ''
  +'<div class="infosec"><h3>📱 홈 화면에 추가</h3>'
  +'<p><b>아이폰(Safari)</b></p><ol><li>하단 공유 버튼 <b>⬆️</b> 탭</li><li>“홈 화면에 추가” 선택</li><li>“추가” 탭</li></ol>'
  +'<p style="margin-top:10px"><b>안드로이드(Chrome)</b></p><ol><li>우측 상단 <b>⋮</b> 탭</li><li>“홈 화면에 추가” 또는 “앱 설치” 선택</li></ol>'
  +'<button class="infobtn pri" id="btInstall" style="display:none">앱으로 설치하기</button></div>'
  +'<div class="infosec"><h3>💾 내 평가 백업</h3><p>평가 기록은 이 브라우저에만 저장돼. 폰을 바꾸거나 브라우저를 지우면 사라지니 가끔 백업해줘. 현재 <b>'+n+'곳</b> 저장됨.</p>'
  +'<button class="infobtn" id="btExport">JSON으로 내보내기</button>'
  +'<button class="infobtn" id="btImport">JSON 불러오기</button>'
  +'<input type="file" id="fileIn" accept="application/json" hidden></div>'
  +'<div class="infosec"><h3>🧮 평가 기준</h3><p>국물·면·토핑·가성비·재방문 5개 항목을 각각 5점 만점으로 매기면, 매긴 항목의 평균을 100점으로 환산해 총점이 나와. 항목을 일부만 채워도 평균으로 계산돼.</p></div>'
  +'<div class="infosec"><h3>📊 데이터</h3><p>네이버 지도 기준 · 총 <b>'+PLACES.length+'곳</b> · 기준일 <b>'+(window.__UPDATED||'')+'</b><br>범위: 연남 · 홍대(서교·동교) · 합정 · 망원 · 상수 · 성산<br>평점/리뷰수/영업시간/메뉴가격은 수집 시점 기준이라 실제와 다를 수 있어. 방문 전 네이버 지도에서 한 번 더 확인해줘.</p></div>'
  +'<div class="infosec"><h3>🗺️ 지도 엔진</h3><p id="engineTxt"></p></div>';
 $('#engineTxt').textContent = PROVIDER==='naver' ? '네이버 지도 API 사용중' : (PROVIDER==='leaflet' ? 'OpenStreetMap 사용중 (config.js에 네이버 키를 넣으면 네이버 지도로 바뀜)' : '지도 로딩 실패');
 $('#btExport').onclick = function(){
  var blob = new Blob([JSON.stringify({app:'noodlemap', v:1, exported:new Date().toISOString(), data:MY}, null, 2)], {type:'application/json'});
  var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='noodlemap-backup.json'; a.click();
  toast('백업 파일을 내려받았어');
 };
 $('#btImport').onclick = function(){ $('#fileIn').click(); };
 $('#fileIn').onchange = function(e){
  var f=e.target.files[0]; if(!f) return; var rd=new FileReader();
  rd.onload=function(){ try{ var j=JSON.parse(rd.result); var d=j.data||j; Object.keys(d).forEach(function(k){ MY[k]=d[k]; }); saveMy(); toast('불러왔어'); refresh(); renderInfo(); }catch(err){ toast('파일을 읽지 못했어'); } };
  rd.readAsText(f);
 };
 if(window.__deferredPrompt){ var b=$('#btInstall'); b.style.display='block'; b.onclick=function(){ window.__deferredPrompt.prompt(); }; }
}

function clearMarkers(){ MARKERS.forEach(function(m){ if(PROVIDER==='naver') m.setMap(null); else if(MAP&&m.remove) m.remove(); }); MARKERS=[]; }
function markerHtml(p, showName){
 var visited = !!MY[p.id];
 var cls = 'nmark' + (visited?' visited':'') + (p.mich?' mich':'');
 var style = visited ? '' : ' style="border-color:'+GCOLOR[p.g]+'"';
 return '<div class="'+cls+'"><div class="pin"'+style+'><em>'+GEMOJI[p.g]+'</em></div>'
  + (showName ? ('<div class="lb">'+esc(p.n)+'</div>') : '') + '</div>';
}
function drawMarkers(){
 if(!MAP) return;
 clearMarkers();
 var arr = filtered();
 $('#mapCount').textContent = arr.length + '곳 표시중';
 var showName = arr.length <= 28;
 arr.forEach(function(p){
  var html = markerHtml(p, showName);
  if(PROVIDER==='naver'){
   var mk = new naver.maps.Marker({ position:new naver.maps.LatLng(p.y,p.x), map:MAP, title:p.n,
     icon:{ content:html, anchor:new naver.maps.Point(0,0) } });
   naver.maps.Event.addListener(mk,'click',function(){ openSheet(p.id); });
   MARKERS.push(mk);
  } else {
   var mk2 = L.marker([p.y,p.x], { icon: L.divIcon({ className:'', html:html, iconSize:null }), title:p.n }).addTo(MAP);
   mk2.on('click', function(){ openSheet(p.id); });
   MARKERS.push(mk2);
  }
 });
 fitBounds(arr);
}
function fitBounds(arr){
 if(!MAP || !arr.length || arr.length===PLACES.length) return;
 var lat1=90,lat2=-90,lng1=180,lng2=-180;
 arr.forEach(function(p){ if(p.y<lat1)lat1=p.y; if(p.y>lat2)lat2=p.y; if(p.x<lng1)lng1=p.x; if(p.x>lng2)lng2=p.x; });
 try{
  if(PROVIDER==='naver'){ MAP.fitBounds(new naver.maps.LatLngBounds(new naver.maps.LatLng(lat1,lng1), new naver.maps.LatLng(lat2,lng2)), {top:170,right:50,bottom:110,left:50}); }
  else { MAP.fitBounds([[lat1,lng1],[lat2,lng2]], {paddingTopLeft:[40,170], paddingBottomRight:[40,110]}); }
 }catch(e){}
}
function initNaver(){
 MAP = new naver.maps.Map('map', { center:new naver.maps.LatLng(37.5595,126.9230), zoom:15, scaleControl:false, mapDataControl:false, logoControlOptions:{position:naver.maps.Position.BOTTOM_LEFT} });
 PROVIDER='naver'; drawMarkers();
}
function initLeaflet(){
 var l1=document.createElement('link'); l1.rel='stylesheet'; l1.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(l1);
 var s=document.createElement('script'); s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
 s.onload=function(){
  MAP = L.map('map',{zoomControl:false}).setView([37.5595,126.9230],15);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:19,attribution:'&copy; OSM &copy; CARTO'}).addTo(MAP);
  L.control.zoom({position:'bottomright'}).addTo(MAP);
  PROVIDER='leaflet'; drawMarkers();
 };
 s.onerror=function(){ $('#mapFallback').hidden=false; $('#mapFallback').innerHTML='지도를 불러오지 못했어.<br>리스트 탭을 이용해줘.'; };
 document.head.appendChild(s);
}
function initMap(){
 if(CFG.naverKeyId){
  var s=document.createElement('script');
  s.src='https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId='+encodeURIComponent(CFG.naverKeyId);
  s.onload=function(){ try{ initNaver(); }catch(e){ initLeaflet(); } };
  s.onerror=function(){ initLeaflet(); };
  document.head.appendChild(s);
 } else { initLeaflet(); }
}
function locate(){
 if(!navigator.geolocation){ toast('위치 기능을 쓸 수 없어'); return; }
 toast('위치 확인 중...');
 navigator.geolocation.getCurrentPosition(function(pos){
  MYPOS={lat:pos.coords.latitude, lng:pos.coords.longitude};
  if(MAP){ if(PROVIDER==='naver') MAP.setCenter(new naver.maps.LatLng(MYPOS.lat,MYPOS.lng)); else MAP.setView([MYPOS.lat,MYPOS.lng],16); }
  toast('현재 위치 기준으로 거리 표시'); refresh();
 }, function(){ toast('위치 권한이 필요해'); }, {enableHighAccuracy:true, timeout:8000});
}

function refresh(){ renderChips(); renderList(); renderMy(); drawMarkers(); }
function tab(name){
 ['map','list','my','info'].forEach(function(t){ $('#view-'+t).hidden = (t!==name); });
 var bs=document.querySelectorAll('#tabbar button');
 for(var i=0;i<bs.length;i++) bs[i].classList.toggle('on', bs[i].dataset.tab===name);
 var tb=$('#topbar');
 var showFilter = (name==='map'||name==='list');
 tb.style.display = showFilter ? 'block' : 'none';
 var h = showFilter ? tb.offsetHeight : 0;
 ['list','my','info'].forEach(function(t){ $('#view-'+t).style.paddingTop = (t==='list'? h : 12)+'px'; });
 $('#map').style.top = '0px';
 if(name==='info') renderInfo();
 if(name==='my') renderMy();
 if(name==='map' && MAP && PROVIDER==='leaflet') setTimeout(function(){ MAP.invalidateSize(); }, 60);
}

function boot(){
 loadMy();
 fetch('data.json?v=' + (window.__V||'1')).then(function(r){return r.json();}).then(function(j){
  PLACES = j.places; window.__UPDATED = j.updated;
  renderChips(); renderList(); initMap(); tab('map');
  setTimeout(function(){ $('#splash').classList.add('gone'); }, 250);
 }).catch(function(){ $('#splash').innerHTML='<div class="empty">데이터를 불러오지 못했어.<br>새로고침 해줘.</div>'; });
 $('#q').addEventListener('input', function(e){ F.q=e.target.value; $('#qClear').classList.toggle('on', !!F.q); renderList(); drawMarkers(); });
 $('#qClear').onclick=function(){ F.q=''; $('#q').value=''; $('#qClear').classList.remove('on'); renderList(); drawMarkers(); };
 $('#sortBy').onchange=function(e){ F.sort=e.target.value; renderList(); };
 $('#btnLoc').onclick=locate;
 $('#sheetDim').onclick=closeSheet;
 $('#sheetGrip').onclick=closeSheet;
 var bs=document.querySelectorAll('#tabbar button');
 for(var i=0;i<bs.length;i++) bs[i].onclick=(function(n){ return function(){ tab(n); }; })(bs[i].dataset.tab);
 window.addEventListener('beforeinstallprompt', function(e){ e.preventDefault(); window.__deferredPrompt=e; });
 if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function(){});
}
document.addEventListener('DOMContentLoaded', boot);
})();