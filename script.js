// ========================================
// MRS GAMES - Ski Downhill Rush
// HTML5 Canvas / モバイル対応 横長ゲーム
// ========================================


// ========================================
// 1. 基本設定（画面モードの選択）
// ========================================

const SCREEN_MODE = "LANDSCAPE"; // 横長モード (960x540)

const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;

const STEP_MS = 1000 / 60;
const MAX_STEPS_PER_FRAME = 5;

const STATE = {
    TITLE: "title",
    HIGHSCORE_MODAL: "highscore",
    PLAYING: "playing",
    BIG_JUMPING: "big_jumping",
    PAUSED: "paused",
    GAMEOVER: "gameover",
};

let state = STATE.TITLE;
let score = 0;


// ========================================
// 2. DOM参照
// ========================================

const playArea = document.getElementById("play-area");
const stage = document.getElementById("game-stage");
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

const screens = {
    title: document.getElementById("screen-title"),
    highscore: document.getElementById("screen-highscore"),
    pause: document.getElementById("screen-pause"),
    gameover: document.getElementById("screen-gameover"),
};

const scoreValueEl = document.getElementById("score-value");
const jumpBonusValueEl = document.getElementById("jump-bonus-value");
const bestScoreDisplayEl = document.getElementById("best-score-display");
const modalTopScoreEl = document.getElementById("modal-top-score");
const modalBestDistEl = document.getElementById("modal-best-dist");
const modalBestJumpEl = document.getElementById("modal-best-jump");

const goDistValEl = document.getElementById("go-dist-val");
const goJumpsContainerEl = document.getElementById("go-jumps-container");
const gameoverScoreValueEl = document.getElementById("gameover-score-value");
const gameoverNewrecordEl = document.getElementById("gameover-newrecord");

const btnPlay = document.getElementById("btn-play");
const btnHighscore = document.getElementById("btn-highscore");
const btnCloseHighscore = document.getElementById("btn-close-highscore");
const btnPause = document.getElementById("btn-pause");
const btnResume = document.getElementById("btn-resume");
const btnPauseHome = document.getElementById("btn-pause-home");
const btnRetry = document.getElementById("btn-retry");
const btnGameoverHome = document.getElementById("btn-gameover-home");


// ========================================
// 3. レスポンシブCanvas
// ========================================

function resizeCanvas() {
    const rect = playArea.getBoundingClientRect();

    let width = rect.width;
    let height = width / (GAME_WIDTH / GAME_HEIGHT);

    if (height > rect.height) {
        height = rect.height;
        width = height * (GAME_WIDTH / GAME_HEIGHT);
    }

    stage.style.width = `${width}px`;
    stage.style.height = `${height}px`;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = GAME_WIDTH * dpr;
    canvas.height = GAME_HEIGHT * dpr;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", resizeCanvas);


// ========================================
// 4. 汎用当たり判定
// ========================================

function checkCollision(rectA, rectB, padding = 0) {
    return (
        rectA.x + padding < rectB.x + rectB.width - padding &&
        rectA.x + rectA.width - padding > rectB.x + padding &&
        rectA.y + padding < rectB.y + rectB.height - padding &&
        rectA.y + rectA.height - padding > rectB.y + padding
    );
}


// ========================================
// 5. DOM更新の最小化（スコア表示）
// ========================================

let lastDisplayedScore = null;
let lastDisplayedJumpBonus = null;

function setScore(value) {
    score = value;
    if (score !== lastDisplayedScore) {
        scoreValueEl.innerText = `${score}m`;
        lastDisplayedScore = score;
    }
}

function updateJumpBonusUI(bonusValue) {
    if (bonusValue !== lastDisplayedJumpBonus) {
        jumpBonusValueEl.innerText = `${bonusValue}m`;
        lastDisplayedJumpBonus = bonusValue;
    }
}


// ========================================
// 6. SoundFX (Web Audio API)
// ========================================

class SoundFX {
    constructor() {
        this.ctx = null;
    }

    unlock() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === "suspended") {
            this.ctx.resume();
        }
    }

    playJump() {
        if (!this.ctx || this.ctx.state !== "running") return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(500, this.ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
    }

    playBigJump() {
        if (!this.ctx || this.ctx.state !== "running") return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(850, this.ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.5);
    }

    playFlap() {
        if (!this.ctx || this.ctx.state !== "running") return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.08);
    }

    playLanding() {
        if (!this.ctx || this.ctx.state !== "running") return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }

    playCrash() {
        if (!this.ctx || this.ctx.state !== "running") return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.4);
    }

    playNpcFall() {
        if (!this.ctx || this.ctx.state !== "running") return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(300, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.4);
    }

    playNewRecord() {
        if (!this.ctx || this.ctx.state !== "running") return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.1);
        osc.frequency.setValueAtTime(783.99, now + 0.2);
        osc.frequency.setValueAtTime(1046.50, now + 0.3);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.6);
    }
}

const sfx = new SoundFX();


// ========================================
// 7. 画面遷移 & ハイスコア管理
// ========================================

let highScoreData = {
    totalScore: 0,
    bestDistance: 0,
    bestJumpBonus: 0
};

function loadHighScore() {
    try {
        if (window.mySkiHighScore) {
            highScoreData = window.mySkiHighScore;
        }
    } catch(e) {}
    updateHighScoreUI();
}

function saveHighScore(total, dist, jump) {
    highScoreData = {
        totalScore: total,
        bestDistance: dist,
        bestJumpBonus: jump
    };
    try {
        window.mySkiHighScore = highScoreData;
    } catch(e) {}
    updateHighScoreUI();
}

function updateHighScoreUI() {
    bestScoreDisplayEl.innerText = `BEST SCORE: ${highScoreData.totalScore} pts`;
    modalTopScoreEl.innerText = highScoreData.totalScore;
    modalBestDistEl.innerText = highScoreData.bestDistance;
    modalBestJumpEl.innerText = highScoreData.bestJumpBonus;
}

function showScreen(name) {
    Object.entries(screens).forEach(([key, el]) => {
        el.classList.toggle("hidden", key !== name);
    });
}

function hideAllScreens() {
    Object.values(screens).forEach((el) => el.classList.add("hidden"));
}

function goToTitle() {
    state = STATE.TITLE;
    showScreen("title");
}

function showHighScoreModal() {
    state = STATE.HIGHSCORE_MODAL;
    showScreen("highscore");
}

function startGame() {
    sfx.unlock();
    state = STATE.PLAYING;
    hideAllScreens();
    resetGame();
}

function pauseGame() {
    if (state !== STATE.PLAYING && state !== STATE.BIG_JUMPING) return;
    state = STATE.PAUSED;
    showScreen("pause");
}

function resumeGame() {
    if (state !== STATE.PAUSED) return;
    state = STATE.PLAYING;
    hideAllScreens();
}

function endGame() {
    state = STATE.GAMEOVER;
    sfx.playCrash();

    const currentTotalScore = Math.floor(distance) + totalJumpDistance;
    const isNewHighScore = currentTotalScore > highScoreData.totalScore;

    if (isNewHighScore) {
        saveHighScore(currentTotalScore, Math.floor(distance), totalJumpDistance);
        sfx.playNewRecord();
        gameoverNewrecordEl.classList.remove("hidden");
    } else {
        gameoverNewrecordEl.classList.add("hidden");
    }

    goDistValEl.innerText = `${Math.floor(distance)}m`;
    gameoverScoreValueEl.innerText = `${currentTotalScore} pts`;

    // ジャンプ内訳の生成
    goJumpsContainerEl.innerHTML = "";
    if (jumpHistory.length === 0) {
        const row = document.createElement("div");
        row.className = "breakdown-row";
        row.innerHTML = `<span>• BIG JUMPS</span><span class="val-green">NONE (+0m)</span>`;
        goJumpsContainerEl.appendChild(row);
    } else {
        const maxDisplay = 3;
        for (let k = 0; k < Math.min(jumpHistory.length, maxDisplay); k++) {
            const row = document.createElement("div");
            row.className = "breakdown-row";
            row.innerHTML = `<span>• BIG JUMP #${k + 1}</span><span class="val-green">+${jumpHistory[k]}m</span>`;
            goJumpsContainerEl.appendChild(row);
        }
        if (jumpHistory.length > maxDisplay) {
            const remainingSum = jumpHistory.slice(maxDisplay).reduce((a, b) => a + b, 0);
            const row = document.createElement("div");
            row.className = "breakdown-row";
            row.innerHTML = `<span>• OTHER JUMPS (${jumpHistory.length - maxDisplay})</span><span class="val-green">+${remainingSum}m</span>`;
            goJumpsContainerEl.appendChild(row);
        }
    }

    showScreen("gameover");
}


// ========================================
// 8. 誤操作防止（ブラウザバック対策）
// ========================================

function initBackButtonGuard() {
    history.pushState({ mrsGame: true }, "");

    window.addEventListener("popstate", () => {
        history.pushState({ mrsGame: true }, "");

        if (state === STATE.PLAYING || state === STATE.BIG_JUMPING) {
            pauseGame();
        } else if (state === STATE.GAMEOVER || state === STATE.HIGHSCORE_MODAL) {
            goToTitle();
        }
    });
}


// ========================================
// 9. 操作入力 (連打カクツキ防止)
// ========================================

function isInteractiveElement(target) {
    return !!(target && target.closest && target.closest("button, a"));
}

function onPrimaryAction() {
    if (state !== STATE.PLAYING && state !== STATE.BIG_JUMPING) return;
    if (player.isFallingInHole) return;

    const now = Date.now();

    if (state === STATE.PLAYING) {
        if (!player.isJumping) {
            player.vAir = player.jumpPower;
            player.isJumping = true;
            player.tapCountInAir = 0;
            player.slowFallTicks = 0;
            player.lastFlapTime = now;
            
            sfx.playJump();
            createSnowSpray(player.slopeX, getSlopeY(player.slopeX), 8);
        } else {
            // 空中での羽ばたき
            player.slowFallTicks = 16;
            player.tapCountInAir++;

            if (player.vAir > 0) {
                player.vAir *= 0.5;
            }

            // 連打によるAudioContextおよびパーティクル過負荷の防止 (120msのクールダウン)
            if (now - player.lastFlapTime > 120) {
                sfx.playFlap();
                createSnowSpray(player.slopeX - 5, getSlopeY(player.slopeX) - player.airOffset, 2);
                player.lastFlapTime = now;
            }
        }
    } else if (state === STATE.BIG_JUMPING) {
        // 大ジャンプ中の羽ばたき
        player.slowFallTicks = 18;
        player.tapCountInAir++;

        if (player.vAir > 0) {
            player.vAir *= 0.5;
        }

        if (now - player.lastFlapTime > 120) {
            sfx.playFlap();
            createSnowSpray(player.slopeX - 5, getSlopeY(player.slopeX) - player.airOffset, 3);
            player.lastFlapTime = now;
        }
    }
}

function bindButtonClick(button, handler) {
    if (!button) return;
    
    const handleEvent = (e) => {
        e.stopPropagation();
        if (e.type === "touchstart") e.preventDefault();
        sfx.unlock();
        handler();
    };

    button.addEventListener("touchstart", handleEvent, { passive: false });
    button.addEventListener("click", (e) => {
        e.stopPropagation();
        sfx.unlock();
        handler();
    });
}

function initInputHandlers() {
    const handleGlobalStart = (event) => {
        if (isInteractiveElement(event.target)) return;

        sfx.unlock();

        if (state === STATE.PLAYING || state === STATE.BIG_JUMPING) {
            if (event.type === "touchstart") event.preventDefault();
            onPrimaryAction();
        }
    };

    window.addEventListener("touchstart", handleGlobalStart, { passive: false });
    window.addEventListener("mousedown", handleGlobalStart);

    window.addEventListener("keydown", (e) => {
        if (e.repeat) return; // 長押し連続発火によるフリーズを防止

        if (e.code === "Space") {
            sfx.unlock();
            if (state === STATE.TITLE) {
                startGame();
            } else if (state === STATE.HIGHSCORE_MODAL) {
                goToTitle();
            } else if (state === STATE.GAMEOVER) {
                startGame();
            } else if (state === STATE.PLAYING || state === STATE.BIG_JUMPING) {
                onPrimaryAction();
            }
        }
    });

    bindButtonClick(btnPlay, startGame);
    bindButtonClick(btnHighscore, showHighScoreModal);
    bindButtonClick(btnCloseHighscore, goToTitle);

    bindButtonClick(btnPause, pauseGame);
    bindButtonClick(btnResume, resumeGame);
    bindButtonClick(btnPauseHome, () => {
        hideAllScreens();
        goToTitle();
    });

    bindButtonClick(btnRetry, startGame);
    bindButtonClick(btnGameoverHome, goToTitle);
}


// ========================================
// 10. ゲームロジック & 変数
// ========================================

const SLOPE_ANGLE = 0.28;
const SLOPE_COS = Math.cos(SLOPE_ANGLE);
const SLOPE_SIN = Math.sin(SLOPE_ANGLE);
const SLOPE_ORIGIN_Y = 200;

function getSlopeY(x) {
    return SLOPE_ORIGIN_Y + x * Math.tan(SLOPE_ANGLE);
}

const BASE_SPEED = 7.0; // 通常・大ジャンプ共通速度（一定速度でスクロール）
let speed = BASE_SPEED;

let distance = 0;
let totalJumpDistance = 0;
let lastJumpDist = 0; // 直近（または現在ジャンプ中）の獲得ボーナス距離
let jumpHistory = [];
let feedbackText = "";
let feedbackTimer = 0;

let completedBigJumps = 0;
let lastLandingDistance = 0;
let nextRampTargetDistance = 1000;

// 障害物出現の動的難易度調整用タイマー
let spawnIntervalThreshold = 300;

const PLAYER_X = 200;
const player = {
    slopeX: PLAYER_X,
    airOffset: 0,
    vAir: 0,
    gravity: 0.65,
    jumpPower: -11.0,
    isJumping: false,
    
    slowFallTicks: 0,
    tapCountInAir: 0,

    isFallingInHole: false,
    fallX: PLAYER_X,
    fallY: 0,

    lastFlapTime: 0,
    jumpStartDist: 0 // ジャンプボーナスの完全同期計算用
};

let particles = [];
let obstacles = [];
let spawnTimer = 0;

const MAX_PARTICLES = 80; // 連打時の描画負荷オーバーガード

function createSnowSpray(x, y, count = 10) {
    if (particles.length >= MAX_PARTICLES) return;
    const spawnCount = Math.min(count, MAX_PARTICLES - particles.length);

    for (let i = 0; i < spawnCount; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 5 - speed * 0.3 * SLOPE_COS,
            vy: (Math.random() - 0.5) * 5 - speed * 0.3 * SLOPE_SIN,
            life: 1.0,
            size: Math.random() * 4 + 2
        });
    }
}

function createHoleObstacle(spawnDist) {
    const holeWidth = 70 + Math.random() * 35;
    return { type: "hole", dist: spawnDist, w: holeWidth };
}

function resetGame() {
    speed = BASE_SPEED;
    distance = 0;
    totalJumpDistance = 0;
    lastJumpDist = 0;
    jumpHistory = [];
    obstacles = [];
    particles = [];
    
    // ゲーム開始直後は少し安全区間を置く
    spawnTimer = -200; 
    spawnIntervalThreshold = 300; 
    
    completedBigJumps = 0;
    lastLandingDistance = 0;
    nextRampTargetDistance = 1000;

    feedbackText = "";
    feedbackTimer = 0;

    player.slopeX = PLAYER_X;
    player.airOffset = 0;
    player.vAir = 0;
    player.isJumping = false;
    player.slowFallTicks = 0;
    player.tapCountInAir = 0;
    player.isFallingInHole = false;
    player.fallX = PLAYER_X;
    player.fallY = 0;
    player.lastFlapTime = 0;
    player.jumpStartDist = 0;

    setScore(0);
    updateJumpBonusUI(0);
}

function updateSpawns() {
    if (player.isFallingInHole) return;

    spawnTimer += speed;

    // 1000mごとのジャンプ台（Ramp）生成
    if (distance >= nextRampTargetDistance) {
        const spawnDist = 1100;
        obstacles.push({ type: "ramp", dist: spawnDist, w: 100, h: 45, triggered: false });
        nextRampTargetDistance = 99999999; // ロック（画面外消滅時または着地時に解除）
        spawnTimer = -250;
        return;
    }

    // 走行距離に応じた頻度・ランダムゆらぎの生成（徐々に高密度＆ランダム波）
    if (spawnTimer > spawnIntervalThreshold) {
        spawnTimer = 0;

        // 距離が伸びるほど間隔が狭まり、ランダムな疎密の波をつける
        if (distance < 300) {
            // 序盤：間隔 40m〜70m 相当 (しきい値 320〜550)
            spawnIntervalThreshold = Math.floor(320 + Math.random() * 230);
        } else if (distance < 800) {
            // 初級：間隔 25m〜50m 相当 (しきい値 200〜400)
            spawnIntervalThreshold = Math.floor(200 + Math.random() * 200);
        } else if (distance < 1800) {
            // 中級：間隔 15m〜35m 相当 (しきい値 120〜280)
            spawnIntervalThreshold = Math.floor(120 + Math.random() * 160);
        } else {
            // 上級：高密度＆不規則ラッシュ (しきい値 80〜200)
            spawnIntervalThreshold = Math.floor(80 + Math.random() * 120);
        }

        const spawnDist = 1100;

        const canHole = distance >= 400;
        const canTreeNormal = completedBigJumps >= 1 || distance >= 600;
        const canSkier = (completedBigJumps >= 1 || distance >= 800) && (distance - lastLandingDistance >= 300);
        const canTreeTall = completedBigJumps >= 2 || distance >= 1200;
        const canHoleLandslide = (completedBigJumps >= 2 || distance >= 1500) && (distance - lastLandingDistance >= 300);

        let candidates = ["snowman"];

        if (distance >= 300 && Math.random() < 0.4) candidates.push("snowman_multi");
        if (canHole) candidates.push("hole");
        if (canTreeNormal) candidates.push("tree_normal");
        if (canSkier) candidates.push("skier");
        if (canTreeTall) candidates.push("tree_tall");
        if (canHoleLandslide) candidates.push("hole_landslide");

        const chosen = candidates[Math.floor(Math.random() * candidates.length)];

        if (chosen === "snowman") {
            obstacles.push({ type: "snowman", dist: spawnDist, w: 38, h: 48 });
        } else if (chosen === "snowman_multi") {
            const snowCount = Math.random() < 0.6 ? 2 : 3;
            for (let k = 0; k < snowCount; k++) {
                obstacles.push({ type: "snowman", dist: spawnDist + (k * 42), w: 38, h: 48 });
            }
        } else if (chosen === "hole" || chosen === "hole_landslide") {
            obstacles.push(createHoleObstacle(spawnDist));
        } else if (chosen === "tree_normal") {
            obstacles.push({ type: "tree", dist: spawnDist, w: 48, h: 75, isTall: false });
        } else if (chosen === "skier") {
            obstacles.push({ type: "skier", dist: spawnDist, w: 40, h: 58, relSpeed: 2.0, falling: false, fallY: 0 });
        } else if (chosen === "tree_tall") {
            obstacles.push({ type: "tree", dist: spawnDist, w: 58, h: 110, isTall: true });
        }
    }
}

function triggerBigJump(rampObs) {
    if (rampObs.triggered) return;
    rampObs.triggered = true;

    state = STATE.BIG_JUMPING;
    player.vAir = -15;
    player.airOffset = 10;
    player.slowFallTicks = 0;
    player.tapCountInAir = 0;
    
    speed = BASE_SPEED;
    player.jumpStartDist = distance;
    lastJumpDist = 0;

    sfx.playBigJump();
}

function update(dtMs) {
    if (state === STATE.TITLE || state === STATE.HIGHSCORE_MODAL) {
        distance += 0.5;
        if (Math.random() < 0.2) {
            createSnowSpray(PLAYER_X - 10, getSlopeY(PLAYER_X), 1);
        }
        updateParticles();
        return;
    }

    if (state === STATE.PLAYING || state === STATE.BIG_JUMPING) {
        distance += speed * 0.12;
        setScore(Math.floor(distance));

        if (state === STATE.BIG_JUMPING) {
            // 現在大ジャンプ中の飛距離（単体）を計算
            lastJumpDist = distance - player.jumpStartDist;
        }

        // プレイ中のHUD（画面左下）には「直近または現在ジャンプ中」の数値のみを表示
        updateJumpBonusUI(Math.floor(lastJumpDist));

        updateSpawns();

        const holes = obstacles.filter(o => o.type === "hole");

        for (let i = obstacles.length - 1; i >= 0; i--) {
            let obs = obstacles[i];
            
            if (obs.type === "skier") {
                if (!obs.falling) {
                    obs.dist -= (speed - obs.relSpeed);

                    for (let h of holes) {
                        const holeLeft = h.dist - h.w / 2;
                        const holeRight = h.dist + h.w / 2;
                        if (obs.dist >= holeLeft && obs.dist <= holeRight) {
                            obs.falling = true;
                            sfx.playNpcFall();
                            break;
                        }
                    }
                } else {
                    obs.fallY += 10;
                    obs.dist -= speed * 0.5;
                }
            } else {
                obs.dist -= speed;
            }

            const ox = obs.dist;
            const px = player.slopeX;

            if (!player.isFallingInHole && obs.type === "hole") {
                const holeLeft = ox - obs.w * 0.35;
                const holeRight = ox + obs.w * 0.35;

                if (px >= holeLeft && px <= holeRight && player.airOffset <= 5) {
                    player.isFallingInHole = true;
                    player.fallX = px;
                    player.fallY = 0;
                    sfx.playNpcFall();
                }
            } else if (!player.isFallingInHole && obs.type === "ramp") {
                const rampStart = ox - obs.w / 2;
                const rampTip = ox + obs.w / 2;

                if (px >= rampStart && px <= rampTip) {
                    if (player.airOffset < 30 && !obs.triggered) {
                        triggerBigJump(obs);
                    }
                }
            } else if (!player.isFallingInHole && obs.type === "skier") {
                if (!obs.falling && Math.abs(ox - px) < 28) {
                    if (player.airOffset < obs.h * 0.7) {
                        endGame();
                        return;
                    }
                }
            } else if (!player.isFallingInHole && Math.abs(ox - px) < 28) {
                if (player.airOffset < obs.h * 0.72) {
                    endGame();
                    return;
                }
            }

            // 画面左端へ画面外消滅した場合の処理
            if (obs.dist < -200 || (obs.falling && obs.fallY > GAME_HEIGHT)) {
                if (obs.type === "ramp") {
                    nextRampTargetDistance = Math.ceil((distance + 800) / 1000) * 1000;
                }
                obstacles.splice(i, 1);
            }
        }
    }

    if (player.isFallingInHole) {
        player.fallY += 11;
        player.fallX -= speed * 0.4;

        const currentDisplayY = getSlopeY(player.fallX) + player.fallY;

        if (currentDisplayY > GAME_HEIGHT + 80) {
            endGame();
            return;
        }
    }

    if (state === STATE.PLAYING && !player.isFallingInHole) {
        if (player.isJumping) {
            let currentGravity = player.gravity * 0.65;
            
            if (player.slowFallTicks > 0 && player.vAir >= 0) {
                currentGravity *= 0.15;
                player.slowFallTicks--;
            } else if (player.slowFallTicks > 0 && player.vAir < 0) {
                player.slowFallTicks--;
            }

            player.vAir += currentGravity;
            player.airOffset -= player.vAir;

            if (player.airOffset <= 0) {
                createSnowSpray(player.slopeX, getSlopeY(player.slopeX), 12);
                sfx.playLanding();
                player.airOffset = 0;
                player.vAir = 0;
                player.isJumping = false;
                player.slowFallTicks = 0;
            }
        } else {
            if (Math.random() < 0.4) {
                createSnowSpray(player.slopeX - 10, getSlopeY(player.slopeX), 2);
            }
        }

    } else if (state === STATE.BIG_JUMPING && !player.isFallingInHole) {
        let currentGravity = player.gravity * 0.35;
        if (player.slowFallTicks > 0 && player.vAir >= 0) {
            currentGravity *= 0.15;
            player.slowFallTicks--;
        } else if (player.slowFallTicks > 0 && player.vAir < 0) {
            player.slowFallTicks--;
        }

        player.vAir += currentGravity;
        player.airOffset -= player.vAir;

        if (player.airOffset > 320) {
            player.airOffset = 320;
            if (player.vAir < 0) player.vAir = 0;
        }

        // 着地判定
        if (player.airOffset <= 0) {
            player.airOffset = 0;
            player.vAir = 0;
            state = STATE.PLAYING;

            createSnowSpray(player.slopeX, getSlopeY(player.slopeX), 20);
            sfx.playLanding();

            // 獲得ボーナス距離を確定し、履歴および累計にのみ加算（HUDは確定直近値を保持表示）
            const landedJumpBonus = Math.floor(lastJumpDist);
            jumpHistory.push(landedJumpBonus);
            totalJumpDistance += landedJumpBonus;

            completedBigJumps++;
            lastLandingDistance = distance;
            
            nextRampTargetDistance = Math.ceil((distance + 800) / 1000) * 1000;

            feedbackText = `BIG JUMP #${jumpHistory.length}: +${landedJumpBonus}m!`;
            feedbackTimer = 60;
        }
    }

    if (feedbackTimer > 0) feedbackTimer--;

    updateParticles();
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.03;
        if (p.life <= 0) particles.splice(i, 1);
    }
}


// ========================================
// 11. 描画処理
// ========================================

const skyGrad = ctx.createLinearGradient(0, 0, GAME_WIDTH, GAME_HEIGHT);
skyGrad.addColorStop(0, "#75c6f1");
skyGrad.addColorStop(0.6, "#bce3f7");
skyGrad.addColorStop(1, "#e8f5fb");

function render() {
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // 山並み
    ctx.fillStyle = "#a9d2e9";
    ctx.beginPath();
    ctx.moveTo(0, 180);
    ctx.lineTo(200, 80);
    ctx.lineTo(450, 220);
    ctx.lineTo(700, 90);
    ctx.lineTo(960, 240);
    ctx.lineTo(960, GAME_HEIGHT);
    ctx.lineTo(0, GAME_HEIGHT);
    ctx.fill();

    const sortedObs = [...obstacles].sort((a, b) => a.dist - b.dist);

    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#2b384a";
    ctx.lineWidth = 2;

    let currentX = -100;

    sortedObs.forEach(obs => {
        if (obs.type === "hole") {
            const hLeft = obs.dist - obs.w / 2;
            const hRight = obs.dist + obs.w / 2;

            if (hLeft > currentX) {
                drawSlopeBlock(currentX, hLeft);
            }
            currentX = Math.max(currentX, hRight);

        } else if (obs.type === "ramp") {
            const rStart = obs.dist - obs.w / 2;
            const rEnd = obs.dist + obs.w / 2;

            if (rStart > currentX) {
                drawSlopeBlock(currentX, rStart);
            }
            drawRampBlock(rStart, rEnd, obs.h);
            currentX = Math.max(currentX, rEnd);
        }
    });

    if (currentX < GAME_WIDTH + 100) {
        drawSlopeBlock(currentX, GAME_WIDTH + 100);
    }

    function drawSlopeBlock(x1, x2) {
        const y1 = getSlopeY(x1);
        const y2 = getSlopeY(x2);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x2, GAME_HEIGHT + 100);
        ctx.lineTo(x1, GAME_HEIGHT + 100);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1, GAME_HEIGHT + 100);
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2, GAME_HEIGHT + 100);
        ctx.stroke();

        ctx.fillStyle = "rgba(150, 180, 200, 0.15)";
        ctx.fillRect(x1, y1 + 5, 4, GAME_HEIGHT);
        ctx.fillRect(x2 - 4, y2 + 5, 4, GAME_HEIGHT);
        ctx.fillStyle = "#ffffff";
    }

    function drawRampBlock(x1, x2, height) {
        const y1 = getSlopeY(x1);
        const y2 = getSlopeY(x2);

        // 面の塗りつぶし
        ctx.beginPath();
        ctx.moveTo(x1, y1);

        const cp1x = x1 + (x2 - x1) * 0.5;
        const cp1y = y1 + (y2 - y1) * 0.5;
        const cp2x = x1 + (x2 - x1) * 0.8;
        const cp2y = y2 - height * 0.2;

        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2 - height);
        ctx.lineTo(x2, GAME_HEIGHT + 100);
        ctx.lineTo(x1, GAME_HEIGHT + 100);
        ctx.closePath();
        ctx.fill();

        // 輪郭線は滑走面の曲線部分のみをストローク（垂直の縦線を描かない）
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2 - height);
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
    }

    // スピードライン
    if (state === STATE.PLAYING || state === STATE.BIG_JUMPING) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
            let lx = (Date.now() * (speed * 0.2) + i * 180) % (GAME_WIDTH + 200) - 100;
            let ly = getSlopeY(lx) - Math.random() * 200;
            ctx.beginPath();
            ctx.moveTo(lx, ly);
            ctx.lineTo(lx - 30 * SLOPE_COS, ly - 30 * SLOPE_SIN);
            ctx.stroke();
        }
    }

    // 障害物描画
    sortedObs.forEach(obs => {
        if (obs.type === "hole" || obs.type === "ramp") return;

        const ox = obs.dist;
        const oy = getSlopeY(ox) + (obs.falling ? obs.fallY : 0);

        ctx.save();
        ctx.translate(ox, oy);
        ctx.rotate(SLOPE_ANGLE + (obs.falling ? 0.4 : 0));

        if (obs.type === "tree") {
            const trunkW = obs.isTall ? 10 : 8;
            const trunkH = obs.isTall ? 18 : 14;
            ctx.fillStyle = "#5d4037";
            ctx.fillRect(-trunkW / 2, -trunkH, trunkW, trunkH);
            ctx.fillStyle = obs.isTall ? "#1b5e20" : "#2e7d32";
            ctx.beginPath();
            ctx.moveTo(-obs.w / 2, -trunkH);
            ctx.lineTo(0, -obs.h);
            ctx.lineTo(obs.w / 2, -trunkH);
            ctx.fill();
        } else if (obs.type === "snowman") {
            ctx.fillStyle = "#e0f7fa";
            ctx.beginPath();
            ctx.arc(0, -14, 15, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(0, -34, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#ff6d00";
            ctx.fillRect(2, -36, 8, 3);
            ctx.fillStyle = "#263238";
            ctx.fillRect(-8, -44, 16, 3);
            ctx.fillRect(-5, -52, 10, 8);
        } else if (obs.type === "skier") {
            ctx.fillStyle = "#ffb300";
            ctx.fillRect(-10, -40, 20, 26);
            ctx.fillStyle = "#212121";
            ctx.beginPath();
            ctx.arc(0, -45, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#d32f2f";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(-20, -2);
            ctx.lineTo(25, -2);
            ctx.stroke();

            if (obs.falling) {
                ctx.fillStyle = "#ff1744";
                ctx.font = "bold 18px sans-serif";
                ctx.fillText("AAAAH!", -24, -58);
            }
        }

        ctx.restore();
    });

    // 雪パーティクル
    particles.forEach(p => {
        ctx.fillStyle = `rgba(255, 255, 255, ${p.life})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });

    // プレイヤー描画
    const px = player.isFallingInHole ? player.fallX : player.slopeX;
    const py = player.isFallingInHole ? (getSlopeY(player.fallX) + player.fallY) : (getSlopeY(px) - player.airOffset);

    ctx.save();
    ctx.translate(px, py);
    const leanAngle = SLOPE_ANGLE + (player.isFallingInHole ? 0.4 : (player.airOffset > 0 ? -0.15 : 0.15));
    ctx.rotate(leanAngle);

    if (player.airOffset > 0 && !player.isFallingInHole) {
        ctx.save();
        ctx.translate(0, player.airOffset);
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.beginPath();
        ctx.ellipse(0, 0, 20, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // スキー板
    ctx.strokeStyle = "#0288d1";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-20, -2);
    ctx.lineTo(25, -2);
    ctx.stroke();

    // ウェア
    ctx.fillStyle = "#d32f2f";
    ctx.fillRect(-8, -30, 16, 22);

    // ヘルメット
    ctx.fillStyle = "#1565c0";
    ctx.beginPath();
    ctx.arc(4, -33, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffeb3b";
    ctx.fillRect(6, -35, 5, 4);

    // ストック
    ctx.strokeStyle = "#78909c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-2, -20);
    ctx.lineTo(-18, -2);
    ctx.stroke();

    ctx.restore();

    // プレイ中テキスト (大ジャンプ中の操作案内・フィードバックテキストのみ)
    if (state === STATE.PLAYING || state === STATE.BIG_JUMPING) {
        if (state === STATE.BIG_JUMPING) {
            ctx.fillStyle = "#ff6d00";
            ctx.font = "bold 20px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("TAP TAP TO FLOAT! 🪂", px, py - 55);

            ctx.fillStyle = "#00e676";
            ctx.font = "bold 16px sans-serif";
            ctx.fillText(`Air Bonus: +${Math.floor(lastJumpDist)}m`, px, py - 30);
        }

        if (feedbackTimer > 0) {
            ctx.fillStyle = "#ff6f00";
            ctx.font = "bold 32px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(feedbackText, GAME_WIDTH / 2, 110);
        }
    }
}


// ========================================
// 12. 固定60FPSゲームループ
// ========================================

let lastTimestamp = 0;
let accumulator = 0;

function gameLoop(timestamp) {
    requestAnimationFrame(gameLoop);

    if (!lastTimestamp) {
        lastTimestamp = timestamp;
        return;
    }

    let frameDelta = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    if (frameDelta > STEP_MS * MAX_STEPS_PER_FRAME) {
        frameDelta = STEP_MS * MAX_STEPS_PER_FRAME;
    }

    accumulator += frameDelta;

    while (accumulator >= STEP_MS) {
        if (state === STATE.PLAYING || state === STATE.BIG_JUMPING || state === STATE.TITLE || state === STATE.HIGHSCORE_MODAL) {
            update(STEP_MS);
        }
        accumulator -= STEP_MS;
    }

    render();
}


// ========================================
// 13. 初期化
// ========================================

function init() {
    resizeCanvas();
    loadHighScore();
    initInputHandlers();
    initBackButtonGuard();
    resetGame();
    goToTitle();

    requestAnimationFrame(gameLoop);
}

document.addEventListener("DOMContentLoaded", init);