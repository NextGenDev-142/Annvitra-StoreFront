const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const STORE_DIR = path.join(__dirname, 'store-data');
const STORE_PATH = path.join(STORE_DIR, 'store.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const seed = {
  products: [
    {
      id: '481206',
      name: 'Saffron Feast Box',
      kitchen: 'The Royal Table',
      type: 'Banquet surplus',
      price: 149,
      originalPrice: 349,
      available: true,
      image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=85',
      badge: 'Best value'
    },
    {
      id: '728194',
      name: 'Smoky Paneer Bowl',
      kitchen: 'Tandoor Junction',
      type: 'Fresh today',
      price: 109,
      originalPrice: 239,
      available: true,
      image: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=900&q=85',
      badge: 'Chef pick'
    },
    {
      id: '593017',
      name: 'Garden Pasta Meal',
      kitchen: 'Basil & Bloom',
      type: 'Cloud kitchen',
      price: 129,
      originalPrice: 279,
      available: true,
      image: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=900&q=85',
      badge: 'Fresh batch'
    },
    {
      id: '864321',
      name: 'Street-Style Thali',
      kitchen: 'Chowk Express',
      type: 'Vetted local vendor',
      price: 99,
      originalPrice: 199,
      available: true,
      image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=900&q=85',
      badge: 'Local favourite'
    }
  ],
  orders: []
};

function ensureStore() {
  if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) fs.writeFileSync(STORE_PATH, JSON.stringify(seed, null, 2));
}

function readStore() {
  ensureStore();
  return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
}

function writeStore(data) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
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

    if (method === 'GET' && url === '/api/products') return json(res, 200, { products: readStore().products });

    if (method === 'POST' && url === '/api/orders') {
      const { name, phone, address, paymentMethod, items } = await readBody(req);
      if (!String(name || '').trim() || !String(phone || '').trim() || !String(address || '').trim()) {
        return json(res, 400, { error: 'Name, phone number, and delivery address are required.' });
      }
      if (!['Cash on Delivery', 'UPI'].includes(paymentMethod)) return json(res, 400, { error: 'Choose a valid payment method.' });
      if (!Array.isArray(items) || items.length === 0) return json(res, 400, { error: 'Your cart is empty.' });
      const data = readStore();
      const itemMap = new Map(data.products.filter(product => product.available).map(product => [product.id, product]));
      const orderedItems = [];
      for (const item of items) {
        const product = itemMap.get(String(item.id));
        const quantity = Number(item.quantity);
        if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
          return json(res, 400, { error: 'One or more selected items are no longer available. Please refresh your cart.' });
        }
        orderedItems.push({ id: product.id, name: product.name, price: product.price, quantity });
      }
      const order = {
        id: `ANV-${Date.now().toString().slice(-7)}`,
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
