// ================= AUDIO =================
const AudioManager = (() => {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  let musicNode = null, musicGain = null;
  let sfxOn = true, musicOn = false;
  function beep(freq = 440, dur = 0.12, type = "sine", gain = 0.12) {
    if (!sfxOn) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  }
  function playMove(sym) {
    if (sym === "X") beep(760, 0.08, "sawtooth", 0.08);
    else beep(520, 0.09, "triangle", 0.08);
  }
  function playWin() {
    if (!sfxOn) return;
    [880, 1000, 1180].forEach((f, i) => setTimeout(() => beep(f, 0.12, "sine", 0.12), i * 90));
  }
  function playDraw() {
    if (!sfxOn) return;
    beep(420, 0.22, "sine", 0.12);
    setTimeout(() => beep(360, 0.18, "sine", 0.08), 180);
  }
  function startMusic() {
    if (musicOn) return;
    try { if (ctx.state === "suspended") ctx.resume(); } catch (e) {}
    musicOn = true;
    musicNode = ctx.createOscillator();
    musicNode.type = "sine";
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.02;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(musicNode.frequency);
    musicNode.frequency.value = 120;
    musicNode.connect(musicGain);
    musicGain.connect(ctx.destination);
    lfo.start();
    musicNode.start();
    musicNode._lfo = lfo;
  }
  function stopMusic() {
    if (!musicOn) return;
    musicOn = false;
    if (musicNode) {
      try { musicNode._lfo.stop(); } catch (e) {}
      try { musicNode.stop(); } catch (e) {}
      musicNode.disconnect();
      musicNode = null;
      musicGain.disconnect();
      musicGain = null;
    }
  }
  function toggleSfx() { sfxOn = !sfxOn; return sfxOn; }
  function toggleMusic() { musicOn ? stopMusic() : startMusic(); return musicOn; }
  function muteAll(toggle) {
    if (toggle === undefined) toggle = !sfxOn || musicOn;
    if (toggle) { sfxOn = false; stopMusic(); musicOn = false; }
    else { sfxOn = true; }
  }
  return {
    playMove,
    playWin,
    playDraw,
    toggleSfx,
    toggleMusic,
    muteAll,
    _state: () => ({ sfxOn, musicOn }),
  };
})();

// ================= DOM elements =================
// (Assume all your DOM element selectors remain unchanged here)

// Example (replace/add your full DOM selectors as needed):
const boardEl = document.getElementById("board");
const resultEl = document.getElementById("result");
const startBtn = document.getElementById("startBtn");
const difficultySel = document.getElementById("difficulty");
const symbolSel = document.getElementById("symbol");

// ================= game state =================
let state = {
  mode: "endless", // "quick" or "endless"
  opponent: "computer", // "computer" or "human"
  difficulty: "hard",
  p1Name: "Player 1",
  p2Name: "Computer",
  p1Symbol: "X",
  current: "X",
  active: true,
  board: Array(9).fill(""),
  scores: { X: 0, O: 0, D: 0, round: 1 },
  bestOf: 3,
  neededWins: 2,
};

// ================= helpers =================
const wins = [
  [0, 1, 2],[3, 4, 5],[6, 7, 8],
  [0, 3, 6],[1, 4, 7],[2, 5, 8],
  [0, 4, 8],[2, 4, 6],
];

function checkWinnerStatic(board, sym) {
  return wins.some(line => line.every(i => board[i] === sym));
}

function boardFull(board) {
  return board.every(cell => cell !== "");
}

// ================= board rendering =================
function renderBoard() {
  boardEl.innerHTML = "";
  state.board.forEach((val, i) => {
    const cell = document.createElement("div");
    cell.className = "cell" + (val ? " " + val : "");
    cell.dataset.index = i;
    cell.textContent = val;
    cell.addEventListener("click", onCellClick);
    boardEl.appendChild(cell);
  });
}

function resetBoard(startSym = "X") {
  state.board = Array(9).fill("");
  state.active = true;
  state.current = startSym;
  resultEl.textContent = "";
  renderBoard();
}

// ================= AI (minimax) =================
function chooseAIMove(board, ai, difficulty) {
  const empties = board.map((v, i) => v === "" ? i : null).filter(i => i !== null);
  if (empties.length === 0) return null;

  if (difficulty === "easy") {
    return empties[Math.floor(Math.random() * empties.length)];
  }

  if (difficulty === "medium") {
    // Win if possible
    for (const idx of empties) {
      const testBoard = board.slice();
      testBoard[idx] = ai;
      if (checkWinnerStatic(testBoard, ai)) return idx;
    }
    // Block opponent's win
    const human = ai === "X" ? "O" : "X";
    for (const idx of empties) {
      const testBoard = board.slice();
      testBoard[idx] = human;
      if (checkWinnerStatic(testBoard, human)) return idx;
    }
    // Random otherwise
    return empties[Math.floor(Math.random() * empties.length)];
  }

  // Hard: use minimax
  return minimax(board.slice(), ai, ai).index;
}

function minimax(board, player, aiPlayer) {
  const availSpots = board.map((v, i) => v === "" ? i : null).filter(i => i !== null);

  // Terminal states
  if (checkWinnerStatic(board, aiPlayer)) return { score: 10 };
  if (checkWinnerStatic(board, aiPlayer === "X" ? "O" : "X")) return { score: -10 };
  if (availSpots.length === 0) return { score: 0 };

  const moves = [];
  for (const i of availSpots) {
    board[i] = player;
    let score;
    if (player === aiPlayer) {
      score = minimax(board, aiPlayer === "X" ? "O" : "X", aiPlayer).score;
    } else {
      score = minimax(board, aiPlayer, aiPlayer).score;
    }
    moves.push({ index: i, score });
    board[i] = "";
  }

  if (player === aiPlayer) {
    // Maximize
    let max = -Infinity, maxMove = null;
    for (const move of moves) {
      if (move.score > max) { max = move.score; maxMove = move; }
    }
    return maxMove;
  } else {
    // Minimize
    let min = Infinity, minMove = null;
    for (const move of moves) {
      if (move.score < min) { min = move.score; minMove = move; }
    }
    return minMove;
  }
}

// ================= core flow =================
function nextTurn() {
  if (!state.active) return;
  if (boardFull(state.board)) {
    state.active = false;
    resultEl.textContent = "Draw!";
    AudioManager.playDraw();
    state.scores.D++;
    return;
  }
  if (checkWinnerStatic(state.board, state.current)) {
    state.active = false;
    resultEl.textContent = state.current + " Wins!";
    AudioManager.playWin();
    state.scores[state.current]++;
    return;
  }
  state.current = state.current === "X" ? "O" : "X";
  if (state.opponent === "computer" && state.current === state.p2Symbol && state.active) {
    setTimeout(aiMove, 400);
  }
}

function aiMove() {
  const idx = chooseAIMove(state.board, state.p2Symbol, state.difficulty);
  if (idx === null || state.board[idx] !== "") return;
  state.board[idx] = state.p2Symbol;
  AudioManager.playMove(state.p2Symbol);
  renderBoard();
  nextTurn();
}

// ================= UI events =================
function onCellClick(e) {
  const idx = +e.currentTarget.dataset.index;
  if (!state.active || state.board[idx]) return;
  state.board[idx] = state.current;
  AudioManager.playMove(state.current);
  renderBoard();
  nextTurn();
}

startBtn.addEventListener("click", () => {
  state.difficulty = difficultySel.value;
  state.p1Symbol = symbolSel.value;
  state.p2Symbol = state.p1Symbol === "X" ? "O" : "X";
  resetBoard(state.p1Symbol);
  renderBoard();
  if (state.opponent === "computer" && state.p2Symbol === "X") {
    setTimeout(aiMove, 400);
  }
});

// ================= scoreboard update =================
// (Add your scoreboard update logic here if needed)

renderBoard();  function startMusic() {
    if (musicOn) return;
    try {
      if (ctx.state === "suspended") ctx.resume();
    } catch (e) {}
    musicOn = true;
    musicNode = ctx.createOscillator();
    musicNode.type = "sine";
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.02;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(musicNode.frequency);
    musicNode.frequency.value = 120;
    musicNode.connect(musicGain);
    musicGain.connect(ctx.destination);
    lfo.start();
    musicNode.start();
    musicNode._lfo = lfo;
  }
  function stopMusic() {
    if (!musicOn) return;
    musicOn = false;
    if (musicNode) {
      try {
        musicNode._lfo.stop();
      } catch (e) {}
      try {
        musicNode.stop();
      } catch (e) {}
      musicNode.disconnect();
      musicNode = null;
      musicGain.disconnect();
      musicGain = null;
    }
  }
  function toggleSfx() {
    sfxOn = !sfxOn;
    return sfxOn;
  }
  function toggleMusic() {
    if (musicOn) {
      stopMusic();
    } else {
      startMusic();
    }
    return musicOn;
  }
  function muteAll(toggle) {
    if (toggle === undefined) toggle = !sfxOn || musicOn;
    if (toggle) {
      sfxOn = false;
      stopMusic();
      musicOn = false;
    } else {
      sfxOn = true;
    }
  }
  return {
    playMove,
    playWin,
    playDraw,
    toggleSfx,
    toggleMusic,
    muteAll,
    _state: () => ({ sfxOn, musicOn }),
  };
})();

/* ================= DOM elements ================= */
const menu = document.getElementById("menu");
const game = document.getElementById("game");
const boardEl = document.getElementById("board");
const turnEl = document.getElementById("turn");
const resultEl = document.getElementById("result");

const opponentSel = document.getElementById("opponent");
const difficultyField = document.getElementById("difficulty-field");
const p2Field = document.getElementById("p2-field");
const startBtn = document.getElementById("startBtn");
const demoBtn = document.getElementById("demoBtn");
const backBtn = document.getElementById("backBtn");
const nextRoundBtn = document.getElementById("nextRoundBtn");
const resetMatchBtn = document.getElementById("resetMatchBtn");

const gameModeSel = document.getElementById("gameMode");
const difficultySel = document.getElementById("difficulty");
const symbolSel = document.getElementById("symbol");
const p1Input = document.getElementById("p1");
const p2Input = document.getElementById("p2");

const bestOfSel = document.getElementById("bestOf");
const sfxToggle = document.getElementById("sfxToggle");
const musicToggle = document.getElementById("musicToggle");

const scorePanel = document.getElementById("scorePanel");
const xNameEl = document.getElementById("xName");
const oNameEl = document.getElementById("oName");
const xScoreEl = document.getElementById("xScore");
const oScoreEl = document.getElementById("oScore");
const dScoreEl = document.getElementById("dScore");
const roundMetaEl = document.getElementById("roundMeta");

const overlay = document.getElementById("overlay");
const modalTitle = document.getElementById("modalTitle");
const modalSub = document.getElementById("modalSub");
const playAgainBtn = document.getElementById("playAgainBtn");
const toMenuBtn = document.getElementById("toMenuBtn");

const endMatchBtn = document.getElementById("endMatchBtn");
const muteAllBtn = document.getElementById("muteAllBtn");

/* ================= game state ================= */
let state = {
  mode: "endless", // 'quick' | 'endless'
  opponent: "computer", // 'computer' | 'human'
  difficulty: "hard",
  p1Name: "Player 1",
  p2Name: "Computer",
  p1Symbol: "X", // 'X' or 'O'
  current: "X",
  active: true,
  board: Array(9).fill(""),
  scores: { X: 0, O: 0, D: 0, round: 1 },
  bestOf: 3,
  neededWins: 2,
};

const wins = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/* ================= helpers ================= */
function showMenu() {
  menu.style.display = "grid";
  game.style.display = "none";
  overlay.style.display = "none";
}
function showGame() {
  menu.style.display = "none";
  game.style.display = "grid";
  overlay.style.display = "none";
}

function updateTurn() {
  const isX = state.current === "X";
  const nameX = state.p1Symbol === "X" ? state.p1Name : state.p2Name;
  const nameO =
    state.p1Symbol === "O"
      ? state.p1Name
      : state.opponent === "computer"
      ? "Computer"
      : state.p2Name;
  const who = isX ? nameX : nameO;
  turnEl.textContent = `${who}'s Turn (${state.current})`;
}

function applyWinStyles(line) {
  line.forEach((idx) => {
    const el = boardEl.querySelector(`[data-index="${idx}"]`);
    if (el) el.classList.add("win");
  });
}

function checkWinnerStatic(board, player) {
  return wins.some((w) => w.every((i) => board[i] === player));
}

/* ================= board rendering ================= */
function renderBoard() {
  boardEl.innerHTML = "";
  state.board.forEach((val, i) => {
    const c = document.createElement("div");
    c.className = "cell" + (val ? " " + val : "");
    c.dataset.index = i;
    c.textContent = val;
    c.addEventListener("click", onCellClick);
    boardEl.appendChild(c);
  });
}

function resetBoard(startAs = "X") {
  state.board = Array(9).fill("");
  state.active = true;
  state.current = startAs;
  resultEl.textContent = "";
  resultEl.className = "result";
  Array.from(boardEl.children).forEach((n) => n.classList.remove("win"));
  renderBoard();
  updateTurn();
  nextRoundBtn.disabled = true;
}

* ================= AI (minimax) ================= */
function chooseAIMove(board, ai, difficulty) {
  const empties = board
    .map((v, i) => (v === "" ? i : null))
    .filter((i) => i !== null);
  if (empties.length === 0) return null;

  if (difficulty === "easy") {
    // Always random
    return empties[Math.floor(Math.random() * empties.length)];
  }
  if (difficulty === "medium") {
    // Win if possible
    for (const idx of empties) {
      const testBoard = board.slice();
      testBoard[idx] = ai;
      if (checkWinnerStatic(testBoard, ai)) return idx;
    }
    // Block opponent's win if possible
    const human = ai === "X" ? "O" : "X";
    for (const idx of empties) {
      const testBoard = board.slice();
      testBoard[idx] = human;
      if (checkWinnerStatic(testBoard, human)) return idx;
    }
    // Otherwise random
    return empties[Math.floor(Math.random() * empties.length)];
  }
  // Hard: always use minimax
  return minimax(board.slice(), ai).index;
}



/* ================= core flow ================= */
function playerToMoveIsComputer() {
  if (state.opponent !== "computer") return false;
  const computerSymbol = state.p1Symbol === "X" ? "O" : "X";
  return state.current === computerSymbol;
}

function aiMove() {
  if (!state.active) return;
  const comp = state.p1Symbol === "X" ? "O" : "X";
  const moveIdx = chooseAIMove(state.board, comp, state.difficulty);
  if (moveIdx == null) return;
  const cellEl = boardEl.querySelector(`[data-index="${moveIdx}"]`);
  if (!cellEl || state.board[moveIdx]) return;
  // simulate click so same flow applies
  cellEl.click();
}

function checkGameEnd(playerJustMoved) {
  const line = wins.find((w) =>
    w.every((i) => state.board[i] === playerJustMoved)
  );
  if (line) {
    state.active = false;
    applyWinStyles(line);
    const winnerName =
      playerJustMoved === "X"
        ? state.p1Symbol === "X"
          ? state.p1Name
          : state.p2Name
        : state.p1Symbol === "O"
        ? state.p1Name
        : state.opponent === "computer"
        ? "Computer"
        : state.p2Name;
    resultEl.textContent = `${winnerName} Wins! ✨`;
    resultEl.className = "result win";
    AudioManager.playWin();
    // update scores
    state.scores[playerJustMoved]++;
    updateScoreboard();

    // check best-of completion
    if (
      state.neededWins &&
      (state.scores.X >= state.neededWins || state.scores.O >= state.neededWins)
    ) {
      // auto end match
      endMatch(false);
    } else {
      endOrQueueNext();
    }
    return true;
  }
  if (!state.board.includes("")) {
    state.active = false;
    resultEl.textContent = `It's a Draw.`;
    resultEl.className = "result draw";
    AudioManager.playDraw();
    state.scores.D++;
    updateScoreboard();
    endOrQueueNext();
    return true;
  }
  return false;
}

function endOrQueueNext() {
  if (state.mode === "quick") {
    // show modal
    modalTitle.textContent = resultEl.textContent || "Match Over";
    overlay.style.display = "flex";
  } else {
    // Endless: enable Next Round button & show reset/end controls
    nextRoundBtn.disabled = false;
    nextRoundBtn.style.display = "inline-flex";
    resetMatchBtn.style.display = "inline-flex";
    endMatchBtn.style.display = "inline-flex";
  }
}

function endMatch(force = false) {
  // force true: manual end; false: auto end when someone reached neededWins
  const X = state.scores.X,
    O = state.scores.O;
  let title = "",
    sub = "";
  if (force) {
    if (X > O) {
      title = `${
        state.p1Symbol === "X"
          ? state.p1Name
          : state.opponent === "human"
          ? state.p2Name
          : "Computer"
      } wins the match!`;
    } else if (O > X) {
      title = `${
        state.p1Symbol === "O"
          ? state.p1Name
          : state.opponent === "human"
          ? state.p2Name
          : "Computer"
      } wins the match!`;
    } else {
      title = `Match ended — It's a draw!`;
    }
    sub = `Final score — X: ${X} · O: ${O} · Draws: ${state.scores.D}`;
  } else {
    // auto end
    if (state.scores.X > state.scores.O) title = `X wins the match!`;
    else if (state.scores.O > state.scores.X) title = `O wins the match!`;
    else title = `Match finished`;
    sub = `Final score — X: ${X} · O: ${O} · Draws: ${state.scores.D}`;
  }
  modalTitle.textContent = title;
  modalSub.textContent = sub;
  overlay.style.display = "flex";
  state.active = false;
}

/* ================= UI events ================= */
opponentSel.addEventListener("change", () => {
  const isHuman = opponentSel.value === "human";
  p2Field.style.display = isHuman ? "block" : "none";
  difficultyField.style.display = isHuman ? "none" : "block";
});

demoBtn.addEventListener("click", () => {
  const p1s = ["Ola", "Ada", "Zee", "Maya", "Dev", "Kiro"];
  const p2s = ["Lex", "Timi", "Kai", "Joss", "Rio", "Rin"];
  p1Input.value = p1s[Math.floor(Math.random() * p1s.length)];
  p2Input.value = p2s[Math.floor(Math.random() * p2s.length)];
});

sfxToggle.addEventListener("click", () => {
  const on = AudioManager.toggleSfx();
  sfxToggle.textContent = `SFX: ${on ? "On" : "Off"}`;
});

musicToggle.addEventListener("click", () => {
  const on = AudioManager.toggleMusic();
  musicToggle.textContent = `Music: ${on ? "On" : "Off"}`;
});

muteAllBtn.addEventListener("click", () => {
  AudioManager.muteAll(true);
  sfxToggle.textContent = "SFX: Off";
  musicToggle.textContent = "Music: Off";
});

startBtn.addEventListener("click", () => {
  // read form
  state.mode = gameModeSel.value; // quick | endless
  state.opponent = opponentSel.value; // computer | human
  state.p1Name = (p1Input.value || "Player 1").trim();
  state.p2Name =
    state.opponent === "human"
      ? (p2Input.value || "Player 2").trim()
      : "Computer";
  state.difficulty = difficultySel.value;
  state.p1Symbol = symbolSel.value; // X or O

  // best-of parsing
  state.bestOf = parseInt(bestOfSel.value, 10) || 0;
  state.neededWins = state.bestOf > 0 ? Math.ceil(state.bestOf / 2) : null;

  // Reset scores if starting new match
  state.scores = { X: 0, O: 0, D: 0, round: 1 };

  // UI toggles
  menu.style.display = "none";
  game.style.display = "grid";

  // **Ensure scoreboard is visible in game view (restored)**
  scorePanel.style.display = "block";

  nextRoundBtn.style.display =
    state.mode === "endless" ? "inline-flex" : "none";
  resetMatchBtn.style.display = "none";
  endMatchBtn.style.display = state.mode === "endless" ? "inline-flex" : "none";

  // Initialize board & scoreboard
  updateScoreboard();
  // Who starts round 1 → always X
  resetBoard("X");

  // If computer is X and player chose O, let AI open
  if (state.opponent === "computer" && playerToMoveIsComputer())
    setTimeout(aiMove, 420);
});

backBtn.addEventListener("click", () => {
  // Return to menu
  showMenu();
});

nextRoundBtn.addEventListener("click", () => {
  if (state.mode !== "endless") return;
  state.scores.round++;
  updateScoreboard();
  // Alternate who starts each round for fairness
  const startAs = state.scores.round % 2 === 1 ? "X" : "O";
  resetBoard(startAs);
  // If computer should open (and it is their symbol), make a move
  if (state.opponent === "computer" && playerToMoveIsComputer())
    setTimeout(aiMove, 400);
});

resetMatchBtn.addEventListener("click", () => {
  state.scores = { X: 0, O: 0, D: 0, round: 1 };
  updateScoreboard();
  resetBoard("X");
  resetMatchBtn.style.display = "none";
});

endMatchBtn.addEventListener("click", () => {
  endMatch(true);
});

// Quick match modal controls
playAgainBtn.addEventListener("click", () => {
  overlay.style.display = "none";
  // reset scores & board, keep settings
  state.scores = { X: 0, O: 0, D: 0, round: 1 };
  updateScoreboard();
  resetBoard("X");
  if (state.opponent === "computer" && playerToMoveIsComputer())
    setTimeout(aiMove, 420);
});
toMenuBtn.addEventListener("click", () => {
  overlay.style.display = "none";
  game.style.display = "none";
  menu.style.display = "grid";
});

/* ================= board interactions ================= */
function onCellClick(e) {
  const idx = +e.currentTarget.dataset.index;
  if (!state.active || state.board[idx]) return;
  state.board[idx] = state.current;
  e.currentTarget.textContent = state.current;
  e.currentTarget.classList.add(state.current);

  AudioManager.playMove(state.current);

  if (checkGameEnd(state.current)) return;

  state.current = state.current === "X" ? "O" : "X";
  updateTurn();

  if (state.opponent === "computer" && playerToMoveIsComputer()) {
    setTimeout(aiMove, 420);
  }
}

/* ================= scoreboard update ================= */
function updateScoreboard() {
  const nameX =
    state.p1Symbol === "X"
      ? state.p1Name
      : state.opponent === "computer"
      ? "Computer"
      : state.p2Name;
  const nameO =
    state.p1Symbol === "O"
      ? state.p1Name
      : state.opponent === "computer"
      ? "Computer"
      : state.p2Name;
  xNameEl.textContent = `X — ${nameX}`;
  oNameEl.textContent = `O — ${nameO}`;
  xScoreEl.textContent = state.scores.X;
  oScoreEl.textContent = state.scores.O;
  dScoreEl.textContent = state.scores.D;
  roundMetaEl.textContent = `Round: ${state.scores.round}`;
}

/* ================= init ================= */
renderBoard();
updateTurn();
updateScoreboard();
showMenu();
