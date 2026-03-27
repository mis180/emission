const WeatherModule = (() => {
    // Pasquill-Gifford stability class determination
    function getStabilityClass(windSpeed, insolation, cloudCover, isNight) {
        if (isNight) {
            if (windSpeed < 2) return 'F';
            if (windSpeed < 3) return cloudCover > 50 ? 'E' : 'F';
            if (windSpeed < 5) return 'D';
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

    async function fetchFromOpenMeteo(lat, lng, date) {
        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,windspeed_10m,winddirection_10m&start_date=${date}&end_date=${date}`;
            const res = await fetch(url);
            return await res.json();
        } catch (e) {
            console.error("Failed to fetch weather", e);
            return null;
        }
    }

    function calculateWindRose(historicalData) {
        return "Not implemented directly in UI.";
    }

    return { getStabilityClass, fetchFromOpenMeteo, calculateWindRose };
})();
