// DOM Elemente, Konstanten, etc.
const cityInput = document.getElementById('city');
const weatherResultContainer = document.getElementById('weather-result');
const themeToggle = document.getElementById('theme-toggle');
const autocompleteDropdown = document.getElementById('autocomplete-dropdown');
const searchButton = document.getElementById('search-button');
const locationButton = document.getElementById('location-button');
const favoritesSelect = document.getElementById('favorites-select');
const refreshButton = document.getElementById('refresh-button');

const GEOAPIFY_API_KEY = '6b73ef3534d24e6f9f9cbbd26bdf2e99'; // Dein API Key
const FAVORITES_KEY = 'weatherAppFavorites'; // Key für localStorage
let autocompleteTimeout;
let currentSuggestions = [];
let manualOverrideActive = false;
let currentCoords = null; // Speichert die Koordinaten des aktuell angezeigten Ortes
let currentCityName = null; // Speichert den Namen des aktuell angezeigten Ortes

const weatherConditions = { 0: { icon: 'sun', desc: 'Klarer Himmel' }, 1: { icon: 'cloud-sun', desc: 'Überwiegend klar' }, 2: { icon: 'cloud', desc: 'Teilweise bewölkt' }, 3: { icon: 'cloud', desc: 'Bedeckt' }, 45: { icon: 'smog', desc: 'Nebel' }, 48: { icon: 'smog', desc: 'Gefrierender Nebel' }, 51: { icon: 'cloud-rain', desc: 'Leichter Nieselregen' }, 53: { icon: 'cloud-rain', desc: 'Mäßiger Nieselregen' }, 55: { icon: 'cloud-showers-heavy', desc: 'Starker Nieselregen' }, 56: { icon: 'snowflake', desc: 'Leichter gefrierender Nieselregen' }, 57: { icon: 'snowflake', desc: 'Starker gefrierender Nieselregen' }, 61: { icon: 'cloud-rain', desc: 'Leichter Regen' }, 63: { icon: 'cloud-showers-heavy', desc: 'Mäßiger Regen' }, 65: { icon: 'cloud-showers-heavy', desc: 'Starker Regen' }, 66: { icon: 'snowflake', desc: 'Leichter gefrierender Regen' }, 67: { icon: 'snowflake', desc: 'Starker gefrierender Regen' }, 71: { icon: 'snowflake', desc: 'Leichter Schneefall' }, 73: { icon: 'snowflake', desc: 'Mäßiger Schneefall' }, 75: { icon: 'snowflake', desc: 'Starker Schneefall' }, 77: { icon: 'icicles', desc: 'Schneekörner' }, 80: { icon: 'cloud-sun-rain', desc: 'Leichte Regenschauer' }, 81: { icon: 'cloud-showers-heavy', desc: 'Mäßige Regenschauer' }, 82: { icon: 'cloud-showers-heavy', desc: 'Heftige Regenschauer' }, 85: { icon: 'snowflake', desc: 'Leichte Schneeschauer' }, 86: { icon: 'snowflake', desc: 'Starke Schneeschauer' }, 95: { icon: 'cloud-bolt', desc: 'Gewitter' }, 96: { icon: 'cloud-bolt', desc: 'Gewitter mit leichtem Hagel' }, 99: { icon: 'cloud-bolt', desc: 'Gewitter mit starkem Hagel' } };
function getWeatherCondition(code) { return weatherConditions[code] || { icon: 'question-circle', desc: `Unbekannt (${code})` }; }

// --- Initialisierung & Event Listener ---
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    loadFavorites(); // Favoriten laden
    setupEventListeners();
    autoDetectLocation();
});

function setupEventListeners() {
    cityInput.addEventListener('input', handleAutocompleteInput);
    cityInput.addEventListener('keydown', handleInputKeydown);
    searchButton.addEventListener('click', getWeatherByCityName);
    locationButton.addEventListener('click', () => getLocationWeather(false));
    themeToggle.addEventListener('click', toggleThemeManually);
    favoritesSelect.addEventListener('change', handleFavoriteSelection);
    refreshButton.addEventListener('click', handleRefresh);

    document.addEventListener('click', handleClickOutsideAutocomplete);
    document.addEventListener('keydown', handleEscapeKey);
    weatherResultContainer.addEventListener('click', handleCardClicks); // Umfasst Flip & Favorit
}

// --- Theme Management ---
function initializeTheme() { const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches; if (prefersLight) { applyLightTheme(); } else { applyDarkTheme(); } updateThemeToggleIcon(); if (window.matchMedia) { const q = window.matchMedia('(prefers-color-scheme: light)'); q.addEventListener('change', (e) => { if (!manualOverrideActive) { if (e.matches) { applyLightTheme(); } else { applyDarkTheme(); } updateThemeToggleIcon(); } }); } }
function toggleThemeManually() { manualOverrideActive = true; const isLight = document.body.classList.contains('light-theme'); if (isLight) { applyDarkTheme(); } else { applyLightTheme(); } updateThemeToggleIcon(); }
function applyLightTheme() { document.body.classList.add('light-theme'); } function applyDarkTheme() { document.body.classList.remove('light-theme'); }
function updateThemeToggleIcon() { if (document.body.classList.contains('light-theme')) { themeToggle.innerHTML = '<i class="fas fa-moon"></i>'; themeToggle.setAttribute('aria-label', 'Temporär in Dark Mode wechseln'); } else { themeToggle.innerHTML = '<i class="fas fa-sun"></i>'; themeToggle.setAttribute('aria-label', 'Temporär in Light Mode wechseln'); } }

// --- Favoriten Management ---
function getFavorites() {
    const favs = localStorage.getItem(FAVORITES_KEY);
    return favs ? JSON.parse(favs) : [];
}
function saveFavorites(favorites) {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    loadFavorites(); // Dropdown neu laden
}
function loadFavorites() {
    const favorites = getFavorites();
    favoritesSelect.innerHTML = '<option value="">Favoriten...</option>'; // Reset
    favorites.forEach((fav, index) => {
        const option = document.createElement('option');
        option.value = index; // Index im Array als Value
        option.textContent = fav.name;
        favoritesSelect.appendChild(option);
    });
}
function addFavorite(name, lat, lon) {
    if (!name || lat === null || lon === null) return;
    const favorites = getFavorites();
    // Prüfen, ob Ort (Koordinaten) schon existiert
    if (!favorites.some(fav => fav.lat === lat && fav.lon === lon)) {
        favorites.push({ name, lat, lon });
        saveFavorites(favorites);
        updateFavoriteButtonState(true); // Zeige Herz als gefüllt
    }
}
// Einfache Löschfunktion könnte hier ergänzt werden (z.B. Button neben Dropdown)

function handleFavoriteSelection() {
    const selectedIndex = favoritesSelect.value;
    if (selectedIndex === "") return; // "Favoriten..." ausgewählt

    const favorites = getFavorites();
    const selectedFav = favorites[parseInt(selectedIndex)];

    if (selectedFav) {
        cityInput.value = selectedFav.name; // Input aktualisieren (optional)
        getWeatherFromCoords(selectedFav.lat, selectedFav.lon, selectedFav.name);
    }
    favoritesSelect.value = ""; // Auswahl zurücksetzen
}

function updateFavoriteButtonState(isFavorite) {
     const favButton = document.getElementById('add-favorite-button');
     if (favButton) {
         favButton.classList.toggle('is-favorite', isFavorite);
         favButton.innerHTML = isFavorite ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
         favButton.title = isFavorite ? 'Aus Favoriten entfernen (noch nicht implementiert)' : 'Zu Favoriten hinzufügen';
     }
}

// --- Aktualisieren ---
function handleRefresh() {
    if (currentCoords) {
        // Kurze Ladeanimation am Button
        const icon = refreshButton.querySelector('i');
        icon?.classList.add('fa-spin');
        getWeatherFromCoords(currentCoords.lat, currentCoords.lon, currentCityName)
         .finally(() => {
            icon?.classList.remove('fa-spin'); // Animation stoppen, auch bei Fehler
         });
    } else {
        getLocationWeather(false);
    }
}

 // --- Klick-Handler für Karte (Flip & Favorit) ---
 function handleCardClicks(event) {
    // Flip-Logik
    if (event.target.closest('.flip-button-to-back')) {
        weatherResultContainer.classList.add('is-flipped');
    }
    if (event.target.closest('.flip-button-to-front')) {
        weatherResultContainer.classList.remove('is-flipped');
    }
    // Favorit hinzufügen/entfernen Logik
    if (event.target.closest('#add-favorite-button')) {
        const favorites = getFavorites();
        const isCurrentlyFavorite = favorites.some(fav => fav.lat === currentCoords?.lat && fav.lon === currentCoords?.lon);

        if (isCurrentlyFavorite) {
            console.log("Entfernen noch nicht implementiert");
            // Hier könnte man `favorites.filter(...)` und `saveFavorites(...)` aufrufen
            // Beispiel zum Entfernen (ungetestet):
            // const updatedFavorites = favorites.filter(fav => !(fav.lat === currentCoords.lat && fav.lon === currentCoords.lon));
            // saveFavorites(updatedFavorites);
            // updateFavoriteButtonState(false);
        } else if (currentCityName && currentCoords) {
            addFavorite(currentCityName, currentCoords.lat, currentCoords.lon);
        }
    }
 }


// --- Autocomplete ---
function handleAutocompleteInput(e) { clearTimeout(autocompleteTimeout); const s = e.target.value.trim(); if (s.length < 2) { hideAutocomplete(); return; } autocompleteTimeout = setTimeout(async () => { try { const r = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(s)}&type=city&lang=de&limit=5&format=json&apiKey=${GEOAPIFY_API_KEY}`); if (!r.ok) throw Error('Autocomplete API failed'); const d = await r.json(); currentSuggestions = d.results || []; showAutocompleteSuggestions(currentSuggestions); } catch (err) { console.error(err); hideAutocomplete(); } }, 300); }
function showAutocompleteSuggestions(suggestions) { if (!suggestions || suggestions.length === 0) { hideAutocomplete(); return; } autocompleteDropdown.innerHTML = suggestions.map(s => { const c = s.city || s.name || s.address_line1; const co = s.country; const dn = c && co ? `${c}, ${co}` : s.formatted; return `<div class="autocomplete-item" data-lat="${s.lat}" data-lon="${s.lon}" data-name="${dn}">${highlightMatch(dn, cityInput.value)}</div>`; }).join(''); document.querySelectorAll('.autocomplete-item').forEach(i => { i.addEventListener('click', () => { const n = i.dataset.name; const la = parseFloat(i.dataset.lat); const lo = parseFloat(i.dataset.lon); cityInput.value = n; hideAutocomplete(); cityInput.blur(); getWeatherFromCoords(la, lo, n); }); }); autocompleteDropdown.style.display = 'block'; }
function hideAutocomplete() { autocompleteDropdown.style.display = 'none'; autocompleteDropdown.innerHTML = ''; currentSuggestions = []; }
function handleInputKeydown(e) { if (e.key === 'Enter') { e.preventDefault(); if (autocompleteDropdown.style.display === 'block' && currentSuggestions.length > 0) { const f = autocompleteDropdown.querySelector('.autocomplete-item'); if (f) f.click(); } else { hideAutocomplete(); getWeatherByCityName(); } cityInput.blur(); } else if (e.key === 'Escape') { hideAutocomplete(); } }
function handleClickOutsideAutocomplete(e) { if (!e.target.closest('.autocomplete-container')) { hideAutocomplete(); } }
function handleEscapeKey(e) { if (e.key === 'Escape') { hideAutocomplete(); } }
function highlightMatch(text, query) { if (!query || !text) return text || ''; const eq = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const rgx = new RegExp(`(${eq})`, 'gi'); return text.replace(rgx, '<b>$1</b>'); }

// --- Wetterdaten abrufen ---
async function getWeatherByCityName() { const city = cityInput.value.trim(); if (!city) { showError('Bitte gib einen Stadtnamen ein.'); return; } showLoading('Suche Stadt...'); hideAutocomplete(); try { const geoR = await fetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(city)}&limit=1&lang=de&format=json&apiKey=${GEOAPIFY_API_KEY}`); if (!geoR.ok) throw new Error(`Geoapify Search Fehler: ${geoR.status}`); const geoD = await geoR.json(); if (!geoD.results || geoD.results.length === 0) { throw new Error(`Stadt "${city}" nicht gefunden.`); } const { lat, lon, formatted } = geoD.results[0]; const locN = geoD.results[0].city || formatted; await getWeatherFromCoords(lat, lon, locN); } catch (error) { console.error('Fehler bei Stadtsuche:', error); handleFetchError(error); } }
async function getLocationWeather(isAutoDetect = false) { if (!navigator.geolocation) { showError('Geolocation nicht unterstützt.'); return; } showLoading('Ermittle Standort...'); navigator.geolocation.getCurrentPosition( async (pos) => { const { latitude, longitude } = pos.coords; try { const revGeoR = await fetch(`https://api.geoapify.com/v1/geocode/reverse?lat=${latitude}&lon=${longitude}&lang=de&format=json&apiKey=${GEOAPIFY_API_KEY}`); let locN = `Lat: ${latitude.toFixed(2)}, Lon: ${longitude.toFixed(2)}`; if (revGeoR.ok) { const locD = await revGeoR.json(); if (locD.results?.length > 0) { locN = locD.results[0].city || locD.results[0].village || locD.results[0].suburb || locD.results[0].formatted; } } await getWeatherFromCoords(latitude, longitude, locN); } catch (error) { console.error('Fehler nach Standort-Ermittlung:', error); await getWeatherFromCoords(latitude, longitude, `Lat: ${latitude.toFixed(2)}, Lon: ${longitude.toFixed(2)}`); } }, (err) => { console.error('Geolocation Fehler:', err); if (!isAutoDetect) { handleGeolocationError(err); } else { showInitialPrompt(); } }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }); }

async function getWeatherFromCoords(lat, lon, locationName) {
    currentCoords = { lat, lon }; // Aktuelle Koordinaten speichern
    currentCityName = locationName; // Aktuellen Namen speichern
    showLoading(`Lade Wetter für ${locationName}...`);

    // Erweiterte API URL
    const params = [
        `latitude=${lat.toFixed(4)}`,
        `longitude=${lon.toFixed(4)}`,
        'current=temperature_2m,relativehumidity_2m,apparent_temperature,is_day,precipitation,weathercode,surface_pressure,windspeed_10m,winddirection_10m,uv_index',
        'hourly=temperature_2m,relativehumidity_2m,precipitation_probability,weathercode,surface_pressure,uv_index,precipitation',
        'daily=weathercode,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max',
        'temperature_unit=celsius',
        'windspeed_unit=kmh',
        'precipitation_unit=mm',
        'timezone=auto',
        'forecast_days=7' // 7 Tage
    ];
    const apiUrl = `https://api.open-meteo.com/v1/forecast?${params.join('&')}`;

    try {
        const weatherResponse = await fetch(apiUrl);
        if (!weatherResponse.ok) {
            const errorData = await weatherResponse.json().catch(() => ({}));
            throw new Error(`Open-Meteo Fehler: ${weatherResponse.status} ${errorData.reason || ''}`);
        }
        const weatherData = await weatherResponse.json();

        if (!weatherData.current || !weatherData.hourly || !weatherData.daily) {
            throw new Error('Unvollständige Wetterdaten empfangen.');
        }
        renderWeatherCards(locationName, weatherData); // Neue Render Funktion aufrufen
        weatherResultContainer.classList.remove('is-flipped'); // Zur Vorderseite flippen
        setDynamicBackground(weatherData.current.weathercode, weatherData.current.is_day); // Hintergrund anpassen

        // Favoriten-Button Status prüfen
        const favorites = getFavorites();
        const isFavorite = favorites.some(fav => fav.lat === lat && fav.lon === lon);
        updateFavoriteButtonState(isFavorite);

    } catch (error) {
        console.error('Fehler beim Abrufen/Verarbeiten der Wetterdaten:', error);
        handleFetchError(error);
    }
}

// --- Rendering ---
function renderWeatherCards(location, weatherData) {
    const { current, hourly, daily } = weatherData;
    const currentCondition = getWeatherCondition(current.weathercode);

    // Hilfsfunktionen
    const formatTime = (dateStr) => new Date(dateStr).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const getDayName = (dateStr, format = 'short') => new Date(dateStr).toLocaleDateString('de-DE', { weekday: format });
    const getUVDescription = (uv) => {
         if (uv === null || uv === undefined) return '';
         const roundedUv = Math.round(uv); // Runde UV-Index für Vergleich
         if (roundedUv <= 2) return 'Niedrig';
         if (roundedUv <= 5) return 'Mittel';
         if (roundedUv <= 7) return 'Hoch';
         if (roundedUv <= 10) return 'Sehr hoch';
         return 'Extrem';
    };

    // Aktuelle Stunde für Niederschlag
    const now = new Date();
    // Finde den Index der Stunde, die der aktuellen am nächsten kommt
    let currentHourIndex = hourly.time.findIndex(t => new Date(t) >= now);
    if (currentHourIndex > 0) currentHourIndex--; // Nimm die vorherige (gerade laufende) Stunde
    else if (currentHourIndex === -1) currentHourIndex = hourly.time.length - 1; // Nimm die letzte verfügbare, falls now > letzte Stunde
    
    const currentPrecipitation = (currentHourIndex !== -1 && hourly.precipitation[currentHourIndex] !== null) ? hourly.precipitation[currentHourIndex] : current.precipitation;


    // --- Vorderseite HTML ---
    const frontHTML = `
        <div class="card-face card-front">
            <div> <!-- Wrapper für Inhalt oben -->
                <div class="current-weather-header">
                    <div class="location-info">
                        <span class="location-name">${location}</span>
                        <button id="add-favorite-button" title="Zu Favoriten hinzufügen">
                            <i class="far fa-heart"></i> <!-- Wird per JS aktualisiert -->
                        </button>
                    </div>
                </div>
                <div class="current-weather-main">
                    <i class="fas fa-${currentCondition.icon} weather-icon-large"></i>
                    <div class="temp-feels-desc">
                        <div class="temperature-now">${Math.round(current.temperature_2m)}°C</div>
                        <div class="feels-like">Gefühlt ${Math.round(current.apparent_temperature)}°</div>
                        <div class="weather-description">${currentCondition.desc}</div>
                    </div>
                </div>
                <div class="details-grid">
                    <div class="detail-item"> <div class="label"><i class="fas fa-temperature-high"></i> Max</div> <div class="value">${Math.round(daily.temperature_2m_max[0] ?? '--')}°</div> </div>
                    <div class="detail-item"> <div class="label"><i class="fas fa-temperature-low"></i> Min</div> <div class="value">${Math.round(daily.temperature_2m_min[0] ?? '--')}°</div> </div>
                    <div class="detail-item"> <div class="label"><i class="fas fa-wind"></i> Wind</div> <div class="value"> ${Math.round(current.windspeed_10m)}<span class="unit">km/h</span> <i class="fas fa-location-arrow wind-dir-icon" style="transform: rotate(${current.winddirection_10m - 45}deg);" title="${current.winddirection_10m}°"></i> </div> </div>
                    <div class="detail-item"> <div class="label"><i class="fas fa-tint"></i> Feuchte</div> <div class="value">${current.relativehumidity_2m}<span class="unit">%</span></div> </div>
                    <div class="detail-item"> <div class="label"><i class="fas fa-cloud-showers-heavy"></i> Niederschl.</div> <div class="value">${currentPrecipitation}<span class="unit">mm</span></div> </div>
                    <div class="detail-item"> <div class="label"><i class="fas fa-tachometer-alt"></i> Druck</div> <div class="value">${Math.round(current.surface_pressure)}<span class="unit">hPa</span></div> </div>
                    <div class="detail-item"> <div class="label"><i class="fas fa-sun"></i> UV-Index</div> <div class="value">${Math.round(current.uv_index ?? 0)} <span class="unit uv-desc" style="font-size: 0.8em;">${getUVDescription(current.uv_index)}</span></div> </div>
                    <div class="detail-item"> <div class="label"><i class="fas fa-sunrise"></i> Aufgang</div> <div class="value">${formatTime(daily.sunrise[0])}</div> </div>
                    <div class="detail-item"> <div class="label"><i class="fas fa-sunset"></i> Untergang</div> <div class="value">${formatTime(daily.sunset[0])}</div> </div>
                </div>
            </div>
            <button class="flip-button flip-button-to-back"> <i class="fas fa-calendar-alt"></i> Vorhersage ansehen </button>
        </div>`;

    // --- Rückseite HTML ---
    const hourlyTemps = hourly.temperature_2m.slice(currentHourIndex, currentHourIndex + 24);
    const chartSVG = generateTemperatureChart(hourlyTemps);

    let hourlyHTML = '';
    if (currentHourIndex !== -1) {
        for (let i = currentHourIndex; i < Math.min(currentHourIndex + 24, hourly.time.length); i++) {
            const timeStr = formatTime(hourly.time[i]);
            const temp = Math.round(hourly.temperature_2m[i]);
            const condition = getWeatherCondition(hourly.weathercode[i]);
            const precipProb = hourly.precipitation_probability[i];
            hourlyHTML += `<div class="forecast-item"> <div class="time">${timeStr}</div> <i class="fas fa-${condition.icon} weather-icon-small"></i> <div class="temp">${temp}°</div> ${precipProb !== null ? `<div class="precip-prob" title="Niederschlagsrisiko"><i class="fas fa-tint"></i> ${precipProb}%</div>` : ''} </div>`;
        }
    }

    let dailyHTML = '';
    for (let i = 0; i < daily.time.length; i++) {
         const dayName = (i === 0) ? 'Heute' : getDayName(daily.time[i]);
         const maxTemp = Math.round(daily.temperature_2m_max[i]);
         const minTemp = Math.round(daily.temperature_2m_min[i]);
         const condition = getWeatherCondition(daily.weathercode[i]);
         const precipProb = daily.precipitation_probability_max[i];
         dailyHTML += `<div class="forecast-item"> <div class="day">${dayName}</div> <i class="fas fa-${condition.icon} weather-icon-small"></i> <div class="temp">${maxTemp}°</div> <div class="temp-low">${minTemp}°</div> ${precipProb !== null ? `<div class="precip-prob" title="Max. Niederschlagsrisiko"><i class="fas fa-tint"></i> ${precipProb}%</div>` : ''} </div>`;
    }

    const backHTML = `
        <div class="card-face card-back">
            <div class="forecast-content">
                <div class="forecast-chart-container">${chartSVG}</div>
                <div class="forecast-section"> <h3>Stündlich (24h)</h3> <div class="forecast-list">${hourlyHTML || 'Keine Stundenvorhersage'}</div> </div>
                <div class="forecast-section"> <h3>Täglich (7 Tage)</h3> <div class="forecast-list">${dailyHTML || 'Keine Tagesvorhersage'}</div> </div>
            </div>
            <button class="flip-button flip-button-to-front"> <i class="fas fa-arrow-left"></i> Zurück </button>
        </div>`;

    weatherResultContainer.innerHTML = frontHTML + backHTML;
}

 // --- SVG Chart Generierung ---
 function generateTemperatureChart(temps) {
    if (!temps || temps.length < 2) return '<div style="text-align: center; color: var(--text-secondary); font-size: 0.9em;">Temperaturverlauf nicht verfügbar.</div>';
    const width = 300; const height = 60; const padding = 5;
    const chartHeight = height - 2 * padding;
    const validTemps = temps.filter(t => t !== null && t !== undefined);
    if (validTemps.length < 2) return '<div style="text-align: center; color: var(--text-secondary); font-size: 0.9em;">Zu wenig Daten für Verlauf.</div>';

    const minTemp = Math.min(...validTemps);
    const maxTemp = Math.max(...validTemps);
    const tempRange = Math.max(maxTemp - minTemp, 1); // Verhindert Division durch Null

    const scaleX = (index) => (width / (temps.length - 1)) * index;
    const scaleY = (temp) => chartHeight - ((temp - minTemp) / tempRange) * chartHeight + padding;

    let pathData = '';
    let pointsSVG = '';
    let firstPoint = true;

    temps.forEach((temp, index) => {
        if (temp !== null && temp !== undefined) {
            const x = scaleX(index).toFixed(2);
            const y = scaleY(temp).toFixed(2);
            pathData += `${firstPoint ? 'M' : 'L'} ${x} ${y} `;
            pointsSVG += `<circle cx="${x}" cy="${y}" r="2.5" class="chart-dot" />`;
            firstPoint = false;
        }
    });

    if (!pathData) return '<div style="text-align: center; color: var(--text-secondary); font-size: 0.9em;">Temperaturverlauf nicht verfügbar.</div>';

    return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet"><path d="${pathData.trim()}" class="chart-line" />${pointsSVG}</svg>`;
}

// --- Dynamischer Hintergrund ---
function setDynamicBackground(weathercode, isDay) {
     let className = '';
     const wc = Number(weathercode); // Sicherstellen, dass es eine Zahl ist

     if (isDay === 0) { // Nacht
         if (wc <= 1) className = 'weather-clear-night';
         else if (wc <= 3 || wc === 45 || wc === 48) className = 'weather-cloudy-night';
         else if ((wc >= 51 && wc <= 67) || (wc >= 80 && wc <= 82)) className = 'weather-rain';
         else if ((wc >= 71 && wc <= 77) || (wc >= 85 && wc <= 86)) className = 'weather-snow';
         else className = 'weather-cloudy-night'; // Default Nacht
     } else { // Tag
         if (wc <= 1) className = 'weather-clear-day';
         else if (wc <= 3 || wc === 45 || wc === 48) className = 'weather-cloudy-day';
         else if ((wc >= 51 && wc <= 67) || (wc >= 80 && wc <= 82)) className = 'weather-rain';
         else if ((wc >= 71 && wc <= 77) || (wc >= 85 && wc <= 86)) className = 'weather-snow';
         else className = 'weather-cloudy-day'; // Default Tag
     }
     // Alle alten Wetterklassen entfernen, neue hinzufügen
    document.body.className = document.body.className.replace(/weather-\S+/g, '').trim();
    if (className) document.body.classList.add(className);
     // Theme-Klasse wieder hinzufügen, falls entfernt
    if (!document.body.classList.contains('light-theme') && localStorage.getItem('theme') !== 'light' && !window.matchMedia('(prefers-color-scheme: light)').matches) {
         // Sicherstellen, dass dark mode aktiv bleibt, wenn es sein soll
    } else if (document.body.classList.contains('light-theme') || localStorage.getItem('theme') === 'light' || window.matchMedia('(prefers-color-scheme: light)').matches) {
         if (!document.body.classList.contains('light-theme')) document.body.classList.add('light-theme');
    }

}

// --- Loading, Error, Initial Prompt States, Fehlerbehandlung, Standort-Automatik ---
function showLoading(message = "Lade...") { weatherResultContainer.classList.remove('is-flipped'); weatherResultContainer.innerHTML = ` <div class="loading-state"> <i class="fas fa-spinner fa-spin"></i> <div>${message}</div> </div>`; }
function showError(message) { weatherResultContainer.classList.remove('is-flipped'); weatherResultContainer.innerHTML = ` <div class="error-state"> <i class="fas fa-triangle-exclamation"></i> <span>${message}</span> </div>`; currentCoords = null; currentCityName = null; } // Reset state on error
function showInitialPrompt() { weatherResultContainer.classList.remove('is-flipped'); weatherResultContainer.innerHTML = ` <div class="initial-prompt"> <i class="fas fa-map-location-dot"></i> <div>Gib eine Stadt ein oder nutze deinen Standort.</div> </div>`; currentCoords = null; currentCityName = null; updateFavoriteButtonState(false); /* Setze Hintergrund auf Default */ setDynamicBackground(-1, 1);} // Reset state
function handleGeolocationError(error) { let msg = 'Standort nicht ermittelt.'; if(error.code===1) msg='Zugriff verweigert.'; if(error.code===2) msg='Position nicht verfügbar.'; if(error.code===3) msg='Timeout.'; showError(msg); }
function handleFetchError(error) { let msg = 'Unbekannter Fehler.'; if(error.message.includes('Stadt')&&error.message.includes('gefunden')) msg=error.message; else if(error.message.toLowerCase().includes('fetch')||error.message.toLowerCase().includes('network')) msg='Netzwerkfehler.'; else if(error.message.includes('API')||error.message.includes('Fehler')) msg='API Problem.'; else if(error.message.includes('Unvollständige')) msg='Daten unvollständig.'; else msg=`Fehler: ${error.message}`; console.error("Fetch Error Detail:", error); showError(msg); }
async function autoDetectLocation() { if (!navigator.geolocation || !navigator.permissions) { showInitialPrompt(); return; } try { const perm = await navigator.permissions.query({ name: 'geolocation' }); if (perm.state === 'granted') { getLocationWeather(true); } else { showInitialPrompt(); } perm.onchange = () => { if (perm.state === 'granted' && weatherResultContainer.querySelector('.initial-prompt, .error-state')) { getLocationWeather(true); } else if (perm.state !== 'granted' && weatherResultContainer.querySelector('.loading-state')) { showInitialPrompt(); } }; } catch (error) { console.error('Permission query failed:', error); showInitialPrompt(); } }
