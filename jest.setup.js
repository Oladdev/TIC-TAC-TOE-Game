/**
 * Jest Setup File
 * Configures global mocks and utilities for testing
 */

// Mock localStorage for Node.js environment with actual storage
let store = {};

const localStorageMock = {
  getItem: (key) => {
    return store[key] || null;
  },
  setItem: (key, value) => {
    store[key] = value.toString();
  },
  removeItem: (key) => {
    delete store[key];
  },
  clear: () => {
    store = {};
  },
};

global.localStorage = localStorageMock;

// Reset store before each test
beforeEach(() => {
  store = {};
});
