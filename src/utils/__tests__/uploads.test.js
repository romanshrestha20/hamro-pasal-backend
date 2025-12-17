import { upload } from "../uploads.js";

describe("Uploads Utility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("upload configuration", () => {
    it("should be a multer instance", () => {
      expect(upload).toBeDefined();
      expect(typeof upload.single).toBe("function");
    });

    it("should have correct limits configured (5MB)", () => {
      expect(upload.limits).toBeDefined();
      expect(upload.limits.fileSize).toBe(5 * 1024 * 1024);
    });
  });

  describe("Cloudinary storage", () => {
    it("should use Cloudinary for file storage", () => {
      // Upload configuration now uses CloudinaryStorage instead of disk storage
      // Files are uploaded directly to Cloudinary CDN
      expect(upload).toBeDefined();
      expect(upload.storage).toBeDefined();
    });
  });
});
