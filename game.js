const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const gameOverDiv = document.getElementById('gameOver');
const gameOverTitle = document.getElementById('gameOverTitle');
const gameOverScore = document.getElementById('gameOverScore');
const scoreDisplay = document.getElementById('score');
const blocksLeftDisplay = document.getElementById('blocksLeft');

// Game objects
const paddle = {
    width: 80,
    height: 10,
    x: canvas.width / 2 - 40,
    y: canvas.height - 20,
    speed: 6
};

const ball = {
    x: canvas.width / 2,
    y: canvas.height - 40,
    radius: 5,
    dx: 4,
    dy: -4,
    speed: 4
};

const bricks = [];
const brickConfig = {
    width: 50,
    height: 15,
    padding: 5,
    cols: 7,
    rows: 4,
    colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A']
};

let gameState = 'ready'; // 'ready', 'playing', 'gameOver', 'won'
let score = 0;
let mouseX = canvas.width / 2;

// Initialize bricks
function initBricks() {
    bricks.length = 0;
    for (let r = 0; r < brickConfig.rows; r++) {
        for (let c = 0; c < brickConfig.cols; c++) {
            bricks.push({
                x: c * (brickConfig.width + brickConfig.padding) + 10,
                y: r * (brickConfig.height + brickConfig.padding) + 30,
                width: brickConfig.width,
                height: brickConfig.height,
                color: brickConfig.colors[r % brickConfig.colors.length],
                active: true
            });
        }
    }
    updateBlocksLeft();
}

// Update UI
function updateBlocksLeft() {
    blocksLeftDisplay.textContent = bricks.filter(b => b.active).length;
}

function updateScore(points) {
    score += points;
    scoreDisplay.textContent = score;
}

// Draw functions
function drawPaddle() {
    ctx.fillStyle = '#00FF88';
    ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
}

function drawBall() {
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
}

function drawBricks() {
    bricks.forEach(brick => {
        if (brick.active) {
            ctx.fillStyle = brick.color;
            ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.strokeRect(brick.x, brick.y, brick.width, brick.height);
        }
    });
}

function drawGameState() {
    if (gameState === 'ready') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('スペースキーでゲーム開始', canvas.width / 2, canvas.height / 2);
    }
}

// Physics and collision
function updateBall() {
    if (gameState !== 'playing') return;

    ball.x += ball.dx;
    ball.y += ball.dy;

    // Wall collisions
    if (ball.x - ball.radius < 0 || ball.x + ball.radius > canvas.width) {
        ball.dx *= -1;
        ball.x = ball.x - ball.radius < 0 ? ball.radius : canvas.width - ball.radius;
    }

    if (ball.y - ball.radius < 0) {
        ball.dy *= -1;
        ball.y = ball.radius;
    }

    // Ball lost
    if (ball.y - ball.radius > canvas.height) {
        gameState = 'gameOver';
        gameOverTitle.textContent = 'ゲームオーバー';
        gameOverScore.textContent = `最終スコア: ${score}`;
        gameOverDiv.style.display = 'flex';
        gameOverDiv.style.flexDirection = 'column';
        gameOverDiv.style.justifyContent = 'center';
        gameOverDiv.style.alignItems = 'center';
    }
}

function updatePaddle() {
    paddle.x = Math.max(0, Math.min(mouseX - paddle.width / 2, canvas.width - paddle.width));
}

function checkCollisions() {
    if (gameState !== 'playing') return;

    // Paddle collision
    if (
        ball.y + ball.radius >= paddle.y &&
        ball.y - ball.radius <= paddle.y + paddle.height &&
        ball.x >= paddle.x &&
        ball.x <= paddle.x + paddle.width
    ) {
        ball.dy *= -1;
        ball.y = paddle.y - ball.radius;

        const hitPos = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
        ball.dx = hitPos * ball.speed * 2;
    }

    // Brick collision
    bricks.forEach(brick => {
        if (!brick.active) return;

        if (
            ball.x >= brick.x &&
            ball.x <= brick.x + brick.width &&
            ball.y >= brick.y &&
            ball.y <= brick.y + brick.height
        ) {
            brick.active = false;
            updateBlocksLeft();
            updateScore(10);
            ball.dy *= -1;

            checkWin();
        }
    });
}

function checkWin() {
    const remainingBricks = bricks.filter(b => b.active).length;
    if (remainingBricks === 0) {
        gameState = 'won';
        gameOverTitle.textContent = 'クリア!';
        gameOverScore.textContent = `最終スコア: ${score}`;
        gameOverDiv.style.display = 'flex';
        gameOverDiv.style.flexDirection = 'column';
        gameOverDiv.style.justifyContent = 'center';
        gameOverDiv.style.alignItems = 'center';
    }
}

// Main game loop
function gameLoop() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    updateBall();
    updatePaddle();
    checkCollisions();

    drawBricks();
    drawPaddle();
    drawBall();
    drawGameState();

    requestAnimationFrame(gameLoop);
}

// Event listeners
document.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
});

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        if (gameState === 'ready') {
            gameState = 'playing';
            ball.x = canvas.width / 2;
            ball.y = canvas.height - 40;
            ball.dx = 4;
            ball.dy = -4;
        }
    }
});

// Start game
initBricks();
gameLoop();
