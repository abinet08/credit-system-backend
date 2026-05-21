// Configuration – change this to your Render backend URL after deployment
const API_URL = 'http://localhost:5000/api';

// Helper functions
function getToken() { return localStorage.getItem('token'); }
function setToken(token) { localStorage.setItem('token', token); }
function getUser() { return JSON.parse(localStorage.getItem('user') || '{}'); }
function setUser(user) { localStorage.setItem('user', JSON.stringify(user)); }

// Page-specific initialization
if (window.location.pathname.includes('dashboard.html')) {
  if (!getToken()) window.location.href = 'index.html';
  loadDashboard();
  document.getElementById('logoutBtn').onclick = logout;
  document.getElementById('updateForm').addEventListener('submit', updateProfile);
} else if (window.location.pathname.includes('admin.html')) {
  if (!getToken()) window.location.href = 'index.html';
  const user = getUser();
  if (!user.isAdmin) window.location.href = 'dashboard.html';
  loadAdmin();
  document.getElementById('logoutBtn').onclick = logout;
} else if (window.location.pathname.includes('index.html') || window.location.pathname === '/' || window.location.pathname === '') {
  document.getElementById('loginBtn').onclick = login;
  document.getElementById('registerBtn').onclick = register;
}

async function login() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  try {
    const res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok) {
      setToken(data.token);
      setUser(data.user);
      window.location.href = data.user.isAdmin ? 'admin.html' : 'dashboard.html';
    } else {
      document.getElementById('message').innerText = data.error;
    }
  } catch (err) {
    document.getElementById('message').innerText = 'Network error: ' + err.message;
  }
}

async function register() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  try {
    const res = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok) {
      setToken(data.token);
      setUser(data.user);
      window.location.href = 'dashboard.html';
    } else {
      document.getElementById('message').innerText = data.error;
    }
  } catch (err) {
    document.getElementById('message').innerText = 'Network error: ' + err.message;
  }
}

function logout() {
  localStorage.clear();
  window.location.href = 'index.html';
}

let historyChart = null; // To destroy previous chart

async function loadDashboard() {
  try {
    const profileRes = await fetch(`${API_URL}/profile`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    if (!profileRes.ok) throw new Error('Failed to load profile');
    const profile = await profileRes.json();
    
    document.getElementById('scoreValue').innerText = profile.score;
    document.getElementById('scoreRating').innerText = profile.rating;
    const percent = ((profile.score - 300) / 550) * 100;
    document.getElementById('scoreBar').style.width = `${percent}%`;
    document.getElementById('userName').innerText = getUser().username;
    
    // Factors breakdown
    const factors = [
      { label: 'Payment History', value: profile.payment_history, max: 100, weight: 35, invert: false },
      { label: 'Credit Utilization', value: profile.utilization, max: 100, weight: 30, invert: true },
      { label: 'Credit Age (years)', value: profile.credit_age_years, max: 25, weight: 15, invert: false },
      { label: 'Credit Mix', value: profile.credit_mix_score, max: 100, weight: 10, invert: false },
      { label: 'New Inquiries', value: profile.new_credit_inquiries, max: 10, weight: 10, invert: true }
    ];
    const factorsDiv = document.getElementById('factorsList');
    factorsDiv.innerHTML = factors.map(f => {
      let rawContribution = (f.value / f.max) * f.weight * 850;
      if (f.invert) rawContribution = (1 - f.value / f.max) * f.weight * 850;
      const contribution = Math.min(850, Math.max(0, rawContribution));
      return `
        <div>
          <div class="flex justify-between"><span>${f.label}</span><span>${f.value}${f.label.includes('years') ? ' yrs' : ''}</span></div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div class="bg-purple-600 h-2 rounded-full" style="width: ${(f.value / f.max) * 100}%"></div>
          </div>
          <div class="text-xs text-gray-500">Contributes ~${Math.round(contribution)} pts</div>
        </div>
      `;
    }).join('');
    
    // History chart
    const historyRes = await fetch(`${API_URL}/history`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const history = await historyRes.json();
    const ctx = document.getElementById('historyChart').getContext('2d');
    if (historyChart) historyChart.destroy();
    historyChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: history.map(h => new Date(h.recorded_at).toLocaleDateString()),
        datasets: [{ label: 'Credit Score', data: history.map(h => h.score), borderColor: '#9333ea', tension: 0.3 }]
      }
    });
  } catch (err) {
    alert('Error loading dashboard: ' + err.message);
  }
}

async function updateProfile(e) {
  e.preventDefault();
  const fields = ['payment_history', 'utilization', 'credit_age_years', 'credit_mix_score', 'new_credit_inquiries'];
  const body = {};
  fields.forEach(f => {
    const val = document.getElementById(f).value;
    if (val !== '') body[f] = Number(val);
  });
  try {
    const res = await fetch(`${API_URL}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      await loadDashboard();
    } else {
      const err = await res.json();
      alert('Update failed: ' + err.error);
    }
  } catch (err) {
    alert('Network error: ' + err.message);
  }
}

async function loadAdmin() {
  try {
    const res = await fetch(`${API_URL}/admin/users`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const users = await res.json();
    const tbody = document.getElementById('userTable');
    tbody.innerHTML = users.map(u => `
      <tr class="border-b">
        <td class="p-3">${u.id}</td>
        <td class="p-3">${u.username}</td>
        <td class="p-3">${u.isAdmin ? 'Yes' : 'No'}</td>
        <td class="p-3">${u.latest_score || 'N/A'}</td>
      </tr>
    `).join('');
  } catch (err) {
    alert('Failed to load admin data: ' + err.message);
  }
}