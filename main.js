// Game Configuration
// Game Configuration
let CONFIG = {
    GRAVITY: 0.25,
    FLAP_STRENGTH: -4.5, // Jump impulse
    PIPE_SPEED: 2,
    PIPE_SPAWN_INTERVAL: 100, // Frames
    PIPE_GAP: 150, // Vertical gap between pipes
    PIPE_WIDTH: 50,
    GROUND_HEIGHT: 16,
    BIRD_RADIUS: 12,
    COLOR_BG: '#70c5ce', // Classic blue sky
    COLOR_GROUND: '#ded895',
    COLOR_GROUND_BORDER: '#73bf2e',
    COLOR_BIRD: '#f4e040',
    COLOR_PIPE: '#73bf2e'
};

function setDifficulty(level) {
    const buttons = document.querySelectorAll('.diff-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.diff-btn[data-level="${level}"]`).classList.add('active');

    switch (level) {
        case 'easy':
            CONFIG.PIPE_SPEED = 1.5;
            CONFIG.PIPE_GAP = 170;
            CONFIG.PIPE_SPAWN_INTERVAL = 120;
            break;
        case 'normal':
            CONFIG.PIPE_SPEED = 2;
            CONFIG.PIPE_GAP = 150;
            CONFIG.PIPE_SPAWN_INTERVAL = 100;
            break;
        case 'hard':
            CONFIG.PIPE_SPEED = 2.5;
            CONFIG.PIPE_GAP = 130;
            CONFIG.PIPE_SPAWN_INTERVAL = 90;
            break;
    }

    // Reset any running game physics to new config if needed, though usually applies on new game
}

// Audio System (Web Audio API)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const SoundManager = {
    playFlap: function () {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(500, audioCtx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    },

    playScore: function () {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, audioCtx.currentTime);

        gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
    },

    playHit: function () {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(50, audioCtx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
    }
};

// DOM Elements
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreEl = document.getElementById('final-score');
const bestScoreEl = document.getElementById('best-score');

// Game State
let state = {
    current: 'START', // START, PLAYING, GAMEOVER
    frames: 0,
    score: 0,
    bestScore: parseInt(localStorage.getItem('flappyHighScore')) || 0,
    width: 0,
    height: 0
};

// Entities
const bird = {
    x: 50,
    y: 150,
    w: CONFIG.BIRD_RADIUS * 2,
    h: CONFIG.BIRD_RADIUS * 2,
    radius: CONFIG.BIRD_RADIUS,
    velocity: 0,
    rotation: 0,

    draw: function () {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        ctx.fillStyle = CONFIG.COLOR_BIRD;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#000';
        ctx.stroke(); // Outline

        // Eye
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(6, -6, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Pupil
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(7, -6, 2, 0, Math.PI * 2);
        ctx.fill();

        // Beak
        ctx.fillStyle = '#f78e2d';
        ctx.beginPath();
        ctx.moveTo(6, 4);
        ctx.lineTo(14, 8);
        ctx.lineTo(6, 12);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    },

    flap: function () {
        this.velocity = CONFIG.FLAP_STRENGTH;
        SoundManager.playFlap();
    },

    update: function () {
        // Gravity
        this.velocity += CONFIG.GRAVITY;
        this.y += this.velocity;

        // Rotation based on velocity
        if (this.velocity < 2.5) { // Going up or just starting to fall
            this.rotation = -25 * Math.PI / 180;
        } else { // Falling fast
            this.rotation += 4 * Math.PI / 180; // Rotate down faster
            if (this.rotation > 90 * Math.PI / 180) {
                this.rotation = 90 * Math.PI / 180;
            }
        }

        // Floor collision
        if (this.y + this.radius >= state.height - CONFIG.GROUND_HEIGHT) {
            this.y = state.height - CONFIG.GROUND_HEIGHT - this.radius;
            gameOver();
        }
    },

    reset: function () {
        this.y = state.height / 2;
        this.velocity = 0;
        this.rotation = 0;
    }
};

const pipes = {
    position: [],

    reset: function () {
        this.position = [];
    },

    update: function () {
        // Add new pipe
        if (state.frames % CONFIG.PIPE_SPAWN_INTERVAL === 0) {
            // Calculate random vertical position for the gap
            // Minimum top pipe height, minimum bottom pipe height
            const minHeight = 50;
            const availableSpace = state.height - CONFIG.GROUND_HEIGHT - CONFIG.PIPE_GAP - minHeight * 2;
            const randomShift = Math.random() * availableSpace;
            const topHeight = minHeight + randomShift;

            this.position.push({
                x: state.width,
                y: topHeight, // This is the bottom of the top pipe
                passed: false
            });
        }

        for (let i = 0; i < this.position.length; i++) {
            let p = this.position[i];

            // Move pipe
            p.x -= CONFIG.PIPE_SPEED;

            // Collision detection
            // Pipe logic: 
            // Top pipe rect: x: p.x, y: 0, w: CONFIG.PIPE_WIDTH, h: p.y
            // Bottom pipe rect: x: p.x, y: p.y + CONFIG.PIPE_GAP, w: CONFIG.PIPE_WIDTH, h: state.height - ground - (p.y + gap)

            // Simple AABB collision for pipes
            // Check horizontal overlap first for efficiency
            if (bird.x + bird.radius > p.x && bird.x - bird.radius < p.x + CONFIG.PIPE_WIDTH) {
                // Check vertical overlap (hit top pipe OR hit bottom pipe)
                if (bird.y - bird.radius < p.y ||
                    bird.y + bird.radius > p.y + CONFIG.PIPE_GAP) {
                    gameOver();
                }
            }

            // Score update
            if (p.x + CONFIG.PIPE_WIDTH < bird.x - bird.radius && !p.passed) {
                state.score += 1;
                p.passed = true;
                scoreEl.innerText = state.score;

                // Visual pop
                scoreEl.classList.remove('score-pop');
                void scoreEl.offsetWidth; // Trigger reflow
                scoreEl.classList.add('score-pop');

                SoundManager.playScore();
            }

            // Remove off-screen pipes
            if (p.x + CONFIG.PIPE_WIDTH < 0) {
                this.position.shift();
                i--; // Adjust index since we removed an item
            }
        }
    },

    draw: function () {
        ctx.fillStyle = CONFIG.COLOR_PIPE;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;

        for (let i = 0; i < this.position.length; i++) {
            let p = this.position[i];

            let topPipeHeight = p.y;
            let bottomPipeY = p.y + CONFIG.PIPE_GAP;
            let bottomPipeHeight = state.height - CONFIG.GROUND_HEIGHT - bottomPipeY;

            // Top Pipe
            ctx.fillRect(p.x, 0, CONFIG.PIPE_WIDTH, topPipeHeight);
            ctx.strokeRect(p.x, -2, CONFIG.PIPE_WIDTH, topPipeHeight + 2); // -2 to hide top border

            // Bottom Pipe
            ctx.fillRect(p.x, bottomPipeY, CONFIG.PIPE_WIDTH, bottomPipeHeight);
            ctx.strokeRect(p.x, bottomPipeY, CONFIG.PIPE_WIDTH, bottomPipeHeight);

            // Cap details (optional for polish)
            const capHeight = 20;
            const capOverhang = 2;

            // Top pipe cap
            ctx.fillRect(p.x - capOverhang, topPipeHeight - capHeight, CONFIG.PIPE_WIDTH + capOverhang * 2, capHeight);
            ctx.strokeRect(p.x - capOverhang, topPipeHeight - capHeight, CONFIG.PIPE_WIDTH + capOverhang * 2, capHeight);

            // Bottom pipe cap
            ctx.fillRect(p.x - capOverhang, bottomPipeY, CONFIG.PIPE_WIDTH + capOverhang * 2, capHeight);
            ctx.strokeRect(p.x - capOverhang, bottomPipeY, CONFIG.PIPE_WIDTH + capOverhang * 2, capHeight);
        }
    }
};

const ground = {
    x: 0,
    draw: function () {
        ctx.fillStyle = CONFIG.COLOR_GROUND;
        ctx.fillRect(0, state.height - CONFIG.GROUND_HEIGHT, state.width, CONFIG.GROUND_HEIGHT);

        // Border
        ctx.beginPath();
        ctx.moveTo(0, state.height - CONFIG.GROUND_HEIGHT);
        ctx.lineTo(state.width, state.height - CONFIG.GROUND_HEIGHT);
        ctx.strokeStyle = '#553000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Moving effect
        this.x = (this.x - CONFIG.PIPE_SPEED) % 20;
        ctx.strokeStyle = '#d5c75c'; // Lighter diagonal lines
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = this.x; i < state.width; i += 20) {
            ctx.moveTo(i, state.height - CONFIG.GROUND_HEIGHT);
            ctx.lineTo(i - 10, state.height);
        }
        ctx.stroke();
    },
    update: function () {
        // Just visual update handled in draw with offset
    }
};

// Game Loop
function loop() {
    update();
    draw();
    if (state.current !== 'STOP') {
        requestAnimationFrame(loop);
    }
}

function update() {
    if (state.current === 'PLAYING') {
        bird.update();
        pipes.update();
        ground.update();
        state.frames++;

        // Parallax background (simple shift)
        document.body.style.backgroundPosition = `-${state.frames * 0.5}px 0`;

    } else if (state.current === 'START') {
        // Hover effect for bird in start screen
        bird.y = state.height / 2 - 20 + Math.sin(Date.now() / 300) * 5;
        ground.update(); // Keep ground moving in start screen for "alive" feel

        // Parallax
        document.body.style.backgroundPosition = `-${Date.now() / 50}px 0`;
    }
    // In GAMEOVER, nothing updates
}

function draw() {
    // Clear canvas - transparent so CSS background shows through
    ctx.clearRect(0, 0, state.width, state.height);

    // Entities
    pipes.draw();
    ground.draw();
    bird.draw();
}

// Controls
function handleInput(e) {
    if (e.type === 'keydown' && e.code !== 'Space') return;
    if (e.type === 'keydown') e.preventDefault(); // Stop scrolling

    switch (state.current) {
        case 'START':
            state.current = 'PLAYING';
            startScreen.classList.add('hidden');
            bird.reset();
            bird.flap();
            break;

        case 'PLAYING':
            bird.flap();
            break;

        case 'GAMEOVER':
            // Debounce slightly to prevent accidental restarts
            resetGame();
            break;
    }
}

function gameOver() {
    if (state.current === 'GAMEOVER') return; // Prevent double trigger

    state.current = 'GAMEOVER';
    SoundManager.playHit();

    // Update high score
    if (state.score > state.bestScore) {
        state.bestScore = state.score;
        localStorage.setItem('flappyHighScore', state.bestScore);
    }

    finalScoreEl.innerText = state.score;
    bestScoreEl.innerText = state.bestScore;
    gameOverScreen.classList.remove('hidden');
    scoreEl.classList.add('hidden'); // Hide playing score

    // Bird "falls" to ground if hit pipe
    if (bird.y < state.height - CONFIG.GROUND_HEIGHT - bird.radius) {
        // Optional: animate fall in future
        // bird.velocity = 0; // stop or let it fall? For now, simple game over state
    }
}

function resetGame() {
    state.current = 'START';
    state.score = 0;
    state.frames = 0;

    pipes.reset();
    bird.reset();

    scoreEl.innerText = '0';
    scoreEl.classList.remove('hidden');

    gameOverScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
}

function resize() {
    const container = document.getElementById('game-container');
    state.width = container.clientWidth;
    state.height = container.clientHeight;
    canvas.width = state.width;
    canvas.height = state.height;

    // If resizing mid-game, might want to adjust bird y to keep relative?, but for now just let it be
    if (state.current === 'START') {
        bird.y = state.height / 2;
    }
}

// Initialization
function init() {
    resize();
    window.addEventListener('resize', resize);

    window.addEventListener('keydown', handleInput);
    window.addEventListener('click', handleInput);
    window.addEventListener('touchstart', (e) => {
        // e.preventDefault(); // Prevent default touch actions if needed, but verify first
        handleInput(e);
    }, { passive: false });

    // Difficulty Buttons
    document.querySelectorAll('.diff-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent game start trigger
            setDifficulty(e.target.dataset.level);
        });
        // Also handle touch to prevent phantom clicks or propogation issues
        btn.addEventListener('touchstart', (e) => {
            e.stopPropagation();
        }, { passive: true });
    });

    bird.x = state.width / 2 - 50; // Offset start x
    bird.reset();

    loop();
}

// Start
init();
