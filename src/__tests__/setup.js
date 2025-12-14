// Setup file for Jest tests
// Set environment variables for testing
process.env.JWT_SECRET = "test-jwt-secret-key";
process.env.NODE_ENV = "test";

// Suppress console.error and console.log during tests to reduce noise
// You can comment these out if you need to debug
const originalConsole = {
  error: console.error,
  log: console.log,
};

global.console = {
  ...console,
  error: (...args) => {
    // Optionally filter or suppress errors
  },
  log: (...args) => {
    // Optionally filter or suppress logs
  },
};
