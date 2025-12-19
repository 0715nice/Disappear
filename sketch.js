/************ 状态机 ************/
const STATE = { READY: 0, PLAY: 1, PAUSE: 2, WIN: 3, LOSE: 4 };
let gameState = STATE.READY;

/************ 模式 ************/
let isEasy = true;
let timeLimit = 60;
let timer = timeLimit;
let spaceLeft = 3;

/************ 炸弹 ************/
let bombs = [];
const BOMB_RADIUS = 1;

/************ 计分 ************/
let combo = 0;

// 回弹动画
let animBack = null;
const BACK_FRAMES = 10;

/************ 资源 ************/
let img = [];
function preload() {
  for (let i = 0; i < TYPE; i++) {
    img[i] = loadImage('assets/t' + i + '.png',
      () => console.log('t' + i + ' ok'),
      () => console.warn('t' + i + ' fail')
    );
  }
}

/************ 动画参数 ************/
let animSwap = null;
const SWAP_FRAMES = 10;
let animPop = [];
const POP_FRAMES = 12;

/************ 全局参数 ************/
const COL = 8, ROW = 8, TYPE = 6, S = 60;
let grid;
let score = 0;
let selected = null;
let animQueue = [];

/************ 生命周期 ************/
function setup() {
  createCanvas(COL * S + 40, ROW * S + 180);
  colorMode(HSB, TYPE * 10, 100, 100);
  textAlign(LEFT, CENTER);
  noStroke();
  // ① 不再这里初始化阵列！
}

function draw() {
  background(0, 0, 95);

  switch (gameState) {
    case STATE.READY:
      drawReady();
      break;
    case STATE.PLAY:
    case STATE.PAUSE:
      /* ② 只有这两个状态才画游戏内容 */
      drawUI();
      drawGrid();
      drawSwapAnim();
      handleAnim();
      if (gameState === STATE.PAUSE) drawPauseOverlay();
      break;
    case STATE.WIN:
      drawEnd('YOU WIN !');
      break;
    case STATE.LOSE:
      drawEnd('GAME OVER');
      break;
  }

  // ③ 回弹动画仍全局画（它覆盖在阵列上方）
  if (animBack) drawBackAnim();
}

/************ 1. 数据层 ************/
function initGrid() {
  grid = [];
  for (let r = 0; r < ROW; r++) {
    grid[r] = [];
    for (let c = 0; c < COL; c++) {
      let t = floor(random(TYPE));
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
      // 如果正在交换或回弹，跳过被动画覆盖的两个格子
      let skip = false;
      if (animSwap && ((r === animSwap.sr && c === animSwap.sc) || (r === animSwap.tr && c === animSwap.tc))) skip = true;
      if (animBack && ((r === animBack.sr && c === animBack.sc) || (r === animBack.tr && c === animBack.tc))) skip = true;
      if (!skip && grid[r][c] >= 0) image(img[grid[r][c]], x, y, S, S);
      // 选中框
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
    let w = map(timer, 0, timeLimit, 0, width - 40);
    fill(0, 80, 80);
    rect(20, 70, w, 8, 5);
  }
}

/************ 3. 输入层 ************/
function mousePressed() {
  // READY 界面
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
  // 游戏主流程
  if (animSwap || animBack || animQueue.length || gameState !== STATE.PLAY) return;
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

/************ 4. 逻辑层 ************/
function swap(r1, c1, r2, c2) {
  let t = grid[r1][c1];
  grid[r1][c1] = grid[r2][c2];
  grid[r2][c2] = t;
}
function findAllMatches() {
  let res = [];
  let mark4 = [], mark5 = [];
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
  // 纵向
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
  let set = new Set();
  res.forEach(p => set.add(`${p.r},${p.c}`));
  let out = Array.from(set).map(s => {
    let [r, c] = s.split(',').map(Number);
    return { r, c };
  });
  if (!isEasy) {
    mark5.forEach(p => bombs.push(p));
    mark4.forEach(p => bombs.push(p));
  }
  return out;
}
function eliminate(matches) {
  matches.forEach(p => {
    animPop.push({ r: p.r, c: p.c, scale: 1, alpha: 255 });
    grid[p.r][p.c] = -1;
  });
  bombs.forEach(b => {
    for (let dr = -BOMB_RADIUS; dr <= BOMB_RADIUS; dr++) {
      for (let dc = -BOMB_RADIUS; dc <= BOMB_RADIUS; dc++) {
        let rr = b.r + dr, cc = b.c + dc;
        if (outBound(rr, cc)) continue;
        animPop.push({ r: rr, c: cc, scale: 1.2, alpha: 255 });
        grid[rr][cc] = -1;
      }
    }
  });
  bombs = [];
  animQueue.push({ type: 'drop' });
}
function dropStep() {
  let moved = false;
  for (let c = 0; c < COL; c++) {
    for (let r = ROW - 2; r >= 0; r--) {
      if (grid[r][c] >= 0 && grid[r + 1][c] === -1) {
        grid[r + 1][c] = grid[r][c];
        grid[r][c] = -1;
        moved = true;
      }
    }
    if (grid[0][c] === -1) {
      grid[0][c] = floor(random(TYPE));
      moved = true;
    }
  }
  return moved;
}
function handleAnim() {
  if (animQueue.length && animQueue[0].type === 'drop') {
    let moved = dropStep();
    if (!moved) {
      animQueue.shift();
      let m = findAllMatches();
      if (m.length) {
        score += m.length * 100;
        combo++;
        eliminate(m);
        animQueue.push({ type: 'drop' });
      } else {
        combo = 0; // 连击断
        // 简易胜利判定：Easy 2000 分，Hard 3000 分
        if ((isEasy && score >= 2000) || (!isEasy && score >= 3000)) {
          gameState = STATE.WIN;
        }
      }
    }
  }
}

/************ 5. 动画 & UI ************/
function drawBackAnim() {
  if (!animBack) return;
  let {sr, sc, tr, tc, p} = animBack;
  let sx = sc * S + 20, sy = sr * S + 80;
  let tx = tc * S + 20, ty = tr * S + 80;
  let t = p / BACK_FRAMES;
  let cx = lerp(tx, sx, t);
  let cy = lerp(ty, sy, t);

  fill(0, 80, 80, 120);
  rect(tx, ty, S, S, 5);
  image(img[grid[tr][tc]], tx, ty, S, S);
  image(img[grid[sr][sc]], cx, cy, S, S);

  animBack.p++;
  if (animBack.p >= BACK_FRAMES) {
    // 回弹动画结束时回滚数据
    swap(sr, sc, tr, tc);
    animBack = null;
  }
}

function drawSwapAnim() {
  if (!animSwap) return;
  let { sr, sc, tr, tc, p } = animSwap;
  let sx = sc * S + 20, sy = sr * S + 80;
  let tx = tc * S + 20, ty = tr * S + 80;
  let t = p / SWAP_FRAMES;
  let cx = lerp(sx, tx, t);
  let cy = lerp(sy, ty, t);
  let cx2 = lerp(tx, sx, t);
  let cy2 = lerp(ty, sy, t);

  // 用当前格子上的图像做动画（尚未在数据层真正交换）
  image(img[grid[sr][sc]], cx, cy, S, S);
  image(img[grid[tr][tc]], cx2, cy2, S, S);

  animSwap.p++;
  if (animSwap.p >= SWAP_FRAMES) {
    // 动画结束后在数据层交换并处理消除
    swap(sr, sc, tr, tc);
    let m = findAllMatches();
    if (m.length) {
      score += m.length * 100;
      combo++;
      eliminate(m);
      animQueue.push({ type: 'drop' });
    } else {
      // 无消除则触发回弹动画（回弹时数据仍为交换后的状态，回弹结束时再回滚）
      animBack = { sr, sc, tr, tc, p: 0 };
    }
    animSwap = null;
  }
}

function drawReady() {
  fill(0);
  textSize(32);
  text('CUTE  MATCH', 20, 40);
  textSize(18);
  text('Choose mode to start', 20, 80);

  fill(isEasy ? color(120, 60, 90) : color(0, 0, 80));
  rect(40, 120, 120, 40, 10);
  fill(255);
  text('Easy', 80, 142);

  fill(!isEasy ? color(0, 80, 90) : color(0, 0, 80));
  rect(180, 120, 120, 40, 10);
  fill(255);
  text('Hard', 220, 142);

  fill(0);
  text('R-restart  ESC-pause  Space-shuffle(3)', 20, height - 40);
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

/************ 6. 控制 ************/
function startGame() {
  timer = timeLimit;
  spaceLeft = 3;
  score = 0;
  combo = 0;
  bombs = [];
  animQueue = [];
  animPop = [];
  animSwap = null;
  animBack = null;
  selected = null;
  initGrid();               // ④ 真正初始化阵列
  gameState = STATE.PLAY;
}

function resetGame() {
  gameState = STATE.READY;  // 回到欢迎页，阵列不再绘制
}

setInterval(() => {
  if (gameState === STATE.PLAY && !isEasy) {
    timer -= 1;
    if (timer <= 0) gameState = STATE.LOSE;
  }
}, 1000);