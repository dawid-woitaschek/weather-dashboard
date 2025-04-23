// 📝 Fetch all DOM nodes in jQuery and Snap SVG
var container = $('.container');
var card = $('#card');
var innerSVG = Snap('#inner');
var outerSVG = Snap('#outer');
var backSVG = Snap('#back');
var summary = $('#summary');
var date = $('#date');
var temp = $('.temp');
var locationNameElement = $('#location-name'); // *** NEU: Referenz Ortsname ***

// *** NEU: Referenzen für Suche ***
var searchContainer = $('#location-search-container');
var searchInput = $('#location-search-input');
var suggestionsContainer = $('#location-suggestions');
var geolocationButton = $('#geolocation-button');

var weatherContainer1 = Snap.select('#layer1');
var weatherContainer2 = Snap.select('#layer2');
var weatherContainer3 = Snap.select('#layer3');
var innerRainHolder1 = weatherContainer1.group();
var innerRainHolder2 = weatherContainer2.group();
var innerRainHolder3 = weatherContainer3.group();
var innerLeafHolder = weatherContainer1.group();
var innerSnowHolder = weatherContainer1.group();
var innerLightningHolder = weatherContainer1.group();
var leafMask = outerSVG.rect();
var leaf = Snap.select('#leaf');
var sun = Snap.select('#sun');
var sunburst = Snap.select('#sunburst');
var outerSplashHolder = outerSVG.group();
var outerLeafHolder = outerSVG.group();
var outerSnowHolder = outerSVG.group();

var lightningTimeout;
var geocodeTimeout; // *** NEU: Für Debounce ***

// GSAP Plugin Registrierung
if (window.gsap && window.MotionPathPlugin) {
    gsap.registerPlugin(MotionPathPlugin);
} else {
    console.error("GSAP oder MotionPathPlugin ist nicht geladen!");
}

// Set mask for leaf holder
outerLeafHolder.attr({
	'clip-path': leafMask
});

// create sizes object, we update this later
var sizes = {
	container: {width: 0, height: 0},
	card: {width: 0, height: 0}
}

// grab cloud groups
var clouds = [
	{group: Snap.select('#cloud1'), offset: 0}, // Offset hier initialisieren
	{group: Snap.select('#cloud2'), offset: 0},
	{group: Snap.select('#cloud3'), offset: 0}
]

// set weather types ☁️ 🌬 🌧 ⛈ ☀️
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

// 🛠 app settings
var settings = {
	windSpeed: 2, // Default wind speed
	rainCount: 0,
	leafCount: 0,
	snowCount: 0,
	cloudHeight: 100,
	cloudSpace: 30,
	cloudArch: 50,
	renewCheck: 10,
	splashBounce: 80
};

var tickCount = 0;
var rain = [];
var leafs = [];
var snow = [];

// --- Geocoding & Wetter API ---

const GEOCODING_API_URL_BASE = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_API_URL_BASE = "https://api.open-meteo.com/v1/forecast";

// *** NEU: Funktion für Geocoding API Aufruf ***
function fetchGeocodingData(query) {
    // API-Parameter: name, count, language, format
    const url = `${GEOCODING_API_URL_BASE}?name=${encodeURIComponent(query)}&count=20&language=de&format=json`; // Mehr Ergebnisse holen (count=20) für bessere Filterung/Sortierung
    console.log("Requesting Geocoding URL:", url);

    $.get(url)
        .done(function(data) {
            console.log("Geocoding Data Raw:", data);
            if (data && data.results) {
                displaySuggestions(data.results);
            } else {
                suggestionsContainer.empty().hide(); // Keine Ergebnisse, ausblenden
            }
        })
        .fail(function(jqXHR, textStatus, errorThrown) {
            console.error("Geocoding API Request Failed:", textStatus, errorThrown);
            suggestionsContainer.empty().hide(); // Bei Fehler ausblenden
        });
}

// *** NEU & STARK ÜBERARBEITET: Funktion zum Anzeigen der Vorschläge mit Sortierung und Deduplizierung ***
function displaySuggestions(results) {
    suggestionsContainer.empty().hide(); // Erst leeren und verstecken

    if (!results || results.length === 0) {
        return; // Nichts zu tun, wenn keine Ergebnisse
    }

    // --- Erweiterte Sortierlogik ---
    const europeanCountries = ['ES', 'FR', 'PT', 'IT', 'PL', 'FI', 'SE', 'NO', 'AT', 'CH', 'NL', 'BE', 'LU', 'DK', 'GB', 'IE']; // Erweiterte Liste
    const featureCodeBonus = {
        'PPLC': 10000, // Capital of a political entity
        'PPLA': 5000,  // Seat of a first-order administrative division
    };

    results.sort((a, b) => {
        let scoreA = 0;
        let scoreB = 0;
        if (a.country_code === 'DE') scoreA += 100000;
        else if (europeanCountries.includes(a.country_code)) scoreA += 50000;
        else if (a.country_code === 'US') scoreA += 25000;
        if (b.country_code === 'DE') scoreB += 100000;
        else if (europeanCountries.includes(b.country_code)) scoreB += 50000;
        else if (b.country_code === 'US') scoreB += 25000;
        scoreA += featureCodeBonus[a.feature_code] || 0;
        scoreB += featureCodeBonus[b.feature_code] || 0;
        scoreA += (a.population || 0);
        scoreB += (b.population || 0);
        return scoreB - scoreA;
    });

    // --- Deduplizierung ---
    const uniqueLocations = [];
    const seenKeys = new Set();
    results.forEach(location => {
        const latRounded = Math.round(location.latitude * 100);
        const lonRounded = Math.round(location.longitude * 100);
        const key = `${location.name.toLowerCase()}_${location.country_code}_${latRounded}_${lonRounded}`;
        if (!seenKeys.has(key)) {
            uniqueLocations.push(location);
            seenKeys.add(key);
        }
    });

    // --- Vorschläge anzeigen (max 10) ---
    const maxSuggestions = 10;
    uniqueLocations.slice(0, maxSuggestions).forEach(location => {
        let details = [];
        if (location.admin1 && location.admin1 !== location.name) details.push(location.admin1);
        if (location.country) details.push(location.country);
        details = [...new Set(details)];
        const suggestionHTML = `
            <div data-lat="${location.latitude}" data-lon="${location.longitude}" data-name="${location.name}">
                ${location.name}
                ${details.length > 0 ? `<span class="suggestion-details">(${details.join(', ')})</span>` : ''}
            </div>
        `;
        suggestionsContainer.append(suggestionHTML);
    });

    // Event Listener
    if (uniqueLocations.length > 0) {
        $('#location-suggestions div').on('click', function() {
            const lat = $(this).data('lat');
            const lon = $(this).data('lon');
            const name = $(this).data('name');
            console.log(`Suggestion selected: ${name} (${lat}, ${lon})`);
            currentLat = lat;
            currentLon = lon;
            currentLocationName = name;
            fetchWeatherData(lat, lon, name);
            searchInput.val(name);
            suggestionsContainer.empty().hide();
        });
        suggestionsContainer.show();
    }
}


// *** MODIFIZIERT: Funktion zum Abrufen der Wetterdaten (akzeptiert Parameter) ***
function fetchWeatherData(latitude, longitude, locationName = "Aktueller Standort") {
    const weatherApiUrl = `${WEATHER_API_URL_BASE}?latitude=${latitude}&longitude=${longitude}¤t=temperature_2m,weather_code&timezone=auto&temperature_unit=celsius`;
    console.log("Requesting Weather URL:", weatherApiUrl);
    locationNameElement.text(locationName);
    summary.text("Lädt...");
    temp.html("--<span>c</span>");

    $.get(weatherApiUrl)
        .done(function(data) {
            console.log("Weather Data:", data);
            if (data && data.current && data.current.temperature_2m !== undefined && data.current.weather_code !== undefined) {
                const current = data.current;
                const tempValue = Math.round(current.temperature_2m);
                const weatherCode = current.weather_code;
                temp.html(tempValue + '<span>c</span>');
                updateDate();
                const weatherType = getWeatherTypeFromCode(weatherCode);
                const targetWeather = weather.find(w => w.type === weatherType);
                if (targetWeather) {
                    changeWeather(targetWeather);
                } else {
                    console.warn("Unbekannter Wettercode:", weatherCode);
                    changeWeather(weather.find(w => w.type === 'cloudy'));
                }
            } else {
                handleApiError("Ungültige Wetter-API-Antwortstruktur.");
            }
        })
        .fail(function(jqXHR, textStatus, errorThrown) {
            console.error("Weather API Request Failed:", textStatus, errorThrown);
            handleApiError(`Wetterdaten konnten nicht geladen werden (${textStatus})`);
        });
}

// Funktion zur Behandlung von API-Fehlern
function handleApiError(errorMsg) {
    console.error("Fehler:", errorMsg);
    temp.html("--<span>c</span>");
    summary.text("Fehler");
    date.text("Keine Daten");
    locationNameElement.text("Ort unbekannt");
}

// Funktion zum Übersetzen des WMO Weather Codes in Widget-Typen
function getWeatherTypeFromCode(code) {
    if ([0, 1].includes(code)) return 'sun';
    if ([2, 3].includes(code)) return 'cloudy';
    if ([45, 48].includes(code)) return 'wind';
    if ([51, 53, 55, 56, 57].includes(code)) return 'rain';
    if ([61, 63, 65, 66, 67].includes(code)) return 'rain';
    if ([71, 73, 75, 77].includes(code)) return 'snow';
    if ([80, 81, 82].includes(code)) return 'rain';
    if ([85, 86].includes(code)) return 'snow';
    if ([95, 96, 99].includes(code)) return 'thunder';
    console.warn("Unbekannter oder nicht explizit gemappter Wettercode erhalten:", code);
    return 'cloudy';
}

// Funktion zum Formatieren und Anzeigen des aktuellen Datums
function updateDate() {
    const now = new Date();
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    const formattedDate = now.toLocaleDateString('de-DE', options);
    date.text(formattedDate);
}

// --- Ende API Integration ---


// ⚙ initialize app
init();

// 👁 watch for window resize
$(window).resize(onResize);

// --- NEUE Event Listener für Suche & Geolocation ---
$(document).ready(function() {
    searchInput.on('input', function() {
        clearTimeout(geocodeTimeout);
        const query = $(this).val();
        if (query.length >= 3) {
            geocodeTimeout = setTimeout(() => { fetchGeocodingData(query); }, 300);
        } else {
            suggestionsContainer.empty().hide();
        }
    });
    searchInput.on('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            const firstSuggestion = $('#location-suggestions div:first-child');
            if (firstSuggestion.length > 0) {
                firstSuggestion.trigger('click');
            } else {
                 const query = $(this).val();
                 if (query.length >= 3) { fetchGeocodingData(query); }
            }
        }
    });
    geolocationButton.on('click', function() {
        if (navigator.geolocation) {
            console.log("Requesting geolocation...");
            locationNameElement.text("Suche Standort...");
            summary.text("");
            temp.html("--<span>c</span>");
            searchInput.val('');
            suggestionsContainer.empty().hide();
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    console.log("Geolocation success:", position.coords);
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    currentLat = lat;
                    currentLon = lon;
                    currentLocationName = "Aktueller Standort";
                    fetchWeatherData(lat, lon, currentLocationName);
                },
                (error) => {
                    console.error("Geolocation error:", error);
                    let errorMsg = "Standort konnte nicht ermittelt werden.";
                    if (error.code === error.PERMISSION_DENIED) errorMsg = "Standortzugriff verweigert.";
                    else if (error.code === error.POSITION_UNAVAILABLE) errorMsg = "Standortinformationen nicht verfügbar.";
                    else if (error.code === error.TIMEOUT) errorMsg = "Standortabfrage Zeitüberschreitung.";
                    handleApiError(errorMsg);
                },
                { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
            );
        } else {
            console.error("Geolocation is not supported by this browser.");
            handleApiError("Geolocation wird nicht unterstützt.");
        }
    });
    $(document).on('click', function(event) {
        if (!searchContainer.is(event.target) && searchContainer.has(event.target).length === 0 &&
            !suggestionsContainer.is(event.target) && suggestionsContainer.has(event.target).length === 0) {
            suggestionsContainer.hide();
        }
    });
});


// 🏃 start animations

function init()
{
	onResize();
	for(var i = 0; i < weather.length; i++) {
		var w = weather[i];
		var b = $('#button-' + w.type);
		w.button = b;
		b.bind('click', w, changeWeather);
	}
	for(var i = 0; i < clouds.length; i++) {
        if (clouds[i] && clouds[i].group) {
		    clouds[i].offset = Math.random() * sizes.card.width;
		    drawCloud(clouds[i], i);
            gsap.set(clouds[i].group.node, { x: clouds[i].offset });
        }
	}
    fetchWeatherData(currentLat, currentLon, currentLocationName);
	requestAnimationFrame(tick);
}

function onResize()
{
	sizes.container.width = container.width();
	sizes.container.height = container.height();
	sizes.card.width = card.width();
	sizes.card.height = card.height();
	sizes.card.offset = card.offset();
	innerSVG.attr({ width: sizes.card.width, height: sizes.card.height });
	outerSVG.attr({ width: sizes.container.width, height: sizes.container.height });
	backSVG.attr({ width: sizes.container.width, height: sizes.container.height });
	gsap.set(sunburst.node, {transformOrigin:"50% 50%", x: sizes.container.width / 2, y: (sizes.card.height/2) + sizes.card.offset.top});
    if (!gsap.isTweening(sunburst.node)) {
	    gsap.fromTo(sunburst.node, {rotation: 0}, {duration: 20, rotation: 360, repeat: -1, ease: "none"});
    }
    var maskX = sizes.card.offset.left + sizes.card.width;
    var maskWidth = sizes.container.width - maskX;
    if (maskWidth < 0) maskWidth = 0;
    leafMask.attr({ x: maskX, y: 0, width: maskWidth, height: sizes.container.height });
}

function drawCloud(cloud, i)
{
    if (!cloud || !cloud.group) return;
	var space  = settings.cloudSpace * i;
	var height = space + settings.cloudHeight;
	var arch = height + settings.cloudArch + (Math.random() * settings.cloudArch);
	var width = sizes.card.width;
	var points = [];
	points.push('M' + [-(width), 0].join(','));
	points.push([width, 0].join(','));
	points.push('Q' + [width * 2, height / 2].join(','));
	points.push([width, height].join(','));
	points.push('Q' + [width * 0.5, arch].join(','));
	points.push([0, height].join(','));
	points.push('Q' + [width * -0.5, arch].join(','));
	points.push([-width, height].join(','));
	points.push('Q' + [- (width * 2), height/2].join(','));
	points.push([-(width), 0].join(','));
	var path = points.join(' ');
	if(!cloud.path) cloud.path = cloud.group.path();
	cloud.path.attr({ d: path });
}

function makeRain()
{
    if (!currentWeather) return;
	if(Math.random() > settings.rainCount / 100) return;
	var lineWidth = Math.random() * 3;
	var lineLength = currentWeather.type == 'thunder' ? 35 : 14;
	var x = Math.random() * (sizes.card.width - 40) + 20;
    var y = 0 - lineLength;
    var holder;
    if (lineWidth < 1) holder = innerRainHolder1;
    else if (lineWidth < 2) holder = innerRainHolder2;
    else holder = innerRainHolder3;
    if (!holder) return;
	var line = holder.path('M0,0 0,' + lineLength).attr({
		fill: 'none',
		stroke: currentWeather.type == 'thunder' ? '#777' : '#0000ff',
		strokeWidth: lineWidth,
	});
	rain.push(line);
	gsap.fromTo(line.node, { x: x, y: y }, {
            duration: 1, delay: Math.random() * 0.5, y: sizes.card.height + lineLength,
            ease: "power1.in", onComplete: onRainEnd, onCompleteParams: [line, lineWidth, x, currentWeather.type]
        });
}

function onRainEnd(line, width, x, type)
{
    if (line && line.remove) { line.remove(); }
	line = null;
    rain = rain.filter(item => item !== null && item.paper);
    if (width > 2) { makeSplash(x, type); }
}

function makeSplash(x, type)
{
    if (!currentWeather || !outerSplashHolder) return;
	var splashLength = type == 'thunder' ? 30 : 20;
	var splashBounce = type == 'thunder' ? 120 : 100;
	var splashDistance = 80;
	var speed = type == 'thunder' ? 0.7 : 0.5;
	var randomX = ((Math.random() * splashDistance) - (splashDistance / 2));
	var randomY = 0 - (Math.random() * splashBounce);
	var points = [];
	points.push('M' + 0 + ',' + 0);
    points.push('Q' + randomX + ',' + randomY);
    points.push((randomX * 2) + ',' + 0);
	var splash = outerSplashHolder.path(points.join(' ')).attr({
      	fill: "none", stroke: type == 'thunder' ? '#aaa' : '#88f', strokeWidth: Math.random() * 1 + 0.5
    });
	var pathLength = splash.getTotalLength();
	var xOffset = sizes.card.offset.left;
	var yOffset = sizes.card.offset.top + sizes.card.height;
    splash.node.style.strokeDasharray = pathLength;
    splash.node.style.strokeDashoffset = pathLength;
	gsap.to(splash.node, {
        duration: speed, strokeDashoffset: 0, strokeWidth: 0, opacity: 0,
        transformOrigin: "50% 100%", x: xOffset + x, y: yOffset,
        ease: "power1.out", onComplete: onSplashComplete, onCompleteParams: [splash]
    });
}

function onSplashComplete(splash) { if (splash && splash.remove) { splash.remove(); } splash = null; }

function makeLeaf()
{
    if (!currentWeather || !outerLeafHolder || !innerLeafHolder) return;
	var scale = 0.5 + (Math.random() * 0.5);
	var newLeaf;
	var startY, endY, startX, endX, xBezier;
	var colors = ['#76993E', '#4A5E23', '#6D632F', '#B4A94F'];
	var color = colors[Math.floor(Math.random() * colors.length)];
	if (Math.random() > 0.5) {
		newLeaf = leaf.clone().appendTo(outerLeafHolder).attr({ fill: color });
		startY = sizes.card.offset.top + Math.random() * sizes.container.height;
		endY = sizes.card.offset.top + Math.random() * sizes.container.height;
		startX = sizes.card.offset.left - 40;
		endX = sizes.container.width + 40;
        xBezier = startX + (endX - startX) * (0.3 + Math.random() * 0.4);
	} else {
		newLeaf = leaf.clone().appendTo(innerLeafHolder).attr({ fill: color });
        startY = -40; endY = sizes.card.height + 40;
        startX = Math.random() * sizes.card.width;
        endX = Math.random() * sizes.card.width;
        xBezier = startX + (Math.random() - 0.5) * sizes.card.width * 0.5;
	}
	leafs.push(newLeaf);
	var bezierPath = [{x:startX, y:startY}, {x: xBezier, y: startY + (endY - startY) * (0.3 + Math.random() * 0.4)}, {x: endX, y:endY}];
    gsap.fromTo(newLeaf.node, { rotation: Math.random() * 360, scale: scale, x: startX, y: startY }, {
        duration: 5 + Math.random() * 5, rotation: "+=" + (Math.random() * 720 - 360),
        motionPath: { path: bezierPath, curviness: 1.5, autoRotate: true },
        onComplete: onLeafEnd, onCompleteParams: [newLeaf], ease: "power1.inOut"
    });
}

function onLeafEnd(leaf) { if (leaf && leaf.remove) { leaf.remove(); } leaf = null; leafs = leafs.filter(item => item !== null && item.paper); }

function makeSnow()
{
    if (!currentWeather || !outerSnowHolder || !innerSnowHolder) return;
	var scale = 0.3 + (Math.random() * 0.7);
	var newSnow;
	var startX = Math.random() * sizes.card.width;
	var startY = -10;
	var endY;
	if (scale > 0.7 && Math.random() > 0.5) {
		newSnow = outerSnowHolder.circle(0, 0, 4 * scale).attr({ fill: 'white', opacity: 0.8 });
		startY = sizes.card.offset.top - 10;
        startX = sizes.card.offset.left + Math.random() * sizes.card.width;
		endY = sizes.container.height + 10;
	} else {
		newSnow = innerSnowHolder.circle(0, 0 , 4 * scale).attr({ fill: 'white', opacity: 0.9 });
		endY = sizes.card.height + 10;
	}
	snow.push(newSnow);
	gsap.to(newSnow.node, {
        duration: 4 + Math.random() * 6, x: startX + (Math.random() * 100 - 50), y: endY,
        ease: "none", onComplete: onSnowEnd, onCompleteParams: [newSnow]
    });
    gsap.from(newSnow.node, { duration: 1, scale: 0, opacity: 0, ease: "power1.out"});
	gsap.to(newSnow.node, {
        duration: 3 + Math.random() * 2, x: "+=" + (Math.random() * 60 - 30),
        repeat: -1, yoyo: true, ease: "sine.inOut"
    });
}

function onSnowEnd(flake) { if (flake && flake.remove) { flake.remove(); } flake = null; snow = snow.filter(item => item !== null && item.paper); }

// *** TICK FUNKTION ZURÜCKGESETZT AUF URSPRÜNGLICHE LOGIK ***
function tick()
{
	requestAnimationFrame(tick);

    if (!currentWeather || !sizes.card.width) {
        return;
    }

	tickCount++;
	var check = tickCount % settings.renewCheck;

	if(check) { // Partikel nur alle 'renewCheck' Ticks prüfen/erzeugen
		if(rain.length < settings.rainCount) makeRain(); // Beachte: rainCount ist jetzt eher Intensität
		if(leafs.length < settings.leafCount) makeLeaf();
		if(snow.length < settings.snowCount) makeSnow();
	}

    // Wolkenbewegung (Original-Logik)
	for(var i = 0; i < clouds.length; i++)
	{
        var cloud = clouds[i];
        if (!cloud || !cloud.group || !cloud.group.node) continue;

		if(currentWeather.type == 'sun') // Originale Bedingung für Sonne
		{
            // Originale Logik für Sonne
			if(cloud.offset > -(sizes.card.width * 1.5)) cloud.offset += settings.windSpeed / (i + 1);
			if(cloud.offset > sizes.card.width * 2.5) cloud.offset = -(sizes.card.width * 1.5);
			cloud.group.transform('t' + cloud.offset + ',' + 0); // Originale Transformation
		}
		else // Originale Logik für andere Wetterlagen
		{
			cloud.offset += settings.windSpeed / (i + 1);
			if(cloud.offset > sizes.card.width) cloud.offset = 0 + (cloud.offset - sizes.card.width);
			cloud.group.transform('t' + cloud.offset + ',' + 0); // Originale Transformation
		}
	}
}


function reset()
{
	for(var i = 0; i < weather.length; i++) {
		container.removeClass(weather[i].type);
		if (weather[i].button) { weather[i].button.removeClass('active'); }
	}
    $('nav li a.active').removeClass('active');
    // KEIN expliziter Wolken-Reset mehr hier, da tick() das jetzt handhabt
    if(lightningTimeout) clearTimeout(lightningTimeout);
}

function updateSummaryText()
{
    if (!currentWeather) return;
	summary.html(currentWeather.name);
    gsap.fromTo(summary, { opacity: 0, x: 20 }, { duration: 1, opacity: 1, x: 0, ease: "power2.out" });
}

function startLightningTimer()
{
	if(lightningTimeout) clearTimeout(lightningTimeout);
	if(currentWeather && currentWeather.type == 'thunder') {
		lightningTimeout = setTimeout(lightning, 2000 + Math.random() * 6000);
	}
}

function lightning()
{
    if (!currentWeather || currentWeather.type !== 'thunder' || !weatherContainer1) return;
	startLightningTimer();
    gsap.to(card, { duration: 0.05, backgroundColor: '#d0d0e0', yoyo: true, repeat: 1 });
	var pathX = 30 + Math.random() * (sizes.card.width - 60);
	var yOffset = 20;
	var segmentHeight = 15 + Math.random() * 10;
    var steps = Math.floor(sizes.card.height / segmentHeight);
	var points = [pathX + ',0'];
	for(var i = 0; i < steps; i++) {
		var x = pathX + (Math.random() * yOffset - (yOffset / 2));
		var y = segmentHeight * (i + 1);
		points.push(x + ',' + y);
        pathX = x;
	}
	var strike = weatherContainer1.path('M' + points.join(' ')).attr({
		fill: 'none', stroke: 'white', strokeWidth: 1 + Math.random() * 2
	});
	gsap.fromTo(strike.node, { opacity: 1 }, {
        duration: 0.7, opacity: 0, ease: "expo.out",
        onComplete: function(){ if (strike && strike.remove) strike.remove(); strike = null; }
    });
}

// *** CHANGEWEATHER ZURÜCKGESETZT AUF URSPRÜNGLICHE LOGIK FÜR 'sun' ***
function changeWeather(weatherData)
{
    var newWeather = weatherData.data ? weatherData.data : weatherData;

    if (currentWeather && currentWeather.type === newWeather.type) {
         if (summary.html() !== newWeather.name) {
             gsap.to(summary, {duration: 0.5, opacity: 0, x: -20, onComplete: function() {
                 summary.html(newWeather.name);
                 gsap.to(summary, {duration: 0.5, opacity: 1, x: 0, ease: "power2.out"});
             }, ease: "power2.in"});
         }
        return;
    }

	reset();
	currentWeather = newWeather;

	gsap.to(summary, {duration: 0.8, opacity: 0, x: -20, onComplete: updateSummaryText, ease: "power2.in"});
	container.addClass(currentWeather.type);
    const matchingButton = $('#button-' + currentWeather.type);
    if (matchingButton.length) { matchingButton.addClass('active'); }

	let windTarget, rainTarget, leafTarget, snowTarget;
    let sunXTarget, sunYTarget, sunburstScaleTarget, sunburstOpacityTarget, sunburstYTarget;

	switch(currentWeather.type) {
		case 'wind':
            windTarget = 5; rainTarget = 0; leafTarget = 15; snowTarget = 0;
            sunXTarget = sizes.card.width / 2; sunYTarget = -150;
            sunburstScaleTarget = 0.3; sunburstOpacityTarget = 0; sunburstYTarget = (sizes.container.height/2)-50;
			break;
		case 'sun': // Originale Werte wiederhergestellt
            windTarget = 20; // << URSPRÜNGLICHER WERT
            rainTarget = 0; leafTarget = 0; snowTarget = 0;
            sunXTarget = sizes.card.width / 2; sunYTarget = sizes.card.height / 2; // << URSPRÜNGLICHER WERT
            sunburstScaleTarget = 1; sunburstOpacityTarget = 0.8;
            sunburstYTarget = (sizes.card.height/2) + (sizes.card.offset.top); // << URSPRÜNGLICHER WERT
			break;
        case 'rain':
            windTarget = 1; rainTarget = 40; leafTarget = 0; snowTarget = 0;
            sunXTarget = sizes.card.width / 2; sunYTarget = -150;
            sunburstScaleTarget = 0.3; sunburstOpacityTarget = 0; sunburstYTarget = (sizes.container.height/2)-50;
            break;
        case 'thunder':
            windTarget = 2; rainTarget = 80; leafTarget = 0; snowTarget = 0;
            sunXTarget = sizes.card.width / 2; sunYTarget = -150;
            sunburstScaleTarget = 0.3; sunburstOpacityTarget = 0; sunburstYTarget = (sizes.container.height/2)-50;
            break;
        case 'snow':
            windTarget = 0.5; rainTarget = 0; leafTarget = 0; snowTarget = 60;
            sunXTarget = sizes.card.width / 2; sunYTarget = -150;
            sunburstScaleTarget = 0.3; sunburstOpacityTarget = 0; sunburstYTarget = (sizes.container.height/2)-50;
            break;
        case 'cloudy':
            windTarget = 1; rainTarget = 0; leafTarget = 0; snowTarget = 0;
            sunXTarget = sizes.card.width / 2; sunYTarget = -150;
            sunburstScaleTarget = 0.3; sunburstOpacityTarget = 0; sunburstYTarget = (sizes.container.height/2)-50;
            break;
		default:
            windTarget = 1; rainTarget = 0; leafTarget = 0; snowTarget = 0;
            sunXTarget = sizes.card.width / 2; sunYTarget = -150;
            sunburstScaleTarget = 0.3; sunburstOpacityTarget = 0; sunburstYTarget = (sizes.container.height/2)-50;
			break;
	}

    // Animationen für Einstellungen, Sonne, Sunburst
    gsap.to(settings, { duration: 2, windSpeed: windTarget, ease: "power2.inOut" }); // Windspeed wird jetzt wieder auf 20 gesetzt bei Sonne
    gsap.to(settings, { duration: 2, rainCount: rainTarget, ease: "power2.inOut" });
    gsap.to(settings, { duration: 2, leafCount: leafTarget, ease: "power2.inOut" });
    gsap.to(settings, { duration: 2, snowCount: snowTarget, ease: "power2.inOut" });
    gsap.to(sun.node, { duration: 3, x: sunXTarget, y: sunYTarget, ease: "power2.inOut" });
    gsap.to(sunburst.node, { duration: 3, scale: sunburstScaleTarget, opacity: sunburstOpacityTarget, y: sunburstYTarget, ease: "power2.inOut" });

    // KEINE explizite Wolken-Animation mehr hier

	startLightningTimer();
}