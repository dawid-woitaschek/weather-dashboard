// Sicherstellen, dass das Skript erst nach dem Laden des DOM ausgeführt wird
$(document).ready(function() {

    // 📝 DOM-Elemente auswählen
    var container = $('.container');
    var card = $('#card');
    var innerSVG = Snap('#inner');
    var outerSVG = Snap('#outer');
    var backSVG = Snap('#back');
    var summaryElement = $('#summary');
    var dateElement = $('#date');
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
        card: { width: 0, height: 0 },
        offset: { top: 0, left: 0} // Offset hier initialisieren
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
            if (w.button && w.button.length > 0) { // Sicherstellen, dass Button existiert
                w.button.bind('click', w, changeWeather);
            } else {
                console.error("Button not found for weather type:", w.type);
            }
        });


        // Wolken zeichnen
        clouds.forEach((cloud, i) => {
            cloud.offset = Math.random() * sizes.card.width;
            if (cloud.group) { // Nur zeichnen, wenn Gruppe vorhanden ist
                 drawCloud(cloud, i);
            } else {
                 console.error("Cloud group missing for index:", i);
            }
        });

        // Sonnenstrahlen initial ausblenden
        gsap.set(sunburst.node, { opacity: 0 }); // GSAP 3 Syntax: gsap.set

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
                    const initialWeather = weatherTypes.find(w => w.type === initialWeatherType) || weatherTypes.find(w => w.type === 'sun'); // Fallback zu Sonnig
                    if (initialWeather) {
                         changeWeather({ data: initialWeather }); // Initiale Wetteranimation setzen
                    } else {
                         console.error("Could not find initial weather type object for:", initialWeatherType);
                         setFallbackWeather();
                    }

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
        const temp = Math.round(weatherData.temperature);
        tempValueElement.text(temp);
        tempUnitElement.text("°C");

        try {
            const date = new Date(weatherData.time);
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            dateElement.text(date.toLocaleDateString('de-DE', options));
        } catch (e) {
            console.error("Error formatting date:", e);
            dateElement.text(weatherData.time || 'Kein Datum'); // Fallback
        }
    }

    function mapWeatherCodeToType(code) {
        if ([0, 1].includes(code)) return 'sun';
        if ([2, 3].includes(code)) return 'sun'; // Vereinfacht
        if ([45, 48].includes(code)) return 'wind'; // Nebel -> Windig/Trüb
        if (code >= 51 && code <= 67) return 'rain';
        if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
        if (code >= 80 && code <= 82) return 'rain';
        if ([95, 96, 99].includes(code)) return 'thunder';
        console.warn("Unmapped weather code:", code, "-> falling back to 'sun'");
        return 'sun';
    }

    function setFallbackWeather() {
        const fallbackWeather = weatherTypes.find(w => w.type === 'sun');
         if (fallbackWeather) {
             changeWeather({ data: fallbackWeather });
             if (summaryElement.text() === "Lädt..." || summaryElement.text() === "Fehler") {
                 summaryElement.text("Wetterdaten nicht verfügbar");
             }
         } else {
             console.error("Fallback weather 'sun' not found in weatherTypes array!");
              // Absolute Notfallanzeige
             summaryElement.text("Init. Fehler");
             dateElement.text("");
             tempValueElement.text("--");
         }
    }

    // --------------------------------------------------
    // EVENT HANDLER & UI-UPDATES
    // --------------------------------------------------

    function onResize() {
        sizes.container.width = container.width();
        sizes.container.height = container.height();
        sizes.card.width = card.width();
        sizes.card.height = card.height();
         // jQuery offset() kann null sein, wenn das Element nicht sichtbar ist. Sicherstellen, dass es ein Objekt gibt.
        sizes.card.offset = card.offset() || { top: 0, left: 0 };

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

        // Sonnenstrahlen-Position und Rotation aktualisieren
        gsap.set(sunburst.node, {
             transformOrigin: "50% 50%",
             x: sizes.container.width / 2,
             y: (sizes.card.height / 2) + sizes.card.offset.top
        });

        // Nur neu starten, wenn es läuft
        // Korrektur: gsap.getTweensOf() verwenden
        if (gsap.getTweensOf(sunburst.node).length > 0) {
             gsap.fromTo(sunburst.node, { rotation: 0 }, { rotation: 360, duration: 20, repeat: -1, ease: "none" }); // GSAP 3 Ease Syntax
        }

        // Blattmaske aktualisieren
         leafMask.attr({
             x: sizes.card.offset.left,
             y: 0,
             width: sizes.container.width - sizes.card.offset.left,
             height: sizes.container.height
         });


        // Wolken neu zeichnen bei Größenänderung
        clouds.forEach((cloud, i) => {
            if (cloud.group) { // Sicherstellen, dass die Gruppe existiert
                drawCloud(cloud, i);
            }
        });
    }


    function changeWeather(weatherInput) {
        var weatherData = weatherInput.data ? weatherInput.data : weatherInput;

        if (!weatherData || !weatherData.type) {
            console.error("Invalid weather data passed to changeWeather:", weatherInput);
            return;
        }

        resetWeatherState();
        currentWeather = weatherData;

        summaryElement.text(currentWeather.name);
        gsap.fromTo(summaryElement, { x: 30, opacity: 0 }, { opacity: 1, x: 0, duration: 1.5, ease: "power4.out" }); // GSAP 3 Syntax

        card.addClass(currentWeather.type);
        if (currentWeather.button && currentWeather.button.length > 0) { // Check button existence
             currentWeather.button.addClass('active');
        }


        // --- Animationseinstellungen anpassen (GSAP 3 Syntax) ---

        let targetWindSpeed = 0.5;
        if (currentWeather.type === 'wind') targetWindSpeed = 3;
        if (currentWeather.type === 'sun') targetWindSpeed = 20;
        gsap.to(settings, { windSpeed: targetWindSpeed, duration: 3, ease: "power2.inOut" });

        let targetRainCount = 0;
        if (currentWeather.type === 'rain') targetRainCount = 10;
        if (currentWeather.type === 'thunder') targetRainCount = 60;
        gsap.to(settings, { rainCount: targetRainCount, duration: 3, ease: "power2.inOut" });

        let targetLeafCount = 0;
        if (currentWeather.type === 'wind') targetLeafCount = 5;
        gsap.to(settings, { leafCount: targetLeafCount, duration: 3, ease: "power2.inOut" });

        let targetSnowCount = 0;
        if (currentWeather.type === 'snow') targetSnowCount = 40;
        gsap.to(settings, { snowCount: targetSnowCount, duration: 3, ease: "power2.inOut" });

        // Sonnenposition & Strahlen (GSAP 3 Syntax)
        if (currentWeather.type === 'sun') {
            gsap.to(sun.node, { x: sizes.card.width / 2, y: sizes.card.height / 2, duration: 4, ease: "power2.inOut" });
            gsap.to(sunburst.node, { scale: 1, opacity: 0.8, y: (sizes.card.height / 2) + sizes.card.offset.top, duration: 4, ease: "power2.inOut" });
            // Start rotation if not already running using gsap.getTweensOf()
            if(gsap.getTweensOf(sunburst.node).length === 0){
                 gsap.fromTo(sunburst.node, { rotation: 0 }, { rotation: 360, duration: 20, repeat: -1, ease: "none" });
            }
        } else {
            gsap.to(sun.node, { x: sizes.card.width / 2, y: -100, duration: 2, ease: "power2.inOut" });
            gsap.to(sunburst.node, { scale: 0.4, opacity: 0, y: (sizes.container.height / 2) - 50, duration: 2, ease: "power2.inOut" });
            // Stop rotation using gsap.killTweensOf()
            gsap.killTweensOf(sunburst.node);
        }

        startLightningTimer();
    }

    function resetWeatherState() {
        weatherTypes.forEach(w => {
            card.removeClass(w.type);
            if (w.button && w.button.length > 0) { // Check button existence
                 w.button.removeClass('active');
            }
        });
        // Stoppt laufende Animationen für Partikel implizit durch neues `to` mit duration 1
        gsap.to(settings, { rainCount: 0, leafCount: 0, snowCount: 0, duration: 1, ease: "power2.out" });
    }

    // --------------------------------------------------
    // ZEICHNEN & ANIMATIONEN (Angepasst an GSAP 3)
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
        if (!cloud.path) {
             // Pfad erstellen, wenn er nicht existiert
             if (cloud.group && typeof cloud.group.path === 'function') {
                 cloud.path = cloud.group.path(path);
             } else {
                 console.error("Cannot create path, group invalid for cloud index:", i);
                 return; // Funktion verlassen, wenn kein Pfad erstellt werden kann
             }
        } else {
            // Bestehenden Pfad animieren
            cloud.path.animate({ d: path }, 1000, mina.elastic); // Snap.svg Animation bleibt
        }
    }


    function makeRain() {
        if (!currentWeather || !sizes.card.width) return; // Sicherstellen, dass Wetterdaten und Größen vorhanden sind
        var lineWidth = Math.random() * 3;
        var lineLength = currentWeather.type === 'thunder' ? 35 : 14;
        var x = Math.random() * (sizes.card.width - 40) + 20;

        var holderIndex = 3 - Math.floor(lineWidth);
        var holder = [innerRainHolder1, innerRainHolder2, innerRainHolder3][holderIndex] || innerRainHolder1;

        if (!holder) { console.error("Rain holder not found for index", holderIndex); return; }

        var line = holder.path('M0,0 0,' + lineLength).attr({
            fill: 'none',
            stroke: currentWeather.type === 'thunder' ? '#777' : '#0000ff',
            strokeWidth: lineWidth,
            'stroke-linecap': 'round'
        });

        rain.push(line);

        gsap.fromTo(line.node, // GSAP 3 Syntax
            { x: x, y: 0 - lineLength },
            {
                delay: Math.random(),
                y: sizes.card.height,
                duration: 1, // Dauer explizit angeben
                ease: "power2.in", // GSAP 3 Ease Syntax
                onComplete: onRainEnd,
                onCompleteParams: [line, lineWidth, x, currentWeather.type] // Parameter bleiben gleich
            }
        );
    }


    function onRainEnd(line, width, x, type) {
        if (line && typeof line.remove === 'function') {
             line.remove();
        }
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
             'stroke-linecap': 'round'
         });

         var pathLength = splash.getTotalLength();
         var xOffset = sizes.card.offset.left;
         var yOffset = sizes.card.offset.top + sizes.card.height;
         splash.node.style.strokeDasharray = pathLength + ' ' + pathLength;
         splash.node.style.strokeDashoffset = pathLength;

         // GSAP 3 Syntax für SlowMo
         gsap.fromTo(splash.node,
             { y: yOffset, x: xOffset + x, opacity: 1, strokeDashoffset: pathLength, strokeWidth: 2 },
             {
                 duration: speed,
                 strokeWidth: 0,
                 strokeDashoffset: -pathLength,
                 opacity: 1,
                 onComplete: onSplashComplete,
                 onCompleteParams: [splash],
                 ease: "slow(0.4, 0.1, false)" // GSAP 3 SlowMo Syntax
             }
         );
     }

    function onSplashComplete(splash) {
        if (splash && typeof splash.remove === 'function') {
             splash.remove();
        }
        splash = null;
    }

    function makeLeaf() {
        if (!sizes.card.offset || !sizes.container.width) return;

        var scale = 0.5 + (Math.random() * 0.5);
        var newLeaf;
        var areaY = sizes.card.height / 2;
        var y = areaY + (Math.random() * areaY);
        var endY = y - ((Math.random() * (areaY * 2)) - areaY);
        var x, endX, xBezier;
        var colors = ['#76993E', '#4A5E23', '#6D632F'];
        var color = colors[Math.floor(Math.random() * colors.length)];

        var holder = null; // Definiere holder hier

        if (scale > 0.8) {
            holder = outerLeafHolder;
            y = y + sizes.card.offset.top / 2;
            endY = endY + sizes.card.offset.top / 2;
            x = sizes.card.offset.left - 100;
            xBezier = sizes.card.offset.left + (sizes.container.width - sizes.card.offset.left) / 2;
            endX = sizes.container.width + 50;
        } else {
            holder = innerLeafHolder;
            x = -100;
            xBezier = sizes.card.width / 2;
            endX = sizes.card.width + 50;
        }

        // Sicherstellen, dass 'holder' und 'leaf' gültig sind
        if (!holder || !leaf) {
            console.error("Cannot create leaf: Invalid holder or leaf template.");
            return;
        }


        newLeaf = leaf.clone();
        if (typeof newLeaf.appendTo === 'function') {
            newLeaf.appendTo(holder).attr({ fill: color }); // Hinzufügen und Farbe setzen
        } else {
            console.error("Cannot append leaf, 'appendTo' is not a function.");
            return;
        }


        leafs.push(newLeaf);

        var bezierPoints = [{ x: x, y: y }, { x: xBezier, y: (Math.random() * endY) + (endY / 3) }, { x: endX, y: endY }];

        // GSAP 3 Syntax für Bezier und Ease
        gsap.fromTo(newLeaf.node,
            { rotation: Math.random() * 180, x: x, y: y, scale: scale },
            {
                duration: 2 + (Math.random() * 2),
                rotation: Math.random() * 360,
                bezier: { // Bezier als Objekt
                    path: bezierPoints,
                    curviness: 1.25 // Beispiel für Kurvigkeit
                },
                onComplete: onLeafEnd,
                onCompleteParams: [newLeaf],
                ease: "none" // GSAP 3 Ease Syntax (Power0.easeNone -> "none")
            }
        );
    }


    function onLeafEnd(leaf) {
        if (leaf && typeof leaf.remove === 'function') {
            leaf.remove();
        }
        leaf = null;
        leafs = leafs.filter(item => item && item.paper);

        if (leafs.length < settings.leafCount) {
            makeLeaf();
        }
    }

    function makeSnow() {
        if (!sizes.card.offset || !sizes.container.height) return;

        var scale = 0.5 + (Math.random() * 0.5);
        var newSnow;
        var x = 20 + (Math.random() * (sizes.card.width - 40));
        var y = -10;
        var endY;
        var holder = null; // Holder definieren

        if (scale > 0.8) {
            holder = outerSnowHolder;
            endY = sizes.container.height + 10;
            y = sizes.card.offset.top + settings.cloudHeight;
            x = x + sizes.card.offset.left;
        } else {
            holder = innerSnowHolder;
            endY = sizes.card.height + 10;
            y = settings.cloudHeight - 20;
        }

        if (!holder || typeof holder.circle !== 'function') {
             console.error("Cannot create snow: Invalid holder.");
             return; // Abbruch, wenn Holder ungültig ist
        }

        newSnow = holder.circle(0, 0, 5 * scale).attr({ fill: 'white' });


        snow.push(newSnow);

        // GSAP 3 Syntax für Hauptanimation (fallen)
        gsap.fromTo(newSnow.node,
            { x: x, y: y, scale: 0 },
            {
                duration: 3 + (Math.random() * 5),
                y: endY,
                scale: scale, // Skalierung in derselben Animation
                onComplete: onSnowEnd,
                onCompleteParams: [newSnow],
                ease: "none" // GSAP 3 (Power0.easeIn -> "none" oder "power1.in")
            }
        );

        // GSAP 3 Syntax für horizontales Schwanken
        gsap.to(newSnow.node, {
            duration: 1.5 + Math.random() * 1.5,
            x: x + ((Math.random() * 150) - 75),
            repeat: -1,
            yoyo: true,
            ease: "power1.inOut" // GSAP 3 Ease Syntax
        });
    }

    function onSnowEnd(flake) {
        if (flake) {
             gsap.killTweensOf(flake.node); // GSAP 3 Syntax
             if (typeof flake.remove === 'function') {
                 flake.remove();
             }
        }
        flake = null;
        snow = snow.filter(item => item && item.paper);

        if (snow.length < settings.snowCount) {
            makeSnow();
        }
    }

    function startLightningTimer() {
        if (lightningTimeout) clearTimeout(lightningTimeout);
        if (currentWeather && currentWeather.type === 'thunder') {
            lightningTimeout = setTimeout(lightning, Math.random() * 6000 + 1000);
        }
    }

    function lightning() {
        startLightningTimer();
        // GSAP 3 Syntax für Elastic Ease
        gsap.fromTo(card, { y: -15 }, { y: 0, duration: 0.75, ease: "elastic.out(1, 0.3)" }); // GSAP 3 Elastic Syntax

        var pathX = 30 + Math.random() * (sizes.card.width - 60);
        var yOffset = 20;
        var steps = 20;
        var points = [pathX + ',0'];
        for (var i = 0; i < steps; i++) {
            var x = pathX + (Math.random() * yOffset - (yOffset / 2));
            var y = (sizes.card.height / steps) * (i + 1);
            points.push(x + ',' + y);
        }

        // Sicherstellen, dass innerLightningHolder existiert
         if (!innerLightningHolder || typeof innerLightningHolder.path !== 'function') {
             console.error("Cannot create lightning: Invalid innerLightningHolder.");
             return;
         }


        var strike = innerLightningHolder.path('M' + points.join(' '))
            .attr({
                fill: 'none',
                stroke: 'white',
                strokeWidth: 1 + Math.random() * 2
            });

        // GSAP 3 Syntax für Verblassen
        gsap.to(strike.node, { // fromTo nicht nötig, da Startwert implizit 1 ist
            opacity: 0,
            duration: 0.1, // Kurze Dauer für Blitz
            delay: 0.05,
            ease: "power4.out", // GSAP 3 Ease Syntax
            onComplete: function() {
                 if (strike && typeof strike.remove === 'function') { strike.remove(); }
                 strike = null;
            }
        });

         // GSAP 3 Syntax für Helligkeit (filter)
        gsap.fromTo(card, { filter: 'brightness(1.5)' }, { filter: 'brightness(1)', duration: 0.1, delay: 0.01 });
    }


    function tick() {
        tickCount++;
        var check = tickCount % settings.renewCheck;

        if (check === 0) {
            if (currentWeather && currentWeather.type === 'rain' && rain.length < settings.rainCount) makeRain();
            if (currentWeather && currentWeather.type === 'wind' && leafs.length < settings.leafCount) makeLeaf();
            if (currentWeather && currentWeather.type === 'snow' && snow.length < settings.snowCount) makeSnow();
        }

        clouds.forEach((cloud, i) => {
             if (!cloud.group || !sizes.card.width) return; // Überspringen, wenn Gruppe oder Breite fehlt

            var cloudWidth = sizes.card.width * 4;
            var layerSpeedMultiplier = 1 / (i + 1);

            if (currentWeather && currentWeather.type === 'sun') {
                cloud.offset -= settings.windSpeed * layerSpeedMultiplier * 0.5;
                // Keine explizite Loop-Logik für Sonne, sie sollen rausfliegen
            } else {
                cloud.offset += settings.windSpeed * layerSpeedMultiplier;
                 // Loop nur, wenn nicht Sonne
                if (cloud.offset > sizes.card.width) {
                     // Zurücksetzen, um den Eindruck einer Endlosschleife zu erwecken
                     // Die genaue Berechnung hängt davon ab, wie der Pfad definiert ist.
                     // Vereinfacht: um die sichtbare Breite zurücksetzen.
                     // Eine präzisere Methode wäre, die tatsächliche Pfadbreite zu kennen.
                     cloud.offset -= cloudWidth; // Annahme: cloudWidth ist die Breite des wiederholenden Musters
                }
            }
            // Verwende GSAP für eine möglicherweise glattere Transformation, obwohl .transform() direkt auch geht
            gsap.set(cloud.group.node, { x: cloud.offset }); // Animiert die x-Position
            // cloud.group.transform('t' + cloud.offset + ',' + 0); // Alternative direkte SVG-Transformation
        });


        requestAnimationFrame(tick);
    }

    // App starten, wenn das Dokument bereit ist
    init();

}); // Ende von $(document).ready