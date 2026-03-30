const STORAGE_KEYS = {
  users: 'fluffy_users',
  session: 'fluffy_session',
  orders: 'fluffy_orders',
  vipAccess: 'fluffy_vip_access'
};
const ADMIN_CREDENTIALS = { email: 'fluffy.admin@fluffy.com', password: 'Fluffy26!' };
const VIP_CODES = ['FLUFFY', 'FLUFFY67', 'FLUFFYAURA', 'AURAISFLUFFY'];

const read = (k, fallback) => JSON.parse(localStorage.getItem(k) || JSON.stringify(fallback));
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

function getUsers() { return read(STORAGE_KEYS.users, {}); }
function setUsers(users) { write(STORAGE_KEYS.users, users); }
function getSession() { return read(STORAGE_KEYS.session, null); }
function setSession(s) { write(STORAGE_KEYS.session, s); }
function getOrders() { return read(STORAGE_KEYS.orders, []); }
function setOrders(o) { write(STORAGE_KEYS.orders, o); }
function getVipAccess() { return read(STORAGE_KEYS.vipAccess, {}); }
function setVipAccess(v) { write(STORAGE_KEYS.vipAccess, v); }

function today() { return new Date().toISOString().slice(0, 10); }

function ensureDailyCoins(user) {
  if (user.lastCoinDate !== today()) {
    user.coins = (user.coins || 0) + 15;
    user.lastCoinDate = today();
  }
}

function saveCurrentUser(updatedUser) {
  const users = getUsers();
  users[updatedUser.email] = updatedUser;
  setUsers(users);
  setSession({ email: updatedUser.email });
}

function currentUser() {
  const session = getSession();
  if (!session) return null;
  const users = getUsers();
  return users[session.email] || null;
}

function renderGlobalUI() {
  const user = currentUser();
  const badge = document.getElementById('accountBadge');
  const coin = document.getElementById('coinBalance');
  if (!badge || !coin) return;

  if (user) {
    ensureDailyCoins(user);
    saveCurrentUser(user);
    badge.innerHTML = `<strong>${user.name}</strong><br><small>${user.email}</small><br><button class="secondary" id="logoutBtn">Log out</button>`;
    coin.textContent = `Coins: ${user.coins}`;
    const logout = document.getElementById('logoutBtn');
    logout?.addEventListener('click', () => {
      localStorage.removeItem(STORAGE_KEYS.session);
      location.reload();
    });
  } else {
    badge.innerHTML = '<strong>Not logged in</strong>';
    coin.textContent = 'Coins: 0';
  }
}

function addOrder(order) {
  const orders = getOrders();
  orders.unshift({ ...order, date: new Date().toISOString() });
  setOrders(orders);
}

function spendCoins(amount) {
  const user = currentUser();
  if (!user) return { ok: false, msg: 'Please log in first.' };
  ensureDailyCoins(user);
  if ((user.coins || 0) < amount) return { ok: false, msg: 'insufficient funds' };
  user.coins -= amount;
  saveCurrentUser(user);
  renderGlobalUI();
  return { ok: true };
}

function initLoginModal() {
  const btn = document.getElementById('loginBtn');
  const modal = document.getElementById('loginModal');
  if (!btn || !modal) return;

  btn.addEventListener('click', () => {
    modal.style.display = 'flex';
    document.getElementById('loginMessage').textContent = '';
  });
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

  document.getElementById('googleLoginBtn')?.addEventListener('click', () => {
    const email = prompt('Google email:');
    if (!email) return;
    const name = prompt('Choose display name:') || email.split('@')[0];
    const users = getUsers();
    if (!users[email]) users[email] = { email, name, password: null, coins: 0, lastCoinDate: null };
    setUsers(users);
    setSession({ email });
    modal.style.display = 'none';
    location.reload();
  });

  document.getElementById('loginSubmitBtn')?.addEventListener('click', () => {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const msg = document.getElementById('loginMessage');
    const users = getUsers();
    if (!users[email] || users[email].password !== password) {
      msg.textContent = 'Invalid credentials.';
      msg.className = 'error';
      return;
    }
    setSession({ email });
    location.reload();
  });

  document.getElementById('signupBtn')?.addEventListener('click', () => {
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const msg = document.getElementById('loginMessage');
    if (!name || !email || !password) {
      msg.textContent = 'Fill all sign-up fields.';
      msg.className = 'error';
      return;
    }
    const users = getUsers();
    users[email] = { name, email, password, coins: 0, lastCoinDate: null };
    setUsers(users);
    setSession({ email });
    location.reload();
  });
}

function initPurchaseButtons() {
  document.querySelectorAll('[data-buy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const product = btn.dataset.product;
      const cost = Number(btn.dataset.cost);
      const nameInput = document.getElementById('buyerName');
      const emailInput = document.getElementById('buyerEmail');
      const status = document.getElementById('purchaseStatus');
      const name = nameInput?.value.trim();
      const email = emailInput?.value.trim();
      if (!name || !email) {
        status.textContent = 'Please enter name and email.';
        status.className = 'error';
        return;
      }
      const pay = spendCoins(cost);
      if (!pay.ok) {
        status.textContent = pay.msg;
        status.className = 'error';
        return;
      }
      addOrder({ product, name, email, cost });
      if (product === 'VIP') {
        const access = getVipAccess();
        access[email] = true;
        setVipAccess(access);
      }
      status.textContent = `${product} purchased successfully!`;
      status.className = 'success';
    });
  });
}

function initVipGate() {
  const gate = document.getElementById('vipGate');
  const content = document.getElementById('vipContent');
  if (!gate || !content) return;
  const user = currentUser();
  if (!user) {
    gate.innerHTML = '<p class="error">Please log in first.</p>';
    return;
  }
  const access = getVipAccess();
  if (access[user.email]) {
    gate.style.display = 'none';
    content.style.display = 'block';
    return;
  }
  document.getElementById('vipUnlockBtn')?.addEventListener('click', () => {
    const code = document.getElementById('vipCode').value.trim().toUpperCase();
    const msg = document.getElementById('vipMessage');
    if (!VIP_CODES.includes(code)) {
      msg.textContent = 'Invalid code.';
      msg.className = 'error';
      return;
    }
    access[user.email] = true;
    setVipAccess(access);
    gate.style.display = 'none';
    content.style.display = 'block';
  });
}

function initAdmin() {
  const loginCard = document.getElementById('adminLogin');
  const portal = document.getElementById('adminPortal');
  if (!loginCard || !portal) return;

  document.getElementById('adminLoginBtn')?.addEventListener('click', () => {
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value;
    const msg = document.getElementById('adminMsg');
    if (email !== ADMIN_CREDENTIALS.email || password !== ADMIN_CREDENTIALS.password) {
      msg.textContent = 'Invalid admin credentials';
      msg.className = 'error';
      return;
    }
    loginCard.style.display = 'none';
    portal.style.display = 'block';
    renderOrders();
  });

  document.getElementById('addCoinsBtn')?.addEventListener('click', () => {
    const email = document.getElementById('coinEmail').value.trim();
    const amt = Number(document.getElementById('coinAmount').value);
    const msg = document.getElementById('coinMsg');
    const users = getUsers();
    if (!users[email]) {
      msg.textContent = 'User not found.';
      msg.className = 'error';
      return;
    }
    users[email].coins = (users[email].coins || 0) + amt;
    setUsers(users);
    msg.textContent = `Added ${amt} coins to ${email}.`;
    msg.className = 'success';
  });
}

function renderOrders() {
  const body = document.getElementById('ordersBody');
  if (!body) return;
  const orders = getOrders();
  body.innerHTML = orders.map((o) => `
    <tr>
      <td>${new Date(o.date).toLocaleString()}</td>
      <td>${o.product}</td>
      <td>${o.name}</td>
      <td>${o.email}</td>
      <td>${o.cost}</td>
    </tr>
  `).join('') || '<tr><td colspan="5">No orders yet.</td></tr>';
}

document.addEventListener('DOMContentLoaded', () => {
  renderGlobalUI();
  initLoginModal();
  initPurchaseButtons();
  initVipGate();
  initAdmin();
});
