# Annvitra Visit Store

A mobile-responsive Annvitra storefront, designed around freshly made and surplus food. It includes a daily availability menu, cart, and WhatsApp checkout.

## Run locally

Start the site:

```powershell
npm start
```

Open `http://localhost:3000` in a browser.

## What is included

- Four featured meal cards in a single desktop row, becoming a 2 × 2 mobile grid.
- Each menu entry has a unique six-digit product ID.
- Orders include the customer’s name, address, phone, selected items and payment method (Cash on Delivery or UPI), and are stored in `store-data/store.json`.
- After the order is recorded, checkout opens WhatsApp to `+91 62055 69006` with a formatted order message containing all product IDs and delivery details.
- The required notice, “Items shown here are subject to availability.”, is displayed above the menu.

## Notes for production

- `store-data/store.json` is created automatically and is intentionally excluded from git. Back it up regularly or replace the file store with your database when deploying.
- Deploy behind HTTPS.
