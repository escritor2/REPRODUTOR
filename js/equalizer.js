// js/equalizer.js
import { db } from './db.js';

const FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export const PRESETS = {
    'Flat': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    'Pop': [-1, 2, 4, 5, 2, -1, -2, -2, 1, 2],
    'Rock': [5, 4, 3, 1, -1, -1, 1, 3, 4, 5],
    'Jazz': [3, 2, 1, 2, -1, -1, 0, 1, 2, 3],
    'Classical': [4, 3, 2, 1, -1, -1, 0, 2, 3, 4]
};

export class Equalizer {
    constructor(audioCtx) {
        this.ctx = audioCtx;
        this.filters = [];
        this.gains = [...PRESETS['Flat']];

        // Cria os 10 filtros Biquad
        FREQUENCIES.forEach((freq, i) => {
            const filter = this.ctx.createBiquadFilter();
            if (i === 0) filter.type = 'lowshelf';
            else if (i === FREQUENCIES.length - 1) filter.type = 'highshelf';
            else filter.type = 'peaking';

            filter.frequency.value = freq;
            filter.gain.value = this.gains[i];

            if (i > 0) {
                this.filters[i - 1].connect(filter);
            }
            this.filters.push(filter);
        });

        this.input = this.filters[0];
        this.output = this.filters[this.filters.length - 1];

        this.loadSettings();
    }

    async loadSettings() {
        try {
            const saved = await db.get('stats', 'eq_settings');
            if (saved && saved.gains) {
                this.setGains(saved.gains);
            }
        } catch (e) { }
    }

    async saveSettings() {
        try {
            await db.put('stats', { id: 'eq_settings', gains: this.gains });
        } catch (e) { }
    }

    setGain(index, value) {
        if (index >= 0 && index < this.filters.length) {
            this.gains[index] = value;
            this.filters[index].gain.value = value;
            this.saveSettings();
        }
    }

    setGains(gainsArr) {
        if (gainsArr.length === this.filters.length) {
            this.gains = [...gainsArr];
            this.filters.forEach((f, i) => {
                f.gain.value = this.gains[i];
            });
            this.saveSettings();
        }
    }

    applyPreset(name) {
        if (PRESETS[name]) {
            this.setGains(PRESETS[name]);
        }
    }

    connect(source) {
        source.connect(this.input);
    }
}
