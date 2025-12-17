// Setup file for Jest tests
// Set environment variables for testing
process.env.JWT_SECRET =
  "test-jwt-secret-key-must-be-at-least-32-characters-long-for-validation";
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.PORT = "4000";

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
