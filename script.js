// 📝 Fetch all DOM nodes in jQuery and Snap SVG
var container = $('.container');
var card = $('#card');
var innerSVG = Snap('#inner');
var outerSVG = Snap('#outer');
var backSVG = Snap('#back');
var summary = $('#summary');
var date = $('#date');
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

// Set mask for leaf holder
outerLeafHolder.attr({
	'clip-path': leafMask
});

// create sizes object, we update this later
var sizes = {
	container: { width: 0, height: 0 },
	card: { width: 0, height: 0 }
};

// grab cloud groups
var clouds = [
	{ group: Snap.select('#cloud1') },
	{ group: Snap.select('#cloud2') },
	{ group: Snap.select('#cloud3') }
];

// set weather types ☁️ 🌬 🌧 ⛈ ☀️
// Diese Struktur wird jetzt auch verwendet, um den API-Code zuzuordnen
var weather = [
	{ type: 'snow', name: 'Snow', wmoCodes: [71, 73, 75, 77, 85, 86] }, // Schneefall, Schneekörner
	{ type: 'wind', name: 'Windy', wmoCodes: [] }, // Wird vorerst nicht direkt durch Code ausgelöst, könnte man über Windgeschwindigkeit machen
	{ type: 'rain', name: 'Rain', wmoCodes: [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82] }, // Niesel, Regen, Gefrierender Regen, Schauer
	{ type: 'thunder', name: 'Storms', wmoCodes: [95, 96, 99] }, // Gewitter
	{ type: 'sun', name: 'Sunny', wmoCodes: [0, 1, 2, 3] } // Klar, leicht bewölkt etc.
];
var defaultWeatherType = 'sun'; // Fallback

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
var currentWeather = null; // Wird jetzt durch API oder Klick gesetzt

// +++ NEU: Open-Meteo API Konfiguration +++
const LATITUDE = 52.52; // Berlin
const LONGITUDE = 13.41; // Berlin
const API_URL = `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}¤t_weather=true&temperature_unit=celsius&windspeed_unit=kmh&timezone=Europe%2FBerlin`;

// ⚙ initialize app
init();

// 👁 watch for window resize
$(window).resize(onResize);

// 🏃 start animations
requestAnimationFrame(tick);

function init() {
	onResize();

	// 🖱 bind weather menu buttons
	for (var i = 0; i < weather.length; i++) {
		var w = weather[i];
		// Nur Buttons für Typen erstellen, die auch im Array definiert sind
		if (w.type) {
			var b = $('#button-' + w.type);
			if (b.length) { // Prüfen, ob der Button existiert
				w.button = b;
				// Korrektur: Klick-Handler korrekt binden
				// Wir übergeben das Wetter-Objekt direkt
				b.on('click', w, changeWeather);
            } else {
                console.warn(`Button #button-${w.type} not found.`);
            }
		}
	}

	// ☁️ draw clouds
	for (var i = 0; i < clouds.length; i++) {
		clouds[i].offset = Math.random() * sizes.card.width;
		drawCloud(clouds[i], i);
	}

	// ☀️ Set initial weather from API
	fetchWeatherData(); // Startet den API-Abruf

	TweenMax.set(sunburst.node, { opacity: 0 });
	// Entferne den statischen Start: changeWeather(weather[0]);
}

// +++ NEU: Funktion zum Abrufen der Wetterdaten +++
function fetchWeatherData() {
    console.log("Fetching weather data from Open-Meteo...");
    summary.html("Loading..."); // Ladezustand anzeigen
    TweenMax.set(summary, { opacity: 1, x: 0 }); // Sicherstellen, dass es sichtbar ist

    fetch(API_URL)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("Weather data received:", data);
            if (data && data.current_weather) {
                const temp = Math.round(data.current_weather.temperature);
                const wmoCode = data.current_weather.weathercode;
                const time = data.current_weather.time;

                // UI aktualisieren
                updateTemperature(temp);
                updateDate(time);

                // Wettertyp basierend auf WMO-Code bestimmen
                const weatherType = mapWmoCodeToType(wmoCode);
                console.log(`WMO Code: ${wmoCode}, Mapped Type: ${weatherType}`);

                // Finde das passende Wetter-Objekt aus unserem Array
                const targetWeather = weather.find(w => w.type === weatherType) || weather.find(w => w.type === defaultWeatherType);

                if (targetWeather) {
                    changeWeather(targetWeather); // Löst die visuellen Änderungen aus
                } else {
                    console.error("Could not find weather configuration for type:", weatherType);
                     // Fallback zum Default, falls etwas schiefgeht
                    changeWeather(weather.find(w => w.type === defaultWeatherType));
                }

            } else {
                 throw new Error("Invalid data format received from API.");
            }
        })
        .catch(error => {
            console.error("Error fetching weather data:", error);
            summary.html("Error loading weather");
            // Optional: Setze einen Standard-Wetterzustand bei Fehler
            const defaultW = weather.find(w => w.type === defaultWeatherType);
             if (defaultW) {
                 changeWeather(defaultW);
             }
             updateTemperature("?"); // Zeige Fragezeichen bei Fehler
        });
}

// +++ NEU: Funktion zum Mappen des WMO Codes +++
function mapWmoCodeToType(code) {
    for (const weatherType of weather) {
        if (weatherType.wmoCodes && weatherType.wmoCodes.includes(code)) {
            return weatherType.type;
        }
    }
    // Fallback für unbekannte Codes (könnte man spezifischer machen, z.B. für Wolken)
    // WMO 45, 48 (Nebel) -> vielleicht 'rain' oder einen eigenen Typ?
    if ([45, 48].includes(code)) return 'rain'; // Behandle Nebel visuell wie leichten Regen/Wolken
    console.warn(`WMO code ${code} not explicitly mapped. Using default: ${defaultWeatherType}`);
    return defaultWeatherType; // Standard-Typ, wenn kein Code passt
}

// +++ NEU: Funktion zum Aktualisieren der Temperaturanzeige +++
function updateTemperature(temp) {
    $('.temp').html(`${temp}<span>c</span>`);
}

// +++ NEU: Funktion zum Aktualisieren des Datums +++
function updateDate(isoTimeString) {
    try {
        const d = new Date(isoTimeString);
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        // Formatieren für Deutschland, anpassbar für andere Sprachen/Regionen
        const formattedDate = d.toLocaleDateString('de-DE', options);
        date.html(formattedDate);
    } catch (e) {
        console.error("Error formatting date:", e);
        date.html("Date unavailable");
    }
}


function onResize() {
	// 📏 grab window and card sizes
	sizes.container.width = container.width();
	sizes.container.height = container.height();
	sizes.card.width = card.width();
	sizes.card.height = card.height();
	sizes.card.offset = card.offset();

	// 📐 update svg sizes
	innerSVG.attr({
		width: sizes.card.width,
		height: sizes.card.height
	});

	outerSVG.attr({
		width: sizes.container.width,
		height: sizes.container.height
	});

	backSVG.attr({
		width: sizes.container.width,
		height: sizes.container.height
	});

	TweenMax.set(sunburst.node, { transformOrigin: "50% 50%", x: sizes.container.width / 2, y: (sizes.card.height / 2) + sizes.card.offset.top });
	TweenMax.fromTo(sunburst.node, 20, { rotation: 0 }, { rotation: 360, repeat: -1, ease: Power0.easeInOut }); // Power0.easeNone für lineare Rotation

	// 🍃 The leaf mask is for the leafs that float out of the
	// container, it is full window height and starts on the left
	// inline with the card
	leafMask.attr({ x: sizes.card.offset.left, y: 0, width: sizes.container.width - sizes.card.offset.left, height: sizes.container.height });
}

function drawCloud(cloud, i) {
	var space = settings.cloudSpace * i;
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
	points.push('Q' + [-(width * 2), height / 2].join(','));
	points.push([-(width), 0].join(','));

	var path = points.join(' ');
	if (!cloud.path) cloud.path = cloud.group.path();
	cloud.path.animate({
		d: path
	}, 0);
}

function makeRain() {
	var lineWidth = Math.random() * 3;
	var lineLength = (currentWeather && currentWeather.type == 'thunder') ? 35 : 14; // Sicherstellen, dass currentWeather existiert
	var x = Math.random() * (sizes.card.width - 40) + 20;
	var holder = this['innerRainHolder' + (3 - Math.floor(lineWidth))];
    // Prüfen, ob holder definiert ist, bevor .path aufgerufen wird
    if (!holder) {
        console.error("Inner rain holder not found for line width:", lineWidth);
        return; // Abbruch, um Fehler zu vermeiden
    }
    var line = holder.path('M0,0 0,' + lineLength).attr({
		fill: 'none',
		stroke: (currentWeather && currentWeather.type == 'thunder') ? '#777' : '#0000ff', // Sicherstellen, dass currentWeather existiert
		strokeWidth: lineWidth
	});

	rain.push(line);
	TweenMax.fromTo(line.node, 1, { x: x, y: 0 - lineLength }, { delay: Math.random(), y: sizes.card.height, ease: Power2.easeIn, onComplete: onRainEnd, onCompleteParams: [line, lineWidth, x, (currentWeather ? currentWeather.type : defaultWeatherType)] }); // Fallback für Typ
}


function onRainEnd(line, width, x, type) {
	line.remove();
	line = null;

	for (var i in rain) {
		// Verwende 'paper' um zu prüfen, ob das Element noch im DOM ist
        // Sicherer Check: Prüfen ob rain[i] existiert UND .paper hat
		if (rain[i] && !rain[i].paper) rain.splice(i, 1);
	}

	if (rain.length < settings.rainCount) {
		makeRain();
		if (width > 2) makeSplash(x, type);
	}
}

function makeSplash(x, type) {
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
	splash.node.style.strokeDasharray = pathLength + ' ' + pathLength;

	TweenMax.fromTo(splash.node, speed, { strokeWidth: 2, y: yOffset, x: xOffset + x, opacity: 1, strokeDashoffset: splashLength }, { strokeWidth: 0, strokeDashoffset: - pathLength, opacity: 1, onComplete: onSplashComplete, onCompleteParams: [splash], ease: SlowMo.ease.config(0.4, 0.1, false) });
} // Korrektur: x-Offset war vorher um 20 verschoben

function onSplashComplete(splash) {
	splash.remove();
	splash = null;
}

function makeLeaf() {
    // ... (makeLeaf, onLeafEnd, makeSnow, onSnowEnd bleiben unverändert) ...
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

	if(scale > 0.8)
	{
		newLeaf = leaf.clone().appendTo(outerLeafHolder)
		.attr({
			fill: color
		})
		y = y + sizes.card.offset.top / 2;
		endY = endY + sizes.card.offset.top / 2;

		x = sizes.card.offset.left - 100;
		xBezier = x + (sizes.container.width - sizes.card.offset.left) / 2;
		endX = sizes.container.width + 50;
	}
	else
	{
		newLeaf = leaf.clone().appendTo(innerLeafHolder)
		.attr({
			fill: color
		})
		x = -100;
		xBezier = sizes.card.width / 2;
		endX = sizes.card.width + 50;

	}

	leafs.push(newLeaf);


	var bezier = [{x:x, y:y}, {x: xBezier, y:(Math.random() * endY) + (endY / 3)}, {x: endX, y:endY}]
	TweenMax.fromTo(newLeaf.node, 2, {rotation: Math.random()* 180, x: x, y: y, scale:scale}, {rotation: Math.random()* 360, bezier: bezier, onComplete: onLeafEnd, onCompleteParams: [newLeaf], ease: Power0.easeIn})
}

function onLeafEnd(leaf) {
	leaf.remove();
	leaf = null;

	for(var i in leafs) {
		if(leafs[i] && !leafs[i].paper) leafs.splice(i, 1);
	}

	if(leafs.length < settings.leafCount) {
		makeLeaf();
	}
}

function makeSnow() {
	var scale = 0.5 + (Math.random() * 0.5);
	var newSnow;

	var x = 20 + (Math.random() * (sizes.card.width - 40));
	var endX;
	var y = -10;
	var endY;

    // Sicherstellen, dass outerSnowHolder und innerSnowHolder definiert sind
    if (!outerSnowHolder || !innerSnowHolder) {
        console.error("Snow holders are not defined.");
        return;
    }

	if(scale > 0.8) {
        // Prüfen, ob outerSnowHolder existiert, bevor circle aufgerufen wird
        if (outerSnowHolder.circle) {
            newSnow = outerSnowHolder.circle(0, 0, 5)
                .attr({
                    fill: 'white'
                });
            endY = sizes.container.height + 10;
            y = sizes.card.offset.top + settings.cloudHeight;
            x =  x + sizes.card.offset.left;
        } else { return; } // Abbruch wenn nicht vorhanden
	}
	else {
        // Prüfen, ob innerSnowHolder existiert
         if (innerSnowHolder.circle) {
            newSnow = innerSnowHolder.circle(0, 0 ,5)
                .attr({
                    fill: 'white'
                });
            endY = sizes.card.height + 10;
         } else { return; } // Abbruch wenn nicht vorhanden
	}

    // Nur fortfahren, wenn newSnow erfolgreich erstellt wurde
    if (!newSnow) {
        console.error("Failed to create snow flake.");
        return;
    }

	snow.push(newSnow);

	TweenMax.fromTo(newSnow.node, 3 + (Math.random() * 5), {x: x, y: y}, {y: endY, onComplete: onSnowEnd, onCompleteParams: [newSnow], ease: Power0.easeIn});
	TweenMax.fromTo(newSnow.node, 1,{scale: 0}, {scale: scale, ease: Power1.easeInOut});
	TweenMax.to(newSnow.node, 3, {x: x+((Math.random() * 150)-75), repeat: -1, yoyo: true, ease: Power1.easeInOut});
}

function onSnowEnd(flake) {
	flake.remove();
	flake = null;

	for(var i in snow) {
		if(snow[i] && !snow[i].paper) snow.splice(i, 1);
	}

	if(snow.length < settings.snowCount) {
		makeSnow();
	}
}


function tick() {
	tickCount++;
	var check = tickCount % settings.renewCheck;

	if (check === 0) { // Nur bei jedem N-ten Tick prüfen (war vorher !check, was fast immer true ist)
		if (rain.length < settings.rainCount) makeRain();
		if (leafs.length < settings.leafCount) makeLeaf();
		if (snow.length < settings.snowCount) makeSnow();
	}

	for (var i = 0; i < clouds.length; i++) {
        // Sicherstellen, dass currentWeather definiert ist
		if (currentWeather && currentWeather.type == 'sun') {
			// Logik für Sonne (schnellere Bewegung oder Ausblenden?)
            // Aktuell: Langsamere Bewegung als Wind
             if (clouds[i].offset > -(sizes.card.width * 1.5)) clouds[i].offset += settings.windSpeed / (i + 1); // Windspeed ist hier ggf. hoch
			if (clouds[i].offset > sizes.card.width * 2.5) clouds[i].offset = -(sizes.card.width * 1.5);
			clouds[i].group.transform('t' + clouds[i].offset + ',' + 0);

		} else {
            // Standard Wolkenbewegung für andere Wettertypen
			clouds[i].offset += settings.windSpeed / (i + 1);
			if (clouds[i].offset > sizes.card.width) clouds[i].offset = 0 + (clouds[i].offset - sizes.card.width);
			clouds[i].group.transform('t' + clouds[i].offset + ',' + 0);
		}
	}

	requestAnimationFrame(tick);
}

function reset() {
	// Entfernt Klassen vom Container
    container.removeClass('snow wind rain thunder sun'); // Alle möglichen Klassen entfernen

    // Entfernt 'active' von allen Buttons
    if (weather && weather.length > 0) {
        weather.forEach(w => {
            if (w.button && w.button.length) { // Prüfen, ob Button existiert
                w.button.removeClass('active');
            }
        });
    }
}


function updateSummaryText() {
    // Stellt sicher, dass currentWeather und sein Name existieren
	if (currentWeather && currentWeather.name) {
        summary.html(currentWeather.name);
        TweenMax.fromTo(summary, 1.5, { x: 30 }, { opacity: 1, x: 0, ease: Power4.easeOut });
    } else {
        // Setzt einen Standardtext, falls nichts anderes verfügbar ist
        summary.html("Weather"); // Oder leer lassen: summary.html("")
         TweenMax.to(summary, 0.5, { opacity: 1, x: 0 }); // Einfach einblenden
    }
}


function startLightningTimer() {
	if (lightningTimeout) clearTimeout(lightningTimeout);
	if (currentWeather && currentWeather.type == 'thunder') { // Prüfen ob currentWeather existiert
		lightningTimeout = setTimeout(lightning, Math.random() * 6000);
	}
}

function lightning() {
	startLightningTimer();
	TweenMax.fromTo(card, 0.75, { y: -30 }, { y: 0, ease: Elastic.easeOut });

	var pathX = 30 + Math.random() * (sizes.card.width - 60);
	var yOffset = 20;
	var steps = 20;
	var points = [pathX + ',0'];
	for (var i = 0; i < steps; i++) {
		var x = pathX + (Math.random() * yOffset - (yOffset / 2));
		var y = (sizes.card.height / steps) * (i + 1);
		points.push(x + ',' + y);
	}
    // Sicherstellen, dass weatherContainer1 definiert ist
    if (!weatherContainer1) {
        console.error("weatherContainer1 is not defined for lightning.");
        return;
    }
	var strike = weatherContainer1.path('M' + points.join(' '))
		.attr({
			fill: 'none',
			stroke: 'white',
			strokeWidth: 2 + Math.random()
		});

	TweenMax.to(strike.node, 1, { opacity: 0, ease: Power4.easeOut, onComplete: function () { strike.remove(); strike = null; } });
}

// Hauptfunktion zum Ändern des Wetters (wird von API oder Button aufgerufen)
function changeWeather(weatherData) {
    // Prüfen, ob das Event-Objekt übergeben wurde (von Button-Klick)
    // oder direkt das Wetter-Objekt (von API-Call)
    let weatherInfo = weatherData;
    if (weatherData && weatherData.data && weatherData.type === 'click') { // jQuery Event-Objekt
        weatherInfo = weatherData.data;
    }

    // Prüfen, ob weatherInfo gültig ist
    if (!weatherInfo || !weatherInfo.type) {
        console.error("Invalid weather data passed to changeWeather:", weatherData);
        // Fallback zum Default, wenn ungültige Daten übergeben wurden
        weatherInfo = weather.find(w => w.type === defaultWeatherType);
         if (!weatherInfo) return; // Wenn selbst Default nicht geht, abbrechen
    }

	reset(); // Setzt Klassen und Buttons zurück

	currentWeather = weatherInfo; // Setzt das globale aktuelle Wetter

	// Aktualisiere Summary nur, wenn es noch nicht "Loading..." oder ein Fehler ist
    // Die API-Funktion setzt den initialen Text, dieser Aufruf aktualisiert bei Button-Klick
    if (summary.html() !== "Loading..." && summary.html() !== "Error loading weather") {
        TweenMax.to(summary, 0.5, { // Kürzere Animation für Klicks
            opacity: 0, x: -30, onComplete: updateSummaryText, ease: Power4.easeIn
        });
    } else {
        updateSummaryText(); // Direkter Aufruf, falls noch geladen wird/Fehler war
    }


	container.addClass(weatherInfo.type);
    // Aktiviere den zugehörigen Button, falls vorhanden
    if (weatherInfo.button && weatherInfo.button.length) {
	    weatherInfo.button.addClass('active');
    } else {
        // Wenn der Button nicht im Objekt ist (z.B. bei API-Aufruf), finde ihn
        const btn = $(`#button-${weatherInfo.type}`);
        if (btn.length) {
            btn.addClass('active');
             // Optional: Füge den Button zum weatherInfo Objekt hinzu für spätere Referenz
             weatherInfo.button = btn;
        }
    }


	// --- Animationen basierend auf dem Typ anpassen ---

	// windSpeed
	let targetWindSpeed = 0.5; // Default
	switch (weatherInfo.type) {
		case 'wind':
			targetWindSpeed = 3;
			break;
		case 'sun':
			targetWindSpeed = 0.2; // Sonne sollte wenig Wind haben, Wolken ziehen langsam
			break;
		case 'thunder':
            targetWindSpeed = 1.0; // Etwas mehr Wind bei Sturm
            break;
        // rain, snow behalten Default 0.5
	}
	TweenMax.to(settings, 3, { windSpeed: targetWindSpeed, ease: Power2.easeInOut });

	// rainCount
	let targetRainCount = 0;
	if (weatherInfo.type === 'rain') targetRainCount = 10;
	if (weatherInfo.type === 'thunder') targetRainCount = 60;
	TweenMax.to(settings, 3, { rainCount: targetRainCount, ease: Power2.easeInOut });

	// leafCount (nur bei 'wind')
	let targetLeafCount = (weatherInfo.type === 'wind') ? 5 : 0;
	TweenMax.to(settings, 3, { leafCount: targetLeafCount, ease: Power2.easeInOut });

	// snowCount (nur bei 'snow')
	let targetSnowCount = (weatherInfo.type === 'snow') ? 40 : 0;
	TweenMax.to(settings, 3, { snowCount: targetSnowCount, ease: Power2.easeInOut });

	// sun position
	let targetSunX = sizes.card.width / 2;
    let targetSunY = -100; // Standard: Sonne ausserhalb
    let targetSunburstScale = 0.4;
    let targetSunburstOpacity = 0;
    let targetSunburstY = (sizes.container.height / 2) - 50;

	if (weatherInfo.type === 'sun') {
		targetSunY = sizes.card.height / 3; // Sonne sichtbar positionieren
        targetSunburstScale = 1;
        targetSunburstOpacity = 0.8;
        targetSunburstY = (sizes.card.height / 2) + (sizes.card.offset.top); // Position relativ zur Karte
	}
    // Animiere die Sonne nur, wenn sie existiert
    if (sun && sun.node) {
	    TweenMax.to(sun.node, 4, { x: targetSunX, y: targetSunY, ease: Power2.easeInOut });
    }
    // Animiere den Sunburst nur, wenn er existiert
    if (sunburst && sunburst.node) {
	    TweenMax.to(sunburst.node, 4, { scale: targetSunburstScale, opacity: targetSunburstOpacity, y: targetSunburstY, ease: Power2.easeInOut });
    }

	// lightning Timer starten/stoppen
	startLightningTimer(); // Startet Timer nur, wenn Typ 'thunder' ist
}