import multer from "multer";
import path from "path";
import fs from "fs";

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), "uploads");

// Create directory if it doesn't exist
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("Uploads directory created:", uploadsDir);
}

// Set up storage engine
const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    // Double-check directory exists for each upload
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: function (_req, file, cb) {
    // Create unique filename with original extension
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// File filter to allow only images
const fileFilter = (_req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error("Error: Images Only! Allowed types: jpeg, jpg, png, gif, webp"));
  }
};

// Initialize multer with storage engine and file filter
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // limit file size to 5MB
});

// Utility function to check if file exists
export const checkFileExists = (filename) => {
  const filePath = path.join(uploadsDir, filename);
  return fs.existsSync(filePath);
};

// Utility function to delete file
export const deleteFile = (filename) => {
  if (!filename) return false;

  try {
    const filePath = path.join(process.cwd(), "uploads", filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log("Deleted old image:", filename);
      return true;
    }
    return false;
  } catch (err) {
    console.error("Error deleting file:", err);
    return false;
  }
};