/**
 * weather-module.js — Meteorological Engine
 * Handles weather data fetching, aggregation, and Gaussian dispersion screening.
 */
const WeatherModule = (() => {
    
    // --- Stability Determination (Pasquill-Gifford) ---
    
    function getStabilityClass(windSpeed, insolation, cloudCover, isNight) {
        if (isNight) {
            if (windSpeed < 2) return 'F';
            if (windSpeed < 3) return cloudCover > 50 ? 'E' : 'F';
            return 'D';
        }
        if (insolation === 'strong') {
            if (windSpeed < 2) return 'A';
            if (windSpeed < 3) return 'A';
            if (windSpeed < 5) return 'B';
            return 'C';
        }
        if (insolation === 'moderate') {
            if (windSpeed < 2) return 'A';
            if (windSpeed < 3) return 'B';
            if (windSpeed < 5) return 'C';
            if (windSpeed < 6) return 'C';
            return 'D';
        }
        if (insolation === 'slight') {
            if (windSpeed < 2) return 'B';
            if (windSpeed < 3) return 'C';
            if (windSpeed < 5) return 'C';
            return 'D';
        }
        return 'D';
    }

    /**
     * Approximates solar elevation angle in degrees.
     * lat: latitude in degrees
     * lng: longitude (not strictly needed for local hour approximation but useful)
     * dateObj: JavaScript Date object
     */
    function calculateSunElevation(lat, dateObj) {
        const phi = lat * Math.PI / 180;
        
        // Day of year
        const start = new Date(dateObj.getFullYear(), 0, 0);
        const diff = dateObj - start;
        const day = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        // Declination
        const delta = 23.45 * Math.sin((360 / 365) * (day - 81) * Math.PI / 180) * Math.PI / 180;
        
        // Hour angle (approximate)
        const hour = dateObj.getHours() + dateObj.getMinutes() / 60;
        const hAngle = (hour - 12) * 15 * Math.PI / 180;
        
        const sinH = Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(hAngle);
        return Math.asin(sinH) * 180 / Math.PI;
    }

    function getInsolation(sunEl, cloudCover) {
        if (sunEl < 0) return 'night';
        if (sunEl > 60) {
            if (cloudCover < 50) return 'strong';
            if (cloudCover < 80) return 'moderate';
            return 'slight';
        }
        if (sunEl > 35) {
            if (cloudCover < 20) return 'strong';
            if (cloudCover < 60) return 'moderate';
            return 'slight';
        }
        if (sunEl > 15) {
            if (cloudCover < 50) return 'moderate';
            return 'slight';
        }
        return 'slight';
    }

    // --- Data Fetching ---

    async function fetchHistoricalRange(lat, lng, fromDate, toDate) {
        try {
            const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${fromDate}&end_date=${toDate}&hourly=temperature_2m,windspeed_10m,winddirection_10m,cloudcover`;
            const res = await fetch(url);
            return await res.json();
        } catch (e) {
            console.error("Failed to fetch historical weather", e);
            return null;
        }
    }

    // --- Aggregation ---

    function aggregateToWindRose(hourlyData, lat) {
        if (!hourlyData || !hourlyData.hourly) return null;
        const directions = hourlyData.hourly.winddirection_10m;
        const speeds = hourlyData.hourly.windspeed_10m;
        const clouds = hourlyData.hourly.cloudcover;
        const times = hourlyData.hourly.time;
        
        const counts = { N: 0, NE: 0, E: 0, SE: 0, S: 0, SW: 0, W: 0, NW: 0 };
        const stabilityCounts = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
        let calm = 0;
        let total = 0;
        let speedSum = 0;

        directions.forEach((deg, i) => {
            const speed = speeds[i];
            speedSum += speed;
            const cloud = clouds[i];
            const timeStr = times[i];
            const date = new Date(timeStr);
            
            // Wind Rose
            if (speed < 0.5) {
                calm++;
            } else {
                const sector = getSectorFromDeg(deg);
                counts[sector]++;
            }
            
            // Stability
            const sunEl = calculateSunElevation(lat, date);
            const insolation = getInsolation(sunEl, cloud);
            const isNight = insolation === 'night';
            const stab = getStabilityClass(speed, insolation, cloud, isNight);
            if (stabilityCounts[stab] !== undefined) stabilityCounts[stab]++;
            
            total++;
        });

        const pct = {};
        Object.keys(counts).forEach(k => pct[k] = (counts[k] / total) * 100);
        
        const stabPct = {};
        Object.keys(stabilityCounts).forEach(k => stabPct[k] = (stabilityCounts[k] / total) * 100);
        
        // Find dominant stability
        const dominant_stability = Object.keys(stabilityCounts).reduce((a, b) => stabilityCounts[a] > stabilityCounts[b] ? a : b);

        return {
            wind_rose_pct: pct,
            stability_freq: stabPct,
            dominant_stability: dominant_stability,
            calm_pct: (calm / total) * 100,
            wind_speed_avg_ms: total > 0 ? (speedSum / total) : 3,
            dominant_direction: Object.keys(counts).reduce((a, b) => (counts[a] || 0) > (counts[b] || 0) ? a : b)
        };
    }

    function getSectorFromDeg(deg) {
        const sectors = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
        const index = Math.round(deg / 45) % 8;
        return sectors[index];
    }

    // --- Dispersion Logic (Gaussian Screening Plume) ---

    /**
     * Briggs open-country sigma parameterization
     * x: downwind distance in meters
     * stability: 'A' through 'F'
     */
    function getSigmas(x, stability) {
        if (x <= 0) return { sy: 0.1, sz: 0.1 };
        
        let sy, sz;
        const x_km = x / 1000;
        
        switch (stability) {
            case 'A': sy = 0.22 * x * Math.pow(1 + 0.0001 * x, -0.5); sz = 0.20 * x; break;
            case 'B': sy = 0.16 * x * Math.pow(1 + 0.0001 * x, -0.5); sz = 0.12 * x; break;
            case 'C': sy = 0.11 * x * Math.pow(1 + 0.0001 * x, -0.5); sz = 0.08 * x * Math.pow(1 + 0.0002 * x, -0.5); break;
            case 'D': sy = 0.08 * x * Math.pow(1 + 0.0001 * x, -0.5); sz = 0.06 * x * Math.pow(1 + 0.0015 * x, -0.5); break;
            case 'E': sy = 0.06 * x * Math.pow(1 + 0.0001 * x, -0.5); sz = 0.03 * x * Math.pow(1 + 0.0003 * x, -1); break;
            case 'F': sy = 0.04 * x * Math.pow(1 + 0.0001 * x, -0.5); sz = 0.016 * x * Math.pow(1 + 0.0003 * x, -1); break;
            default: sy = 0.08 * x * Math.pow(1 + 0.0001 * x, -0.5); sz = 0.06 * x * Math.pow(1 + 0.0015 * x, -0.5);
        }
        return { sy, sz };
    }

    /**
     * C(x, y, 0) = (Q / (π * σy * σz * u)) * exp(-0.5*(y/σy)²) * exp(-0.5*(H/σz)²) * 2
     */
    function gaussianGroundConcentration(params) {
        const { Q, H, u, stability, x, y } = params;
        if (x <= 0) return 0;
        
        const { sy, sz } = getSigmas(x, stability);
        if (sy === 0 || sz === 0 || u === 0) return 0;

        const term1 = Q / (Math.PI * sy * sz * u);
        const term2 = Math.exp(-0.5 * Math.pow(y / sy, 2));
        const term3 = Math.exp(-0.5 * Math.pow(H / sz, 2));
        
        return term1 * term2 * term3 * 2 * 1000; // Multiply by 1000 for mg/m³ if Q is g/s
    }

    function runScreeningGrid(source, met, options = {}) {
        const { Q = 1, H = 10 } = source; // Q in g/s, H in m
        const u = met.wind_speed_avg_ms || 2;
        const stability = met.dominant_stability || 'D';
        const angle = getDegFromSector(met.dominant_direction || 'N');
        
        const x_max = options.x_max || 2000;
        const step = options.step || 50;
        
        const results = [];
        for (let x = step; x <= x_max; x += step) {
            for (let y = -x; y <= x; y += step) {
                // Only compute for a cone/sector to save performance
                if (Math.abs(y) > x * 0.5) continue; 
                
                const conc = gaussianGroundConcentration({ Q, H, u, stability, x, y });
                if (conc > 0.0001) {
                    // Convert local (x,y) to (lat,lng) relative to source
                    const geo = offsetToLatLon(source.lat, source.lng, x, y, angle);
                    results.push({ ...geo, conc });
                }
            }
        }
        return results;
    }

    /**
     * Analytically find the contour (isopleth) points for given target concentrations.
     * C(x,y) = C(x,0) * exp(-0.5 * (y/sy)^2)
     * => y = sy * sqrt(-2 * ln(C_target / C(x,0)))
     */
    function calculateIsopleths(source, met, thresholds) {
        const { Q = 1, H = 10 } = source;
        const u = met.wind_speed_avg_ms || 2;
        const stability = met.dominant_stability || 'D';
        const angle = getDegFromSector(met.dominant_direction || 'N');
        
        const x_max = 5000; // Look up to 5km
        const step = 20;    // High resolution for smooth curves
        
        const isopleths = [];
        
        thresholds.forEach(thresh => {
            const targetC = thresh.value;
            const positiveY = [];
            const negativeY = [];
            
            for (let x = step; x <= x_max; x += step) {
                const cCenter = gaussianGroundConcentration({ Q, H, u, stability, x, y: 0 });
                if (cCenter >= targetC) {
                    const { sy } = getSigmas(x, stability);
                    const v = -2 * Math.log(targetC / cCenter);
                    if (v >= 0) {
                        const y = sy * Math.sqrt(v);
                        positiveY.push({x, y});
                        negativeY.unshift({x, y: -y});
                    }
                }
            }
            
            if (positiveY.length > 0) {
                const polyXY = [...positiveY, ...negativeY];
                const polyGeo = polyXY.map(p => offsetToLatLon(source.lat, source.lng, p.x, p.y, angle));
                isopleths.push({
                    level: thresh.level,
                    label: thresh.label,
                    fillColor: thresh.color,
                    borderColor: thresh.borderColor,
                    points: polyGeo
                });
            }
        });
        
        return isopleths;
    }

    // --- Geo-math Utilities ---

    function offsetToLatLon(lat, lon, x, y, angleDeg) {
        // Rotate (x,y) by wind angle
        const rad = (angleDeg - 180) * Math.PI / 180; // Wind blows FROM angle, plume goes TO angle+180
        const rx = x * Math.cos(rad) - y * Math.sin(rad);
        const ry = x * Math.sin(rad) + y * Math.cos(rad);

        const r_earth = 6378137;
        const dLat = ry / r_earth;
        const dLon = rx / (r_earth * Math.cos(Math.PI * lat / 180));
        
        return {
            lat: lat + dLat * 180 / Math.PI,
            lng: lon + dLon * 180 / Math.PI
        };
    }

    function getDegFromSector(sector) {
        const sectors = { "N": 0, "NE": 45, "E": 90, "SE": 135, "S": 180, "SW": 225, "W": 270, "NW": 315 };
        return sectors[sector] || 0;
    }

    return { 
        getStabilityClass, 
        fetchHistoricalRange, 
        aggregateToWindRose,
        getSigmas,
        gaussianGroundConcentration,
        runScreeningGrid,
        calculateIsopleths,
        getDegFromSector
    };
})();
