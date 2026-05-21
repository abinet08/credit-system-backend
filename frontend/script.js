// Configuration – replace with your deployed backend URL
const API_URL = 'https://credit-system-backend-production-b885.up.railway.app/api';   // Change to Render URL later

// Helper functions
function getToken() { return localStorage.getItem('token'); }
function setToken(token) { localStorage.setItem('token', token); }
function getUser() { return JSON.parse(localStorage.getItem('user') || '{}'); }
function setUser(user) { localStorage.setItem('user', JSON.stringify(user)); }

// Page detection
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
} else {
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    if (loginBtn) loginBtn.onclick = login;
    if (registerBtn) registerBtn.onclick = register;
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

let historyChart = null;

async function loadDashboard() {
    try {
        const profileRes = await fetch(`${API_URL}/profile`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (!profileRes.ok) throw new Error('Failed to load profile');
        const profile = await profileRes.json();
        
        // Update score and rating
        document.getElementById('scoreValue').innerText = profile.score;
        const ratingSpan = document.getElementById('scoreRating');
        ratingSpan.innerText = profile.rating;
        // color rating
        const rating = profile.rating;
        if (rating === 'Exceptional') ratingSpan.className = "text-sm font-medium px-3 py-1 rounded-full bg-green-100 text-green-800 mt-2";
        else if (rating === 'Very Good') ratingSpan.className = "text-sm font-medium px-3 py-1 rounded-full bg-blue-100 text-blue-800 mt-2";
        else if (rating === 'Good') ratingSpan.className = "text-sm font-medium px-3 py-1 rounded-full bg-teal-100 text-teal-800 mt-2";
        else if (rating === 'Fair') ratingSpan.className = "text-sm font-medium px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 mt-2";
        else ratingSpan.className = "text-sm font-medium px-3 py-1 rounded-full bg-red-100 text-red-800 mt-2";
        
        // Update gauge circle
        const percent = (profile.score - 300) / 550; // 0 to 1
        const dashArray = 502;
        const dashOffset = dashArray * (1 - percent);
        const circle = document.getElementById('scoreArc');
        if (circle) circle.style.strokeDashoffset = dashOffset;
        
        // Update quick stats
        document.getElementById('creditAge').innerText = profile.credit_age_years + ' yrs';
        document.getElementById('utilization').innerText = profile.utilization + '%';
        document.getElementById('paymentHistory').innerText = profile.payment_history + '%';
        document.getElementById('inquiries').innerText = profile.new_credit_inquiries;
        
        // Factor breakdown with bars
        const factors = [
            { label: 'Payment History', value: profile.payment_history, max: 100, weight: 35, invert: false, desc: 'On-time payments boost score.' },
            { label: 'Credit Utilization', value: profile.utilization, max: 100, weight: 30, invert: true, desc: 'Lower utilization (<30%) is better.' },
            { label: 'Credit Age', value: profile.credit_age_years, max: 25, weight: 15, invert: false, desc: 'Older accounts improve stability.' },
            { label: 'Credit Mix', value: profile.credit_mix_score, max: 100, weight: 10, invert: false, desc: 'Variety of credit types helps.' },
            { label: 'New Inquiries', value: profile.new_credit_inquiries, max: 10, weight: 10, invert: true, desc: 'Too many inquiries hurt score.' }
        ];
        const factorsDiv = document.getElementById('factorsList');
        factorsDiv.innerHTML = factors.map(f => {
            let contribution = (f.value / f.max) * f.weight * 5.5; // approx points
            if (f.invert) contribution = ((f.max - f.value) / f.max) * f.weight * 5.5;
            contribution = Math.min(85, Math.max(0, contribution));
            const barWidth = (f.value / f.max) * 100;
            return `
                <div>
                    <div class="flex justify-between text-sm">
                        <span class="font-medium">${f.label}</span>
                        <span class="text-gray-600">${f.value}${f.label.includes('Age') ? ' yrs' : (f.label.includes('Utilization') ? '%' : '')}</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                        <div class="bg-purple-600 h-2.5 rounded-full factor-bar" style="width: ${barWidth}%"></div>
                    </div>
                    <div class="flex justify-between text-xs text-gray-400 mt-1">
                        <span>${f.desc}</span>
                        <span>~${Math.round(contribution)} pts</span>
                    </div>
                </div>
            `;
        }).join('');
        
        // Load history chart
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
                datasets: [{
                    label: 'Credit Score',
                    data: history.map(h => h.score),
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.05)',
                    fill: true,
                    tension: 0.3,
                    pointBackgroundColor: '#6d28d9',
                    pointBorderColor: 'white',
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { position: 'top' } },
                scales: { y: { min: 300, max: 850, title: { display: true, text: 'Score' } } }
            }
        });
    } catch (err) {
        alert('Error: ' + err.message);
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
            // Clear form inputs after update
            fields.forEach(f => document.getElementById(f).value = '');
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
            <tr class="table-row">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${u.id}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${u.username}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">${u.isAdmin ? '<span class="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">Admin</span>' : 'User'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-bold ${u.latest_score >= 670 ? 'text-green-600' : 'text-red-500'}">${u.latest_score || 'N/A'}</td>
            </tr>
        `).join('');
    } catch (err) {
        alert('Admin load error: ' + err.message);
    }
}
