// 📝 Fetch all DOM nodes in jQuery and Snap SVG
var container = $('.container');
var card = $('#card'); // Das ist das Element, das die Klasse bekommen soll
var innerSVG = Snap('#inner');
var outerSVG = Snap('#outer');
var backSVG = Snap('#back');
var summary = $('#summary');
var date = $('#date');
var temp = $('.temp');
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
var weather = [
	{ type: 'snow', name: 'Schnee'},
	{ type: 'wind', name: 'Windig'},
	{ type: 'rain', name: 'Regen'},
	{ type: 'thunder', name: 'Gewitter'},
	{ type: 'sun', name: 'Sonnig'}
];
var currentWeather = null;

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

// --- Open-Meteo API Integration ---
const DORTMUND_LAT = 51.51;
const DORTMUND_LON = 7.46;
const API_URL = `https://api.open-meteo.com/v1/forecast?latitude=${DORTMUND_LAT}&longitude=${DORTMUND_LON}¤t_weather=true&temperature_unit=celsius&windspeed_unit=kmh&timezone=Europe/Berlin`;

function fetchWeatherData() {
    console.log("Fetching weather data from Open-Meteo...");
    summary.text("Lade Wetter...");
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

                temp.html(currentTemp + '<span>°c</span>');
                date.text(formatDateFromAPI(apiTime));

                const weatherTypeString = mapWeatherCodeToType(weatherCode);
                const targetWeather = weather.find(w => w.type === weatherTypeString);

                if (targetWeather) {
                    changeWeather(targetWeather);
                } else {
                    console.warn(`Kein passendes Wetter-Objekt für Typ "${weatherTypeString}" gefunden.`);
                    changeWeather(weather.find(w => w.type === 'sun')); // Fallback
                }

            } else {
                console.error("Ungültige Daten von API erhalten.");
                summary.text("Fehler");
                // Evtl. Standard-Wetter anzeigen
                 changeWeather(weather.find(w => w.type === 'sun'));
            }
        },
        error: function(jqXHR, textStatus, errorThrown) {
            console.error("Fehler beim Abrufen der Wetterdaten:", textStatus, errorThrown);
            summary.text("API Fehler");
            temp.html("--<span>°c</span>");
            date.text("Konnte nicht laden");
             // Evtl. Standard-Wetter anzeigen bei Fehler
             changeWeather(weather.find(w => w.type === 'sun'));
        }
    });
}

function formatDateFromAPI(isoString) {
    const dateObj = new Date(isoString);
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    return dateObj.toLocaleDateString('de-DE', options);
}

function mapWeatherCodeToType(code) {
    // Basierend auf WMO Weather interpretation codes von Open-Meteo Doku
    if ([0, 1].includes(code)) return 'sun';
    if ([2, 3].includes(code)) return 'sun'; // Teilweise bewölkt / Bedeckt -> visuell eher 'sun' als 'wind'
    if ([45, 48].includes(code)) return 'wind'; // Nebel -> 'wind' als Platzhalter Animation
    if ([51, 53, 55, 56, 57].includes(code)) return 'rain'; // Nieselregen
    if ([61, 63, 65, 66, 67].includes(code)) return 'rain'; // Regen / Gefrierender Regen
    if ([80, 81, 82].includes(code)) return 'rain'; // Regenschauer
    if ([71, 73, 75, 77].includes(code)) return 'snow'; // Schneefall / Schneekörner
    if ([85, 86].includes(code)) return 'snow'; // Schneeschauer
    if ([95, 96, 99].includes(code)) return 'thunder'; // Gewitter

    console.warn(`Unbekannter Wettercode: ${code}, fallback zu 'sun'`);
    return 'sun';
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
		b.bind('click', w, changeWeather);
	}

	// ☁️ draw clouds
	for(var i = 0; i < clouds.length; i++)
	{
		clouds[i].offset = Math.random() * sizes.card.width;
		drawCloud(clouds[i], i);
	}

    // ☀️ Wetterdaten beim Start laden
    fetchWeatherData();

	TweenMax.set(sunburst.node, {opacity: 0});
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
	});

	outerSVG.attr({
		width: sizes.container.width,
		height: sizes.container.height
	});

	backSVG.attr({
		width: sizes.container.width,
		height: sizes.container.height
	});

	TweenMax.set(sunburst.node, {transformOrigin:"50% 50%", x: sizes.container.width / 2, y: (sizes.card.height/2) + sizes.card.offset.top});
	TweenMax.fromTo(sunburst.node, 20, {rotation: 0}, {rotation: 360, repeat: -1, ease: Power0.easeInOut});

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
    if (line && line.node) { // Prüfen ob line noch existiert
	    line.remove();
    }
	line = null; // Referenz entfernen
	rain = rain.filter(item => item !== null); // Array aufräumen (sicherer als splice in loop)

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
}

function onSplashComplete(splash)
{
    if (splash && splash.node) { // Prüfen ob splash noch existiert
	    splash.remove();
    }
	splash = null; // Referenz entfernen
}

function makeLeaf()
{
    if (!currentWeather || currentWeather.type !== 'wind') return;

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
    if (leaf && leaf.node) { // Prüfen ob leaf noch existiert
	    leaf.remove();
    }
	leaf = null; // Referenz entfernen
	leafs = leafs.filter(item => item !== null); // Array aufräumen

	if(leafs.length < settings.leafCount) {
		makeLeaf();
	}
}

function makeSnow()
{
    if (!currentWeather || currentWeather.type !== 'snow') return;

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
    if (flake && flake.node) { // Prüfen ob flake noch existiert
	    flake.remove();
    }
	flake = null; // Referenz entfernen
	snow = snow.filter(item => item !== null); // Array aufräumen

	if(snow.length < settings.snowCount) {
		makeSnow();
	}
}

function tick()
{
	tickCount++;
	var check = tickCount % settings.renewCheck;

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
        let cloudSpeed = settings.windSpeed; // Start mit dem aktuellen Setting
        if (currentWeather) { // Nur anpassen, wenn Wetterdaten da sind
            if (currentWeather.type !== 'sun' && currentWeather.type !== 'wind') {
               cloudSpeed = 0.5; // Langsamer Standardwert für Regen, Schnee, Gewitter
            } else if (currentWeather.type === 'sun') {
                cloudSpeed = 1; // Leichte Brise bei Sonne
            }
            // Bei 'wind' wird der Wert aus settings.windSpeed (via TweenMax gesetzt) verwendet
        } else {
            cloudSpeed = 0.5; // Langsam, wenn noch kein Wetter geladen
        }


        clouds[i].offset += cloudSpeed / (i + 1);

        // Loop-Logik - Wolken zurücksetzen
        // Annahme: Die SVG-Form ist ca. 4x Kartenbreite, 2x links, 2x rechts
        const cloudResetOffset = sizes.card.width * 2; // Punkt, an dem zurückgesetzt wird
        if (clouds[i].offset > cloudResetOffset) {
             // Wenn Wolke rechts raus ist, links wieder rein (-cloudResetOffset)
             // plus den Betrag, den sie über cloudResetOffset hinausging
             clouds[i].offset = -cloudResetOffset + (clouds[i].offset - cloudResetOffset);
        } else if (clouds[i].offset < -cloudResetOffset * 2) { // Sicherstellen, dass sie weit genug links ist
             // Wenn Wolke links raus ist, rechts wieder rein (cloudResetOffset)
             clouds[i].offset = cloudResetOffset + (clouds[i].offset + cloudResetOffset * 2);
        }

		clouds[i].group.transform('t' + clouds[i].offset + ',' + 0);
	}

	requestAnimationFrame(tick);
}

function reset()
{
    // Entfernt alle Wetter-Typ-Klassen von der #card
	for(var i = 0; i < weather.length; i++) {
		card.removeClass(weather[i].type); // *** KORREKTUR: Klasse von card entfernen ***
		if (weather[i].button) {
		    weather[i].button.removeClass('active');
        }
	}
    // WICHTIG: Die Basisklasse 'weather' wird NICHT entfernt, da sie nicht im 'weather'-Array ist.
}

function updateSummaryText()
{
    if (currentWeather) {
	    summary.html(currentWeather.name);
	    TweenMax.fromTo(summary, 1.5, {opacity: 0, x: 30}, {opacity: 1, x: 0, ease: Power4.easeOut}); // Start von rechts
    } else {
        summary.html("...");
    }
}

function startLightningTimer()
{
	if(lightningTimeout) clearTimeout(lightningTimeout);
	if(currentWeather && currentWeather.type == 'thunder') {
		lightningTimeout = setTimeout(lightning, Math.random()*6000 + 1000);
	}
}

function lightning()
{
    if (!currentWeather || currentWeather.type !== 'thunder') return;

	startLightningTimer();
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

	var strike = innerLightningHolder.path('M' + points.join(' '))
	    .attr({
    		fill: 'none',
	    	stroke: 'white',
		    strokeWidth: 2 + Math.random()
	    });

	TweenMax.to(strike.node, 1, {opacity: 0, ease:Power4.easeOut, onComplete: function(){
        if (strike && strike.node) strike.remove();
        strike = null;
    }});
}

// Nimmt das ganze Wetter-Objekt entgegen
function changeWeather(weatherData)
{
    if (weatherData && weatherData.data) { // Von Button-Klick
        weatherData = weatherData.data;
    }

    if (!weatherData || typeof weatherData !== 'object' || !weatherData.type) {
        console.error("changeWeather wurde mit ungültigen Daten aufgerufen:", weatherData);
        fetchWeatherData(); // Erneut versuchen, API-Daten zu laden als Fallback
        return;
    }

	console.log("Changing weather to:", weatherData.type);
	reset(); // Alte Klassen (von card) und aktive Zustände entfernen

	currentWeather = weatherData;

    // Summary Text mit Animation aktualisieren
	TweenMax.to(summary, 0.5, {opacity: 0, x: -30, onComplete: updateSummaryText, ease: Power4.easeIn});

	card.addClass(weatherData.type); // *** KORREKTUR: Klasse zu card hinzufügen ***
    if (weatherData.button) {
	    weatherData.button.addClass('active');
    }

	// Einstellungen anpassen
	let targetWindSpeed = 0.5;
    let targetRainCount = 0;
    let targetLeafCount = 0;
    let targetSnowCount = 0;

	switch(weatherData.type)
	{
		case 'wind':
			targetWindSpeed = 3;
            targetLeafCount = 5;
			break;
		case 'sun':
			targetWindSpeed = 1;
			break;
		case 'rain':
            targetWindSpeed = 0.5; // Wenig Wind bei Regen
			targetRainCount = 10;
			break;
		case 'thunder':
            targetWindSpeed = 1; // Etwas Wind
			targetRainCount = 60;
			break;
        case 'snow':
            targetWindSpeed = 0.2; // Sehr wenig Wind bei Schnee
            targetSnowCount = 40;
            break;
	}

    TweenMax.to(settings, 3, { windSpeed: targetWindSpeed, ease: Power2.easeInOut });
    TweenMax.to(settings, 3, { rainCount: targetRainCount, ease: Power2.easeInOut });
    TweenMax.to(settings, 3, { leafCount: targetLeafCount, ease: Power2.easeInOut });
    TweenMax.to(settings, 3, { snowCount: targetSnowCount, ease: Power2.easeInOut });


	// Sonnenposition und Strahlen
    const sunYPosition = sizes.card.height * 0.25; // Einheitliche Y-Position für Sonne
	if (weatherData.type == 'sun') {
		TweenMax.to(sun.node, 4, {x: sizes.card.width / 2, y: sunYPosition, ease: Power2.easeInOut});
		TweenMax.to(sunburst.node, 4, {scale: 1, opacity: 0.8, y: sunYPosition + sizes.card.offset.top, ease: Power2.easeInOut});
	} else {
		TweenMax.to(sun.node, 2, {x: sizes.card.width / 2, y: -100, ease: Power2.easeInOut}); // Sonne rausfahren
		TweenMax.to(sunburst.node, 2, {scale: 0.4, opacity: 0, y: (sizes.container.height/2)-50, ease: Power2.easeInOut}); // Strahlen ausblenden
	}

	startLightningTimer(); // Blitz-Timer (neu) starten oder stoppen
}