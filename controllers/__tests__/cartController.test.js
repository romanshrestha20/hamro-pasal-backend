import { jest } from "@jest/globals";
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
} from "../cartController.js";
import { prisma } from "../../lib/prismaClient.js";
import { AppError } from "../../utils/AppError.js";

// Mock Prisma client
jest.mock("../../lib/prismaClient.js", () => ({
  prisma: {
    cart: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    cartItem: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

describe("Cart Controller", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: { id: "user-123" },
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe("getCart", () => {
    it("should return existing cart with items", async () => {
      const mockCart = {
        id: "cart-123",
        userId: "user-123",
        items: [
          {
            id: "item-1",
            productId: "prod-1",
            quantity: 2,
            product: {
              id: "prod-1",
              name: "Test Product",
              price: 99.99,
            },
          },
        ],
      };

      prisma.cart.findUnique.mockResolvedValue(mockCart);

      await getCart(req, res, next);

      expect(prisma.cart.findUnique).toHaveBeenCalledWith({
        where: { userId: "user-123" },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  price: true,
                  image: true,
                  stock: true,
                  isActive: true,
                },
              },
            },
          },
        },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockCart,
      });
    });

    it("should create new cart if none exists", async () => {
      const mockNewCart = {
        id: "cart-456",
        userId: "user-123",
        items: [],
      };

      prisma.cart.findUnique.mockResolvedValue(null);
      prisma.cart.create.mockResolvedValue(mockNewCart);

      await getCart(req, res, next);

      expect(prisma.cart.create).toHaveBeenCalledWith({
        data: { userId: "user-123" },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("addToCart", () => {
    it("should add new item to cart", async () => {
      req.body = { productId: "prod-1", quantity: 2 };

      const mockProduct = {
        id: "prod-1",
        price: 99.99,
        stock: 10,
        isActive: true,
      };

      const mockCart = { id: "cart-123", userId: "user-123" };

      const mockCartItem = {
        id: "item-1",
        cartId: "cart-123",
        productId: "prod-1",
        quantity: 2,
        product: mockProduct,
      };

      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.cart.upsert.mockResolvedValue(mockCart);
      prisma.cartItem.upsert.mockResolvedValue(mockCartItem);

      await addToCart(req, res, next);

      expect(prisma.cartItem.upsert).toHaveBeenCalledWith({
        where: {
          cartId_productId: {
            cartId: "cart-123",
            productId: "prod-1",
          },
        },
        update: {
          quantity: {
            increment: 2,
          },
        },
        create: {
          cartId: "cart-123",
          productId: "prod-1",
          quantity: 2,
        },
        include: expect.any(Object),
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Item added to cart",
        data: mockCartItem,
      });
    });

    it("should throw error if product not found", async () => {
      req.body = { productId: "invalid-prod" };

      prisma.product.findUnique.mockResolvedValue(null);

      await addToCart(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe("Product not found");
    });

    it("should throw error if product is not active", async () => {
      req.body = { productId: "prod-1" };

      prisma.product.findUnique.mockResolvedValue({
        id: "prod-1",
        isActive: false,
      });

      await addToCart(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe("Product is not available");
    });

    it("should throw error for invalid quantity", async () => {
      req.body = { productId: "prod-1", quantity: 0 };

      await addToCart(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe("Quantity must be at least 1");
    });
  });

  describe("updateCartItem", () => {
    it("should update cart item quantity", async () => {
      req.body = { productId: "prod-1", quantity: 5 };

      const mockCart = { id: "cart-123" };
      const mockProduct = {
        id: "prod-1",
        stock: 10,
        isActive: true,
      };
      const mockUpdatedItem = {
        id: "item-1",
        quantity: 5,
        product: mockProduct,
      };

      prisma.cart.findUnique.mockResolvedValue(mockCart);
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.cartItem.upsert.mockResolvedValue(mockUpdatedItem);

      await updateCartItem(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Cart item updated",
        data: mockUpdatedItem,
      });
    });

    it("should throw error if quantity exceeds stock", async () => {
      req.body = { productId: "prod-1", quantity: 15 };

      const mockCart = { id: "cart-123" };
      const mockProduct = { id: "prod-1", stock: 10 };

      prisma.cart.findUnique.mockResolvedValue(mockCart);
      prisma.product.findUnique.mockResolvedValue(mockProduct);

      await updateCartItem(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe(
        "Only 10 items available in stock"
      );
    });
  });

  describe("removeFromCart", () => {
    it("should remove item from cart", async () => {
      req.body = { productId: "prod-1" };

      const mockCart = { id: "cart-123" };
      const mockCartItem = { id: "item-1" };

      prisma.cart.findUnique.mockResolvedValue(mockCart);
      prisma.cartItem.findUnique.mockResolvedValue(mockCartItem);
      prisma.cartItem.delete.mockResolvedValue(mockCartItem);

      await removeFromCart(req, res, next);

      expect(prisma.cartItem.delete).toHaveBeenCalledWith({
        where: { id: "item-1" },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Item removed from cart",
      });
    });

    it("should throw error if item not found in cart", async () => {
      req.body = { productId: "prod-1" };

      const mockCart = { id: "cart-123" };

      prisma.cart.findUnique.mockResolvedValue(mockCart);
      prisma.cartItem.findUnique.mockResolvedValue(null);

      await removeFromCart(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe("Item not found in cart");
    });
  });

  describe("clearCart", () => {
    it("should clear all items from cart", async () => {
      const mockCart = { id: "cart-123" };

      prisma.cart.findUnique.mockResolvedValue(mockCart);
      prisma.cartItem.deleteMany.mockResolvedValue({ count: 3 });
      prisma.cart.update.mockResolvedValue(mockCart);
      prisma.$transaction.mockImplementation(async (operations) => {
        // Execute the operations array
        return Promise.all(operations.map((op) => Promise.resolve(op)));
      });

      await clearCart(req, res, next);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction).toHaveBeenCalledWith(
        expect.arrayContaining([expect.anything(), expect.anything()])
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Cart cleared successfully",
      });
    });

    it("should throw error if cart not found", async () => {
      prisma.cart.findUnique.mockResolvedValue(null);

      await clearCart(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe("Cart not found");
    });
  });
});
