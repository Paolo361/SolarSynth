export function interpolateLinear(xs, ys, newXs) {
    const out = [];
    for (let i = 0; i < newXs.length; i++) {
        const x = newXs[i];
        let j = 0;
        while (j < xs.length - 2 && x > xs[j + 1]) j++;
        const x0 = xs[j], x1 = xs[j + 1];
        const y0 = ys[j], y1 = ys[j + 1];
        const t = (x - x0) / (x1 - x0);
        out.push(y0 * (1 - t) + y1 * t);
    }
    return out;
}

export function resolveColorToRgba(color, alpha = 1) {
    try {
        const cvs = document.createElement('canvas');
        const ctx = cvs.getContext('2d');
        ctx.fillStyle = color;
        const resolved = ctx.fillStyle;

        if (resolved[0] === '#') {
            let hex = resolved.slice(1);
            if (hex.length === 3) hex = hex.split('').map(h => h + h).join('');
            const r = parseInt(hex.slice(0,2),16);
            const g = parseInt(hex.slice(2,4),16);
            const b = parseInt(hex.slice(4,6),16);
            return `rgba(${r},${g},${b},${alpha})`;
        }

        const m = resolved.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9\.]+))?\)/);
        if (m) {
            const r = m[1], g = m[2], b = m[3];
            return `rgba(${r},${g},${b},${alpha})`;
        }

        return color;
    } catch (e) {
        return color;
    }
}

export const COLOR_MAP = { red: '#ef4444', orange: '#fb923c', green: '#34d399' };

export function msToBpm(ms) {
    return Math.round(60000 / ms);
}

export function bpmToMs(bpm) {
    return Math.round(60000 / bpm);
}
