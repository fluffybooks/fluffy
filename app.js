const STORAGE_KEYS = {
  users: 'fluffy_users',
  session: 'fluffy_session',
  orders: 'fluffy_orders',
  vipAccess: 'fluffy_vip_access'
};

const ADMIN_CREDENTIALS = {
  email: 'fluffy.admin@fluffy.com',
  password: 'Fluffy26!'
};

const VIP_TEXT_CODES = ['FLUFFY', 'FLUFFY67', 'FLUFFYAURA', 'AURAISFLUFFY'];
const VIP_NUMERIC_CODES = ['260426', '777777', '135790'];

const read = (key, fallback) => JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

const getUsers = () => read(STORAGE_KEYS.users, {});
const setUsers = (users) => write(STORAGE_KEYS.users, users);
const getSession = () => read(STORAGE_KEYS.session, null);
const setSession = (session) => write(STORAGE_KEYS.session, session);
const getOrders = () => read(STORAGE_KEYS.orders, []);
const setOrders = (orders) => write(STORAGE_KEYS.orders, orders);
const getVipAccess = () => read(STORAGE_KEYS.vipAccess, {});
const setVipAccess = (vipAccess) => write(STORAGE_KEYS.vipAccess, vipAccess);

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentUser() {
  const session = getSession();
  if (!session?.email) return null;
  const users = getUsers();
  return users[session.email] || null;
}

function saveUser(user) {
  const users = getUsers();
  users[user.email] = user;
  setUsers(users);
  setSession({ email: user.email });
}

function ensureDailyReward(user) {
  if (user.lastCoinDate !== todayString()) {
    user.coins = (user.coins || 0) + 15;
    user.lastCoinDate = todayString();
    saveUser(user);
  }
}

function updateGlobalUserUI() {
  const coinEl = document.getElementById('coinBalance');
  const badge = document.getElementById('accountBadge');
  const user = getCurrentUser();

  if (!coinEl || !badge) return;

  if (!user) {
    coinEl.textContent = 'Coins: 0';
    badge.innerHTML = '<strong>Not logged in</strong>';
    return;
  }

  ensureDailyReward(user);
  const refreshed = getCurrentUser();
  coinEl.textContent = `Coins: ${refreshed.coins || 0}`;
  badge.innerHTML = `
    <div><strong>${refreshed.name}</strong></div>
    <div class="notice">${refreshed.email}</div>
    <button class="secondary" id="logoutBtn">Log out</button>
  `;

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEYS.session);
    location.reload();
  });
}

function openLoginModal() {
  const modal = document.getElementById('loginModal');
  if (modal) modal.style.display = 'flex';
}

function closeLoginModal() {
  const modal = document.getElementById('loginModal');
  if (modal) modal.style.display = 'none';
}

function showMessage(id, text, className) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = className;
}

function initializeLogin() {
  const loginBtn = document.getElementById('loginBtn');
  const modal = document.getElementById('loginModal');

  loginBtn?.addEventListener('click', openLoginModal);
  modal?.addEventListener('click', (event) => {
    if (event.target === modal) closeLoginModal();
  });

  document.getElementById('googleLoginBtn')?.addEventListener('click', () => {
    const email = (prompt('Google email:') || '').trim().toLowerCase();
    if (!email) return;

    const users = getUsers();
    if (!users[email]) {
      const name = (prompt('Choose display name:') || email.split('@')[0]).trim();
      users[email] = { email, name, password: null, coins: 0, lastCoinDate: null };
      setUsers(users);
    }

    setSession({ email });
    closeLoginModal();
    location.reload();
  });

  document.getElementById('loginSubmitBtn')?.addEventListener('click', () => {
    const email = (document.getElementById('loginEmail')?.value || '').trim().toLowerCase();
    const password = document.getElementById('loginPassword')?.value || '';
    const users = getUsers();

    if (!users[email] || users[email].password !== password) {
      showMessage('loginMessage', 'Invalid credentials.', 'error');
      return;
    }

    setSession({ email });
    closeLoginModal();
    location.reload();
  });

  document.getElementById('signupBtn')?.addEventListener('click', () => {
    const name = (document.getElementById('signupName')?.value || '').trim();
    const email = (document.getElementById('signupEmail')?.value || '').trim().toLowerCase();
    const password = document.getElementById('signupPassword')?.value || '';

    if (!name || !email || !password) {
      showMessage('loginMessage', 'Fill all sign-up fields.', 'error');
      return;
    }

    const users = getUsers();
    users[email] = { name, email, password, coins: 0, lastCoinDate: null };
    setUsers(users);
    setSession({ email });
    closeLoginModal();
    location.reload();
  });
}

function spendCoins(amount) {
  const user = getCurrentUser();
  if (!user) return { ok: false, message: 'Please log in first.' };

  ensureDailyReward(user);
  const refreshed = getCurrentUser();
  if ((refreshed.coins || 0) < amount) return { ok: false, message: 'insufficient funds' };

  refreshed.coins -= amount;
  saveUser(refreshed);
  updateGlobalUserUI();
  return { ok: true };
}

function addOrder(order) {
  const orders = getOrders();
  orders.unshift({ ...order, date: new Date().toISOString() });
  setOrders(orders);
}

function initializePurchases() {
  document.querySelectorAll('[data-buy]').forEach((button) => {
    button.addEventListener('click', () => {
      const name = (document.getElementById('buyerName')?.value || '').trim();
      const email = (document.getElementById('buyerEmail')?.value || '').trim().toLowerCase();
      const product = button.dataset.product;
      const cost = Number(button.dataset.cost || 0);

      if (!name || !email) {
        showMessage('purchaseStatus', 'Please enter name and email.', 'error');
        return;
      }

      const paid = spendCoins(cost);
      if (!paid.ok) {
        showMessage('purchaseStatus', paid.message, 'error');
        return;
      }

      addOrder({ name, email, product, cost });
      showMessage('purchaseStatus', `${product} purchased successfully!`, 'success');
    });
  });
}

function isValidVipCode(code) {
  const clean = code.trim().toUpperCase();
  if (VIP_TEXT_CODES.includes(clean)) return true;
  if (/^\d{6}$/.test(clean) && VIP_NUMERIC_CODES.includes(clean)) return true;
  return false;
}

function initializeVipPage() {
  const gate = document.getElementById('vipGate');
  const content = document.getElementById('vipContent');
  if (!gate || !content) return;

  const user = getCurrentUser();
  if (!user) {
    gate.innerHTML = '<p class="error">Please log in first to access VIP.</p>';
    return;
  }

  const vipAccess = getVipAccess();
  if (vipAccess[user.email]) {
    gate.style.display = 'none';
    content.style.display = 'block';
    return;
  }

  document.getElementById('vipUnlockBtn')?.addEventListener('click', () => {
    const enteredCode = document.getElementById('vipCode')?.value || '';
    if (!isValidVipCode(enteredCode)) {
      showMessage('vipMessage', 'Invalid code.', 'error');
      return;
    }

    vipAccess[user.email] = true;
    setVipAccess(vipAccess);
    gate.style.display = 'none';
    content.style.display = 'block';
  });
}

function renderOrders() {
  const body = document.getElementById('ordersBody');
  if (!body) return;

  const rows = getOrders();
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="5">No orders yet.</td></tr>';
    return;
  }

  body.innerHTML = rows
    .map(
      (order) => `
      <tr>
        <td>${new Date(order.date).toLocaleString()}</td>
        <td>${order.product}</td>
        <td>${order.name}</td>
        <td>${order.email}</td>
        <td>${order.cost}</td>
      </tr>
    `
    )
    .join('');
}

function initializeAdminPage() {
  const loginSection = document.getElementById('adminLogin');
  const portalSection = document.getElementById('adminPortal');
  if (!loginSection || !portalSection) return;

  document.getElementById('adminLoginBtn')?.addEventListener('click', () => {
    const email = (document.getElementById('adminEmail')?.value || '').trim().toLowerCase();
    const password = document.getElementById('adminPassword')?.value || '';

    if (email !== ADMIN_CREDENTIALS.email || password !== ADMIN_CREDENTIALS.password) {
      showMessage('adminMsg', 'Invalid admin credentials.', 'error');
      return;
    }

    loginSection.style.display = 'none';
    portalSection.style.display = 'block';
    renderOrders();
  });

  document.getElementById('addCoinsBtn')?.addEventListener('click', () => {
    const email = (document.getElementById('coinEmail')?.value || '').trim().toLowerCase();
    const amount = Number(document.getElementById('coinAmount')?.value || 0);
    const users = getUsers();

    if (!users[email]) {
      showMessage('coinMsg', 'User not found.', 'error');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      showMessage('coinMsg', 'Enter a valid amount.', 'error');
      return;
    }

    users[email].coins = (users[email].coins || 0) + amount;
    setUsers(users);
    showMessage('coinMsg', `Added ${amount} coins to ${email}.`, 'success');
    updateGlobalUserUI();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  updateGlobalUserUI();
  initializeLogin();
  initializePurchases();
  initializeVipPage();
  initializeAdminPage();
});
