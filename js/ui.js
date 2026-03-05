// js/ui.js
import { state, savePrefs, SK } from './state.js';
import { loadTrack, removeTrack, setPlaying } from './player.js';
import { openPremium, openAuthModal, doLogout } from './auth.js';

export function applyPrefs() {
    const p = JSON.parse(localStorage.getItem(SK.PREFS) || '{}');
    if (p.dark === false) document.documentElement.classList.remove('dark');

    // Defer volume setting slightly because `audio` might not be loaded yet,
    // or we can handle it in player.js.
}

export function toggleTheme() {
    const dark = document.documentElement.classList.toggle('dark');
    document.getElementById('theme-btn').textContent = dark ? '🌙' : '☀️';
    savePrefs({ dark });
}

export function showEmpty() {
    document.getElementById('empty-player').classList.remove('hidden');
    document.getElementById('now-playing').classList.add('hidden');
}

export function updatePlaylistInfo() {
    const count = state.tracks.length;
    const total = state.tracks.reduce((s, t) => s + t.duration, 0);
    document.getElementById('track-count').textContent = `${count} música${count !== 1 ? 's' : ''}`;
    document.getElementById('playlist-info').textContent = count ? `${count} faixa${count !== 1 ? 's' : ''} • ${fmtTime(total)}` : 'Playlist vazia';
}

export function renderTrackList(filter = '', isLoading = false) {
    const list = document.getElementById('track-list');
    const dz = document.getElementById('drop-zone');

    if (isLoading) {
        dz.style.display = 'none';
        list.innerHTML = Array.from({ length: 5 }).map(() => `
            <div class="track-row rounded-xl px-3 py-2.5 flex items-center gap-3 animate-pulse">
                <div class="flex-shrink-0 w-9 h-9 rounded-lg bg-white/5"></div>
                <div class="flex-1 min-w-0 space-y-2">
                    <div class="h-3.5 bg-white/10 rounded w-3/4"></div>
                    <div class="h-2.5 bg-white/5 rounded w-1/2"></div>
                </div>
                <div class="w-8 h-3 bg-white/5 rounded"></div>
            </div>`).join('');
        return;
    }

    if (!state.tracks.length) {
        dz.style.display = '';
        list.innerHTML = '';
        list.appendChild(dz);
        return;
    }
    dz.style.display = 'none';
    const q = filter.toLowerCase();
    const filtered = state.tracks.map((t, i) => ({ ...t, i })).filter(t => !q || t.name.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q));

    const highlight = (text, query) => {
        if (!query) return text;
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<span class="text-yellow-400 font-bold">$1</span>');
    };

    list.innerHTML = filtered.map(t => `
        <div class="track-row rounded-xl px-3 py-2.5 flex items-center gap-3 ${t.i === state.currentIdx ? 'active' : ''}" onclick="window.mf_loadTrack(${t.i})" role="button" tabindex="0" aria-label="${t.name}">
        <div class="flex-shrink-0 w-9 h-9 rounded-lg bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold text-sm">${t.i === state.currentIdx ? (state.isPlaying ? '▶' : '❚❚') : (t.i + 1)}</div>
        <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate ${t.i === state.currentIdx ? 'text-primary-300' : 'text-white'}">${highlight(t.name, filter)}</div>
            <div class="text-xs text-gray-500 truncate">${highlight(t.artist, filter)}</div>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
            <span class="text-xs text-gray-500">${fmtTime(t.duration)}</span>
            <button onclick="window.mf_removeTrack(event,${t.i})" class="text-gray-600 hover:text-red-400 transition text-sm" aria-label="Remover">✕</button>
        </div>
        </div>`).join('');

    setTimeout(() => {
        const active = list.querySelector('.active');
        if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 50);
}

export function drawCover(name) {
    const canvas = document.getElementById('art-canvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    let hash = 0; for (const c of name) hash = ((hash << 5) - hash) + c.charCodeAt(0);
    const h1 = Math.abs(hash % 360);
    const h2 = (h1 + 120) % 360;
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, `hsl(${h1},70%,35%)`);
    grad.addColorStop(1, `hsl(${h2},80%,25%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.font = `${W * 0.35}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#fff';
    ctx.fillText('♪', W / 2 + 10, H / 2 + 10);
    ctx.globalAlpha = 1;

    ctx.font = `bold ${W * 0.18}px Inter, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(name.slice(0, 2).toUpperCase(), W / 2, H / 2);
}

export function drawVisualizer(analyserNode, isPlaying) {
    const canvas = document.getElementById('visualizer');
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    const W = canvas.offsetWidth, H = canvas.offsetHeight;
    const bufLen = analyserNode ? analyserNode.frequencyBinCount : 128;
    const dataArr = new Uint8Array(bufLen);

    function draw() {
        state.animFrame = requestAnimationFrame(draw);
        ctx.clearRect(0, 0, W, H);
        if (analyserNode && state.isPlaying) {
            analyserNode.getByteFrequencyData(dataArr);
        } else {
            dataArr.fill(0);
        }
        const barW = (W / bufLen) * 2.2;
        let x = 0;
        for (let i = 0; i < bufLen; i++) {
            const v = dataArr[i] / 255;
            const h = v * H;
            const grad = ctx.createLinearGradient(0, H - h, 0, H);
            grad.addColorStop(0, 'rgba(236,72,153,0.9)');
            grad.addColorStop(1, 'rgba(139,92,246,0.7)');
            ctx.fillStyle = grad;
            ctx.fillRect(x, H - h, barW - 1, h);
            x += barW;
        }
    }
    if (state.animFrame) cancelAnimationFrame(state.animFrame);
    draw();
}

export function fillProfile() {
    const u = JSON.parse(localStorage.getItem(SK.USER) || '{}');
    const stats = JSON.parse(localStorage.getItem(SK.STATS) || '{}');
    document.getElementById('p-avatar').src = u.avatar || '';
    document.getElementById('p-name').textContent = u.name || '';
    document.getElementById('p-email').textContent = u.email || '';
    document.getElementById('p-plan-badge').textContent = u.plan === 'premium' ? '⭐ Premium' : 'Plano Free';
    document.getElementById('p-tracks').textContent = state.tracks.length;
    const hrs = Math.floor((stats.secs || 0) / 3600);
    document.getElementById('p-time').textContent = hrs + 'h';
    document.getElementById('p-days').textContent = u.trialDays || 0;
}

export function renderUserNav(user) {
    document.getElementById('user-nav-slot')?.remove();
    const header = document.querySelector('header .flex.items-center.gap-3:last-child');
    if (!header) return;
    const slot = document.createElement('div');
    slot.id = 'user-nav-slot';
    slot.className = 'flex items-center gap-2';
    if (user) {
        slot.innerHTML = `
        <button onclick="window.mf_openPremium()" class="hidden md:flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition font-semibold">👑 Premium</button>
        <button onclick="window.mf_openAuthModal('profile')" class="flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-white/10 transition">
        <img src="${user.avatar}" class="w-8 h-8 rounded-full ring-2 ring-primary-500" alt="${user.name}"/>
        <span class="hidden md:block text-sm font-medium">${user.name.split(' ')[0]}</span>
        </button>`;
    } else {
        slot.innerHTML = `
        <button onclick="window.mf_openAuthModal('login')" class="px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-white/10 transition">Entrar</button>
        <button onclick="window.mf_openAuthModal('register')" class="px-4 py-1.5 text-sm font-semibold rounded-xl bg-primary-600 hover:bg-primary-700 transition">Começar grátis</button>`;
    }
    header.insertBefore(slot, header.firstChild);
}

const toastQueue = [];
let isToasting = false;

export function toast(msg, type = 'info', action = null) {
    toastQueue.push({ msg, type, action });
    processToastQueue();
}

function processToastQueue() {
    if (isToasting || toastQueue.length === 0) return;
    isToasting = true;

    const { msg, type, action } = toastQueue.shift();
    const colors = { success: 'rgba(22,163,74,.88)', error: 'rgba(220,38,38,.88)', info: 'rgba(124,58,237,.88)', warning: 'rgba(217,119,6,.88)' };
    const t = document.createElement('div');
    t.className = 'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium shadow-xl animate-slide-up transition-all duration-300';
    t.style.cssText = `background:${colors[type] || colors.info};min-width:220px;backdrop-filter:blur(12px)`;

    let actionHtml = '';
    if (action) {
        actionHtml = `<button class="text-yellow-300 hover:text-yellow-100 font-bold ml-2 text-xs uppercase" onclick="this.parentElement.dataset.act=1">Desfazer</button>`;
    }

    t.innerHTML = `<span class="flex-1">${msg}</span>${actionHtml}<button onclick="this.parentElement.remove()" class="opacity-60 hover:opacity-100 text-lg leading-none">×</button>`;
    document.getElementById('toast-container').appendChild(t);

    if (action) {
        t.addEventListener('click', (e) => {
            if (t.dataset.act === '1') {
                action.callback();
                t.remove();
            }
        });
    }

    setTimeout(() => {
        if (t && t.parentElement) {
            t.style.opacity = '0';
            t.style.transform = 'translateY(100%)';
            setTimeout(() => { t.remove(); isToasting = false; processToastQueue(); }, 300);
        } else {
            isToasting = false;
            processToastQueue();
        }
    }, 3500);
}

export function fmtTime(s) {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
}

export function showShortcuts() { document.getElementById('shortcuts-modal').classList.remove('hidden'); }
export function closeShortcuts() { document.getElementById('shortcuts-modal').classList.add('hidden'); }
