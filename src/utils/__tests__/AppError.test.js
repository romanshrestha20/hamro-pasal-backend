import { AppError } from "../AppError.js";

describe("AppError", () => {
  it("should create an error with message and status code", () => {
    const error = new AppError("Test error", 400);

    expect(error.message).toBe("Test error");
    expect(error.statusCode).toBe(400);
    expect(error.isOperational).toBe(true);
  });

  it("should be an instance of Error", () => {
    const error = new AppError("Test error", 404);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });

  it("should have a stack trace", () => {
    const error = new AppError("Test error", 500);

    expect(error.stack).toBeDefined();
    expect(typeof error.stack).toBe("string");
  });

  it("should create errors with different status codes", () => {
    const error400 = new AppError("Bad request", 400);
    const error401 = new AppError("Unauthorized", 401);
    const error404 = new AppError("Not found", 404);
    const error500 = new AppError("Server error", 500);

    expect(error400.statusCode).toBe(400);
    expect(error401.statusCode).toBe(401);
    expect(error404.statusCode).toBe(404);
    expect(error500.statusCode).toBe(500);
  });

  it("should always mark error as operational", () => {
    const error1 = new AppError("Error 1", 400);
    const error2 = new AppError("Error 2", 500);

    expect(error1.isOperational).toBe(true);
    expect(error2.isOperational).toBe(true);
  });

  it("should preserve error name", () => {
    const error = new AppError("Test error", 400);

    expect(error.name).toBe("Error");
  });
});
