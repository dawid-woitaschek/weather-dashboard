// scripts.js

// DOM Elemente, Konstanten, etc.
const cityInput = document.getElementById('city');
const weatherResultContainer = document.getElementById('weather-result');
const themeToggle = document.getElementById('theme-toggle');
const autocompleteDropdown = document.getElementById('autocomplete-dropdown');
const searchButton = document.getElementById('search-button');
const locationButton = document.getElementById('location-button');
const favoritesSelect = document.getElementById('favorites-select');
const refreshButton = document.getElementById('refresh-button');
const GEOAPIFY_API_KEY = '6b73ef3534d24e6f9f9cbbd26bdf2e99';
const FAVORITES_KEY = 'weatherAppFavorites';
let autocompleteTimeout, currentSuggestions = [], manualOverrideActive = false, currentCoords = null, currentCityName = null;
let fogContainer = null, cloudsContainer = null, rainContainer = null, snowContainer = null; // Referenzen

const weatherConditions = { 0: { icon: 'sun', desc: 'Klarer Himmel' }, 1: { icon: 'cloud-sun', desc: 'Überwiegend klar' }, 2: { icon: 'cloud', desc: 'Teilweise bewölkt' }, 3: { icon: 'cloud', desc: 'Bedeckt' }, 45: { icon: 'smog', desc: 'Nebel' }, 48: { icon: 'smog', desc: 'Gefrierender Nebel' }, 51: { icon: 'cloud-rain', desc: 'Leichter Nieselregen' }, 53: { icon: 'cloud-rain', desc: 'Mäßiger Nieselregen' }, 55: { icon: 'cloud-showers-heavy', desc: 'Starker Nieselregen' }, 56: { icon: 'snowflake', desc: 'Leichter gefrierender Nieselregen' }, 57: { icon: 'snowflake', desc: 'Starker gefrierender Nieselregen' }, 61: { icon: 'cloud-rain', desc: 'Leichter Regen' }, 63: { icon: 'cloud-showers-heavy', desc: 'Mäßiger Regen' }, 65: { icon: 'cloud-showers-heavy', desc: 'Starker Regen' }, 66: { icon: 'snowflake', desc: 'Gefrierender Regen' }, 67: { icon: 'snowflake', desc: 'Gefrierender Regen' }, 71: { icon: 'snowflake', desc: 'Leichter Schneefall' }, 73: { icon: 'snowflake', desc: 'Mäßiger Schneefall' }, 75: { icon: 'snowflake', desc: 'Starker Schneefall' }, 77: { icon: 'icicles', desc: 'Schneekörner' }, 80: { icon: 'cloud-sun-rain', desc: 'Leichte Regenschauer' }, 81: { icon: 'cloud-showers-heavy', desc: 'Mäßige Regenschauer' }, 82: { icon: 'cloud-showers-heavy', desc: 'Heftige Regenschauer' }, 85: { icon: 'snowflake', desc: 'Leichte Schneeschauer' }, 86: { icon: 'snowflake', desc: 'Starke Schneeschauer' }, 95: { icon: 'cloud-bolt', desc: 'Gewitter' }, 96: { icon: 'cloud-bolt', desc: 'Gewitter mit leichtem Hagel' }, 99: { icon: 'cloud-bolt', desc: 'Gewitter mit starkem Hagel' } };
function getWeatherCondition(code) { return weatherConditions[code] || { icon: 'question-circle', desc: `Unbekannt (${code})` }; }

// --- tsParticles Konfigurationen (ANGEPASST mit Layern) ---
const particleConfigs = {
    clear: { particles: { number: { value: 0 } } }, // Zum Leeren
    fog: { // Hintere Ebene, geblurrt
        fullScreen: { enable: false },
        particles: {
            number: { value: 25, density: { enable: true, area: 800 } },
            color: { value: "#ffffff" },
            shape: { type: "circle" },
            opacity: { value: { min: 0.05, max: 0.15 }, random: true }, // Sehr transparent
            size: { value: { min: 200, max: 400 }, random: true }, // Sehr groß
            move: { enable: true, speed: 0.3, direction: "none", random: true, outModes: { default: "out" } }
        },
        detectRetina: true, interactivity: { enabled: false }
    },
    clouds: { // Vordere Ebene, schärfer, mit Images
        fullScreen: { enable: false },
        particles: {
            number: { value: 6, density: { enable: true, area: 800 } }, // Wenige Wolkenbilder
            shape: {
                type: "image",
                options: {
                    image: [ // Beispiel-URLs - ersetzen durch eigene/bessere wenn möglich!
                        { src: "https://img.icons8.com/ios/100/ffffff/cloud.png", width: 100, height: 100 },
                        { src: "https://img.icons8.com/ios-filled/100/ffffff/cloud.png", width: 100, height: 100 },
                        { src: "https://img.icons8.com/pastel-glyph/128/ffffff/cloud--v2.png", width: 128, height: 128 }
                    ]
                }
            },
            size: { value: { min: 100, max: 180 }, random: true }, // Größe der Bilder
            opacity: { value: { min: 0.2, max: 0.4 }, random: true }, // Leicht transparent
            rotate: { value: { min: -3, max: 3 }, animation: { enable: true, speed: 0.5, sync: false } }, // Leichte Rotation
            move: { enable: true, speed: { min: 0.2, max: 0.5 }, direction: "right", random: true, straight: false, outModes: { default: "out" } }
        },
        detectRetina: true, interactivity: { enabled: false }
    },
    rain: { // Angepasst mit Rotate & Stroke
        fullScreen: { enable: false }, detectRetina: true, interactivity: { enabled: false },
        particles: {
            number: { value: 150, density: { enable: true, area: 800 } },
            color: { value: "#ffffff" },
            shape: { type: "line", stroke: { width: 1, color: "#ffffff" } },
            opacity: { value: 0.6, random: { enable: true, minimumValue: 0.3 } },
            size: { value: 10, random: { enable: true, minimumValue: 5 } },
            rotate: { value: 90, random: false, animation: { enable: false } },
            move: { enable: true, speed: { min: 8, max: 15 }, direction: "bottom", straight: true, random: true, outModes: { default: "out" } },
        },
        backgroundMode: { enable: false } // CSS regelt z-index
    },
    snow: { // Angepasst
        fullScreen: { enable: false }, detectRetina: true, interactivity: { enabled: false },
        particles: {
            number: { value: 100, density: { enable: true, area: 800 } },
            color: { value: "#ffffff" }, shape: { type: "circle" },
            opacity: { value: 0.8, random: { enable: true, minimumValue: 0.5 } },
            size: { value: 3, random: { enable: true, minimumValue: 1 } },
            move: { enable: true, speed: 0.9, direction: "bottom", random: true, straight: false, outModes: { default: "out" } },
        },
        backgroundMode: { enable: false }
    }
};

// --- Restliches JavaScript (Initialisierung bis Ende) ---
document.addEventListener('DOMContentLoaded', () => { initializeTheme(); loadFavorites(); setupEventListeners(); autoDetectLocation(); });
function setupEventListeners() { cityInput.addEventListener('input', handleAutocompleteInput); cityInput.addEventListener('keydown', handleInputKeydown); searchButton.addEventListener('click', getWeatherByCityName); locationButton.addEventListener('click', () => getLocationWeather(false)); themeToggle.addEventListener('click', toggleThemeManually); favoritesSelect.addEventListener('change', handleFavoriteSelection); refreshButton.addEventListener('click', handleRefresh); document.addEventListener('click', handleClickOutsideAutocomplete); document.addEventListener('keydown', handleEscapeKey); weatherResultContainer.addEventListener('click', handleCardClicks); }
function initializeTheme() { const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches; if (prefersLight) { applyLightTheme(); } else { applyDarkTheme(); } updateThemeToggleIcon(); if (window.matchMedia) { const q = window.matchMedia('(prefers-color-scheme: light)'); q.addEventListener('change', (e) => { if (!manualOverrideActive) { if (e.matches) { applyLightTheme(); } else { applyDarkTheme(); } updateThemeToggleIcon(); if(currentCoords) handleRefresh(); } }); } }
function toggleThemeManually() { manualOverrideActive = true; const isLight = document.body.classList.contains('light-theme'); if (isLight) { applyDarkTheme(); } else { applyLightTheme(); } updateThemeToggleIcon(); if(currentCoords) handleRefresh(); }
function applyLightTheme() { document.body.classList.add('light-theme'); } function applyDarkTheme() { document.body.classList.remove('light-theme'); }
function updateThemeToggleIcon() { if (document.body.classList.contains('light-theme')) { themeToggle.innerHTML = '<i class="fas fa-moon"></i>'; themeToggle.setAttribute('aria-label', 'Temporär in Dark Mode wechseln'); } else { themeToggle.innerHTML = '<i class="fas fa-sun"></i>'; themeToggle.setAttribute('aria-label', 'Temporär in Light Mode wechseln'); } }
function getFavorites() { const f = localStorage.getItem(FAVORITES_KEY); return f ? JSON.parse(f) : []; }
function saveFavorites(f) { localStorage.setItem(FAVORITES_KEY, JSON.stringify(f)); loadFavorites(); }
function loadFavorites() { const f = getFavorites(); favoritesSelect.innerHTML = '<option value="">Favoriten...</option>'; f.forEach((fav, i) => { const o = document.createElement('option'); o.value = i; o.textContent = fav.name; favoritesSelect.appendChild(o); }); }
function addFavorite(n, la, lo) { if (!n || la === null || lo === null) return; const f = getFavorites(); if (!f.some(fav => fav.lat === la && fav.lon === lo)) { f.push({ name: n, lat: la, lon: lo }); saveFavorites(f); updateFavoriteButtonState(true); } }
function handleFavoriteSelection() { const i = favoritesSelect.value; if (i === "") return; const f = getFavorites(); const s = f[parseInt(i)]; if (s) { cityInput.value = s.name; getWeatherFromCoords(s.lat, s.lon, s.name); } favoritesSelect.value = ""; }
function updateFavoriteButtonState(isFav) { const b = document.getElementById('add-favorite-button'); if (b) { b.classList.toggle('is-favorite', isFav); b.innerHTML = isFav ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>'; b.title = isFav ? 'Aus Favoriten entfernen (noch nicht implementiert)' : 'Zu Favoriten hinzufügen'; } }
function handleRefresh() { if (currentCoords) { const i = refreshButton.querySelector('i'); i?.classList.add('fa-spin'); getWeatherFromCoords(currentCoords.lat, currentCoords.lon, currentCityName).finally(() => { i?.classList.remove('fa-spin'); }); } else { getLocationWeather(false); } }
function handleCardClicks(event) { if (event.target.closest('.flip-button-to-back')) { weatherResultContainer.classList.add('is-flipped'); } if (event.target.closest('.flip-button-to-front')) { weatherResultContainer.classList.remove('is-flipped'); } if (event.target.closest('#add-favorite-button')) { const f = getFavorites(); const isCF = f.some(fav => fav.lat === currentCoords?.lat && fav.lon === currentCoords?.lon); if (isCF) { console.log("Entfernen nicht implementiert"); } else if (currentCityName && currentCoords) { addFavorite(currentCityName, currentCoords.lat, currentCoords.lon); } } }
function handleAutocompleteInput(e) { clearTimeout(autocompleteTimeout); const s = e.target.value.trim(); if (s.length < 2) { hideAutocomplete(); return; } autocompleteTimeout = setTimeout(async () => { try { const r = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(s)}&type=city&lang=de&limit=5&format=json&apiKey=${GEOAPIFY_API_KEY}`); if (!r.ok) throw Error('Autocomplete API failed'); const d = await r.json(); currentSuggestions = d.results || []; showAutocompleteSuggestions(currentSuggestions); } catch (err) { console.error(err); hideAutocomplete(); } }, 300); }
function showAutocompleteSuggestions(suggestions) { if (!suggestions || suggestions.length === 0) { hideAutocomplete(); return; } autocompleteDropdown.innerHTML = suggestions.map(s => { const c = s.city || s.name || s.address_line1; const co = s.country; const dn = c && co ? `${c}, ${co}` : s.formatted; return `<div class="autocomplete-item" data-lat="${s.lat}" data-lon="${s.lon}" data-name="${dn}">${highlightMatch(dn, cityInput.value)}</div>`; }).join(''); document.querySelectorAll('.autocomplete-item').forEach(i => { i.addEventListener('click', () => { const n = i.dataset.name; const la = parseFloat(i.dataset.lat); const lo = parseFloat(i.dataset.lon); cityInput.value = n; hideAutocomplete(); cityInput.blur(); getWeatherFromCoords(la, lo, n); }); }); autocompleteDropdown.style.display = 'block'; }
function hideAutocomplete() { autocompleteDropdown.style.display = 'none'; autocompleteDropdown.innerHTML = ''; currentSuggestions = []; }
function handleInputKeydown(e) { if (e.key === 'Enter') { e.preventDefault(); if (autocompleteDropdown.style.display === 'block' && currentSuggestions.length > 0) { const f = autocompleteDropdown.querySelector('.autocomplete-item'); if (f) f.click(); } else { hideAutocomplete(); getWeatherByCityName(); } cityInput.blur(); } else if (e.key === 'Escape') { hideAutocomplete(); } }
function handleClickOutsideAutocomplete(e) { if (!e.target.closest('.autocomplete-container')) { hideAutocomplete(); } }
function handleEscapeKey(e) { if (e.key === 'Escape') { hideAutocomplete(); } }
function highlightMatch(text, query) { if (!query || !text) return text || ''; const eq = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const rgx = new RegExp(`(${eq})`, 'gi'); return text.replace(rgx, '<b>$1</b>'); }
async function getWeatherByCityName() { const city = cityInput.value.trim(); if (!city) { showError('Bitte gib einen Stadtnamen ein.'); return; } showLoading('Suche Stadt...'); hideAutocomplete(); try { const geoR = await fetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(city)}&limit=1&lang=de&format=json&apiKey=${GEOAPIFY_API_KEY}`); if (!geoR.ok) throw new Error(`Geoapify Search Fehler: ${geoR.status}`); const geoD = await geoR.json(); if (!geoD.results || geoD.results.length === 0) { throw new Error(`Stadt "${city}" nicht gefunden.`); } const { lat, lon, formatted } = geoD.results[0]; const locN = geoD.results[0].city || formatted; await getWeatherFromCoords(lat, lon, locN); } catch (error) { console.error('Fehler bei Stadtsuche:', error); handleFetchError(error); } }
async function getLocationWeather(isAutoDetect = false) { if (!navigator.geolocation) { showError('Geolocation nicht unterstützt.'); return; } showLoading('Ermittle Standort...'); navigator.geolocation.getCurrentPosition( async (pos) => { const { latitude, longitude } = pos.coords; try { const revGeoR = await fetch(`https://api.geoapify.com/v1/geocode/reverse?lat=${latitude}&lon=${longitude}&lang=de&format=json&apiKey=${GEOAPIFY_API_KEY}`); let locN = `Lat: ${latitude.toFixed(2)}, Lon: ${longitude.toFixed(2)}`; if (revGeoR.ok) { const locD = await revGeoR.json(); if (locD.results?.length > 0) { locN = locD.results[0].city || locD.results[0].village || locD.results[0].suburb || locD.results[0].formatted; } } await getWeatherFromCoords(latitude, longitude, locN); } catch (error) { console.error('Fehler nach Standort-Ermittlung:', error); await getWeatherFromCoords(latitude, longitude, `Lat: ${latitude.toFixed(2)}, Lon: ${longitude.toFixed(2)}`); } }, (err) => { console.error('Geolocation Fehler:', err); if (!isAutoDetect) { handleGeolocationError(err); } else { showInitialPrompt(); } }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }); }
async function getWeatherFromCoords(lat, lon, locationName) { currentCoords = { lat, lon }; currentCityName = locationName; showLoading(`Lade Wetter für ${locationName}...`); const params = [ `latitude=${lat.toFixed(4)}`,`longitude=${lon.toFixed(4)}`, 'current=temperature_2m,relativehumidity_2m,apparent_temperature,is_day,precipitation,weathercode,surface_pressure,windspeed_10m,winddirection_10m,uv_index', 'hourly=temperature_2m,relativehumidity_2m,precipitation_probability,weathercode,surface_pressure,uv_index,precipitation', 'daily=weathercode,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max', 'temperature_unit=celsius', 'windspeed_unit=kmh', 'precipitation_unit=mm', 'timezone=auto', 'forecast_days=7' ]; const apiUrl = `https://api.open-meteo.com/v1/forecast?${params.join('&')}`; try { const r = await fetch(apiUrl); if (!r.ok) { const eD = await r.json().catch(() => ({})); throw new Error(`Open-Meteo Fehler: ${r.status} ${eD.reason || ''}`); } const d = await r.json(); if (!d.current || !d.hourly || !d.daily) { throw new Error('Unvollständige Wetterdaten empfangen.'); } renderWeatherCards(locationName, d); weatherResultContainer.classList.remove('is-flipped'); setDynamicBackground(d.current.weathercode, d.current.is_day); const favs = getFavorites(); const isFav = favs.some(fav => fav.lat === lat && fav.lon === lon); updateFavoriteButtonState(isFav); } catch (error) { console.error('Fehler beim Abrufen/Verarbeiten der Wetterdaten:', error); handleFetchError(error); } }
function renderWeatherCards(location, weatherData) { const { current, hourly, daily } = weatherData; const currentCondition = getWeatherCondition(current.weathercode); const formatTime = (d) => new Date(d).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); const getDayName = (d, f = 'short') => new Date(d).toLocaleDateString('de-DE', { weekday: f }); const getUVDesc = (uv) => { if (uv===null || uv===undefined) return ''; const rUv=Math.round(uv); if (rUv <= 2) return 'Niedrig'; if (rUv <= 5) return 'Mittel'; if (rUv <= 7) return 'Hoch'; if (rUv <= 10) return 'Sehr hoch'; return 'Extrem'; }; let currentHourIndex = hourly.time.findIndex(t => new Date(t) >= new Date()); if (currentHourIndex > 0) currentHourIndex--; else if (currentHourIndex === -1) currentHourIndex = hourly.time.length - 1; const currentPrecip = (currentHourIndex !== -1 && hourly.precipitation[currentHourIndex] !== null) ? hourly.precipitation[currentHourIndex] : current.precipitation; const frontHTML = ` <div class="card-face card-front"> <div> <div class="current-weather-header"> <div class="location-info"> <span class="location-name">${location}</span> <button id="add-favorite-button" title="Zu Favoriten hinzufügen"> <i class="far fa-heart"></i> </button> </div> </div> <div class="current-weather-main"> <i class="fas fa-${currentCondition.icon} weather-icon-large"></i> <div class="temp-feels-desc"> <div class="temperature-now">${Math.round(current.temperature_2m)}°C</div> <div class="feels-like">Gefühlt ${Math.round(current.apparent_temperature)}°</div> <div class="weather-description">${currentCondition.desc}</div> </div> </div> <div class="details-grid"> <div class="detail-item"> <div class="label"><i class="fas fa-temperature-high"></i> Max</div> <div class="value">${Math.round(daily.temperature_2m_max[0] ?? '--')}°</div> </div> <div class="detail-item"> <div class="label"><i class="fas fa-temperature-low"></i> Min</div> <div class="value">${Math.round(daily.temperature_2m_min[0] ?? '--')}°</div> </div> <div class="detail-item"> <div class="label"><i class="fas fa-wind"></i> Wind</div> <div class="value"> ${Math.round(current.windspeed_10m)}<span class="unit">km/h</span> <i class="fas fa-location-arrow wind-dir-icon" style="transform: rotate(${current.winddirection_10m - 45}deg);" title="${current.winddirection_10m}°"></i> </div> </div> <div class="detail-item"> <div class="label"><i class="fas fa-tint"></i> Feuchte</div> <div class="value">${current.relativehumidity_2m}<span class="unit">%</span></div> </div> <div class="detail-item"> <div class="label"><i class="fas fa-cloud-showers-heavy"></i> Niederschl.</div> <div class="value">${currentPrecip}<span class="unit">mm</span></div> </div> <div class="detail-item"> <div class="label"><i class="fas fa-tachometer-alt"></i> Druck</div> <div class="value">${Math.round(current.surface_pressure)}<span class="unit">hPa</span></div> </div> <div class="detail-item"> <div class="label"><i class="fas fa-sun"></i> UV-Index</div> <div class="value">${Math.round(current.uv_index ?? 0)} <span class="unit uv-desc" style="font-size: 0.8em;">${getUVDesc(current.uv_index)}</span></div> </div> <div class="detail-item"> <div class="label"><i class="fas fa-sunrise"></i> Aufgang</div> <div class="value">${formatTime(daily.sunrise[0])}</div> </div> <div class="detail-item"> <div class="label"><i class="fas fa-sunset"></i> Untergang</div> <div class="value">${formatTime(daily.sunset[0])}</div> </div> </div> </div> <button class="flip-button flip-button-to-back"> <i class="fas fa-calendar-alt"></i> Vorhersage ansehen </button> </div>`; const hTemps = hourly.temperature_2m.slice(currentHourIndex, currentHourIndex + 24); const chart = generateTemperatureChart(hTemps); let hHTML = ''; if (currentHourIndex !== -1) { for (let i = currentHourIndex; i < Math.min(currentHourIndex + 24, hourly.time.length); i++) { const tStr = formatTime(hourly.time[i]); const t = Math.round(hourly.temperature_2m[i]); const c = getWeatherCondition(hourly.weathercode[i]); const pP = hourly.precipitation_probability[i]; hHTML += `<div class="forecast-item"> <div class="time">${tStr}</div> <i class="fas fa-${c.icon} weather-icon-small"></i> <div class="temp">${t}°</div> ${pP !== null ? `<div class="precip-prob" title="Niederschlagsrisiko"><i class="fas fa-tint"></i> ${pP}%</div>` : ''} </div>`; } } let dHTML = ''; for (let i = 0; i < daily.time.length; i++) { const dN = (i === 0) ? 'Heute' : getDayName(daily.time[i]); const maxT = Math.round(daily.temperature_2m_max[i]); const minT = Math.round(daily.temperature_2m_min[i]); const c = getWeatherCondition(daily.weathercode[i]); const pP = daily.precipitation_probability_max[i]; dHTML += `<div class="forecast-item"> <div class="day">${dN}</div> <i class="fas fa-${c.icon} weather-icon-small"></i> <div class="temp">${maxT}°</div> <div class="temp-low">${minT}°</div> ${pP !== null ? `<div class="precip-prob" title="Max. Niederschlagsrisiko"><i class="fas fa-tint"></i> ${pP}%</div>` : ''} </div>`; } const backHTML = ` <div class="card-face card-back"> <div class="forecast-content"> <div class="forecast-chart-container">${chart}</div> <div class="forecast-section"> <h3>Stündlich (24h)</h3> <div class="forecast-list">${hHTML || 'N/A'}</div> </div> <div class="forecast-section"> <h3>Täglich (7 Tage)</h3> <div class="forecast-list">${dHTML || 'N/A'}</div> </div> </div> <button class="flip-button flip-button-to-front"> <i class="fas fa-arrow-left"></i> Zurück </button> </div>`; weatherResultContainer.innerHTML = frontHTML + backHTML; }
function generateTemperatureChart(temps) { if (!temps || temps.length < 2) return '<div style="text-align:center;color:var(--text-secondary);font-size:0.9em;">Temperaturverlauf nicht verfügbar.</div>'; const width = 300; const height = 60; const padding = 5; const chartHeight = height - 2 * padding; const vTemps = temps.filter(t=>t !== null && t !== undefined); if (vTemps.length < 2) return '<div style="text-align:center;color:var(--text-secondary);font-size:0.9em;">Zu wenig Daten für Verlauf.</div>'; const minT = Math.min(...vTemps); const maxT = Math.max(...vTemps); const tRange = Math.max(maxT - minT, 1); const scaleX = (i) => (width / (temps.length - 1)) * i; const scaleY = (t) => chartHeight - ((t - minT) / tRange) * chartHeight + padding; let path = ''; let points = ''; let first = true; temps.forEach((t, i) => { if (t !== null && t !== undefined) { const x = scaleX(i).toFixed(2); const y = scaleY(t).toFixed(2); path += `${first ? 'M' : 'L'} ${x} ${y} `; points += `<circle cx="${x}" cy="${y}" r="2.5" class="chart-dot" />`; first = false; } }); if (!path) return '<div style="text-align:center;color:var(--text-secondary);font-size:0.9em;">Temperaturverlauf nicht verfügbar.</div>'; return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet"><path d="${path.trim()}" class="chart-line" />${points}</svg>`; }

// --- Dynamischer Hintergrund & Partikel (ANGEPASST mit 2 Layern) ---
function setDynamicBackground(weathercode, isDay) {
    let colorClass = '';
    let fogConfigKey = 'clear'; // Standard: Hintere Ebene leer
    let cloudsConfigKey = 'clear'; // Standard: Vordere Ebene leer
    let rainSnowConfigKey = 'clear'; // Für Regen/Schnee auf einer Ebene

    const wc = Number(weathercode);
    const isClear = wc <= 1;
    const isCloudy = (wc >= 2 && wc <= 3);
    const isFog = wc === 45 || wc === 48;
    const isRain = (wc >= 51 && wc <= 67) || (wc >= 80 && wc <= 82) || wc === 95 || wc === 96 || wc === 99;
    const isSnow = (wc >= 71 && wc <= 77) || (wc >= 85 && wc <= 86);

    // 1. Farb-Klasse für Body-Gradient setzen
    if (isDay === 0) { // Nacht
        if (isClear) colorClass = 'weather-clear-night';
        else if (isCloudy || isFog) colorClass = 'weather-cloudy-night';
        else if (isRain) colorClass = 'weather-rain';
        else if (isSnow) colorClass = 'weather-snow';
        else colorClass = 'weather-cloudy-night';
    } else { // Tag
        if (isClear) colorClass = 'weather-clear-day';
        else if (isCloudy || isFog) colorClass = 'weather-cloudy-day';
        else if (isRain) colorClass = 'weather-rain';
        else if (isSnow) colorClass = 'weather-snow';
        else colorClass = 'weather-cloudy-day';
    }
    document.body.className = document.body.className.replace(/weather-\S+/g, '').trim();
    if (colorClass) document.body.classList.add(colorClass);

    // 2. Theme-Klasse (light/dark) sicherstellen
    const isLightTheme = document.body.classList.contains('light-theme');
    const shouldBeLight = manualOverrideActive ? isLightTheme : (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
    if(shouldBeLight && !isLightTheme) document.body.classList.add('light-theme');
    else if (!shouldBeLight && isLightTheme) document.body.classList.remove('light-theme');

    // 3. Passende Partikel-Konfiguration(en) auswählen
    if (isRain) {
        rainSnowConfigKey = 'rain'; // Regen auf einer Ebene
    } else if (isSnow) {
        rainSnowConfigKey = 'snow'; // Schnee auf einer Ebene
    } else if (isCloudy || isFog) {
        fogConfigKey = 'fog';     // Nebel/dünne Wolken auf hinterer Ebene
        cloudsConfigKey = 'clouds'; // Dickere Wolkenbilder auf vorderer Ebene
    }
    // Bei 'clear' bleiben alle 'clear'

    // 4. tsParticles laden/aktualisieren (für alle Layer)
    if (typeof tsParticles !== 'undefined') {
        // Lade/Leere Fog/Rain/Snow Layer (Container 1)
        let config1 = JSON.parse(JSON.stringify(particleConfigs[isRain ? 'rain' : (isSnow ? 'snow' : fogConfigKey)]));
        tsParticles.load("tsparticles-fog", config1)
            .then(container => { fogContainer = container; /*console.log("Fog/Rain/Snow Layer loaded", config1.particles?.number?.value);*/ })
            .catch(error => { console.error("tsParticles load error (Fog/Rain/Snow):", error); fogContainer = null; });

        // Lade/Leere Clouds Layer (Container 2)
        let config2 = JSON.parse(JSON.stringify(particleConfigs[cloudsConfigKey]));
        tsParticles.load("tsparticles-clouds", config2)
            .then(container => { cloudsContainer = container; /*console.log("Clouds Layer loaded", config2.particles?.number?.value);*/ })
            .catch(error => { console.error("tsParticles load error (Clouds):", error); cloudsContainer = null; });

    } else {
        console.error("tsParticles library is not loaded.");
    }
}

// --- Loading, Error, Initial Prompt States (müssen beide Container leeren) ---
function clearAllParticles() {
    if (typeof tsParticles !== 'undefined') {
        tsParticles.load("tsparticles-fog", particleConfigs.clear).catch(e => console.error("Error clearing fog layer", e));
        tsParticles.load("tsparticles-clouds", particleConfigs.clear).catch(e => console.error("Error clearing clouds layer", e));
        fogContainer = null;
        cloudsContainer = null;
    }
}
function showLoading(message = "Lade...") {
    weatherResultContainer.classList.remove('is-flipped');
    weatherResultContainer.innerHTML = `<div class="loading-state"><i class="fas fa-spinner fa-spin"></i><div>${message}</div></div>`;
    clearAllParticles();
}
function showError(message) {
    weatherResultContainer.classList.remove('is-flipped');
    weatherResultContainer.innerHTML = `<div class="error-state"><i class="fas fa-triangle-exclamation"></i><span>${message}</span></div>`;
    currentCoords = null; currentCityName = null;
    setDynamicBackground(-1, 1); // Setzt auch Partikel auf 'clear'
}
function showInitialPrompt() {
    weatherResultContainer.classList.remove('is-flipped');
    weatherResultContainer.innerHTML = `<div class="initial-prompt"><i class="fas fa-map-location-dot"></i><div>Gib eine Stadt ein oder nutze deinen Standort.</div></div>`;
    currentCoords = null; currentCityName = null;
    updateFavoriteButtonState(false);
    setDynamicBackground(-1, 1); // Setzt auch Partikel auf 'clear'
}
// --- Fehlerbehandlung, Standort-Automatik (unverändert) ---
function handleGeolocationError(error) { let msg = 'Standort nicht ermittelt.'; if(error.code===1) msg='Zugriff verweigert.'; if(error.code===2) msg='Position nicht verfügbar.'; if(error.code===3) msg='Timeout.'; showError(msg); }
function handleFetchError(error) { let msg = 'Unbekannter Fehler.'; if(error.message.includes('Stadt')&&error.message.includes('gefunden')) msg=error.message; else if(error.message.toLowerCase().includes('fetch')||error.message.toLowerCase().includes('network')) msg='Netzwerkfehler.'; else if(error.message.includes('API')||error.message.includes('Fehler')) msg='API Problem.'; else if(error.message.includes('Unvollständige')) msg='Daten unvollständig.'; else msg=`Fehler: ${error.message}`; console.error("Fetch Error Detail:", error); showError(msg); }
async function autoDetectLocation() { if (!navigator.geolocation || !navigator.permissions) { showInitialPrompt(); return; } try { const perm = await navigator.permissions.query({ name: 'geolocation' }); if (perm.state === 'granted') { getLocationWeather(true); } else { showInitialPrompt(); } perm.onchange = () => { if (perm.state === 'granted' && weatherResultContainer.querySelector('.initial-prompt, .error-state')) { getLocationWeather(true); } else if (perm.state !== 'granted' && weatherResultContainer.querySelector('.loading-state')) { showInitialPrompt(); } }; } catch (error) { console.error('Permission query failed:', error); showInitialPrompt(); } }

