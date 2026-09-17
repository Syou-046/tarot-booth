// カードデータと抽選。抽選は必ずこのファイルの関数を通す(AGENTS.md 参照)

const MAJOR=[
 ["愚者","ぐしゃ"],["魔術師","まじゅつし"],["女教皇","じょきょうこう"],["女帝","じょてい"],["皇帝","こうてい"],
 ["教皇","きょうこう"],["恋人","こいびと"],["戦車","せんしゃ"],["力","ちから"],["隠者","いんじゃ"],
 ["運命の輪","うんめいのわ"],["正義","せいぎ"],["吊るされた男","つるされたおとこ"],["死神","しにがみ"],["節制","せっせい"],
 ["悪魔","あくま"],["塔","とう"],["星","ほし"],["月","つき"],["太陽","たいよう"],["審判","しんぱん"],["世界","せかい"]
];
const SUITS=["ワンド","カップ","ソード","ペンタクル"];
const RANKS=["エース","2","3","4","5","6","7","8","9","10","ペイジ","ナイト","クイーン","キング"];
function cardName(id){
  if(id<22)return {text:MAJOR[id][0],html:`<ruby>${MAJOR[id][0]}<rt>${MAJOR[id][1]}</rt></ruby>`};
  const t=`${SUITS[Math.floor((id-22)/14)]}の${RANKS[(id-22)%14]}`;return {text:t,html:t};
}
const TOTAL=78, MAX_COUNT=9, MAX_EXTRA=3;
// URL


function cardSrc(id){return `assets/cards/${String(id).padStart(2,'0')}.webp`}
// 0〜n-1 の一様乱数。剰余の偏りを避けるため棄却サンプリングを使う
function rand(n){
  const lim=Math.floor(0x100000000/n)*n, a=new Uint32Array(1);
  do{crypto.getRandomValues(a)}while(a[0]>=lim);
  return a[0]%n;
}
// Fisher–Yates
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=rand(i+1);[a[i],a[j]]=[a[j],a[i]]}return a}
