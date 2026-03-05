// js/main.js
import { loadUser } from './state.js';
import { applyPrefs, toggleTheme, showShortcuts, closeShortcuts, renderUserNav, toast } from './ui.js';
import { openAuthModal, closeAuthModal, switchAuth, toggleVis, doLogin, doRegister, doLogout, openPremium, closePremium, selectPlan, activatePremium, initAuth } from './auth.js';
import { loadTrack, togglePlay, nextTrack, prevTrack, toggleShuffle, cycleRepeat, toggleMute, removeTrack, clearPlaylist, sortPlaylist, addFiles, exportPlaylist, initAudioEvents, getAudio, restoreAudioCache } from './player.js';

// Attach to window so HTML templates can access them
window.toggleTheme = toggleTheme;
window.mf_openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.switchAuth = switchAuth;
window.toggleVis = toggleVis;
window.doLogin = doLogin;
window.doRegister = doRegister;
window.doLogout = doLogout;
window.mf_openPremium = openPremium;
window.closePremium = closePremium;
window.selectPlan = selectPlan;
window.activatePremium = activatePremium;

window.togglePlay = togglePlay;
window.nextTrack = nextTrack;
window.prevTrack = prevTrack;
window.toggleShuffle = toggleShuffle;
window.cycleRepeat = cycleRepeat;
window.toggleMute = toggleMute;

window.mf_loadTrack = loadTrack;
window.mf_removeTrack = removeTrack;
window.clearPlaylist = clearPlaylist;
window.sortPlaylist = sortPlaylist;
window.exportPlaylist = exportPlaylist;

import { setPlaybackRate, skipSilence } from './player.js';
window.setPlaybackRate = setPlaybackRate;
window.skipSilence = skipSilence;

window.showShortcuts = showShortcuts;
window.closeShortcuts = closeShortcuts;

function initFileInput() {
    document.getElementById('file-input').addEventListener('change', e => addFiles(e.target.files));
}

function initDropZone() {
    const body = document.body;
    body.addEventListener('dragover', e => { e.preventDefault(); document.getElementById('drop-zone')?.classList.add('drag-over'); });
    body.addEventListener('dragleave', e => { if (!e.relatedTarget) document.getElementById('drop-zone')?.classList.remove('drag-over'); });
    body.addEventListener('drop', e => {
        e.preventDefault();
        document.getElementById('drop-zone')?.classList.remove('drag-over');
        const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('audio/'));
        if (files.length) addFiles(files);
        else toast('⚠️ Nenhum arquivo de áudio detectado', 'warning');
    });
    document.getElementById('drop-zone').addEventListener('click', () => document.getElementById('file-input').click());
}

function initKeyboard() {
    document.addEventListener('keydown', e => {
        const tag = document.activeElement.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        switch (e.key) {
            case ' ': e.preventDefault(); togglePlay(); break;
            case 'ArrowRight': nextTrack(); break;
            case 'ArrowLeft': prevTrack(); break;
            case 'ArrowUp':
                e.preventDefault();
                const volEl = document.getElementById('volume');
                volEl.value = Math.min(100, +volEl.value + 5);
                volEl.dispatchEvent(new Event('input'));
                break;
            case 'ArrowDown':
                e.preventDefault();
                const volEl2 = document.getElementById('volume');
                volEl2.value = Math.max(0, +volEl2.value - 5);
                volEl2.dispatchEvent(new Event('input'));
                break;
            case 'm': case 'M': toggleMute(); break;
            case 's': case 'S': toggleShuffle(); break;
            case 'r': case 'R': cycleRepeat(); break;
            case 'l': case 'L':
                const aud1 = getAudio();
                if (aud1.duration) aud1.currentTime = Math.min(aud1.duration, aud1.currentTime + 10);
                break;
            case 'j': case 'J':
                const aud2 = getAudio();
                if (aud2.duration) aud2.currentTime = Math.max(0, aud2.currentTime - 10);
                break;
            case 'Escape': closeAuthModal(); closePremium(); closeShortcuts(); break;
        }
    });
}

function initProgressBar() {
    const progressEl = document.getElementById('progress');
    progressEl.addEventListener('input', () => {
        const aud = getAudio();
        if (aud.duration) aud.currentTime = (progressEl.value / 100) * aud.duration;
    });
}

function initVolumeBar() {
    const volEl = document.getElementById('volume');
    volEl.addEventListener('input', () => {
        const v = parseInt(volEl.value);
        const aud = getAudio();
        aud.volume = v / 100; aud.muted = false;
        document.getElementById('vol-pct').textContent = v + '%';
        document.getElementById('vol-icon').textContent = v === 0 ? '🔇' : v < 50 ? '🔉' : '🔊';

        let p = JSON.parse(localStorage.getItem('mf_prefs') || '{}');
        p.vol = v;
        localStorage.setItem('mf_prefs', JSON.stringify(p));
    });
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function initSearch() {
    const input = document.getElementById('search-input');
    if (input) {
        import('./ui.js').then(module => {
            const debouncedSearch = debounce((query) => {
                module.renderTrackList(query, false);
            }, 300);

            input.addEventListener('input', e => {
                // Ao digitar, mostramos o skeleton imediatamente
                module.renderTrackList(e.target.value, true);
                debouncedSearch(e.target.value);
            });
        });
    }
}

function initMiniPlayer() {
    const audioEl = document.getElementById('now-playing');
    if (!audioEl) return;
    const audioView = document.getElementById('audio-view');

    // Check main container scroll
    audioView.addEventListener('scroll', () => {
        if (audioView.scrollTop > 300) {
            audioEl.classList.add('fixed', 'bottom-4', 'right-4', 'w-80', 'shadow-2xl', 'z-50');
            audioEl.classList.remove('w-full', 'max-w-2xl', 'mt-8');
        } else {
            audioEl.classList.remove('fixed', 'bottom-4', 'right-4', 'w-80', 'shadow-2xl', 'z-50');
            audioEl.classList.add('w-full', 'max-w-2xl', 'mt-8');
        }
    });
}

function init() {
    applyPrefs();
    const u = loadUser();
    renderUserNav(u);
    restoreAudioCache();
    initDropZone();
    initFileInput();
    initAudioEvents();
    initProgressBar();
    initVolumeBar();
    initKeyboard();
    initAuth();
    initSearch();
    initMiniPlayer();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW falhou:', err));
    }
}

document.addEventListener('DOMContentLoaded', init);
