/**
 * wind-rose.js
 * Extracts UI rendering for wind rose, stability charts, and profile charts.
 */
const WindRoseUI = (() => {
    function renderWindRose(canvasId, windRosePct, calmPct) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const centerX = w / 2;
        const centerY = h / 2;
        const maxRadius = Math.min(w, h) / 2 - 30;

        ctx.clearRect(0, 0, w, h);

        // Draw circles
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        [0.2, 0.4, 0.6, 0.8, 1].forEach(r => {
            ctx.beginPath();
            ctx.arc(centerX, centerY, maxRadius * r, 0, Math.PI * 2);
            ctx.stroke();
        });

        // Draw axes
        const sectors = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
        const angles = sectors.map((_, i) => (i * 45 - 90) * Math.PI / 180);
        
        ctx.beginPath();
        angles.forEach(a => {
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(centerX + Math.cos(a) * maxRadius, centerY + Math.sin(a) * maxRadius);
        });
        ctx.stroke();

        // Draw labels
        ctx.fillStyle = '#64748b';
        ctx.font = '10px Inter';
        ctx.textAlign = 'center';
        sectors.forEach((s, i) => {
            const a = angles[i];
            ctx.fillText(s, centerX + Math.cos(a) * (maxRadius + 15), centerY + Math.sin(a) * (maxRadius + 15) + 5);
        });

        // Find max percentage for scaling
        const maxPct = Math.max(...Object.values(windRosePct), 10);

        // Draw the rose polygon
        ctx.beginPath();
        ctx.strokeStyle = '#4f46e5';
        ctx.fillStyle = 'rgba(79, 70, 229, 0.15)';
        ctx.lineWidth = 2;
        
        angles.forEach((a, i) => {
            const s = sectors[i];
            const pct = windRosePct[s] || 0;
            const r = (pct / maxPct) * maxRadius;
            const x = centerX + Math.cos(a) * r;
            const y = centerY + Math.sin(a) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Calm info
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 12px Inter';
        ctx.fillText(`Штиль: ${calmPct?.toFixed(1) || 0}%`, centerX, centerY + maxRadius + 35);
    }

    function renderStabilityChart(canvasId, freq) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        const classes = ["A", "B", "C", "D", "E", "F"];
        const values = classes.map(c => freq[c] || 0);
        const maxVal = Math.max(...values, 10);
        
        const barWidth = (w - 60) / 6;
        const chartH = h - 40;

        classes.forEach((c, i) => {
            const val = values[i];
            const barH = (val / maxVal) * chartH;
            const x = 40 + i * barWidth;
            const y = h - 20 - barH;

            // Highlight E and F as temperature inversions
            const isEqInversion = (c === 'E' || c === 'F');
            ctx.fillStyle = isEqInversion ? '#ef4444' : '#8b5cf6';
            ctx.fillRect(x + 5, y, barWidth - 10, barH);
            
            ctx.fillStyle = '#64748b';
            ctx.font = '10px Inter';
            ctx.textAlign = 'center';
            ctx.fillText(c, x + barWidth/2, h - 5);
            ctx.fillText(val + '%', x + barWidth/2, y - 5);
            
            if (isEqInversion) {
                ctx.fillStyle = '#ef4444';
                ctx.fillText("Инверсия", x + barWidth/2, y - 20);
            }
        });
    }

    function renderProfileChart(canvasId, profile) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        const chartW = w - 60;
        const chartH = h - 60;
        const maxV = Math.max(...profile.map(p => p.avg_ms || 0), 5);

        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        profile.forEach((p, i) => {
            const x = 40 + (i / 11) * chartW;
            const y = h - 30 - ((p.avg_ms || 0) / maxV) * chartH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            
            // Draw point
            ctx.arc(x, y, 2, 0, Math.PI*2);
            
            // Labes
            ctx.fillStyle = '#64748b';
            ctx.font = '10px Inter';
            ctx.textAlign = 'center';
            if (i % 2 === 0) ctx.fillText(p.month, x, h - 10);
        });
        ctx.stroke();
    }

    return {
        renderWindRose,
        renderStabilityChart,
        renderProfileChart
    };
})();
