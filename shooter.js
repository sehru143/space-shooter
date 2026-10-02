const CONFIG = {
  width: 480,
  height: 640,
  colors: {
    background: "#140b28",
    backgroundGrid: "#25123a",
    player: "#59f5ff",
    playerAccent: "#ff5bce",
    bullet: "#ff78dc",
    beetle: "#9b68ff",
    beetleLight: "#c59dff",
    boss: "#ff547d",
    star: "#ffffff",
    slowStar: "#bda9ff",
    bossBar: "#ff6a9d",
    bossBarBackground: "#3d1730",
    white: "#ffffff",
    face: "#f5eaff",
    bossFace: "#ffeaf4",
    iconInk: "#201331",
    fixedText: "#9eff8f",
    powerCoffee: "#ffca69",
    powerShield: "#62f4ff",
    powerUndo: "#9eff8f"
  },
  playerSpeed: 5,
  bulletSpeed: 8,
  enemySpeed: 1.15,
  enemyBulletSpeed: 2.4,
  fireDelay: 280,
  rapidFireDelay: 105,
  rapidFireTime: 5000,
  comboWindow: 3000,
  startingLives: 3,
  starSlowSpeed: 0.35,
  starFastSpeed: 1.1,
  powerUpChance: 0.18,
  enemySpawnDelay: 900,
  bossEvery: 5,
  backgroundHueStep: 8,
  backgroundStartHue: 265,
  bossSpeed: 1.6,
  bossSpeedPerLevel: 0.06,
  powerUpSpeed: 1.6,
  maxCombo: 4
};

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const scoreElement = document.getElementById("score");
const livesElement = document.getElementById("lives");
const levelElement = document.getElementById("level");
const bestElement = document.getElementById("best");
const comboElement = document.getElementById("combo");
const bossStatusElement = document.getElementById("boss-status");
const powerStatusElement = document.getElementById("power-status");
const powerLabelElement = document.getElementById("power-label");
const powerBarElement = document.getElementById("power-bar");
const startScreen = document.getElementById("start-screen");
const gameOverScreen = document.getElementById("game-over-screen");
const finalScoreElement = document.getElementById("final-score");
const muteButton = document.getElementById("mute-button");
const fireButton = document.getElementById("fire-button");

const player = { x: CONFIG.width / 2, y: CONFIG.height - 58, width: 28, height: 30 };
const bullets = [];
const enemies = [];
const powerUps = [];
const particles = [];
const enemyBullets = [];
const slowStars = [];
const fastStars = [];
const keys = {};

let gameState = "start";
let score = 0;
let bestScore = loadBestScore();
let lives = CONFIG.startingLives;
let level = 1;
let combo = 1;
let lastHitTime = 0;
let lastShotTime = 0;
let lastTime = 0;
let spawnTimer = 0;
let spawnedThisLevel = 0;
let levelPause = 0;
let levelPauseAction = "";
let rapidFireUntil = 0;
let shieldActive = false;
let boss = null;
let bossSpawned = false;
let pointerDown = false;
let fireButtonHeld = false;
let muted = false;
let audioContext = null;
let backgroundHue = CONFIG.backgroundStartHue;

// Read the saved best score, or start at zero if storage is unavailable.
function loadBestScore() {
  try {
    return Number(localStorage.getItem("bugHunterBest")) || 0;
  } catch (error) {
    console.warn("Could not read the saved best score.", error);
    return 0;
  }
}

// Save a new best score so it is remembered next time.
function saveBestScore() {
  try {
    localStorage.setItem("bugHunterBest", String(bestScore));
  } catch (error) {
    console.warn("Could not save the best score.", error);
  }
}

// Fill both star layers with random starting positions.
function createStars() {
  for (let index = 0; index < 55; index += 1) {
    slowStars.push({
      x: Math.random() * CONFIG.width,
      y: Math.random() * CONFIG.height,
      size: 1
    });
  }
  for (let index = 0; index < 28; index += 1) {
    fastStars.push({
      x: Math.random() * CONFIG.width,
      y: Math.random() * CONFIG.height,
      size: 2
    });
  }
}

// Begin a fresh game and hide the title screen.
function startGame() {
  score = 0;
  lives = CONFIG.startingLives;
  level = 1;
  combo = 1;
  lastHitTime = 0;
  lastShotTime = 0;
  spawnTimer = 0;
  spawnedThisLevel = 0;
  levelPause = 0;
  levelPauseAction = "";
  rapidFireUntil = 0;
  shieldActive = false;
  boss = null;
  bossSpawned = false;
  player.x = CONFIG.width / 2;
  bullets.length = 0;
  enemies.length = 0;
  powerUps.length = 0;
  particles.length = 0;
  enemyBullets.length = 0;
  gameState = "playing";
  startScreen.classList.add("is-hidden");
  gameOverScreen.classList.add("is-hidden");
  backgroundHue = CONFIG.backgroundStartHue;
  updateHud();
}

// Move the ship based on keys or the finger position.
function movePlayer() {
  if (keys.ArrowLeft || keys.a || keys.A) {
    player.x -= CONFIG.playerSpeed;
  }
  if (keys.ArrowRight || keys.d || keys.D) {
    player.x += CONFIG.playerSpeed;
  }
  player.x = Math.max(player.width / 2 + 4, Math.min(CONFIG.width - player.width / 2 - 4, player.x));
}

// Add one bright bullet above the player's ship.
function shootBullet(now) {
  const delay = now < rapidFireUntil ? CONFIG.rapidFireDelay : CONFIG.fireDelay;
  if (now - lastShotTime < delay) {
    return;
  }
  bullets.push({ x: player.x, y: player.y - 18, width: 3, height: 15 });
  lastShotTime = now;
  playTone(660, 0.035, "square");
}

// Make a small bug and give it a short error-message label.
function spawnEnemy() {
  const labels = ["404", "NULL", "Error"];
  const bug = {
    x: 24 + Math.random() * (CONFIG.width - 48),
    y: -24,
    width: 28,
    height: 24,
    speed: CONFIG.enemySpeed + level * 0.12 + Math.random() * 0.45,
    label: labels[Math.floor(Math.random() * labels.length)],
    isBoss: false
  };
  enemies.push(bug);
}

// Add the large boss bug with its health and horizontal speed.
function spawnBoss() {
  boss = {
    x: CONFIG.width / 2,
    y: 94,
    width: 104,
    height: 74,
    health: 18 + level * 2,
    maxHealth: 18 + level * 2,
    direction: 1,
    shotTimer: 0,
    isBoss: true,
    label: "MEMORY LEAK"
  };
  enemies.push(boss);
  bossSpawned = true;
  playTone(180, 0.3, "sawtooth");
}

// Move bullets, bugs, stars, and temporary effects one step.
function update(deltaTime, now) {
  if (gameState !== "playing") {
    return;
  }
  const step = Math.min(deltaTime / 16.67, 2);
  movePlayer();

  if (keys.Space || pointerDown || fireButtonHeld) {
    shootBullet(now);
  }

  if (combo > 1 && now - lastHitTime > CONFIG.comboWindow) {
    combo = 1;
    updateHud();
  }

  updateStars(step);
  updateBullets(step);
  updateEnemies(step, deltaTime);
  updatePowerUps(step);
  updateParticles(step);
  checkCollision(now);
  updateLevel(deltaTime);
  updatePowerStatus(now);
  updateHud();
}

// Move the two star layers at different speeds for depth.
function updateStars(step) {
  for (let index = 0; index < slowStars.length; index += 1) {
    slowStars[index].y += CONFIG.starSlowSpeed * step;
    if (slowStars[index].y > CONFIG.height) {
      slowStars[index].y = 0;
      slowStars[index].x = Math.random() * CONFIG.width;
    }
  }
  for (let index = 0; index < fastStars.length; index += 1) {
    fastStars[index].y += CONFIG.starFastSpeed * step;
    if (fastStars[index].y > CONFIG.height) {
      fastStars[index].y = 0;
      fastStars[index].x = Math.random() * CONFIG.width;
    }
  }
}

// Move player bullets up and remove bullets that leave the screen.
function updateBullets(step) {
  for (let index = bullets.length - 1; index >= 0; index -= 1) {
    bullets[index].y -= CONFIG.bulletSpeed * step;
    if (bullets[index].y < -20) {
      bullets.splice(index, 1);
    }
  }
  for (let index = enemyBullets.length - 1; index >= 0; index -= 1) {
    enemyBullets[index].y += CONFIG.enemyBulletSpeed * step;
    if (enemyBullets[index].y > CONFIG.height + 20) {
      enemyBullets.splice(index, 1);
    }
  }
}

// Move regular bugs and make the boss move and fire.
function updateEnemies(step, deltaTime) {
  for (let index = enemies.length - 1; index >= 0; index -= 1) {
    const bug = enemies[index];
    if (bug.isBoss) {
      bug.x += bug.direction * (CONFIG.bossSpeed + level * CONFIG.bossSpeedPerLevel) * step;
      if (bug.x < bug.width / 2 + 8 || bug.x > CONFIG.width - bug.width / 2 - 8) {
        bug.direction *= -1;
      }
      bug.shotTimer += deltaTime;
      if (bug.shotTimer > 1500) {
        enemyBullets.push({ x: bug.x, y: bug.y + bug.height / 2, width: 7, height: 12 });
        bug.shotTimer = 0;
      }
    } else {
      bug.y += bug.speed * step;
      bug.x += Math.sin((bug.y + index * 23) / 22) * 0.6 * step;
      if (bug.y > CONFIG.height + bug.height) {
        enemies.splice(index, 1);
        loseLife();
      }
    }
  }
}

// Move falling power-ups and remove the ones the player missed.
function updatePowerUps(step) {
  for (let index = powerUps.length - 1; index >= 0; index -= 1) {
    powerUps[index].y += CONFIG.powerUpSpeed * step;
    if (powerUps[index].y > CONFIG.height + 20) {
      powerUps.splice(index, 1);
    }
  }
}

// Age sparkles and floating FIXED messages until they disappear.
function updateParticles(step) {
  for (let index = particles.length - 1; index >= 0; index -= 1) {
    const particle = particles[index];
    particle.x += particle.vx * step;
    particle.y += particle.vy * step;
    particle.life -= step;
    if (particle.life <= 0) {
      particles.splice(index, 1);
    }
  }
}

// Start a new level after its bugs are cleared, or bring in a boss.
function updateLevel(deltaTime) {
  if (levelPause > 0) {
    levelPause -= deltaTime;
    if (levelPause <= 0) {
      if (levelPauseAction === "spawn-boss") {
        spawnBoss();
      } else {
        level += 1;
        spawnedThisLevel = 0;
        bossSpawned = false;
        backgroundHue = CONFIG.backgroundStartHue + (level - 1) * CONFIG.backgroundHueStep;
        updateHud();
      }
      levelPauseAction = "";
    }
    return;
  }

  if (level % CONFIG.bossEvery === 0) {
    if (!bossSpawned) {
      levelPause = 1200;
      levelPauseAction = "spawn-boss";
      bossSpawned = true;
    }
    return;
  }

  const waveSize = 3 + Math.min(level, 5);
  spawnTimer += deltaTime;
  if (spawnedThisLevel < waveSize && spawnTimer >= Math.max(330, CONFIG.enemySpawnDelay - level * 45)) {
    spawnEnemy();
    spawnedThisLevel += 1;
    spawnTimer = 0;
  }
  if (spawnedThisLevel >= waveSize && enemies.length === 0 && levelPause <= 0) {
    levelPause = 1400;
    levelPauseAction = "next-level";
  }
}

// Check bullets, power-ups, bugs, and enemy shots for hits.
function checkCollision(now) {
  for (let bulletIndex = bullets.length - 1; bulletIndex >= 0; bulletIndex -= 1) {
    const bullet = bullets[bulletIndex];
    for (let enemyIndex = enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
      const bug = enemies[enemyIndex];
      if (rectanglesTouch(bullet, bug)) {
        bullets.splice(bulletIndex, 1);
        if (bug.isBoss) {
          bug.health -= 1;
          makeSpark(bullet.x, bullet.y, CONFIG.colors.boss);
          if (bug.health <= 0) {
            makeFixed(bug.x, bug.y);
            enemies.splice(enemyIndex, 1);
            boss = null;
            addScore(250);
            levelPause = 1700;
            levelPauseAction = "next-level";
          }
        } else {
          enemies.splice(enemyIndex, 1);
          makeFixed(bug.x, bug.y);
          addScore(10);
          maybeDropPowerUp(bug.x, bug.y);
        }
        combo = now - lastHitTime <= CONFIG.comboWindow ? Math.min(combo + 1, CONFIG.maxCombo) : 1;
        lastHitTime = now;
        playTone(820, 0.07, "triangle");
        updateHud();
        break;
      }
    }
  }

  for (let index = powerUps.length - 1; index >= 0; index -= 1) {
    if (rectanglesTouch(powerUps[index], player)) {
      activatePowerUp(powerUps[index].type, now);
      makeSpark(powerUps[index].x, powerUps[index].y, CONFIG.colors.powerUndo);
      powerUps.splice(index, 1);
    }
  }

  for (let index = enemyBullets.length - 1; index >= 0; index -= 1) {
    if (rectanglesTouch(enemyBullets[index], player)) {
      enemyBullets.splice(index, 1);
      loseLife();
    }
  }

  for (let index = enemies.length - 1; index >= 0; index -= 1) {
    if (!enemies[index].isBoss && rectanglesTouch(enemies[index], player)) {
      enemies.splice(index, 1);
      loseLife();
    }
  }
}

// Tell whether two rectangles overlap.
function rectanglesTouch(first, second) {
  return Math.abs(first.x - second.x) < (first.width + second.width) / 2
    && Math.abs(first.y - second.y) < (first.height + second.height) / 2;
}

// Occasionally drop a random power-up when a bug is fixed.
function maybeDropPowerUp(x, y) {
  if (Math.random() > CONFIG.powerUpChance) {
    return;
  }
  const types = ["coffee", "shield", "undo"];
  powerUps.push({
    x: x,
    y: y,
    width: 24,
    height: 24,
    type: types[Math.floor(Math.random() * types.length)]
  });
}

// Turn on coffee, shield, or the screen-clearing undo power.
function activatePowerUp(type, now) {
  if (type === "coffee") {
    rapidFireUntil = now + CONFIG.rapidFireTime;
  } else if (type === "shield") {
    shieldActive = true;
  } else {
    for (let index = enemies.length - 1; index >= 0; index -= 1) {
      if (!enemies[index].isBoss) {
        makeFixed(enemies[index].x, enemies[index].y);
        addScore(10);
      }
    }
    enemies.length = boss ? 1 : 0;
    enemyBullets.length = 0;
    combo = Math.min(combo + 1, CONFIG.maxCombo);
  }
  playTone(520, 0.12, "sine");
  updateHud();
}

// Display the current temporary power and its remaining time.
function updatePowerStatus(now) {
  let label = "";
  let remaining = 0;
  let fullTime = CONFIG.rapidFireTime;
  if (now < rapidFireUntil) {
    label = "COFFEE RAPID FIRE";
    remaining = rapidFireUntil - now;
  } else if (shieldActive) {
    label = "SHIELD READY";
    remaining = 1;
    fullTime = 1;
  }
  if (label) {
    powerStatusElement.classList.add("is-active");
    powerLabelElement.textContent = label;
    powerBarElement.style.width = `${Math.max(0, remaining / fullTime) * 100}%`;
    powerBarElement.style.background = shieldActive && now >= rapidFireUntil ? CONFIG.colors.powerShield : CONFIG.colors.powerCoffee;
  } else {
    powerStatusElement.classList.remove("is-active");
  }
}

// Remove a life, or let the shield absorb the hit.
function loseLife() {
  if (shieldActive) {
    shieldActive = false;
    makeSpark(player.x, player.y, CONFIG.colors.powerShield);
    playTone(300, 0.12, "sine");
    updateHud();
    return;
  }
  if (gameState !== "playing") {
    return;
  }
  lives -= 1;
  makeSpark(player.x, player.y, CONFIG.colors.playerAccent);
  playTone(140, 0.22, "sawtooth");
  updateHud();
  if (lives <= 0) {
    gameOver();
  }
}

// Add score using the current combo multiplier.
function addScore(points) {
  score += points * combo;
  if (score > bestScore) {
    bestScore = score;
    saveBestScore();
  }
}

// Show the final score and reveal the replay screen.
function gameOver() {
  gameState = "gameover";
  finalScoreElement.textContent = formatScore(score);
  gameOverScreen.classList.remove("is-hidden");
  powerStatusElement.classList.remove("is-active");
  playTone(110, 0.4, "sawtooth");
  updateHud();
}

// Draw the whole scene for this animation frame.
function draw() {
  drawBackground();
  drawStars(slowStars, CONFIG.colors.slowStar, 0.5);
  drawStars(fastStars, CONFIG.colors.star, 0.8);
  drawPowerUps();
  drawEnemies();
  drawBullets();
  drawPlayer();
  drawParticles();
}

// Paint the space color with a gentle level-based hue change.
function drawBackground() {
  ctx.fillStyle = `hsl(${backgroundHue % 360}, 48%, 9%)`;
  ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
  ctx.fillStyle = CONFIG.colors.backgroundGrid;
  for (let index = 0; index < 4; index += 1) {
    ctx.fillRect(0, index * 180 + 42, CONFIG.width, 1);
  }
}

// Draw one layer of tiny moving stars.
function drawStars(stars, color, alpha) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  for (let index = 0; index < stars.length; index += 1) {
    const star = stars[index];
    ctx.fillRect(Math.round(star.x), Math.round(star.y), star.size, star.size);
  }
  ctx.globalAlpha = 1;
}

// Draw the ship from bright pixel-like rectangles.
function drawPlayer() {
  const x = Math.round(player.x);
  const y = Math.round(player.y);
  ctx.shadowColor = CONFIG.colors.player;
  ctx.shadowBlur = 14;
  ctx.fillStyle = CONFIG.colors.player;
  ctx.fillRect(x - 4, y - 15, 8, 7);
  ctx.fillRect(x - 8, y - 8, 16, 8);
  ctx.fillRect(x - 14, y, 28, 8);
  ctx.fillStyle = CONFIG.colors.playerAccent;
  ctx.fillRect(x - 4, y + 3, 8, 7);
  ctx.fillStyle = CONFIG.colors.white;
  ctx.fillRect(x - 2, y - 8, 4, 4);
  ctx.shadowBlur = 0;
}

// Draw pink glowing bullets and the boss's shots.
function drawBullets() {
  ctx.save();
  ctx.shadowColor = CONFIG.colors.bullet;
  ctx.shadowBlur = 12;
  ctx.strokeStyle = CONFIG.colors.bullet;
  ctx.lineWidth = 3;
  for (let index = 0; index < bullets.length; index += 1) {
    ctx.beginPath();
    ctx.moveTo(bullets[index].x, bullets[index].y - 7);
    ctx.lineTo(bullets[index].x, bullets[index].y + 7);
    ctx.stroke();
  }
  ctx.fillStyle = CONFIG.colors.boss;
  for (let index = 0; index < enemyBullets.length; index += 1) {
    ctx.fillRect(enemyBullets[index].x - 3, enemyBullets[index].y - 6, 6, 12);
  }
  ctx.restore();
}

// Draw little beetles and the larger MEMORY LEAK boss.
function drawEnemies() {
  for (let index = 0; index < enemies.length; index += 1) {
    const bug = enemies[index];
    if (bug.isBoss) {
      drawBoss(bug);
    } else {
      drawBeetle(bug.x, bug.y, bug.label, CONFIG.colors.beetle);
    }
  }
}

// Draw one small pixel beetle with its error label.
function drawBeetle(x, y, label, color) {
  const left = Math.round(x);
  const top = Math.round(y);
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fillStyle = color;
  ctx.fillRect(left - 9, top - 7, 18, 14);
  ctx.fillRect(left - 13, top - 4, 4, 8);
  ctx.fillRect(left + 9, top - 4, 4, 8);
  ctx.fillRect(left - 7, top - 11, 4, 4);
  ctx.fillRect(left + 3, top - 11, 4, 4);
  ctx.fillRect(left - 8, top + 6, 4, 4);
  ctx.fillRect(left + 4, top + 6, 4, 4);
  ctx.fillStyle = CONFIG.colors.beetleLight;
  ctx.fillRect(left - 5, top - 3, 3, 3);
  ctx.fillRect(left + 2, top - 3, 3, 3);
  ctx.shadowBlur = 0;
  ctx.fillStyle = CONFIG.colors.face;
  ctx.font = '7px "Press Start 2P", monospace';
  ctx.textAlign = "center";
  ctx.fillText(label, left, top + 19);
}

// Draw the big boss and its health bar.
function drawBoss(bug) {
  drawBeetle(bug.x, bug.y, "", CONFIG.colors.boss);
  ctx.fillStyle = CONFIG.colors.bossFace;
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textAlign = "center";
  ctx.fillText("MEMORY LEAK", bug.x, bug.y - 28);
  ctx.fillStyle = CONFIG.colors.bossBarBackground;
  ctx.fillRect(bug.x - 48, bug.y + 27, 96, 7);
  ctx.fillStyle = CONFIG.colors.bossBar;
  ctx.fillRect(bug.x - 48, bug.y + 27, 96 * (bug.health / bug.maxHealth), 7);
}

// Draw the coffee, shield, and Ctrl+Z power-up icons.
function drawPowerUps() {
  for (let index = 0; index < powerUps.length; index += 1) {
    const item = powerUps[index];
    const colors = {
      coffee: CONFIG.colors.powerCoffee,
      shield: CONFIG.colors.powerShield,
      undo: CONFIG.colors.powerUndo
    };
    const labels = { coffee: "C", shield: "S", undo: "Z" };
    ctx.fillStyle = colors[item.type];
    ctx.fillRect(item.x - 11, item.y - 11, 22, 22);
    drawPowerUpIcon(item, labels[item.type]);
  }
}

// Draw a tiny cup, shield, or Ctrl+Z mark inside a power-up.
function drawPowerUpIcon(item, label) {
  ctx.fillStyle = CONFIG.colors.iconInk;
  if (item.type === "coffee") {
    ctx.fillRect(item.x - 6, item.y - 5, 10, 10);
    ctx.fillRect(item.x - 7, item.y + 5, 12, 3);
    ctx.fillRect(item.x + 4, item.y - 3, 4, 3);
    ctx.fillRect(item.x + 4, item.y + 1, 4, 3);
    ctx.fillRect(item.x - 4, item.y - 9, 2, 3);
    ctx.fillRect(item.x + 1, item.y - 10, 2, 4);
  } else if (item.type === "shield") {
    ctx.beginPath();
    ctx.moveTo(item.x, item.y - 8);
    ctx.lineTo(item.x + 7, item.y - 5);
    ctx.lineTo(item.x + 6, item.y + 2);
    ctx.lineTo(item.x, item.y + 8);
    ctx.lineTo(item.x - 6, item.y + 2);
    ctx.lineTo(item.x - 7, item.y - 5);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.fillText("CTRL", item.x, item.y - 1);
    ctx.font = '9px "Press Start 2P", monospace';
    ctx.fillText(label, item.x, item.y + 9);
  }
}

// Draw sparks and any short floating text.
function drawParticles() {
  for (let index = 0; index < particles.length; index += 1) {
    const particle = particles[index];
    ctx.globalAlpha = Math.min(1, particle.life / 5);
    if (particle.text) {
      ctx.fillStyle = CONFIG.colors.fixedText;
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.textAlign = "center";
      ctx.fillText(particle.text, particle.x, particle.y);
    } else {
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x, particle.y, 3, 3);
    }
  }
  ctx.globalAlpha = 1;
}

// Create a little spray of colored square sparkles.
function makeSpark(x, y, color) {
  for (let index = 0; index < 9; index += 1) {
    particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 5,
      vy: (Math.random() - 0.5) * 5,
      life: 12 + Math.random() * 12,
      color: color
    });
  }
}

// Add sparkles and a short FIXED! message when a bug is hit.
function makeFixed(x, y) {
  makeSpark(x, y, CONFIG.colors.powerUndo);
  particles.push({ x: x, y: y - 10, vx: 0, vy: -0.7, life: 40, text: "FIXED!" });
}

// Refresh all score, life, level, combo, and boss labels.
function updateHud() {
  scoreElement.textContent = formatScore(score);
  bestElement.textContent = formatScore(bestScore);
  livesElement.textContent = lives > 0 ? `${"♥ ".repeat(lives).trim()}` : "—";
  livesElement.setAttribute("aria-label", `${lives} ${lives === 1 ? "life" : "lives"}`);
  levelElement.textContent = String(level).padStart(2, "0");
  comboElement.textContent = `COMBO x${combo}`;
  bossStatusElement.textContent = boss ? `BOSS HP ${boss.health}/${boss.maxHealth}` : "";
}

// Pad scores to make the arcade scoreboard easy to scan.
function formatScore(value) {
  return String(value).padStart(6, "0");
}

// Play a short synthesized beep if sound is turned on.
function playTone(frequency, duration, waveform) {
  if (muted) {
    return;
  }
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }
    audioContext = new AudioContextClass();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
  const oscillator = audioContext.createOscillator();
  const volume = audioContext.createGain();
  oscillator.type = waveform;
  oscillator.frequency.value = frequency;
  volume.gain.setValueAtTime(0.06, audioContext.currentTime);
  volume.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
  oscillator.connect(volume);
  volume.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

// Turn sound on or off and update the button label.
function toggleMute() {
  muted = !muted;
  muteButton.textContent = muted ? "SOUND: OFF" : "SOUND: ON";
  muteButton.setAttribute("aria-label", muted ? "Turn sound on" : "Mute sound");
  if (!muted) {
    playTone(500, 0.08, "sine");
  }
}

// Move the ship to the pointer's position in the game canvas.
function moveToPointer(event) {
  const bounds = canvas.getBoundingClientRect();
  player.x = (event.clientX - bounds.left) * (CONFIG.width / bounds.width);
  movePlayer();
}

// Remember pressed keys and let Space start the game.
function handleKeyDown(event) {
  if (["ArrowLeft", "ArrowRight", " "].includes(event.key)) {
    event.preventDefault();
  }
  keys[event.key === " " ? "Space" : event.key] = true;
  if ((event.key === " " || event.key === "Enter") && gameState !== "playing") {
    startGame();
  }
}

// Stop moving or firing when a key is released.
function handleKeyUp(event) {
  keys[event.key === " " ? "Space" : event.key] = false;
}

// Start touch movement and keep the finger captured on the canvas.
function handlePointerDown(event) {
  if (gameState !== "playing") {
    return;
  }
  pointerDown = true;
  moveToPointer(event);
  canvas.setPointerCapture(event.pointerId);
}

// Keep the ship beneath a dragging finger.
function handlePointerMove(event) {
  if (pointerDown && gameState === "playing") {
    moveToPointer(event);
  }
}

// Stop auto-shooting when the finger is lifted from the canvas.
function handlePointerUp() {
  pointerDown = false;
}

// Start auto-shooting while the large touch fire button is held.
function handleFireDown(event) {
  event.preventDefault();
  fireButtonHeld = true;
  fireButton.setPointerCapture(event.pointerId);
}

// Stop firing when the touch fire button is released.
function handleFireUp() {
  fireButtonHeld = false;
}

// Run updates and drawing repeatedly with the browser animation timer.
function gameLoop(now) {
  const deltaTime = lastTime ? now - lastTime : 16.67;
  lastTime = now;
  update(deltaTime, now);
  draw();
  requestAnimationFrame(gameLoop);
}

document.getElementById("start-button").addEventListener("click", startGame);
document.getElementById("play-again-button").addEventListener("click", startGame);
muteButton.addEventListener("click", toggleMute);
window.addEventListener("keydown", handleKeyDown);
window.addEventListener("keyup", handleKeyUp);
canvas.addEventListener("pointerdown", handlePointerDown);
canvas.addEventListener("pointermove", handlePointerMove);
canvas.addEventListener("pointerup", handlePointerUp);
canvas.addEventListener("pointercancel", handlePointerUp);
fireButton.addEventListener("pointerdown", handleFireDown);
fireButton.addEventListener("pointerup", handleFireUp);
fireButton.addEventListener("pointercancel", handleFireUp);
fireButton.addEventListener("lostpointercapture", handleFireUp);
bestElement.textContent = formatScore(bestScore);
createStars();
requestAnimationFrame(gameLoop);
