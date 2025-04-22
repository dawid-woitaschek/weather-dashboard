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
    const url = `${GEOCODING_API_URL_BASE}?name=${encodeURIComponent(query)}&count=10&language=de&format=json`;
    console.log("Requesting Geocoding URL:", url);

    $.get(url)
        .done(function(data) {
            console.log("Geocoding Data:", data);
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

// *** NEU: Funktion zum Anzeigen der Vorschläge ***
function displaySuggestions(results) {
    suggestionsContainer.empty().hide(); // Erst leeren und verstecken

    if (!results || results.length === 0) {
        return; // Nichts zu tun, wenn keine Ergebnisse
    }

    // Deutschland priorisieren
    results.sort((a, b) => {
        const scoreA = a.country_code === 'DE' ? 1000 + (a.admin1 === 'Nordrhein-Westfalen' ? 10 : 0) : (a.population || 0); // NRW leicht bevorzugen
        const scoreB = b.country_code === 'DE' ? 1000 + (b.admin1 === 'Nordrhein-Westfalen' ? 10 : 0) : (b.population || 0);
        // Sortiere primär nach DE, dann nach Population (absteigend)
        if (a.country_code === 'DE' && b.country_code !== 'DE') return -1;
        if (a.country_code !== 'DE' && b.country_code === 'DE') return 1;
        return scoreB - scoreA; // Höhere Population zuerst
    });


    results.forEach(location => {
        // Zusätzliche Details für die Anzeige (Bundesland/Region, Land)
        let details = [];
        if (location.admin1) details.push(location.admin1);
        if (location.country && location.country_code !== 'DE') details.push(location.country); // Land nur anzeigen, wenn nicht DE

        const suggestionHTML = `
            <div data-lat="${location.latitude}" data-lon="${location.longitude}" data-name="${location.name}">
                ${location.name}
                ${details.length > 0 ? `<span class="suggestion-details">(${details.join(', ')})</span>` : ''}
            </div>
        `;
        suggestionsContainer.append(suggestionHTML);
    });

    // Event Listener für Klicks auf Vorschläge hinzufügen
    $('#location-suggestions div').on('click', function() {
        const lat = $(this).data('lat');
        const lon = $(this).data('lon');
        const name = $(this).data('name');

        console.log(`Suggestion selected: ${name} (${lat}, ${lon})`);

        currentLat = lat; // Globale Koordinaten aktualisieren
        currentLon = lon;
        currentLocationName = name; // Globalen Namen aktualisieren

        fetchWeatherData(lat, lon, name); // Wetter für gewählten Ort holen

        searchInput.val(''); // Input leeren
        suggestionsContainer.empty().hide(); // Vorschläge ausblenden
    });

    suggestionsContainer.show(); // Vorschläge anzeigen
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
    if ([0, 1].includes(code)) return 'sun';
    if ([2, 3].includes(code)) return 'cloudy';
    if ([45, 48].includes(code)) return 'wind'; // Nebel -> Windig
    if ([51, 53, 55, 56, 57].includes(code)) return 'rain';
    if ([61, 63, 65, 66, 67].includes(code)) return 'rain';
    if ([71, 73, 75, 77].includes(code)) return 'snow';
    if ([80, 81, 82].includes(code)) return 'rain';
    if ([85, 86].includes(code)) return 'snow';
    if ([95, 96, 99].includes(code)) return 'thunder';
    console.warn("Unbekannter Wettercode erhalten:", code);
    return 'sun';
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
        if (!searchContainer.is(event.target) && searchContainer.has(event.target).length === 0) {
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

	leafMask.attr({x: sizes.card.offset.left, y: 0, width: sizes.container.width - sizes.card.offset.left,  height: sizes.container.height});
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
	var lineWidth = Math.random() * 3;
	var lineLength = currentWeather.type == 'thunder' ? 35 : 14;
	var x = Math.random() * (sizes.card.width - 40) + 20;
	var line = this['innerRainHolder' + (3 - Math.floor(lineWidth))].path('M0,0 0,' + lineLength).attr({
		fill: 'none',
		stroke: currentWeather.type == 'thunder' ? '#777' : '#0000ff',
		strokeWidth: lineWidth
	});

	rain.push(line);
	gsap.fromTo(line.node, {x: x, y: 0- lineLength}, {duration: 1, delay: Math.random(), y: sizes.card.height, ease: "power2.in", onComplete: onRainEnd, onCompleteParams: [line, lineWidth, x, currentWeather.type]});
}

function onRainEnd(line, width, x, type)
{
	line.remove();
	line = null;
	for(var i in rain) { if(!rain[i].paper) rain.splice(i, 1); }
	if(rain.length < settings.rainCount) {
		makeRain();
		if(width > 2) makeSplash(x, type);
	}
}

function makeSplash(x, type)
{
    if (!currentWeather) return;
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

	var splash = outerSplashHolder.path(points.join(' ')).attr({
      	fill: "none",
      	stroke: type == 'thunder' ? '#777' : '#0000ff',
      	strokeWidth: 1
    });

	var pathLength = Snap.path.getTotalLength(splash);
	var xOffset = sizes.card.offset.left;
	var yOffset = sizes.card.offset.top + sizes.card.height;
    splash.node.style.strokeDasharray = splashLength + ' ' + pathLength;

	gsap.fromTo(splash.node, {strokeWidth: 2, y: yOffset, x: xOffset + x, opacity: 1, strokeDashoffset: splashLength}, {duration: speed, strokeWidth: 0, strokeDashoffset: - pathLength, opacity: 1, onComplete: onSplashComplete, onCompleteParams: [splash], ease: "power1.easeOut"})
}

function onSplashComplete(splash)
{
	splash.remove();
	splash = null;
}

function makeLeaf()
{
	var scale = 0.5 + (Math.random() * 0.5);
	var newLeaf;
	var areaY = sizes.card.height/2;
	var y = areaY + (Math.random() * areaY);
	var endY = y - ((Math.random() * (areaY * 2)) - areaY)
	var x;
	var endX;
	var colors = ['#76993E', '#4A5E23', '#6D632F'];
	var color = colors[Math.floor(Math.random() * colors.length)];
	var xBezier;

	if(scale > 0.8) {
		newLeaf = leaf.clone().appendTo(outerLeafHolder).attr({ fill: color });
		y = y + sizes.card.offset.top / 2;
		endY = endY + sizes.card.offset.top / 2;
		x = sizes.card.offset.left - 100;
		xBezier = x + (sizes.container.width - sizes.card.offset.left) / 2;
		endX = sizes.container.width + 50;
	} else {
		newLeaf = leaf.clone().appendTo(innerLeafHolder).attr({ fill: color });
		x = -100;
		xBezier = sizes.card.width / 2;
		endX = sizes.card.width + 50;
	}

	leafs.push(newLeaf);

	var bezier = [{x:x, y:y}, {x: xBezier, y:(Math.random() * endY) + (endY / 3)}, {x: endX, y:endY}];
    gsap.fromTo(newLeaf.node, {
        rotation: Math.random()* 180,
        scale: scale
    }, {
        duration: 4, // Langsamere Blattgeschwindigkeit
        rotation: Math.random()* 360,
        motionPath: {
            path: bezier,
            curviness: 1.25
        },
        onComplete: onLeafEnd,
        onCompleteParams: [newLeaf],
        ease: "none"
    });
}

function onLeafEnd(leaf)
{
	leaf.remove();
	leaf = null;
	for(var i in leafs) { if(!leafs[i].paper) leafs.splice(i, 1); }
	if(leafs.length < settings.leafCount) { makeLeaf(); }
}

function makeSnow()
{
	var scale = 0.5 + (Math.random() * 0.5);
	var newSnow;
	var x = 20 + (Math.random() * (sizes.card.width - 40));
	var y = -10;
	var endY;

	if(scale > 0.8) {
		newSnow = outerSnowHolder.circle(0, 0, 5).attr({ fill: 'white' });
		endY = sizes.container.height + 10;
		y = sizes.card.offset.top + settings.cloudHeight;
		x =  x + sizes.card.offset.left;
	} else {
		newSnow = innerSnowHolder.circle(0, 0 ,5).attr({ fill: 'white' });
		endY = sizes.card.height + 10;
	}

	snow.push(newSnow);
	gsap.fromTo(newSnow.node, {x: x, y: y}, {duration: 3 + (Math.random() * 5), y: endY, onComplete: onSnowEnd, onCompleteParams: [newSnow], ease: "none"})
	gsap.fromTo(newSnow.node, {scale: 0}, {duration: 1, scale: scale, ease: "power1.inOut"})
	gsap.to(newSnow.node, {duration: 3, x: x+((Math.random() * 150)-75), repeat: -1, yoyo: true, ease: "power1.inOut"})
}

function onSnowEnd(flake)
{
	flake.remove();
	flake = null;
	for(var i in snow) { if(!snow[i].paper) snow.splice(i, 1); }
	if(snow.length < settings.snowCount) { makeSnow(); }
}

function tick()
{
    if (!currentWeather) {
        requestAnimationFrame(tick);
        return;
    }

	tickCount++;
	var check = tickCount % settings.renewCheck;

	if(check) {
		if(rain.length < settings.rainCount) makeRain();
		if(leafs.length < settings.leafCount) makeLeaf();
		if(snow.length < settings.snowCount) makeSnow();
	}

	for(var i = 0; i < clouds.length; i++)
	{
		if(currentWeather.type == 'sun')
		{
			if(clouds[i].offset > -(sizes.card.width * 1.5)) clouds[i].offset += settings.windSpeed / (i + 1);
			if(clouds[i].offset > sizes.card.width * 2.5) clouds[i].offset = -(sizes.card.width * 1.5);
			clouds[i].group.transform('t' + clouds[i].offset + ',' + 0);
		}
		else
		{
			clouds[i].offset += settings.windSpeed / (i + 1);
			if(clouds[i].offset > sizes.card.width) clouds[i].offset = 0 + (clouds[i].offset - sizes.card.width);
			clouds[i].group.transform('t' + clouds[i].offset + ',' + 0);
		}
	}

	requestAnimationFrame(tick);
}


function reset()
{
	for(var i = 0; i < weather.length; i++) {
		container.removeClass(weather[i].type);
		if (weather[i].button) {
		    weather[i].button.removeClass('active');
		}
	}
}

function updateSummaryText()
{
    if (!currentWeather) return;
	summary.html(currentWeather.name);
	gsap.fromTo(summary, {x: 30}, {duration: 1.5, opacity: 1, x: 0, ease: "power4.out"});
}

function startLightningTimer()
{
	if(lightningTimeout) clearTimeout(lightningTimeout);
	if(currentWeather && currentWeather.type == 'thunder') {
		lightningTimeout = setTimeout(lightning, Math.random()*6000);
	}
}

function lightning()
{
	startLightningTimer();
	gsap.fromTo(card, {y: -30}, {duration: 0.75, y:0, ease:"elastic.out"});

	var pathX = 30 + Math.random() * (sizes.card.width - 60);
	var yOffset = 20;
	var steps = 20;
	var points = [pathX + ',0'];
	for(var i = 0; i < steps; i++) {
		var x = pathX + (Math.random() * yOffset - (yOffset / 2));
		var y = (sizes.card.height / steps) * (i + 1)
		points.push(x + ',' + y);
	}

	var strike = weatherContainer1.path('M' + points.join(' ')).attr({
		fill: 'none',
		stroke: 'white',
		strokeWidth: 2 + Math.random()
	})

	gsap.to(strike.node, {duration: 1, opacity: 0, ease:"power4.out", onComplete: function(){ strike.remove(); strike = null}})
}

function changeWeather(weatherData)
{
    var newWeather = weatherData.data ? weatherData.data : weatherData;

    // Verhindert unnötige Animationen, wenn sich nichts ändert (wichtig bei API-Updates)
    // if (currentWeather && currentWeather.type === newWeather.type) {
    //      // Nur Text aktualisieren, falls nötig (z.B. wenn Name sich ändern könnte)
    //      if (summary.html() !== newWeather.name) {
    //          gsap.killTweensOf(summary);
    //          gsap.to(summary, {duration: 0.5, opacity: 0, x: -30, onComplete: function() {
    //              summary.html(newWeather.name);
    //              gsap.to(summary, {duration: 0.5, opacity: 1, x: 0, ease: "power4.out"});
    //          }, ease: "power4.in"});
    //      }
    //     return;
    // }
    // ^^^ Auskommentiert: Erlaubt "Neuladen" des gleichen Zustands, falls gewünscht

	reset();
	currentWeather = newWeather; // Globalen Wetterzustand aktualisieren

	gsap.killTweensOf(summary);
	gsap.to(summary, {duration: 1, opacity: 0, x: -30, onComplete: updateSummaryText, ease: "power4.in"})

	container.addClass(currentWeather.type);
    if (currentWeather.button) {
	    currentWeather.button.addClass('active');
    } else {
        // Finde den Button, falls er nicht direkt übergeben wurde (z.B. bei API-Aufruf)
        const matchingButton = $('#button-' + currentWeather.type);
        if (matchingButton.length) {
            matchingButton.addClass('active');
        }
    }


	let windTarget, rainTarget, leafTarget, snowTarget;
    let sunXTarget, sunYTarget, sunburstScaleTarget, sunburstOpacityTarget, sunburstYTarget;

	switch(currentWeather.type) {
		case 'wind':
            windTarget = 3; rainTarget = 0; leafTarget = 5; snowTarget = 0;
            sunXTarget = sizes.card.width / 2; sunYTarget = -100;
            sunburstScaleTarget = 0.4; sunburstOpacityTarget = 0; sunburstYTarget = (sizes.container.height/2)-50;
			break;
		case 'sun':
            windTarget = 20; rainTarget = 0; leafTarget = 0; snowTarget = 0;
            sunXTarget = sizes.card.width / 2; sunYTarget = sizes.card.height / 2;
            sunburstScaleTarget = 1; sunburstOpacityTarget = 0.8; sunburstYTarget = (sizes.card.height/2) + (sizes.card.offset.top);
			break;
        case 'rain':
            windTarget = 0.5; rainTarget = 10; leafTarget = 0; snowTarget = 0;
            sunXTarget = sizes.card.width / 2; sunYTarget = -100;
            sunburstScaleTarget = 0.4; sunburstOpacityTarget = 0; sunburstYTarget = (sizes.container.height/2)-50;
            break;
        case 'thunder':
            windTarget = 0.5; rainTarget = 60; leafTarget = 0; snowTarget = 0;
            sunXTarget = sizes.card.width / 2; sunYTarget = -100;
            sunburstScaleTarget = 0.4; sunburstOpacityTarget = 0; sunburstYTarget = (sizes.container.height/2)-50;
            break;
        case 'snow':
            windTarget = 0.5; rainTarget = 0; leafTarget = 0; snowTarget = 40;
            sunXTarget = sizes.card.width / 2; sunYTarget = -100;
            sunburstScaleTarget = 0.4; sunburstOpacityTarget = 0; sunburstYTarget = (sizes.container.height/2)-50;
            break;
        case 'cloudy':
            windTarget = 0.5;
            rainTarget = 0;
            leafTarget = 0;
            snowTarget = 0;
            sunXTarget = sizes.card.width / 2; sunYTarget = -100;
            sunburstScaleTarget = 0.4; sunburstOpacityTarget = 0; sunburstYTarget = (sizes.container.height/2)-50;
            break;
		default:
            windTarget = 0.5; rainTarget = 0; leafTarget = 0; snowTarget = 0;
            sunXTarget = sizes.card.width / 2; sunYTarget = -100;
            sunburstScaleTarget = 0.4; sunburstOpacityTarget = 0; sunburstYTarget = (sizes.container.height/2)-50;
			break;
	}

    gsap.to(settings, { duration: 3, windSpeed: windTarget, ease: "power2.inOut" });
    gsap.to(settings, { duration: currentWeather.type === 'rain' || currentWeather.type === 'thunder' ? 3 : 1, rainCount: rainTarget, ease: "power2.inOut" });
    gsap.to(settings, { duration: currentWeather.type === 'wind' ? 3 : 1, leafCount: leafTarget, ease: "power2.inOut" });
    gsap.to(settings, { duration: currentWeather.type === 'snow' ? 3 : 1, snowCount: snowTarget, ease: "power2.inOut" });

    gsap.to(sun.node, { duration: currentWeather.type === 'sun' ? 4 : 2, x: sunXTarget, y: sunYTarget, ease: "power2.inOut" });
    gsap.to(sunburst.node, { duration: currentWeather.type === 'sun' ? 4 : 2, scale: sunburstScaleTarget, opacity: sunburstOpacityTarget, y: sunburstYTarget, ease: "power2.inOut" });

	startLightningTimer();
}