// scripts.js

$(document).ready(function() { // Sicherstellen, dass DOM bereit ist

    // --- Globale Variablen & DOM Referenzen ---
    // CodePen Referenzen (jQuery & Snap.svg)
    var $container = $('.container'); // Haupt-Flex-Container
    var $card = $('#card');           // Die Wetterkarte
    var innerSVG = Snap('#inner');    // SVG innerhalb der Karte
    var outerSVG = Snap('#outer');    // SVG außerhalb der Karte
    var backSVG = Snap('#back');      // SVG für Sunburst
    var $summary = $('#description'); // Angepasst an unsere ID
    var $date = $('#date');           // CodePen ID
    var $location = $('#location');   // Unsere Location ID
    var $temp = $('.temp');           // Temperatur Anzeige
    var $feelsLike = $('#feels-like'); // Unsere FeelsLike ID
    var $detailsGridPlaceholder = $('#details-grid-placeholder'); // Unser Platzhalter

    var weatherContainer1 = Snap.select('#layer1');
    var weatherContainer2 = Snap.select('#layer2');
    var weatherContainer3 = Snap.select('#layer3');
    var innerRainHolder1 = weatherContainer1.group();
    var innerRainHolder2 = weatherContainer2.group();
    var innerRainHolder3 = weatherContainer3.group();
    var innerLeafHolder = weatherContainer1.group(); // Für Wind-Effekt
    var innerSnowHolder = weatherContainer1.group(); // Für Schnee-Effekt
    var innerLightningHolder = weatherContainer1.group(); // Für Blitz-Effekt
    var leafMask = outerSVG.rect();   // Maske für äußere Blätter
    var leaf = Snap.select('#leaf');  // SVG Blatt Definition
    var sun = Snap.select('#sun');    // SVG Sonne
    var sunburst = Snap.select('#sunburst'); // SVG Sunburst
    var outerSplashHolder = outerSVG.group(); // Für Regentropfen-Splash
    var outerLeafHolder = outerSVG.group();   // Für äußere Blätter
    var outerSnowHolder = outerSVG.group();   // Für äußeren Schnee (optional)

    // Unsere Referenzen (Vanilla JS)
    const cityInput = document.getElementById('city');
    const weatherResultDiv = document.getElementById('weather-result'); // Wird weniger genutzt, da #card jetzt Hauptanzeige ist
    const themeToggle = document.getElementById('theme-toggle');
    const autocompleteDropdown = document.getElementById('autocomplete-dropdown');
    const searchButton = document.getElementById('search-button');
    const locationButton = document.getElementById('location-button');
    const favoritesSelect = document.getElementById('favorites-select');
    const refreshButton = document.getElementById('refresh-button');

    // --- Konstanten & API Keys ---
    const GEOAPIFY_API_KEY = '6b73ef3534d24e6f9f9cbbd26bdf2e99';
    const FAVORITES_KEY = 'weatherAppFavorites';

    // --- Variablen für Zustand & Animation ---
    let autocompleteTimeout;
    let currentSuggestions = [];
    let manualOverrideActive = false;
    let currentCoords = null;
    let currentCityName = null;
    let currentApiData = null; // Speichert die letzten API-Daten

    var lightningTimeout;
    var sizes = { container: {width: 0, height: 0}, card: {width: 0, height: 0}, cardOffset: {top: 0, left: 0}}; // Kombiniert card.offset
    var clouds = [{group: Snap.select('#cloud1')}, {group: Snap.select('#cloud2')}, {group: Snap.select('#cloud3')}];
    // Angepasste Wettertypen-Liste (CodePen Original + Fog)
    var weatherTypes = [
        { type: 'snow', name: 'Schnee'},
        { type: 'wind', name: 'Windig'},
        { type: 'rain', name: 'Regen'},
        { type: 'thunder', name: 'Gewitter'},
        { type: 'fog', name: 'Nebel'}, // Neu
        { type: 'sun', name: 'Sonnig'} // Standard/Fallback
    ];
    var currentWeatherType = weatherTypes[5]; // Start mit 'sun'

    // GSAP animierbare Settings (aus CodePen)
    var settings = { windSpeed: 2, rainCount: 0, leafCount: 0, snowCount: 0, cloudHeight: 100, cloudSpace: 30, cloudArch: 50, renewCheck: 10, splashBounce: 80 };
    var tickCount = 0;
    var rain = [];
    var leafs = [];
    var snow = [];

    // --- Initialisierung ---
    function init() {
        onResize(); // Größen berechnen
        initializeTheme(); // Unser Theme-Management
        loadFavorites(); // Unsere Favoriten laden
        setupEventListeners(); // Unsere Event Listener
        // Keine Buttons zum Wetterwechsel mehr binden
        // Wolken zeichnen
        for(var i = 0; i < clouds.length; i++) {
            clouds[i].offset = Math.random() * sizes.card.width;
            drawCloud(clouds[i], i);
        }
        // Sonne initial ausblenden
        TweenMax.set(sun.node, { x: sizes.card.width / 2, y: -100 });
        TweenMax.set(sunburst.node, { opacity: 0 });
        // Initialen Zustand anzeigen (Prompt) oder Standort versuchen
        autoDetectLocation();
        // Animations-Loop starten
        requestAnimationFrame(tick);
    }

    // --- Event Listener Setup (Unsere Logik) ---
    function setupEventListeners() {
        cityInput.addEventListener('input', handleAutocompleteInput);
        cityInput.addEventListener('keydown', handleInputKeydown);
        searchButton.addEventListener('click', getWeatherByCityName);
        locationButton.addEventListener('click', () => getLocationWeather(false));
        themeToggle.addEventListener('click', toggleThemeManually);
        favoritesSelect.addEventListener('change', handleFavoriteSelection);
        refreshButton.addEventListener('click', handleRefresh);
        document.addEventListener('click', handleClickOutsideAutocomplete);
        document.addEventListener('keydown', handleEscapeKey);
        // Kein Klick-Handler mehr für die Karte nötig (kein Flip)
        $(window).resize(onResize); // CodePen's Resize Handler
    }

    // --- Resize Handler (aus CodePen, leicht angepasst) ---
    function onResize() {
        sizes.container.width = $container.width();
        sizes.container.height = $container.height();
        sizes.card.width = $card.width();
        sizes.card.height = $card.height();
        var cardOffsetJQ = $card.offset(); // jQuery offset
        sizes.cardOffset.top = cardOffsetJQ ? cardOffsetJQ.top : 0; // Sicherstellen, dass offset existiert
        sizes.cardOffset.left = cardOffsetJQ ? cardOffsetJQ.left : 0;

        innerSVG.attr({ width: sizes.card.width, height: sizes.card.height });
        outerSVG.attr({ width: sizes.container.width, height: sizes.container.height });
        backSVG.attr({ width: sizes.container.width, height: sizes.container.height });

        // Sunburst Position + Rotation (relativ zum Container)
        TweenMax.set(sunburst.node, { transformOrigin:"50% 50%", x: sizes.container.width / 2, y: (sizes.card.height/2) + sizes.cardOffset.top });
        // Sicherstellen, dass die Rotation weiterläuft, falls sie schon lief
        if (!TweenMax.isTweening(sunburst.node)) {
             TweenMax.fromTo(sunburst.node, 20, {rotation: 0}, {rotation: 360, repeat: -1, ease: Power0.easeInOut});
        }

        // Blatt-Maske anpassen
        leafMask.attr({x: sizes.cardOffset.left, y: 0, width: sizes.container.width - sizes.cardOffset.left, height: sizes.container.height});
        outerLeafHolder.attr({'clip-path': leafMask}); // Sicherstellen, dass Maske angewendet ist
    }

    // --- Cloud Drawing (aus CodePen) ---
    function drawCloud(cloud, i) {
        var space  = settings.cloudSpace * i;
        var height = space + settings.cloudHeight;
        var arch = height + settings.cloudArch + (Math.random() * settings.cloudArch);
        var width = sizes.card.width;
        var points = [];
        points.push('M' + [-(width), sizes.card.height].join(',')); // Start unten links
        points.push([width, sizes.card.height].join(','));        // Nach unten rechts
        points.push('Q' + [width * 2, height / 2 + sizes.card.height].join(',')); // Kontrollpunkt rechts
        points.push([width, height].join(','));                   // Oberer rechter Punkt der Wolke
        points.push('Q' + [width * 0.5, arch].join(','));         // Oberer Bogen rechts
        points.push([0, height].join(','));                      // Oberer mittlerer Punkt
        points.push('Q' + [width * -0.5, arch].join(','));        // Oberer Bogen links
        points.push([-width, height].join(','));                  // Oberer linker Punkt
        points.push('Q' + [- (width * 2), height/2 + sizes.card.height].join(',')); // Kontrollpunkt links
        points.push([-(width), sizes.card.height].join(','));     // Zurück zum Start

        var path = points.join(' ');
        if(!cloud.path) cloud.path = cloud.group.path();
        cloud.path.animate({ d: path }, 0); // Pfad sofort setzen
        // Positionieren (initial)
        cloud.group.transform('t' + cloud.offset + ',' + (sizes.card.height - height));
    }


    // --- Partikel Erstellung & Animation (Rain, Leaf, Snow - aus CodePen, angepasst) ---
    function makeRain() {
        var lineWidth = Math.random() * 3;
        var lineLength = currentWeatherType.type == 'thunder' ? 35 : 14;
        var x = Math.random() * (sizes.card.width - 40) + 20;
        // Wähle den richtigen Holder basierend auf Breite
        var holder = this['innerRainHolder' + (3 - Math.floor(lineWidth))];
        var line = holder.path('M0,0 0,' + lineLength).attr({
            fill: 'none',
            stroke: currentWeatherType.type == 'thunder' ? '#777' : '#005FFF', // Direktes Blau
            strokeWidth: lineWidth
        });
        rain.push(line);
        TweenMax.fromTo(line.node, 1, {x: x, y: 0- lineLength}, {delay: Math.random(), y: sizes.card.height, ease: Power2.easeIn, onComplete: onRainEnd, onCompleteParams: [line, lineWidth, x, currentWeatherType.type]});
    }

    function onRainEnd(line, width, x, type) {
        if (line && line.remove) line.remove(); // Sicherstellen, dass line existiert
        line = null;
        rain = rain.filter(item => item !== null && item.paper); // Array säubern
        if(rain.length < settings.rainCount) makeRain();
        if(width > 2) makeSplash(x, type);
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
            stroke: type == 'thunder' ? '#777' : '#005FFF', // Direktes Blau
            strokeWidth: 1
        });
        var pathLength = Snap.path.getTotalLength(splash);
        var xOffset = sizes.cardOffset.left;
        var yOffset = sizes.cardOffset.top + sizes.card.height;
        if(splash.node) splash.node.style.strokeDasharray = pathLength + ' ' + pathLength;

        TweenMax.fromTo(splash.node, speed, {strokeWidth: 2, y: yOffset, x: xOffset + x, opacity: 1, strokeDashoffset: pathLength}, {strokeWidth: 0, strokeDashoffset: - pathLength, opacity: 1, onComplete: onSplashComplete, onCompleteParams: [splash], ease:  SlowMo.ease.config(0.4, 0.1, false)})
    }

    function onSplashComplete(splash) {
        if (splash && splash.remove) splash.remove();
        splash = null;
    }

    function makeLeaf() {
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
            y = y + sizes.cardOffset.top / 2;
            endY = endY + sizes.cardOffset.top / 2;
            x = sizes.cardOffset.left - 100;
            xBezier = x + (sizes.container.width - sizes.cardOffset.left) / 2;
            endX = sizes.container.width + 50;
        } else {
            newLeaf = leaf.clone().appendTo(innerLeafHolder).attr({ fill: color });
            x = -100;
            xBezier = sizes.card.width / 2;
            endX = sizes.card.width + 50;
        }
        leafs.push(newLeaf);
        var bezier = [{x:x, y:y}, {x: xBezier, y:(Math.random() * endY) + (endY / 3)}, {x: endX, y:endY}];
        TweenMax.fromTo(newLeaf.node, 2 + Math.random() * 2, {rotation: Math.random()* 180, x: x, y: y, scale:scale}, {rotation: Math.random()* 360, bezier: bezier, onComplete: onLeafEnd, onCompleteParams: [newLeaf], ease: Power0.easeIn})
    }

    function onLeafEnd(leaf) {
        if (leaf && leaf.remove) leaf.remove();
        leaf = null;
        leafs = leafs.filter(item => item !== null && item.paper);
        if(leafs.length < settings.leafCount) makeLeaf();
    }

    function makeSnow() {
        var scale = 0.5 + (Math.random() * 0.5);
        var newSnow;
        var x = 20 + (Math.random() * (sizes.card.width - 40));
        var endY;
        var y = -10; // Start oben

        // Schnee immer innerhalb der Karte starten für Konsistenz
        newSnow = innerSnowHolder.circle(0, 0 ,5).attr({ fill: 'white' });
        endY = sizes.card.height + 10;
        y = settings.cloudHeight - 10; // Start unter den Wolken

        snow.push(newSnow);
        TweenMax.fromTo(newSnow.node, 3 + (Math.random() * 5), {x: x, y: y}, {y: endY, onComplete: onSnowEnd, onCompleteParams: [newSnow], ease: Power0.easeIn});
        TweenMax.fromTo(newSnow.node, 1,{scale: 0}, {scale: scale, ease: Power1.easeInOut});
        TweenMax.to(newSnow.node, 3, {x: x+((Math.random() * 150)-75), repeat: -1, yoyo: true, ease: Power1.easeInOut}); // Leichtes Wackeln
    }

    function onSnowEnd(flake) {
        if (flake && flake.remove) flake.remove();
        flake = null;
        snow = snow.filter(item => item !== null && item.paper);
        if(snow.length < settings.snowCount) makeSnow();
    }

    // --- Animations-Loop (Tick - aus CodePen, leicht angepasst) ---
    function tick() {
        tickCount++;
        var check = tickCount % settings.renewCheck;

        if(check) { // Nur alle 'renewCheck' Ticks prüfen
            // Prüfen, ob neue Partikel erstellt werden müssen
            if(rain.length < settings.rainCount) makeRain();
            if(leafs.length < settings.leafCount) makeLeaf();
            if(snow.length < settings.snowCount) makeSnow();
        }

        // Wolken bewegen
        for(var i = 0; i < clouds.length; i++) {
             var cloud = clouds[i];
             var newX;
             var cloudWidth = width = sizes.card.width; // Annahme: Wolkenbreite = Kartenbreite

             if(currentWeatherType.type == 'sun') { // Wolken schnell raus bei Sonne
                 if(cloud.offset < cloudWidth * 1.5) { // Nur bewegen, wenn sichtbar
                     cloud.offset += settings.windSpeed / (i + 1);
                 }
                 newX = cloud.offset;
                 // Kein Loop bei Sonne
             } else { // Normales Loopen
                 cloud.offset += settings.windSpeed / (i + 1);
                 if(cloud.offset >= cloudWidth) { // Wenn Wolke rechts raus ist
                     cloud.offset = cloud.offset - cloudWidth * 2; // Nach links setzen (Loop)
                 }
                  newX = cloud.offset;
             }
             // Wolke transformieren
             cloud.group.transform('t' + newX + ',' + (sizes.card.height - (settings.cloudSpace * i + settings.cloudHeight)));
        }

        requestAnimationFrame(tick);
    }

    // --- Wetterwechsel Logik (ANGEPASST an unsere API) ---

    // Mapping von Open-Meteo Codes zu CodePen Typen
    function mapWeatherCodeToType(code, windSpeed) {
        const wc = Number(code);
        const ws = Number(windSpeed); // Windgeschwindigkeit in km/h

        if (wc === 0 || wc === 1) return 'sun'; // Klar, überwiegend klar
        if (wc === 95 || wc === 96 || wc === 99) return 'thunder'; // Gewitter
        if ((wc >= 51 && wc <= 67) || (wc >= 80 && wc <= 82)) return 'rain'; // Regen, Niesel, Schauer
        if ((wc >= 71 && wc <= 77) || (wc >= 85 && wc <= 86) || wc === 66 || wc === 67 ) return 'snow'; // Schnee, Griesel, Eisregen, Schneeschauer
        if (wc === 45 || wc === 48) return 'fog'; // Nebel
        // Für Wolken oder Wind
        if (wc === 2 || wc === 3) { // Teilw. bewölkt, Bedeckt
             if (ws >= 25) return 'wind'; // Ab 25 km/h als windig werten
             else return 'cloud'; // Ansonsten nur bewölkt (kein eigener Typ im CP, nutzen wir für langsame Wolken)
        }
        // Fallback
        return 'sun';
    }


    function changeWeather(weatherTypeKey) {
        // Finde den passenden Typ aus unserer Liste
        var weatherData = weatherTypes.find(w => w.type === weatherTypeKey) || weatherTypes.find(w => w.type === 'sun'); // Fallback zu Sonne

        // Reset Klassen
        weatherTypes.forEach(w => $container.removeClass(w.type));
        // CodePen setzt die Klasse auf den .container
        $container.addClass(weatherData.type);

        currentWeatherType = weatherData; // Update globalen Zustand

        // Update Summary (Beschreibung)
        // Wird jetzt in renderWeatherData gemacht

        // --- Animate Settings using GSAP ---

        // windSpeed
        let targetWindSpeed = 0.5; // Default langsam
        if (weatherData.type === 'wind') targetWindSpeed = 5; // Schneller bei Wind
        if (weatherData.type === 'sun') targetWindSpeed = 10; // Raus bei Sonne
        if (weatherData.type === 'thunder') targetWindSpeed = 0.8; // Bei Gewitter eher ruhig
        TweenMax.to(settings, 3, {windSpeed: targetWindSpeed, ease: Power2.easeInOut});

        // rainCount
        let targetRainCount = 0;
        if (weatherData.type === 'rain') targetRainCount = 20; // Angepasste Menge
        if (weatherData.type === 'thunder') targetRainCount = 50; // Mehr bei Gewitter
        TweenMax.to(settings, 3, {rainCount: targetRainCount, ease: Power2.easeInOut});

        // leafCount (für Wind-Effekt)
        let targetLeafCount = 0;
        if (weatherData.type === 'wind') targetLeafCount = 7;
        TweenMax.to(settings, 3, {leafCount: targetLeafCount, ease: Power2.easeInOut});

        // snowCount
        let targetSnowCount = 0;
        if (weatherData.type === 'snow') targetSnowCount = 30; // Angepasste Menge
        TweenMax.to(settings, 3, {snowCount: targetSnowCount, ease: Power2.easeInOut});

        // Sun Position & Sunburst
        if (weatherData.type === 'sun') {
            TweenMax.to(sun.node, 4, {x: sizes.card.width / 2, y: sizes.card.height * 0.35, // Höher positionieren
                opacity: 1, ease: Power2.easeInOut});
            TweenMax.to(sunburst.node, 4, {scale: 1, opacity: 0.8, y: (sizes.card.height * 0.35) + sizes.cardOffset.top, ease: Power2.easeInOut});
        } else {
            TweenMax.to(sun.node, 2, {y: -100, opacity: 0, ease: Power2.easeIn}); // Schneller ausblenden
            TweenMax.to(sunburst.node, 2, {scale: 0.4, opacity: 0, y: (sizes.container.height/2)-50, ease: Power2.easeIn});
        }

        // Lightning Timer
        startLightningTimer();
    }

    // --- Blitz-Funktionen (aus CodePen) ---
    function startLightningTimer() {
        if(lightningTimeout) clearTimeout(lightningTimeout);
        if(currentWeatherType.type == 'thunder') {
            lightningTimeout = setTimeout(lightning, Math.random()*6000 + 2000); // Mindestens 2 Sek Pause
        }
    }

    function lightning() {
        startLightningTimer();
        TweenMax.fromTo($card, 0.75, {y: -10}, {y:0, ease:Elastic.easeOut}); // Kleineres Wackeln
        var pathX = 30 + Math.random() * (sizes.card.width - 60);
        var yOffset = 20; var steps = 20; var points = [pathX + ',0'];
        for(var i = 0; i < steps; i++) {
            var x = pathX + (Math.random() * yOffset - (yOffset / 2));
            var y = (sizes.card.height / steps) * (i + 1);
            points.push(x + ',' + y);
        }
        var strike = innerLightningHolder.path('M' + points.join(' ')).attr({
            fill: 'none', stroke: 'white', strokeWidth: 2 + Math.random()
        });
        TweenMax.to(strike.node, 1, {opacity: 0, ease:Power4.easeOut, onComplete: function(){ if(strike) strike.remove(); strike = null}});
    }

    // --- Unsere API & Rendering Logik ---

    // Helper zum Anzeigen von Loading/Error States
    function showOverlayMessage(type, message) {
         // Entferne evtl. vorhandene Overlays
         $('.loading-state, .error-state, .initial-prompt').remove();
         // Erstelle neues Overlay
         const iconClass = type === 'loading' ? 'fa-spinner fa-spin' : (type === 'error' ? 'fa-triangle-exclamation' : 'fa-map-location-dot');
         const divClass = type + '-state';
         const html = `<div class="${divClass}"> <i class="fas ${iconClass}"></i> <div>${message}</div> </div>`;
         // Füge es zum Card-Container hinzu
         $card.append(html);
    }
    function hideOverlayMessage() {
         $('.loading-state, .error-state, .initial-prompt').remove();
    }


    function renderWeatherData(locationName, weatherData) {
         hideOverlayMessage(); // Loading/Error ausblenden
         const { current, hourly, daily } = weatherData;
         currentApiData = weatherData; // Daten speichern für Refresh

         // 1. Hauptinfos aktualisieren
         $location.text(locationName);
         $temp.html(`${Math.round(current.temperature_2m)}<span>°C</span>`); // CodePen hat ° hardcodiert, wir C
         $description.text(getWeatherCondition(current.weathercode).desc);
         $date.text(new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }));
         $feelsLike.text(`Gefühlt: ${Math.round(current.apparent_temperature)}°`);

         // 2. Details Grid neu erstellen
         const detailsHTML = `
            <div class="details-grid">
                <div class="detail-item"> <div class="label"><i class="fas fa-temperature-high"></i> Max</div> <div class="value">${Math.round(daily.temperature_2m_max[0] ?? '--')}°</div> </div>
                <div class="detail-item"> <div class="label"><i class="fas fa-temperature-low"></i> Min</div> <div class="value">${Math.round(daily.temperature_2m_min[0] ?? '--')}°</div> </div>
                <div class="detail-item"> <div class="label"><i class="fas fa-wind"></i> Wind</div> <div class="value"> ${Math.round(current.windspeed_10m)}<span class="unit">km/h</span> <i class="fas fa-location-arrow wind-dir-icon" style="transform: rotate(${current.winddirection_10m - 45}deg);" title="${current.winddirection_10m}°"></i> </div> </div>
                <div class="detail-item"> <div class="label"><i class="fas fa-tint"></i> Feuchte</div> <div class="value">${current.relativehumidity_2m}<span class="unit">%</span></div> </div>
                <div class="detail-item"> <div class="label"><i class="fas fa-cloud-showers-heavy"></i> Niederschl.</div> <div class="value">${current.precipitation}<span class="unit">mm</span></div> </div>
                 <div class="detail-item"> <div class="label"><i class="fas fa-sun"></i> UV-Index</div> <div class="value">${Math.round(current.uv_index ?? 0)} <span class="unit uv-desc">${getUVDescription(current.uv_index)}</span></div> </div>
            </div>`;
         $detailsGridPlaceholder.html(detailsHTML);

         // 3. Wetter-Animation triggern
         const mappedType = mapWeatherCodeToType(current.weathercode, current.windspeed_10m);
         changeWeather(mappedType);

         // 4. Favoriten-Button Status
         const favorites = getFavorites();
         const isFavorite = favorites.some(fav => fav.lat === currentCoords?.lat && fav.lon === currentCoords?.lon);
         updateFavoriteButtonState(isFavorite);
    }
     // Hilfsfunktion für UV-Beschreibung
    const getUVDescription = (uv) => { if (uv===null || uv===undefined) return ''; const rUv=Math.round(uv); if (rUv <= 2) return 'Niedrig'; if (rUv <= 5) return 'Mittel'; if (rUv <= 7) return 'Hoch'; if (rUv <= 10) return 'Sehr hoch'; return 'Extrem'; };


    // --- API Call & Datenverarbeitung (Unsere Logik, angepasst) ---
    async function getWeatherFromCoords(lat, lon, locationName) {
        currentCoords = { lat, lon }; currentCityName = locationName;
        showOverlayMessage('loading', `Lade Wetter für ${locationName}...`);
        // Stoppe existierende Animationen sanft
        TweenMax.to(settings, 1, { rainCount: 0, leafCount: 0, snowCount: 0 });

        const params = [ `latitude=${lat.toFixed(4)}`,`longitude=${lon.toFixed(4)}`, 'current=temperature_2m,relativehumidity_2m,apparent_temperature,is_day,precipitation,weathercode,surface_pressure,windspeed_10m,winddirection_10m,uv_index', 'daily=weathercode,temperature_2m_max,temperature_2m_min,sunrise,sunset', // Vereinfacht, da Vorhersage nicht angezeigt wird
                        'temperature_unit=celsius', 'windspeed_unit=kmh', 'precipitation_unit=mm', 'timezone=auto', 'forecast_days=1' ]; // Nur 1 Tag reicht
        const apiUrl = `https://api.open-meteo.com/v1/forecast?${params.join('&')}`;

        try {
            const r = await fetch(apiUrl);
            if (!r.ok) { const eD = await r.json().catch(() => ({})); throw new Error(`Open-Meteo Fehler: ${r.status} ${eD.reason || ''}`); }
            const d = await r.json();
            if (!d.current || !d.daily) throw new Error('Unvollständige Wetterdaten empfangen.');
            renderWeatherData(locationName, d); // Ruft auch changeWeather auf
        } catch (error) {
            console.error('Fehler beim Abrufen/Verarbeiten der Wetterdaten:', error);
            handleFetchError(error);
        }
    }

    // --- Initial Prompt / Error States (Angepasst) ---
    function showInitialPrompt() {
        showOverlayMessage('initial', 'Gib eine Stadt ein oder nutze deinen Standort.');
        currentCoords = null; currentCityName = null; currentApiData = null;
        updateFavoriteButtonState(false);
        changeWeather('sun'); // Zeige Sonne als Default
    }
    function showError(message) {
        showOverlayMessage('error', message);
        currentCoords = null; currentCityName = null; currentApiData = null;
        changeWeather('sun'); // Zeige Sonne als Fallback
    }

    // --- Restliche Hilfsfunktionen (Unsere: Autocomplete, Favoriten, Theme etc.) ---
    // Theme
    function initializeTheme() { const pL = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches; if (pL) applyLightTheme(); else applyDarkTheme(); updateThemeToggleIcon(); if (window.matchMedia) { const q = window.matchMedia('(prefers-color-scheme: light)'); q.addEventListener('change', (e) => { if (!manualOverrideActive) { if (e.matches) applyLightTheme(); else applyDarkTheme(); updateThemeToggleIcon(); handleRefresh(); } }); } }
    function toggleThemeManually() { manualOverrideActive = true; const iL = document.body.classList.contains('light-theme'); if (iL) applyDarkTheme(); else applyLightTheme(); updateThemeToggleIcon(); handleRefresh(); }
    function applyLightTheme() { document.body.classList.add('light-theme'); } function applyDarkTheme() { document.body.classList.remove('light-theme'); }
    function updateThemeToggleIcon() { themeToggle.innerHTML = document.body.classList.contains('light-theme') ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>'; themeToggle.setAttribute('aria-label', document.body.classList.contains('light-theme') ? 'Dark Mode' : 'Light Mode'); }
    // Favoriten
    function getFavorites() { const f = localStorage.getItem(FAVORITES_KEY); return f ? JSON.parse(f) : []; }
    function saveFavorites(f) { localStorage.setItem(FAVORITES_KEY, JSON.stringify(f)); loadFavorites(); }
    function loadFavorites() { const f = getFavorites(); favoritesSelect.innerHTML = '<option value="">Favoriten...</option>'; f.forEach((fav, i) => { const o = document.createElement('option'); o.value = i; o.textContent = fav.name; favoritesSelect.appendChild(o); }); }
    function addFavorite(n, la, lo) { if (!n || la === null || lo === null) return; const f = getFavorites(); if (!f.some(fav => fav.lat === la && fav.lon === lo)) { f.push({ name: n, lat: la, lon: lo }); saveFavorites(f); updateFavoriteButtonState(true); } }
    function handleFavoriteSelection() { const i = favoritesSelect.value; if (i === "") return; const f = getFavorites(); const s = f[parseInt(i)]; if (s) { cityInput.value = s.name; getWeatherFromCoords(s.lat, s.lon, s.name); } favoritesSelect.value = ""; }
    function updateFavoriteButtonState(isFav) { const b = $('#add-favorite-button'); if (b.length) { b.toggleClass('is-favorite', isFav); b.html(isFav ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>'); b.attr('title', isFav ? 'Aus Favoriten entfernen (n.i.)' : 'Zu Favoriten hinzufügen'); } } // Favorit Button fehlt noch in HTML!
    // Refresh
    function handleRefresh() { if (currentCoords && currentApiData) { renderWeatherData(currentCityName, currentApiData); /* Re-render mit letzten Daten */ } else if (currentCoords) { getWeatherFromCoords(currentCoords.lat, currentCoords.lon, currentCityName); /* API neu holen */ } else { getLocationWeather(false); } }
    // Autocomplete
    function handleAutocompleteInput(e) { clearTimeout(autocompleteTimeout); const s = e.target.value.trim(); if (s.length < 2) { hideAutocomplete(); return; } autocompleteTimeout = setTimeout(async () => { try { const r = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(s)}&type=city&lang=de&limit=5&format=json&apiKey=${GEOAPIFY_API_KEY}`); if (!r.ok) throw Error(); const d = await r.json(); currentSuggestions = d.results || []; showAutocompleteSuggestions(currentSuggestions); } catch (err) { hideAutocomplete(); } }, 300); }
    function showAutocompleteSuggestions(suggestions) { if (!suggestions || suggestions.length === 0) { hideAutocomplete(); return; } autocompleteDropdown.innerHTML = suggestions.map(s => { const c = s.city || s.name || s.address_line1; const co = s.country; const dn = c && co ? `${c}, ${co}` : s.formatted; return `<div class="autocomplete-item" data-lat="${s.lat}" data-lon="${s.lon}" data-name="${dn}">${highlightMatch(dn, cityInput.value)}</div>`; }).join(''); $(autocompleteDropdown).find('.autocomplete-item').on('click', function() { const n = $(this).data('name'); const la = parseFloat($(this).data('lat')); const lo = parseFloat($(this).data('lon')); cityInput.value = n; hideAutocomplete(); cityInput.blur(); getWeatherFromCoords(la, lo, n); }); autocompleteDropdown.style.display = 'block'; }
    function hideAutocomplete() { autocompleteDropdown.style.display = 'none'; autocompleteDropdown.innerHTML = ''; currentSuggestions = []; }
    function handleInputKeydown(e) { if (e.key === 'Enter') { e.preventDefault(); if (autocompleteDropdown.style.display === 'block' && currentSuggestions.length > 0) { $(autocompleteDropdown).find('.autocomplete-item').first().trigger('click'); } else { hideAutocomplete(); getWeatherByCityName(); } cityInput.blur(); } else if (e.key === 'Escape') { hideAutocomplete(); } }
    function handleClickOutsideAutocomplete(e) { if (!$(e.target).closest('.autocomplete-container').length) { hideAutocomplete(); } }
    function handleEscapeKey(e) { if (e.key === 'Escape') hideAutocomplete(); }
    function highlightMatch(text, query) { if (!query || !text) return text || ''; const eq = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const rgx = new RegExp(`(${eq})`, 'gi'); return text.replace(rgx, '<b>$1</b>'); }
    // Geolocation & API Fetch
    async function getWeatherByCityName() { const city = cityInput.value.trim(); if (!city) { showError('Bitte gib einen Stadtnamen ein.'); return; } showOverlayMessage('loading', 'Suche Stadt...'); hideAutocomplete(); try { const geoR = await fetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(city)}&limit=1&lang=de&format=json&apiKey=${GEOAPIFY_API_KEY}`); if (!geoR.ok) throw new Error(`Geoapify Fehler`); const geoD = await geoR.json(); if (!geoD.results || geoD.results.length === 0) throw new Error(`Stadt "${city}" nicht gefunden.`); const { lat, lon, formatted } = geoD.results[0]; const locN = geoD.results[0].city || formatted; await getWeatherFromCoords(lat, lon, locN); } catch (error) { handleFetchError(error); } }
    async function getLocationWeather(isAutoDetect = false) { if (!navigator.geolocation) { showError('Geolocation nicht unterstützt.'); return; } showOverlayMessage('loading', 'Ermittle Standort...'); navigator.geolocation.getCurrentPosition( async (pos) => { const { latitude, longitude } = pos.coords; try { const revGeoR = await fetch(`https://api.geoapify.com/v1/geocode/reverse?lat=${latitude}&lon=${longitude}&lang=de&format=json&apiKey=${GEOAPIFY_API_KEY}`); let locN = `Lat ${latitude.toFixed(2)}, Lon ${longitude.toFixed(2)}`; if (revGeoR.ok) { const locD = await revGeoR.json(); if (locD.results?.length > 0) locN = locD.results[0].city || locD.results[0].village || locD.results[0].suburb || locD.results[0].formatted; } await getWeatherFromCoords(latitude, longitude, locN); } catch (error) { await getWeatherFromCoords(latitude, longitude, `Lat ${latitude.toFixed(2)}, Lon ${longitude.toFixed(2)}`); } }, (err) => { if (!isAutoDetect) handleGeolocationError(err); else showInitialPrompt(); }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }); }
    async function autoDetectLocation() { if (!navigator.geolocation || !navigator.permissions) { showInitialPrompt(); return; } try { const perm = await navigator.permissions.query({ name: 'geolocation' }); if (perm.state === 'granted') getLocationWeather(true); else showInitialPrompt(); perm.onchange = () => { if (perm.state === 'granted' && $('.initial-prompt, .error-state').length) getLocationWeather(true); else if (perm.state !== 'granted' && $('.loading-state').length) showInitialPrompt(); }; } catch (error) { showInitialPrompt(); } }
    function handleGeolocationError(error) { let msg = 'Standort nicht ermittelt.'; if(error.code===1) msg='Zugriff verweigert.'; if(error.code===2) msg='Position nicht verfügbar.'; if(error.code===3) msg='Timeout.'; showError(msg); }
    function handleFetchError(error) { let msg = 'Fehler.'; if(error.message.includes('Stadt')&&error.message.includes('gefunden')) msg=error.message; else if(error.message.toLowerCase().includes('fetch')||error.message.toLowerCase().includes('network')) msg='Netzwerkfehler.'; else if(error.message.includes('API')||error.message.includes('Fehler')) msg='API Problem.'; else if(error.message.includes('Unvollständige')) msg='Daten unvollständig.'; console.error("Fetch Error:", error); showError(msg); }


    // --- App Start ---
    init();

}); // Ende jQuery ready
