const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const STORE_DIR = path.join(__dirname, 'store-data');
const STORE_PATH = path.join(STORE_DIR, 'store.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_ORDER_QUANTITY = 20;

const seed = { orders: [] };

function ensureStore() {
  if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) fs.writeFileSync(STORE_PATH, JSON.stringify(seed, null, 2));
}

function readStore() {
  ensureStore();
  return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
}

function readProducts() {
  return JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'products.json'), 'utf8')).products;
}

function writeStore(data) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
}

function nextOrderId(orders) {
  const existingIds = new Set(orders.map(order => String(order.id || '')));
  let orderNumber = orders.reduce((max, order) => {
    const match = /^ANV-(\d+)$/i.exec(String(order.id || ''));
    const number = match ? Number(match[1]) : 0;
    return Number.isSafeInteger(number) ? Math.max(max, number) : max;
  }, 0);
  let id;
  do {
    orderNumber += 1;
    id = `ANV-${String(orderNumber).padStart(7, '0')}`;
  } while (existingIds.has(id));
  return id;
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1_000_000) reject(new Error('Request too large'));
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error('Invalid JSON')); }
    });
  });
}

function sendStatic(req, res) {
  const requested = req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
  const filePath = path.resolve(PUBLIC_DIR, requested);
  if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon'
  };
  res.writeHead(200, {
    'Content-Type': types[path.extname(filePath)] || 'application/octet-stream',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const { method, url } = req;

    if (method === 'POST' && url === '/api/orders') {
      const { name, phone, address, paymentMethod, items } = await readBody(req);
      if (!String(name || '').trim() || !String(phone || '').trim() || !String(address || '').trim()) {
        return json(res, 400, { error: 'Name, phone number, and delivery address are required.' });
      }
      if (!['Cash on Delivery', 'UPI'].includes(paymentMethod)) return json(res, 400, { error: 'Choose a valid payment method.' });
      if (!Array.isArray(items) || items.length === 0) return json(res, 400, { error: 'Your cart is empty.' });
      const data = readStore();
      if (!Array.isArray(data.orders)) data.orders = [];
      const itemMap = new Map(readProducts().filter(product => product.available).map(product => [product.id, product]));
      const orderedItems = [];
      for (const item of items) {
        const product = itemMap.get(String(item.id));
        const quantity = Number(item.quantity);
        if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_ORDER_QUANTITY) {
          return json(res, 400, { error: 'One or more selected items are no longer available. Please refresh your cart.' });
        }
        orderedItems.push({ id: product.id, name: product.name, price: product.price, quantity });
      }
      const order = {
        id: nextOrderId(Array.isArray(data.orders) ? data.orders : []),
        placedAt: new Date().toISOString(),
        customer: { name: String(name).trim(), phone: String(phone).trim(), address: String(address).trim() },
        paymentMethod,
        items: orderedItems,
        total: orderedItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
        status: 'WhatsApp order initiated'
      };
      data.orders.unshift(order);
      writeStore(data);
      return json(res, 201, { order });
    }

    if (method === 'GET') return sendStatic(req, res);
    return json(res, 405, { error: 'Method not allowed.' });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: 'Something went wrong. Please try again.' });
  }
});

server.listen(PORT, () => console.log(`Annvitra Visit Store is running at http://localhost:${PORT}`));
