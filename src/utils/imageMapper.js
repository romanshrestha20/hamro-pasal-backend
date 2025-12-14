// utils/imageMapper.js
import { getBaseOrigin } from "../controllers/usersController.js";

export const mapImageToDto = (req, image) => {
  // Construct the full URL for the image. like http://localhost:3000/uploads/imagename.jpg
  const origin = getBaseOrigin(req);
  return {
    id: image.id,
    url: `${origin}/uploads/${image.url}`,
    userId: image.userId,
    productId: image.productId,
    reviewId: image.reviewId,
    createdAt: image.createdAt,
    updatedAt: image.updatedAt,
  };
};
