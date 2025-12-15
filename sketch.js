let img = []; // 存放 6 张 emoji
function preload() {
  for (let i = 0; i < TYPE; i++) {
    img[i] = loadImage('assets/t' + i + '.png',
      () => console.log('t' + i + ' ok'),   // 成功
      () => console.warn('t' + i + ' fail') // 失败
    );
  }
}

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
  createCanvas(COL * S + 40, ROW * S + 120);
  colorMode(HSB, TYPE * 10, 100, 100); // 用 HSB 快速配 6 种区分色
  textAlign(LEFT, CENTER);
  noStroke();
  initGrid();
}
function draw() {
  background(0, 0, 95);
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
    animSwap = null;
    // 检测匹配
    let m = findAllMatches();
    if (m.length) {
      score += m.length * 100;
      eliminate(m);
      animQueue.push({ type: 'drop' });
    }
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
}
/************ 3. 输入层 ************/
function mousePressed() {
  // 如果正在动画直接返回
  if (animSwap || animQueue.length) return;
  let c = floor((mouseX - 20) / S);
  let r = floor((mouseY - 80) / S);
  if (outBound(r, c)) return;
  if (!selected) {
    selected = { r, c, drag: true, x: mouseX, y: mouseY }; // 记录拖动
  } else {
    let sr = selected.r, sc = selected.c;
    if (abs(sr - r) + abs(sc - c) === 1) {
      // 开始交换动画
      animSwap = { sr, sc, tr: r, tc: c, p: 0 };
      selected = null;
    } else {
      selected = null; // 取消
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
  // 横向
  for (let r = 0; r < ROW; r++) {
    for (let c = 0; c < COL - 2; ) {
      let t = grid[r][c];
      if (t < 0) { c++; continue; }
      let len = 1;
      while (c + len < COL && grid[r][c + len] === t) len++;
      if (len >= 3) {
        for (let i = 0; i < len; i++) res.push({ r, c: c + i });
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
        r += len;
      } else r++;
    }
  }
  // 去重
  let set = new Set();
  res.forEach(p => set.add(`${p.r},${p.c}`));
  return Array.from(set).map(s => {
    let [r, c] = s.split(',').map(Number);
    return { r, c };
  });
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
  matches.forEach(p => {
    animPop.push({ r: p.r, c: p.c, scale: 1, alpha: 255 });
    grid[p.r][p.c] = -1;
  });
  animQueue.push({ type: 'drop' });   // ← 保证有掉落
}