// 📝 Fetch all DOM nodes in jQuery and Snap SVG
var container = $('.container');
var card = $('#card');
var innerSVG = Snap('#inner');
var outerSVG = Snap('#outer');
var backSVG = Snap('#back');
var summary = $('#summary');
var date = $('#date');
var temp = $('.temp');
var locationNameElement = $('#location-name'); // Referenz Ortsname

// *** NEU: Referenzen für Suche ***
var searchContainer = $('#location-search-container');
var searchInput = $('#location-search-input');
var suggestionsContainer = $('#location-suggestions');
var geolocationButton = $('#geolocation-button');
var flipButton = $('#flip-forecast');
var forecastList = $('#forecast-list');
var isFlipped = false;

// Referenzen für Animationen (aus Ur-Fassung)
var weatherContainer1 = Snap.select('#layer1');
var weatherContainer2 = Snap.select('#layer2');
var weatherContainer3 = Snap.select('#layer3');
var innerRainHolder1 = weatherContainer1 ? weatherContainer1.group() : null; // Sicherstellen, dass Container existiert
var innerRainHolder2 = weatherContainer2 ? weatherContainer2.group() : null;
var innerRainHolder3 = weatherContainer3 ? weatherContainer3.group() : null;
var innerLeafHolder = weatherContainer1 ? weatherContainer1.group() : null;
var innerSnowHolder = weatherContainer1 ? weatherContainer1.group() : null;
var innerLightningHolder = weatherContainer1 ? weatherContainer1.group() : null; // Wird für Blitz verwendet
var leafMask = outerSVG ? outerSVG.rect() : null; // Sicherstellen, dass outerSVG existiert
var leaf = Snap.select('#leaf');
var sun = Snap.select('#sun');
var sunburst = Snap.select('#sunburst');
var outerSplashHolder = outerSVG ? outerSVG.group() : null;
var outerLeafHolder = outerSVG ? outerSVG.group() : null;
var outerSnowHolder = outerSVG ? outerSVG.group() : null;

var lightningTimeout;
var geocodeTimeout; // Für Debounce der Suche

// GSAP Plugin Registrierung
if (window.gsap && window.MotionPathPlugin) {
    try {
        gsap.registerPlugin(MotionPathPlugin);
        console.log("GSAP MotionPathPlugin registered.");
    } catch (e) {
        console.error("Error registering MotionPathPlugin:", e);
    }
} else {
    console.error("GSAP or MotionPathPlugin is not loaded!");
}

// Set mask for leaf holder (aus Ur-Fassung, mit Check)
if (outerLeafHolder && leafMask) {
    outerLeafHolder.attr({
    	'clip-path': leafMask
    });
} else {
    console.error("outerLeafHolder or leafMask could not be initialized for clip-path.");
}

// create sizes object, we update this later (aus Ur-Fassung)
var sizes = {
	container: {width: 0, height: 0},
	card: {width: 0, height: 0}
}

// grab cloud groups (aus Ur-Fassung)
var clouds = [
	{group: Snap.select('#cloud1'), offset: 0},
	{group: Snap.select('#cloud2'), offset: 0},
	{group: Snap.select('#cloud3'), offset: 0}
]

// set weather types ☁️ 🌬 🌧 ⛈ ☀️ (aus Ur-Fassung)
var weather = [
	{ type: 'snow', name: 'Schnee'},
	{ type: 'wind', name: 'Windig'},
	{ type: 'rain', name: 'Regen'},
	{ type: 'thunder', name: 'Gewitter'},
	{ type: 'sun', name: 'Sonnig'},
	{ type: 'cloudy', name: 'Bewölkt'}
];
var currentWeather = null;
var currentLat = 51.51; // Default Dortmund
var currentLon = 7.46;  // Default Dortmund
var currentLocationName = "Dortmund"; // Default Name

// 🛠 app settings (aus Ur-Fassung)
var settings = {
	windSpeed: 2, rainCount: 0, leafCount: 0, snowCount: 0,
	cloudHeight: 100, cloudSpace: 30, cloudArch: 50,
	renewCheck: 10, splashBounce: 80
};

var tickCount = 0;
var rain = []; var leafs = []; var snow = [];

// --- Geocoding & Wetter API (Neue/Angepasste Logik) ---
const GEOCODING_API_URL_BASE = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_API_URL_BASE = "https://api.open-meteo.com/v1/forecast";

function fetchGeocodingData(query) {
    const url = `${GEOCODING_API_URL_BASE}?name=${encodeURIComponent(query)}&count=20&language=de&format=json`;
    console.log("Requesting Geocoding URL:", url);
    $.get(url)
        .done(function(data) { /* ... (displaySuggestions logic) ... */ displaySuggestions(data.results); })
        .fail(function(jqXHR, textStatus, errorThrown) { console.error("Geocoding API Failed:", textStatus, errorThrown); suggestionsContainer.empty().hide(); });
}

function displaySuggestions(results) {
    // ... (komplette Logik aus vorheriger Version für Sortierung, Deduplizierung, Anzeige) ...
    suggestionsContainer.empty().hide(); if (!results || results.length === 0) return;
    const europeanCountries = ['ES', 'FR', 'PT', 'IT', 'PL', 'FI', 'SE', 'NO', 'AT', 'CH', 'NL', 'BE', 'LU', 'DK', 'GB', 'IE']; const featureCodeBonus = { 'PPLC': 10000, 'PPLA': 5000 };
    results.sort((a, b) => { let scoreA = 0, scoreB = 0; if (a.country_code === 'DE') scoreA += 100000; else if (europeanCountries.includes(a.country_code)) scoreA += 50000; else if (a.country_code === 'US') scoreA += 25000; if (b.country_code === 'DE') scoreB += 100000; else if (europeanCountries.includes(b.country_code)) scoreB += 50000; else if (b.country_code === 'US') scoreB += 25000; scoreA += featureCodeBonus[a.feature_code] || 0; scoreB += featureCodeBonus[b.feature_code] || 0; scoreA += (a.population || 0); scoreB += (b.population || 0); return scoreB - scoreA; });
    const uniqueLocations = []; const seenKeys = new Set();
    results.forEach(location => { const latRounded = Math.round(location.latitude * 100); const lonRounded = Math.round(location.longitude * 100); const key = `${location.name.toLowerCase()}_${location.country_code}_${latRounded}_${lonRounded}`; if (!seenKeys.has(key)) { uniqueLocations.push(location); seenKeys.add(key); } });
    const maxSuggestions = 10;
    uniqueLocations.slice(0, maxSuggestions).forEach(location => { let details = []; if (location.admin1 && location.admin1 !== location.name) details.push(location.admin1); if (location.country) details.push(location.country); details = [...new Set(details)]; const suggestionHTML = `<div data-lat="${location.latitude}" data-lon="${location.longitude}" data-name="${location.name}">${location.name}${details.length > 0 ? `<span class="suggestion-details">(${details.join(', ')})</span>` : ''}</div>`; suggestionsContainer.append(suggestionHTML); });
    if (uniqueLocations.length > 0) { $('#location-suggestions div').on('click', function() { const lat = $(this).data('lat'); const lon = $(this).data('lon'); const name = $(this).data('name'); console.log(`Suggestion selected: ${name} (${lat}, ${lon})`); currentLat = lat; currentLon = lon; currentLocationName = name; fetchWeatherData(lat, lon, name); searchInput.val(name); suggestionsContainer.empty().hide(); }); suggestionsContainer.show(); }
}

function fetchWeatherData(latitude, longitude, locationName = "Aktueller Standort") {
    const weatherApiUrl = `${WEATHER_API_URL_BASE}?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto&temperature_unit=celsius`;
    console.log("1. fetchWeatherData called for:", locationName, weatherApiUrl); // Log 1 + URL
    locationNameElement.text(locationName); summary.text("Lädt..."); temp.html("--<span>c</span>");

    $.get(weatherApiUrl)
        .done(function(data) {
            console.log("2. API Call Success. Data:", data); // Log 2
            if (data && data.current && data.current.temperature_2m !== undefined && data.current.weather_code !== undefined) {
                const current = data.current; const tempValue = Math.round(current.temperature_2m); const weatherCode = current.weather_code;
                console.log("3. Weather data parsed. Temp:", tempValue, "Code:", weatherCode); // Log 3
                temp.html(tempValue + '<span>c</span>'); updateDate();
                const weatherType = getWeatherTypeFromCode(weatherCode);
                const targetWeather = weather.find(w => w.type === weatherType);
                if (targetWeather) {
                    console.log("4. Calling changeWeather with:", targetWeather); // Log 4
                    changeWeather(targetWeather);
                } else {
                    console.warn("Unbekannter Wettercode:", weatherCode);
                    const fallbackWeather = weather.find(w => w.type === 'cloudy');
                    console.log("4b. Calling changeWeather with fallback:", fallbackWeather); // Log 4b
                    changeWeather(fallbackWeather);
                }
            } else {
                console.error("API response structure invalid."); // Log Error
                handleApiError("Ungültige Wetter-API-Antwortstruktur.");
            }
        })
        .fail(function(jqXHR, textStatus, errorThrown) {
            console.error("5. API Call Failed:", textStatus, errorThrown); // Log 5
            handleApiError(`Wetterdaten konnten nicht geladen werden (${textStatus})`);
        });
}

function fetchForecastData(latitude, longitude) {
    const forecastUrl = `${WEATHER_API_URL_BASE}?latitude=${latitude}&longitude=${longitude}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3`;
    $.get(forecastUrl)
        .done(function(data) {
            if (data && data.daily && data.daily.time) {
                forecastList.empty();
                data.daily.time.forEach(function(dateStr, idx) {
                    var code = data.daily.weathercode[idx];
                    var maxT = Math.round(data.daily.temperature_2m_max[idx]);
                    var minT = Math.round(data.daily.temperature_2m_min[idx]);
                    var type = getWeatherTypeFromCode(code);
                    var entry = weather.find(w => w.type === type);
                    var label = entry ? entry.name : type;
                    var dateLabel = new Date(dateStr).toLocaleDateString('de-DE', {weekday:'short', day:'numeric', month:'numeric'});
                    forecastList.append(`<li>${dateLabel}: ${label} ${minT}°C - ${maxT}°C</li>`);
                });
            } else {
                forecastList.html('<li>Keine Vorhersagedaten</li>');
            }
        })
        .fail(function() {
            forecastList.html('<li>Vorhersage konnte nicht geladen werden.</li>');
        });
}

function handleApiError(errorMsg) { console.error("Fehler:", errorMsg); temp.html("--<span>c</span>"); summary.text("Fehler"); date.text("Keine Daten"); locationNameElement.text("Ort unbekannt"); }
function getWeatherTypeFromCode(code) { /* ... (Mapping wie gehabt) ... */ if ([0, 1].includes(code)) return 'sun'; if ([2, 3].includes(code)) return 'cloudy'; if ([45, 48].includes(code)) return 'wind'; if ([51, 53, 55, 56, 57].includes(code)) return 'rain'; if ([61, 63, 65, 66, 67].includes(code)) return 'rain'; if ([71, 73, 75, 77].includes(code)) return 'snow'; if ([80, 81, 82].includes(code)) return 'rain'; if ([85, 86].includes(code)) return 'snow'; if ([95, 96, 99].includes(code)) return 'thunder'; console.warn("Unbekannter Wettercode:", code); return 'cloudy'; }
function updateDate() { const now = new Date(); const options = { weekday: 'long', day: 'numeric', month: 'long' }; const formattedDate = now.toLocaleDateString('de-DE', options); date.text(formattedDate); }
// --- Ende API / Suche Logik ---

// ⚙ initialize app (aus Ur-Fassung, angepasst für fetchWeatherData)
function init() {
    console.log("0. init() called"); // Log 0
    onResize();
    console.log("0a. onResize finished.");
    for(var i = 0; i < weather.length; i++) { var w = weather[i]; var b = $('#button-' + w.type); if (b.length === 0) { console.warn("Button not found for:", w.type); continue; } w.button = b; b.bind('click', w, changeWeather); }
    console.log("0b. Buttons bound.");
    for(var i = 0; i < clouds.length; i++) { if (clouds[i] && clouds[i].group) { clouds[i].offset = Math.random() * sizes.card.width; drawCloud(clouds[i], i); gsap.set(clouds[i].group.node, { x: clouds[i].offset }); } else { console.warn("Cloud group missing for index:", i); } }
    console.log("0c. Clouds drawn.");
    fetchWeatherData(currentLat, currentLon, currentLocationName); // Initiale Wetterdaten laden
    console.log("0d. Initial fetchWeatherData called.");
    requestAnimationFrame(tick);
    console.log("0e. init() finished, first tick requested."); // Log 0e
}

// 👁 watch for window resize (aus Ur-Fassung)
$(window).resize(onResize);

// --- Event Listener für Suche & Geolocation (Neue Logik) ---
$(document).ready(function() {
    console.log("Document ready. Binding search listeners.");
    // ... (Listener wie gehabt) ...
    searchInput.on('input', function() { clearTimeout(geocodeTimeout); const query = $(this).val(); if (query.length >= 3) { geocodeTimeout = setTimeout(() => { fetchGeocodingData(query); }, 300); } else { suggestionsContainer.empty().hide(); } });
    searchInput.on('keydown', function(event) { if (event.key === 'Enter') { event.preventDefault(); const firstSuggestion = $('#location-suggestions div:first-child'); if (firstSuggestion.length > 0) { firstSuggestion.trigger('click'); } else { const query = $(this).val(); if (query.length >= 3) { fetchGeocodingData(query); } } } });
    geolocationButton.on('click', function() { if (navigator.geolocation) { console.log("Requesting geolocation..."); locationNameElement.text("Suche Standort..."); summary.text(""); temp.html("--<span>c</span>"); searchInput.val(''); suggestionsContainer.empty().hide(); navigator.geolocation.getCurrentPosition( (position) => { console.log("Geolocation success:", position.coords); const lat = position.coords.latitude; const lon = position.coords.longitude; currentLat = lat; currentLon = lon; currentLocationName = "Aktueller Standort"; fetchWeatherData(lat, lon, currentLocationName); }, (error) => { console.error("Geolocation error:", error); let errorMsg = "Standort konnte nicht ermittelt werden."; if (error.code === error.PERMISSION_DENIED) errorMsg = "Standortzugriff verweigert."; else if (error.code === error.POSITION_UNAVAILABLE) errorMsg = "Standortinformationen nicht verfügbar."; else if (error.code === error.TIMEOUT) errorMsg = "Standortabfrage Zeitüberschreitung."; handleApiError(errorMsg); }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 } ); } else { console.error("Geolocation is not supported by this browser."); handleApiError("Geolocation wird nicht unterstützt."); } });

    flipButton.on('click', function() {
        if (!isFlipped) {
            fetchForecastData(currentLat, currentLon);
        }
        card.toggleClass('flipped');
        isFlipped = !isFlipped;
    });
    $(document).on('click', function(event) { if (!searchContainer.is(event.target) && searchContainer.has(event.target).length === 0 && !suggestionsContainer.is(event.target) && suggestionsContainer.has(event.target).length === 0) { suggestionsContainer.hide(); } });
});

// --- Animationsfunktionen (aus Ur-Fassung, mit Checks) ---
function onResize() {
    // console.log("onResize called"); // Optional: Log resize
	sizes.container.width = container.width(); sizes.container.height = container.height();
	sizes.card.width = card.width(); sizes.card.height = card.height(); sizes.card.offset = card.offset();
    if (!sizes.card.width || !sizes.container.width) {
        console.warn("onResize: Card or container width is zero.");
        // return; // Frühzeitiger Ausstieg könnte Probleme verursachen, wenn später initialisiert wird
    }
	if (innerSVG) innerSVG.attr({ width: sizes.card.width, height: sizes.card.height });
	if (outerSVG) outerSVG.attr({ width: sizes.container.width, height: sizes.container.height });
	if (backSVG) backSVG.attr({ width: sizes.container.width, height: sizes.container.height });
	if (sunburst && sunburst.node) {
        gsap.set(sunburst.node, {transformOrigin:"50% 50%", x: sizes.container.width / 2, y: (sizes.card.height/2) + sizes.card.offset.top});
        if (!gsap.isTweening(sunburst.node)) { gsap.fromTo(sunburst.node, {rotation: 0}, {duration: 20, rotation: 360, repeat: -1, ease: "none"}); }
    }
    if (leafMask && sizes.card.offset) { // Sicherstellen, dass offset existiert
        var maskX = sizes.card.offset.left + sizes.card.width; var maskWidth = sizes.container.width - maskX; if (maskWidth < 0) maskWidth = 0;
        leafMask.attr({ x: maskX, y: 0, width: maskWidth, height: sizes.container.height });
    }
}

function drawCloud(cloud, i) { /* ... (Original-Logik) ... */ if (!cloud || !cloud.group) return; var space  = settings.cloudSpace * i; var height = space + settings.cloudHeight; var arch = height + settings.cloudArch + (Math.random() * settings.cloudArch); var width = sizes.card.width; var points = []; points.push('M' + [-(width), 0].join(',')); points.push([width, 0].join(',')); points.push('Q' + [width * 2, height / 2].join(',')); points.push([width, height].join(',')); points.push('Q' + [width * 0.5, arch].join(',')); points.push([0, height].join(',')); points.push('Q' + [width * -0.5, arch].join(',')); points.push([-width, height].join(',')); points.push('Q' + [- (width * 2), height/2].join(',')); points.push([-(width), 0].join(',')); var path = points.join(' '); if(!cloud.path) cloud.path = cloud.group.path(); cloud.path.attr({ d: path }); }
function makeRain() { /* ... (Original-Logik) ... */ if (!currentWeather) return; var lineWidth = Math.random() * 3; var lineLength = currentWeather.type == 'thunder' ? 35 : 14; var x = Math.random() * (sizes.card.width - 40) + 20; var holder; if (lineWidth < 1) holder = innerRainHolder1; else if (lineWidth < 2) holder = innerRainHolder2; else holder = innerRainHolder3; if (!holder) { console.warn("makeRain: Rain holder not found for lineWidth", lineWidth); return; } var line = holder.path('M0,0 0,' + lineLength).attr({ fill: 'none', stroke: currentWeather.type == 'thunder' ? '#777' : '#0000ff', strokeWidth: lineWidth }); rain.push(line); gsap.fromTo(line.node, {x: x, y: 0- lineLength}, {duration: 1, delay: Math.random(), y: sizes.card.height, ease: "power2.in", onComplete: onRainEnd, onCompleteParams: [line, lineWidth, x, currentWeather.type]}); }
function onRainEnd(line, width, x, type) { /* ... (Original-Logik) ... */ if (line && line.remove) { line.remove(); } line = null; rain = rain.filter(item => item !== null && item.paper); if(rain.length < settings.rainCount) { makeRain(); if(width > 2) makeSplash(x, type); } }
function onSplashComplete(splash) { /* ... (Original-Logik) ... */ if (splash && splash.remove) { splash.remove(); } splash = null; }
function onLeafEnd(leaf) { /* ... (Original-Logik) ... */ if (leaf && leaf.remove) { leaf.remove(); } leaf = null; leafs = leafs.filter(item => item !== null && item.paper); if(leafs.length < settings.leafCount) { makeLeaf(); } }
function makeSnow() { /* ... (Original-Logik) ... */ if (!currentWeather || !outerSnowHolder || !innerSnowHolder || !sizes.card.offset) return; var scale = 0.5 + (Math.random() * 0.5); var newSnow; var x = 20 + (Math.random() * (sizes.card.width - 40)); var y = -10; var endY; if(scale > 0.8) { newSnow = outerSnowHolder.circle(0, 0, 5).attr({ fill: 'white' }); endY = sizes.container.height + 10; y = sizes.card.offset.top + settings.cloudHeight; x =  x + sizes.card.offset.left; } else { newSnow = innerSnowHolder.circle(0, 0 ,5).attr({ fill: 'white' }); endY = sizes.card.height + 10; } snow.push(newSnow); gsap.fromTo(newSnow.node, {x: x, y: y}, {duration: 3 + (Math.random() * 5), y: endY, onComplete: onSnowEnd, onCompleteParams: [newSnow], ease: "none"}); gsap.fromTo(newSnow.node, {scale: 0}, {duration: 1, scale: scale, ease: "power1.inOut"}); gsap.to(newSnow.node, {duration: 3, x: x+((Math.random() * 150)-75), repeat: -1, yoyo: true, ease: "power1.inOut"}); }
function onSnowEnd(flake) { /* ... (Original-Logik) ... */ if (flake && flake.remove) { flake.remove(); } flake = null; snow = snow.filter(item => item !== null && item.paper); if(snow.length < settings.snowCount) { makeSnow(); } }

function makeSplash(x, type) {
    // Führe grundlegende Prüfungen durch und setze Basisvariablen
    if (!currentWeather || !outerSplashHolder || !sizes.card.offset) return;
    var splashLength = type == 'thunder' ? 30 : 20;
    var splashBounce = type == 'thunder' ? 120 : 100;
    var splashDistance = 80;
    var speed = type == 'thunder' ? 0.7 : 0.5;
    var splashUp = 0 - (Math.random() * splashBounce);
    var randomX = ((Math.random() * splashDistance) - (splashDistance / 2));
    var points = [];
    points.push('M' + 0 + ',' + 0);
    points.push('Q' + randomX + ',' + splashUp);
    points.push((randomX * 2) + ',' + splashDistance);
    var splash = outerSplashHolder.path(points.join(' ')).attr({ fill: "none", stroke: type == 'thunder' ? '#777' : '#0000ff', strokeWidth: 1 });
    var pathLength = splash.getTotalLength();
    var xOffset = sizes.card.offset.left;
    var yOffset = sizes.card.offset.top + sizes.card.height;
    splash.node.style.strokeDasharray = pathLength + ' ' + pathLength;

    // GSAP Animation - angepasst an CodePen (Start-X, Easing)
    gsap.fromTo(splash.node, {
        strokeWidth: 2,
        y: yOffset,
        x: xOffset + 20 + x, // Start-X wie im CodePen (+20)
        opacity: 1,
        strokeDashoffset: pathLength
    }, {
        duration: speed,
        strokeWidth: 0,
        strokeDashoffset: - pathLength,
        opacity: 1,
        onComplete: onSplashComplete,
        onCompleteParams: [splash],
        ease: "back.out(1.7)" // Easing geändert zu "back.out" für Bounce-Effekt
        // Alternativ testen: "elastic.out(1, 0.5)"
    });
}

function makeLeaf() {
    // Grundlegende Prüfungen ausführen und Variablen vorbereiten
    if (!currentWeather || !outerLeafHolder || !innerLeafHolder || !leaf || !sizes.card.offset) return;
    var scale = 0.5 + (Math.random() * 0.5);
    var newLeaf;
    var y, endY, startX, endX, xBezier;
    var colors = ['#76993E', '#4A5E23', '#6D632F'];
    var color = colors[Math.floor(Math.random() * colors.length)];

    if(scale > 0.8) {
        // Große Blätter (außen) - Logik bleibt wie im Original CodePen
        newLeaf = leaf.clone().appendTo(outerLeafHolder).attr({ fill: color });
        // Vertikale Positionierung wie im Original CodePen (areaY-Berechnung war dort etwas anders,
        // aber die Logik mit offset.top ist robuster, wir behalten deine Y-Logik bei)
        var areaY = sizes.card.height / 2; // Behalte deine areaY Logik bei
        y = sizes.card.offset.top + areaY + (Math.random() * areaY); // Angepasst an deine Logik
        endY = y - ((Math.random() * (areaY * 2)) - areaY); // Angepasst an deine Logik

        startX = sizes.card.offset.left - 100;
        xBezier = startX + (sizes.container.width - sizes.card.offset.left) / 2;
        endX = sizes.container.width + 50;
    } else {
        // Kleine Blätter (innen) - Logik angepasst an CodePen
        newLeaf = leaf.clone().appendTo(innerLeafHolder).attr({ fill: color });
        // Vertikale Positionierung wie im Original CodePen (war dort etwas anders berechnet,
        // deine Logik mit -40 und card.height + 40 ist klarer, wir behalten sie bei)
        y = -40; // Start oben (wie bei dir)
        endY = sizes.card.height + 40; // Ende unten (wie bei dir)

        // Horizontale Positionierung wie im Original CodePen (QUER DURCH)
        startX = -100; // Startet links außerhalb
        xBezier = sizes.card.width / 2; // Kontrollpunkt in der Mitte
        endX = sizes.card.width + 50; // Endet rechts außerhalb
    }

    leafs.push(newLeaf);

    // Bezier-Pfad definieren
    var bezier = [{x:startX, y:y}, {x: xBezier, y:(Math.random() * endY) + (endY / 3)}, {x: endX, y:endY}];

    // GSAP Animation - angepasst an CodePen (Dauer, kein autoRotate)
    gsap.fromTo(newLeaf.node, {
        rotation: Math.random()* 180,
        scale: scale,
        x: startX,
        y: y
    }, {
        duration: 2, // Dauer wie im CodePen
        rotation: "+=" + (Math.random()* 360 - 180), // Behalte deine Rotation bei
        motionPath: { // Verwende motionPath (GSAP v3) statt bezier (GSAP v2)
            path: bezier,
            curviness: 1.25 // Behalte deine Curviness bei
            // autoRotate: true entfernt!
        },
        onComplete: onLeafEnd,
        onCompleteParams: [newLeaf],
        ease: "none" // Lineares Easing (wie Power0.easeIn / "none")
    });
}

// Originale Tick-Funktion
function tick() {
    requestAnimationFrame(tick); // Request next frame immediately
    // console.log("tick running - CW:", currentWeather ? currentWeather.type : "null", " Width:", sizes.card.width); // Verbose tick log

    if (!currentWeather || !sizes.card.width || sizes.card.width === 0) { // Added width check
        // console.log("tick exit - no current weather or card width is zero"); // Log exit reason
        return;
    }
	tickCount++;
	var check = tickCount % settings.renewCheck;

	if(check) {
		if(rain.length < settings.rainCount) makeRain();
		if(leafs.length < settings.leafCount) makeLeaf();
		if(snow.length < settings.snowCount) makeSnow();
	}

	for(var i = 0; i < clouds.length; i++) {
        var cloud = clouds[i]; if (!cloud || !cloud.group || !cloud.group.node) continue;
		if(currentWeather.type == 'sun') {
			if(cloud.offset > -(sizes.card.width * 1.5)) cloud.offset += settings.windSpeed / (i + 1);
			if(cloud.offset > sizes.card.width * 2.5) cloud.offset = -(sizes.card.width * 1.5);
			cloud.group.transform('t' + cloud.offset + ',' + 0);
		} else {
			cloud.offset += settings.windSpeed / (i + 1);
			if(cloud.offset > sizes.card.width) cloud.offset = 0 + (cloud.offset - sizes.card.width);
			cloud.group.transform('t' + cloud.offset + ',' + 0);
		}
	}
}

// Originale Reset-Funktion
function reset() { console.log("reset() called"); for(var i = 0; i < weather.length; i++) { container.removeClass(weather[i].type); if (weather[i].button) { weather[i].button.removeClass('active'); } } $('nav li a.active').removeClass('active'); if(lightningTimeout) clearTimeout(lightningTimeout); }
// Originale updateSummaryText Funktion
function updateSummaryText() { if (!currentWeather) return; console.log("updateSummaryText for:", currentWeather.name); summary.html(currentWeather.name); gsap.fromTo(summary, {x: 30}, {duration: 1.5, opacity: 1, x: 0, ease: "power4.out"}); }
// Originale startLightningTimer Funktion
function startLightningTimer() { if(lightningTimeout) clearTimeout(lightningTimeout); if(currentWeather && currentWeather.type == 'thunder') { console.log("Starting lightning timer"); lightningTimeout = setTimeout(lightning, Math.random()*6000); } }
// Originale lightning Funktion (mit Bounce!)
function lightning() { console.log("⚡ lightning triggered!"); if (!currentWeather || currentWeather.type !== 'thunder' || !innerLightningHolder) { console.warn("lightning aborted: wrong weather or holder missing"); return; } startLightningTimer(); gsap.fromTo(card, {y: -30}, {duration: 0.75, y:0, ease:"elastic.out"}); var pathX = 30 + Math.random() * (sizes.card.width - 60); var yOffset = 20; var steps = 20; var points = [pathX + ',0']; for(var i = 0; i < steps; i++) { var x = pathX + (Math.random() * yOffset - (yOffset / 2)); var y = (sizes.card.height / steps) * (i + 1); points.push(x + ',' + y); } var strike = innerLightningHolder.path('M' + points.join(' ')).attr({ fill: 'none', stroke: 'white', strokeWidth: 2 + Math.random() }); gsap.to(strike.node, {duration: 1, opacity: 0, ease:"power4.out", onComplete: function(){ if (strike && strike.remove) strike.remove(); strike = null}}); }

// Originale changeWeather Funktion
function changeWeather(weatherData) {
    console.log("6. changeWeather called with type:", weatherData ? weatherData.type : "null"); // Log 6
    var newWeather = weatherData.data ? weatherData.data : weatherData;
    if (!newWeather || !newWeather.type) { console.error("changeWeather called with invalid data:", weatherData); return; } // Added check

    // Optional: Check if already changing to this weather to prevent issues
    // if (container.hasClass(newWeather.type)) {
    //     console.log("Already changing to or is:", newWeather.type);
    //     // Potentially just update text if needed
    //     if (summary.html() !== newWeather.name) { updateSummaryText(); }
    //     return;
    // }

	reset();
	currentWeather = newWeather;

	gsap.killTweensOf(summary);
	gsap.to(summary, {duration: 1, opacity: 0, x: -30, onComplete: updateSummaryText, ease: "power4.in"});

	container.addClass(currentWeather.type);
    if (currentWeather.button) { currentWeather.button.addClass('active'); }
    else { const matchingButton = $('#button-' + currentWeather.type); if (matchingButton.length) { matchingButton.addClass('active'); } }

	let windTarget, rainTarget, leafTarget, snowTarget;
    let sunXTarget, sunYTarget, sunburstScaleTarget, sunburstOpacityTarget, sunburstYTarget;

	switch(currentWeather.type) { /* ... (Original-Werte wie im letzten Code) ... */
        case 'wind': windTarget = 3; rainTarget = 0; leafTarget = 5; snowTarget = 0; sunXTarget = sizes.card.width / 2; sunYTarget = -100; sunburstScaleTarget = 0.4; sunburstOpacityTarget = 0; sunburstYTarget = (sizes.container.height/2)-50; break;
		case 'sun': windTarget = 20; rainTarget = 0; leafTarget = 0; snowTarget = 0; sunXTarget = sizes.card.width / 2; sunYTarget = sizes.card.height / 2; sunburstScaleTarget = 1; sunburstOpacityTarget = 0.8; sunburstYTarget = (sizes.card.height/2) + (sizes.card.offset ? sizes.card.offset.top : 0); break; // Added offset check
        case 'rain': windTarget = 0.5; rainTarget = 10; leafTarget = 0; snowTarget = 0; sunXTarget = sizes.card.width / 2; sunYTarget = -100; sunburstScaleTarget = 0.4; sunburstOpacityTarget = 0; sunburstYTarget = (sizes.container.height/2)-50; break;
        case 'thunder': windTarget = 0.5; rainTarget = 60; leafTarget = 0; snowTarget = 0; sunXTarget = sizes.card.width / 2; sunYTarget = -100; sunburstScaleTarget = 0.4; sunburstOpacityTarget = 0; sunburstYTarget = (sizes.container.height/2)-50; break;
        case 'snow': windTarget = 0.5; rainTarget = 0; leafTarget = 0; snowTarget = 40; sunXTarget = sizes.card.width / 2; sunYTarget = -100; sunburstScaleTarget = 0.4; sunburstOpacityTarget = 0; sunburstYTarget = (sizes.container.height/2)-50; break;
        case 'cloudy': windTarget = 0.5; rainTarget = 0; leafTarget = 0; snowTarget = 0; sunXTarget = sizes.card.width / 2; sunYTarget = -100; sunburstScaleTarget = 0.4; sunburstOpacityTarget = 0; sunburstYTarget = (sizes.container.height/2)-50; break;
		default: windTarget = 0.5; rainTarget = 0; leafTarget = 0; snowTarget = 0; sunXTarget = sizes.card.width / 2; sunYTarget = -100; sunburstScaleTarget = 0.4; sunburstOpacityTarget = 0; sunburstYTarget = (sizes.container.height/2)-50; break;
    }

    console.log(`Setting targets for ${currentWeather.type}: wind=${windTarget}, rain=${rainTarget}, leaf=${leafTarget}, snow=${snowTarget}`);

    gsap.to(settings, { duration: 3, windSpeed: windTarget, ease: "power2.inOut" });
    gsap.to(settings, { duration: currentWeather.type === 'rain' || currentWeather.type === 'thunder' ? 3 : 1, rainCount: rainTarget, ease: "power2.inOut" });
    gsap.to(settings, { duration: currentWeather.type === 'wind' ? 3 : 1, leafCount: leafTarget, ease: "power2.inOut" });
    gsap.to(settings, { duration: currentWeather.type === 'snow' ? 3 : 1, snowCount: snowTarget, ease: "power2.inOut" });
    if (sun && sun.node) gsap.to(sun.node, { duration: currentWeather.type === 'sun' ? 4 : 2, x: sunXTarget, y: sunYTarget, ease: "power2.inOut" }); else console.warn("Sun node not found for animation.");
    if (sunburst && sunburst.node) gsap.to(sunburst.node, { duration: currentWeather.type === 'sun' ? 4 : 2, scale: sunburstScaleTarget, opacity: sunburstOpacityTarget, y: sunburstYTarget, ease: "power2.inOut" }); else console.warn("Sunburst node not found for animation.");

	startLightningTimer();
    console.log("7. changeWeather finished for type:", currentWeather.type); // Log 7
}

// Initialisierung starten, wenn das Dokument bereit ist
$(document).ready(init); // Sicherstellen, dass init erst aufgerufen wird, wenn DOM bereit ist