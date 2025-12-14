import {
  createShippingAddress,
  updateShippingAddress,
  getShippingAddress,
  deleteShippingAddress,
} from "../shippingAddressController.js";
import { prisma } from "../../lib/prismaClient.js";
import { AppError } from "../../utils/AppError.js";

jest.mock("../../lib/prismaClient.js", () => {
  const shippingAddress = {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const order = {
    findUnique: jest.fn(),
  };
  const prisma = {
    shippingAddress,
    order,
  };
  return { prisma };
});

const mockRes = () => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  return res;
};

const mockNext = () => jest.fn();

const validAddressData = {
  fullName: "John Doe",
  phone: "+1234567890",
  address: "123 Main St",
  city: "New York",
  postalCode: "10001",
  country: "USA",
};

describe("shippingAddressController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createShippingAddress", () => {
    it("creates shipping address successfully", async () => {
      const req = {
        user: { id: "user-1" },
        params: { orderId: "order-1" },
        body: validAddressData,
      };
      const res = mockRes();
      const next = mockNext();

      prisma.order.findUnique.mockResolvedValue({
        id: "order-1",
        userId: "user-1",
      });

      prisma.shippingAddress.findUnique.mockResolvedValue(null);

      prisma.shippingAddress.create.mockResolvedValue({
        id: "address-1",
        orderId: "order-1",
        ...validAddressData,
      });

      await createShippingAddress(req, res, next);

      expect(prisma.shippingAddress.create).toHaveBeenCalledWith({
        data: {
          orderId: "order-1",
          ...validAddressData,
        },
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: "address-1",
          orderId: "order-1",
        }),
      });
    });

    it("rejects when order not found", async () => {
      const req = {
        user: { id: "user-1" },
        params: { orderId: "order-999" },
        body: validAddressData,
      };
      const res = mockRes();
      const next = mockNext();

      prisma.order.findUnique.mockResolvedValue(null);

      await createShippingAddress(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });

    it("rejects when order belongs to different user", async () => {
      const req = {
        user: { id: "user-2" },
        params: { orderId: "order-1" },
        body: validAddressData,
      };
      const res = mockRes();
      const next = mockNext();

      prisma.order.findUnique.mockResolvedValue({
        id: "order-1",
        userId: "user-1",
      });

      await createShippingAddress(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });

    it("rejects when shipping address already exists", async () => {
      const req = {
        user: { id: "user-1" },
        params: { orderId: "order-1" },
        body: validAddressData,
      };
      const res = mockRes();
      const next = mockNext();

      prisma.order.findUnique.mockResolvedValue({
        id: "order-1",
        userId: "user-1",
      });

      prisma.shippingAddress.findUnique.mockResolvedValue({
        id: "address-1",
        orderId: "order-1",
      });

      await createShippingAddress(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(400);
      expect(next.mock.calls[0][0].message).toContain("already exists");
    });

    it("rejects when missing required fields", async () => {
      const incompleteData = { fullName: "John Doe" };
      const req = {
        user: { id: "user-1" },
        params: { orderId: "order-1" },
        body: incompleteData,
      };
      const res = mockRes();
      const next = mockNext();

      await createShippingAddress(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(400);
      expect(next.mock.calls[0][0].message).toContain("Missing field");
    });
  });

  describe("updateShippingAddress", () => {
    it("updates shipping address successfully", async () => {
      const updatedData = {
        ...validAddressData,
        address: "456 New St",
      };
      const req = {
        user: { id: "user-1" },
        params: { orderId: "order-1" },
        body: updatedData,
      };
      const res = mockRes();
      const next = mockNext();

      prisma.order.findUnique.mockResolvedValue({
        id: "order-1",
        userId: "user-1",
      });

      prisma.shippingAddress.findUnique.mockResolvedValue({
        id: "address-1",
        orderId: "order-1",
      });

      prisma.shippingAddress.update.mockResolvedValue({
        id: "address-1",
        orderId: "order-1",
        ...updatedData,
      });

      await updateShippingAddress(req, res, next);

      expect(prisma.shippingAddress.update).toHaveBeenCalledWith({
        where: { orderId: "order-1" },
        data: updatedData,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          address: "456 New St",
        }),
      });
    });

    it("allows admin to update any order's address", async () => {
      const req = {
        user: { id: "admin-1", isAdmin: true },
        params: { orderId: "order-1" },
        body: validAddressData,
      };
      const res = mockRes();
      const next = mockNext();

      prisma.order.findUnique.mockResolvedValue({
        id: "order-1",
        userId: "user-1",
      });

      prisma.shippingAddress.findUnique.mockResolvedValue({
        id: "address-1",
        orderId: "order-1",
      });

      prisma.shippingAddress.update.mockResolvedValue({
        id: "address-1",
        orderId: "order-1",
        ...validAddressData,
      });

      await updateShippingAddress(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("rejects when shipping address does not exist", async () => {
      const req = {
        user: { id: "user-1" },
        params: { orderId: "order-1" },
        body: validAddressData,
      };
      const res = mockRes();
      const next = mockNext();

      prisma.order.findUnique.mockResolvedValue({
        id: "order-1",
        userId: "user-1",
      });

      prisma.shippingAddress.findUnique.mockResolvedValue(null);

      await updateShippingAddress(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(404);
      expect(next.mock.calls[0][0].message).toContain("not found");
    });

    it("rejects when order belongs to different user (non-admin)", async () => {
      const req = {
        user: { id: "user-2", isAdmin: false },
        params: { orderId: "order-1" },
        body: validAddressData,
      };
      const res = mockRes();
      const next = mockNext();

      prisma.order.findUnique.mockResolvedValue({
        id: "order-1",
        userId: "user-1",
      });

      await updateShippingAddress(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });
  });

  describe("getShippingAddress", () => {
    it("retrieves shipping address successfully", async () => {
      const req = {
        user: { id: "user-1" },
        params: { orderId: "order-1" },
      };
      const res = mockRes();
      const next = mockNext();

      prisma.order.findUnique.mockResolvedValue({
        id: "order-1",
        userId: "user-1",
      });

      prisma.shippingAddress.findUnique.mockResolvedValue({
        id: "address-1",
        orderId: "order-1",
        ...validAddressData,
      });

      await getShippingAddress(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: "address-1",
          orderId: "order-1",
        }),
      });
    });

    it("allows admin to view any order's address", async () => {
      const req = {
        user: { id: "admin-1", isAdmin: true },
        params: { orderId: "order-1" },
      };
      const res = mockRes();
      const next = mockNext();

      prisma.order.findUnique.mockResolvedValue({
        id: "order-1",
        userId: "user-1",
      });

      prisma.shippingAddress.findUnique.mockResolvedValue({
        id: "address-1",
        orderId: "order-1",
        ...validAddressData,
      });

      await getShippingAddress(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("rejects when order not found or not owned", async () => {
      const req = {
        user: { id: "user-2" },
        params: { orderId: "order-1" },
      };
      const res = mockRes();
      const next = mockNext();

      prisma.order.findUnique.mockResolvedValue({
        id: "order-1",
        userId: "user-1",
      });

      await getShippingAddress(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });

    it("returns 404 when shipping address does not exist", async () => {
      const req = {
        user: { id: "user-1" },
        params: { orderId: "order-1" },
      };
      const res = mockRes();
      const next = mockNext();

      prisma.order.findUnique.mockResolvedValue({
        id: "order-1",
        userId: "user-1",
      });

      prisma.shippingAddress.findUnique.mockResolvedValue(null);

      await getShippingAddress(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });
  });

  describe("deleteShippingAddress", () => {
    it("deletes shipping address successfully", async () => {
      const req = {
        user: { id: "user-1" },
        params: { orderId: "order-1" },
      };
      const res = mockRes();
      const next = mockNext();

      prisma.order.findUnique.mockResolvedValue({
        id: "order-1",
        userId: "user-1",
      });

      prisma.shippingAddress.findUnique.mockResolvedValue({
        id: "address-1",
        orderId: "order-1",
      });

      prisma.shippingAddress.delete.mockResolvedValue({
        id: "address-1",
      });

      await deleteShippingAddress(req, res, next);

      expect(prisma.shippingAddress.delete).toHaveBeenCalledWith({
        where: { orderId: "order-1" },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Shipping address deleted",
      });
    });

    it("rejects when order not found", async () => {
      const req = {
        user: { id: "user-1" },
        params: { orderId: "order-999" },
      };
      const res = mockRes();
      const next = mockNext();

      prisma.order.findUnique.mockResolvedValue(null);

      await deleteShippingAddress(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });

    it("rejects when order belongs to different user", async () => {
      const req = {
        user: { id: "user-2" },
        params: { orderId: "order-1" },
      };
      const res = mockRes();
      const next = mockNext();

      prisma.order.findUnique.mockResolvedValue({
        id: "order-1",
        userId: "user-1",
      });

      await deleteShippingAddress(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });

    it("rejects when shipping address does not exist", async () => {
      const req = {
        user: { id: "user-1" },
        params: { orderId: "order-1" },
      };
      const res = mockRes();
      const next = mockNext();

      prisma.order.findUnique.mockResolvedValue({
        id: "order-1",
        userId: "user-1",
      });

      prisma.shippingAddress.findUnique.mockResolvedValue(null);

      await deleteShippingAddress(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(404);
      expect(next.mock.calls[0][0].message).toContain("not found");
    });
  });
});
