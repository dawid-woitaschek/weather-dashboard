// script.js - Finale Version

$(document).ready(function() {

    // Globale Variablen und Selektoren
    var container = $('.container');
    var card = $('#card');
    var innerSVG = Snap('#inner');
    var outerSVG = Snap('#outer');
    var backSVG = Snap('#back');
    var summary = $('#summary');
    var date = $('#date');
    var temp = $('.temp');
    var locationDisplay = $('#location-display');
    var locationInput = $('#location-search');
    var suggestionsDiv = $('#suggestions');
    var searchButton = $('#search-button');
    var currentLocationButton = $('#current-location-button');

    var weatherContainer1 = Snap.select('#layer1');
    var weatherContainer2 = Snap.select('#layer2');
    var weatherContainer3 = Snap.select('#layer3');
    // Sicherstellen, dass Gruppen korrekt initialisiert werden, falls SVG-Elemente nicht sofort bereit sind
    var innerRainHolder1 = weatherContainer1 ? weatherContainer1.group() : null;
    var innerRainHolder2 = weatherContainer2 ? weatherContainer2.group() : null;
    var innerRainHolder3 = weatherContainer3 ? weatherContainer3.group() : null;
    var innerLeafHolder = weatherContainer1 ? weatherContainer1.group() : null;
    var innerSnowHolder = weatherContainer1 ? weatherContainer1.group() : null;
    var innerLightningHolder = weatherContainer1 ? weatherContainer1.group() : null;

    var leafMask = outerSVG.rect();
    var leaf = Snap.select('#leaf');
    var sun = Snap.select('#sun');
    var sunburst = Snap.select('#sunburst');
    var outerSplashHolder = outerSVG.group();
    var outerLeafHolder = outerSVG.group();
    var outerSnowHolder = outerSVG.group();

    var lightningTimeout;
    var currentCoords = { lat: 51.5136, lon: 7.4653 }; // Default: Dortmund
    var currentPlaceName = "Dortmund, Deutschland"; // Default Place Name
    var geoapifyApiKey = "6b73ef3534d24e6f9f9cbbd26bdf2e99"; // Dein API Key

    // Objekt für Größen, wird später aktualisiert
    var sizes = {
        container: {width: 0, height: 0},
        card: {width: 0, height: 0},
        offset: {top: 0, left: 0}
    };

    // Cloud-Gruppen holen
    var clouds = [
        {group: Snap.select('#cloud1')},
        {group: Snap.select('#cloud2')},
        {group: Snap.select('#cloud3')}
    ];

    // App-Einstellungen (animierbar)
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

    // ------------------- INIT & RESIZE -------------------

    function init() {
        onResize(); // Call resize once to set initial sizes

        // Clouds zeichnen (mit Check, ob group existiert)
        for(var i = 0; i < clouds.length; i++) {
            if (clouds[i] && clouds[i].group) {
                clouds[i].offset = Math.random() * sizes.card.width;
                drawCloud(clouds[i], i);
            }
        }

        // Event Listeners für Suche und Geolocation
        locationInput.on('input', handleInputChange);
        locationInput.on('keydown', handleInputKeydown);
        searchButton.on('click', triggerSearchFromInput);
        currentLocationButton.on('click', getCurrentLocationWeather);
        $('body').on('click', function(e) { // Hide suggestions when clicking outside
             if (!$(e.target).closest('.search-container').length) {
                suggestionsDiv.hide();
            }
        });

        // Initiales Wetter für den Standardort laden
        fetchWeather(currentCoords.lat, currentCoords.lon, currentPlaceName);

        // Start animations
        requestAnimationFrame(tick);
    }

    function onResize() {
        // Fenster- und Kartengrößen holen
        sizes.container.width = $(document).width();
        sizes.container.height = $(document).height();
        sizes.card.width = card.width();
        sizes.card.height = card.height();
        var cardOffset = card.offset();
        sizes.offset.top = cardOffset ? cardOffset.top : 0; // Check if offset exists
        sizes.offset.left = cardOffset ? cardOffset.left : 0;

        // SVG-Größen aktualisieren
        innerSVG.attr({ width: sizes.card.width, height: sizes.card.height });
        outerSVG.attr({ width: sizes.container.width, height: sizes.container.height });
        backSVG.attr({ width: sizes.container.width, height: sizes.container.height });

        // Sonnenstrahlen-Position und Animation aktualisieren
        gsap.set(sunburst.node, {
            transformOrigin:"50% 50%",
            x: sizes.container.width / 2,
            y: sizes.offset.top + (sizes.card.height / 2)
        });
        if (sunburst.node && !gsap.isTweening(sunburst.node)) { // Prüfen ob sunburst.node existiert
             gsap.fromTo(sunburst.node, 20, {rotation: 0}, {rotation: 360, repeat: -1, ease: 'none'});
        }

        // Blatt-Maske
        leafMask.attr({
             x: sizes.offset.left + sizes.card.width,
             y: 0,
             width: Math.max(0, sizes.container.width - (sizes.offset.left + sizes.card.width)), // Ensure width is not negative
             height: sizes.container.height
         });

        // Sonnenposition bei Resize anpassen
        if (container.hasClass('sun')) {
            if (sun.node) { // Prüfen ob sun.node existiert
                gsap.to(sun.node, 0.5, {
                    x: sizes.card.width / 2,
                    y: sizes.card.height / 2, // Center sun vertically in card
                    ease: Power2.easeInOut
                });
            }
            if (sunburst.node) { // Prüfen ob sunburst.node existiert
                gsap.to(sunburst.node, 0.5, {
                    scale: 1,
                    opacity: 0.8,
                    y: sizes.offset.top + (sizes.card.height / 2),
                    ease: Power2.easeInOut
                });
            }
        } else {
             if (sunburst.node) { // Prüfen ob sunburst.node existiert
                 gsap.to(sunburst.node, 0.5, {
                     y: sizes.offset.top + (sizes.card.height / 2) - 50,
                     ease: Power2.easeInOut
                 });
             }
        }
    }

    $(window).resize(onResize);

    // ------------------- WETTER-API & STANDORTSUCHE -------------------

    function handleInputChange() {
        const query = $(this).val();
        if (query.length >= 3) {
            fetchSuggestions(query);
        } else {
            suggestionsDiv.hide().empty();
        }
    }

     function handleInputKeydown(e) {
        if (e.key === 'Enter') {
            e.preventDefault(); // Verhindert ggf. Formular-Submit
            const firstSuggestion = suggestionsDiv.find('div:first-child');
            if (firstSuggestion.length && suggestionsDiv.is(":visible")) {
                selectSuggestion(firstSuggestion.data('lat'), firstSuggestion.data('lon'), firstSuggestion.text());
            } else {
                 triggerSearchFromInput(); // Trigger search even without visible suggestion
            }
            suggestionsDiv.hide().empty(); // Hide suggestions after Enter
        } else if (e.key === 'Escape') {
             suggestionsDiv.hide().empty();
        }
    }

    function triggerSearchFromInput() {
         const firstSuggestion = suggestionsDiv.find('div:first-child');
         if (firstSuggestion.length && suggestionsDiv.is(":visible")) {
             selectSuggestion(firstSuggestion.data('lat'), firstSuggestion.data('lon'), firstSuggestion.text());
         } else if (locationInput.val().length >= 1) { // Erlaube Suche auch bei weniger als 3 Zeichen manuell
             fetchSuggestions(locationInput.val(), true); // Try fetching and auto-selecting first
         } else {
             showError("Bitte einen Ort eingeben.");
         }
         suggestionsDiv.hide();
    }


    function fetchSuggestions(query, autoSelectFirst = false) {
        const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&type=city&lang=de&limit=5&apiKey=${geoapifyApiKey}`; // type=city hinzugefügt

        fetch(url)
            .then(response => response.json())
            .then(data => {
                suggestionsDiv.empty().show();
                if (data.features && data.features.length > 0) {
                    if (autoSelectFirst) {
                         const first = data.features[0].properties;
                         selectSuggestion(first.lat, first.lon, first.formatted);
                         return;
                    }
                    data.features.forEach(feature => {
                        const properties = feature.properties;
                        // Versuche, einen besseren Namen zu extrahieren
                        let displayName = properties.formatted;
                        if (properties.city && properties.country) {
                            displayName = `${properties.city}, ${properties.country}`;
                        } else if (properties.name && properties.country) { // Fallback auf 'name'
                            displayName = `${properties.name}, ${properties.country}`;
                        }

                        const div = $('<div>')
                            .text(displayName)
                            .data('lat', properties.lat)
                            .data('lon', properties.lon)
                            .on('click', function() {
                                selectSuggestion($(this).data('lat'), $(this).data('lon'), $(this).text());
                            });
                        suggestionsDiv.append(div);
                    });
                } else {
                    suggestionsDiv.append('<div>Keine Orte gefunden</div>');
                }
            })
            .catch(error => {
                console.error('Error fetching Geoapify suggestions:', error);
                suggestionsDiv.empty().show().append('<div>Fehler bei der Suche</div>');
            });
    }

    function selectSuggestion(lat, lon, name) {
        currentCoords = { lat, lon };
        currentPlaceName = name;
        locationInput.val(name);
        suggestionsDiv.hide().empty();
        fetchWeather(lat, lon, name);
    }

    function getCurrentLocationWeather() {
        if (navigator.geolocation) {
            locationInput.val("Standort wird ermittelt...");
            navigator.geolocation.getCurrentPosition(position => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                fetchReverseGeocode(lat, lon);

            }, error => {
                console.error("Geolocation error:", error);
                let errorMsg = "Standort konnte nicht abgerufen werden.";
                if (error.code === 1) errorMsg = "Zugriff auf Standort verweigert.";
                if (error.code === 2) errorMsg = "Standortinformationen nicht verfügbar.";
                if (error.code === 3) errorMsg = "Timeout bei Standortabfrage.";
                alert(errorMsg + " Zeige Standardort.");
                locationInput.val("");
                fetchWeather(currentCoords.lat, currentCoords.lon, currentPlaceName); // Fallback
            });
        } else {
            alert("Geolocation wird von diesem Browser nicht unterstützt.");
            fetchWeather(currentCoords.lat, currentCoords.lon, currentPlaceName); // Fallback
        }
    }

    function fetchReverseGeocode(lat, lon) {
         const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&apiKey=${geoapifyApiKey}&lang=de`;
         fetch(url)
            .then(response => response.json())
            .then(data => {
                let placeName = "Aktueller Standort";
                 if (data.features && data.features.length > 0) {
                     const props = data.features[0].properties;
                     if (props.city && props.country) { placeName = `${props.city}, ${props.country}`; }
                     else if (props.village && props.country) { placeName = `${props.village}, ${props.country}`; } // Dorf statt Stadt
                     else if (props.suburb && props.city) { placeName = `${props.suburb}, ${props.city}`; }
                     else if (props.county && props.country) { placeName = `${props.county}, ${props.country}`; }
                     else if (props.formatted) { placeName = props.formatted; }
                 }
                 currentCoords = { lat, lon };
                 currentPlaceName = placeName;
                 locationInput.val(placeName);
                 fetchWeather(lat, lon, placeName);
            })
            .catch(error => {
                 console.error("Reverse geocoding error:", error);
                 locationInput.val("Aktueller Standort");
                 fetchWeather(lat, lon, "Aktueller Standort");
            });
    }

    // Funktion zum Anzeigen von Fehlern im UI
    function showError(message) {
         console.warn("showError called with:", message); // Logging
         summary.text(message);
         temp.html('--<span>°C</span>');
         // Setze auf einen neutralen visuellen Zustand zurück
         resetVisuals();
         container.addClass('overcast'); // Zeige z.B. bedeckten Himmel als Fehlerzustand
    }

    // API Call an Open-Meteo
    function fetchWeather(lat, lon, name) {
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lon);

        console.log(`Fetching weather for: Name=${name}, Lat=${lat} (${typeof lat}), Lon=${lon} (${typeof lon})`);

        if (isNaN(latitude) || isNaN(longitude)) {
            console.error("Invalid coordinates for fetchWeather:", lat, lon);
            showError("Ungültige Koordinaten.");
            return;
        }

        const formattedLat = latitude.toFixed(4);
        const formattedLon = longitude.toFixed(4);

        // URL mit korrekten Parametern und '&'
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${formattedLat}&longitude=${formattedLon}¤t=temperature_2m,weathercode,windspeed_10m&temperature_unit=celsius&windspeed_unit=kmh&timezone=auto`;
        console.log(`Request URL: ${url}`);

        // UI auf Laden setzen
        summary.text('Lädt...');
        temp.html('--<span>°C</span>');
        locationDisplay.text(name || "...");

        fetch(url)
            .then(response => {
                 if (!response.ok) {
                     // Werfe Fehler, der im .catch behandelt wird
                     throw new Error(`HTTP error ${response.status}`);
                 }
                 return response.json();
            })
            .then(data => {
                // Prüfe, ob erwartete Datenstruktur vorhanden ist
                if (data && data.current && typeof data.current.temperature_2m !== 'undefined' && typeof data.current.weathercode !== 'undefined') {
                    // Erstelle das Objekt, das von updateUI erwartet wird
                    const weather = {
                        temperature: data.current.temperature_2m,
                        weathercode: data.current.weathercode,
                        windspeed: data.current.windspeed_10m // Windspeed für Mapping übergeben
                    };
                    updateUI(weather, name);
                } else {
                    console.error("Invalid or incomplete data received from Open-Meteo:", data);
                    showError("Wetterdaten unvollständig.");
                }
            })
            .catch(error => {
                console.error('Error during fetchWeather:', error);
                showError(`API Fehler (${error.message || 'Unbekannt'})`);
            });
    }


    // ------------------- UI UPDATE & WETTER-MAPPING -------------------

    function updateUI(weatherData, placeName) {
        // Temperatur aktualisieren
        const temperature = Math.round(weatherData.temperature);
        temp.html(`${temperature}<span>°C</span>`);

        // Datum aktualisieren
        const now = new Date();
        const formattedDate = now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
        date.text(formattedDate);

        // Ort anzeigen
        locationDisplay.text(placeName);

        // Wettercode mappen und Animation/Text aktualisieren
        // Übergebe Windgeschwindigkeit für genaueres Mapping
        mapWeatherCodeToVisuals(weatherData.weathercode, weatherData.windspeed);
    }

    function mapWeatherCodeToVisuals(code, windSpeed) {
        let theme = 'sun'; // Default
        let summaryText = 'Unbekannt';
        let baseWindSpeed = 0.5; // Grund-Windgeschwindigkeit für Animation
        let rainCount = 0;
        let snowCount = 0;
        let leafCount = 0;

        // Mapping basierend auf WMO Codes
        switch (code) {
            case 0: theme = 'sun'; summaryText = 'Klarer Himmel'; baseWindSpeed = 10; break;
            case 1: theme = 'sun'; summaryText = 'Meist klar'; baseWindSpeed = 8; break;
            case 2: theme = 'overcast'; summaryText = 'Teilweise bewölkt'; baseWindSpeed = 1; break;
            case 3: theme = 'overcast'; summaryText = 'Bedeckt'; baseWindSpeed = 0.5; break;
            case 45: theme = 'overcast'; summaryText = 'Nebel'; baseWindSpeed = 0.2; break; // Eigene Klasse für Nebel-Styling?
            case 48: theme = 'overcast'; summaryText = 'Reifnebel'; baseWindSpeed = 0.2; break;
            case 51: theme = 'rain'; summaryText = 'Leichter Nieselregen'; rainCount = 5; break;
            case 53: theme = 'rain'; summaryText = 'Mäßiger Nieselregen'; rainCount = 10; break;
            case 55: theme = 'rain'; summaryText = 'Starker Nieselregen'; rainCount = 20; break;
            case 56: theme = 'snow'; summaryText = 'Leichter gefrierender Nieselregen'; snowCount = 10; break; // Besser als 'snow'
            case 57: theme = 'snow'; summaryText = 'Dichter gefrierender Nieselregen'; snowCount = 20; break;
            case 61: theme = 'rain'; summaryText = 'Leichter Regen'; rainCount = 10; baseWindSpeed = 1; break;
            case 63: theme = 'rain'; summaryText = 'Mäßiger Regen'; rainCount = 30; baseWindSpeed = 1.5; break;
            case 65: theme = 'rain'; summaryText = 'Starker Regen'; rainCount = 60; baseWindSpeed = 2; break;
            case 66: theme = 'snow'; summaryText = 'Leichter gefrierender Regen'; snowCount = 20; baseWindSpeed = 1; break;
            case 67: theme = 'snow'; summaryText = 'Starker gefrierender Regen'; snowCount = 40; baseWindSpeed = 1.5; break;
            case 71: theme = 'snow'; summaryText = 'Leichter Schneefall'; snowCount = 15; baseWindSpeed = 0.5; break;
            case 73: theme = 'snow'; summaryText = 'Mäßiger Schneefall'; snowCount = 30; baseWindSpeed = 1; break;
            case 75: theme = 'snow'; summaryText = 'Starker Schneefall'; snowCount = 50; baseWindSpeed = 1.5; break;
            case 77: theme = 'snow'; summaryText = 'Schneegriesel'; snowCount = 20; break;
            case 80: theme = 'rain'; summaryText = 'Leichte Regenschauer'; rainCount = 15; baseWindSpeed = 1.5; break;
            case 81: theme = 'rain'; summaryText = 'Mäßige Regenschauer'; rainCount = 35; baseWindSpeed = 2; break;
            case 82: theme = 'rain'; summaryText = 'Heftige Regenschauer'; rainCount = 60; baseWindSpeed = 2.5; break;
            case 85: theme = 'snow'; summaryText = 'Leichte Schneeschauer'; snowCount = 20; baseWindSpeed = 1.5; break;
            case 86: theme = 'snow'; summaryText = 'Starke Schneeschauer'; snowCount = 40; baseWindSpeed = 2; break;
            case 95: theme = 'thunder'; summaryText = 'Gewitter'; rainCount = 40; baseWindSpeed = 2.5; break;
            case 96: theme = 'thunder'; summaryText = 'Gewitter mit leichtem Hagel'; rainCount = 50; baseWindSpeed = 3; break;
            case 99: theme = 'thunder'; summaryText = 'Gewitter mit starkem Hagel'; rainCount = 60; baseWindSpeed = 3.5; break;
            default: theme = 'overcast'; summaryText = `Bedeckt (${code})`; baseWindSpeed = 0.5; break; // Zeige Code bei unbekannt
        }

        // Wind-Visualisierung (Blätter) basierend auf gemessener Geschwindigkeit
        // Nur wenn nicht schon Regen/Schnee/Gewitter ist
        if (windSpeed > 20 && theme !== 'rain' && theme !== 'snow' && theme !== 'thunder') {
             theme = 'wind'; // Ändere das Theme auf 'wind'
             summaryText = 'Windig'; // Überschreibe Text
             leafCount = 5; // Setze Blätter
             baseWindSpeed = 3; // Setze Wind für Animation
        }

        // Anwenden der visuellen Änderungen und Animationen
        applyWeatherVisuals(theme, summaryText, baseWindSpeed, rainCount, snowCount, leafCount);
    }

    function resetVisuals() {
        // Alle Wetterklassen entfernen
        container.removeClass('sun rain snow thunder wind overcast'); // 'wind' hinzugefügt
        // Laufende Animationen der Settings stoppen und Werte zurücksetzen
        gsap.killTweensOf(settings);
        gsap.to(settings, 0.5, { rainCount: 0, snowCount: 0, leafCount: 0, windSpeed: 0.5, ease: Power2.easeOut });

        // Sonne/Sunburst ausblenden und Animationen stoppen
        if (sun.node) {
             gsap.killTweensOf(sun.node);
             gsap.to(sun.node, 1, { x: sizes.card.width / 2, y: -100, opacity: 0, ease: Power2.easeInOut });
        }
        if (sunburst.node) {
             gsap.killTweensOf(sunburst.node);
             gsap.to(sunburst.node, 1, { scale: 0.4, opacity: 0, y: sizes.offset.top + (sizes.card.height/2) - 50, ease: Power2.easeInOut });
        }

        // Blitz-Timer stoppen
        if (lightningTimeout) clearTimeout(lightningTimeout);
    }

    function applyWeatherVisuals(theme, summaryText, windSpeed, rainCount, snowCount, leafCount) {
        resetVisuals(); // Erst alles zurücksetzen

        // Summary Text animieren
        gsap.killTweensOf(summary);
        gsap.to(summary, 0.1, {
            opacity: 0, x: -30, ease: Power4.easeIn,
            onComplete: function() {
                summary.html(summaryText);
                gsap.to(summary, 1.5, { opacity: 1, x: 0, ease: Power4.easeOut });
            }
        });

        // Neue Wetterklasse hinzufügen
        container.addClass(theme);

        // Animationseinstellungen anpassen
        gsap.to(settings, 3, {
             windSpeed: windSpeed,
             rainCount: rainCount,
             snowCount: snowCount,
             leafCount: leafCount,
             ease: Power2.easeInOut
         });

        // Sonne einblenden (wenn theme 'sun' ist)
        if (theme === 'sun' && sun.node && sunburst.node) {
             gsap.to(sun.node, 4, { x: sizes.card.width / 2, y: sizes.card.height / 2, opacity: 1, ease: Power2.easeInOut });
             gsap.to(sunburst.node, 4, { scale: 1, opacity: 0.8, y: sizes.offset.top + (sizes.card.height / 2), ease: Power2.easeInOut });
        }

        // Blitz starten (wenn theme 'thunder' ist)
        if (theme === 'thunder') {
             startLightningTimer();
        }
    }

    // ------------------- CORE ANIMATION LOGIC (aus CodePen, angepasst mit gsap) -------------------
    // (Die Funktionen drawCloud, makeRain, onRainEnd, makeSplash, onSplashComplete,
    // makeLeaf, onLeafEnd, makeSnow, onSnowEnd, startLightningTimer, lightning
    // und tick bleiben hier unverändert aus der vorherigen korrigierten Version,
    // da sie auf gsap umgestellt waren und die Logik an sich korrekt schien.
    // Stelle sicher, dass alle `TweenMax` durch `gsap` ersetzt sind und die
    // Holder-Checks vorhanden sind.)

     function drawCloud(cloud, i) {
        if (!cloud || !cloud.group || typeof cloud.group.path !== 'function') return; // Safety check

        var space  = settings.cloudSpace * i;
        var height = space + settings.cloudHeight;
        var arch = height + settings.cloudArch + (Math.random() * settings.cloudArch);
        var width = sizes.card.width;

        var points = [
            'M' + [-(width), 0].join(','),
            [width, 0].join(','),
            'Q' + [width * 2, height / 2].join(','),
            [width, height].join(','),
            'Q' + [width * 0.5, arch].join(','),
            [0, height].join(','),
            'Q' + [width * -0.5, arch].join(','),
            [-width, height].join(','),
            'Q' + [- (width * 2), height/2].join(','),
            [-(width), 0].join(',')
        ];

        var path = points.join(' ');
        if(!cloud.path) cloud.path = cloud.group.path();
        cloud.path.attr({ d: path });
    }

    function makeRain() {
        var isThunder = container.hasClass('thunder');
        var lineWidth = Math.random() * 3;
        var lineLength = isThunder ? 35 : 14;
        var x = Math.random() * (sizes.card.width - 40) + 20;
        var holderIndex = 3 - Math.floor(lineWidth);
        var holder = window['innerRainHolder' + holderIndex];

        if (!holder || typeof holder.path !== 'function') return;

        var line = holder.path('M0,0 0,' + lineLength).attr({
            fill: 'none',
            stroke: isThunder ? '#777' : '#0000ff',
            strokeWidth: lineWidth
        });

        rain.push(line);
        gsap.fromTo(line.node, 1, {x: x, y: 0 - lineLength}, {delay: Math.random(), y: sizes.card.height, ease: Power2.easeIn, onComplete: onRainEnd, onCompleteParams: [line, lineWidth, x, isThunder]});
    }

    function onRainEnd(line, width, x, isThunder) {
        if (line && typeof line.remove === 'function') line.remove();
        line = null;
        rain = rain.filter(item => item && item.paper); // Filter out removed items

        if(rain.length < settings.rainCount) {
            makeRain();
            if(width > 2) makeSplash(x, isThunder);
        }
    }

     function makeSplash(x, isThunder) {
        if (!outerSplashHolder || typeof outerSplashHolder.path !== 'function') return; // Check holder

        var type = isThunder ? 'thunder' : 'rain';
        var splashLength = type === 'thunder' ? 30 : 20;
        var splashBounce = type === 'thunder' ? 120 : 100;
        var splashDistance = 80;
        var speed = type === 'thunder' ? 0.7 : 0.5;
        var splashUp = 0 - (Math.random() * splashBounce);
        var randomX = ((Math.random() * splashDistance) - (splashDistance / 2));

        var points = ['M0,0', 'Q' + randomX + ',' + splashUp, (randomX * 2) + ',' + splashDistance];
        var splash = outerSplashHolder.path(points.join(' ')).attr({
            fill: "none",
            stroke: type === 'thunder' ? '#777' : '#0000ff',
            strokeWidth: 1
        });

        var pathLength;
        try { pathLength = splash.getTotalLength(); } catch (e) { if (splash.remove) splash.remove(); return; }

        var xOffset = sizes.offset.left;
        var yOffset = sizes.offset.top + sizes.card.height;

        if (splash.node) {
            splash.node.style.strokeDasharray = pathLength + ' ' + pathLength;
             gsap.fromTo(splash.node, speed,
               { strokeWidth: 2, y: yOffset, x: xOffset + x, opacity: 1, strokeDashoffset: pathLength },
               { strokeWidth: 0, strokeDashoffset: - pathLength, opacity: 1, onComplete: onSplashComplete, onCompleteParams: [splash], ease:  SlowMo.ease.config(0.4, 0.1, false) }
             );
         } else { if (splash.remove) splash.remove(); }
    }

    function onSplashComplete(splash) {
        if (splash && typeof splash.remove === 'function') splash.remove();
        splash = null;
    }

     function makeLeaf() {
        if (!leaf || typeof leaf.clone !== 'function') return; // Check if leaf template exists

        var scale = 0.5 + (Math.random() * 0.5);
        var newLeaf;
        var areaY = sizes.card.height / 2;
        var y = areaY + (Math.random() * areaY);
        var endY = y - ((Math.random() * (areaY * 2)) - areaY)
        var x, endX, xBezier;
        var colors = ['#76993E', '#4A5E23', '#6D632F'];
        var color = colors[Math.floor(Math.random() * colors.length)];
        var targetHolder;

        if (scale > 0.8 && outerLeafHolder && typeof outerLeafHolder.append === 'function') {
            targetHolder = outerLeafHolder;
            y += sizes.offset.top / 2; endY += sizes.offset.top / 2;
            x = sizes.offset.left + sizes.card.width;
            xBezier = x + (sizes.container.width - x) / 2; endX = sizes.container.width + 50;
        } else if (innerLeafHolder && typeof innerLeafHolder.append === 'function') {
            targetHolder = innerLeafHolder;
            x = -100; xBezier = sizes.card.width / 2; endX = sizes.card.width + 50;
        } else { return; }

         try {
            newLeaf = leaf.clone();
            targetHolder.append(newLeaf);
            newLeaf.attr({ fill: color });
         } catch (e) { console.error("Leaf clone/append failed:", e); return; }

        if (targetHolder === outerLeafHolder && leafMask) {
            newLeaf.attr({'clip-path': leafMask});
        }

        leafs.push(newLeaf);
        var bezier = [{x:x, y:y}, {x: xBezier, y:(Math.random() * endY) + (endY / 3)}, {x: endX, y:endY}];
        gsap.fromTo(newLeaf.node, 2 + Math.random()*2,
             { rotation: Math.random()* 180, x: x, y: y, scale:scale },
             { rotation: Math.random()* 360, bezier: bezier, onComplete: onLeafEnd, onCompleteParams: [newLeaf], ease: Power0.easeIn }
        );
    }

    function onLeafEnd(leafToRemove) {
        if (leafToRemove && typeof leafToRemove.remove === 'function') leafToRemove.remove();
        leafToRemove = null;
        leafs = leafs.filter(item => item && item.paper);

        if(leafs.length < settings.leafCount) { makeLeaf(); }
    }

    function makeSnow() {
        var scale = 0.5 + (Math.random() * 0.5);
        var newSnow;
        var x = 20 + (Math.random() * (sizes.card.width - 40));
        var y = settings.cloudHeight - 10; // Start near clouds
        var endY;
        var targetHolder;

        if (scale > 0.8 && outerSnowHolder && typeof outerSnowHolder.circle === 'function') {
            targetHolder = outerSnowHolder;
            endY = sizes.container.height + 10; y += sizes.offset.top; x += sizes.offset.left;
        } else if (innerSnowHolder && typeof innerSnowHolder.circle === 'function') {
            targetHolder = innerSnowHolder; endY = sizes.card.height + 10;
        } else { return; }

        try { newSnow = targetHolder.circle(0, 0, 5).attr({ fill: 'white' }); }
        catch(e) { console.error("Snow creation failed:", e); return; }

        snow.push(newSnow);
        gsap.fromTo(newSnow.node, 3 + (Math.random() * 5), {x: x, y: y}, {y: endY, onComplete: onSnowEnd, onCompleteParams: [newSnow], ease: Power0.easeIn});
        gsap.fromTo(newSnow.node, 1,{scale: 0}, {scale: scale, ease: Power1.easeInOut});
        gsap.to(newSnow.node, 3, {x: x+((Math.random() * 150)-75), repeat: -1, yoyo: true, ease: Power1.easeInOut});
    }

    function onSnowEnd(flake) {
        if (flake && typeof flake.remove === 'function') flake.remove();
        flake = null;
        snow = snow.filter(item => item && item.paper);
        if(snow.length < settings.snowCount) { makeSnow(); }
    }

    function startLightningTimer() {
        if(lightningTimeout) clearTimeout(lightningTimeout);
        if(container.hasClass('thunder')) {
            lightningTimeout = setTimeout(lightning, Math.random()*6000 + 1000);
        }
    }

    function lightning() {
        startLightningTimer();
        if (!innerLightningHolder || typeof innerLightningHolder.path !== 'function') return;
        gsap.fromTo(card, 0.75, {y: -10}, {y:0, ease:Elastic.easeOut}); // Adjusted ease

        var pathX = 30 + Math.random() * (sizes.card.width - 60);
        var yOffset = 20; var steps = 20; var points = [pathX + ',0'];
        for(var i = 0; i < steps; i++) {
            var x = pathX + (Math.random() * yOffset - (yOffset / 2));
            var y = (sizes.card.height / steps) * (i + 1);
            points.push(x + ',' + y);
        }

        var strike;
        try {
             strike = innerLightningHolder.path('M' + points.join(' ')).attr({
                 fill: 'none', stroke: 'white', strokeWidth: 2 + Math.random()
             });
        } catch (e) { console.error("Lightning path failed:", e); return; }

        gsap.to(strike.node, 1, {opacity: 0, ease:Power4.easeOut, onComplete: function(){ if(strike && strike.remove) strike.remove(); strike = null; }});
    }

    function tick() {
        tickCount++;
        if (tickCount % settings.renewCheck === 0) {
            if(settings.rainCount > 0 && rain.length < settings.rainCount) makeRain();
            if(settings.leafCount > 0 && leafs.length < settings.leafCount) makeLeaf();
            if(settings.snowCount > 0 && snow.length < settings.snowCount) makeSnow();
        }

        // Cloud Animation
        for(var i = 0; i < clouds.length; i++) {
            if (!clouds[i] || !clouds[i].group || typeof clouds[i].group.transform !== 'function') continue;

            var cloud = clouds[i]; var divisor = (i + 1); var speed = settings.windSpeed / divisor;
            cloud.offset += speed;

            // Simple looping
            var cloudWidth = sizes.card.width * 2; // Approx visual width
             if (speed > 0 && cloud.offset > sizes.card.width) { cloud.offset -= (cloudWidth + sizes.card.width); }
             else if (speed < 0 && cloud.offset < -cloudWidth) { cloud.offset += (cloudWidth + sizes.card.width); }

             try { cloud.group.transform('t' + cloud.offset + ',' + 0); }
             catch (e) { console.error("Cloud transform failed:", e); }
        }
        requestAnimationFrame(tick); // Keep the loop going
    }

    // App initialisieren
    init();

}); // End $(document).ready