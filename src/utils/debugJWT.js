import jwt from "jsonwebtoken";

export const decodeToken = (token) => {
  try {
    const decoded = jwt.decode(token);
    console.log('JWT Payload:', decoded);
    return decoded;
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};