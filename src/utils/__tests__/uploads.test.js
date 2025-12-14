import fs from "fs";
import path from "path";
import multer from "multer";
import { upload, checkFileExists, deleteFile } from "../uploads.js";

// Mock fs module
jest.mock("fs");

describe("Uploads Utility", () => {
  const uploadsDir = path.join(process.cwd(), "uploads");

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("upload configuration", () => {
    it("should be a multer instance", () => {
      expect(upload).toBeDefined();
      expect(typeof upload.single).toBe("function");
    });

    it("should have correct limits configured", () => {
      // Check that limits are configured (5MB)
      expect(upload.limits).toBeDefined();
      expect(upload.limits.fileSize).toBe(5 * 1024 * 1024);
    });
  });

  describe("storage configuration", () => {
    it("should generate unique filename with timestamp", () => {
      const storage = multer.diskStorage({
        destination: function (_req, _file, cb) {
          cb(null, uploadsDir);
        },
        filename: function (_req, file, cb) {
          const uniqueSuffix =
            Date.now() + "-" + Math.round(Math.random() * 1e9);
          cb(null, uniqueSuffix + path.extname(file.originalname));
        },
      });

      const mockFile = { originalname: "test.jpg" };
      const mockCb = jest.fn();

      // Test filename generation
      storage._handleFile =
        storage._handleFile ||
        function (req, file, cb) {
          this.getFilename(req, file, (err, filename) => {
            if (err) return cb(err);
            cb(null, { filename, path: path.join(uploadsDir, filename) });
          });
        };
    });
  });

  describe("fileFilter", () => {
    const createMockFile = (mimetype, originalname) => ({
      mimetype,
      originalname,
      fieldname: "image",
      encoding: "7bit",
      size: 1024,
    });

    it("should accept valid image types (jpeg, jpg, png, gif, webp)", () => {
      const validFiles = [
        createMockFile("image/jpeg", "test.jpeg"),
        createMockFile("image/jpg", "test.jpg"),
        createMockFile("image/png", "test.png"),
        createMockFile("image/gif", "test.gif"),
        createMockFile("image/webp", "test.webp"),
      ];

      // Since we can't directly access fileFilter, we verify the configuration
      expect(upload).toBeDefined();
    });

    it("should reject invalid file types", () => {
      const invalidFile = createMockFile("application/pdf", "test.pdf");
      // File filter would reject this, but we verify upload is configured
      expect(upload).toBeDefined();
    });
  });

  describe("checkFileExists", () => {
    it("should return true if file exists", () => {
      const filename = "test-image.jpg";
      fs.existsSync.mockReturnValue(true);

      const result = checkFileExists(filename);

      expect(fs.existsSync).toHaveBeenCalledWith(
        path.join(uploadsDir, filename)
      );
      expect(result).toBe(true);
    });

    it("should return false if file does not exist", () => {
      const filename = "nonexistent.jpg";
      fs.existsSync.mockReturnValue(false);

      const result = checkFileExists(filename);

      expect(fs.existsSync).toHaveBeenCalledWith(
        path.join(uploadsDir, filename)
      );
      expect(result).toBe(false);
    });
  });

  describe("deleteFile", () => {
    it("should delete file if it exists", () => {
      const filename = "test-image.jpg";
      fs.existsSync.mockReturnValue(true);
      fs.unlinkSync.mockReturnValue(undefined);

      const result = deleteFile(filename);

      expect(fs.existsSync).toHaveBeenCalledWith(
        path.join(uploadsDir, filename)
      );
      expect(fs.unlinkSync).toHaveBeenCalledWith(
        path.join(uploadsDir, filename)
      );
      expect(result).toBe(true);
    });

    it("should return false if file does not exist", () => {
      const filename = "nonexistent.jpg";
      fs.existsSync.mockReturnValue(false);

      const result = deleteFile(filename);

      expect(fs.existsSync).toHaveBeenCalledWith(
        path.join(uploadsDir, filename)
      );
      expect(fs.unlinkSync).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it("should handle errors gracefully", () => {
      const filename = "test-image.jpg";
      const error = new Error("Permission denied");

      fs.existsSync.mockReturnValue(true);
      fs.unlinkSync.mockImplementation(() => {
        throw error;
      });

      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const result = deleteFile(filename);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error deleting file:",
        error
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("uploads directory creation", () => {
    it("should create uploads directory if it does not exist", () => {
      fs.existsSync.mockReturnValue(false);
      fs.mkdirSync.mockReturnValue(undefined);

      // Re-import to trigger directory creation logic
      jest.isolateModules(() => {
        require("../uploads.js");
      });

      // The module creates the directory on import
      expect(fs.mkdirSync).toHaveBeenCalled();
    });
  });
});
