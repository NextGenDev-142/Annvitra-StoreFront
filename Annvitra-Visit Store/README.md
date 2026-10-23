# Annvitra Visit Store

A mobile-responsive Annvitra storefront for fresh and surplus food, with a cart and WhatsApp checkout.

## Run locally

Start the order service:

```powershell
npm start
```

Open `http://localhost:3000` in a browser.

## Menu and orders

- The storefront loads its menu from `public/products.json`, so the menu does not depend on the server API and can be served as static files.
- Each menu entry has a unique six-digit product ID and the four-item menu becomes a 2 × 2 grid on mobile.
- Orders are recorded in `store-data/store.json` when the order service is available. Static-only deployments still open WhatsApp checkout, with a clear note that the order must be confirmed in chat.
- Saved orders use incrementing `ANV-` IDs. Each order includes the customer’s name, address, phone, selected items, and payment method (Cash on Delivery or UPI).
- Checkout opens WhatsApp to `+91 62055 69006` with the order ID, product IDs, and delivery details.
- The menu shows the notice, “Items shown here are subject to availability.”

Update `public/products.json` when changing the menu. The same file is used to validate items when the order service is running.

## Production notes

- Keep order data backed up, or replace the JSON file store with a database for production use.
- Deploy behind HTTPS.
