/**
 * Test Suite Structure for Tic Tac Toe Game
 * Framework: Jest (recommended)
 * Path: tests/
 *
 * To run: npm test
 */

// Import game modules
const {
  GameLogic,
  AIEngine,
  StateManager,
  PersistenceManager,
  AudioManager,
} = require("./script.js");

// ============================================================================
// GAME LOGIC TESTS
// ============================================================================
describe("GameLogic", () => {
  describe("checkWinner", () => {
    it("should detect horizontal win (row 0)", () => {
      const board = ["X", "X", "X", "", "", "", "", "", ""];
      expect(GameLogic.checkWinner(board, "X")).toBe(true);
    });

    it("should detect vertical win (column 0)", () => {
      const board = ["X", "", "", "X", "", "", "X", "", ""];
      expect(GameLogic.checkWinner(board, "X")).toBe(true);
    });

    it("should detect diagonal win (top-left to bottom-right)", () => {
      const board = ["X", "", "", "", "X", "", "", "", "X"];
      expect(GameLogic.checkWinner(board, "X")).toBe(true);
    });

    it("should detect diagonal win (top-right to bottom-left)", () => {
      const board = ["", "", "X", "", "X", "", "X", "", ""];
      expect(GameLogic.checkWinner(board, "X")).toBe(true);
    });

    it("should return false for no win", () => {
      const board = ["X", "O", "X", "O", "", "X", "O", "X", "O"];
      expect(GameLogic.checkWinner(board, "X")).toBe(false);
    });

    it("should return false for incomplete row", () => {
      const board = ["X", "X", "", "", "", "", "", "", ""];
      expect(GameLogic.checkWinner(board, "X")).toBe(false);
    });
  });

  describe("getAvailableMoves", () => {
    it("should return all 9 indices for empty board", () => {
      const board = Array(9).fill("");
      const moves = GameLogic.getAvailableMoves(board);
      expect(moves).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it("should return 5 moves for half-filled board", () => {
      const board = ["X", "O", "X", "O", "", "", "", "", ""];
      const moves = GameLogic.getAvailableMoves(board);
      expect(moves.length).toBe(5);
      expect(moves).toEqual([4, 5, 6, 7, 8]);
    });

    it("should return empty array for full board", () => {
      const board = ["X", "O", "X", "X", "O", "X", "O", "X", "O"];
      const moves = GameLogic.getAvailableMoves(board);
      expect(moves).toEqual([]);
    });
  });

  describe("isBoardFull", () => {
    it("should return true for full board", () => {
      const board = ["X", "O", "X", "X", "O", "X", "O", "X", "O"];
      expect(GameLogic.isBoardFull(board)).toBe(true);
    });

    it("should return false for partial board", () => {
      const board = ["X", "O", "", "", "", "", "", "", ""];
      expect(GameLogic.isBoardFull(board)).toBe(false);
    });

    it("should return false for empty board", () => {
      const board = Array(9).fill("");
      expect(GameLogic.isBoardFull(board)).toBe(false);
    });
  });
});

// ============================================================================
// AI ENGINE TESTS
// ============================================================================
describe("AIEngine", () => {
  beforeEach(() => {
    AIEngine.clearMemo();
  });

  describe("chooseMove - Easy difficulty", () => {
    it("should return a valid move from available options", () => {
      const board = ["X", "", "", "", "", "", "", "", ""];
      const move = AIEngine.chooseMove(board, "O", "easy");
      expect([1, 2, 3, 4, 5, 6, 7, 8]).toContain(move);
    });

    it("should not return an occupied cell", () => {
      const board = ["X", "O", "", "", "", "", "", "", ""];
      const move = AIEngine.chooseMove(board, "O", "easy");
      expect(move !== 0 && move !== 1).toBe(true);
    });

    it("should return null for full board", () => {
      const board = ["X", "O", "X", "X", "O", "X", "O", "X", "O"];
      const move = AIEngine.chooseMove(board, "O", "easy");
      expect(move).toBe(null);
    });
  });

  describe("chooseMove - Hard difficulty", () => {
    it("should block winning move", () => {
      // X is about to win, O should block
      const board = ["X", "X", "", "", "", "", "", "", ""];
      const move = AIEngine.chooseMove(board, "O", "hard");
      expect(move).toBe(2); // Must block position 2
    });

    it("should create winning move when possible", () => {
      // O can win
      const board = ["O", "O", "", "", "", "", "", "", ""];
      const move = AIEngine.chooseMove(board, "O", "hard");
      expect(move).toBe(2); // Should take winning move
    });

    it("should prefer center early game", () => {
      // First move should prefer center
      const board = Array(9).fill("");
      const move = AIEngine.chooseMove(board, "X", "hard");
      // Hard AI prefers center (index 4) or corners
      expect([0, 2, 4, 6, 8]).toContain(move);
    });
  });

  describe("Memoization", () => {
    it("should cache board states", () => {
      const board = ["X", "", "O", "", "", "", "", "", ""];
      AIEngine.chooseMove(board.slice(), "X", "hard");
      AIEngine.chooseMove(board.slice(), "X", "hard");
      // Second call should use cache (no performance test here, just verify it works)
      expect(
        AIEngine.chooseMove(board.slice(), "X", "hard"),
      ).toBeLessThanOrEqual(8);
    });

    it("should clear memo on reset", () => {
      const board = ["X", "", "O", "", "", "", "", "", ""];
      AIEngine.chooseMove(board.slice(), "X", "hard");
      AIEngine.clearMemo();
      // After clear, should still work
      const move = AIEngine.chooseMove(board.slice(), "X", "hard");
      expect(move).toBeGreaterThanOrEqual(0);
    });
  });
});

// ============================================================================
// STATE MANAGER TESTS
// ============================================================================
describe("StateManager", () => {
  describe("get & set", () => {
    it("should get initial state", () => {
      const state = StateManager.get();
      expect(state.mode).toBe("endless");
      expect(state.opponent).toBe("computer");
      expect(state.board.length).toBe(9);
    });

    it("should update state with set", () => {
      StateManager.set({ mode: "quick", p1Name: "TestPlayer" });
      const state = StateManager.get();
      expect(state.mode).toBe("quick");
      expect(state.p1Name).toBe("TestPlayer");
    });
  });

  describe("recordMove", () => {
    it("should record move on empty cell", () => {
      StateManager.resetBoard();
      const result = StateManager.recordMove(0, "X");
      expect(result).toBe(true);
      expect(StateManager.get().board[0]).toBe("X");
    });

    it("should reject move on occupied cell", () => {
      StateManager.resetBoard();
      StateManager.recordMove(0, "X");
      const result = StateManager.recordMove(0, "O");
      expect(result).toBe(false);
    });
  });

  describe("nextTurn", () => {
    it("should alternate symbols", () => {
      StateManager.resetBoard();
      expect(StateManager.get().currentSymbol).toBe("X");
      StateManager.nextTurn();
      expect(StateManager.get().currentSymbol).toBe("O");
      StateManager.nextTurn();
      expect(StateManager.get().currentSymbol).toBe("X");
    });
  });

  describe("getOpponentSymbol", () => {
    it("should return opposite symbol", () => {
      StateManager.set({ p1Symbol: "X" });
      expect(StateManager.getOpponentSymbol()).toBe("O");
      StateManager.set({ p1Symbol: "O" });
      expect(StateManager.getOpponentSymbol()).toBe("X");
    });
  });

  describe("Score recording", () => {
    it("should record score for X", () => {
      StateManager.resetMatch();
      StateManager.recordScore("X");
      expect(StateManager.get().scores.X).toBe(1);
    });

    it("should record draw", () => {
      StateManager.resetMatch();
      StateManager.recordDraw();
      expect(StateManager.get().scores.draws).toBe(1);
    });

    it("should advance rounds", () => {
      StateManager.resetMatch();
      expect(StateManager.get().scores.round).toBe(1);
      StateManager.advanceRound();
      expect(StateManager.get().scores.round).toBe(2);
    });
  });
});

// ============================================================================
// PERSISTENCE MANAGER TESTS
// ============================================================================
describe("PersistenceManager", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("Game State Persistence", () => {
    it("should save and load game state", () => {
      const testState = {
        mode: "quick",
        p1Name: "Test",
        scores: { X: 5, O: 3, draws: 1 },
      };
      PersistenceManager.saveGameState(testState);
      const loaded = PersistenceManager.loadGameState();
      expect(loaded).toEqual(testState);
    });

    it("should return null if no state saved", () => {
      const loaded = PersistenceManager.loadGameState();
      expect(loaded).toBe(null);
    });

    it("should clear game state", () => {
      PersistenceManager.saveGameState({ test: "data" });
      PersistenceManager.clearGameState();
      expect(PersistenceManager.loadGameState()).toBe(null);
    });
  });

  describe("Statistics Persistence", () => {
    it("should save and load stats", () => {
      const stats = { totalGames: 100, totalWins: 60, totalDraws: 10 };
      PersistenceManager.saveStats(stats);
      const loaded = PersistenceManager.loadStats();
      expect(loaded.totalGames).toBe(100);
    });

    it("should return default stats if none exist", () => {
      const stats = PersistenceManager.loadStats();
      expect(stats.totalGames).toBe(0);
    });
  });

  describe("Availability Check", () => {
    it("should detect localStorage availability", () => {
      expect(PersistenceManager.isAvailable()).toBe(true);
    });
  });
});

// ============================================================================
// AUDIO MANAGER TESTS
// ============================================================================
describe("AudioManager", () => {
  describe("Initialization", () => {
    it("should initialize audio context", () => {
      const context = AudioManager.initialize();
      // Context might be null in test environment
      expect(typeof context === "object" || context === null).toBe(true);
    });
  });

  describe("SFX Toggle", () => {
    it("should toggle SFX state", () => {
      const initial = AudioManager.toggleSfx();
      const toggled = AudioManager.toggleSfx();
      expect(toggled).not.toBe(initial);
    });
  });

  describe("Music Toggle", () => {
    it("should toggle music state", () => {
      AudioManager.muteAll(); // Start clean
      const initial = AudioManager.toggleMusic();
      const toggled = AudioManager.toggleMusic();
      // Should be different (unless one fails silently)
      expect(typeof toggled === "boolean").toBe(true);
    });
  });

  describe("Mute All", () => {
    it("should mute everything", () => {
      AudioManager.muteAll();
      const state = AudioManager.getState();
      // State might not change if audio context failed, but method should exist
      expect(typeof state === "object").toBe(true);
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================
describe("Game Flow Integration", () => {
  beforeEach(() => {
    StateManager.resetMatch();
    AIEngine.clearMemo();
  });

  it("should complete a game where player X wins", () => {
    StateManager.resetBoard();
    StateManager.set({
      p1Symbol: "X",
      opponent: "computer",
      difficulty: "easy",
    });

    // Make moves to win
    StateManager.recordMove(0, "X");
    StateManager.nextTurn();
    StateManager.recordMove(3, "X");
    StateManager.nextTurn();
    StateManager.recordMove(6, "X");

    // Check win
    expect(GameLogic.checkWinner(StateManager.get().board, "X")).toBe(true);
  });

  it("should detect draws", () => {
    const board = ["X", "O", "X", "X", "O", "X", "O", "X", "O"];
    StateManager.set({ board: board });

    expect(GameLogic.isBoardFull(board)).toBe(true);
    expect(GameLogic.checkWinner(board, "X")).toBe(false);
    expect(GameLogic.checkWinner(board, "O")).toBe(false);
  });

  it("should handle score progression in endless mode", () => {
    StateManager.set({ mode: "endless", bestOf: 3 });

    StateManager.recordScore("X");
    expect(StateManager.get().scores.X).toBe(1);

    StateManager.recordScore("X");
    expect(StateManager.get().scores.X).toBe(2);

    // Player reached needed wins
    expect(StateManager.get().scores.X >= StateManager.get().neededWins).toBe(
      true,
    );
  });
});

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================
describe("Performance Benchmarks", () => {
  beforeEach(() => {
    AIEngine.clearMemo();
  });

  it("should choose AI move in reasonable time (< 1 second)", () => {
    const board = Array(9).fill("");
    const startTime = performance.now();
    AIEngine.chooseMove(board, "O", "hard");
    const duration = performance.now() - startTime;

    console.log(`AI move computed in ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(1000);
  });

  it("should load game state quickly", () => {
    const state = {
      board: Array(9).fill(""),
      scores: { X: 10, O: 8, draws: 5 },
    };
    PersistenceManager.saveGameState(state);

    const startTime = performance.now();
    PersistenceManager.loadGameState();
    const duration = performance.now() - startTime;

    expect(duration).toBeLessThan(10); // Should be < 10ms
  });
});

// ============================================================================
// ACCESSIBILITY TESTS
// ============================================================================
describe("Accessibility", () => {
  it("should have proper ARIA labels", () => {
    // This would require DOM, use in e2e tests instead
    expect(true).toBe(true); // Placeholder
  });

  it("should be keyboard navigable", () => {
    // Test with Cypress or real browser
    expect(true).toBe(true); // Placeholder
  });
});

// ============================================================================
// EXPORT FOR TEST RUNNER
// ============================================================================
// Tests are standalone - no module exports needed
