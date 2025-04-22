// 📝 Fetch all DOM nodes in jQuery and Snap SVG
var container = $('.container');
var card = $('#card');
var innerSVG = Snap('#inner');
var outerSVG = Snap('#outer');
var backSVG = Snap('#back');
var summary = $('#summary');
var date = $('#date');
var temp = $('.temp'); // Temperatur-Element hinzugefügt
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
]

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

// --- Open-Meteo Integration ---
const DORTMUND_LAT = 51.51;
const DORTMUND_LON = 7.46;
// KORRIGIERTE API URL: Fügt 'hourly=temperature_2m' hinzu, um 400er zu vermeiden
const API_URL = `https://api.open-meteo.com/v1/forecast?latitude=${DORTMUND_LAT}&longitude=${DORTMUND_LON}¤t_weather=true&temperature_unit=celsius&hourly=temperature_2m`;

// Funktion zum Abrufen und Verarbeiten der Wetterdaten
function fetchWeatherData() {
    console.log("Requesting API URL:", API_URL); // Log zur Überprüfung der URL
    $.get(API_URL)
        .done(function(data) {
            console.log("Open-Meteo Data:", data);

            if (data && data.current_weather) {
                const current = data.current_weather;
                const tempValue = Math.round(current.temperature); // API liefert 'temperature'
                const weatherCode = current.weathercode;

                temp.html(tempValue + '<span>c</span>');
                updateDate();

                const weatherType = getWeatherTypeFromCode(weatherCode);
                const targetWeather = weather.find(w => w.type === weatherType);

                if (targetWeather) {
                    changeWeather(targetWeather);
                } else {
                    console.warn("Unbekannter Wettercode:", weatherCode);
                    changeWeather(weather.find(w => w.type === 'sun'));
                }

            } else {
                handleApiError("Ungültige API-Antwortstruktur - 'current_weather' fehlt.");
            }
        })
        .fail(function(jqXHR, textStatus, errorThrown) {
            // Logge mehr Details zum Fehler
            console.error("API Request Failed:");
            console.error("Status:", jqXHR.status, textStatus);
            console.error("Error:", errorThrown);
            console.error("Response Text:", jqXHR.responseText); // Wichtig für Debugging von 400ern!
            handleApiError(`${jqXHR.status} ${textStatus}: ${errorThrown}`);
        });
}

// Funktion zur Behandlung von API-Fehlern
function handleApiError(errorMsg) {
    console.error("Fehler beim Abrufen der Wetterdaten:", errorMsg);
    temp.html("--<span>c</span>");
    summary.text("Fehler");
    date.text("Keine Daten");
    // Optional: Standard-Wetter anzeigen
    // changeWeather(weather.find(w => w.type === 'sun'));
}

// Funktion zum Übersetzen des WMO Weather Codes in Widget-Typen
function getWeatherTypeFromCode(code) {
    // Quelle: https://open-meteo.com/en/docs#weathervariables -> WMO Weather interpretation codes
    if ([0, 1].includes(code)) return 'sun';        // Clear sky, Mainly clear
    if ([2, 3].includes(code)) return 'sun';        // Partly cloudy, Overcast -> Widget hat kein 'cloudy', nehmen 'sun'
    if ([45, 48].includes(code)) return 'wind';     // Fog and depositing rime fog -> Widget hat kein 'fog', nehmen 'wind'
    if ([51, 53, 55, 56, 57].includes(code)) return 'rain'; // Drizzle
    if ([61, 63, 65, 66, 67].includes(code)) return 'rain'; // Rain
    if ([71, 73, 75, 77].includes(code)) return 'snow'; // Snow fall, Snow grains
    if ([80, 81, 82].includes(code)) return 'rain'; // Rain showers
    if ([85, 86].includes(code)) return 'snow'; // Snow showers
    if ([95, 96, 99].includes(code)) return 'thunder';// Thunderstorm
    console.warn("Unbekannter Wettercode erhalten:", code); // Log für unbekannte Codes
    return 'sun'; // Fallback
}

// Funktion zum Formatieren und Anzeigen des aktuellen Datums
function updateDate() {
    const now = new Date();
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    const formattedDate = now.toLocaleDateString('de-DE', options);
    date.text(formattedDate);
}

// --- Ende Open-Meteo Integration ---


// ⚙ initialize app
init();

// 👁 watch for window resize
$(window).resize(onResize);

// 🏃 start animations (tick wird am Ende von init aufgerufen)

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

    // NEU: Wetterdaten abrufen
    fetchWeatherData();

	// Animation starten
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

	TweenMax.set(sunburst.node, {transformOrigin:"50% 50%", x: sizes.container.width / 2, y: (sizes.card.height/2) + sizes.card.offset.top});
	TweenMax.fromTo(sunburst.node, 20, {rotation: 0}, {rotation: 360, repeat: -1, ease: Power0.easeInOut})

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
	TweenMax.fromTo(line.node, 1, {x: x, y: 0- lineLength}, {delay: Math.random(), y: sizes.card.height, ease: Power2.easeIn, onComplete: onRainEnd, onCompleteParams: [line, lineWidth, x, currentWeather.type]});
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

	TweenMax.fromTo(splash.node, speed, {strokeWidth: 2, y: yOffset, x: xOffset + x, opacity: 1, strokeDashoffset: splashLength}, {strokeWidth: 0, strokeDashoffset: - pathLength, opacity: 1, onComplete: onSplashComplete, onCompleteParams: [splash], ease:  SlowMo.ease.config(0.4, 0.1, false)})
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
	var bezier = [{x:x, y:y}, {x: xBezier, y:(Math.random() * endY) + (endY / 3)}, {x: endX, y:endY}]
	TweenMax.fromTo(newLeaf.node, 2, {rotation: Math.random()* 180, x: x, y: y, scale:scale}, {rotation: Math.random()* 360, bezier: bezier, onComplete: onLeafEnd, onCompleteParams: [newLeaf], ease: Power0.easeIn})
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
	TweenMax.fromTo(newSnow.node, 3 + (Math.random() * 5), {x: x, y: y}, {y: endY, onComplete: onSnowEnd, onCompleteParams: [newSnow], ease: Power0.easeIn})
	TweenMax.fromTo(newSnow.node, 1,{scale: 0}, {scale: scale, ease: Power1.easeInOut})
	TweenMax.to(newSnow.node, 3, {x: x+((Math.random() * 150)-75), repeat: -1, yoyo: true, ease: Power1.easeInOut})
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

	for(var i = 0; i < clouds.length; i++) {
		// Wolkenbewegung basierend auf currentWeather.type
		var cloudSpeed = settings.windSpeed; // Standardgeschwindigkeit
		if (currentWeather.type === 'sun') {
			cloudSpeed = 20; // Schnellere Bewegung bei Sonne
		} else if (currentWeather.type === 'wind') {
            cloudSpeed = 3; // Mittlere Geschwindigkeit bei Wind
        } else {
            cloudSpeed = 0.5; // Langsame Bewegung bei anderen Zuständen
        }

        // Richtung und Reset-Logik basierend auf Sonne oder nicht
		if(currentWeather.type == 'sun') {
            // Bei Sonne: Wolken bewegen sich schneller und können aus dem Bild verschwinden
			clouds[i].offset += cloudSpeed / (i + 1); // Geschwindigkeit anpassen
            // Reset, wenn Wolke weit links ist (aus dem Bild)
			if(clouds[i].offset > sizes.card.width * 1.5) { // Schwelle anpassen, falls nötig
                 clouds[i].offset = -(sizes.card.width * 1.5); // Weiter links starten
            }
		} else {
            // Bei anderen Wetterlagen: Langsamere, kontinuierliche Schleife
			clouds[i].offset += cloudSpeed / (i + 1);
			if(clouds[i].offset > sizes.card.width) {
                clouds[i].offset = clouds[i].offset - sizes.card.width; // Nahtloser Übergang
            }
		}
        clouds[i].group.transform('t' + clouds[i].offset + ',' + 0);
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
	TweenMax.fromTo(summary, 1.5, {x: 30}, {opacity: 1, x: 0, ease: Power4.easeOut});
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
	TweenMax.fromTo(card, 0.75, {y: -30}, {y:0, ease:Elastic.easeOut});

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

	TweenMax.to(strike.node, 1, {opacity: 0, ease:Power4.easeOut, onComplete: function(){ strike.remove(); strike = null}})
}

function changeWeather(weatherData)
{
    var newWeather = weatherData.data ? weatherData.data : weatherData;

    // Verhindert unnötige Animationen, wenn sich nichts ändert
    if (currentWeather && currentWeather.type === newWeather.type) {
         // Nur den Text aktualisieren, falls er sich geändert haben könnte (sollte hier nicht der Fall sein)
         if (summary.html() !== newWeather.name) {
             TweenMax.killTweensOf(summary);
             TweenMax.to(summary, 0.5, {opacity: 0, x: -30, onComplete: function() {
                 summary.html(newWeather.name);
                 TweenMax.to(summary, 0.5, {opacity: 1, x: 0, ease: Power4.easeOut});
             }, ease: Power4.easeIn});
         }
        return;
    }

	reset();
	currentWeather = newWeather;

	// Summary Text aktualisieren (mit Animation)
	TweenMax.killTweensOf(summary);
	TweenMax.to(summary, 1, {opacity: 0, x: -30, onComplete: updateSummaryText, ease: Power4.easeIn})

	container.addClass(currentWeather.type);
    if (currentWeather.button) {
	    currentWeather.button.addClass('active');
    }

	// --- Animationen basierend auf dem NEUEN currentWeather anpassen ---
    let windTarget, rainTarget, leafTarget, snowTarget;
    let sunXTarget, sunYTarget, sunburstScaleTarget, sunburstOpacityTarget, sunburstYTarget;

	switch(currentWeather.type) {
		case 'wind':
            windTarget = 3;
            rainTarget = 0;
            leafTarget = 5;
            snowTarget = 0;
            sunXTarget = sizes.card.width / 2; // Sonne aus dem Bild
            sunYTarget = -100;
            sunburstScaleTarget = 0.4;
            sunburstOpacityTarget = 0;
            sunburstYTarget = (sizes.container.height/2)-50;
			break;
		case 'sun':
            windTarget = 20; // Schnellere Wolkenbewegung
            rainTarget = 0;
            leafTarget = 0;
            snowTarget = 0;
            sunXTarget = sizes.card.width / 2; // Sonne in der Mitte
            sunYTarget = sizes.card.height / 2;
            sunburstScaleTarget = 1;
            sunburstOpacityTarget = 0.8;
            sunburstYTarget = (sizes.card.height/2) + (sizes.card.offset.top);
			break;
        case 'rain':
            windTarget = 0.5;
            rainTarget = 10;
            leafTarget = 0;
            snowTarget = 0;
            sunXTarget = sizes.card.width / 2;
            sunYTarget = -100;
            sunburstScaleTarget = 0.4;
            sunburstOpacityTarget = 0;
            sunburstYTarget = (sizes.container.height/2)-50;
            break;
        case 'thunder':
            windTarget = 0.5; // Oder etwas mehr Wind? Geschmackssache
            rainTarget = 60; // Viel Regen
            leafTarget = 0;
            snowTarget = 0;
            sunXTarget = sizes.card.width / 2;
            sunYTarget = -100;
            sunburstScaleTarget = 0.4;
            sunburstOpacityTarget = 0;
            sunburstYTarget = (sizes.container.height/2)-50;
            break;
        case 'snow':
            windTarget = 0.5;
            rainTarget = 0;
            leafTarget = 0;
            snowTarget = 40; // Schnee
            sunXTarget = sizes.card.width / 2;
            sunYTarget = -100;
            sunburstScaleTarget = 0.4;
            sunburstOpacityTarget = 0;
            sunburstYTarget = (sizes.container.height/2)-50;
            break;
		default: // Fallback (sollte nicht passieren)
            windTarget = 0.5;
            rainTarget = 0;
            leafTarget = 0;
            snowTarget = 0;
            sunXTarget = sizes.card.width / 2;
            sunYTarget = -100;
            sunburstScaleTarget = 0.4;
            sunburstOpacityTarget = 0;
            sunburstYTarget = (sizes.container.height/2)-50;
			break;
	}

    // Anwenden der Zielwerte mit TweenMax
    TweenMax.to(settings, 3, { windSpeed: windTarget, ease: Power2.easeInOut });
    TweenMax.to(settings, weather.type === 'rain' || weather.type === 'thunder' ? 3 : 1, { rainCount: rainTarget, ease: Power2.easeInOut });
    TweenMax.to(settings, weather.type === 'wind' ? 3 : 1, { leafCount: leafTarget, ease: Power2.easeInOut });
    TweenMax.to(settings, weather.type === 'snow' ? 3 : 1, { snowCount: snowTarget, ease: Power2.easeInOut });

    // Sonnen-Animationen
    TweenMax.to(sun.node, weather.type === 'sun' ? 4 : 2, { x: sunXTarget, y: sunYTarget, ease: Power2.easeInOut });
    TweenMax.to(sunburst.node, weather.type === 'sun' ? 4 : 2, { scale: sunburstScaleTarget, opacity: sunburstOpacityTarget, y: sunburstYTarget, ease: Power2.easeInOut });


	// lightning Timer starten/stoppen
	startLightningTimer();
}