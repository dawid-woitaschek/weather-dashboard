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
	{group: Snap.select('#cloud1')},
	{group: Snap.select('#cloud2')},
	{group: Snap.select('#cloud3')}
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
	windSpeed: 2,
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
        // Weitere Codes könnten hinzugefügt werden, siehe Open-Meteo Doku
    };

    results.sort((a, b) => {
        // 1. Geografischer Bonus berechnen
        let scoreA = 0;
        let scoreB = 0;

        if (a.country_code === 'DE') scoreA += 100000;
        else if (europeanCountries.includes(a.country_code)) scoreA += 50000;
        else if (a.country_code === 'US') scoreA += 25000;

        if (b.country_code === 'DE') scoreB += 100000;
        else if (europeanCountries.includes(b.country_code)) scoreB += 50000;
        else if (b.country_code === 'US') scoreB += 25000;

        // 2. Feature Code Bonus hinzufügen
        scoreA += featureCodeBonus[a.feature_code] || 0;
        scoreB += featureCodeBonus[b.feature_code] || 0;

        // 3. Populations-Score hinzufügen (wichtig für "Miami-Problem")
        // Verwende || 0 falls Population fehlt
        scoreA += (a.population || 0);
        scoreB += (b.population || 0);

        // Absteigend sortieren (höchster Score zuerst)
        return scoreB - scoreA;
    });

    console.log("Sorted Geocoding Data:", results);

    // --- Deduplizierung ---
    const uniqueLocations = [];
    const seenKeys = new Set();

    results.forEach(location => {
        // Eindeutigen Schlüssel generieren (Name + Land + gerundete Koordinaten)
        const latRounded = Math.round(location.latitude * 100); // Auf 2 Nachkommastellen runden
        const lonRounded = Math.round(location.longitude * 100);
        const key = `${location.name.toLowerCase()}_${location.country_code}_${latRounded}_${lonRounded}`;

        if (!seenKeys.has(key)) {
            uniqueLocations.push(location);
            seenKeys.add(key);
        } else {
            console.log("Duplicate removed:", location.name, location.country_code);
        }
    });

    console.log("Unique Geocoding Data:", uniqueLocations);


    // --- Vorschläge anzeigen (max 10) ---
    const maxSuggestions = 10;
    uniqueLocations.slice(0, maxSuggestions).forEach(location => {
        // Zusätzliche Details für die Anzeige (Bundesland/Region, Land)
        let details = [];
        if (location.admin1 && location.admin1 !== location.name) details.push(location.admin1); // admin1 nur wenn nicht gleich Name
        if (location.country) details.push(location.country); // Land immer anzeigen

        // Nur eindeutige Details anzeigen
        details = [...new Set(details)]; // Entfernt Duplikate falls admin1 == country

        const suggestionHTML = `
            <div data-lat="${location.latitude}" data-lon="${location.longitude}" data-name="${location.name}">
                ${location.name}
                ${details.length > 0 ? `<span class="suggestion-details">(${details.join(', ')})</span>` : ''}
            </div>
        `;
        suggestionsContainer.append(suggestionHTML);
    });

    // Event Listener für Klicks auf Vorschläge hinzufügen (nur wenn Vorschläge existieren)
    if (uniqueLocations.length > 0) {
        $('#location-suggestions div').on('click', function() {
            const lat = $(this).data('lat');
            const lon = $(this).data('lon');
            const name = $(this).data('name');

            console.log(`Suggestion selected: ${name} (${lat}, ${lon})`);

            currentLat = lat; // Globale Koordinaten aktualisieren
            currentLon = lon;
            currentLocationName = name; // Globalen Namen aktualisieren

            fetchWeatherData(lat, lon, name); // Wetter für gewählten Ort holen

            searchInput.val(name); // Input mit gewähltem Namen füllen (optional)
            // searchInput.val(''); // Oder Input leeren
            suggestionsContainer.empty().hide(); // Vorschläge ausblenden
        });

        suggestionsContainer.show(); // Vorschläge anzeigen
    }
}


// *** MODIFIZIERT: Funktion zum Abrufen der Wetterdaten (akzeptiert Parameter) ***
function fetchWeatherData(latitude, longitude, locationName = "Aktueller Standort") {
    // API URL dynamisch bauen
    const weatherApiUrl = `${WEATHER_API_URL_BASE}?latitude=${latitude}&longitude=${longitude}¤t=temperature_2m,weather_code&timezone=auto&temperature_unit=celsius`;
    console.log("Requesting Weather URL:", weatherApiUrl);

    // Ortsnamen im UI aktualisieren
    locationNameElement.text(locationName);
    // Ggf. Ladezustand anzeigen
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
                updateDate(); // Datum bleibt aktuell

                const weatherType = getWeatherTypeFromCode(weatherCode);
                const targetWeather = weather.find(w => w.type === weatherType);

                if (targetWeather) {
                    changeWeather(targetWeather); // Wetteranzeige aktualisieren
                } else {
                    console.warn("Unbekannter Wettercode:", weatherCode);
                    changeWeather(weather.find(w => w.type === 'sun')); // Fallback
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
    locationNameElement.text("Ort unbekannt"); // Auch Ortsnamen zurücksetzen
}

// Funktion zum Übersetzen des WMO Weather Codes in Widget-Typen
function getWeatherTypeFromCode(code) {
    // Mapping basierend auf WMO Code Tabelle (vereinfacht)
    if ([0, 1].includes(code)) return 'sun';        // Clear sky, Mainly clear
    if ([2, 3].includes(code)) return 'cloudy';     // Partly cloudy, Overcast
    if ([45, 48].includes(code)) return 'wind';     // Fog and depositing rime fog -> Visualisierung als "windig" / diesig
    if ([51, 53, 55, 56, 57].includes(code)) return 'rain'; // Drizzle (light, moderate, dense), Freezing Drizzle
    if ([61, 63, 65, 66, 67].includes(code)) return 'rain'; // Rain (slight, moderate, heavy), Freezing Rain
    if ([71, 73, 75, 77].includes(code)) return 'snow'; // Snow fall (slight, moderate, heavy), Snow grains
    if ([80, 81, 82].includes(code)) return 'rain'; // Rain showers (slight, moderate, violent)
    if ([85, 86].includes(code)) return 'snow'; // Snow showers (slight, heavy)
    if ([95, 96, 99].includes(code)) return 'thunder';// Thunderstorm (slight/moderate, with slight/heavy hail)
    console.warn("Unbekannter oder nicht explizit gemappter Wettercode erhalten:", code);
    // Fallback für unbekannte oder nicht direkt gemappte Codes (z.B. 5, 10-12, 30-35 etc.)
    return 'cloudy'; // Ein neutraler Fallback
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

    // Debounced Geocoding auf Input
    searchInput.on('input', function() {
        clearTimeout(geocodeTimeout); // Alten Timer löschen
        const query = $(this).val();

        if (query.length >= 3) {
            geocodeTimeout = setTimeout(() => {
                fetchGeocodingData(query);
            }, 300); // 300ms warten nach letzter Eingabe
        } else {
            suggestionsContainer.empty().hide(); // Vorschläge ausblenden bei < 3 Zeichen
        }
    });

    // Enter im Suchfeld
    searchInput.on('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault(); // Standard-Enter-Verhalten verhindern
            const firstSuggestion = $('#location-suggestions div:first-child');
            if (firstSuggestion.length > 0) {
                firstSuggestion.trigger('click'); // Klick auf ersten Vorschlag simulieren
            } else {
                 // Wenn keine Vorschläge da sind, aber Enter gedrückt wird,
                 // versuchen wir trotzdem, mit der Eingabe zu suchen
                 const query = $(this).val();
                 if (query.length >= 3) {
                     fetchGeocodingData(query); // Erneute Suche auslösen
                 }
            }
        }
    });

    // Geolocation Button Klick
    geolocationButton.on('click', function() {
        if (navigator.geolocation) {
            console.log("Requesting geolocation...");
            // Optional: Ladezustand anzeigen
            locationNameElement.text("Suche Standort...");
            summary.text("");
            temp.html("--<span>c</span>");
            searchInput.val(''); // Suchfeld leeren
            suggestionsContainer.empty().hide(); // Vorschläge ausblenden

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    console.log("Geolocation success:", position.coords);
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    currentLat = lat; // Globale Koordinaten aktualisieren
                    currentLon = lon;
                    currentLocationName = "Aktueller Standort"; // Namen setzen

                    fetchWeatherData(lat, lon, currentLocationName); // Wetter holen
                },
                (error) => {
                    console.error("Geolocation error:", error);
                    let errorMsg = "Standort konnte nicht ermittelt werden.";
                    if (error.code === error.PERMISSION_DENIED) {
                        errorMsg = "Standortzugriff verweigert.";
                    } else if (error.code === error.POSITION_UNAVAILABLE) {
                        errorMsg = "Standortinformationen nicht verfügbar.";
                    } else if (error.code === error.TIMEOUT) {
                        errorMsg = "Standortabfrage Zeitüberschreitung.";
                    }
                    handleApiError(errorMsg); // Fehler im UI anzeigen
                },
                { // Optionen für getCurrentPosition
                    enableHighAccuracy: false, // Spart Akku
                    timeout: 10000,         // 10 Sekunden Timeout
                    maximumAge: 600000      // 10 Minuten altes Ergebnis akzeptieren
                }
            );
        } else {
            console.error("Geolocation is not supported by this browser.");
            handleApiError("Geolocation wird nicht unterstützt.");
        }
    });

    // Klick außerhalb der Suche schließt Vorschläge
    $(document).on('click', function(event) {
        // Prüfen, ob der Klick außerhalb des Such-Containers UND außerhalb der Vorschlagsliste erfolgte
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

	// 🖱 bind weather menu buttons
	for(var i = 0; i < weather.length; i++)
	{
		var w = weather[i];
		var b = $('#button-' + w.type);
		w.button = b;
		b.bind('click', w, changeWeather);
	}

	// ☁️ draw clouds
	for(var i = 0; i < clouds.length; i++)
	{
		clouds[i].offset = Math.random() * sizes.card.width;
		drawCloud(clouds[i], i);
	}

    // *** MODIFIZIERT: Wetter für Default-Ort holen ***
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

	innerSVG.attr({
		width: sizes.card.width,
		height: sizes.card.height
	})

	outerSVG.attr({
		width: sizes.container.width,
		height: sizes.container.height
	})

	backSVG.attr({
		width: sizes.container.width,
		height: sizes.container.height
	})

	gsap.set(sunburst.node, {transformOrigin:"50% 50%", x: sizes.container.width / 2, y: (sizes.card.height/2) + sizes.card.offset.top});
	gsap.fromTo(sunburst.node, {rotation: 0}, {duration: 20, rotation: 360, repeat: -1, ease: "none"});

	// LeafMask muss die gesamte Breite abdecken, beginnend links von der Karte
    // Korrektur: Die Maske sollte links von der Karte beginnen und den Rest des Containers abdecken
    var maskX = sizes.card.offset.left + sizes.card.width; // Start rechts von der Karte
    var maskWidth = sizes.container.width - maskX; // Breite bis zum rechten Rand
    if (maskWidth < 0) maskWidth = 0; // Sicherstellen, dass die Breite nicht negativ ist

    leafMask.attr({
        x: maskX,
        y: 0, // Oben beginnen
        width: maskWidth,
        height: sizes.container.height // Volle Höhe
    });
}

function drawCloud(cloud, i)
{
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
	cloud.path.animate({
  		d: path
	}, 0)
}

function makeRain()
{
    if (!currentWeather) return;
	// probability of rain drops
	if(Math.random() > settings.rainCount / 100) return; // Anpassung: rainCount als Wahrscheinlichkeit nutzen

	var lineWidth = Math.random() * 3;
	var lineLength = currentWeather.type == 'thunder' ? 35 : 14;
	var x = Math.random() * (sizes.card.width - 40) + 20; // Innerhalb der Karte
    var y = 0 - lineLength; // Start oberhalb

    // Wähle den richtigen Holder basierend auf der Liniendicke
    var holder;
    if (lineWidth < 1) holder = innerRainHolder1;
    else if (lineWidth < 2) holder = innerRainHolder2;
    else holder = innerRainHolder3;

	var line = holder.path('M0,0 0,' + lineLength).attr({
		fill: 'none',
		stroke: currentWeather.type == 'thunder' ? '#777' : '#0000ff', // Farbe anpassen?
		strokeWidth: lineWidth,
        transform: 't' + x + ',' + y // Startposition setzen
	});

	rain.push(line);
	gsap.to(line.node, {
        duration: 1,
        delay: Math.random() * 0.5, // Leichte Verzögerung
        y: sizes.card.height + lineLength, // Endposition unterhalb der Karte
        ease: "power1.in", // Beschleunigen
        onComplete: onRainEnd,
        onCompleteParams: [line, lineWidth, x, currentWeather.type]
    });
}

function onRainEnd(line, width, x, type)
{
    if (line && line.remove) { // Sicherstellen, dass line existiert und eine remove-Methode hat
	    line.remove();
    }
	line = null; // Referenz entfernen

    // Array säubern (effizienter als splice in loop)
    rain = rain.filter(item => item !== null && item.paper); // Behalte nur gültige Elemente

	// Nur wenn nötig, neuen Regen erzeugen (wird jetzt in tick() gesteuert)
	// if(rain.length < settings.rainCount) {
	// 	makeRain();
	// 	if(width > 2) makeSplash(x, type);
	// }
    // Stattdessen: Splash hier auslösen, wenn die Breite passt
    if (width > 2) {
        makeSplash(x, type);
    }
}

function makeSplash(x, type)
{
    if (!currentWeather || !outerSplashHolder) return; // Sicherstellen, dass alles da ist

	var splashLength = type == 'thunder' ? 30 : 20;
	var splashBounce = type == 'thunder' ? 120 : 100; // Höhe des Spritzers
	var splashDistance = 80; // Horizontale Ausbreitung
	var speed = type == 'thunder' ? 0.7 : 0.5;

	// Zufällige Spritzer-Parameter
	var randomX = ((Math.random() * splashDistance) - (splashDistance / 2)); // Horizontale Abweichung
	var randomY = 0 - (Math.random() * splashBounce); // Negative Y-Richtung (nach oben)

	var points = [];
	points.push('M' + 0 + ',' + 0); // Start am Boden
    points.push('Q' + randomX + ',' + randomY); // Kontrollpunkt (bestimmt Höhe und seitl. Ausbreitung)
    points.push((randomX * 2) + ',' + 0); // Endpunkt wieder am Boden (doppelte horiz. Abweichung)

	var splash = outerSplashHolder.path(points.join(' ')).attr({
      	fill: "none",
      	stroke: type == 'thunder' ? '#aaa' : '#88f', // Farben etwas heller?
      	strokeWidth: Math.random() * 1 + 0.5 // Dünnere Linien
    });

	var pathLength = splash.getTotalLength(); // Gesamtlänge des Pfades
	var xOffset = sizes.card.offset.left; // X-Position der Karte
	var yOffset = sizes.card.offset.top + sizes.card.height; // Y-Position des Kartenbodens

    // Startzustand für Animation
    splash.node.style.strokeDasharray = pathLength;
    splash.node.style.strokeDashoffset = pathLength; // Beginnt unsichtbar

    // Animation
	gsap.to(splash.node, {
        duration: speed,
        strokeDashoffset: 0, // Pfad "zeichnen"
        strokeWidth: 0, // Gleichzeitig dünner werden
        opacity: 0, // Ausblenden am Ende
        transformOrigin: "50% 100%", // Skalierung vom Boden aus (optional)
        // scaleY: 0.5, // Optional: Flacher werden
        x: xOffset + x, // Positionieren an der Aufprallstelle
        y: yOffset,
        ease: "power1.out", // Verlangsamen am Ende
        onComplete: onSplashComplete,
        onCompleteParams: [splash]
    });
}

function onSplashComplete(splash)
{
    if (splash && splash.remove) {
	    splash.remove();
    }
	splash = null;
}

function makeLeaf()
{
    if (!currentWeather || !outerLeafHolder || !innerLeafHolder) return; // Sicherstellen

	var scale = 0.5 + (Math.random() * 0.5);
	var newLeaf;
	var areaY = sizes.card.height / 2; // Bereich für Start-Y
	var startY = areaY + (Math.random() * areaY); // Start eher unten
	var endY = Math.random() * sizes.card.height; // End-Y irgendwo auf der Karte
	var startX, endX, xBezier;

	var colors = ['#76993E', '#4A5E23', '#6D632F', '#B4A94F']; // Mehr Farben
	var color = colors[Math.floor(Math.random() * colors.length)];

	// Entscheiden, ob Blatt innerhalb oder außerhalb der Karte animiert
	if (Math.random() > 0.5) { // Außerhalb (von links nach rechts)
		newLeaf = leaf.clone().appendTo(outerLeafHolder).attr({ fill: color });
		startY = sizes.card.offset.top + Math.random() * sizes.container.height; // Start irgendwo links
		endY = sizes.card.offset.top + Math.random() * sizes.container.height; // Ende irgendwo rechts
		startX = sizes.card.offset.left - 40; // Start links außerhalb
		endX = sizes.container.width + 40; // Ende rechts außerhalb
        xBezier = startX + (endX - startX) * (0.3 + Math.random() * 0.4); // Bezier-Punkt irgendwo dazwischen
	} else { // Innerhalb (von oben nach unten/seitlich)
		newLeaf = leaf.clone().appendTo(innerLeafHolder).attr({ fill: color });
        startY = -40; // Start oben außerhalb der Karte
        endY = sizes.card.height + 40; // Ende unten außerhalb
        startX = Math.random() * sizes.card.width; // Start irgendwo horizontal
        endX = Math.random() * sizes.card.width; // Ende irgendwo horizontal
        xBezier = startX + (Math.random() - 0.5) * sizes.card.width * 0.5; // Bezier seitlich
	}

	leafs.push(newLeaf);

	var bezierPath = [{x:startX, y:startY}, {x: xBezier, y: startY + (endY - startY) * (0.3 + Math.random() * 0.4)}, {x: endX, y:endY}];

    gsap.fromTo(newLeaf.node, {
        rotation: Math.random() * 360, // Startrotation
        scale: scale,
        x: startX, // GSAP braucht Startwerte hier, wenn nicht über MotionPath gesetzt
        y: startY
    }, {
        duration: 5 + Math.random() * 5, // Langsamere, variablere Dauer
        rotation: "+=" + (Math.random() * 720 - 360), // Weiterdrehen
        motionPath: {
            path: bezierPath,
            curviness: 1.5 // Mehr Kurve
        },
        onComplete: onLeafEnd,
        onCompleteParams: [newLeaf],
        ease: "power1.inOut" // Sanfter Start/Ende
    });
}


function onLeafEnd(leaf)
{
    if (leaf && leaf.remove) {
	    leaf.remove();
    }
	leaf = null;
    leafs = leafs.filter(item => item !== null && item.paper); // Array säubern
	// Wird in tick() gesteuert
    // if(leafs.length < settings.leafCount) { makeLeaf(); }
}

function makeSnow()
{
    if (!currentWeather || !outerSnowHolder || !innerSnowHolder) return;

	var scale = 0.3 + (Math.random() * 0.7); // Kleinere Flocken möglich
	var newSnow;
	var startX = Math.random() * sizes.card.width;
	var startY = -10; // Start oben
	var endY;

	// Entscheiden, ob innen oder außen (basierend auf Skalierung -> größere Flocken eher außen?)
	if (scale > 0.7 && Math.random() > 0.5) { // Größere Flocke, außen
		newSnow = outerSnowHolder.circle(0, 0, 4 * scale).attr({ fill: 'white', opacity: 0.8 }); // Größe an scale binden, leicht transparent
		startY = sizes.card.offset.top - 10; // Start über der Karte
        startX = sizes.card.offset.left + Math.random() * sizes.card.width; // Start über der Karte horizontal
		endY = sizes.container.height + 10; // Ende unter dem Container
	} else { // Kleinere Flocke oder innen
		newSnow = innerSnowHolder.circle(0, 0 , 4 * scale).attr({ fill: 'white', opacity: 0.9 });
		endY = sizes.card.height + 10; // Ende unter der Karte
	}

	snow.push(newSnow);

    // Fallanimation
	gsap.to(newSnow.node, {
        duration: 4 + Math.random() * 6, // Langsamere, variablere Dauer
        x: startX + (Math.random() * 100 - 50), // Leichte horizontale Drift
        y: endY,
        ease: "none", // Konstanter Fall
        onComplete: onSnowEnd,
        onCompleteParams: [newSnow]
    });

    // Einblenden und leichte horizontale Pendelbewegung
    gsap.from(newSnow.node, { duration: 1, scale: 0, opacity: 0, ease: "power1.out"});
	gsap.to(newSnow.node, {
        duration: 3 + Math.random() * 2,
        x: "+=" + (Math.random() * 60 - 30), // Pendelbewegung
        repeat: -1, // Endlos
        yoyo: true, // Hin und her
        ease: "sine.inOut" // Sanfte Pendelbewegung
    });
}

function onSnowEnd(flake)
{
    if (flake && flake.remove) {
	    flake.remove();
    }
	flake = null;
    snow = snow.filter(item => item !== null && item.paper); // Array säubern
	// Wird in tick() gesteuert
    // if(snow.length < settings.snowCount) { makeSnow(); }
}

function tick()
{
    if (!currentWeather) {
        requestAnimationFrame(tick);
        return;
    }

	tickCount++;
	var check = tickCount % settings.renewCheck; // Prüfintervall

    // Erzeuge Partikel basierend auf Wahrscheinlichkeit/Anzahl
    // Diese Logik stellt sicher, dass nicht bei jedem Tick geprüft wird,
    // sondern nur, wenn die Anzahl unter dem Ziel liegt UND eine gewisse Wahrscheinlichkeit erfüllt ist.
    if (rain.length < settings.rainCount && Math.random() < 0.5) makeRain(); // 50% Chance pro Tick, wenn < rainCount
    if (leafs.length < settings.leafCount && Math.random() < 0.2) makeLeaf(); // 20% Chance pro Tick, wenn < leafCount
    if (snow.length < settings.snowCount && Math.random() < 0.3) makeSnow(); // 30% Chance pro Tick, wenn < snowCount


	// Wolkenbewegung
	for(var i = 0; i < clouds.length; i++)
	{
        var cloudGroup = clouds[i].group;
        if (!cloudGroup) continue; // Sicherheitshalber prüfen

        var cloudSpeed = settings.windSpeed / (i + 1); // Unterschiedliche Geschwindigkeit pro Wolkenschicht

		if(currentWeather.type == 'sun')
		{
            // Bei Sonne: Wolken bewegen sich langsam raus und kommen von der anderen Seite wieder rein
            // Diese Logik war etwas komplex, vereinfachen wir sie:
            clouds[i].offset += cloudSpeed * 0.5; // Langsamer bei Sonne
            if (clouds[i].offset > sizes.card.width * 1.5) { // Wenn weit genug rechts raus
                 clouds[i].offset = -(sizes.card.width * 1.5); // Ganz links wieder reinsetzen
            }
		}
		else
		{
            // Bei anderem Wetter: Normale Bewegung
			clouds[i].offset += cloudSpeed;
			if(clouds[i].offset > sizes.card.width) { // Wenn rechts raus
                clouds[i].offset -= sizes.card.width; // Links wieder rein (nahtloser Loop)
            }
		}
        // Transformation anwenden
        cloudGroup.transform('t' + clouds[i].offset + ',' + 0);
	}

	requestAnimationFrame(tick); // Nächsten Frame anfordern
}


function reset()
{
	for(var i = 0; i < weather.length; i++) {
		container.removeClass(weather[i].type);
		if (weather[i].button) {
		    weather[i].button.removeClass('active');
		}
	}
    // Aktiven Button auch entfernen, falls er nicht im Array war (z.B. bei API-Wechsel)
    $('nav li a.active').removeClass('active');
}

function updateSummaryText()
{
    if (!currentWeather) return;
	summary.html(currentWeather.name);
	// Sanftere Einblendung
    gsap.fromTo(summary, { opacity: 0, x: 20 }, { duration: 1, opacity: 1, x: 0, ease: "power2.out" });
}

function startLightningTimer()
{
	if(lightningTimeout) clearTimeout(lightningTimeout);
	if(currentWeather && currentWeather.type == 'thunder') {
		lightningTimeout = setTimeout(lightning, 2000 + Math.random() * 6000); // Längere, variablere Pause
	}
}

function lightning()
{
    if (!currentWeather || currentWeather.type !== 'thunder' || !weatherContainer1) return; // Nur bei Gewitter

	startLightningTimer(); // Nächsten Blitz planen

    // Kurzes Aufhellen des Hintergrunds
    gsap.to(card, { duration: 0.05, backgroundColor: '#d0d0e0', yoyo: true, repeat: 1 }); // Heller Hintergrundblitz

    // Blitz-Pfad generieren
	var pathX = 30 + Math.random() * (sizes.card.width - 60); // Start-X
	var yOffset = 20; // Maximale seitliche Abweichung pro Segment
	var segmentHeight = 15 + Math.random() * 10; // Höhe eines Blitzsegments
    var steps = Math.floor(sizes.card.height / segmentHeight); // Anzahl der Segmente
	var points = [pathX + ',0']; // Startpunkt oben

	for(var i = 0; i < steps; i++) {
		var x = pathX + (Math.random() * yOffset - (yOffset / 2)); // Zufällige X-Abweichung
		var y = segmentHeight * (i + 1);
		points.push(x + ',' + y);
        pathX = x; // Nächstes Segment startet beim X des vorherigen Endpunkts
	}

	var strike = weatherContainer1.path('M' + points.join(' ')).attr({
		fill: 'none',
		stroke: 'white',
		strokeWidth: 1 + Math.random() * 2 // Variable Dicke
	});

    // Blitz-Animation (schnelles Ein- und Ausblenden)
	gsap.fromTo(strike.node, { opacity: 1 }, {
        duration: 0.7, // Dauer des Blitzes
        opacity: 0,
        ease: "expo.out", // Schnelles Ausblenden
        onComplete: function(){ if (strike && strike.remove) strike.remove(); strike = null; }
    });
}

function changeWeather(weatherData)
{
    // Verhindert unnötige Animationen, wenn sich nichts ändert
    if (currentWeather && currentWeather.type === weatherData.type) {
         // Nur Text aktualisieren, falls nötig
         if (summary.html() !== weatherData.name) {
             gsap.to(summary, {duration: 0.5, opacity: 0, x: -20, onComplete: function() {
                 summary.html(weatherData.name);
                 gsap.to(summary, {duration: 0.5, opacity: 1, x: 0, ease: "power2.out"});
             }, ease: "power2.in"});
         }
        return; // Nichts weiter tun
    }

    var newWeather = weatherData.data ? weatherData.data : weatherData; // Entpacken, falls in data-Objekt

	reset(); // Alte Klassen und aktive Buttons entfernen
	currentWeather = newWeather; // Globalen Wetterzustand aktualisieren

    // Summary Text animieren
	gsap.to(summary, {duration: 0.8, opacity: 0, x: -20, onComplete: updateSummaryText, ease: "power2.in"});

    // CSS-Klasse für den Container setzen (steuert Hintergrund etc.)
	container.addClass(currentWeather.type);

    // Zugehörigen Button aktivieren
    const matchingButton = $('#button-' + currentWeather.type);
    if (matchingButton.length) {
        matchingButton.addClass('active');
    }

    // Zielwerte für Animationen basierend auf Wettertyp setzen
	let windTarget, rainTarget, leafTarget, snowTarget;
    let sunXTarget, sunYTarget, sunburstScaleTarget, sunburstOpacityTarget, sunburstYTarget;

	switch(currentWeather.type) {
		case 'wind':
            windTarget = 5; rainTarget = 0; leafTarget = 15; snowTarget = 0; // Mehr Wind, mehr Blätter
            sunXTarget = sizes.card.width / 2; sunYTarget = -150; // Sonne weit weg
            sunburstScaleTarget = 0.3; sunburstOpacityTarget = 0; sunburstYTarget = (sizes.container.height/2)-50;
			break;
		case 'sun':
            windTarget = 2; rainTarget = 0; leafTarget = 0; snowTarget = 0; // Leichter Wind
            sunXTarget = sizes.card.width / 2; sunYTarget = sizes.card.height * 0.3; // Sonne sichtbar, aber nicht mittig
            sunburstScaleTarget = 1; sunburstOpacityTarget = 0.8; sunburstYTarget = (sizes.card.height * 0.3) + sizes.card.offset.top; // Sunburst bei der Sonne
			break;
        case 'rain':
            windTarget = 1; rainTarget = 40; leafTarget = 0; snowTarget = 0; // Wenig Wind, viel Regen (rainCount ist eher Wahrscheinlichkeit)
            sunXTarget = sizes.card.width / 2; sunYTarget = -150;
            sunburstScaleTarget = 0.3; sunburstOpacityTarget = 0; sunburstYTarget = (sizes.container.height/2)-50;
            break;
        case 'thunder':
            windTarget = 2; rainTarget = 80; leafTarget = 0; snowTarget = 0; // Mehr Wind, sehr viel Regen
            sunXTarget = sizes.card.width / 2; sunYTarget = -150;
            sunburstScaleTarget = 0.3; sunburstOpacityTarget = 0; sunburstYTarget = (sizes.container.height/2)-50;
            break;
        case 'snow':
            windTarget = 0.5; rainTarget = 0; leafTarget = 0; snowTarget = 60; // Wenig Wind, viel Schnee
            sunXTarget = sizes.card.width / 2; sunYTarget = -150;
            sunburstScaleTarget = 0.3; sunburstOpacityTarget = 0; sunburstYTarget = (sizes.container.height/2)-50;
            break;
        case 'cloudy':
            windTarget = 1; rainTarget = 0; leafTarget = 0; snowTarget = 0; // Leichter Wind
            sunXTarget = sizes.card.width / 2; sunYTarget = -150;
            sunburstScaleTarget = 0.3; sunburstOpacityTarget = 0; sunburstYTarget = (sizes.container.height/2)-50;
            break;
		default: // Fallback
            windTarget = 1; rainTarget = 0; leafTarget = 0; snowTarget = 0;
            sunXTarget = sizes.card.width / 2; sunYTarget = -150;
            sunburstScaleTarget = 0.3; sunburstOpacityTarget = 0; sunburstYTarget = (sizes.container.height/2)-50;
			break;
	}

    // GSAP Animationen für die Einstellungsänderungen
    gsap.to(settings, { duration: 2, windSpeed: windTarget, ease: "power2.inOut" });
    gsap.to(settings, { duration: 2, rainCount: rainTarget, ease: "power2.inOut" });
    gsap.to(settings, { duration: 2, leafCount: leafTarget, ease: "power2.inOut" });
    gsap.to(settings, { duration: 2, snowCount: snowTarget, ease: "power2.inOut" });

    // GSAP Animationen für Sonne und Sunburst
    gsap.to(sun.node, { duration: 3, x: sunXTarget, y: sunYTarget, ease: "power2.inOut" });
    gsap.to(sunburst.node, { duration: 3, scale: sunburstScaleTarget, opacity: sunburstOpacityTarget, y: sunburstYTarget, ease: "power2.inOut" });

    // Blitz-Timer starten/stoppen
	startLightningTimer();
}