// --- Canvas & DOM Elements ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreDisplay = document.getElementById('score');
const highScoreDisplay = document.getElementById('highScore');
const comboDisplay = document.getElementById('comboDisplay');
const blocksLeftDisplay = document.getElementById('blocksLeft');
const soundToggleBtn = document.getElementById('soundToggle');

const startOverlay = document.getElementById('startOverlay');
const pauseOverlay = document.getElementById('pauseOverlay');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const modalCard = document.getElementById('modalCard');
const gameOverTitle = document.getElementById('gameOverTitle');
const finalScoreDisplay = document.getElementById('finalScore');
const finalHighScoreDisplay = document.getElementById('finalHighScore');
const maxComboDisplay = document.getElementById('maxCombo');

const startBtn = document.getElementById('startBtn');
const resumeBtn = document.getElementById('resumeBtn');
const restartBtn = document.getElementById('restartBtn');

// --- Web Audio API Synth Sound System ---
class SoundSystem {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playTone(freq, type = 'sine', duration = 0.1, startGain = 0.3, endGain = 0.001) {
        if (!this.enabled || !this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

            gain.gain.setValueAtTime(startGain, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(endGain, this.ctx.currentTime + duration);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {
            // Audio context muted or failed
        }
    }

    playBrickHit(combo = 1) {
        if (!this.enabled || !this.ctx) return;
        try {
            const baseFreq = 300 + Math.min(combo * 40, 400);
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, this.ctx.currentTime + 0.08);

            gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + 0.1);
        } catch (e) {}
    }

    playPaddleHit() {
        this.playTone(220, 'triangle', 0.12, 0.4, 0.001);
    }

    playWallHit() {
        this.playTone(180, 'sine', 0.08, 0.25, 0.001);
    }

    playGameOver() {
        if (!this.enabled || !this.ctx) return;
        try {
            const notes = [200, 180, 150, 120];
            notes.forEach((freq, idx) => {
                setTimeout(() => {
                    this.playTone(freq, 'sawtooth', 0.2, 0.3, 0.001);
                }, idx * 120);
            });
        } catch (e) {}
    }

    playWin() {
        if (!this.enabled || !this.ctx) return;
        try {
            const notes = [400, 520, 650, 800];
            notes.forEach((freq, idx) => {
                setTimeout(() => {
                    this.playTone(freq, 'square', 0.15, 0.3, 0.001);
                }, idx * 100);
            });
        } catch (e) {}
    }
}

const audio = new SoundSystem();

// Toggle Sound Button
soundToggleBtn.addEventListener('click', () => {
    audio.enabled = !audio.enabled;
    soundToggleBtn.textContent = audio.enabled ? '🔊' : '🔇';
    soundToggleBtn.style.borderColor = audio.enabled ? 'var(--neon-cyan)' : 'rgba(255,255,255,0.2)';
    soundToggleBtn.style.color = audio.enabled ? 'var(--neon-cyan)' : 'rgba(255,255,255,0.4)';
});

// --- Game Variables & Constants ---
let gameState = 'ready'; // 'ready', 'playing', 'paused', 'gameOver', 'won'
let score = 0;
let highScore = parseInt(localStorage.getItem('neonBreakoutHighScore') || '0', 10);
let combo = 1;
let maxCombo = 1;
let screenShakeTimer = 0;
let mouseX = canvas.width / 2;

highScoreDisplay.textContent = highScore;

// Game Objects
const paddle = {
    width: 90,
    height: 12,
    x: canvas.width / 2 - 45,
    y: canvas.height - 25,
    speed: 8,
    hitFlash: 0
};

const ball = {
    x: canvas.width / 2,
    y: canvas.height - 45,
    radius: 6,
    dx: 4,
    dy: -4,
    speed: 5.5,
    trail: []
};

const brickConfig = {
    cols: 8,
    rows: 5,
    padding: 6,
    marginTop: 40,
    marginLeft: 12,
    height: 18,
    palette: [
        { color: '#FF007F', glow: '#FF007F', points: 50 }, // Pink
        { color: '#FF6600', glow: '#FF6600', points: 40 }, // Orange
        { color: '#FFE600', glow: '#FFE600', points: 30 }, // Yellow
        { color: '#00FF66', glow: '#00FF66', points: 20 }, // Green
        { color: '#00F3FF', glow: '#00F3FF', points: 10 }  // Cyan
    ]
};

let bricks = [];
let particles = [];
let floatingTexts = [];

// Initialize Bricks
function initBricks() {
    bricks = [];
    const availableWidth = canvas.width - brickConfig.marginLeft * 2;
    const brickWidth = (availableWidth - (brickConfig.cols - 1) * brickConfig.padding) / brickConfig.cols;

    for (let r = 0; r < brickConfig.rows; r++) {
        const theme = brickConfig.palette[r % brickConfig.palette.length];
        for (let c = 0; c < brickConfig.cols; c++) {
            bricks.push({
                x: brickConfig.marginLeft + c * (brickWidth + brickConfig.padding),
                y: brickConfig.marginTop + r * (brickConfig.height + brickConfig.padding),
                width: brickWidth,
                height: brickConfig.height,
                color: theme.color,
                glow: theme.glow,
                points: theme.points,
                active: true,
                hitAnimation: 0
            });
        }
    }
    updateBlocksLeft();
}

// Particle System
function createExplosion(x, y, color) {
    const particleCount = 14;
    for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 / particleCount) * i + (Math.random() - 0.5);
        const speed = Math.random() * 4 + 2;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: Math.random() * 2.5 + 1.5,
            color: color,
            alpha: 1,
            decay: Math.random() * 0.03 + 0.02
        });
    }
}

// Floating Score Popups
function addFloatingText(text, x, y, color = '#ffffff') {
    floatingTexts.push({
        text: text,
        x: x,
        y: y,
        vy: -1.2,
        alpha: 1,
        color: color
    });
}

// Update HUD displays
function updateBlocksLeft() {
    const remaining = bricks.filter(b => b.active).length;
    blocksLeftDisplay.textContent = remaining;
}

function updateScore(points) {
    const addedPoints = points * combo;
    score += addedPoints;
    scoreDisplay.textContent = score;

    if (score > highScore) {
        highScore = score;
        highScoreDisplay.textContent = highScore;
        localStorage.setItem('neonBreakoutHighScore', highScore);
    }
}

// --- Draw Functions ---
function drawBackground() {
    // Deep dark backdrop
    ctx.fillStyle = '#030309';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle neon grid background
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.04)';
    ctx.lineWidth = 1;
    const gridSize = 24;

    for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    // Top border glow line
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00f3ff';
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(canvas.width, 0);
    ctx.stroke();
    ctx.shadowBlur = 0;
}

function drawBricks() {
    bricks.forEach(brick => {
        if (!brick.active) return;

        ctx.save();
        ctx.shadowBlur = 12;
        ctx.shadowColor = brick.glow;
        ctx.fillStyle = brick.color;

        // Rounded brick rect
        const radius = 3;
        ctx.beginPath();
        ctx.roundRect(brick.x, brick.y, brick.width, brick.height, radius);
        ctx.fill();

        // Inner highlight core
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fillRect(brick.x + 2, brick.y + 2, brick.width - 4, 3);

        ctx.restore();
    });
}

function drawPaddle() {
    ctx.save();
    
    // Paddle Glow
    ctx.shadowBlur = paddle.hitFlash > 0 ? 25 : 15;
    ctx.shadowColor = paddle.hitFlash > 0 ? '#ffffff' : '#00f3ff';

    // Metallic gradient
    const grad = ctx.createLinearGradient(paddle.x, paddle.y, paddle.x, paddle.y + paddle.height);
    if (paddle.hitFlash > 0) {
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(1, '#00f3ff');
    } else {
        grad.addColorStop(0, '#00f3ff');
        grad.addColorStop(0.5, '#00aeff');
        grad.addColorStop(1, '#ff007f');
    }

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(paddle.x, paddle.y, paddle.width, paddle.height, 6);
    ctx.fill();

    // Top glowing edge
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(paddle.x + 4, paddle.y + 1, paddle.width - 8, 2);

    ctx.restore();

    if (paddle.hitFlash > 0) paddle.hitFlash--;
}

function drawBall() {
    // Draw ball trail
    for (let i = 0; i < ball.trail.length; i++) {
        const p = ball.trail[i];
        const alpha = (i + 1) / ball.trail.length * 0.45;
        const radius = ball.radius * ((i + 1) / ball.trail.length);

        ctx.save();
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#00f3ff';
        ctx.fillStyle = `rgba(0, 243, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Draw main ball
    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = '#00f3ff';
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();

    // Inner bright core
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#e2f1ff';
    ctx.beginPath();
    ctx.arc(ball.x - 1.5, ball.y - 1.5, ball.radius * 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08; // subtle gravity
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
            particles.splice(i, 1);
            continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function drawFloatingTexts() {
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.y += ft.vy;
        ft.alpha -= 0.02;

        if (ft.alpha <= 0) {
            floatingTexts.splice(i, 1);
            continue;
        }

        ctx.save();
        ctx.globalAlpha = ft.alpha;
        ctx.font = 'bold 13px Orbitron';
        ctx.shadowBlur = 6;
        ctx.shadowColor = ft.color;
        ctx.fillStyle = ft.color;
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
    }
}

// --- Updates & Physics ---
function updateBall() {
    if (gameState !== 'playing') return;

    // Record trail
    ball.trail.push({ x: ball.x, y: ball.y });
    if (ball.trail.length > 8) ball.trail.shift();

    ball.x += ball.dx;
    ball.y += ball.dy;

    // Wall collisions (Left / Right)
    if (ball.x - ball.radius <= 0) {
        ball.x = ball.radius;
        ball.dx *= -1;
        audio.playWallHit();
    } else if (ball.x + ball.radius >= canvas.width) {
        ball.x = canvas.width - ball.radius;
        ball.dx *= -1;
        audio.playWallHit();
    }

    // Wall collision (Top)
    if (ball.y - ball.radius <= 0) {
        ball.y = ball.radius;
        ball.dy *= -1;
        audio.playWallHit();
    }

    // Ball Lost (Bottom)
    if (ball.y - ball.radius > canvas.height) {
        triggerGameOver(false);
    }
}

function updatePaddle() {
    const targetX = mouseX - paddle.width / 2;
    paddle.x = Math.max(0, Math.min(targetX, canvas.width - paddle.width));
}

function checkCollisions() {
    if (gameState !== 'playing') return;

    // Paddle collision
    if (
        ball.y + ball.radius >= paddle.y &&
        ball.y - ball.radius <= paddle.y + paddle.height &&
        ball.x >= paddle.x &&
        ball.x <= paddle.x + paddle.width &&
        ball.dy > 0
    ) {
        ball.dy *= -1;
        ball.y = paddle.y - ball.radius;

        // Reset combo on paddle bounce
        combo = 1;
        comboDisplay.textContent = `x${combo}`;
        paddle.hitFlash = 6;
        audio.playPaddleHit();

        // Adjust exit angle based on where it hits paddle
        const hitPos = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
        const maxAngle = Math.PI / 3.2; // ~56 degrees
        const angle = hitPos * maxAngle;
        const currentSpeed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);

        ball.dx = Math.sin(angle) * currentSpeed;
        ball.dy = -Math.cos(angle) * currentSpeed;
    }

    // Brick collisions
    bricks.forEach(brick => {
        if (!brick.active) return;

        if (
            ball.x + ball.radius >= brick.x &&
            ball.x - ball.radius <= brick.x + brick.width &&
            ball.y + ball.radius >= brick.y &&
            ball.y - ball.radius <= brick.y + brick.height
        ) {
            brick.active = false;
            updateBlocksLeft();

            // Explosive particles & Floating score
            createExplosion(brick.x + brick.width / 2, brick.y + brick.height / 2, brick.color);
            addFloatingText(`+${brick.points * combo}`, brick.x + brick.width / 2, brick.y, brick.color);

            updateScore(brick.points);
            audio.playBrickHit(combo);

            // Increment combo
            combo++;
            comboDisplay.textContent = `x${combo}`;
            if (combo > maxCombo) maxCombo = combo;

            // Bounce logic
            const prevX = ball.x - ball.dx;
            const prevY = ball.y - ball.dy;

            if (prevX + ball.radius <= brick.x || prevX - ball.radius >= brick.x + brick.width) {
                ball.dx *= -1;
            } else {
                ball.dy *= -1;
            }

            screenShakeTimer = 4;
            checkWinCondition();
        }
    });
}

function checkWinCondition() {
    const remaining = bricks.filter(b => b.active).length;
    if (remaining === 0) {
        triggerGameOver(true);
    }
}

function triggerGameOver(isWin) {
    gameState = isWin ? 'won' : 'gameOver';

    if (isWin) {
        gameOverTitle.textContent = 'VICTORY!';
        modalCard.className = 'modal-card victory';
        audio.playWin();
    } else {
        gameOverTitle.textContent = 'GAME OVER';
        modalCard.className = 'modal-card gameover';
        audio.playGameOver();
    }

    finalScoreDisplay.textContent = score;
    finalHighScoreDisplay.textContent = highScore;
    maxComboDisplay.textContent = `x${maxCombo}`;

    gameOverOverlay.classList.remove('hidden');
}

// Main Render Loop
function gameLoop() {
    ctx.save();

    // Screen Shake effect on impact
    if (screenShakeTimer > 0) {
        const shakeX = (Math.random() - 0.5) * 4;
        const shakeY = (Math.random() - 0.5) * 4;
        ctx.translate(shakeX, shakeY);
        screenShakeTimer--;
    }

    drawBackground();
    drawBricks();
    drawPaddle();
    drawBall();
    drawParticles();
    drawFloatingTexts();

    ctx.restore();

    if (gameState === 'playing') {
        updateBall();
        updatePaddle();
        checkCollisions();
    }

    requestAnimationFrame(gameLoop);
}

// --- Game Control Handlers ---
function startGame() {
    audio.init();
    score = 0;
    combo = 1;
    maxCombo = 1;
    scoreDisplay.textContent = '0';
    comboDisplay.textContent = 'x1';

    paddle.x = canvas.width / 2 - paddle.width / 2;
    ball.x = canvas.width / 2;
    ball.y = canvas.height - 45;

    // Angle launch
    const randomAngle = (Math.random() * 0.6 - 0.3); // Slight variance
    ball.dx = ball.speed * Math.sin(randomAngle) || 3;
    ball.dy = -ball.speed * Math.cos(randomAngle);
    ball.trail = [];

    initBricks();

    startOverlay.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');
    pauseOverlay.classList.add('hidden');

    gameState = 'playing';
}

function togglePause() {
    if (gameState === 'playing') {
        gameState = 'paused';
        pauseOverlay.classList.remove('hidden');
    } else if (gameState === 'paused') {
        gameState = 'playing';
        pauseOverlay.classList.add('hidden');
    }
}

// --- Event Listeners ---
document.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
});

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        if (gameState === 'ready' || gameState === 'gameOver' || gameState === 'won') {
            startGame();
        }
    } else if (e.code === 'KeyP' || e.code === 'Escape') {
        e.preventDefault();
        togglePause();
    }
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
resumeBtn.addEventListener('click', togglePause);

// Initialize Game Frame Loop
initBricks();
gameLoop();
