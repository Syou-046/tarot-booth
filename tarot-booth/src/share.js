// 結果URLの書き出し/復元と、結果画像の生成

/* url — 規則九: 問題は URL に含めない */
function writeURL(){
  const p=new URLSearchParams();if(BOOTH)p.set("booth","1");
  p.set("n",S.count);
  p.set("cards",S.drawn.map(c=>c.id+(c.rev?"r":"")).join("-"));
  history.replaceState(null,"","?"+p);
}
// 規則九: URL復元時は乱数を使わない
function restore(){
  const list=(params.get("cards")||"").split("-").filter(Boolean).map(s=>({id:parseInt(s,10),rev:s.endsWith("r")}));
  const n=parseInt(params.get("n"),10);
  if(!list.length||list.some(c=>!(c.id>=0&&c.id<TOTAL))||new Set(list.map(c=>c.id)).size!==list.length)return false;
  if(!(n>=1&&n<=MAX_COUNT&&list.length>=n&&list.length<=n+MAX_EXTRA))return false;
  S.count=n;
  // drawn に deckIdx は不要（復元時は牌堆がない）
  S.drawn=list.map(c=>({id:c.id,rev:c.rev,deckIdx:-1}));
  S.flipped=list.length;S.target=list.length;S.extra=list.length-n;
  syncSetup();
  spreadEl.hidden=false;
  buildSlots();for(let e=0;e<S.extra;e++)addSlot(true);
  list.forEach((c,i)=>{const el=document.createElement("div");el.className="card flipped";el.style.transition="none";el.innerHTML=cardHTML(c);$("frame"+i).appendChild(el);showName(i)});
  $("setup").hidden=true;showActions();
  return true;
}

/* image — 規則九: 問題を画像に含める */
function loadImg(src){return new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=src})}
async function saveImage(){
  clearIdle();
  const n=S.drawn.length,cw=200,ch=Math.round(cw*527/300),gap=36,pad=60;
  const hasQ=S.question&&S.question.trim();
  const W=Math.max(760,pad*2+n*cw+(n-1)*gap),H=ch+300+(hasQ?40:0);
  const cv=document.createElement("canvas");cv.width=W;cv.height=H;const g=cv.getContext("2d");
  const css=getComputedStyle(document.documentElement),col=v=>css.getPropertyValue(v).trim();
  const grd=g.createRadialGradient(W/2,H*.4,40,W/2,H*.4,W*.7);grd.addColorStop(0,"#73bce8");grd.addColorStop(1,col("--cloth-deep"));
  g.fillStyle=grd;g.fillRect(0,0,W,H);
  g.strokeStyle=col("--brass-dim");g.lineWidth=2;g.strokeRect(18,18,W-36,H-36);
  g.textAlign="center";
  g.fillStyle=col("--muted");g.font=`500 18px ${col("--maru")}`;g.fillText("映画『魔法使いちゃんは素直になれやしない』",W/2,64);
  g.fillStyle=col("--brass");g.font=`900 44px ${col("--mincho")}`;g.fillText("占い師のタロット",W/2,118);
  let y0=150;
  if(hasQ){
    g.fillStyle=col("--paper");g.font=`500 18px ${col("--maru")}`;g.fillText(S.question.trim(),W/2,y0);
    y0+=40;
  }
  const x0=(W-(n*cw+(n-1)*gap))/2;
  for(let i=0;i<n;i++){
    const c=S.drawn[i],img=await loadImg(cardSrc(c.id)),x=x0+i*(cw+gap);
    g.save();g.translate(x+cw/2,y0+ch/2);if(c.rev)g.rotate(Math.PI);
    g.shadowColor="rgba(0,0,0,.5)";g.shadowBlur=18;g.drawImage(img,-cw/2,-ch/2,cw,ch);g.restore();
    g.fillStyle=col("--paper");g.font=`600 22px ${col("--mincho")}`;g.fillText(cardName(c.id).text,x+cw/2,y0+ch+36);
    g.fillStyle=c.rev?"#e0a38f":col("--muted");g.font=`500 16px ${col("--maru")}`;g.fillText(c.rev?"逆位置":"正位置",x+cw/2,y0+ch+62);
  }
  const d=new Date();
  g.fillStyle=col("--muted");g.font=`500 15px ${col("--maru")}`;
  g.fillText(`${d.getFullYear()}.${d.getMonth()+1}.${d.getDate()}  この占いは楽しむためのものです`,W/2,H-40);
  const url=cv.toDataURL("image/png");
  $("shotImg").src=url;$("dlLink").href=url;$("overlay").hidden=false;
}
