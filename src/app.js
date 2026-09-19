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
let liveMode=BOOTH;
let standardCount=3;

function openRules(intro=false){
  const layer=$("rulesOverlay");
  layer.classList.toggle("intro",intro&&!reduce);
  $("skipRules").hidden=!intro;
  $("closeRules").textContent=intro?"占いを始める":"閉じる";
  layer.hidden=false;
  requestAnimationFrame(()=>$(intro?"skipRules":"closeRules").focus());
}
function closeRules(){
  $("rulesOverlay").hidden=true;
  $("rulesOverlay").classList.remove("intro");
  try{sessionStorage.setItem("tarot-rules-seen","1")}catch{}
  $("rulesBtn").focus();
}

function say(t){guide.hidden=false;guide.style.opacity=0;setTimeout(()=>{guide.textContent=t;guide.style.opacity=1},200)}
function cardHTML(c){return `<div class="face back"></div><div class="face front${c.rev?" rev":""}"><img alt="${cardName(c.id).text}" src="${cardSrc(c.id)}"></div>`}

/* spread — 規則四: 牌位上不標名稱 */
function sizeSlots(){
  const n=spreadEl.children.length||1;
  const viewport=visualViewport;
  const viewW=viewport?.width||innerWidth;
  const viewH=viewport?.height||innerHeight;
  const resultVisible=!$("actions").hidden;
  const landscape=viewW>viewH;
  const compact=viewW<600;
  const tablet=viewW>=600&&viewW<1024;
  const gap=Math.max(2,Math.min(viewW>=1200?16:10,(viewW-16)/(n*18)));
  document.documentElement.style.setProperty("--spread-gap",gap+"px");
  const style=getComputedStyle(spreadEl);
  const pad=(parseFloat(style.paddingLeft)||0)+(parseFloat(style.paddingRight)||0);
  const byW=(spreadEl.clientWidth-pad-gap*(n-1))/n;
  const headerH=document.querySelector("header").getBoundingClientRect().height;
  const minTable=resultVisible
    ?(compact?Math.min(310,viewH*.43):Math.min(310,viewH*.35))
    :(compact?Math.min(250,viewH*.34):Math.min(330,viewH*.42));
  const maxSpreadH=Math.max(96,viewH-headerH-minTable);
  const chrome=compact?34:46;
  const byH=(maxSpreadH-chrome)/(527/300);
  let resultCaps;
  if(compact)resultCaps=landscape?[126,112,96,82,72]:[172,142,118,100,88];
  else if(tablet)resultCaps=[218,184,156,138,122];
  else if(viewW>=1500)resultCaps=[270,220,184,160,140];
  else resultCaps=[248,204,172,152,134];
  const normalCap=compact?(landscape?86:112):(tablet?126:viewW>=1500?154:136);
  const cap=resultVisible?resultCaps[Math.min(n,5)-1]:normalCap;
  const width=Math.max(27,Math.min(byW,byH,cap));
  document.documentElement.style.setProperty("--sw",width+"px");
  spreadEl.dataset.cards=String(n);
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
  renderFan();fan.classList.add("locked","shuffling");
  document.body.classList.add("is-shuffling");
  say("カードをまぜています…");
  fanLayout("stack");
  for(let t=0;t<5;t++){await wait(210);fanLayout("stack")}
  await wait(240);
  fan.classList.remove("shuffling");
  fanLayout("fan");await wait(720);
  fan.classList.remove("locked");document.body.classList.remove("is-shuffling");say(msg);
}

/* flow */
function syncSetup(){
  $("count").textContent=S.count;
  $("minus").disabled=S.count<=1;$("plus").disabled=S.count>=MAX_COUNT;
}
function setMode(mode){
  const nextLive=mode==="live";
  if(nextLive&&!liveMode)standardCount=S.count;
  if(!nextLive&&!liveMode)standardCount=S.count;
  liveMode=nextLive;
  document.body.classList.toggle("booth-mode",liveMode);
  $("questionField").hidden=liveMode;
  $("countField").hidden=liveMode;
  $("boothQuestions").hidden=!liveMode;
  $("standardMode").classList.toggle("selected",!liveMode);
  $("liveMode").classList.toggle("selected",liveMode);
  $("standardMode").setAttribute("aria-pressed",String(!liveMode));
  $("liveMode").setAttribute("aria-pressed",String(liveMode));
  $("startBtn").textContent=liveMode?"3枚のカードを引く":"カードをまぜる";
  S.count=liveMode?3:standardCount;
  syncSetup();
  clearIdle();
}
async function start(){
  clearIdle();
  const boothChoice=document.querySelector(".booth-question.selected");
  S.question=liveMode?(boothChoice?.dataset.question||""):(($("question")||{}).value||"");
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
  const left=S.target-S.drawn.length;
  if(left>0){say(`あと${left}枚`);return}
  fan.classList.add("locked");
  setTimeout(()=>{
    fan.innerHTML="";
    document.querySelectorAll(".slot .card:not(.flipped)").forEach(x=>x.classList.add("ready"));
    say("カードをひらきます…");
    writeURL();
    setTimeout(()=>{
      const first=document.querySelector(".slot .card.ready");
      if(first)flip(first);
    },280);
  },600);
}
function showName(i){
  const c=S.drawn[i],n=$("name"+i);
  n.innerHTML=`${cardName(c.id).html}<small class="${c.rev?"rev":""}">${c.rev?"逆位置":"正位置"}</small>`;
  n.classList.add("on");
}
function flip(card){
  if(!card.classList.contains("ready"))return;
  // 選び終わったカードを順番に自動でめくる
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
  if(S.question)say(`質問：${S.question}`);
  else guide.hidden=true;
  $("extraBtn").disabled=S.extra>=MAX_EXTRA;
  $("actions").hidden=false;
  sizeSlots();
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
  clearIdle();fan.innerHTML="";fan.classList.remove("shuffling","locked");document.body.classList.remove("is-shuffling");S.drawn=[];S.extra=0;S.question="";
  if(liveMode){S.count=3;syncSetup()}
  spreadEl.hidden=true;spreadEl.innerHTML="";
  if($("question"))$("question").value="";
  $("actions").hidden=true;$("setup").hidden=false;$("overlay").hidden=true;
  history.replaceState(null,"",BOOTH?"?booth=1":location.pathname);
  say("聞きたいことを、心の中で思い浮かべてね");
}


/* copy text */
const MAJOR_EN=["The Fool","The Magician","The High Priestess","The Empress","The Emperor","The Hierophant","The Lovers","The Chariot","Strength","The Hermit","Wheel of Fortune","Justice","The Hanged Man","Death","Temperance","The Devil","The Tower","The Star","The Moon","The Sun","Judgement","The World"];
const SUITS_EN=["Wands","Cups","Swords","Pentacles"];
const RANKS_EN=["Ace","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Page","Knight","Queen","King"];
function toRoman(n){const v=[1000,900,500,400,100,90,50,40,10,9,5,4,1],s=["M","CM","D","CD","C","XC","L","XL","X","IX","V","IV","I"];let r="";for(let i=0;i<v.length;i++)while(n>=v[i]){r+=s[i];n-=v[i]}return r}
function cardNameEN(id){if(id<22){const n=MAJOR_EN[id];return id===0?n:`${n} (${toRoman(id)})`;}return `${RANKS_EN[(id-22)%14]} of ${SUITS_EN[Math.floor((id-22)/14)]}`}
const AI_PREAMBLE="以下はライダー・ウェイト版タロットの結果です。自由線形スプレッドで、カードは引いた順に並んでいます。位置に固定の意味はありません。補足カードは、本体のカードを補う位置づけです。この内容だけをもとに、質問に対する解釈をお願いします。カードを追加したり引き直したりはしないでください。";
function copyText(){
  const today=new Date();
  const dateStr=`${today.getFullYear()}.${today.getMonth()+1}.${today.getDate()}`;
  const q=S.question?`質問：${S.question}\n`:"";
  const mainCards=S.drawn.slice(0,S.count);
  const extraCards=S.drawn.slice(S.count);
  const fmt=(c,prefix)=>`${prefix}${cardName(c.id).text} / ${cardNameEN(c.id)}　${c.rev?"逆位置":"正位置"}`;
  let text=`【タロット占い結果】${dateStr}\n`;
  if(q)text+=q;
  text+=`${"─".repeat(24)}\n`;
  text+=mainCards.map((c,i)=>fmt(c,`${i+1}. `)).join("\n");
  if(extraCards.length){
    text+=`\n\n【補足カード】\n`;
    text+=extraCards.map((c,i)=>fmt(c,`補足${i+1}. `)).join("\n");
  }
  text+=`\n${"─".repeat(24)}\n※ AI への提示文\n\n${AI_PREAMBLE}`;
  const btn=$("copyBtn");
  navigator.clipboard.writeText(text).then(()=>{
    btn.textContent="コピーしました！";setTimeout(()=>{btn.textContent="テキストをコピー"},2000);
  }).catch(()=>{
    btn.textContent="コピー失敗";setTimeout(()=>{btn.textContent="テキストをコピー"},2000);
  });
}

/* AI reading */
function buildReadingText(){
  const mainCards=S.drawn.slice(0,S.count);
  const extraCards=S.drawn.slice(S.count);
  const fmt=(c,prefix)=>`${prefix}${cardName(c.id).text} / ${cardNameEN(c.id)}　${c.rev?"逆位置":"正位置"}`;
  let text=mainCards.map((c,i)=>fmt(c,`${i+1}. `)).join("\n");
  if(extraCards.length)text+="\n\n【補足カード】\n"+extraCards.map((c,i)=>fmt(c,`補足${i+1}. `)).join("\n");
  if(S.question)text=`質問：${S.question}\n\n`+text;
  return text;
}
function openAIOverlay(){
  const overlay=$("aiOverlay");
  const savedKey=localStorage.getItem("tarot-openai-key")||"";
  $("aiKeyInput").value=savedKey;
  $("aiKeyRow").hidden=!!savedKey;
  $("aiResult").hidden=false;
  $("aiResultText").textContent="";
  overlay.hidden=false;
  if(!savedKey)$("aiKeyInput").focus();
  else getAIReading();
}
async function getAIReading(){
  const key=localStorage.getItem("tarot-openai-key");
  if(!key)return;
  const resultEl=$("aiResultText");
  resultEl.textContent="解釈中…";
  try{
    const res=await fetch("https://api.openai.com/v1/chat/completions",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":`Bearer ${key}`},
      body:JSON.stringify({
        model:"gpt-4o-mini",
        messages:[
          {role:"system",content:AI_PREAMBLE},
          {role:"user",content:buildReadingText()}
        ],
        max_tokens:2000
      })
    });
    if(!res.ok){const e=await res.json();throw new Error(e.error?.message||res.status);}
    const data=await res.json();
    resultEl.textContent=data.choices[0].message.content;
  }catch(e){
    resultEl.textContent=`エラー：${e.message}`;
  }
}

/* idle */
function clearIdle(){clearTimeout(idleTimer);idleTimer=null}
function armIdle(){if(liveMode){clearIdle();idleTimer=setTimeout(reset,IDLE_MS)}}

/* events */
fan.addEventListener("click",e=>{const c=e.target.closest(".fcard");if(c)pick(c)});
fan.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.classList.contains("fcard")){e.preventDefault();pick(e.target)}});
$("minus").addEventListener("click",()=>{S.count=Math.max(1,S.count-1);syncSetup()});
$("plus").addEventListener("click",()=>{S.count=Math.min(MAX_COUNT,S.count+1);syncSetup()});
$("standardMode").addEventListener("click",()=>setMode("standard"));
$("liveMode").addEventListener("click",()=>setMode("live"));
document.querySelectorAll(".booth-question").forEach(btn=>btn.addEventListener("click",()=>{
  document.querySelectorAll(".booth-question").forEach(option=>{
    const selected=option===btn;
    option.classList.toggle("selected",selected);
    option.setAttribute("aria-pressed",String(selected));
  });
}));
$("startBtn").addEventListener("click",start);
$("rulesBtn").addEventListener("click",()=>openRules(false));
$("closeRules").addEventListener("click",closeRules);
$("skipRules").addEventListener("click",closeRules);
$("rulesOverlay").addEventListener("click",e=>{if(e.target===$("rulesOverlay"))closeRules()});
$("againBtn").addEventListener("click",reset);
$("endBtn").addEventListener("click",reset);
$("extraBtn").addEventListener("click",drawExtra);
$("saveBtn").addEventListener("click",saveImage);
$("copyBtn").addEventListener("click",copyText);
$("aiBtn").addEventListener("click",openAIOverlay);
$("aiClose").addEventListener("click",()=>{$("aiOverlay").hidden=true;armIdle()});
$("aiKeySave").addEventListener("click",()=>{
  const k=$("aiKeyInput").value.trim();
  if(!k)return;
  localStorage.setItem("tarot-openai-key",k);
  $("aiKeyRow").hidden=true;
  getAIReading();
});
$("closeShot").addEventListener("click",()=>{$("overlay").hidden=true;armIdle()});
let resizeFrame=0;
function refreshLayout(){
  if(resizeFrame)return;
  resizeFrame=requestAnimationFrame(()=>{
    if(spreadEl.children.length)sizeSlots();
    if(fan.children.length&&!fan.classList.contains("locked"))fanLayout("fan");
    resizeFrame=0;
  });
}
addEventListener("resize",refreshLayout);
addEventListener("orientationchange",refreshLayout);
visualViewport?.addEventListener("resize",refreshLayout);
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
["pointerdown","keydown"].forEach(ev=>addEventListener(ev,()=>{if(liveMode&&idleTimer)armIdle()}));
addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("rulesOverlay").hidden)closeRules()});

setMode(BOOTH?"live":"standard");
const restored=restore();
let rulesSeen=false;
try{rulesSeen=sessionStorage.getItem("tarot-rules-seen")==="1"}catch{}
if(!restored&&!rulesSeen)openRules(true);
