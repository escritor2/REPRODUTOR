// js/state.js

export const SK = { USER: 'mf_user', PREFS: 'mf_prefs', STATS: 'mf_stats' };

export const state = {
    tracks: [],
    currentIdx: -1,
    isPlaying: false,
    isShuffle: false,
    repeatMode: 0,
    isMuted: false,
    prevVol: 80,
    shuffleHistory: [],
    totalListenSecs: 0,
    statsInterval: null,
};

export function saveStats() {
    const s = JSON.parse(localStorage.getItem(SK.STATS) || '{}');
    s.secs = (s.secs || 0) + 1;
    localStorage.setItem(SK.STATS, JSON.stringify(s));
}

export function savePrefs(patch) {
    const p = JSON.parse(localStorage.getItem(SK.PREFS) || '{}');
    localStorage.setItem(SK.PREFS, JSON.stringify({ ...p, ...patch }));
}

export function loadPrefs() {
    return JSON.parse(localStorage.getItem(SK.PREFS) || '{}');
}

export function loadUser() {
    return JSON.parse(localStorage.getItem(SK.USER) || 'null');
}
