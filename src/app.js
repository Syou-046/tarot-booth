// 画面の流れ・扇の配置・アニメーション
const params=new URLSearchParams(location.search);
const BOOTH=params.get("booth")==="1";
const IDLE_MS=90000;

const $=id=>document.getElementById(id);
const fan=$("fan"),spreadEl=$("spread"),guide=$("guide");
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait=ms=>new Promise(r=>setTimeout(r,reduce?Math.min(ms,30):ms));

// 規則六: deck は [{id,rev}, …] で洗牌時に全定案。drawn は {id,rev,deckIdx}
let S={count:3,deck:[],drawn:[],flipped:0,target:0,extra:0,question:""};
let idleTimer=null;

function say(t){guide.style.opacity=0;setTimeout(()=>{guide.textContent=t;guide.style.opacity=1},200)}
function cardHTML(c){return `<div class="face back"></div><div class="face front${c.rev?" rev":""}"><img alt="${cardName(c.id).text}" src="${cardSrc(c.id)}"></div>`}

/* spread — 規則四: 牌位上不標名稱 */
function sizeSlots(){
  const n=spreadEl.children.length||1;
  const style=getComputedStyle(spreadEl);
  const gap=parseFloat(style.columnGap)||3;
  const pad=(parseFloat(style.paddingLeft)||0)+(parseFloat(style.paddingRight)||0);
  const byW=(spreadEl.clientWidth-pad-gap*(n-1))/n;
  const headerH=document.querySelector("header").getBoundingClientRect().height;
  const minTable=innerWidth<=600?Math.min(250,innerHeight*.34):Math.min(330,innerHeight*.42);
  const maxSpreadH=Math.max(96,innerHeight-headerH-minTable);
  const chrome=innerWidth<=600?30:40;
  const byH=(maxSpreadH-chrome)/(527/300);
  const cap=innerWidth<=600?82:innerWidth>=1500?112:98;
  const width=Math.max(27,Math.min(byW,byH,cap));
  document.documentElement.style.setProperty("--sw",width+"px");
}
function addSlot(extra){
  const i=spreadEl.children.length;
  spreadEl.insertAdjacentHTML("beforeend",
    `<div class="slot${extra?" extra":""}"><div class="slot-frame" id="frame${i}"></div><div class="slot-name" id="name${i}"></div></div>`);
  sizeSlots();
}
function buildSlots(){spreadEl.innerHTML="";for(let i=0;i<S.count;i++)addSlot(false)}

/* fan */
function renderFan(){
  const drawnIdx=new Set(S.drawn.map(d=>d.deckIdx));
  fan.innerHTML=S.deck.map((c,idx)=>{
    if(drawnIdx.has(idx))return "";
    return `<div class="fcard" tabindex="0" role="button" aria-label="カードを選ぶ" data-idx="${idx}"><div class="card">${cardHTML({id:c.id,rev:false})}</div></div>`;
  }).join("");
}
function fanLayout(mode){
  const W=fan.clientWidth,H=fan.clientHeight,cards=[...fan.children],n=cards.length;
  if(!n||!W||!H)return;

  const ratio=527/300;
  let rows=W<620?3:2;
  if(H<220)rows=2;
  const rowH=H/rows;
  const cap=W<620?54:W>1500?88:76;
  const cw=Math.max(24,Math.min(cap,rowH*.76/ratio));
  const ch=cw*ratio;
  document.documentElement.style.setProperty("--fw",cw+"px");

  if(mode==="stack"){
    cards.forEach(c=>{
      const x=Math.max(0,(W-cw)/2+(Math.random()-.5)*Math.min(22,W*.04));
      const y=Math.max(0,(H-ch)/2+(Math.random()-.5)*Math.min(14,H*.04));
      c.style.transform=`translate(${x}px,${y}px) rotate(${(Math.random()-.5)*14}deg)`;
    });
    return;
  }

  const base=Math.floor(n/rows),remainder=n%rows;
  let offset=0;
  for(let r=0;r<rows;r++){
    const count=base+(r<remainder?1:0);
    const side=Math.max(3,cw*.38);
    const span=Math.max(0,W-cw-side*2);
    const slack=Math.max(0,rowH-ch);
    for(let k=0;k<count;k++){
      const c=cards[offset+k];
      const t=count===1?.5:k/(count-1);
      const centered=t*2-1;
      const x=side+span*t;
      const arc=Math.pow(Math.abs(centered),1.65)*slack*.52;
      const y=r*rowH+Math.max(1,(slack-arc)*.32)+arc;
      const angle=centered*(W<620?9:11);
      const cx=Math.max(0,Math.min(x,W-cw));
      const cy=Math.max(r*rowH,Math.min(y,(r+1)*rowH-ch));
      c.style.transform=`translate(${cx}px,${cy}px) rotate(${angle}deg)`;
      c.style.zIndex=r*100+k;
    }
    offset+=count;
  }
}
async function dealFan(msg){
  renderFan();fan.classList.add("locked");
  say("カードを引く準備をしているよ…");
  fanLayout("stack");
  for(let t=0;t<3;t++){await wait(240);fanLayout("stack")}
  await wait(260);fanLayout("fan");await wait(700);
  fan.classList.remove("locked");say(msg);
}

/* flow */
function syncSetup(){
  $("count").textContent=S.count;
  $("minus").disabled=S.count<=1;$("plus").disabled=S.count>=MAX_COUNT;
}
async function start(){
  clearIdle();
  S.question=($("question")||{}).value||"";
  // 規則六: 洗牌完了時点で78枚すべての順序と正逆位を凍結。以降の乱数使用なし
  const ids=shuffle([...Array(TOTAL).keys()]);
  S.deck=ids.map(id=>({id,rev:rand(2)===1}));
  S.drawn=[];S.flipped=0;S.extra=0;S.target=S.count;
  $("setup").hidden=true;$("actions").hidden=true;
  spreadEl.hidden=false;buildSlots();
  await dealFan(`ピンときたカードを、${S.count}枚選んでね`);
}
// 規則七: 定案後の牌をそのまま使う。ランダム不使用
function pick(el){
  if(S.drawn.length>=S.target||el.classList.contains("gone")||fan.classList.contains("locked"))return;
  const deckIdx=+el.dataset.idx;
  const c=S.deck[deckIdx];
  const idx=S.drawn.length;
  S.drawn.push({id:c.id,rev:c.rev,deckIdx});
  const frame=$("frame"+idx);
  const from=el.getBoundingClientRect(),to=frame.getBoundingClientRect();
  const rot=(el.style.transform.match(/rotate\(([-\d.e]+)deg/)||[0,0])[1];
  const card=document.createElement("div");
  card.className="card";card.innerHTML=cardHTML(c);card.dataset.slot=idx;
  frame.appendChild(card);
  card.style.transition="none";
  card.style.transform=`translate(${from.left+from.width/2-(to.left+to.width/2)}px,${from.top+from.height/2-(to.top+to.height/2)}px) rotate(${rot}deg) scale(${from.width/to.width})`;
  el.classList.add("gone");
  card.getBoundingClientRect();
  card.style.transition="";card.style.transform="";
  card.addEventListener("click",()=>flip(card));
  const left=S.target-S.drawn.length;
  if(left>0){say(`あと${left}枚`);return}
  fan.classList.add("locked");
  setTimeout(()=>{
    fan.innerHTML="";
    document.querySelectorAll(".slot .card:not(.flipped)").forEach(x=>x.classList.add("ready"));
    say("カードをタッチして、めくってみよう");
    writeURL();
  },600);
}
function showName(i){
  const c=S.drawn[i],n=$("name"+i);
  n.innerHTML=`${cardName(c.id).html}<small class="${c.rev?"rev":""}">${c.rev?"逆位置":"正位置"}</small>`;
  n.classList.add("on");
}
function flip(card){
  if(!card.classList.contains("ready"))return;
  // 一枚タッチで全部めくる
  const all=[...document.querySelectorAll(".slot .card.ready")];
  all.forEach((c,k)=>{
    setTimeout(()=>{
      // 先同步正面狀態，再播放視覺翻面，避免動畫結尾仍顯示牌背
      c.classList.remove("ready");c.classList.add("flipped","flipping");
      const i=+c.dataset.slot;
      // 到達翻面中線後強制切換可見層，避免部分瀏覽器的 3D 背面渲染殘留
      setTimeout(()=>c.classList.add("front-visible"),410);
      setTimeout(()=>c.classList.remove("flipping"),820);
      setTimeout(()=>showName(i),540);
      S.flipped++;
      if(S.flipped===S.drawn.length)setTimeout(showActions,980);
    },k*200);
  });
}
function showActions(){
  say(S.extra?"補足カードも揃ったよ":"これが、あなたのカードだよ");
  $("extraBtn").disabled=S.extra>=MAX_EXTRA;
  $("actions").hidden=false;
  armIdle();
}
// 規則八: 補充牌は残りから選ぶ。再洗牌・洗牌アニメなし。順序も正逆位も不変
async function drawExtra(){
  clearIdle();
  S.extra++;S.target++;
  $("actions").hidden=true;
  addSlot(true);
  renderFan();
  fanLayout("fan");
  fan.classList.remove("locked");
  say("補足カードを1枚選んでね");
}
function reset(){
  clearIdle();fan.innerHTML="";S.drawn=[];S.extra=0;S.question="";
  spreadEl.hidden=true;spreadEl.innerHTML="";
  if($("question"))$("question").value="";
  $("actions").hidden=true;$("setup").hidden=false;$("overlay").hidden=true;
  $("qrArea").hidden=true;$("qrCode").innerHTML="";
  history.replaceState(null,"",BOOTH?"?booth=1":location.pathname);
  say("聞きたいことを、心の中で思い浮かべてね");
}

/* QR code */
// ponytail: BASE_URL は部署先に合わせて変える。今は現在のページ origin を使う
function showQR(){
  const area=$("qrArea"),container=$("qrCode");
  if(!area.hidden){area.hidden=true;return} // toggle
  const base=location.origin+location.pathname;
  const p=new URLSearchParams();
  p.set("n",S.count);
  p.set("cards",S.drawn.map(c=>c.id+(c.rev?"r":"")).join("-"));
  const url=base+"?"+p;
  const qr=qrcode(0,"M");
  qr.addData(url);
  qr.make();
  container.innerHTML=qr.createSvgTag({cellSize:4,margin:8});
  area.hidden=false;
}

/* idle */
function clearIdle(){clearTimeout(idleTimer);idleTimer=null}
function armIdle(){if(BOOTH){clearIdle();idleTimer=setTimeout(reset,IDLE_MS)}}

/* events */
fan.addEventListener("click",e=>{const c=e.target.closest(".fcard");if(c)pick(c)});
fan.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.classList.contains("fcard")){e.preventDefault();pick(e.target)}});
$("minus").addEventListener("click",()=>{S.count=Math.max(1,S.count-1);syncSetup()});
$("plus").addEventListener("click",()=>{S.count=Math.min(MAX_COUNT,S.count+1);syncSetup()});
$("startBtn").addEventListener("click",start);
$("againBtn").addEventListener("click",reset);
$("endBtn").addEventListener("click",reset);
$("extraBtn").addEventListener("click",drawExtra);
$("saveBtn").addEventListener("click",saveImage);
$("qrBtn").addEventListener("click",showQR);
$("closeShot").addEventListener("click",()=>{$("overlay").hidden=true;armIdle()});
addEventListener("resize",()=>{if(spreadEl.children.length)sizeSlots();if(fan.children.length&&!fan.classList.contains("locked"))fanLayout("fan")});
let pointerFrame=0;
addEventListener("pointermove",e=>{
  if(reduce||$("setup").hidden||pointerFrame)return;
  pointerFrame=requestAnimationFrame(()=>{
    document.documentElement.style.setProperty("--pointer-x",`${e.clientX/innerWidth*100}%`);
    document.documentElement.style.setProperty("--pointer-y",`${e.clientY/innerHeight*100}%`);
    pointerFrame=0;
  });
});
addEventListener("pointerleave",()=>{
  document.documentElement.style.setProperty("--pointer-x","50%");
  document.documentElement.style.setProperty("--pointer-y","32%");
});
if(BOOTH)["pointerdown","keydown"].forEach(ev=>addEventListener(ev,()=>{if(idleTimer)armIdle()}));

syncSetup();
restore();
