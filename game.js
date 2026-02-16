const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });

if (!ctx) {
  throw new Error("Unable to initialize 2D canvas context in this browser.");
}

function normalizeKey(key) {
  const value = String(key || "").toLowerCase();
  if (value === "spacebar" || value === "space") {
    return " ";
  }
  return value;
}

const CONFIG = {
  tileW: 76,
  tileH: 30,
  worldWidth: 12,
  scrollSpeed: 3.2,
  playerSpeedX: 0.16,
  playerSpeedY: 0.16,
  playerSpeedZ: 0.2,
  bulletSpeed: 0.55,
  enemySpeed: 0.13,
};

const state = {
  keys: new Set(),
  gameOver: false,
  score: 0,
  lives: 3,
  worldOffsetY: 0,
  fireCooldown: 0,
  spawnCooldown: 0,
  obstacleCooldown: 0,
  player: {
    x: CONFIG.worldWidth * 0.5,
    y: 9,
    z: 2,
    radius: 0.35,
  },
  bullets: [],
  enemies: [],
  obstacles: [],
  explosions: [],
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isoToScreen(x, y, z) {
  const centerX = canvas.width * 0.5;
  const baseY = 110;
  const sx = (x - y) * (CONFIG.tileW * 0.5) + centerX;
  const sy = (x + y) * (CONFIG.tileH * 0.5) + baseY - z * 44;
  return { x: sx, y: sy };
}

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function spawnEnemy() {
  state.enemies.push({
    x: randomRange(1.2, CONFIG.worldWidth - 1.2),
    y: state.worldOffsetY - 6,
    z: randomRange(0.8, 3.5),
    radius: 0.45,
    wobble: randomRange(0, Math.PI * 2),
  });
}

function spawnObstacle() {
  const width = randomRange(1.2, 2.8);
  const depth = randomRange(1, 2);
  const x = randomRange(0.5, CONFIG.worldWidth - width - 0.5);
  state.obstacles.push({
    x,
    y: state.worldOffsetY - 6,
    z: randomRange(0.2, 2.6),
    width,
    depth,
    height: randomRange(0.6, 2.8),
  });
}

function addExplosion(x, y, z, color) {
  state.explosions.push({
    x,
    y,
    z,
    life: 0.5,
    maxLife: 0.5,
    color,
  });
}

function resetGame() {
  state.gameOver = false;
  state.score = 0;
  state.lives = 3;
  state.worldOffsetY = 0;
  state.fireCooldown = 0;
  state.spawnCooldown = 0;
  state.obstacleCooldown = 0;
  state.player.x = CONFIG.worldWidth * 0.5;
  state.player.y = 9;
  state.player.z = 2;
  state.bullets.length = 0;
  state.enemies.length = 0;
  state.obstacles.length = 0;
  state.explosions.length = 0;
}

function hurtPlayer() {
  state.lives -= 1;
  addExplosion(state.player.x, state.player.y, state.player.z, "#ffcf4c");
  state.player.x = CONFIG.worldWidth * 0.5;
  state.player.y = 9;
  state.player.z = 2;

  if (state.lives <= 0) {
    state.gameOver = true;
  }
}

function intersectsSphere(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  const r = a.radius + b.radius;
  return dx * dx + dy * dy + dz * dz < r * r;
}

function intersectsBoxSphere(box, sphere) {
  const x = clamp(sphere.x, box.x, box.x + box.width);
  const y = clamp(sphere.y, box.y, box.y + box.depth);
  const z = clamp(sphere.z, box.z, box.z + box.height);

  const dx = sphere.x - x;
  const dy = sphere.y - y;
  const dz = sphere.z - z;
  return dx * dx + dy * dy + dz * dz < sphere.radius * sphere.radius;
}

function update(dt) {
  if (state.keys.has("r") && state.gameOver) {
    resetGame();
  }

  if (state.gameOver) {
    return;
  }

  state.worldOffsetY += CONFIG.scrollSpeed * dt;

  const moveX =
    (state.keys.has("arrowright") || state.keys.has("d") ? 1 : 0) -
    (state.keys.has("arrowleft") || state.keys.has("a") ? 1 : 0);

  const moveY =
    (state.keys.has("arrowdown") || state.keys.has("s") ? 1 : 0) -
    (state.keys.has("arrowup") || state.keys.has("w") ? 1 : 0);

  const moveZ = (state.keys.has("e") ? 1 : 0) - (state.keys.has("q") ? 1 : 0);

  state.player.x = clamp(state.player.x + moveX * CONFIG.playerSpeedX * dt, 0.4, CONFIG.worldWidth - 0.4);
  state.player.y = clamp(state.player.y + moveY * CONFIG.playerSpeedY * dt, state.worldOffsetY + 5, state.worldOffsetY + 12);
  state.player.z = clamp(state.player.z + moveZ * CONFIG.playerSpeedZ * dt, 0.1, 5.5);

  state.fireCooldown -= dt;
  if (state.keys.has(" ") && state.fireCooldown <= 0) {
    state.fireCooldown = 0.15;
    state.bullets.push({
      x: state.player.x,
      y: state.player.y - 0.3,
      z: state.player.z,
      radius: 0.2,
    });
  }

  state.spawnCooldown -= dt;
  if (state.spawnCooldown <= 0) {
    state.spawnCooldown = randomRange(0.45, 1.1);
    spawnEnemy();
  }

  state.obstacleCooldown -= dt;
  if (state.obstacleCooldown <= 0) {
    state.obstacleCooldown = randomRange(0.8, 1.8);
    spawnObstacle();
  }

  for (const bullet of state.bullets) {
    bullet.y -= CONFIG.bulletSpeed * dt;
  }

  for (const enemy of state.enemies) {
    enemy.y += CONFIG.enemySpeed * dt;
    enemy.x += Math.sin((state.worldOffsetY + enemy.wobble) * 0.08) * 0.01 * dt;
  }

  for (const obstacle of state.obstacles) {
    obstacle.y += CONFIG.enemySpeed * dt * 0.5;
  }

  for (const explosion of state.explosions) {
    explosion.life -= dt;
  }

  state.explosions = state.explosions.filter((exp) => exp.life > 0);

  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = state.bullets[i];
    let removed = false;

    for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
      if (intersectsSphere(bullet, state.enemies[j])) {
        const enemy = state.enemies[j];
        addExplosion(enemy.x, enemy.y, enemy.z, "#ff5741");
        state.score += 100;
        state.enemies.splice(j, 1);
        state.bullets.splice(i, 1);
        removed = true;
        break;
      }
    }

    if (!removed) {
      for (let j = state.obstacles.length - 1; j >= 0; j -= 1) {
        if (intersectsBoxSphere(state.obstacles[j], bullet)) {
          state.bullets.splice(i, 1);
          removed = true;
          break;
        }
      }
    }

    if (!removed && bullet.y < state.worldOffsetY - 8) {
      state.bullets.splice(i, 1);
    }
  }

  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = state.enemies[i];

    if (intersectsSphere(enemy, state.player)) {
      addExplosion(enemy.x, enemy.y, enemy.z, "#ff7063");
      state.enemies.splice(i, 1);
      hurtPlayer();
      continue;
    }

    if (enemy.y > state.worldOffsetY + 14) {
      state.enemies.splice(i, 1);
    }
  }

  for (let i = state.obstacles.length - 1; i >= 0; i -= 1) {
    const obstacle = state.obstacles[i];

    if (intersectsBoxSphere(obstacle, state.player)) {
      state.obstacles.splice(i, 1);
      hurtPlayer();
      continue;
    }

    if (obstacle.y > state.worldOffsetY + 16) {
      state.obstacles.splice(i, 1);
    }
  }

  state.score += Math.floor(dt * 4);
}

function drawGrid() {
  const gridDepth = 20;
  const start = Math.floor(state.worldOffsetY) - 4;
  const end = start + gridDepth;

  ctx.save();
  ctx.globalAlpha = 0.75;

  for (let gy = start; gy <= end; gy += 1) {
    const left = isoToScreen(0, gy, 0);
    const right = isoToScreen(CONFIG.worldWidth, gy, 0);
    const p = (gy - start) / gridDepth;
    ctx.strokeStyle = `rgb(${45 + p * 50}, ${80 + p * 70}, ${120 + p * 80})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    ctx.stroke();
  }

  for (let gx = 0; gx <= CONFIG.worldWidth; gx += 1) {
    const near = isoToScreen(gx, start, 0);
    const far = isoToScreen(gx, end, 0);
    ctx.strokeStyle = "rgba(165, 198, 255, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(near.x, near.y);
    ctx.lineTo(far.x, far.y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawPrism(x, y, z, w, d, h, color) {
  const c1 = isoToScreen(x, y, z);
  const c2 = isoToScreen(x + w, y, z);
  const c3 = isoToScreen(x + w, y + d, z);
  const c4 = isoToScreen(x, y + d, z);

  const t1 = isoToScreen(x, y, z + h);
  const t2 = isoToScreen(x + w, y, z + h);
  const t3 = isoToScreen(x + w, y + d, z + h);
  const t4 = isoToScreen(x, y + d, z + h);

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(t1.x, t1.y);
  ctx.lineTo(t2.x, t2.y);
  ctx.lineTo(t3.x, t3.y);
  ctx.lineTo(t4.x, t4.y);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(27, 44, 70, 0.85)";
  ctx.beginPath();
  ctx.moveTo(c1.x, c1.y);
  ctx.lineTo(c2.x, c2.y);
  ctx.lineTo(t2.x, t2.y);
  ctx.lineTo(t1.x, t1.y);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(51, 75, 105, 0.9)";
  ctx.beginPath();
  ctx.moveTo(c2.x, c2.y);
  ctx.lineTo(c3.x, c3.y);
  ctx.lineTo(t3.x, t3.y);
  ctx.lineTo(t2.x, t2.y);
  ctx.closePath();
  ctx.fill();
}

function drawShip(ship, isPlayer) {
  const s = isoToScreen(ship.x, ship.y, ship.z);
  const scale = isPlayer ? 1.1 : 0.9;

  ctx.save();
  ctx.translate(s.x, s.y);

  ctx.fillStyle = isPlayer ? "#6af4ff" : "#ff6b5f";
  ctx.beginPath();
  ctx.moveTo(0, -18 * scale);
  ctx.lineTo(16 * scale, 10 * scale);
  ctx.lineTo(0, 5 * scale);
  ctx.lineTo(-16 * scale, 10 * scale);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = isPlayer ? "#c8ffff" : "#ffd6d0";
  ctx.beginPath();
  ctx.ellipse(0, -6 * scale, 5 * scale, 8 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawBullet(bullet) {
  const b = isoToScreen(bullet.x, bullet.y, bullet.z);
  ctx.fillStyle = "#fff58f";
  ctx.beginPath();
  ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawExplosion(exp) {
  const p = isoToScreen(exp.x, exp.y, exp.z);
  const lifeRatio = exp.life / exp.maxLife;
  const size = (1 - lifeRatio) * 34;

  ctx.save();
  ctx.globalAlpha = lifeRatio;
  ctx.fillStyle = exp.color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHud() {
  ctx.fillStyle = "rgba(4, 11, 24, 0.62)";
  ctx.fillRect(18, 16, 220, 78);

  ctx.fillStyle = "#d7e4ff";
  ctx.font = "bold 23px Segoe UI";
  ctx.fillText(`Score: ${state.score}`, 30, 46);
  ctx.font = "bold 20px Segoe UI";
  ctx.fillText(`Lives: ${state.lives}`, 30, 78);

  if (state.gameOver) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ffced0";
    ctx.font = "bold 54px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", canvas.width * 0.5, canvas.height * 0.5 - 20);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px Segoe UI";
    ctx.fillText("Press R to restart", canvas.width * 0.5, canvas.height * 0.5 + 24);
    ctx.textAlign = "left";
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawGrid();

  const sortedObjects = [
    ...state.obstacles.map((o) => ({ type: "obstacle", depth: o.x + o.y + o.z, value: o })),
    ...state.enemies.map((e) => ({ type: "enemy", depth: e.x + e.y + e.z, value: e })),
    ...state.bullets.map((b) => ({ type: "bullet", depth: b.x + b.y + b.z, value: b })),
    { type: "player", depth: state.player.x + state.player.y + state.player.z, value: state.player },
  ].sort((a, b) => a.depth - b.depth);

  for (const object of sortedObjects) {
    if (object.type === "obstacle") {
      drawPrism(
        object.value.x,
        object.value.y,
        object.value.z,
        object.value.width,
        object.value.depth,
        object.value.height,
        "#6288b8",
      );
    } else if (object.type === "enemy") {
      drawShip(object.value, false);
    } else if (object.type === "player") {
      drawShip(object.value, true);
    } else {
      drawBullet(object.value);
    }
  }

  for (const explosion of state.explosions) {
    drawExplosion(explosion);
  }

  drawHud();
}

let previousTime = performance.now();

function loop(currentTime) {
  const dt = Math.min((currentTime - previousTime) / 16.666, 2.5);
  previousTime = currentTime;

  update(dt);
  render();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  const key = normalizeKey(event.key);
  state.keys.add(key);
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  const key = normalizeKey(event.key);
  state.keys.delete(key);
});

resetGame();
requestAnimationFrame(loop);
