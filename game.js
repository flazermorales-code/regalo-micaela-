// --- CONFIGURACIÓN E INICIALIZACIÓN ---
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 448; 
canvas.height = 512;

let gameState = "MENU"; // MENU, PLAYING, BOSS_DEFEATED, FINAL
let score = 0;
let level = 1;
let lives = 5; 
let keys = {};
let particles = [];
let lasers = [];
let enemies = [];
let stars = [];
let isInvulnerable = false; // Evita pérdida masiva de vidas por colisión repetida

const START_DATE = new Date("2026-05-14T11:40:00");

// --- CARGA SEGURA DE ASSETS ---
const assets = {
    ship: { img: new Image(), loaded: false },
    enemy1: { img: new Image(), loaded: false }, 
    enemy2: { img: new Image(), loaded: false }, 
    boss: { img: new Image(), loaded: false },   
    heart: { img: new Image(), loaded: false }    
};

// Rutas apuntando a la carpeta assets/
assets.ship.img.src = "assets/ship.png";
assets.ship.img.onload = () => { assets.ship.loaded = true; };

assets.enemy1.img.src = "assets/enemy1.png";
assets.enemy1.img.onload = () => { assets.enemy1.loaded = true; };

assets.enemy2.img.src = "assets/enemy2.png";
assets.enemy2.img.onload = () => { assets.enemy2.loaded = true; };

assets.boss.img.src = "assets/boss.png"; 
assets.boss.img.onload = () => { assets.boss.loaded = true; };

assets.heart.img.src = "assets/heart.png";
assets.heart.img.onload = () => { assets.heart.loaded = true; };

// Control de audio seguro
const bgMusic = document.getElementById("bg-music");
const loveMusic = document.getElementById("love-music");

function playSound(audioElem, volume = 0.5, loop = true) {
    try {
        if (audioElem) {
            audioElem.loop = loop;
            audioElem.volume = volume;
            audioElem.play().catch(e => console.log("Audio esperando interacción"));
        }
    } catch(e) {
        console.log("Error de audio:", e);
    }
}

function stopSound(audioElem) {
    try {
        if (audioElem) {
            audioElem.pause();
            audioElem.currentTime = 0; // Reinicia el audio
        }
    } catch(e) {
        console.log("Error al pausar audio:", e);
    }
}

// --- JUGADOR (68x68) ---
const player = {
    x: canvas.width / 2 - 34, 
    y: canvas.height - 95,
    width: 68,  
    height: 68, 
    speed: 7.2, 
    cooldown: 0,
    draw() {
        // Partículas de propulsión
        if (Math.random() > 0.2) {
            particles.push(new Particle(
                this.x + this.width / 2, 
                this.y + this.height - 5, 
                "#00ffff", 
                { x: (Math.random() - 0.5) * 1.5, y: Math.random() * 3 + 2 },
                Math.random() * 3 + 1,
                12
            ));
        }

        // Parpadeo visual si es invulnerable
        if (isInvulnerable && Math.floor(Date.now() / 100) % 2 === 0) {
            return; 
        }

        if (assets.ship.loaded) {
            ctx.drawImage(assets.ship.img, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = "#00ffff";
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    },
    update() {
        if (keys["ArrowLeft"] || keys["a"]) this.x -= this.speed;
        if (keys["ArrowRight"] || keys["d"]) this.x += this.speed;
        if (this.x < 10) this.x = 10;
        if (this.x > canvas.width - this.width - 10) this.x = canvas.width - this.width - 10;
        if (this.cooldown > 0) this.cooldown--;
    },
    shoot() {
        if (this.cooldown === 0) {
            lasers.push(new Laser(this.x + 10, this.y + 12, -10, "#00ffff"));
            lasers.push(new Laser(this.x + this.width - 14, this.y + 12, -10, "#ff00ff"));
            this.cooldown = 10; 
        }
    }
};

// --- BOSS (REGALO GIGANTE: 150x150) ---
const boss = {
    x: canvas.width / 2 - 75,
    y: 60, 
    width: 150, 
    height: 150,
    maxHp: 120, 
    hp: 120,
    speedX: 2.2,
    active: false,
    hurtTimer: 0,
    shootCooldown: 90, 
    shootTimer: 0,
    update() {
        if (!this.active || gameState !== "PLAYING") return;

        this.x += this.speedX;
        if (this.x <= 20 || this.x >= canvas.width - this.width - 20) {
            this.speedX *= -1;
        }

        if (this.shootTimer > 0) {
            this.shootTimer--;
        } else {
            lasers.push(new Laser(this.x + 35, this.y + this.height - 10, 3.5, "#ff3366"));
            lasers.push(new Laser(this.x + this.width - 35, this.y + this.height - 10, 3.5, "#ff3366"));
            this.shootTimer = this.shootCooldown;
        }

        if (this.hurtTimer > 0) this.hurtTimer--;
    },
    draw() {
        if (!this.active || gameState === "FINAL") return;
        
        ctx.save();
        if (this.hurtTimer > 0) {
            ctx.filter = "brightness(1.8) saturate(3)";
        }

        if (assets.boss.loaded) {
            ctx.drawImage(assets.boss.img, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = "#ff3366";
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = "#ffff00";
            ctx.fillRect(this.x + this.width / 2 - 10, this.y, 20, this.height);
            ctx.fillRect(this.x, this.y + this.height / 2 - 10, this.width, 20);
        }
        ctx.restore();

        if (this.hp > 0 && gameState === "PLAYING") {
            ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
            ctx.fillRect(this.x, this.y - 15, this.width, 6);
            ctx.fillStyle = "#ff3366";
            ctx.fillRect(this.x, this.y - 15, this.width * (this.hp / this.maxHp), 6);
        }
    },
    takeDamage() {
        if (gameState !== "PLAYING") return;

        this.hp -= 3; 
        this.hurtTimer = 4;
        
        for (let i = 0; i < 4; i++) {
            particles.push(new Particle(
                this.x + Math.random() * this.width,
                this.y + Math.random() * this.height,
                "#ffff00",
                { x: (Math.random() - 0.5) * 4, y: (Math.random() - 0.5) * 4 },
                3,
                15
            ));
        }

        if (this.hp <= 0) {
            triggerBossDefeatCinematic();
        }
    }
};

// --- ENEMIGOS REGULARES ---
class Enemy {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; 
        this.width = type === 1 ? 72 : 85;  
        this.height = type === 1 ? 72 : 85; 
        this.speedY = type === 1 ? 1.2 : 1.7;
        this.hp = type === 1 ? 1 : 2;
        this.explodeColor = type === 1 ? "#00ff00" : "#ff3300";
        this.angle = 0;
    }
    update() {
        this.y += this.speedY;
        this.angle += 0.04;
        this.x += Math.sin(this.angle) * 1.2;
    }
    draw() {
        const asset = this.type === 1 ? assets.enemy1 : assets.enemy2;
        if (asset.loaded) {
            ctx.drawImage(asset.img, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = this.explodeColor;
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }
}

// --- LÁSERES ---
class Laser {
    constructor(x, y, speedY, color) {
        this.x = x; this.y = y;
        this.width = 4; this.height = 18;
        this.speedY = speedY; this.color = color;
    }
    update() { this.y += this.speedY; }
    draw() { ctx.fillStyle = this.color; ctx.fillRect(this.x, this.y, this.width, this.height); }
}

// --- PARTÍCULAS ---
class Particle {
    constructor(x, y, color, speed, size, life) {
        this.x = x; this.y = y; this.color = color;
        this.speed = speed; this.size = size;
        this.maxLife = life; this.life = life;
    }
    update() { this.x += this.speed.x; this.y += this.speed.y; this.life--; }
    draw() {
        ctx.save(); 
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.fillStyle = this.color; 
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.restore();
    }
}

// --- CORAZÓN GIGANTE FINAL ---
const finalHeart = {
    x: canvas.width / 2, 
    y: canvas.height / 2,
    width: 0, 
    height: 0, 
    targetSize: 220, 
    angle: 0, 
    active: false,
    update() {
        if (!this.active) return;
        if (this.width < this.targetSize) {
            this.width += 4;
            this.height += 4;
        }
    },
    draw() {
        if (!this.active) return;
        ctx.save(); 
        ctx.translate(this.x, this.y);
        this.angle += 0.05;
        let pulse = Math.sin(this.angle) * 12;
        let w = this.width + pulse;
        let h = this.height + pulse;
        
        if (assets.heart.loaded) {
            ctx.drawImage(assets.heart.img, -w / 2, -h / 2, w, h);
        } else {
            ctx.fillStyle = "#ff3366";
            ctx.beginPath();
            ctx.moveTo(0, 20);
            ctx.bezierCurveTo(-60, -40, -20, -60, 0, -20);
            ctx.bezierCurveTo(20, -60, 60, -40, 0, 20);
            ctx.fill();
        }
        ctx.restore();
    }
};

// --- DIBUJAR VIDAS (HUD) ---
function drawLives() {
    const livesDiv = document.getElementById("lives-val");
    if (!livesDiv) return;
    livesDiv.innerHTML = ""; 
    for (let i = 0; i < lives; i++) {
        if (assets.heart.loaded) {
            const img = document.createElement("img");
            img.src = assets.heart.img.src; 
            img.className = "heart-icon"; 
            livesDiv.appendChild(img);
        } else {
            livesDiv.innerHTML += "❤️";
        }
    }
}

// --- FONDO ESTELAR ---
function initStars() {
    stars = [];
    for (let i = 0; i < 60; i++) {
        stars.push({ 
            x: Math.random() * canvas.width, 
            y: Math.random() * canvas.height, 
            size: Math.random() * 2 + 1, 
            color: "#ffffff", 
            speed: Math.random() * 2 + 1 
        });
    }
}

function initRomanticBackground() {
    stars = []; 
    for (let i = 0; i < 80; i++) {
        stars.push({ 
            x: Math.random() * canvas.width, 
            y: Math.random() * canvas.height, 
            size: Math.random() * 2.5 + 1, 
            color: ["#ffffff", "#ff99cc", "#00ffff"][Math.floor(Math.random() * 3)], 
            speed: Math.random() * 0.5 + 0.2 
        });
    }
}

function updateAndDrawStars() {
    stars.forEach(star => {
        star.y += star.speed;
        if (star.y > canvas.height) { 
            star.y = 0; 
            star.x = Math.random() * canvas.width; 
        }
        ctx.fillStyle = star.color; 
        ctx.fillRect(star.x, star.y, star.size, star.size);
    });
}

function createExplosion(x, y, color, num = 20) {
    for (let i = 0; i < num; i++) {
        let angle = Math.random() * Math.PI * 2;
        let s = Math.random() * 4 + 2;
        particles.push(new Particle(
            x, y, color, 
            { x: Math.cos(angle) * s, y: Math.sin(angle) * s }, 
            Math.random() * 3 + 2, 
            40
        ));
    }
}

function createGrietaParticula(x, y) {
    particles.push(new Particle(
        x, y, "#00ffff", 
        { x: (Math.random() - 0.5) * 8, y: (Math.random() - 0.5) * 2 }, 
        Math.random() * 4 + 2, 
        30
    ));
}

// --- GENERADOR DE OLEADAS ---
let waveTimer = 0;
function handleSpawns() {
    if (boss.active || gameState !== "PLAYING") return;
    
    waveTimer++;
    if (waveTimer >= 45) {
        waveTimer = 0;
        enemies.push(new Enemy(Math.random() * (canvas.width - 60) + 30, -50, level === 1 ? 1 : (Math.random() > 0.4 ? 1 : 2)));
    }

    if (score >= 150 && level === 1) { 
        level = 2; 
        const lvlVal = document.getElementById("level-val");
        if (lvlVal) lvlVal.innerText = "2"; 
    } else if (score >= 400 && level === 2) { 
        level = "FINAL 🎁"; 
        const lvlVal = document.getElementById("level-val");
        if (lvlVal) lvlVal.innerText = level; 
        spawnBoss(); 
    }
}

function spawnBoss() {
    if (boss.active) return; 
    enemies = []; 
    lasers = [];
    boss.active = true; 
    boss.hp = boss.maxHp;
}

// --- COLISIONES ---
function checkCollision(r1, r2) { 
    return r1.x < r2.x + r2.width && 
           r1.x + r1.width > r2.x && 
           r1.y < r2.y + r2.height && 
           r1.y + r1.height > r2.y; 
}

function handleCollisions() {
    if (gameState !== "PLAYING") return;

    for (let l = lasers.length - 1; l >= 0; l--) {
        let laser = lasers[l];
        let laserRemoved = false;

        if (laser.speedY < 0) {
            for (let e = enemies.length - 1; e >= 0; e--) {
                if (checkCollision(laser, enemies[e])) {
                    enemies[e].hp--; 
                    createExplosion(laser.x, laser.y, enemies[e].explodeColor, 6);
                    lasers.splice(l, 1);
                    laserRemoved = true;

                    if (enemies[e].hp <= 0) { 
                        score += 10; 
                        const scVal = document.getElementById("score-val");
                        if (scVal) scVal.innerText = score; 
                        createExplosion(enemies[e].x + enemies[e].width/2, enemies[e].y + enemies[e].height/2, enemies[e].explodeColor, 15);
                        enemies.splice(e, 1); 
                    }
                    break;
                }
            }

            if (!laserRemoved && boss.active && checkCollision(laser, boss)) { 
                boss.takeDamage(); 
                lasers.splice(l, 1); 
            }
        } else {
            if (checkCollision(laser, player)) { 
                lasers.splice(l, 1); 
                playerHit();
            }
        }
    }

    for (let e = enemies.length - 1; e >= 0; e--) {
        if (checkCollision(player, enemies[e])) {
            createExplosion(enemies[e].x + enemies[e].width/2, enemies[e].y + enemies[e].height/2, enemies[e].explodeColor, 15);
            enemies.splice(e, 1);
            playerHit();
        }
    }
}

// --- DETECCIÓN DE DAÑO SEGURA ---
function playerHit() {
    if (gameState !== "PLAYING" || isInvulnerable) return; 
    
    lives--; 
    drawLives(); 
    createExplosion(player.x + player.width / 2, player.y + player.height / 2, "#ff0000", 25);
    
    if (lives <= 0) {
        gameOver(); 
    } else {
        isInvulnerable = true;
        setTimeout(() => { isInvulnerable = false; }, 1000); 
    }
}

// --- PANTALLA DE DERROTA ---
function gameOver() {
    gameState = "MENU"; 
    stopSound(bgMusic);
    stopSound(loveMusic);

    const sScreen = document.getElementById("start-screen");
    const hud = document.getElementById("hud");
    const vscreen = document.getElementById("victory-screen");

    if (sScreen) sScreen.classList.remove("hidden");
    if (hud) hud.classList.add("hidden");
    if (vscreen) vscreen.classList.add("hidden");

    const startBtn = document.getElementById("start-btn");
    if (startBtn) startBtn.innerText = "Intentar de nuevo ❤️";
}

// --- RESETEO DE VARIABLES ---
function resetGame() { 
    score = 0; 
    level = 1; 
    lives = 5; 
    enemies = []; 
    lasers = []; 
    particles = [];
    boss.active = false; 
    boss.hp = boss.maxHp;
    isInvulnerable = false;

    const scVal = document.getElementById("score-val");
    if (scVal) scVal.innerText = score;
    const lvlVal = document.getElementById("level-val");
    if (lvlVal) lvlVal.innerText = level;
    
    player.x = canvas.width / 2 - 34;
    player.y = canvas.height - 95;
    drawLives(); 
}

// --- CINEMÁTICA Y FINAL ROMÁNTICO ---
let cinematicTimer = 0;
function triggerBossDefeatCinematic() { 
    gameState = "BOSS_DEFEATED"; 
    enemies = []; 
    lasers = []; 
    cinematicTimer = 0; 
}

function updateCinematic() {
    cinematicTimer++;
    let bx = boss.x + boss.width / 2; 
    let by = boss.y + boss.height / 2;

    if (cinematicTimer === 20) createGrietaParticula(bx - 30, by - 15);
    if (cinematicTimer === 45) createGrietaParticula(bx + 25, by + 25);
    if (cinematicTimer === 70) createExplosion(bx, by, "#ffffff", 10);
    if (cinematicTimer === 100) { 
        createExplosion(bx, by, "#ff3366", 30); 
        createExplosion(bx, by, "#ffff00", 30); 
    }
    if (cinematicTimer === 130) {
        boss.active = false;
    }
    if (cinematicTimer === 160) { 
        gameState = "FINAL"; 
        initRomanticBackground(); 
        finalHeart.active = true; 
        transitionToVictory(); 
    }
}

function transitionToVictory() {
    stopSound(bgMusic);
    playSound(loveMusic, 0.75, true);

    const hud = document.getElementById("hud");
    const mctrls = document.getElementById("mobile-controls");
    const vscreen = document.getElementById("victory-screen");

    if (hud) hud.classList.add("hidden");
    if (mctrls) mctrls.classList.add("hidden");
    if (vscreen) vscreen.classList.remove("hidden");

    updateTimer();
    if (window.victoryInterval) clearInterval(window.victoryInterval);
    window.victoryInterval = setInterval(updateTimer, 1000);
}

function updateTimer() {
    const timerElem = document.getElementById("timer");
    if (!timerElem) return;

    const diff = new Date() - START_DATE;
    const s = Math.floor(diff / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;

    timerElem.innerHTML = `<span style="color:#ff3366">${d}</span> días, <span style="color:#00ffff">${h}</span> hrs,<br><span style="color:#ff3366">${m}</span> min y <span style="color:#00ffff">${sec}</span> seg.`;
}

// Botón de regalo
const claimBtn = document.getElementById("claim-btn");
const giftContent = document.getElementById("gift-content");
if (claimBtn && giftContent) {
    claimBtn.addEventListener("click", () => { 
        giftContent.classList.remove("hidden"); 
        claimBtn.classList.add("hidden"); 
    });
}

// --- GAME LOOP ---
function gameLoop() {
    ctx.fillStyle = "#050310"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    updateAndDrawStars();

    if (gameState === "BOSS_DEFEATED") { 
        updateCinematic(); 
        boss.draw(); 
    }
    else if (gameState === "FINAL") {
        finalHeart.update();
        finalHeart.draw();
        
        if (Math.random() < 0.06) {
            particles.push(new Particle(
                Math.random() * canvas.width, 
                canvas.height, 
                "#ff99cc", 
                { x: (Math.random() - 0.5) * 1, y: -2 }, 
                4, 
                100
            ));
        }
    } 
    else if (gameState === "PLAYING") {
        player.update(); 
        player.draw(); 
        
        handleSpawns(); 
        handleCollisions(); 
        
        boss.update(); 
        boss.draw();
        
        enemies.forEach(e => { e.update(); e.draw(); });
        lasers.forEach(l => { l.update(); l.draw(); });
    }

    for (let i = particles.length - 1; i >= 0; i--) { 
        particles[i].update(); 
        particles[i].draw(); 
        if (particles[i].life <= 0) particles.splice(i, 1); 
    }

    for (let i = lasers.length - 1; i >= 0; i--) {
        if (lasers[i].y < -20 || lasers[i].y > canvas.height + 20) {
            lasers.splice(i, 1);
        }
    }

    requestAnimationFrame(gameLoop);
}

// --- TECLADO ---
window.addEventListener("keydown", e => { 
    keys[e.key] = true; 
    if (e.key === " " && gameState === "PLAYING") {
        player.shoot(); 
    }
});
window.addEventListener("keyup", e => keys[e.key] = false);

// Soporte táctil móvil seguro
const btns = { 
    left: document.getElementById("btn-left"), 
    right: document.getElementById("btn-right"), 
    shoot: document.getElementById("btn-shoot") 
};

if (btns.left && btns.right && btns.shoot) {
    btns.left.addEventListener("touchstart", (e) => { e.preventDefault(); keys["ArrowLeft"] = true; });
    btns.left.addEventListener("touchend", () => keys["ArrowLeft"] = false);
    btns.right.addEventListener("touchstart", (e) => { e.preventDefault(); keys["ArrowRight"] = true; });
    btns.right.addEventListener("touchend", () => keys["ArrowRight"] = false);
    btns.shoot.addEventListener("touchstart", (e) => { e.preventDefault(); if (gameState === "PLAYING") player.shoot(); });
}

// Botón de Inicio
const startBtn = document.getElementById("start-btn");
if (startBtn) {
    startBtn.addEventListener("click", () => { 
        const sScreen = document.getElementById("start-screen");
        const hud = document.getElementById("hud");
        
        if (sScreen) sScreen.classList.add("hidden");
        if (hud) hud.classList.remove("hidden");
        
        resetGame(); // Reinicia todo de forma segura antes de empezar
        playSound(bgMusic, 0.4, true); 
        gameState = "PLAYING"; 
        initStars(); 
    });
}

// --- INICIO ---
initStars(); 
gameLoop();