// 📝 Fetch all DOM nodes in jQuery and Snap SVG
var container = $('.container');
var card = $('#card');
var innerSVG = Snap('#inner');
var outerSVG = Snap('#outer');
var backSVG = Snap('#back');
var summary = $('#summary');
var date = $('#date');
var temp = $('.temp'); // Selektor für Temperatur hinzugefügt
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
	container: {width: 0, height: 0},
	card: {width: 0, height: 0}
}

// grab cloud groups
var clouds = [
	{group: Snap.select('#cloud1')},
	{group: Snap.select('#cloud2')},
	{group: Snap.select('#cloud3')}
];

// set weather types ☁️ 🌬 🌧 ⛈ ☀️
// WICHTIG: Diese Objekte werden jetzt auch verwendet, um den API-Zustand zuzuordnen
var weather = [
	{ type: 'snow', name: 'Schnee'}, // Name angepasst
	{ type: 'wind', name: 'Windig'},
	{ type: 'rain', name: 'Regen'}, // Name angepasst
	{ type: 'thunder', name: 'Gewitter'}, // Name angepasst
	{ type: 'sun', name: 'Sonnig'} // Name angepasst
];
var currentWeather = null; // Wird durch API-Aufruf oder Klick gesetzt

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

// --- NEU: Open-Meteo API Integration ---
const DORTMUND_LAT = 51.51;
const DORTMUND_LON = 7.46;
const API_URL = `https://api.open-meteo.com/v1/forecast?latitude=${DORTMUND_LAT}&longitude=${DORTMUND_LON}¤t_weather=true&temperature_unit=celsius&windspeed_unit=kmh&timezone=Europe/Berlin`;

// Funktion zum Abrufen und Anzeigen der Wetterdaten
function fetchWeatherData() {
    console.log("Fetching weather data from Open-Meteo...");
    summary.text("Lade Wetter..."); // Visuelles Feedback
    date.text("");
    temp.html("--<span>°c</span>");

    $.ajax({
        url: API_URL,
        method: 'GET',
        success: function(data) {
            console.log("API Data received:", data);
            if (data && data.current_weather) {
                const cw = data.current_weather;
                const currentTemp = Math.round(cw.temperature);
                const weatherCode = cw.weathercode;
                const apiTime = cw.time;

                // Temperatur aktualisieren
                temp.html(currentTemp + '<span>°c</span>');

                // Datum formatieren und aktualisieren
                date.text(formatDateFromAPI(apiTime));

                // Wettertyp basierend auf Code ermitteln
                const weatherTypeString = mapWeatherCodeToType(weatherCode);

                // Das passende Wetter-Objekt aus unserem `weather`-Array finden
                const targetWeather = weather.find(w => w.type === weatherTypeString);

                if (targetWeather) {
                    // `changeWeather` aufrufen, um die UI/Animationen zu aktualisieren
                    changeWeather(targetWeather); // Übergibt das Objekt, nicht nur den String
                } else {
                    console.warn(`Kein passendes Wetter-Objekt für Typ "${weatherTypeString}" gefunden.`);
                    // Fallback auf sonnig, falls Mapping fehlschlägt
                    changeWeather(weather.find(w => w.type === 'sun'));
                }

            } else {
                console.error("Ungültige Daten von API erhalten.");
                summary.text("Fehler");
            }
        },
        error: function(jqXHR, textStatus, errorThrown) {
            console.error("Fehler beim Abrufen der Wetterdaten:", textStatus, errorThrown);
            summary.text("API Fehler");
            temp.html("--<span>°c</span>");
            date.text("Konnte nicht laden");
             // Optional: Standard-Wetter anzeigen bei Fehler?
            // changeWeather(weather.find(w => w.type === 'sun'));
        }
    });
}

// Funktion zum Formatieren des Datums (ISO-String zu "Wochentag DD Monat")
function formatDateFromAPI(isoString) {
    const dateObj = new Date(isoString);
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    // Sicherstellen, dass die locale auf Deutsch gesetzt ist für deutsche Namen
    return dateObj.toLocaleDateString('de-DE', options);
}


// Funktion zum Mappen von Open-Meteo WMO Codes zu unseren Typen
function mapWeatherCodeToType(code) {
    // Basierend auf WMO Weather interpretation codes von Open-Meteo Doku
    if ([0, 1].includes(code)) return 'sun'; // Klar, Hauptsächlich klar
    if ([2, 3].includes(code)) return 'sun'; // Teilweise bewölkt, Bedeckt (visuell eher sonnig/wolkig als Regen etc.)
    if ([45, 48].includes(code)) return 'wind'; // Nebel (Wind ist hier ein Platzhalter, da wir keine Nebel-Animation haben)
    if ([51, 53, 55, 56, 57].includes(code)) return 'rain'; // Nieselregen
    if ([61, 63, 65, 66, 67].includes(code)) return 'rain'; // Regen / Gefrierender Regen
    if ([80, 81, 82].includes(code)) return 'rain'; // Regenschauer
    if ([71, 73, 75, 77].includes(code)) return 'snow'; // Schneefall / Schneekörner
    if ([85, 86].includes(code)) return 'snow'; // Schneeschauer
    if ([95, 96, 99].includes(code)) return 'thunder'; // Gewitter

    console.warn(`Unbekannter Wettercode: ${code}, fallback zu 'sun'`);
    return 'sun'; // Fallback für unbekannte Codes
}

// --- Ende API Integration ---


// ⚙ initialize app
init();

// 👁 watch for window resize
$(window).resize(onResize);

// 🏃 start animations
requestAnimationFrame(tick);

function init()
{
	onResize();

	// 🖱 bind weather menu buttons
	for(var i = 0; i < weather.length; i++)
	{
		var w = weather[i];
		var b = $('#button-' + w.type);
		w.button = b;
        // WICHTIG: Wir übergeben das gesamte Objekt an changeWeather
		b.bind('click', w, changeWeather);
	}

	// ☁️ draw clouds
	for(var i = 0; i < clouds.length; i++)
	{
		clouds[i].offset = Math.random() * sizes.card.width;
		drawCloud(clouds[i], i);
	}

    // ☀️ Wetterdaten beim Start laden statt festes Wetter zu setzen
    fetchWeatherData();

	// Sonnenstrahlen initial ausblenden (wird bei Bedarf von changeWeather eingeblendet)
	TweenMax.set(sunburst.node, {opacity: 0})

}

function onResize()
{
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
	})

	outerSVG.attr({
		width: sizes.container.width,
		height: sizes.container.height
	})

	backSVG.attr({
		width: sizes.container.width,
		height: sizes.container.height
	})

	TweenMax.set(sunburst.node, {transformOrigin:"50% 50%", x: sizes.container.width / 2, y: (sizes.card.height/2) + sizes.card.offset.top});
	TweenMax.fromTo(sunburst.node, 20, {rotation: 0}, {rotation: 360, repeat: -1, ease: Power0.easeInOut})
	// 🍃 The leaf mask is for the leafs that float out of the
	// container, it is full window height and starts on the left
	// inline with the card
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
	points.push('Q' + [-(width * 2), height/2].join(','));
	points.push([-(width), 0].join(','));

	var path = points.join(' ');
	if(!cloud.path) cloud.path = cloud.group.path();
	cloud.path.animate({
  		d: path
	}, 0)
}

function makeRain()
{
    // Nur Regen machen, wenn der aktuelle Zustand Regen oder Gewitter ist
    if (!currentWeather || (currentWeather.type !== 'rain' && currentWeather.type !== 'thunder')) return;

	var lineWidth = Math.random() * 3;
	var lineLength = currentWeather.type == 'thunder' ? 35 : 14;
	var x = Math.random() * (sizes.card.width - 40) + 20;
	var line = this['innerRainHolder' + (3 - Math.floor(lineWidth))].path('M0,0 0,' + lineLength).attr({
		fill: 'none',
		stroke: currentWeather.type == 'thunder' ? '#777' : '#0000ff',
		strokeWidth: lineWidth
	});

	rain.push(line);
	TweenMax.fromTo(line.node, 1, {x: x, y: 0- lineLength}, {delay: Math.random(), y: sizes.card.height, ease: Power2.easeIn, onComplete: onRainEnd, onCompleteParams: [line, lineWidth, x, currentWeather.type]});
}

function onRainEnd(line, width, x, type)
{
	line.remove();
	line = null;
	for(var i in rain) {
		// Prüfen ob das Element noch existiert bevor splice aufgerufen wird
        if(rain[i] && !rain[i].paper) rain.splice(i, 1);
	}
	if(rain.length < settings.rainCount) {
		makeRain();
		if(width > 2) makeSplash(x, type);
	}
}

function makeSplash(x, type)
{
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

	TweenMax.fromTo(splash.node, speed, {strokeWidth: 2, y: yOffset, x: xOffset + x, opacity: 1, strokeDashoffset: splashLength}, {strokeWidth: 0, strokeDashoffset: - pathLength, opacity: 1, onComplete: onSplashComplete, onCompleteParams: [splash], ease:  SlowMo.ease.config(0.4, 0.1, false)});
                                                                                                                                    // Fehlerkorrektur: x statt 20 + x
}

function onSplashComplete(splash)
{
	splash.remove();
	splash = null;
}

function makeLeaf()
{
    if (!currentWeather || currentWeather.type !== 'wind') return; // Nur bei Wind

	var scale = 0.5 + (Math.random() * 0.5);
	var newLeaf;
	var areaY = sizes.card.height/2;
	var y = areaY + (Math.random() * areaY);
	var endY = y - ((Math.random() * (areaY * 2)) - areaY);
	var x, endX, xBezier;
	var colors = ['#76993E', '#4A5E23', '#6D632F'];
	var color = colors[Math.floor(Math.random() * colors.length)];

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
	var bezier = [{x:x, y:y}, {x: xBezier, y:(Math.random() * endY) + (endY / 3)}, {x: endX, y:endY}]
	TweenMax.fromTo(newLeaf.node, 2, {rotation: Math.random()* 180, x: x, y: y, scale:scale}, {rotation: Math.random()* 360, bezier: bezier, onComplete: onLeafEnd, onCompleteParams: [newLeaf], ease: Power0.easeIn})
}

function onLeafEnd(leaf)
{
	leaf.remove();
	leaf = null;
	for(var i in leafs) {
		if(leafs[i] && !leafs[i].paper) leafs.splice(i, 1);
	}
	if(leafs.length < settings.leafCount) {
		makeLeaf();
	}
}

function makeSnow()
{
    if (!currentWeather || currentWeather.type !== 'snow') return; // Nur bei Schnee

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
	TweenMax.fromTo(newSnow.node, 3 + (Math.random() * 5), {x: x, y: y}, {y: endY, onComplete: onSnowEnd, onCompleteParams: [newSnow], ease: Power0.easeIn});
	TweenMax.fromTo(newSnow.node, 1,{scale: 0}, {scale: scale, ease: Power1.easeInOut});
	TweenMax.to(newSnow.node, 3, {x: x+((Math.random() * 150)-75), repeat: -1, yoyo: true, ease: Power1.easeInOut});
}

function onSnowEnd(flake)
{
	flake.remove();
	flake = null;
	for(var i in snow) {
		if(snow[i] && !snow[i].paper) snow.splice(i, 1);
	}
	if(snow.length < settings.snowCount) {
		makeSnow();
	}
}

function tick()
{
	tickCount++;
	var check = tickCount % settings.renewCheck;

    // Nur Partikel erzeugen, wenn der entsprechende Wettertyp aktiv ist
	if(check && currentWeather) {
		if(currentWeather.type === 'rain' || currentWeather.type === 'thunder') {
            if(rain.length < settings.rainCount) makeRain();
        }
		if(currentWeather.type === 'wind') {
            if(leafs.length < settings.leafCount) makeLeaf();
        }
        if(currentWeather.type === 'snow') {
		    if(snow.length < settings.snowCount) makeSnow();
        }
	}

	// Wolken bewegen
	for(var i = 0; i < clouds.length; i++) {
        let cloudSpeed = settings.windSpeed;
        // Langsamere Wolkenbewegung wenn nicht sonnig oder windig
        if(currentWeather && currentWeather.type !== 'sun' && currentWeather.type !== 'wind') {
           cloudSpeed = 0.5; // Langsamer Standardwert
        } else if (currentWeather && currentWeather.type === 'sun') {
            cloudSpeed = 5; // Etwas schneller bei Sonne
        } else if (currentWeather && currentWeather.type === 'wind') {
             cloudSpeed = settings.windSpeed; // Verwende windSpeed Setting bei Wind
        }


        // Bewegung anpassen basierend auf Geschwindigkeit
        clouds[i].offset += cloudSpeed / (i + 1);

        // Loop-Logik - Wolken zurücksetzen, wenn sie aus dem Bild sind
        const cloudWidth = sizes.card.width * 4; // Grobe Schätzung der Gesamtbreite der Wolke
        if (cloudSpeed > 0 && clouds[i].offset > sizes.card.width) {
             clouds[i].offset = -cloudWidth + (clouds[i].offset - sizes.card.width); // Korrekter Reset für positive Geschwindigkeit
        } else if (cloudSpeed < 0 && clouds[i].offset < -cloudWidth) {
            clouds[i].offset = sizes.card.width + (clouds[i].offset + cloudWidth); // Reset für negative Geschwindigkeit (falls implementiert)
        }

		clouds[i].group.transform('t' + clouds[i].offset + ',' + 0);
	}

	requestAnimationFrame(tick);
}

function reset()
{
	for(var i = 0; i < weather.length; i++) {
		container.removeClass(weather[i].type);
		if (weather[i].button) { // Sicherstellen, dass button existiert
		    weather[i].button.removeClass('active');
        }
	}
}

function updateSummaryText()
{
    // Nur updaten wenn currentWeather gesetzt ist
    if (currentWeather) {
	    summary.html(currentWeather.name);
	    TweenMax.fromTo(summary, 1.5, {x: 30}, {opacity: 1, x: 0, ease: Power4.easeOut});
    } else {
        summary.html("..."); // Platzhalter wenn noch keine Daten
    }
}

function startLightningTimer()
{
	if(lightningTimeout) clearTimeout(lightningTimeout);
	if(currentWeather && currentWeather.type == 'thunder') { // Prüfen ob currentWeather existiert
		lightningTimeout = setTimeout(lightning, Math.random()*6000 + 1000); // Mindestens 1 Sekunde warten
	}
}

function lightning()
{
    if (!currentWeather || currentWeather.type !== 'thunder') return; // Nur bei Gewitter ausführen

	startLightningTimer(); // Neuen Timer starten
	TweenMax.fromTo(card, 0.75, {y: -30}, {y:0, ease:Elastic.easeOut});

	var pathX = 30 + Math.random() * (sizes.card.width - 60);
	var yOffset = 20;
	var steps = 20;
	var points = [pathX + ',0'];
	for(var i = 0; i < steps; i++) {
		var x = pathX + (Math.random() * yOffset - (yOffset / 2));
		var y = (sizes.card.height / steps) * (i + 1);
		points.push(x + ',' + y);
	}

    // Blitz im korrekten Container erstellen
	var strike = innerLightningHolder.path('M' + points.join(' '))
	    .attr({
    		fill: 'none',
	    	stroke: 'white',
		    strokeWidth: 2 + Math.random()
	    });

	TweenMax.to(strike.node, 1, {opacity: 0, ease:Power4.easeOut, onComplete: function(){ strike.remove(); strike = null}});
}

// Nimmt jetzt das ganze Wetter-Objekt entgegen
function changeWeather(weatherData)
{
    // Wenn das Event-Objekt übergeben wird (von Button-Klick), das data-Property holen
    if (weatherData && weatherData.data) {
        weatherData = weatherData.data;
    }

    // Sicherstellen, dass wir ein gültiges Objekt haben
    if (!weatherData || typeof weatherData !== 'object' || !weatherData.type) {
        console.error("changeWeather wurde mit ungültigen Daten aufgerufen:", weatherData);
        // Optional: Fallback auf API-Daten oder Standard
        fetchWeatherData(); // Erneut versuchen, API-Daten zu laden
        return;
    }

	console.log("Changing weather to:", weatherData.type);
	reset(); // Alte Klassen und aktive Zustände entfernen

	currentWeather = weatherData; // Globalen Zustand setzen

	// Summary sofort aktualisieren oder nach Animation
    TweenMax.to(summary, 0.5, {opacity: 0, x: -30, onComplete: updateSummaryText, ease: Power4.easeIn});

	container.addClass(weatherData.type);
    if (weatherData.button) { // Sicherstellen, dass button existiert
	    weatherData.button.addClass('active');
    }

	// Einstellungen anpassen (windSpeed, rainCount etc.) basierend auf dem Typ
	let targetWindSpeed = 0.5; // Standard langsam
    let targetRainCount = 0;
    let targetLeafCount = 0;
    let targetSnowCount = 0;

	switch(weatherData.type)
	{
		case 'wind':
			targetWindSpeed = 3; // Mäßiger Wind
            targetLeafCount = 5;
			break;
		case 'sun':
			targetWindSpeed = 1; // Leichte Brise bei Sonne
			break;
		case 'rain':
			targetRainCount = 10;
			break;
		case 'thunder':
            targetWindSpeed = 1; // Etwas Wind bei Gewitter
			targetRainCount = 60;
			break;
        case 'snow':
            targetSnowCount = 40;
            break;
	}

    // Animiere die Einstellungen auf die neuen Zielwerte
    TweenMax.to(settings, 3, { windSpeed: targetWindSpeed, ease: Power2.easeInOut });
    TweenMax.to(settings, 3, { rainCount: targetRainCount, ease: Power2.easeInOut });
    TweenMax.to(settings, 3, { leafCount: targetLeafCount, ease: Power2.easeInOut });
    TweenMax.to(settings, 3, { snowCount: targetSnowCount, ease: Power2.easeInOut });


	// Sonnenposition und Strahlen anpassen
	if (weatherData.type == 'sun') {
		TweenMax.to(sun.node, 4, {x: sizes.card.width / 2, y: sizes.card.height * 0.25, /* Höher positionieren */ ease: Power2.easeInOut});
		TweenMax.to(sunburst.node, 4, {scale: 1, opacity: 0.8, y: (sizes.card.height * 0.25) + sizes.card.offset.top /* An Sonnen-Y anpassen */, ease: Power2.easeInOut});
	} else {
		TweenMax.to(sun.node, 2, {x: sizes.card.width / 2, y: -100, ease: Power2.easeInOut});
		TweenMax.to(sunburst.node, 2, {scale: 0.4, opacity: 0, y: (sizes.container.height/2)-50, ease: Power2.easeInOut});
	}

	// Blitz-Timer (neu) starten oder stoppen
	startLightningTimer();
}