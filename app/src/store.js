// In-memory data store for the canteen.
// Kept in memory on purpose so the DevOps pipeline (not a database) is the focus.

const menu = [
  { id: 1, name: 'Vada Pav', price: 20, available: true },
  { id: 2, name: 'Masala Dosa', price: 60, available: true },
  { id: 3, name: 'Veg Thali', price: 90, available: true },
  { id: 4, name: 'Cold Coffee', price: 40, available: true },
  { id: 5, name: 'Samosa', price: 15, available: false },
];

const VALID_STATUSES = ['PLACED', 'PREPARING', 'READY', 'COLLECTED', 'CANCELLED'];

let orders = [];
let nextOrderId = 1;
let nextToken = 100;

function getMenu() {
  return menu;
}

function findMenuItem(id) {
  return menu.find((m) => m.id === Number(id));
}

function createOrder(studentName, items) {
  let total = 0;
  const lines = items.map((it) => {
    const menuItem = findMenuItem(it.itemId);
    const qty = Number(it.qty) || 1;
    total += menuItem.price * qty;
    return { itemId: menuItem.id, name: menuItem.name, qty, price: menuItem.price };
  });
  const order = {
    id: nextOrderId++,
    token: nextToken++,
    studentName,
    items: lines,
    total,
    status: 'PLACED',
    createdAt: new Date().toISOString(),
  };
  orders.push(order);
  return order;
}

function getOrder(id) {
  return orders.find((o) => o.id === Number(id));
}

function listOrders() {
  return orders;
}

function updateStatus(id, status) {
  const order = getOrder(id);
  if (!order) return null;
  order.status = status;
  order.updatedAt = new Date().toISOString();
  return order;
}

function reset() {
  orders = [];
  nextOrderId = 1;
  nextToken = 100;
}

module.exports = {
  VALID_STATUSES,
  getMenu,
  findMenuItem,
  createOrder,
  getOrder,
  listOrders,
  updateStatus,
  reset,
};
