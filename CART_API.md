# Cart API Documentation

Complete shopping cart implementation with proper upsert patterns, stock validation, and atomic operations.

## Endpoints

### Get Cart

```
GET /api/cart
```

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "cart-uuid",
    "userId": "user-uuid",
    "createdAt": "2025-11-02T...",
    "updatedAt": "2025-11-02T...",
    "items": [
      {
        "id": "item-uuid",
        "cartId": "cart-uuid",
        "productId": "prod-uuid",
        "quantity": 2,
        "createdAt": "2025-11-02T...",
        "updatedAt": "2025-11-02T...",
        "product": {
          "id": "prod-uuid",
          "name": "Wireless Headphones",
          "description": "...",
          "price": "99.99",
          "image": "https://...",
          "stock": 120,
          "isActive": true
        }
      }
    ]
  }
}
```

---

### Add to Cart

```
POST /api/cart/items
```

**Headers:**

```
Authorization: Bearer <token>
```

**Body:**

```json
{
  "productId": "product-uuid",
  "quantity": 2 // optional, defaults to 1
}
```

**Behavior:**

- Creates cart if user doesn't have one
- If product already in cart: **increments** quantity by the provided amount
- If product not in cart: adds new item with specified quantity
- Validates product exists and is active
- Uses atomic upsert to prevent race conditions

**Response:**

```json
{
  "success": true,
  "message": "Item added to cart",
  "data": {
    "id": "item-uuid",
    "cartId": "cart-uuid",
    "productId": "prod-uuid",
    "quantity": 3, // incremented if already existed
    "product": {
      "id": "prod-uuid",
      "name": "Wireless Headphones",
      "price": "99.99",
      "image": "https://...",
      "stock": 120
    }
  }
}
```

**Errors:**

- `400` - Product ID is required
- `400` - Quantity must be at least 1
- `404` - Product not found
- `400` - Product is not available

---

### Update Cart Item

```
PUT /api/cart/items
```

**Headers:**

```
Authorization: Bearer <token>
```

**Body:**

```json
{
  "productId": "product-uuid",
  "quantity": 5 // set to exact quantity
}
```

**Behavior:**

- Sets item quantity to **exact value** (not increment)
- Validates against product stock
- Creates item if doesn't exist (upsert pattern)

**Response:**

```json
{
  "success": true,
  "message": "Cart item updated",
  "data": {
    "id": "item-uuid",
    "quantity": 5,
    "product": { ... }
  }
}
```

**Errors:**

- `400` - Product ID is required
- `400` - Quantity must be at least 1
- `404` - Cart not found
- `404` - Product not found
- `400` - Only X items available in stock

---

### Remove from Cart

```
DELETE /api/cart/items
```

**Headers:**

```
Authorization: Bearer <token>
```

**Body:**

```json
{
  "productId": "product-uuid"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Item removed from cart"
}
```

**Errors:**

- `400` - Product ID is required
- `404` - Cart not found
- `404` - Item not found in cart

---

### Clear Cart

```
DELETE /api/cart
```

**Headers:**

```
Authorization: Bearer <token>
```

**Behavior:**

- Removes all items from cart in atomic transaction
- Updates cart timestamp
- Does not delete the cart itself

**Response:**

```json
{
  "success": true,
  "message": "Cart cleared successfully"
}
```

**Errors:**

- `404` - Cart not found

---

## Implementation Patterns

### Race-safe Add to Cart (Increment)

```javascript
const item = await prisma.cartItem.upsert({
  where: {
    cartId_productId: { cartId, productId },
  },
  update: {
    quantity: { increment: quantity }, // atomic increment
  },
  create: {
    cartId,
    productId,
    quantity,
  },
});
```

### Race-safe Update Quantity (Set)

```javascript
const item = await prisma.cartItem.upsert({
  where: {
    cartId_productId: { cartId, productId },
  },
  update: { quantity }, // set to exact value
  create: {
    cartId,
    productId,
    quantity,
  },
});
```

### Atomic Clear Cart

```javascript
await prisma.$transaction([
  prisma.cartItem.deleteMany({ where: { cartId } }),
  prisma.cart.update({
    where: { id: cartId },
    data: { updatedAt: new Date() },
  }),
]);
```

---

## Schema Constraints

### Cart Model

- `userId` is **unique** → one cart per user
- Cascade delete: deleting user deletes their cart
- Cart has many CartItems

### CartItem Model

- **Composite unique** on `[cartId, productId]` → one product per cart
- Cascade delete: deleting cart deletes all items
- Indexed on `cartId` and `productId` for performance

---

## Usage Examples

### Adding Multiple Items

```bash
# Add 2 headphones
curl -X POST http://localhost:4000/api/cart/items \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"productId": "prod-123", "quantity": 2}'

# Add 3 more (total becomes 5)
curl -X POST http://localhost:4000/api/cart/items \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"productId": "prod-123", "quantity": 3}'
```

### Setting Exact Quantity

```bash
# Set to exactly 10 (overwrites previous)
curl -X PUT http://localhost:4000/api/cart/items \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"productId": "prod-123", "quantity": 10}'
```

### Checkout Flow

```bash
# 1. Get cart
curl http://localhost:4000/api/cart \
  -H "Authorization: Bearer <token>"

# 2. Create order from cart
curl -X POST http://localhost:4000/api/orders \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"items": [...]}'  # from cart response

# 3. Clear cart after successful order
curl -X DELETE http://localhost:4000/api/cart \
  -H "Authorization: Bearer <token>"
```

---

## Testing

Run cart controller tests:

```bash
npm test -- cartController.test.js
```

Test coverage includes:

- ✅ Get/create cart
- ✅ Add items (increment pattern)
- ✅ Update quantity (set pattern)
- ✅ Remove items
- ✅ Clear cart (atomic transaction)
- ✅ Stock validation
- ✅ Product availability checks
- ✅ Error handling

---

## Notes

### Why Two Update Endpoints?

- **POST /cart/items** (addToCart): Increments quantity
  - Use when: "Add to cart" button clicked
  - Behavior: quantity += amount
- **PUT /cart/items** (updateCartItem): Sets exact quantity
  - Use when: User types quantity in cart page
  - Behavior: quantity = amount

### Unique Constraint Benefits

The `@@unique([cartId, productId])` constraint:

- Prevents duplicate products in same cart
- Enables safe upsert operations
- Acts as an index for lookups
- Ensures data integrity at DB level

### Transaction Safety

The `clearCart` operation uses `$transaction` to ensure:

- All items deleted OR none deleted
- Cart timestamp updated atomically
- No partial state on errors
