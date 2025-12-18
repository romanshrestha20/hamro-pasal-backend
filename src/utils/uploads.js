import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../lib/cloudinary.js";


// Set up storage engine
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "hamro-pasal",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 800, crop: "limit" }],
  },
});

// Image-only file filter
const fileFilter = (_req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error("Only image files (jpeg, jpg, png, webp) are allowed"),
      false
    );
  }
};

// Initialize multer with storage engine and file filter
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // limit file size to 5MB
});

// Multer error handler middleware
export const handleMulterError = (err, req, res, next) => {
  console.error('❌ Multer/Cloudinary error:', err);
  console.error('Error stack:', err.stack);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  
  if (err) {
    return res.status(500).json({ error: err.message || 'Error uploading file to Cloudinary' });
  }
  
  next();
};
