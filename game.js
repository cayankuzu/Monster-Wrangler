const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const overlay = document.querySelector("#gameOverlay");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayText = document.querySelector("#overlayText");
const startButton = document.querySelector("#startButton");
const soundButton = document.querySelector("#soundButton");
const helpButton = document.querySelector("#helpButton");
const helpMarkup = overlayText.innerHTML;
const helpTitle = overlayTitle.textContent;

const ASSET = "monster_wrangler_assets/";
const sprites = {
  knight: loadImage(`${ASSET}knight.png`),
  monsters: [
    loadImage(`${ASSET}blue_monster.png`),
    loadImage(`${ASSET}green_monster.png`),
    loadImage(`${ASSET}purple_monster.png`),
    loadImage(`${ASSET}yellow_monster.png`),
  ],
};
const sounds = {
  catch: new Audio(`${ASSET}catch.wav`),
  die: new Audio(`${ASSET}die.wav`),
  warp: new Audio(`${ASSET}warp.wav`),
  next: new Audio(`${ASSET}next_level.wav`),
};

const colors = ["#14b0eb", "#57c92f", "#e249f3", "#f39d14"];
const keys = new Set();
let soundEnabled = true;
let running = false;
let gameOver = false;
let hasStarted = false;
let overlayMode = "start";
let lastTime = 0;
let width = 1200;
let height = 700;
let scale = 1;
let score = 0;
let round = 0;
let roundTime = 0;
let targetType = 0;
let monsters = [];
let lastCollisionAt = 0;

const player = {
  x: 568,
  y: 636,
  size: 64,
  lives: 5,
  warps: 2,
  speed: 470,
};

function loadImage(src) {
  const image = new Image();
  image.src = src;
  return image;
}

function playSound(name) {
  if (!soundEnabled) return;
  const sound = sounds[name];
  sound.currentTime = 0;
  sound.play().catch(() => {});
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  width = rect.width;
  height = rect.height;
  scale = Math.max(0.54, Math.min(width / 1200, height / 700));
  player.size = 64 * scale;
  player.x = clamp(player.x, 0, width - player.size);
  player.y = clamp(player.y, hudHeight(), height - player.size);
}

function hudHeight() {
  return Math.max(72, 100 * scale);
}

function safeZone() {
  return Math.max(28, 100 * scale);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function random(min, max) {
  return min + Math.random() * (max - min);
}

function resetPlayer() {
  player.x = width / 2 - player.size / 2;
  player.y = height - player.size;
}

function newRound() {
  if (round > 0) score += Math.floor((10000 * round) / (1 + roundTime));
  round += 1;
  roundTime = 0;
  player.warps += 1;
  monsters = [];
  const size = 64 * scale;
  for (let wave = 0; wave < round; wave += 1) {
    colors.forEach((_, type) => {
      monsters.push({
        type,
        x: random(0, Math.max(1, width - size)),
        y: random(hudHeight(), Math.max(hudHeight() + 1, height - safeZone() - size)),
        size,
        dx: Math.random() < 0.5 ? -1 : 1,
        dy: Math.random() < 0.5 ? -1 : 1,
        speed: random(70, 230) * Math.max(0.78, scale),
      });
    });
  }
  chooseTarget();
  resetPlayer();
  playSound("next");
}

function chooseTarget() {
  const candidate = monsters[Math.floor(Math.random() * monsters.length)];
  targetType = candidate?.type ?? 0;
}

function resetGame() {
  score = 0;
  round = 0;
  roundTime = 0;
  player.lives = 5;
  player.warps = 2;
  gameOver = false;
  newRound();
}

function startGame() {
  overlay.classList.remove("is-visible");
  running = true;
  hasStarted = true;
  overlayMode = "resume";
  if (gameOver || round === 0) resetGame();
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function showGameOver() {
  running = false;
  gameOver = true;
  hasStarted = false;
  overlayMode = "restart";
  overlayTitle.textContent = `Final skor: ${score.toLocaleString("tr-TR")}`;
  overlayText.textContent = `Toplam ${round} tura ulaştın. Yeni bir seri için tekrar başlayabilirsin.`;
  startButton.textContent = "Tekrar oyna";
  overlay.classList.add("is-visible");
}

function showHelp() {
  const canResume = hasStarted && !gameOver;
  running = false;
  keys.clear();
  overlayMode = canResume ? "resume" : "start";
  overlayTitle.textContent = helpTitle;
  overlayText.innerHTML = helpMarkup;
  startButton.textContent = canResume ? "Oyuna dön" : "Oyuna başla";
  overlay.classList.add("is-visible");
}

function handleOverlayAction() {
  if (overlayMode === "resume") {
    overlay.classList.remove("is-visible");
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(loop);
    return;
  }
  startGame();
}

function warp() {
  if (!running || player.warps <= 0) return;
  player.warps -= 1;
  resetPlayer();
  playSound("warp");
}

function update(dt, now) {
  roundTime += dt;
  const left = keys.has("ArrowLeft") || keys.has("KeyA");
  const right = keys.has("ArrowRight") || keys.has("KeyD");
  const up = keys.has("ArrowUp") || keys.has("KeyW");
  const down = keys.has("ArrowDown") || keys.has("KeyS");
  const diagonal = (left || right) && (up || down) ? Math.SQRT1_2 : 1;
  const distance = player.speed * scale * dt * diagonal;

  if (left) player.x -= distance;
  if (right) player.x += distance;
  if (up) player.y -= distance;
  if (down) player.y += distance;

  player.x = clamp(player.x, 0, width - player.size);
  player.y = clamp(player.y, hudHeight(), height - player.size);

  monsters.forEach((monster) => {
    monster.x += monster.dx * monster.speed * dt;
    monster.y += monster.dy * monster.speed * dt;
    if (monster.x <= 0 || monster.x + monster.size >= width) {
      monster.x = clamp(monster.x, 0, width - monster.size);
      monster.dx *= -1;
    }
    if (monster.y <= hudHeight() || monster.y + monster.size >= height - safeZone()) {
      monster.y = clamp(monster.y, hudHeight(), height - safeZone() - monster.size);
      monster.dy *= -1;
    }
  });

  if (now - lastCollisionAt < 450) return;
  const index = monsters.findIndex((monster) => intersects(player, monster));
  if (index < 0) return;
  lastCollisionAt = now;
  const caught = monsters[index];
  if (caught.type === targetType) {
    score += 100 * round;
    monsters.splice(index, 1);
    if (monsters.length === 0) {
      newRound();
    } else {
      playSound("catch");
      chooseTarget();
    }
  } else {
    playSound("die");
    player.lives -= 1;
    resetPlayer();
    if (player.lives <= 0) showGameOver();
  }
}

function intersects(a, b) {
  const pad = 9 * scale;
  return (
    a.x + pad < b.x + b.size - pad &&
    a.x + a.size - pad > b.x + pad &&
    a.y + pad < b.y + b.size - pad &&
    a.y + a.size - pad > b.y + pad
  );
}

function draw() {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#020305";
  ctx.fillRect(0, 0, width, height);

  const top = hudHeight();
  const bottom = height - safeZone();
  const arenaGradient = ctx.createLinearGradient(0, top, width, bottom);
  arenaGradient.addColorStop(0, "rgba(54, 28, 90, .2)");
  arenaGradient.addColorStop(1, "rgba(9, 87, 66, .14)");
  ctx.fillStyle = arenaGradient;
  ctx.fillRect(0, top, width, bottom - top);

  ctx.strokeStyle = colors[targetType];
  ctx.lineWidth = Math.max(2, 4 * scale);
  ctx.strokeRect(2, top, width - 4, bottom - top);

  const fontSize = clamp(17 * scale, 11, 22);
  ctx.font = `700 ${fontSize}px ui-sans-serif, system-ui`;
  ctx.textBaseline = "top";
  ctx.fillStyle = "#fff";
  ctx.fillText(`Skor: ${score}`, 10, 10);
  ctx.fillText(`Can: ${player.lives}`, 10, 13 + fontSize);
  ctx.fillText(`Tur: ${round}`, 10, 16 + fontSize * 2);

  ctx.textAlign = "right";
  ctx.fillText(`Süre: ${Math.floor(roundTime)} sn`, width - 10, 10);
  ctx.fillText(`Işınlanma: ${player.warps}`, width - 10, 13 + fontSize);
  ctx.textAlign = "center";
  ctx.fillStyle = "#c8cad0";
  ctx.fillText("HEDEF", width / 2, 6);
  const targetSize = clamp(52 * scale, 34, 58);
  ctx.strokeStyle = colors[targetType];
  ctx.lineWidth = 2;
  ctx.strokeRect(width / 2 - targetSize / 2, 27 * scale, targetSize, targetSize);
  drawImage(sprites.monsters[targetType], width / 2 - targetSize / 2, 27 * scale, targetSize);

  monsters.forEach((monster) => {
    drawImage(sprites.monsters[monster.type], monster.x, monster.y, monster.size);
  });
  drawImage(sprites.knight, player.x, player.y, player.size);

  ctx.fillStyle = "rgba(255,255,255,.055)";
  ctx.fillRect(0, bottom, width, height - bottom);
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,.35)";
  ctx.font = `700 ${clamp(12 * scale, 9, 13)}px ui-sans-serif, system-ui`;
  ctx.fillText("GÜVENLİ ALAN", width / 2, bottom + 8);
  ctx.textAlign = "left";
}

function drawImage(image, x, y, size) {
  if (image.complete) ctx.drawImage(image, x, y, size, size);
}

function loop(now) {
  if (!running) return;
  const dt = Math.min((now - lastTime) / 1000, 0.034);
  lastTime = now;
  update(dt, now);
  draw();
  if (running) requestAnimationFrame(loop);
}

function setControl(code, active, button) {
  if (active) keys.add(code);
  else keys.delete(code);
  button?.classList.toggle("is-active", active);
}

window.addEventListener("keydown", (event) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
    event.preventDefault();
  }
  if (event.code === "Space" && !event.repeat) warp();
  keys.add(event.code);
});
window.addEventListener("keyup", (event) => keys.delete(event.code));
window.addEventListener("blur", () => keys.clear());
window.addEventListener("resize", resize);

document.querySelectorAll("[data-key]").forEach((button) => {
  const code = button.dataset.key;
  const press = (event) => {
    event.preventDefault();
    if (code === "Space") warp();
    else setControl(code, true, button);
    button.setPointerCapture?.(event.pointerId);
  };
  const release = (event) => {
    event.preventDefault();
    setControl(code, false, button);
  };
  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
});

startButton.addEventListener("click", handleOverlayAction);
helpButton.addEventListener("click", showHelp);
soundButton.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundButton.textContent = soundEnabled ? "Ses açık" : "Ses kapalı";
  soundButton.setAttribute("aria-pressed", String(soundEnabled));
  Object.values(sounds).forEach((sound) => {
    sound.muted = !soundEnabled;
  });
});

resize();
resetPlayer();
draw();
