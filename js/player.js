// js/player.js
import { state, saveStats, SK, savePrefs } from './state.js';
import { drawCover, renderTrackList, updatePlaylistInfo, toast, showEmpty, drawVisualizer, fmtTime } from './ui.js';
import { db } from './db.js';
import { Equalizer } from './equalizer.js';

let audio;
export function getAudio() {
    if (!audio) audio = document.getElementById('audio-player');
    return audio;
}

export function loadTrack(idx) {
    if (!state.tracks.length || idx < 0 || idx >= state.tracks.length) return;
    const aud = getAudio();
    state.currentIdx = idx;
    const t = state.tracks[idx];
    aud.src = t.url;
    aud.load();
    aud.play().then(() => setPlaying(true)).catch(() => { });

    document.getElementById('now-title').textContent = t.name;
    document.getElementById('now-artist').textContent = t.artist || 'Artista Desconhecido';
    document.getElementById('empty-player').classList.add('hidden');
    document.getElementById('now-playing').classList.remove('hidden');

    drawCover(t.name);
    renderTrackList(document.getElementById('search-input')?.value || '');

    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({ title: t.name, artist: t.artist, album: 'MusicFlow' });
        navigator.mediaSession.setActionHandler('previoustrack', prevTrack);
        navigator.mediaSession.setActionHandler('nexttrack', nextTrack);
        navigator.mediaSession.setActionHandler('play', () => aud.play());
        navigator.mediaSession.setActionHandler('pause', () => aud.pause());
    }

    initWebAudio();
}

export function setPlaying(val) {
    state.isPlaying = val;
    document.getElementById('icon-play').classList.toggle('hidden', val);
    document.getElementById('icon-pause').classList.toggle('hidden', !val);
    const art = document.getElementById('art-canvas');
    art.classList.toggle('paused', !val);
    const eq = document.getElementById('eq-indicator');
    eq.style.opacity = val ? '1' : '0';
    eq.classList.toggle('playing', val);

    // Basic analytics tracking
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: val ? 'track_play' : 'track_pause', track: state.tracks[state.currentIdx]?.name });

    if (val) {
        state.statsInterval = state.statsInterval || setInterval(() => {
            state.totalListenSecs++;
            saveStats();
        }, 1000);
    } else {
        clearInterval(state.statsInterval);
        state.statsInterval = null;
    }
}

export function togglePlay() {
    if (!state.tracks.length) return;
    const aud = getAudio();
    if (state.isPlaying) {
        aud.pause();
        db.put('playbackPositions', { id: state.tracks[state.currentIdx]?.id || 'last', time: aud.currentTime });
    } else {
        aud.play();
    }
}

export function setPlaybackRate(rate) {
    const aud = getAudio();
    aud.playbackRate = rate;
    toast(`Velocidade: ${rate}x`, 'info');
}

export function skipSilence(enabled) {
    // Implementação simplificada: analisar volume via analyserNode no requestAnimationFrame,
    // será feito um pollyfil futuramente se o usuário desejar pular partes silenciosas.
    toast(enabled ? 'Pular silêncio ativado' : 'Pular silêncio desativado', 'info');
}

export function nextTrack() {
    if (!state.tracks.length) return;
    if (state.isShuffle) {
        let n;
        do { n = Math.floor(Math.random() * state.tracks.length); }
        while (n === state.currentIdx && state.tracks.length > 1);
        loadTrack(n);
    }
    else { loadTrack((state.currentIdx + 1) % state.tracks.length); }
}

export function prevTrack() {
    if (!state.tracks.length) return;
    const aud = getAudio();
    if (aud.currentTime > 3) { aud.currentTime = 0; return; }
    loadTrack((state.currentIdx - 1 + state.tracks.length) % state.tracks.length);
}

export function toggleShuffle() {
    state.isShuffle = !state.isShuffle;
    document.getElementById('btn-shuffle').classList.toggle('text-primary-400', state.isShuffle);
    document.getElementById('btn-shuffle').classList.toggle('text-gray-400', !state.isShuffle);
    toast(state.isShuffle ? '🔀 Aleatório ativado' : '🔀 Aleatório desativado', 'info');
}

export function cycleRepeat() {
    state.repeatMode = (state.repeatMode + 1) % 3;
    const btn = document.getElementById('btn-repeat');
    const badge = document.getElementById('repeat-badge');
    btn.classList.toggle('text-primary-400', state.repeatMode > 0);
    btn.classList.toggle('text-gray-400', state.repeatMode === 0);
    badge.classList.toggle('hidden', state.repeatMode !== 2);
    const msgs = ['🔁 Repetição desativada', '🔁 Repetir tudo', '🔂 Repetir esta'];
    toast(msgs[state.repeatMode], 'info');
}

export function toggleMute() {
    state.isMuted = !state.isMuted;
    const aud = getAudio();
    aud.muted = state.isMuted;
    document.getElementById('vol-icon').textContent = state.isMuted ? '🔇' : (aud.volume > 0.5 ? '🔊' : '🔉');
}

export function initAudioEvents() {
    const aud = getAudio();
    const progressEl = document.getElementById('progress');

    aud.addEventListener('play', () => setPlaying(true));
    aud.addEventListener('pause', () => setPlaying(false));
    aud.addEventListener('ended', () => {
        if (state.repeatMode === 2) { aud.currentTime = 0; aud.play(); return; }
        nextTrack();
    });
    let lastSaveTime = 0;
    aud.addEventListener('timeupdate', () => {
        if (!aud.duration) return;
        const pct = (aud.currentTime / aud.duration) * 100;
        progressEl.value = pct;
        progressEl.style.background = `linear-gradient(to right, #8b5cf6 ${pct}%, rgba(255,255,255,.15) ${pct}%)`;
        document.getElementById('time-current').textContent = fmtTime(aud.currentTime);
        document.getElementById('time-total').textContent = fmtTime(aud.duration);

        // Persistência de tempo a cada 5 segundos
        if (Math.abs(aud.currentTime - lastSaveTime) > 5) {
            lastSaveTime = aud.currentTime;
            db.put('playbackPositions', { id: state.tracks[state.currentIdx]?.id || 'last', time: aud.currentTime });
        }
    });

    aud.addEventListener('loadedmetadata', async () => {
        document.getElementById('time-total').textContent = fmtTime(aud.duration);
        if (state.tracks[state.currentIdx]) state.tracks[state.currentIdx].duration = aud.duration;
        updatePlaylistInfo();

        // Recuperar persistência de tempo
        try {
            const saved = await db.get('playbackPositions', state.tracks[state.currentIdx]?.id || 'last');
            if (saved && saved.time < aud.duration - 2) {
                aud.currentTime = saved.time;
            }
        } catch (e) { }
    });
    aud.addEventListener('error', () => toast('❌ Erro ao reproduzir arquivo', 'error'));
}

export function removeTrack(e, idx) {
    if (e) e.stopPropagation();
    const trk = state.tracks[idx];
    URL.revokeObjectURL(trk.url);
    if (trk.id) db.delete('audioCache', trk.id);

    state.tracks.splice(idx, 1);
    const aud = getAudio();
    if (state.currentIdx === idx) {
        aud.pause();
        setPlaying(false);
        state.currentIdx = Math.min(idx, state.tracks.length - 1);
        if (state.tracks.length) loadTrack(state.currentIdx); else showEmpty();
    }
    else if (state.currentIdx > idx) state.currentIdx--;
    renderTrackList();
    updatePlaylistInfo();
}

export function clearPlaylist() {
    state.tracks.forEach(t => { URL.revokeObjectURL(t.url); if (t.id) db.delete('audioCache', t.id); });
    state.tracks = [];
    state.currentIdx = -1;
    const aud = getAudio();
    aud.pause();
    setPlaying(false);
    renderTrackList();
    showEmpty();
    updatePlaylistInfo();
    toast('🗑 Playlist limpa', 'info');
}

export function sortPlaylist(by) {
    state.tracks.sort((a, b) => by === 'name' ? a.name.localeCompare(b.name) : a.artist.localeCompare(b.artist));
    renderTrackList();
    toast('↕ Playlist ordenada', 'info');
}

export function addFiles(files) {
    const arr = Array.from(files).filter(f => f.type.startsWith('audio/') || /\.(mp3|wav|flac|ogg|aac|m4a|opus)$/i.test(f.name));
    if (!arr.length) { toast('Nenhum áudio encontrado', 'warning'); return; }
    const prev = state.tracks.length;
    arr.forEach(async file => {
        const id = crypto.randomUUID();
        const url = URL.createObjectURL(file);
        const name = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');

        const parts = name.split(' - ');
        const title = parts.length > 1 ? parts.slice(1).join(' - ').trim() : name;
        const artist = parts.length > 1 ? parts[0].trim() : 'Desconhecido';

        const trackObj = { id, name: title, artist, duration: 0, url, size: file.size, file };
        state.tracks.push(trackObj);

        // Salva cache local
        await db.put('audioCache', { id, file, name: title, artist, size: file.size, lastAccessed: Date.now() });
        await db.enforceCacheLimit(50);

        const tmp = new Audio(); tmp.src = url;
        const idx = state.tracks.length - 1;
        tmp.addEventListener('loadedmetadata', () => { state.tracks[idx].duration = tmp.duration; renderTrackList(); });
    });
    renderTrackList();
    updatePlaylistInfo();
    toast(`✅ ${arr.length} música(s) adicionada(s)`, 'success');
    if (prev === 0 && state.tracks.length > 0) loadTrack(0);
}

export function exportPlaylist() {
    const data = { exportedAt: new Date().toISOString(), tracks: state.tracks.map(t => ({ name: t.name, artist: t.artist, duration: fmtTime(t.duration), size: t.size })) };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'musicflow-playlist.json'; a.click();
    toast('📥 Playlist exportada!', 'success');
}

export async function restoreAudioCache() {
    try {
        const cachedFiles = await db.getAll('audioCache');
        if (cachedFiles && cachedFiles.length > 0) {
            cachedFiles.forEach(c => {
                if (c.file) {
                    const url = URL.createObjectURL(c.file);
                    state.tracks.push({ id: c.id, name: c.name, artist: c.artist, duration: 0, url, size: c.size, file: c.file });

                    const tmp = new Audio(); tmp.src = url;
                    const idx = state.tracks.length - 1;
                    tmp.addEventListener('loadedmetadata', () => { state.tracks[idx].duration = tmp.duration; renderTrackList(); updatePlaylistInfo(); });
                }
            });
            renderTrackList();
            updatePlaylistInfo();
        }
    } catch (err) {
        console.warn('Erro ao restaurar cache', err);
    }
}

export let audioCtx = null, analyserNode = null, sourceNode = null, equalizer = null;

export function initWebAudio() {
    const aud = getAudio();
    if (sourceNode) { try { sourceNode.disconnect(); } catch (_) { } }
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        equalizer = new Equalizer(audioCtx);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    analyserNode = audioCtx.createAnalyser();
    analyserNode.fftSize = 256;
    sourceNode = audioCtx.createMediaElementSource(aud);

    // Conecta a fonte ao Equalizador, depois ao Analisador, e ao destino final
    sourceNode.connect(equalizer.filters[0]);
    equalizer.filters[equalizer.filters.length - 1].connect(analyserNode);
    analyserNode.connect(audioCtx.destination);

    drawVisualizer(analyserNode, state.isPlaying);
}
