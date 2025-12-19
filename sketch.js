/************ 状态机 ************/
const STATE = { READY: 0, PLAY: 1, PAUSE: 2, WIN: 3, LOSE: 4 };
let gameState = STATE.READY;

/************ 模式 ************/
let isEasy = true;          // true=初级 false=进阶
let timeLimit = 60;         // 进阶限时
let timer = timeLimit;      // 剩余秒数
let spaceLeft = 3;          // 空格刷新次数

/************ 炸弹 ************/
let bombs = [];             // [{r,c}]  炸弹坐标池
const BOMB_RADIUS = 1;      // 炸周围 1 格（九宫格）

/************ 计分 ************/
let combo = 0;              // 连击

//回弹动画
let animBack = null;          // 回弹动画 {sr,sc,tr,tc,p} 与 animSwap 结构相同
const BACK_FRAMES = 10;       // 回弹帧数

/************ 资源 ************/
let img = []; // 存放 6 张 emoji
function preload() {
  for (let i = 0; i < TYPE; i++) {
    img[i] = loadImage('assets/t' + i + '.png',
      () => console.log('t' + i + ' ok'),   // 成功
      () => console.warn('t' + i + ' fail') // 失败
    );
  }
}
/************ 动画参数 ************/

let animSwap = null; // {r,c,targetR,targetC,progress}
const SWAP_FRAMES = 10; // 0→1 共 10 帧

let animPop = []; // {r,c,scale,alpha}
const POP_FRAMES = 12;

/************ 全局参数 ************/
const COL = 8, ROW = 8, TYPE = 6, S = 60; // S 为方块像素大小
let grid;          // grid[r][c] 存 0..TYPE-1，-1 表示空
let score = 0;
let selected = null;  // {r,c}
let animQueue = [];   // 简单的动画对象池（帧计数器）
/************ 生命周期 ************/
function setup() {
  createCanvas(COL * S + 40, ROW * S + 180);
  colorMode(HSB, TYPE * 10, 100, 100); // 用 HSB 快速配 6 种区分色
  textAlign(LEFT, CENTER);
  noStroke();
  initGrid();
}
function draw() {
  background(0, 0, 95);
  switch (gameState) {
    case STATE.READY: drawReady(); break;
    case STATE.PLAY:
    case STATE.PAUSE:
      background(0, 0, 95);
      drawUI();
      drawGrid();
      handleAnim();
      if (gameState === STATE.PAUSE) drawPauseOverlay();
      break;
    case STATE.WIN:  drawEnd('YOU WIN !'); break;
    case STATE.LOSE: drawEnd('GAME OVER'); break;
  }

  drawUI();
  drawGrid();
  handleAnim(); // 下落/消除动画

  if (animSwap) {
  let { sr, sc, tr, tc, p } = animSwap;
  let sx = sc * S + 20, sy = sr * S + 80;
  let tx = tc * S + 20, ty = tr * S + 80;
  let cx = lerp(sx, tx, p / SWAP_FRAMES);
  let cy = lerp(sy, ty, p / SWAP_FRAMES);
  // 画两格背景
  fill(0, 0, 100, 150);
  rect(sx, sy, S, S, 5);
  rect(tx, ty, S, S, 5);
  // 画两张图（先画目标格，再画移动格）
  image(img[grid[tr][tc]], tx, ty, S, S);
  image(img[grid[sr][sc]], cx, cy, S, S);
  // 进度
  animSwap.p++;
  if (animSwap.p >= SWAP_FRAMES) {
    // 真正交换数据
    swap(sr, sc, tr, tc);
    let m = findAllMatches();
    
    if (m.length) {
      score += m.length * 100;
      combo++;
      eliminate(m);
      animQueue.push({ type: 'drop' });
    }else {
      // 无消除，回弹
      swap(sr, sc, tr, tc); // 先交换回去
      animBack = { sr, sc, tr, tc, p: 0 };
    }
    animSwap = null;
  }
}
}

/************ 1. 数据层 ************/
function initGrid() {
  grid = [];
  for (let r = 0; r < ROW; r++) {
    grid[r] = [];
    for (let c = 0; c < COL; c++) {
      let t = floor(random(TYPE));
      // 保证开局不出现 3 连
      while (
        (c >= 2 && grid[r][c - 1] === t && grid[r][c - 2] === t) ||
        (r >= 2 && grid[r - 1][c] === t && grid[r - 2][c] === t)
      ) {
        t = (t + 1) % TYPE;
      }
      grid[r][c] = t;
    }
  }
}
/************ 2. 渲染层 ************/
function drawGrid() {
  push();
  translate(20, 80);
  for (let r = 0; r < ROW; r++) {
    for (let c = 0; c < COL; c++) {
      let x = c * S, y = r * S;
      // 画方块
      if (grid[r][c] >= 0) {
        fill(grid[r][c] * 10, 80, 90);
        if (grid[r][c] >= 0) {
        image(img[grid[r][c]], x, y, S, S);
        }  
      }
      // 画选中框
      if (selected && selected.r === r && selected.c === c) {
        noFill();
        strokeWeight(4);
        stroke(0, 80, 100);
        rect(x, y, S, S, 5);
        noStroke();
      }
    }
  }
  pop();
  // 消除动画
for (let i = animPop.length - 1; i >= 0; i--) {
  let a = animPop[i];
  a.scale = lerp(a.scale, 0, 0.15);
  a.alpha = lerp(a.alpha, 0, 0.15);
  let x = a.c * S + 20 + S / 2, y = a.r * S + 80 + S / 2;
  push();
  translate(x, y);
  scale(a.scale);
  tint(255, a.alpha);
  image(img[grid[a.r][a.c] >= 0 ? grid[a.r][a.c] : 0], -S / 2, -S / 2, S, S);
  noTint();
  pop();
  if (a.alpha < 5) animPop.splice(i, 1);
}
}

function drawUI() {
  fill(0);
  textSize(24);
  text('Score: ' + score, 20, 30);
  text('Combo: ' + combo, 200, 30);
  if (!isEasy) {
    text('Time: ' + ceil(timer), 20, 60);
    // 进度条
    let w = map(timer, 0, timeLimit, 0, width - 40);
    fill(0, 80, 80);
    rect(20, 70, w, 8, 5);
  }
}

// 每秒减 1
setInterval(() => {
  if (gameState === STATE.PLAY && !isEasy) {
    timer -= 1;
    if (timer <= 0) gameState = STATE.LOSE;
  }
}, 1000);
/************ 3. 输入层 ************/
// function mousePressed() {
//   // 如果正在动画直接返回
//   if (animSwap || animQueue.length) return;
//   let c = floor((mouseX - 20) / S);
//   let r = floor((mouseY - 80) / S);
//   if (outBound(r, c)) return;
//   if (!selected) {
//     selected = { r, c, drag: true, x: mouseX, y: mouseY }; // 记录拖动
//   } else {
//     let sr = selected.r, sc = selected.c;
//     if (abs(sr - r) + abs(sc - c) === 1) {
//       // 开始交换动画
//       animSwap = { sr, sc, tr: r, tc: c, p: 0 };
//       selected = null;
//     } else {
//       selected = null; // 取消
//     }
//   }
// }
function drawReady() {
  fill(0);
  textSize(32);
  text('CUTE  MATCH', 20, 40);
  textSize(18);
  text('Choose mode to start', 20, 80);

  // 初级按钮
  fill(isEasy ? color(120, 60, 90) : color(0, 0, 80));
  rect(40, 120, 120, 40, 10);
  fill(255);
  text('Easy', 80, 142);

  // 进阶按钮
  fill(!isEasy ? color(0, 80, 90) : color(0, 0, 80));
  rect(180, 120, 120, 40, 10);
  fill(255);
  text('Hard', 220, 142);

  // 提示
  fill(0);
  text('R-restart  ESC-pause  Space-shuffle(3)', 20, height - 40);
}

function mousePressed() {
  // 在 READY 界面点按钮
  if (gameState === STATE.READY) {
    if (mouseX > 40 && mouseX < 160 && mouseY > 120 && mouseY < 160) {
      isEasy = true;
      startGame();
    }
    if (mouseX > 180 && mouseX < 300 && mouseY > 120 && mouseY < 160) {
      isEasy = false;
      startGame();
    }
    return;
  }
  // 其余逻辑保持昨天的
  if (animSwap || animQueue.length || gameState !== STATE.PLAY) return;
  let c = floor((mouseX - 20) / S);
  let r = floor((mouseY - 80) / S);
  if (outBound(r, c)) return;
  if (!selected) {
    selected = { r, c };
  } else {
    let sr = selected.r, sc = selected.c;
    if (abs(sr - r) + abs(sc - c) === 1) {
      animSwap = { sr, sc, tr: r, tc: c, p: 0 };
      selected = null;
    } else {
      selected = null;
    }
  }
}
function outBound(r, c) {
  return r < 0 || r >= ROW || c < 0 || c >= COL;
}

function keyPressed() {
  if (keyCode === ESCAPE) {
    gameState = gameState === STATE.PLAY ? STATE.PAUSE : STATE.PLAY;
  }
  if (key === 'r' || key === 'R') {
    resetGame();
  }
  if (key === ' ') {
    if (spaceLeft > 0 && gameState === STATE.PLAY) {
      spaceLeft--;
      initGrid();          // 直接换新局
      bombs = [];          // 炸弹清空
      animQueue = [];
      animPop = [];
      animSwap = null;
    }
  }
}

/************ 4. 逻辑层 ************/
function swap(r1, c1, r2, c2) {
  let t = grid[r1][c1];
  grid[r1][c1] = grid[r2][c2];
  grid[r2][c2] = t;
}
function findAllMatches() {
  let res = [];
  let mark4 = [], mark5 = []; // 额外记录 4、5
  // 横向
  for (let r = 0; r < ROW; r++) {
    for (let c = 0; c < COL - 2; ) {
      let t = grid[r][c];
      if (t < 0) { c++; continue; }
      let len = 1;
      while (c + len < COL && grid[r][c + len] === t) len++;
      if (len >= 3) {
        for (let i = 0; i < len; i++) res.push({ r, c: c + i });
        if (len === 4) mark4.push({ r, c: c + 2 });
        if (len >= 5) mark5.push({ r, c: c + 2 });
        c += len;
      } else c++;
    }
  }
  // 纵向（同理，略）
  for (let c = 0; c < COL; c++) {
    for (let r = 0; r < ROW - 2; ) {
      let t = grid[r][c];
      if (t < 0) { r++; continue; }
      let len = 1;
      while (r + len < ROW && grid[r + len][c] === t) len++;
      if (len >= 3) {
        for (let i = 0; i < len; i++) res.push({ r: r + i, c });
        if (len === 4) mark4.push({ r: r + 2, c });
        if (len >= 5) mark5.push({ r: r + 2, c });
        r += len;
      } else r++;
    }
  }
  // 去重
  let set = new Set();
  res.forEach(p => set.add(`${p.r},${p.c}`));
  let out = Array.from(set).map(s => {
    let [r, c] = s.split(',').map(Number);
    return { r, c };
  });
  // 炸弹规则：进阶才掉，且 4 消以上
  if (!isEasy) {
    mark5.forEach(p => bombs.push(p)); // 5 消必掉
    mark4.forEach(p => bombs.push(p)); // 4 消也掉
  }
  return out;
}
function eliminate(matches) {
  matches.forEach(p => (grid[p.r][p.c] = -1));
  flashBorder(true);
}
// function dropOnce() {
//   let moved = false;
//   for (let c = 0; c < COL; c++) {
//     let write = ROW - 1;
//     for (let read = ROW - 1; read >= 0; read--) {
//       if (grid[read][c] >= 0) {
//         if (read !== write) {
//           grid[write][c] = grid[read][c];
//           grid[read][c] = -1;
//           moved = true;
//         }
//         write--;
//       }
//     }
//     // 顶部补新
//     for (let r = 0; r <= write; r++) {
//       grid[r][c] = floor(random(TYPE));
//       moved = true;
//     }
//   }
//   return moved;
// }
/************ 5. 极简动画 ************/
function flashBorder(ok) {
  // 用背景闪一下代替复杂动画
  let col = ok ? color(120, 80, 80, 100) : color(0, 80, 80, 100);
  for (let i = 0; i < 3; i++) {
    background(col);
    draw();
  }
}
function handleAnim() {
  if (animQueue.length && animQueue[0].type === 'drop') {
    let moved = dropStep(); // 一次只落一格
    if (!moved) {
      animQueue.shift();
      let m = findAllMatches();
      if (m.length) {
        score += m.length * 100;
        eliminate(m);
        animQueue.push({ type: 'drop' });
      }
    }
  }
}
function dropStep() {
  let moved = false;
  for (let c = 0; c < COL; c++) {
    // 1. 先让现有方块下落一格
    for (let r = ROW - 2; r >= 0; r--) {
      if (grid[r][c] >= 0 && grid[r + 1][c] === -1) {
        grid[r + 1][c] = grid[r][c];
        grid[r][c] = -1;
        moved = true;
      }
    }
    // 2. 如果最顶还是空，就生成新方块
    if (grid[0][c] === -1) {
      grid[0][c] = floor(random(TYPE));
      moved = true;   // 视为“发生过移动”，下一帧继续 drop
    }
  }
  return moved;
}
function eliminate(matches) {
  // 先普通消除
  matches.forEach(p => {
    animPop.push({ r: p.r, c: p.c, scale: 1, alpha: 255 });
    grid[p.r][p.c] = -1;
  });
  // 再处理炸弹
  bombs.forEach(b => {
    // 炸周围 1 格
    for (let dr = -BOMB_RADIUS; dr <= BOMB_RADIUS; dr++) {
      for (let dc = -BOMB_RADIUS; dc <= BOMB_RADIUS; dc++) {
        let rr = b.r + dr, cc = b.c + dc;
        if (outBound(rr, cc)) continue;
        animPop.push({ r: rr, c: cc, scale: 1.2, alpha: 255 });
        grid[rr][cc] = -1;
      }
    }
  });
  bombs = []; // 用完清空
  animQueue.push({ type: 'drop' });
}

function startGame() {
  timer = timeLimit;
  spaceLeft = 3;
  score = 0;
  combo = 0;
  bombs = [];
  animQueue = [];
  animPop = [];
  animSwap = null;
  selected = null;
  initGrid();
  gameState = STATE.PLAY;
}

function resetGame() {
  gameState = STATE.READY;
}

function drawEnd(msg) {
  fill(0, 0, 0, 180);
  rect(0, 0, width, height);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(36);
  text(msg, width / 2, height / 2 - 20);
  textSize(18);
  text('Score: ' + score, width / 2, height / 2 + 20);
  text('Press R to restart', width / 2, height / 2 + 50);
}

function drawPauseOverlay() {
  fill(0, 0, 0, 120);
  rect(0, 0, width, height);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(32);
  text('PAUSED', width / 2, height / 2);
}