// Sicherstellen, dass das Skript erst nach dem Laden des DOM ausgeführt wird
$(document).ready(function() {

    // 📝 DOM-Elemente auswählen
    var container = $('.container');
    var card = $('#card');
    var innerSVG = Snap('#inner');
    var outerSVG = Snap('#outer');
    var backSVG = Snap('#back');
    var summaryElement = $('#summary'); // Umbenannt, um Konflikte zu vermeiden
    var dateElement = $('#date');       // Umbenannt
    var tempValueElement = $('#temp-value');
    var tempUnitElement = $('#temp-unit');
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
    var currentWeather = null; // Aktuellen Wetterzustand speichern

    // Open-Meteo API Konfiguration
    const LATITUDE = 51.51; // Dortmund
    const LONGITUDE = 7.47; // Dortmund
    const API_URL = `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}¤t_weather=true&temperature_unit=celsius&windspeed_unit=kmh&timezone=auto`;

    // Größenobjekt
    var sizes = {
        container: { width: 0, height: 0 },
        card: { width: 0, height: 0 }
    };

    // Wolken-Gruppen
    var clouds = [
        { group: Snap.select('#cloud1'), path: null, offset: 0 },
        { group: Snap.select('#cloud2'), path: null, offset: 0 },
        { group: Snap.select('#cloud3'), path: null, offset: 0 }
    ];

    // Wettertypen und ihre Namen/Buttons
    var weatherTypes = [
        { type: 'snow', name: 'Schnee', button: $('#button-snow') },
        { type: 'wind', name: 'Windig', button: $('#button-wind') },
        { type: 'rain', name: 'Regen', button: $('#button-rain') },
        { type: 'thunder', name: 'Gewitter', button: $('#button-thunder') },
        { type: 'sun', name: 'Sonnig', button: $('#button-sun') }
    ];

    // App-Einstellungen für Animationen
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

    // --------------------------------------------------
    // INITIALISIERUNG
    // --------------------------------------------------
    function init() {
        onResize(); // Fenstergrößen initial messen

        // Event Listener für Buttons hinzufügen
        weatherTypes.forEach(w => {
            if (w.button) {
                w.button.bind('click', w, changeWeather);
            } else {
                console.error("Button not found for weather type:", w.type);
            }
        });

        // Wolken zeichnen
        clouds.forEach((cloud, i) => {
            cloud.offset = Math.random() * sizes.card.width;
            drawCloud(cloud, i);
        });

        // Sonnenstrahlen initial ausblenden
        TweenMax.set(sunburst.node, { opacity: 0 });

        // Wetterdaten von API abrufen und UI initialisieren
        fetchWeatherData();

        // Animation starten
        requestAnimationFrame(tick);
    }

    // --------------------------------------------------
    // API-DATENABRUF & VERARBEITUNG
    // --------------------------------------------------
    function fetchWeatherData() {
        console.log("Fetching weather data from:", API_URL);
        fetch(API_URL)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log("API Data received:", data);
                if (data && data.current_weather) {
                    updateUI(data.current_weather);
                    const weatherCode = data.current_weather.weathercode;
                    const initialWeatherType = mapWeatherCodeToType(weatherCode);
                    // Finde das passende Wetterobjekt aus unserem Array
                    const initialWeather = weatherTypes.find(w => w.type === initialWeatherType) || weatherTypes[4]; // Fallback zu Sonnig
                    changeWeather({ data: initialWeather }); // Initiale Wetteranimation setzen
                } else {
                    console.error("Invalid data structure received from API:", data);
                    setFallbackWeather();
                }
            })
            .catch(error => {
                console.error("Error fetching weather data:", error);
                summaryElement.text("Fehler");
                dateElement.text("---");
                tempValueElement.text("??");
                setFallbackWeather(); // Fallback setzen bei Fehler
            });
    }

    function updateUI(weatherData) {
        // Temperatur
        const temp = Math.round(weatherData.temperature);
        tempValueElement.text(temp);
        tempUnitElement.text("°C"); // Einheit ist jetzt fix Celsius

        // Datum formatieren
        try {
            const date = new Date(weatherData.time);
             const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
             // Locale auf 'de-DE' für deutsche Formatierung setzen
            dateElement.text(date.toLocaleDateString('de-DE', options));
        } catch (e) {
            console.error("Error formatting date:", e);
            dateElement.text(weatherData.time); // Fallback auf Roh-Zeitstempel
        }


        // Zusammenfassung (wird in changeWeather gesetzt, basierend auf dem Typ)
        // Hier könnten wir spezifischere Texte basierend auf dem Code hinzufügen,
        // aber wir nutzen erstmal die Namen aus weatherTypes.
    }

    // Übersetzt Open-Meteo WMO Codes zu unseren Typen
    function mapWeatherCodeToType(code) {
        // Quelle: https://open-meteo.com/en/docs#weathervariables
        if ([0, 1].includes(code)) return 'sun';        // Clear, Mainly clear
        if ([2, 3].includes(code)) return 'sun';        // Partly cloudy, Overcast (vereinfacht zu 'sun')
        if ([45, 48].includes(code)) return 'wind';       // Fog (visuell am nächsten zu windig/trüb)
        if (code >= 51 && code <= 67) return 'rain';   // Drizzle, Rain
        if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow'; // Snow fall, Snow showers
        if (code >= 80 && code <= 82) return 'rain';   // Rain showers
        if ([95, 96, 99].includes(code)) return 'thunder';// Thunderstorm
        console.warn("Unmapped weather code:", code);
        return 'sun'; // Fallback
    }

    // Setzt ein Standardwetter (z.B. Sonnig), wenn API fehlschlägt
    function setFallbackWeather() {
        changeWeather({ data: weatherTypes.find(w => w.type === 'sun') });
        if (summaryElement.text() === "Lädt..." || summaryElement.text() === "Fehler") {
             summaryElement.text("Wetterdaten nicht verfügbar");
        }
    }


    // --------------------------------------------------
    // EVENT HANDLER & UI-UPDATES
    // --------------------------------------------------

    // Bei Fenstergrößenänderung
    function onResize() {
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

        TweenMax.set(sunburst.node, { transformOrigin: "50% 50%", x: sizes.container.width / 2, y: (sizes.card.height / 2) + sizes.card.offset.top });
        // Die Endlos-Rotation der Sonne wird beim Start gesetzt, falls sie läuft
        if (TweenMax.getTweensOf(sunburst.node).length > 0) {
             TweenMax.fromTo(sunburst.node, 20, { rotation: 0 }, { rotation: 360, repeat: -1, ease: Power0.easeInOut });
        }


        leafMask.attr({ x: sizes.card.offset.left, y: 0, width: sizes.container.width - sizes.card.offset.left, height: sizes.container.height });

        // Wolken neu zeichnen bei Größenänderung
         clouds.forEach((cloud, i) => {
            drawCloud(cloud, i);
        });
    }

    // Wetter ändern (wird von Buttons ODER initialem API-Call ausgelöst)
    function changeWeather(weatherInput) {
        // Ermitteln, ob das Event-Objekt oder unser Wetter-Objekt übergeben wurde
        var weatherData = weatherInput.data ? weatherInput.data : weatherInput;

        if (!weatherData || !weatherData.type) {
             console.error("Invalid weather data passed to changeWeather:", weatherInput);
             return;
        }

        // Vorheriges Wetter zurücksetzen
        resetWeatherState();

        currentWeather = weatherData; // Globalen Zustand setzen

        // Aktualisiere Text der Zusammenfassung
        summaryElement.text(currentWeather.name);
        TweenMax.fromTo(summaryElement, 1.5, { x: 30, opacity: 0 }, { opacity: 1, x: 0, ease: Power4.easeOut });

        // CSS-Klasse für das Styling auf der #card setzen
        card.addClass(currentWeather.type);
        // Aktiven Button markieren
        if (currentWeather.button) {
             currentWeather.button.addClass('active');
        }


        // --- Animationseinstellungen anpassen ---

        // Windgeschwindigkeit
        let targetWindSpeed = 0.5;
        if (currentWeather.type === 'wind') targetWindSpeed = 3;
        if (currentWeather.type === 'sun') targetWindSpeed = 20; // Sonne bewegt Wolken schneller weg
        TweenMax.to(settings, 3, { windSpeed: targetWindSpeed, ease: Power2.easeInOut });

        // Regenmenge
        let targetRainCount = 0;
        if (currentWeather.type === 'rain') targetRainCount = 10;
        if (currentWeather.type === 'thunder') targetRainCount = 60;
        TweenMax.to(settings, 3, { rainCount: targetRainCount, ease: Power2.easeInOut });

        // Blattmenge
        let targetLeafCount = 0;
        if (currentWeather.type === 'wind') targetLeafCount = 5;
        TweenMax.to(settings, 3, { leafCount: targetLeafCount, ease: Power2.easeInOut });

        // Schneemenge
        let targetSnowCount = 0;
        if (currentWeather.type === 'snow') targetSnowCount = 40;
        TweenMax.to(settings, 3, { snowCount: targetSnowCount, ease: Power2.easeInOut });

        // Sonnenposition & Strahlen
        if (currentWeather.type === 'sun') {
            TweenMax.to(sun.node, 4, { x: sizes.card.width / 2, y: sizes.card.height / 2, ease: Power2.easeInOut });
            TweenMax.to(sunburst.node, 4, { scale: 1, opacity: 0.8, y: (sizes.card.height / 2) + (sizes.card.offset.top), ease: Power2.easeInOut });
             // Start rotation if not already running
             if(TweenMax.getTweensOf(sunburst.node).length === 0){
                  TweenMax.fromTo(sunburst.node, 20, {rotation: 0}, {rotation: 360, repeat: -1, ease: Power0.easeInOut});
             }
        } else {
            TweenMax.to(sun.node, 2, { x: sizes.card.width / 2, y: -100, ease: Power2.easeInOut });
            TweenMax.to(sunburst.node, 2, { scale: 0.4, opacity: 0, y: (sizes.container.height / 2) - 50, ease: Power2.easeInOut });
             // Stop rotation
             TweenMax.killTweensOf(sunburst.node);
        }

        // Blitz-Timer starten/stoppen
        startLightningTimer();
    }

     // Setzt Klassen und aktive Buttons zurück
    function resetWeatherState() {
        weatherTypes.forEach(w => {
            card.removeClass(w.type);
            if (w.button) {
                w.button.removeClass('active');
            }
        });
         // Stoppt laufende Animationen für Partikel, falls nötig
         // (GSAP's `to` mit duration 1 stoppt sie implizit)
         TweenMax.to(settings, 1, { rainCount: 0, leafCount: 0, snowCount: 0, ease: Power2.easeOut });
    }


    // --------------------------------------------------
    // ZEICHNEN & ANIMATIONEN (Größtenteils unverändert)
    // --------------------------------------------------

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
        // Animate sorgt für weichere Übergänge bei Resize
        cloud.path.animate({ d: path }, 1000, mina.elastic);
    }

    function makeRain() {
        if (!currentWeather) return; // Sicherstellen, dass Wetterdaten vorhanden sind
        var lineWidth = Math.random() * 3;
        var lineLength = currentWeather.type === 'thunder' ? 35 : 14;
        var x = Math.random() * (sizes.card.width - 40) + 20;

        // Wähle die richtige Haltergruppe basierend auf der Liniendicke
        var holder = [innerRainHolder1, innerRainHolder2, innerRainHolder3][3 - Math.floor(lineWidth)] || innerRainHolder1;

        var line = holder.path('M0,0 0,' + lineLength).attr({
            fill: 'none',
            stroke: currentWeather.type === 'thunder' ? '#777' : '#0000ff',
            strokeWidth: lineWidth,
            // Kanten abrunden für natürlicheres Aussehen
             'stroke-linecap': 'round'
        });

        rain.push(line);

        TweenMax.fromTo(line.node, 1, { x: x, y: 0 - lineLength }, { delay: Math.random(), y: sizes.card.height, ease: Power2.easeIn, onComplete: onRainEnd, onCompleteParams: [line, lineWidth, x, currentWeather.type] });
    }

    function onRainEnd(line, width, x, type) {
        line.remove();
        line = null;

        rain = rain.filter(item => item && item.paper); // Bereinige Array

        if (rain.length < settings.rainCount) {
            makeRain();
            if (width > 2) makeSplash(x, type);
        }
    }

     function makeSplash(x, type) {
         var splashLength = type === 'thunder' ? 30 : 20;
         var splashBounce = type === 'thunder' ? 120 : 100;
         var splashDistance = 80;
         var speed = type === 'thunder' ? 0.7 : 0.5;
         var splashUp = 0 - (Math.random() * splashBounce);
         var randomX = ((Math.random() * splashDistance) - (splashDistance / 2));

         var points = [];
         points.push('M' + 0 + ',' + 0);
         points.push('Q' + randomX + ',' + splashUp);
         points.push((randomX * 2) + ',' + splashDistance);

         var splash = outerSplashHolder.path(points.join(' ')).attr({
             fill: "none",
             stroke: type === 'thunder' ? '#777' : '#0000ff',
             strokeWidth: 1,
             'stroke-linecap': 'round' // Runde Kanten
         });

         var pathLength = splash.getTotalLength(); // Snap.path.getTotalLength ist veraltet
         var xOffset = sizes.card.offset.left;
         var yOffset = sizes.card.offset.top + sizes.card.height;
         splash.node.style.strokeDasharray = pathLength + ' ' + pathLength;
         splash.node.style.strokeDashoffset = pathLength; // Start mit Offset

         TweenMax.fromTo(splash.node, speed,
             { y: yOffset, x: xOffset + x, // Korrigierte X-Position
              opacity: 1, strokeDashoffset: pathLength, strokeWidth: 2 },
             { strokeWidth: 0, strokeDashoffset: -pathLength, opacity: 1, // Endet bei 0 Breite
               onComplete: onSplashComplete, onCompleteParams: [splash],
               ease: SlowMo.ease.config(0.4, 0.1, false) }
         );
     }

    function onSplashComplete(splash) {
        splash.remove();
        splash = null;
    }

    function makeLeaf() {
         if (!sizes.card.offset) return; // Verhindert Fehler vor dem ersten Resize

        var scale = 0.5 + (Math.random() * 0.5);
        var newLeaf;
        var areaY = sizes.card.height / 2;
        var y = areaY + (Math.random() * areaY);
        var endY = y - ((Math.random() * (areaY * 2)) - areaY);
        var x, endX, xBezier;
        var colors = ['#76993E', '#4A5E23', '#6D632F'];
        var color = colors[Math.floor(Math.random() * colors.length)];

        if (scale > 0.8) { // Blatt fliegt aus der Karte heraus
            newLeaf = leaf.clone().appendTo(outerLeafHolder).attr({ fill: color });
             // Startposition relativ zur Karte anpassen
            y = y + sizes.card.offset.top / 2;
            endY = endY + sizes.card.offset.top / 2;
            x = sizes.card.offset.left - 100; // Links außerhalb starten
             xBezier = sizes.card.offset.left + (sizes.container.width - sizes.card.offset.left) / 2; // Kontrollpunkt in der Mitte des äußeren Bereichs
            endX = sizes.container.width + 50; // Rechts außerhalb enden
        } else { // Blatt bleibt innerhalb der Karte
            newLeaf = leaf.clone().appendTo(innerLeafHolder).attr({ fill: color });
            x = -100; // Links außerhalb der Karte starten
            xBezier = sizes.card.width / 2; // Kontrollpunkt Mitte der Karte
            endX = sizes.card.width + 50; // Rechts außerhalb der Karte enden
        }

        leafs.push(newLeaf);

        var bezier = [{ x: x, y: y }, { x: xBezier, y: (Math.random() * endY) + (endY / 3) }, { x: endX, y: endY }];
        TweenMax.fromTo(newLeaf.node, 2 + (Math.random()*2) , // Dauer variieren
            { rotation: Math.random() * 180, x: x, y: y, scale: scale },
            { rotation: Math.random() * 360, bezier: bezier, onComplete: onLeafEnd, onCompleteParams: [newLeaf], ease: Power0.easeNone } // easeIn war zu schnell am Ende
        );
    }

    function onLeafEnd(leaf) {
        leaf.remove();
        leaf = null;
        leafs = leafs.filter(item => item && item.paper); // Array säubern

        if (leafs.length < settings.leafCount) {
            makeLeaf();
        }
    }

    function makeSnow() {
         if (!sizes.card.offset) return; // Verhindert Fehler vor dem ersten Resize

        var scale = 0.5 + (Math.random() * 0.5);
        var newSnow;
        var x = 20 + (Math.random() * (sizes.card.width - 40));
        var y = -10;
        var endY;

        if (scale > 0.8) { // Größere Flocken außerhalb
            newSnow = outerSnowHolder.circle(0, 0, 5 * scale).attr({ fill: 'white' }); // Größe anpassen
            endY = sizes.container.height + 10;
            y = sizes.card.offset.top + settings.cloudHeight; // Start unter den Wolken
            x = x + sizes.card.offset.left; // X-Position anpassen
        } else { // Kleinere Flocken innerhalb
            newSnow = innerSnowHolder.circle(0, 0, 5 * scale).attr({ fill: 'white' }); // Größe anpassen
            endY = sizes.card.height + 10;
            y = settings.cloudHeight - 20; // Start innerhalb der Karte, unter den Wolken
        }

        snow.push(newSnow);

        TweenMax.fromTo(newSnow.node, 3 + (Math.random() * 5),
            { x: x, y: y, scale: 0 }, // Start unsichtbar und klein
            { y: endY, scale: scale, onComplete: onSnowEnd, onCompleteParams: [newSnow], ease: Power0.easeIn }
        );
        // Leichtes horizontales Schwanken hinzufügen
        TweenMax.to(newSnow.node, 1.5 + Math.random() * 1.5, { x: x + ((Math.random() * 150) - 75), repeat: -1, yoyo: true, ease: Power1.easeInOut });
    }


    function onSnowEnd(flake) {
        TweenMax.killTweensOf(flake.node); // Wichtig: Auch die x-Animation stoppen
        flake.remove();
        flake = null;
        snow = snow.filter(item => item && item.paper); // Array säubern

        if (snow.length < settings.snowCount) {
            makeSnow();
        }
    }

    // Blitz Timer & Animation
    function startLightningTimer() {
        if (lightningTimeout) clearTimeout(lightningTimeout);
        if (currentWeather && currentWeather.type === 'thunder') {
            lightningTimeout = setTimeout(lightning, Math.random() * 6000 + 1000); // Mind. 1 Sek Pause
        }
    }

    function lightning() {
        startLightningTimer(); // Nächsten Blitz planen
        TweenMax.fromTo(card, 0.75, { y: -15 }, { y: 0, ease: Elastic.easeOut }); // Weniger starkes Wackeln

        var pathX = 30 + Math.random() * (sizes.card.width - 60);
        var yOffset = 20;
        var steps = 20;
        var points = [pathX + ',0'];
        for (var i = 0; i < steps; i++) {
            var x = pathX + (Math.random() * yOffset - (yOffset / 2));
            var y = (sizes.card.height / steps) * (i + 1);
            points.push(x + ',' + y);
        }

        var strike = innerLightningHolder.path('M' + points.join(' ')) // Blitz im inneren SVG
            .attr({
                fill: 'none',
                stroke: 'white',
                strokeWidth: 1 + Math.random() * 2 // Variablere Dicke
            });

        // Schnelles Aufblitzen und Verblassen
        TweenMax.fromTo(strike.node, 0.05, { opacity: 1 }, { opacity: 0, delay: 0.05, ease: Power4.easeOut, onComplete: function() { strike.remove(); strike = null; } });
        // Man kann auch die Helligkeit der Karte kurz ändern
         TweenMax.fromTo(card, 0.1, { filter: 'brightness(1.5)' }, { filter: 'brightness(1)', delay: 0.01 });
    }

    // Animations-Tick (Haupt-Loop)
    function tick() {
        tickCount++;
        var check = tickCount % settings.renewCheck;

         // Nur Partikel erzeugen, wenn benötigt und Wettertyp aktiv ist
        if (check === 0) { // Nur alle 'renewCheck' Ticks prüfen
            if (currentWeather && currentWeather.type === 'rain' && rain.length < settings.rainCount) makeRain();
            if (currentWeather && currentWeather.type === 'wind' && leafs.length < settings.leafCount) makeLeaf();
            if (currentWeather && currentWeather.type === 'snow' && snow.length < settings.snowCount) makeSnow();
        }

        // Wolken bewegen
        clouds.forEach((cloud, i) => {
            var cloudWidth = sizes.card.width * 4; // Breite einer einzelnen Wolkengrafik (approx)
            var layerSpeedMultiplier = 1 / (i + 1); // Hintere Wolken langsamer

             if (currentWeather && currentWeather.type === 'sun') {
                 // Wolken bewegen sich bei Sonne schneller nach links 'raus'
                 cloud.offset -= settings.windSpeed * layerSpeedMultiplier * 0.5; // Halbe Geschwindigkeit für Sonnen-Wegschieben
                 // Wenn Wolke komplett links raus ist, neu positionieren für nächsten Zyklus (optional)
                 if (cloud.offset < -(cloudWidth)) {
                     // cloud.offset = sizes.card.width; // Oder andere Logik
                 }
             } else {
                  // Normale Wolkenbewegung nach rechts
                 cloud.offset += settings.windSpeed * layerSpeedMultiplier;
                 // Loop: Wenn Wolke rechts raus, links wieder reinholen
                 if (cloud.offset > sizes.card.width) {
                     cloud.offset = cloud.offset - cloudWidth; // Exakt um die Breite zurücksetzen
                 }
             }
             cloud.group.transform('t' + cloud.offset + ',' + 0);
        });

        requestAnimationFrame(tick); // Nächsten Frame anfordern
    }

    // App starten, wenn das Dokument bereit ist
    init();

}); // Ende von $(document).ready