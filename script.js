/**
 * Tic Tac Toe - Remodeled Version
 * Modular, accessible, and optimized game logic
 */

// ============================================================================
// PERSISTENCE MANAGER MODULE
// ============================================================================
const PersistenceManager = (() => {
  const STORAGE_KEY = "ticTacToe_gameState";
  const STATS_KEY = "ticTacToe_stats";

  const saveGameState = (state) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      console.warn("Failed to save game state:", error);
      return false;
    }
  };

  const loadGameState = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.warn("Failed to load game state:", error);
      return null;
    }
  };

  const saveStats = (stats) => {
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
      return true;
    } catch (error) {
      console.warn("Failed to save stats:", error);
      return false;
    }
  };

  const loadStats = () => {
    try {
      const saved = localStorage.getItem(STATS_KEY);
      return saved
        ? JSON.parse(saved)
        : { totalGames: 0, totalWins: 0, totalDraws: 0 };
    } catch (error) {
      console.warn("Failed to load stats:", error);
      return { totalGames: 0, totalWins: 0, totalDraws: 0 };
    }
  };

  const clearGameState = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      return true;
    } catch (error) {
      console.warn("Failed to clear game state:", error);
      return false;
    }
  };

  return {
    saveGameState,
    loadGameState,
    saveStats,
    loadStats,
    clearGameState,
    isAvailable: () => {
      try {
        const test = "__test__";
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
      } catch (e) {
        return false;
      }
    },
  };
})();

// ============================================================================
// AUDIO MANAGER MODULE
// ============================================================================
const AudioManager = (() => {
  let audioContext = null;
  let musicNode = null;
  let musicGain = null;
  let sfxEnabled = true;
  let musicEnabled = false;

  const initAudioContext = () => {
    try {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioContext.state === "suspended") {
        audioContext.resume().catch(() => {});
      }
      return audioContext;
    } catch (error) {
      console.warn("AudioContext not supported:", error);
      return null;
    }
  };

  const playBeep = (
    frequency = 440,
    duration = 0.12,
    waveType = "sine",
    volume = 0.12,
  ) => {
    if (!sfxEnabled || !audioContext) return;

    try {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = waveType;
      oscillator.frequency.value = frequency;
      gainNode.gain.value = volume;

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
      gainNode.gain.exponentialRampToValueAtTime(
        0.0001,
        audioContext.currentTime + duration,
      );
    } catch (error) {
      console.warn("Error playing beep:", error);
    }
  };

  return {
    initialize: initAudioContext,

    playMoveSound: (symbol) => {
      if (symbol === "X") {
        playBeep(760, 0.08, "sawtooth", 0.08);
      } else {
        playBeep(520, 0.09, "triangle", 0.08);
      }
    },

    playWinSound: () => {
      if (!sfxEnabled || !audioContext) return;
      const frequencies = [880, 1000, 1180];
      frequencies.forEach((freq, index) => {
        setTimeout(() => playBeep(freq, 0.12, "sine", 0.12), index * 90);
      });
    },

    playDrawSound: () => {
      if (!sfxEnabled || !audioContext) return;
      playBeep(420, 0.22, "sine", 0.12);
      setTimeout(() => playBeep(360, 0.18, "sine", 0.08), 180);
    },

    startMusic: () => {
      initAudioContext();
      if (musicEnabled || !audioContext) return;

      try {
        musicEnabled = true;
        musicNode = audioContext.createOscillator();
        musicNode.type = "sine";
        musicGain = audioContext.createGain();
        musicGain.gain.value = 0.02;

        const lfo = audioContext.createOscillator();
        lfo.frequency.value = 0.05;
        const lfoGain = audioContext.createGain();
        lfoGain.gain.value = 0.02;

        lfo.connect(lfoGain);
        lfoGain.connect(musicNode.frequency);
        musicNode.frequency.value = 120;
        musicNode.connect(musicGain);
        musicGain.connect(audioContext.destination);

        lfo.start();
        musicNode.start();
        musicNode._lfo = lfo;
      } catch (error) {
        console.warn("Error starting music:", error);
      }
    },

    stopMusic: () => {
      if (!musicEnabled || !musicNode) return;

      try {
        musicEnabled = false;
        if (musicNode._lfo) musicNode._lfo.stop();
        musicNode.stop();
        musicNode.disconnect();
        musicNode = null;
        if (musicGain) musicGain.disconnect();
        musicGain = null;
      } catch (error) {
        console.warn("Error stopping music:", error);
      }
    },

    toggleSfx: () => {
      sfxEnabled = !sfxEnabled;
      return sfxEnabled;
    },

    toggleMusic: () => {
      if (musicEnabled) {
        AudioManager.stopMusic();
      } else {
        AudioManager.startMusic();
      }
      return musicEnabled;
    },

    muteAll: () => {
      sfxEnabled = false;
      AudioManager.stopMusic();
      musicEnabled = false;
    },

    getState: () => ({ sfxEnabled, musicEnabled }),
  };
})();

// ============================================================================
// GAME LOGIC MODULE
// ============================================================================
const GameLogic = (() => {
  // Win combinations for 3x3 board
  const WIN_COMBINATIONS = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  const checkWinner = (board, symbol) => {
    return WIN_COMBINATIONS.some((combination) =>
      combination.every((index) => board[index] === symbol),
    );
  };

  const getAvailableMoves = (board) => {
    return board
      .map((cell, index) => (cell === "" ? index : null))
      .filter((index) => index !== null);
  };

  const isBoardFull = (board) => getAvailableMoves(board).length === 0;

  return {
    checkWinner,
    getAvailableMoves,
    isBoardFull,
    WIN_COMBINATIONS,
  };
})();

// ============================================================================
// AI ENGINE MODULE (Optimization: Memoized Minimax)
// ============================================================================
const AIEngine = (() => {
  let memo = {};
  const MINIMAX_MAX_DEPTH = 9;

  const memoKey = (board, player) => `${board.join("")}_${player}`;

  const minimize = (board, maxPlayer) => {
    const key = memoKey(board, "MIN");
    if (memo[key] !== undefined) return memo[key];

    if (GameLogic.checkWinner(board, maxPlayer)) return { score: 10 };
    if (GameLogic.checkWinner(board, maxPlayer === "X" ? "O" : "X"))
      return { score: -10 };
    if (GameLogic.isBoardFull(board)) return { score: 0 };

    const availableMoves = GameLogic.getAvailableMoves(board);
    let bestScore = Infinity;
    let bestMove = availableMoves[0];

    for (let moveIndex of availableMoves) {
      board[moveIndex] = maxPlayer === "X" ? "O" : "X";
      const score = maximize(board, maxPlayer).score;
      board[moveIndex] = "";

      if (score < bestScore) {
        bestScore = score;
        bestMove = moveIndex;
      }
    }

    memo[key] = { index: bestMove, score: bestScore };
    return memo[key];
  };

  const maximize = (board, maxPlayer) => {
    const key = memoKey(board, "MAX");
    if (memo[key] !== undefined) return memo[key];

    if (GameLogic.checkWinner(board, maxPlayer)) return { score: 10 };
    if (GameLogic.checkWinner(board, maxPlayer === "X" ? "O" : "X"))
      return { score: -10 };
    if (GameLogic.isBoardFull(board)) return { score: 0 };

    const availableMoves = GameLogic.getAvailableMoves(board);
    let bestScore = -Infinity;
    let bestMove = availableMoves[0];

    for (let moveIndex of availableMoves) {
      board[moveIndex] = maxPlayer;
      const score = minimize(board, maxPlayer).score;
      board[moveIndex] = "";

      if (score > bestScore) {
        bestScore = score;
        bestMove = moveIndex;
      }
    }

    memo[key] = { index: bestMove, score: bestScore };
    return memo[key];
  };

  return {
    chooseMove: (board, aiSymbol, difficulty) => {
      const availableMoves = GameLogic.getAvailableMoves(board);

      if (availableMoves.length === 0) return null;

      switch (difficulty) {
        case "easy":
          return availableMoves[
            Math.floor(Math.random() * availableMoves.length)
          ];

        case "medium":
          return Math.random() < 0.5
            ? availableMoves[Math.floor(Math.random() * availableMoves.length)]
            : maximize(board.slice(), aiSymbol).index;

        case "hard":
        default:
          return maximize(board.slice(), aiSymbol).index;
      }
    },

    clearMemo: () => {
      memo = {};
    },
  };
})();

// ============================================================================
// DOM MANAGER MODULE
// ============================================================================
const DOMManager = (() => {
  const elements = {
    menu: document.getElementById("menu"),
    game: document.getElementById("game"),
    board: document.getElementById("board"),
    turnDisplay: document.getElementById("turn"),
    resultDisplay: document.getElementById("result"),
    overlay: document.getElementById("overlay"),

    // Menu inputs
    gameMode: document.getElementById("gameMode"),
    opponent: document.getElementById("opponent"),
    difficulty: document.getElementById("difficulty"),
    symbol: document.getElementById("symbol"),
    bestOf: document.getElementById("bestOf"),
    p1Input: document.getElementById("p1"),
    p2Input: document.getElementById("p2"),
    p2Field: document.getElementById("p2-field"),
    difficultyField: document.getElementById("difficulty-field"),

    // Menu buttons
    startBtn: document.getElementById("startBtn"),
    demoBtn: document.getElementById("demoBtn"),

    // Game buttons
    backBtn: document.getElementById("backBtn"),
    nextRoundBtn: document.getElementById("nextRoundBtn"),
    resetMatchBtn: document.getElementById("resetMatchBtn"),
    endMatchBtn: document.getElementById("endMatchBtn"),

    // Scoreboard
    scorePanel: document.getElementById("scorePanel"),
    xName: document.getElementById("xName"),
    oName: document.getElementById("oName"),
    xScore: document.getElementById("xScore"),
    oScore: document.getElementById("oScore"),
    drawScore: document.getElementById("dScore"),
    roundMeta: document.getElementById("roundMeta"),

    // Audio toggles
    sfxToggle: document.getElementById("sfxToggle"),
    musicToggle: document.getElementById("musicToggle"),
    muteAllBtn: document.getElementById("muteAllBtn"),

    // Modal
    modalTitle: document.getElementById("modalTitle"),
    modalSub: document.getElementById("modalSub"),
    playAgainBtn: document.getElementById("playAgainBtn"),
    toMenuBtn: document.getElementById("toMenuBtn"),
  };

  const validateElements = () => {
    const missingElements = Object.entries(elements)
      .filter(([key, el]) => !el)
      .map(([key]) => key);

    if (missingElements.length > 0) {
      console.error("Missing DOM elements:", missingElements);
    }
  };

  return {
    get: (key) => elements[key],
    getAll: () => elements,
    showMenu: () => {
      elements.menu.style.display = "grid";
      elements.game.style.display = "none";
      elements.overlay.style.display = "none";
    },
    showGame: () => {
      elements.menu.style.display = "none";
      elements.game.style.display = "grid";
      elements.overlay.style.display = "none";
    },
    showModal: () => {
      elements.overlay.style.display = "flex";
    },
    hideModal: () => {
      elements.overlay.style.display = "none";
    },
    renderBoard: (board) => {
      const boardEl = elements.board;
      boardEl.innerHTML = "";
      board.forEach((symbol, index) => {
        const cell = document.createElement("div");
        cell.className = `cell ${symbol}`;
        cell.dataset.index = index;
        cell.textContent = symbol;
        cell.setAttribute("role", "button");
        cell.setAttribute("aria-pressed", "false");
        boardEl.appendChild(cell);
      });
    },
    highlightWinningCells: (winningIndices) => {
      winningIndices.forEach((index) => {
        const cell = elements.board.querySelector(`[data-index="${index}"]`);
        if (cell) cell.classList.add("win");
      });
    },
    clearBoardHighlight: () => {
      elements.board.querySelectorAll(".win").forEach((cell) => {
        cell.classList.remove("win");
      });
    },
    updateBoardForSymbol: (index, symbol) => {
      const cell = elements.board.querySelector(`[data-index="${index}"]`);
      if (cell) {
        cell.textContent = symbol;
        cell.classList.add(symbol);
        cell.setAttribute("aria-pressed", "true");
      }
    },
    validateElements,
  };
})();

// ============================================================================
// STATE MANAGER MODULE
// ============================================================================
const StateManager = (() => {
  let state = {
    mode: "endless",
    opponent: "computer",
    difficulty: "hard",
    p1Name: "Player 1",
    p2Name: "Computer",
    p1Symbol: "X",
    currentSymbol: "X",
    isActive: true,
    board: Array(9).fill(""),
    scores: { X: 0, O: 0, draws: 0, round: 1 },
    bestOf: 3,
    neededWins: 2,
  };

  const resetBoard = (startSymbol = "X") => {
    state.board = Array(9).fill("");
    state.currentSymbol = startSymbol;
    state.isActive = true;
  };

  const resetMatch = () => {
    state.scores = { X: 0, O: 0, draws: 0, round: 1 };
    resetBoard("X");
  };

  const resetScores = () => {
    state.scores = { X: 0, O: 0, draws: 0, round: 1 };
  };

  const getOpponentSymbol = () => {
    return state.p1Symbol === "X" ? "O" : "X";
  };

  const isComputerTurn = () => {
    return (
      state.opponent === "computer" &&
      state.currentSymbol === getOpponentSymbol()
    );
  };

  const recordMove = (index, symbol) => {
    if (state.board[index] === "") {
      state.board[index] = symbol;
      return true;
    }
    return false;
  };

  const nextTurn = () => {
    state.currentSymbol = state.currentSymbol === "X" ? "O" : "X";
  };

  const recordScore = (symbol) => {
    if (symbol === "X" || symbol === "O") {
      state.scores[symbol]++;
    }
  };

  const recordDraw = () => {
    state.scores.draws++;
  };

  const advanceRound = () => {
    state.scores.round++;
  };

  return {
    get: () => state,
    set: (newState) => {
      state = { ...state, ...newState };
      // Auto-save state changes
      PersistenceManager.saveGameState(state);
    },
    resetBoard,
    resetMatch,
    resetScores,
    getOpponentSymbol,
    isComputerTurn,
    recordMove,
    nextTurn,
    recordScore,
    recordDraw,
    advanceRound,
  };
})();

// ============================================================================
// GAME CONTROLLER MODULE
// ============================================================================
const GameController = (() => {
  let gameState = StateManager.get();

  const handleCellClick = (index) => {
    gameState = StateManager.get();

    if (!gameState.isActive || gameState.board[index] !== "") {
      return;
    }

    // Player move
    if (!StateManager.recordMove(index, gameState.currentSymbol)) {
      return;
    }

    DOMManager.updateBoardForSymbol(index, gameState.currentSymbol);
    AudioManager.playMoveSound(gameState.currentSymbol);

    if (checkGameEnd(gameState.currentSymbol)) {
      return;
    }

    StateManager.nextTurn();
    updateGameDisplay();

    if (StateManager.isComputerTurn()) {
      setTimeout(makeComputerMove, 600);
    }
  };

  const makeComputerMove = () => {
    gameState = StateManager.get();

    const moveIndex = AIEngine.chooseMove(
      gameState.board,
      StateManager.getOpponentSymbol(),
      gameState.difficulty,
    );

    if (moveIndex === null) return;

    if (!StateManager.recordMove(moveIndex, StateManager.getOpponentSymbol())) {
      return;
    }

    DOMManager.updateBoardForSymbol(
      moveIndex,
      StateManager.getOpponentSymbol(),
    );
    AudioManager.playMoveSound(StateManager.getOpponentSymbol());

    if (checkGameEnd(StateManager.getOpponentSymbol())) {
      return;
    }

    StateManager.nextTurn();
    updateGameDisplay();
  };

  const checkGameEnd = (lastMovedSymbol) => {
    gameState = StateManager.get();

    if (GameLogic.checkWinner(gameState.board, lastMovedSymbol)) {
      StateManager.get().isActive = false;
      const winningCombo = GameLogic.WIN_COMBINATIONS.find((combo) =>
        combo.every((index) => gameState.board[index] === lastMovedSymbol),
      );
      DOMManager.highlightWinningCells(winningCombo);

      const winnerName = getPlayerName(lastMovedSymbol);
      DOMManager.get("resultDisplay").textContent = `${winnerName} Wins! ✨`;
      DOMManager.get("resultDisplay").className = "result win";

      AudioManager.playWinSound();
      StateManager.recordScore(lastMovedSymbol);
      updateScoreboard();

      if (isMatchOver()) {
        const wins = gameState.scores;
        endMatch(false, { X: wins.X, O: wins.O, draws: wins.draws });
      } else {
        showRoundEndOptions();
      }
      return true;
    }

    if (GameLogic.isBoardFull(gameState.board)) {
      StateManager.get().isActive = false;
      DOMManager.get("resultDisplay").textContent = "It's a Draw.";
      DOMManager.get("resultDisplay").className = "result draw";

      AudioManager.playDrawSound();
      StateManager.recordDraw();
      updateScoreboard();
      showRoundEndOptions();
      return true;
    }

    return false;
  };

  const getPlayerName = (symbol) => {
    gameState = StateManager.get();
    if (symbol === gameState.p1Symbol) {
      return gameState.p1Name;
    } else {
      return gameState.opponent === "computer" ? "Computer" : gameState.p2Name;
    }
  };

  const isMatchOver = () => {
    gameState = StateManager.get();
    if (!gameState.bestOf || gameState.neededWins <= 0) {
      return false;
    }
    return (
      gameState.scores.X >= gameState.neededWins ||
      gameState.scores.O >= gameState.neededWins
    );
  };

  const showRoundEndOptions = () => {
    gameState = StateManager.get();
    if (gameState.mode === "quick") {
      DOMManager.showModal();
      DOMManager.get("modalTitle").textContent =
        DOMManager.get("resultDisplay").textContent;
      DOMManager.get("modalSub").textContent = "Play again?";
    } else {
      DOMManager.get("nextRoundBtn").style.display = "inline-flex";
      DOMManager.get("resetMatchBtn").style.display = "inline-flex";
      DOMManager.get("endMatchBtn").style.display = "inline-flex";
    }
  };

  const endMatch = (isForced = false, scores = null) => {
    gameState = StateManager.get();
    StateManager.get().isActive = false;

    const X = scores ? scores.X : gameState.scores.X;
    const O = scores ? scores.O : gameState.scores.O;
    const draws = scores ? scores.draws : gameState.scores.draws;

    let title = "",
      subtitle = "";

    if (isForced) {
      if (X > O) {
        title = `${getPlayerName("X")} wins the match!`;
      } else if (O > X) {
        title = `${getPlayerName("O")} wins the match!`;
      } else {
        title = "Match ended — It's a tie!";
      }
    } else {
      title =
        X > O
          ? "X wins the match!"
          : O > X
            ? "O wins the match!"
            : "Match finished";
    }

    subtitle = `Final Score — X: ${X} · O: ${O} · Draws: ${draws}`;

    DOMManager.get("modalTitle").textContent = title;
    DOMManager.get("modalSub").textContent = subtitle;
    DOMManager.showModal();
  };

  const updateGameDisplay = () => {
    gameState = StateManager.get();
    const currentPlayer = getPlayerName(gameState.currentSymbol);
    DOMManager.get("turnDisplay").textContent =
      `${currentPlayer}'s Turn (${gameState.currentSymbol})`;
  };

  const updateScoreboard = () => {
    gameState = StateManager.get();
    const nameX =
      gameState.p1Symbol === "X"
        ? gameState.p1Name
        : gameState.opponent === "computer"
          ? "Computer"
          : gameState.p2Name;
    const nameO =
      gameState.p1Symbol === "O"
        ? gameState.p1Name
        : gameState.opponent === "computer"
          ? "Computer"
          : gameState.p2Name;

    DOMManager.get("xName").textContent = `X — ${nameX}`;
    DOMManager.get("oName").textContent = `O — ${nameO}`;
    DOMManager.get("xScore").textContent = gameState.scores.X;
    DOMManager.get("oScore").textContent = gameState.scores.O;
    DOMManager.get("drawScore").textContent = gameState.scores.draws;
    DOMManager.get("roundMeta").textContent =
      `Round: ${gameState.scores.round}`;
  };

  const startNewGame = () => {
    gameState = StateManager.get();
    StateManager.resetBoard("X");
    DOMManager.clearBoardHighlight();
    DOMManager.renderBoard(StateManager.get().board);
    updateGameDisplay();
    updateScoreboard();
    AIEngine.clearMemo();

    if (StateManager.isComputerTurn()) {
      setTimeout(makeComputerMove, 600);
    }
  };

  const startNewRound = () => {
    gameState = StateManager.get();
    StateManager.advanceRound();
    updateScoreboard();
    const alternateStart = gameState.scores.round % 2 === 0 ? "O" : "X";
    StateManager.resetBoard(alternateStart);
    DOMManager.clearBoardHighlight();
    DOMManager.renderBoard(StateManager.get().board);
    updateGameDisplay();

    DOMManager.get("nextRoundBtn").style.display = "none";
    DOMManager.get("resetMatchBtn").style.display = "none";
    DOMManager.get("endMatchBtn").style.display = "none";

    if (StateManager.isComputerTurn()) {
      setTimeout(makeComputerMove, 600);
    }
  };

  return {
    handleCellClick,
    makeComputerMove,
    checkGameEnd,
    startNewGame,
    startNewRound,
    updateGameDisplay,
    updateScoreboard,
    endMatch,
  };
})();

// ============================================================================
// EVENT MANAGER MODULE
// ============================================================================
const EventManager = (() => {
  const initMenuEvents = () => {
    const opponent = DOMManager.get("opponent");
    const p2Field = DOMManager.get("p2Field");
    const difficultyField = DOMManager.get("difficultyField");

    opponent?.addEventListener("change", () => {
      const isHuman = opponent.value === "human";
      if (p2Field) p2Field.style.display = isHuman ? "block" : "none";
      if (difficultyField)
        difficultyField.style.display = isHuman ? "none" : "block";
    });

    // Demo button
    DOMManager.get("demoBtn")?.addEventListener("click", () => {
      const firstNames = ["Ola", "Ada", "Zee", "Maya", "Dev", "Kiro"];
      const lastNames = ["Lex", "Timi", "Kai", "Joss", "Rio", "Rin"];
      const p1Input = DOMManager.get("p1Input");
      const p2Input = DOMManager.get("p2Input");
      if (p1Input)
        p1Input.value =
          firstNames[Math.floor(Math.random() * firstNames.length)];
      if (p2Input)
        p2Input.value = lastNames[Math.floor(Math.random() * lastNames.length)];
    });

    // Audio toggles
    DOMManager.get("sfxToggle")?.addEventListener("click", () => {
      const sfxOn = AudioManager.toggleSfx();
      DOMManager.get("sfxToggle").textContent = `SFX: ${sfxOn ? "On" : "Off"}`;
    });

    DOMManager.get("musicToggle")?.addEventListener("click", () => {
      const musicOn = AudioManager.toggleMusic();
      DOMManager.get("musicToggle").textContent =
        `Music: ${musicOn ? "On" : "Off"}`;
    });

    DOMManager.get("muteAllBtn")?.addEventListener("click", () => {
      AudioManager.muteAll();
      DOMManager.get("sfxToggle").textContent = "SFX: Off";
      DOMManager.get("musicToggle").textContent = "Music: Off";
    });

    // Start game
    DOMManager.get("startBtn")?.addEventListener("click", startGame);
  };

  const initGameEvents = () => {
    DOMManager.get("board")?.addEventListener("click", (event) => {
      const cell = event.target.closest(".cell");
      if (cell) {
        const index = parseInt(cell.dataset.index, 10);
        GameController.handleCellClick(index);
      }
    });

    DOMManager.get("backBtn")?.addEventListener("click", () => {
      DOMManager.showMenu();
    });

    DOMManager.get("nextRoundBtn")?.addEventListener(
      "click",
      GameController.startNewRound,
    );

    DOMManager.get("resetMatchBtn")?.addEventListener("click", () => {
      StateManager.resetScores();
      GameController.updateScoreboard();
      GameController.startNewGame();
      DOMManager.get("nextRoundBtn").style.display = "none";
      DOMManager.get("resetMatchBtn").style.display = "none";
      DOMManager.get("endMatchBtn").style.display = "none";
    });

    DOMManager.get("endMatchBtn")?.addEventListener("click", () => {
      const gameState = StateManager.get();
      GameController.endMatch(true, {
        X: gameState.scores.X,
        O: gameState.scores.O,
        draws: gameState.scores.draws,
      });
    });
  };

  const initModalEvents = () => {
    DOMManager.get("playAgainBtn")?.addEventListener("click", () => {
      DOMManager.hideModal();
      StateManager.resetScores();
      GameController.updateScoreboard();
      GameController.startNewGame();
    });

    DOMManager.get("toMenuBtn")?.addEventListener("click", () => {
      DOMManager.hideModal();
      DOMManager.showMenu();
    });
  };

  const startGame = () => {
    const gameState = StateManager.get();
    const gameMode = DOMManager.get("gameMode")?.value || "endless";
    const opponent = DOMManager.get("opponent")?.value || "computer";
    const p1Name = DOMManager.get("p1Input")?.value?.trim() || "Player 1";
    const p2Name = DOMManager.get("p2Input")?.value?.trim() || "Player 2";
    const symbol = DOMManager.get("symbol")?.value || "X";
    const difficulty = DOMManager.get("difficulty")?.value || "hard";
    const bestOf = parseInt(DOMManager.get("bestOf")?.value || "0", 10);

    // Validate inputs
    if (!p1Name || p1Name.length === 0) {
      alert("Please enter Player 1 name");
      return;
    }

    if (opponent === "human" && (!p2Name || p2Name.length === 0)) {
      alert("Please enter Player 2 name");
      return;
    }

    StateManager.set({
      mode: gameMode,
      opponent: opponent,
      p1Name: p1Name,
      p2Name: p2Name,
      p1Symbol: symbol,
      difficulty: difficulty,
      bestOf: bestOf,
      neededWins: bestOf > 0 ? Math.ceil(bestOf / 2) : 0,
    });

    StateManager.resetMatch();
    DOMManager.showGame();
    GameController.startNewGame();

    DOMManager.get("nextRoundBtn").style.display =
      gameMode === "quick" ? "none" : "inline-flex";
    DOMManager.get("resetMatchBtn").style.display = "none";
    DOMManager.get("endMatchBtn").style.display =
      gameMode === "quick" ? "none" : "inline-flex";
  };

  return {
    initialize: () => {
      DOMManager.validateElements();
      initMenuEvents();
      initGameEvents();
      initModalEvents();
    },
  };
})();

// ============================================================================
// INITIALIZATION
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {
  try {
    // Initialize core systems
    AudioManager.initialize();
    EventManager.initialize();
    DOMManager.renderBoard(StateManager.get().board);
    GameController.updateGameDisplay();
    GameController.updateScoreboard();

    // Check if localStorage is available and suggest feature
    if (PersistenceManager.isAvailable()) {
      console.log("💾 Storage available: Game state auto-saves");
    }

    // Register service worker with better error handling
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("service-worker.js")
        .then((registration) => {
          console.log("✅ Service Worker registered:", registration.scope);
        })
        .catch((error) => {
          console.warn("⚠️ Service Worker registration failed:", error.message);
          // App still works without service worker
        });
    }

    // Show menu
    DOMManager.showMenu();

    console.log("🎮 Tic Tac Toe initialized successfully");
  } catch (error) {
    console.error("❌ Initialization error:", error);
    alert("Failed to initialize game. Please refresh the page.");
  }
});
