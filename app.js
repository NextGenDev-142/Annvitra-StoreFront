const MAX_CART_QUANTITY = 20;

function loadSavedCart() {
  try {
    const savedItems = JSON.parse(localStorage.getItem('annvitra-cart') || '[]');
    if (!Array.isArray(savedItems)) return [];
    const quantities = new Map();
    savedItems.forEach(item => {
      const id = String(item?.id || '');
      const quantity = Number(item?.quantity);
      if (!id || !Number.isInteger(quantity) || quantity < 1) return;
      quantities.set(id, Math.min((quantities.get(id) || 0) + quantity, MAX_CART_QUANTITY));
    });
    return Array.from(quantities, ([id, quantity]) => ({ id, quantity }));
  } catch {
    return [];
  }
}

const state = {
  products: [],
  cart: loadSavedCart()
};

const $ = (selector) => document.querySelector(selector);
const mealGrid = $('#mealGrid');
const cartPanel = $('#cartPanel');
const checkoutPanel = $('#checkoutPanel');
const scrim = $('#scrim');

function money(value) {
  return `₹${Number(value).toLocaleString('en-IN')}`;
}

function safe(value) {
  return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function toast(message) {
  const item = $('#toast');
  item.textContent = message;
  item.classList.add('show');
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => item.classList.remove('show'), 3000);
}

function saveCart() {
  localStorage.setItem('annvitra-cart', JSON.stringify(state.cart));
}

function cartQuantity() {
  return state.cart.reduce((total, item) => total + item.quantity, 0);
}

function currentProduct(id) {
  return state.products.find(product => product.id === String(id));
}

function renderMenu() {
  if (!state.products.length) {
    mealGrid.innerHTML = '<div class="loading-card">No food is listed just yet. Please check back soon.</div>';
    return;
  }
  mealGrid.innerHTML = state.products.map(product => `
    <article class="meal-card ${product.available ? '' : 'sold-out'}">
      <div class="meal-image">
        <img src="${safe(product.image)}" alt="${safe(product.name)} from ${safe(product.kitchen)}" loading="lazy" />
        <span class="food-badge">${safe(product.badge || product.type)}</span>
        <span class="product-id">ID ${safe(product.id)}</span>
      </div>
      <div class="meal-content">
        <p class="meal-kitchen">${safe(product.kitchen)} · ${safe(product.type)}</p>
        <h3 class="meal-title">${safe(product.name)}</h3>
        <div class="meal-row"><div class="price-wrap"><span class="price">${money(product.price)}</span><s class="original-price">${money(product.originalPrice)}</s></div><button class="add-button" type="button" aria-label="Add ${safe(product.name)} to cart" data-add="${safe(product.id)}" ${product.available ? '' : 'disabled'}>${product.available ? '+' : '–'}</button></div>
      </div>
    </article>`).join('');
}

function renderCart() {
  const cartItems = $('#cartItems');
  const count = cartQuantity();
  $('#cartCount').textContent = count;
  const activeCart = state.cart.map(item => ({ ...item, product: currentProduct(item.id) })).filter(item => item.product);
  const total = activeCart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  $('#cartTotal').textContent = money(total);
  $('#checkoutOpen').disabled = !activeCart.length;
  $('#checkoutOpen').style.opacity = activeCart.length ? '1' : '.45';
  if (!activeCart.length) {
    cartItems.innerHTML = '<p class="cart-empty">Your cart is ready for a good food find.</p>';
    return;
  }
  cartItems.innerHTML = activeCart.map(({ product, quantity }) => `
    <div class="cart-item">
      <img class="cart-thumb" src="${safe(product.image)}" alt="" />
      <div><h4>${safe(product.name)}</h4><p>ID ${safe(product.id)} · ${money(product.price)}</p><div class="cart-controls"><button type="button" data-cart-change="${safe(product.id)}" data-delta="-1" aria-label="Remove one ${safe(product.name)}">−</button><span>${quantity}</span><button type="button" data-cart-change="${safe(product.id)}" data-delta="1" aria-label="Add one ${safe(product.name)}">+</button></div></div>
      <strong class="cart-price">${money(product.price * quantity)}</strong>
    </div>`).join('');
}

function openPanel(panel) {
  [cartPanel, checkoutPanel].forEach(item => { if (item !== panel) item.classList.remove('open'); });
  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
  scrim.classList.add('open');
}

function closePanels() {
  [cartPanel, checkoutPanel].forEach(panel => { panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); });
  scrim.classList.remove('open');
}

async function loadProducts() {
  try {
    const response = await fetch('products.json');
    if (!response.ok) throw new Error('Unable to load today’s menu.');
    const data = await response.json();
    if (!Array.isArray(data.products)) throw new Error('Today’s menu is unavailable right now.');
    state.products = data.products;
    renderMenu();
    renderCart();
  } catch {
    mealGrid.innerHTML = '<div class="loading-card" role="status">Today’s menu is unavailable right now. Please refresh the page to try again.</div>';
  }
}

function addToCart(id) {
  const product = currentProduct(id);
  if (!product || !product.available) return toast('This item is not available right now.');
  const existing = state.cart.find(item => item.id === id);
  if (existing && existing.quantity >= MAX_CART_QUANTITY) return toast(`You can add up to ${MAX_CART_QUANTITY} of each item.`);
  if (existing) existing.quantity = Math.min(existing.quantity + 1, MAX_CART_QUANTITY);
  else state.cart.push({ id, quantity: 1 });
  saveCart();
  renderCart();
  toast(`${product.name} added to your cart.`);
}

function updateCart(id, delta) {
  const item = state.cart.find(item => item.id === id);
  if (!item) return;
  const change = Number(delta);
  if (change !== -1 && change !== 1) return;
  if (change === 1 && Number(item.quantity) >= MAX_CART_QUANTITY) return toast(`You can add up to ${MAX_CART_QUANTITY} of each item.`);
  const nextQuantity = Math.min(Number(item.quantity) + change, MAX_CART_QUANTITY);
  if (nextQuantity <= 0) state.cart = state.cart.filter(cartItem => cartItem.id !== id);
  else item.quantity = nextQuantity;
  saveCart();
  renderCart();
}

function createLocalOrder(details) {
  const token = window.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const items = state.cart.map(item => {
    const product = currentProduct(item.id);
    return product ? { id: product.id, name: product.name, price: product.price, quantity: item.quantity } : null;
  }).filter(Boolean);
  return {
    id: `ANV-LOCAL-${token}`,
    customer: {
      name: String(details.get('name')).trim(),
      phone: String(details.get('phone')).trim(),
      address: String(details.get('address')).trim()
    },
    paymentMethod: details.get('paymentMethod'),
    items,
    total: items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  };
}

async function submitOrder(event) {
  event.preventDefault();
  if (!state.cart.length) { closePanels(); return toast('Your cart is empty.'); }
  const formElement = $('#checkoutForm');
  const button = formElement ? formElement.querySelector('button[type="submit"]') : null;
  const details = new FormData(formElement || event.currentTarget);
  let order;
  let saved = false;
  if (button) {
    button.disabled = true;
    button.textContent = 'Saving your order…';
  }
  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: details.get('name'), phone: details.get('phone'), address: details.get('address'), paymentMethod: details.get('paymentMethod'), items: state.cart
      })
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.order) {
      order = data.order;
      saved = true;
    } else if (response.status === 404 || response.status === 405 || response.status >= 500 || response.ok) {
      order = createLocalOrder(details);
    } else {
      throw new Error(data.error || 'Unable to save your order.');
    }
  } catch (error) {
    if (error instanceof TypeError) {
      order = createLocalOrder(details);
    }
    else {
      toast(error.message);
      if (button) {
        button.disabled = false;
        button.innerHTML = 'Continue to WhatsApp <span>↗</span>';
      }
      return;
    }
  }

  const lines = [
    'Hello Annvitra! I would like to place an order.',
    ...(saved ? [] : ['This storefront could not save the order. Please confirm it in this WhatsApp chat.']),
    '',
    `Order: ${order.id}`,
    'Items:',
    ...order.items.map(item => `• ${item.name} — ID ${item.id} × ${item.quantity} — ₹${item.price * item.quantity}`),
    '',
    `Total: ₹${order.total}`,
    `Payment: ${order.paymentMethod}`,
    '',
    `Name: ${order.customer.name}`,
    `Address: ${order.customer.address}`,
    `Phone: ${order.customer.phone}`
  ];
  state.cart = [];
  saveCart();
  renderCart();
  if (formElement) formElement.reset();
  closePanels();
  window.location.assign(`https://wa.me/916205569006?text=${encodeURIComponent(lines.join('\n'))}`);
}

document.addEventListener('click', event => {
  const add = event.target.closest('[data-add]');
  const cartChange = event.target.closest('[data-cart-change]');
  const closer = event.target.closest('[data-close]');
  if (add) addToCart(add.dataset.add);
  if (cartChange) updateCart(cartChange.dataset.cartChange, cartChange.dataset.delta);
  if (closer) closePanels();
});

$('#cartOpen').addEventListener('click', () => openPanel(cartPanel));
$('#checkoutOpen').addEventListener('click', () => {
  if (!state.cart.length) return;
  openPanel(checkoutPanel);
});
$('#checkoutForm').addEventListener('submit', submitOrder);
scrim.addEventListener('click', closePanels);
document.addEventListener('keydown', event => { if (event.key === 'Escape') closePanels(); });

function initIntroCurtain() {
  const curtain = document.getElementById('introCurtain');
  if (!curtain) {
    document.body.classList.add('page-ready');
    return;
  }
  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    curtain.classList.add('hidden');
    document.body.classList.add('page-ready');
    window.setTimeout(() => {
      try { curtain.remove(); } catch (_) {}
    }, 800);
  };
  curtain.addEventListener('click', dismiss);
  window.setTimeout(dismiss, 1200);
}

initIntroCurtain();
loadProducts();
