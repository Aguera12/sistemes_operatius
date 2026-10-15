(() => {
"use strict";
const canvas = document.getElementById("pacmanCanvas");
if (!canvas) return;
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("punts");
const levelEl = document.getElementById("nivell");
const messageEl = document.getElementById("missatge");
const restartBtn = document.getElementById("reiniciar");

const TILE = 30, COLS = 19, ROWS = 19;
const DIRS = {
  up: {x:0,y:-1,angle:-Math.PI/2},
  down: {x:0,y:1,angle:Math.PI/2},
  left: {x:-1,y:0,angle:Math.PI},
  right: {x:1,y:0,angle:0}
};
const rawMap = [
"###################",
"#........#........#",
"#.###.##.#.##.###.#",
"#.................#",
"#.###.#.###.#.###.#",
"#.....#.....#.....#",
"###.#.#####.#.#####",
"#...#...#...#...#..#",
"#.###.#.#.#.#.###.#",
"#.................#",
"#.###.#.###.#.###.#",
"#...#...#...#...#..#",
"###.#.#####.#.#####",
"#.....#.....#.....#",
"#.###.#.###.#.###.#",
"#.................#",
"#.###.##.#.##.###.#",
"#........#........#",
"###################"
];
// Repair every row to the same width and ensure closed borders.
function makeMap(level) {
  return rawMap.map((line, y) => {
    let row = (line + "#".repeat(COLS)).slice(0, COLS).split("");
    row[0] = "#"; row[COLS-1] = "#";
    if (y === 0 || y === ROWS-1) row = Array(COLS).fill("#");
    // Three levels: the maze stays recognizable; points/ghost speed increase.
    return row;
  });
}
let grid, player, ghosts, score, level, state, frightenedUntil;
let lastFrame = 0, moveAccumulator = 0, ghostAccumulator = 0, raf = 0;

function isWall(x,y) {
  return x < 0 || x >= COLS || y < 0 || y >= ROWS || grid[y][x] === "#";
}
function findOpen(preferred) {
  for (const p of preferred) if (!isWall(p.x,p.y)) return {...p};
  for (let y=1;y<ROWS-1;y++) for(let x=1;x<COLS-1;x++) if(!isWall(x,y)) return {x,y};
  return {x:1,y:1};
}
function updateHud() {
  scoreEl.textContent = score;
  levelEl.textContent = level;
}
function startLevel() {
  grid = makeMap(level);
  // Put a point in every walkable cell, then clear safe start area.
  for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++) if(grid[y][x] !== "#") grid[y][x] = ".";
  player = {...findOpen([{x:1,y:1},{x:9,y:9}]), dir:"left", nextDir:"left"};
  grid[player.y][player.x] = " ";
  // Power pellets in corners.
  [[1,1],[17,1],[1,17],[17,17]].forEach(([x,y]) => { if(!isWall(x,y) && !(x===player.x&&y===player.y)) grid[y][x]="o"; });
  const starts = [{x:9,y:9},{x:8,y:9},{x:10,y:9},{x:9,y:8}];
  ghosts = starts.map((p,i) => {
    const pos = findOpen([p,{x:9,y:10},{x:17,y:9},{x:1,y:9}]);
    return {...pos, color:["#ff7a18","#ff9a24","#ff6a1a","#ffb13b"][i], dir:["left","right","up","down"][i]};
  });
  // Clear the ghost house under them so they don't cover points.
  ghosts.forEach(g => { if(grid[g.y][g.x] !== "#") grid[g.y][g.x]=" "; });
  frightenedUntil = 0;
  state = "playing";
  moveAccumulator = 0; ghostAccumulator = 0; lastFrame = 0;
  messageEl.textContent = `Nivell ${level}: recull tots els punts i evita els fantasmes.`;
  updateHud(); draw();
}
function newGame() {
  if(raf) cancelAnimationFrame(raf);
  score=0; level=1;
  startLevel();
  raf=requestAnimationFrame(loop);
  canvas.focus();
}
function canMove(entity,dir) {
  const d=DIRS[dir]; return !!d && !isWall(entity.x+d.x,entity.y+d.y);
}
function move(entity,dir) {
  if(!canMove(entity,dir)) return false;
  const d=DIRS[dir]; entity.x+=d.x; entity.y+=d.y; entity.dir=dir; return true;
}
function resetPositionsAfterCatch() {
  messageEl.textContent = "T'ha atrapat un fantasma! Torna-ho a intentar.";
  const safe = findOpen([{x:1,y:1},{x:9,y:9}]);
  player.x = safe.x; player.y = safe.y;
  player.dir = "left"; player.nextDir = "left";
  const ghostStarts = [{x:9,y:9},{x:17,y:9},{x:1,y:9},{x:9,y:17}];
  ghosts.forEach((g,i) => {
    const p = findOpen([ghostStarts[i], {x:9,y:9}]);
    g.x = p.x; g.y = p.y;
  });
  draw();
}
function collide() {
  for(const g of ghosts) if(g.x===player.x && g.y===player.y) {
    if(performance.now()<frightenedUntil) { score+=200; const p=findOpen([{x:9,y:9},{x:17,y:9}]); g.x=p.x;g.y=p.y; }
    else { resetPositionsAfterCatch(); return true; }
  }
  return false;
}
function stepPlayer() {
  if(canMove(player,player.nextDir)) player.dir=player.nextDir;
  move(player,player.dir);
  const c=grid[player.y][player.x];
  if(c===".") {grid[player.y][player.x]=" ";score+=10;}
  if(c==="o") {grid[player.y][player.x]=" ";score+=50;frightenedUntil=performance.now()+7000;}
  if(collide()) return;
  let remaining=0;
  for(const row of grid) for(const c of row) if(c==="."||c==="o") remaining++;
  if(remaining===0) {
    if(level>=3) {
      state="won";
      messageEl.textContent=`Has completat els 3 nivells! Puntuació final: ${score}.`;
    } else {
      level++; startLevel();
    }
  }
  updateHud(); draw();
}
function stepGhosts() {
  if(state!=="playing") return;
  for(const g of ghosts) {
    const options=Object.keys(DIRS).filter(d=>canMove(g,d));
    if(!options.length) continue;
    let chosen;
    if(Math.random()<0.62) {
      options.sort((a,b)=>{
        const da=DIRS[a],db=DIRS[b];
        return (Math.abs(g.x+da.x-player.x)+Math.abs(g.y+da.y-player.y)) -
               (Math.abs(g.x+db.x-player.x)+Math.abs(g.y+db.y-player.y));
      });
      chosen=options[0];
    } else chosen=options[Math.floor(Math.random()*options.length)];
    move(g,chosen);
  }
  collide(); updateHud(); draw();
}
function drawWall(x,y) {
  ctx.fillStyle="#0d2c8b"; ctx.fillRect(x*TILE,y*TILE,TILE,TILE);
  ctx.strokeStyle="#3475ff"; ctx.lineWidth=1.5;
  ctx.strokeRect(x*TILE+2,y*TILE+2,TILE-4,TILE-4);
}
function drawPacman() {
  const cx=player.x*TILE+TILE/2, cy=player.y*TILE+TILE/2;
  const angle=DIRS[player.dir].angle;
  const mouth=0.18+Math.abs(Math.sin(performance.now()/85))*0.28;
  ctx.fillStyle="#ffdf00"; ctx.beginPath(); ctx.moveTo(cx,cy);
  ctx.arc(cx,cy,TILE*.39,angle+mouth,angle+Math.PI*2-mouth);
  ctx.closePath();ctx.fill();
}
function drawGhost(g) {
  const x=g.x*TILE,y=g.y*TILE,fright=performance.now()<frightenedUntil;
  ctx.fillStyle=fright?"#2878ff":g.color;
  ctx.beginPath();ctx.arc(x+15,y+13,10,Math.PI,0);
  ctx.lineTo(x+25,y+25);ctx.lineTo(x+20,y+22);ctx.lineTo(x+15,y+25);
  ctx.lineTo(x+10,y+22);ctx.lineTo(x+5,y+25);ctx.closePath();ctx.fill();
  ctx.fillStyle="#fff";
  ctx.beginPath();ctx.ellipse(x+11,y+13,3.5,4.5,0,0,Math.PI*2);
  ctx.ellipse(x+19,y+13,3.5,4.5,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#142c78";
  ctx.beginPath();ctx.arc(x+12,y+14,1.7,0,Math.PI*2);ctx.arc(x+20,y+14,1.7,0,Math.PI*2);ctx.fill();
}
function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle="#03050d";ctx.fillRect(0,0,canvas.width,canvas.height);
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
    const c=grid[y][x];
    if(c==="#")drawWall(x,y);
    else if(c==="."||c==="o"){
      ctx.fillStyle=c==="o"?"#fff0a0":"#ffdf00";ctx.beginPath();
      ctx.arc(x*TILE+15,y*TILE+15,c==="o"?6:2.7,0,Math.PI*2);ctx.fill();
    }
  }
  ghosts.forEach(drawGhost);drawPacman();
  if(state==="over"||state==="won"){
    ctx.fillStyle="rgba(0,0,0,.76)";ctx.fillRect(0,235,570,100);
    ctx.fillStyle="#ffdf00";ctx.font="bold 25px Arial";ctx.textAlign="center";
    ctx.fillText(state==="won"?"HAS GUANYAT!":"FI DE LA PARTIDA",285,292);ctx.textAlign="left";
  }
}
function loop(t) {
  if(state==="playing"){
    if(!lastFrame)lastFrame=t;
    const dt=Math.min(t-lastFrame,80);lastFrame=t;
    moveAccumulator+=dt;ghostAccumulator+=dt;
    const playerSpeed=Math.max(105,150-(level-1)*8);
    const ghostSpeed=Math.max(230,390-(level-1)*45);
    if(moveAccumulator>=playerSpeed){stepPlayer();moveAccumulator=0;}
    if(state==="playing"&&ghostAccumulator>=ghostSpeed){stepGhosts();ghostAccumulator=0;}
  }
  raf=requestAnimationFrame(loop);
}
function setDir(d) {
  if(state!=="playing")return;
  player.nextDir=d;
}
document.addEventListener("keydown",e=>{
  const keys={ArrowUp:"up",w:"up",W:"up",ArrowDown:"down",s:"down",S:"down",ArrowLeft:"left",a:"left",A:"left",ArrowRight:"right",d:"right",D:"right"};
  if(keys[e.key]){e.preventDefault();setDir(keys[e.key]);}
});
document.querySelectorAll("[data-dir]").forEach(b=>b.addEventListener("click",()=>setDir(b.dataset.dir)));
restartBtn.addEventListener("click",newGame);
newGame();
})();