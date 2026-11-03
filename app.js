/* =====================================================
   ShopMaster – Tienda con FakeStoreAPI
   Secciones:
   1. Configuración y estado
   2. Utilidades
   3. Carga y render de productos
   4. Modal de producto
   5. Carrito
   6. Pasarela de pago (simulada)
   7. Ticket PDF (formato térmico 80 mm)
   ===================================================== */

// ---------- 1. CONFIGURACIÓN Y ESTADO ----------
const API_URL = "https://fakestoreapi.com/products";
const STORE_NAME = "SHOPMASTER";
const TICKET_WIDTH = 80;            // mm (cambia a 58 para impresoras de 58 mm)
const CART_KEY = "shopmaster_cart"; // clave en LocalStorage

let products = [];
let cart = loadCart();
let currentProduct = null;

// Referencias al DOM
const $ = (id) => document.getElementById(id);
const grid = $("productGrid");
const productModal = new bootstrap.Modal($("productModal"));
const payModal = new bootstrap.Modal($("payModal"));
const cartPanel = bootstrap.Offcanvas.getOrCreateInstance($("cartPanel"));

// ---------- 2. UTILIDADES ----------
const money = (n) => "$" + n.toFixed(2);

// Evita inyección de HTML al pintar textos de la API
function esc(text) {
  const d = document.createElement("div");
  d.textContent = text;
  return d.innerHTML;
}

function showAlert(message, type = "success") {
  $("alertZone").innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>`;
  setTimeout(() => ($("alertZone").innerHTML = ""), 4000);
}

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}
function saveCart() {
  try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch {}
}

// ---------- 3. CARGA Y RENDER DE PRODUCTOS ----------
async function fetchProducts() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("HTTP " + res.status);
    products = await res.json();
    fillCategories();
    renderProducts();
  } catch (err) {
    showAlert("❌ No se pudieron cargar los productos. Revisa tu conexión.", "danger");
  } finally {
    $("loading").classList.add("d-none");
  }
}

function fillCategories() {
  const cats = [...new Set(products.map((p) => p.category))];
  $("categorySelect").innerHTML =
    `<option value="all">Todas las categorías</option>` +
    cats.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
}

function renderProducts() {
  const q = $("searchInput").value.trim().toLowerCase();
  const cat = $("categorySelect").value;

  const list = products.filter(
    (p) =>
      (cat === "all" || p.category === cat) &&
      p.title.toLowerCase().includes(q)
  );

  if (!list.length) {
    grid.innerHTML = `<p class="text-center text-muted">No se encontraron productos 😕</p>`;
    return;
  }

  grid.innerHTML = list
    .map(
      (p) => `
    <div class="col-12 col-sm-6 col-lg-3">
      <div class="card product-card">
        <img src="${esc(p.image)}" class="card-img-top" alt="${esc(p.title)}" loading="lazy">
        <div class="card-body d-flex flex-column">
          <h6 class="product-title">${esc(p.title)}</h6>
          <p class="price mb-3">${money(p.price)}</p>
          <button class="btn btn-primary mt-auto" data-view="${p.id}">
            <i class="fa-solid fa-eye"></i> Ver más 🛍️
          </button>
        </div>
      </div>
    </div>`
    )
    .join("");
}

// Delegación de eventos: un solo listener para todos los botones "Ver más"
grid.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-view]");
  if (btn) openProduct(Number(btn.dataset.view));
});
$("searchInput").addEventListener("input", renderProducts);
$("categorySelect").addEventListener("change", renderProducts);

// ---------- 4. MODAL DE PRODUCTO ----------
function openProduct(id) {
  currentProduct = products.find((p) => p.id === id);
  if (!currentProduct) return;
  $("modalTitle").textContent = currentProduct.title;
  $("modalImg").src = currentProduct.image;
  $("modalCategory").textContent = currentProduct.category;
  $("modalDesc").textContent = currentProduct.description;
  $("modalPrice").textContent = money(currentProduct.price);
  $("modalQty").value = 1;
  productModal.show();
}

$("modalAddBtn").addEventListener("click", () => {
  const qty = Math.max(1, Math.min(99, parseInt($("modalQty").value) || 1));
  addToCart(currentProduct, qty);
  productModal.hide();
  showAlert(`✅ <strong>${esc(currentProduct.title)}</strong> agregado al carrito (x${qty}).`);
});

// ---------- 5. CARRITO ----------
function addToCart(product, qty) {
  const item = cart.find((i) => i.id === product.id);
  if (item) item.qty += qty;
  else cart.push({ id: product.id, title: product.title, price: product.price, image: product.image, qty });
  updateCart();
}

function changeQty(id, delta) {
  const item = cart.find((i) => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter((i) => i.id !== id);
  updateCart();
}

function removeItem(id) {
  cart = cart.filter((i) => i.id !== id);
  updateCart();
}

const cartTotal = () => cart.reduce((sum, i) => sum + i.price * i.qty, 0);

function updateCart() {
  saveCart();
  $("cartCount").textContent = cart.reduce((n, i) => n + i.qty, 0);
  $("cartTotal").textContent = money(cartTotal());

  if (!cart.length) {
    $("cartItems").innerHTML = `<p class="text-center text-muted mt-4">Tu carrito está vacío 🛒</p>`;
    return;
  }

  $("cartItems").innerHTML = cart
    .map(
      (i) => `
    <div class="cart-item">
      <img src="${esc(i.image)}" alt="">
      <div class="info">
        <div class="name" title="${esc(i.title)}">${esc(i.title)}</div>
        <small class="text-success fw-bold">${money(i.price * i.qty)}</small>
        <div class="btn-group btn-group-sm d-block mt-1">
          <button class="btn btn-outline-secondary" data-dec="${i.id}"><i class="fa-solid fa-minus"></i></button>
          <button class="btn btn-light disabled">${i.qty}</button>
          <button class="btn btn-outline-secondary" data-inc="${i.id}"><i class="fa-solid fa-plus"></i></button>
        </div>
      </div>
      <button class="btn btn-sm btn-outline-danger" data-del="${i.id}" title="Eliminar">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>`
    )
    .join("");
}

$("cartItems").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.inc) changeQty(Number(b.dataset.inc), +1);
  if (b.dataset.dec) changeQty(Number(b.dataset.dec), -1);
  if (b.dataset.del) removeItem(Number(b.dataset.del));
});

$("clearBtn").addEventListener("click", () => {
  cart = [];
  updateCart();
});

$("checkoutBtn").addEventListener("click", () => {
  if (!cart.length) return showAlert("🛒 Agrega productos antes de pagar.", "warning");
  $("payTotal").textContent = money(cartTotal());
  cartPanel.hide();
  payModal.show();
});

// ---------- 6. PASARELA DE PAGO (SIMULADA) ----------
// Formatos automáticos mientras el usuario escribe
$("payCard").addEventListener("input", (e) => {
  const d = e.target.value.replace(/\D/g, "").slice(0, 16);
  e.target.value = d.replace(/(.{4})/g, "$1 ").trim();
});
$("payExp").addEventListener("input", (e) => {
  let d = e.target.value.replace(/\D/g, "").slice(0, 4);
  if (d.length > 2) d = d.slice(0, 2) + "/" + d.slice(2);
  e.target.value = d;
});
$("payCvv").addEventListener("input", (e) => {
  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4);
});

function validExpiry(v) {
  const m = /^(\d{2})\/(\d{2})$/.exec(v);
  if (!m) return false;
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return false;
  const now = new Date();
  // Válida hasta el último día del mes indicado
  return new Date(year, month, 0, 23, 59, 59) >= now;
}

function setValidity(input, ok) {
  input.classList.toggle("is-invalid", !ok);
  input.classList.toggle("is-valid", ok);
  return ok;
}

$("payForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("payName").value.trim();
  const card = $("payCard").value.replace(/\s/g, "");

  const results = [
    setValidity($("payName"), name.length >= 3),
    setValidity($("payCard"), /^\d{16}$/.test(card)),
    setValidity($("payExp"), validExpiry($("payExp").value)),
    setValidity($("payCvv"), /^\d{3,4}$/.test($("payCvv").value)),
  ];
  if (results.includes(false)) return;

  const order = { name, card, items: [...cart], total: cartTotal(), date: new Date() };
  generateTicket(order);

  // Limpieza tras pagar
  cart = [];
  updateCart();
  $("payForm").reset();
  document.querySelectorAll("#payForm .is-valid, #payForm .is-invalid")
    .forEach((el) => el.classList.remove("is-valid", "is-invalid"));
  payModal.hide();
  showAlert("🎉 ¡Pago exitoso! Tu ticket se descargó en PDF. ¡Gracias por tu compra!");
});

// ---------- 7. TICKET PDF (formato térmico) ----------
// jsPDF no soporta tildes/emojis en las fuentes base: los normalizamos.
const plain = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "");

function generateTicket(order) {
  const { jsPDF } = window.jspdf;
  const margin = 4;
  const fontSize = TICKET_WIDTH === 58 ? 7 : 8;
  const lineH = fontSize * 0.45;
  const usable = TICKET_WIDTH - margin * 2;
  const cols = TICKET_WIDTH === 58 ? 32 : 42; // caracteres por línea (Courier)

  const sep = "-".repeat(cols);
  const center = (t) => " ".repeat(Math.max(0, Math.floor((cols - t.length) / 2))) + t;
  const row = (left, right) => {
    const space = cols - left.length - right.length;
    return space > 0 ? left + " ".repeat(space) + right : left + " " + right;
  };

  // 1) Construimos las líneas de texto
  const d = order.date;
  const lines = [
    center(STORE_NAME),
    center("Ticket de compra"),
    sep,
    `Fecha: ${d.toLocaleDateString("es-DO")} ${d.toLocaleTimeString("es-DO")}`,
    `Cliente: ${plain(order.name)}`,
    `Tarjeta: **** **** **** ${order.card.slice(-4)}`,
    sep,
    row("CANT DESCRIPCION", "TOTAL"),
    sep,
  ];

  const measure = new jsPDF({ unit: "mm", format: [TICKET_WIDTH, 200] });
  measure.setFont("courier", "normal").setFontSize(fontSize);

  order.items.forEach((i) => {
    const title = plain(i.title);
    const wrapped = measure.splitTextToSize(`${i.qty} x ${title}`, usable);
    lines.push(...wrapped);
    lines.push(row(`  ${money(i.price)} c/u`, money(i.price * i.qty)));
  });

  lines.push(sep, row("TOTAL:", money(order.total)), sep, center("Gracias por su compra!"), center("Pago simulado - demo"));

  // 2) Creamos el PDF con la altura exacta del contenido
  const height = margin * 2 + lines.length * lineH + 4;
  const doc = new jsPDF({ unit: "mm", format: [TICKET_WIDTH, height] });
  doc.setFont("courier", "normal").setFontSize(fontSize);
  lines.forEach((l, idx) => doc.text(l, margin, margin + (idx + 1) * lineH));

  doc.save(`ticket-${Date.now()}.pdf`);
}

// ---------- ARRANQUE ----------
updateCart();
fetchProducts();
