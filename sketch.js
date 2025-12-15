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
        rect(x + 2, y + 2, S - 4, S - 4, 5);
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
}
function drawUI() {
  fill(0);
  textSize(24);
  text('Score: ' + score, 20, 30);
}
/************ 3. 输入层 ************/
function mousePressed() {
  // 像素→格子
  let c = floor((mouseX - 20) / S);
  let r = floor((mouseY - 80) / S);
  if (r < 0 || r >= ROW || c < 0 || c >= COL) return;
  if (!selected) {
    selected = { r, c };
  } else {
    let sr = selected.r, sc = selected.c;
    if (abs(sr - r) + abs(sc - c) === 1) {
      // 相邻→尝试交换
      swap(sr, sc, r, c);
      let matches = findAllMatches();
      if (matches.length) {
        score += matches.length * 100; // 先简单 100/组
        eliminate(matches);
        animQueue.push({ type: 'drop', frame: 0 });
      } else {
        // 无匹配，退回
        swap(sr, sc, r, c);
        flashBorder(false);
      }
    }
    selected = null;
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
function dropOnce() {
  let moved = false;
  for (let c = 0; c < COL; c++) {
    let write = ROW - 1;
    for (let read = ROW - 1; read >= 0; read--) {
      if (grid[read][c] >= 0) {
        if (read !== write) {
          grid[write][c] = grid[read][c];
          grid[read][c] = -1;
          moved = true;
        }
        write--;
      }
    }
    // 顶部补新
    for (let r = 0; r <= write; r++) {
      grid[r][c] = floor(random(TYPE));
      moved = true;
    }
  }
  return moved;
}
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
  // 只有 drop 动画：逐帧下落直到稳定
  if (animQueue.length && animQueue[0].type === 'drop') {
    if (!dropOnce()) {
      animQueue.shift(); // 落完
      // 继续检测新匹配
      let m = findAllMatches();
      if (m.length) {
        score += m.length * 100;
        eliminate(m);
        animQueue.push({ type: 'drop', frame: 0 });
      }
    }
  }
}