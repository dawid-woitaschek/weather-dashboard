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
    var currentCoords = { lat: 51.5136, lon: 7.4653 }; // Default: Dortmund
    var currentPlaceName = "Dortmund, Deutschland"; // Default Place Name
    var geoapifyApiKey = "6b73ef3534d24e6f9f9cbbd26bdf2e99"; // Dein API Key

    // Objekt für Größen, wird später aktualisiert
    var sizes = {
        container: {width: 0, height: 0},
        card: {width: 0, height: 0},
        offset: {top: 0, left: 0} // Hinzugefügt für korrekte Offsets
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

        // Clouds zeichnen
        for(var i = 0; i < clouds.length; i++) {
            clouds[i].offset = Math.random() * sizes.card.width;
            drawCloud(clouds[i], i);
        }

        // Event Listeners für Suche und Geolocation
        locationInput.on('input', handleInputChange);
        locationInput.on('keydown', handleInputKeydown);
        searchButton.on('click', triggerSearchFromInput); // Search button triggers search
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
        sizes.container.width = $(document).width(); // Use document width for full screen svg
        sizes.container.height = $(document).height(); // Use document height
        sizes.card.width = card.width();
        sizes.card.height = card.height();
        // Wichtig: offset() relativ zum Dokument verwenden
        var cardOffset = card.offset();
        sizes.offset.top = cardOffset.top;
        sizes.offset.left = cardOffset.left;


        // SVG-Größen aktualisieren
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

        // Sonnenstrahlen-Position und Animation aktualisieren
        TweenMax.set(sunburst.node, {
            transformOrigin:"50% 50%",
            x: sizes.container.width / 2,
            // Position relativ zur Karte, nicht zum Container-Zentrum
            y: sizes.offset.top + (sizes.card.height / 2)
        });
        // Nur starten, wenn nicht schon läuft (oder neu starten)
        if (!TweenMax.isTweening(sunburst.node)) {
             TweenMax.fromTo(sunburst.node, 20, {rotation: 0}, {rotation: 360, repeat: -1, ease: 'none'}); // Power0.easeInOut is default, use linear for constant speed
        }


        // Blatt-Maske für Blätter außerhalb der Karte
        leafMask.attr({
             x: sizes.offset.left + sizes.card.width, // Start right of the card
             y: 0,
             width: sizes.container.width - (sizes.offset.left + sizes.card.width), // Width to the edge
             height: sizes.container.height
         });

        // Neuberechnung der Sonnenposition bei 'sun' Wetter
        if (container.hasClass('sun')) {
            TweenMax.to(sun.node, 0.5, { // Schnelleres Update bei Resize
                 x: sizes.card.width / 2,
                 y: sizes.card.height / 2,
                 ease: Power2.easeInOut
            });
             TweenMax.to(sunburst.node, 0.5, { // Schnelleres Update bei Resize
                 scale: 1,
                 opacity: 0.8,
                 y: sizes.offset.top + (sizes.card.height / 2), // Update Y position
                 ease: Power2.easeInOut
             });
        } else {
             TweenMax.to(sunburst.node, 0.5, { // Update Y position even when hidden
                 y: sizes.offset.top + (sizes.card.height / 2) - 50, // Adjust relative offset
                 ease: Power2.easeInOut
             });
        }
    }

    // Bei Fenstergrößeänderung reagieren
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
            const firstSuggestion = suggestionsDiv.find('div:first-child');
            if (firstSuggestion.length) {
                selectSuggestion(firstSuggestion.data('lat'), firstSuggestion.data('lon'), firstSuggestion.text());
            } else {
                 // Optional: Trigger search even without suggestion? Maybe just ignore.
                 suggestionsDiv.hide().empty();
            }
        } else if (e.key === 'Escape') {
             suggestionsDiv.hide().empty();
        }
    }

    function triggerSearchFromInput() {
         const firstSuggestion = suggestionsDiv.find('div:first-child');
         if (firstSuggestion.length && suggestionsDiv.is(":visible")) {
             // If suggestions are visible, use the first one
             selectSuggestion(firstSuggestion.data('lat'), firstSuggestion.data('lon'), firstSuggestion.text());
         } else if (locationInput.val().length >= 3) {
             // If no suggestions visible, but text exists, try fetching suggestions and using the first
             fetchSuggestions(locationInput.val(), true); // Pass flag to auto-select
         }
         suggestionsDiv.hide(); // Hide suggestions after button click
    }


    function fetchSuggestions(query, autoSelectFirst = false) {
        const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&apiKey=${geoapifyApiKey}&lang=de&limit=5`;

        fetch(url)
            .then(response => response.json())
            .then(data => {
                suggestionsDiv.empty().show();
                if (data.features && data.features.length > 0) {
                    if (autoSelectFirst) {
                         const first = data.features[0].properties;
                         selectSuggestion(first.lat, first.lon, first.formatted);
                         return; // Stop processing further suggestions
                    }
                    data.features.forEach(feature => {
                        const properties = feature.properties;
                        const div = $('<div>')
                            .text(properties.formatted)
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
        locationInput.val(name); // Update input field
        suggestionsDiv.hide().empty();
        fetchWeather(lat, lon, name);
    }

    function getCurrentLocationWeather() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(position => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                // Versuche, den Namen über Reverse Geocoding zu bekommen
                fetchReverseGeocode(lat, lon);

            }, error => {
                console.error("Geolocation error:", error);
                alert("Standort konnte nicht abgerufen werden. Bitte Berechtigung prüfen.");
                // Fallback to default if error
                fetchWeather(currentCoords.lat, currentCoords.lon, currentPlaceName);
            });
        } else {
            alert("Geolocation wird von diesem Browser nicht unterstützt.");
             // Fallback to default if no geolocation support
            fetchWeather(currentCoords.lat, currentCoords.lon, currentPlaceName);
        }
    }

    function fetchReverseGeocode(lat, lon) {
         const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&apiKey=${geoapifyApiKey}&lang=de`;
         fetch(url)
            .then(response => response.json())
            .then(data => {
                let placeName = "Aktueller Standort"; // Default
                 if (data.features && data.features.length > 0) {
                     const props = data.features[0].properties;
                     // Build a reasonable name (e.g., City, Country or Suburb, City)
                     if (props.city && props.country) {
                        placeName = `${props.city}, ${props.country}`;
                     } else if (props.suburb && props.city) {
                         placeName = `${props.suburb}, ${props.city}`;
                     } else if (props.formatted) {
                         placeName = props.formatted;
                     }
                 }
                 currentCoords = { lat, lon }; // Update coords
                 currentPlaceName = placeName;
                 locationInput.val(placeName); // Update input field
                 fetchWeather(lat, lon, placeName); // Now fetch weather
            })
            .catch(error => {
                 console.error("Reverse geocoding error:", error);
                 // Fetch weather with default name if reverse geocoding fails
                 fetchWeather(lat, lon, "Aktueller Standort");
            });
    }


    function fetchWeather(lat, lon, name) {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}¤t_weather=true&timezone=Europe/Berlin`; // Timezone added

        // Zeige Ladezustand an
        summary.text('Lädt...');
        temp.html('--<span>°C</span>');
        locationDisplay.text(name || "..."); // Show selected/current name

        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (data && data.current_weather) {
                    const weather = data.current_weather;
                    updateUI(weather, name);
                } else {
                    showError("Wetterdaten nicht verfügbar.");
                }
            })
            .catch(error => {
                console.error('Error fetching Open-Meteo data:', error);
                showError("Fehler beim Laden der Wetterdaten.");
            });
    }

    function showError(message) {
         summary.text(message);
         temp.html('--<span>°C</span>');
         resetVisuals(); // Reset animation to default state
    }


    // ------------------- UI UPDATE & WETTER-MAPPING -------------------

    function updateUI(weatherData, placeName) {
        // Temperatur aktualisieren
        const temperature = Math.round(weatherData.temperature);
        temp.html(`${temperature}<span>°C</span>`);

        // Datum aktualisieren
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
         const formattedDate = now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }); // Format: Dienstag, 22. April
        date.text(formattedDate);


        // Ort anzeigen
        locationDisplay.text(placeName);

        // Wettercode mappen und Animation/Text aktualisieren
        mapWeatherCodeToVisuals(weatherData.weathercode);
    }

    function mapWeatherCodeToVisuals(code) {
        let theme = 'sun'; // Default
        let summaryText = 'Unbekannt';

        // Mapping basierend auf WMO Weather interpretation codes (Open-Meteo Docs)
        switch (code) {
            case 0: theme = 'sun'; summaryText = 'Klarer Himmel'; break;
            case 1: theme = 'sun'; summaryText = 'Meist klar'; break; // Slightly different text, same visual
            case 2: theme = 'overcast'; summaryText = 'Teilweise bewölkt'; break; // Use overcast visual
            case 3: theme = 'overcast'; summaryText = 'Bedeckt'; break;
            case 45: theme = 'overcast'; summaryText = 'Nebel'; break; // Use overcast visual for fog
            case 48: theme = 'overcast'; summaryText = 'Reifnebel'; break; // Use overcast visual for fog
            case 51: theme = 'rain'; summaryText = 'Leichter Nieselregen'; settings.rainCount = 5; break; // Less rain
            case 53: theme = 'rain'; summaryText = 'Mäßiger Nieselregen'; settings.rainCount = 10; break;
            case 55: theme = 'rain'; summaryText = 'Starker Nieselregen'; settings.rainCount = 20; break;
            case 56: theme = 'snow'; summaryText = 'Leichter gefrierender Nieselregen'; settings.snowCount = 10; break; // Use snow
            case 57: theme = 'snow'; summaryText = 'Dichter gefrierender Nieselregen'; settings.snowCount = 20; break; // Use snow
            case 61: theme = 'rain'; summaryText = 'Leichter Regen'; settings.rainCount = 10; break;
            case 63: theme = 'rain'; summaryText = 'Mäßiger Regen'; settings.rainCount = 30; break;
            case 65: theme = 'rain'; summaryText = 'Starker Regen'; settings.rainCount = 60; break;
            case 66: theme = 'snow'; summaryText = 'Leichter gefrierender Regen'; settings.snowCount = 20; break; // Use snow
            case 67: theme = 'snow'; summaryText = 'Starker gefrierender Regen'; settings.snowCount = 40; break; // Use snow
            case 71: theme = 'snow'; summaryText = 'Leichter Schneefall'; settings.snowCount = 15; break;
            case 73: theme = 'snow'; summaryText = 'Mäßiger Schneefall'; settings.snowCount = 30; break;
            case 75: theme = 'snow'; summaryText = 'Starker Schneefall'; settings.snowCount = 50; break;
            case 77: theme = 'snow'; summaryText = 'Schneegriesel'; settings.snowCount = 20; break;
            case 80: theme = 'rain'; summaryText = 'Leichte Regenschauer'; settings.rainCount = 15; break;
            case 81: theme = 'rain'; summaryText = 'Mäßige Regenschauer'; settings.rainCount = 35; break;
            case 82: theme = 'rain'; summaryText = 'Heftige Regenschauer'; settings.rainCount = 60; break;
            case 85: theme = 'snow'; summaryText = 'Leichte Schneeschauer'; settings.snowCount = 20; break;
            case 86: theme = 'snow'; summaryText = 'Starke Schneeschauer'; settings.snowCount = 40; break;
            case 95: theme = 'thunder'; summaryText = 'Gewitter'; settings.rainCount = 40; break; // Thunderstorm + rain
            case 96: theme = 'thunder'; summaryText = 'Gewitter mit leichtem Hagel'; settings.rainCount = 50; break; // Thunderstorm + rain
            case 99: theme = 'thunder'; summaryText = 'Gewitter mit starkem Hagel'; settings.rainCount = 60; break; // Thunderstorm + rain
            default: theme = 'overcast'; summaryText = 'Bedeckt'; break; // Fallback
        }

        // Optional: Wind hinzufügen (Blätter), wenn Windgeschwindigkeit hoch ist (nicht in current_weather standardmäßig)
        // Man müsste `windspeed_10m` in der API anfordern und hier prüfen.
        // if (weatherData.windspeed_10m > 15) { // Beispiel: 15 km/h
        //    settings.leafCount = 5;
        // } else {
        //    settings.leafCount = 0;
        // }

        applyWeatherVisuals(theme, summaryText);
    }

    function resetVisuals() {
        // Alle Klassen entfernen, die das Wetterthema steuern
        container.removeClass('sun rain snow thunder wind overcast');
        // Alle Animationszähler auf 0 setzen
        TweenMax.to(settings, 1, { rainCount: 0, snowCount: 0, leafCount: 0, ease: Power2.easeOut });
        // Sonne ausblenden
        TweenMax.to(sun.node, 1, { x: sizes.card.width / 2, y: -100, ease: Power2.easeInOut });
        TweenMax.to(sunburst.node, 1, { scale: 0.4, opacity: 0, y: sizes.offset.top + (sizes.card.height/2) - 50, ease: Power2.easeInOut }); // Update Y pos
         // Blitz-Timer stoppen
         if (lightningTimeout) clearTimeout(lightningTimeout);
    }

    function applyWeatherVisuals(theme, summaryText) {
        resetVisuals(); // Erst alles zurücksetzen

        // Summary Text animieren
        TweenMax.killTweensOf(summary); // Vorherige Animation stoppen
        TweenMax.to(summary, 0.1, { // Erst schnell ausblenden
            opacity: 0,
            x: -30,
            ease: Power4.easeIn,
            onComplete: function() {
                summary.html(summaryText); // Text aktualisieren
                TweenMax.to(summary, 1.5, { // Dann einblenden
                     opacity: 1,
                     x: 0,
                     ease: Power4.easeOut
                 });
            }
        });


        container.addClass(theme); // Neue Wetterklasse hinzufügen

        // Animationseinstellungen basierend auf dem Thema anpassen
        switch(theme) {
            case 'rain':
                // rainCount wurde schon im Mapping gesetzt, hier nur Wind anpassen
                TweenMax.to(settings, 3, { windSpeed: 0.5, ease: Power2.easeOut });
                break;
            case 'snow':
                 // snowCount wurde schon im Mapping gesetzt, hier nur Wind anpassen
                TweenMax.to(settings, 3, { windSpeed: 0.3, ease: Power2.easeOut }); // Slower wind for snow
                break;
            case 'thunder':
                // rainCount wurde schon im Mapping gesetzt
                TweenMax.to(settings, 3, { windSpeed: 1, ease: Power2.easeInOut }); // Slightly higher wind for storm
                startLightningTimer();
                break;
            case 'sun':
                TweenMax.to(settings, 3, { windSpeed: 10, ease: Power2.easeInOut }); // More wind for sun effect
                 // Sonne einblenden
                 TweenMax.to(sun.node, 4, { x: sizes.card.width / 2, y: sizes.card.height / 2, ease: Power2.easeInOut });
                 TweenMax.to(sunburst.node, 4, { scale: 1, opacity: 0.8, y: sizes.offset.top + (sizes.card.height / 2), ease: Power2.easeInOut });
                break;
             case 'wind': // Falls man Wind explizit mappen will
                 TweenMax.to(settings, 3, { windSpeed: 3, leafCount: 5, ease: Power2.easeInOut });
                 break;
            case 'overcast':
            default: // Default/Overcast/Fog
                TweenMax.to(settings, 3, { windSpeed: 0.5, ease: Power2.easeOut });
                break;
        }
    }

    // ------------------- CORE ANIMATION LOGIC (aus CodePen, angepasst) -------------------

    function drawCloud(cloud, i) {
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
        cloud.path.attr({ d: path }); // Animate mit 0 Dauer -> attr
    }

    function makeRain() {
        var isThunder = container.hasClass('thunder');
        var lineWidth = Math.random() * 3;
        var lineLength = isThunder ? 35 : 14;
        var x = Math.random() * (sizes.card.width - 40) + 20;
        var holder = this['innerRainHolder' + (3 - Math.floor(lineWidth))];
        // Check if holder exists before creating path
         if (!holder || !holder.path) return;

        var line = holder.path('M0,0 0,' + lineLength).attr({
            fill: 'none',
            stroke: isThunder ? '#777' : '#0000ff',
            strokeWidth: lineWidth
        });

        rain.push(line);

        TweenMax.fromTo(line.node, 1, {x: x, y: 0 - lineLength}, {delay: Math.random(), y: sizes.card.height, ease: Power2.easeIn, onComplete: onRainEnd, onCompleteParams: [line, lineWidth, x, isThunder]});
    }

    function onRainEnd(line, width, x, isThunder) {
        if (line && line.remove) line.remove(); // Sicherstellen, dass line existiert
        line = null;
        rain = rain.filter(item => item && item.paper); // Bereinigen

        if(rain.length < settings.rainCount) {
            makeRain();
            if(width > 2) makeSplash(x, isThunder);
        }
    }

    function makeSplash(x, isThunder) {
        var type = isThunder ? 'thunder' : 'rain'; // Use string type
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

        // Check if outerSplashHolder exists
         if (!outerSplashHolder || !outerSplashHolder.path) return;

        var splash = outerSplashHolder.path(points.join(' ')).attr({
            fill: "none",
            stroke: type === 'thunder' ? '#777' : '#0000ff',
            strokeWidth: 1
        });

        var pathLength = splash.getTotalLength(); // Use Snap's method directly
        // Verwende die gespeicherten Offsets
        var xOffset = sizes.offset.left;
        var yOffset = sizes.offset.top + sizes.card.height;

        splash.node.style.strokeDasharray = pathLength + ' ' + pathLength;

        TweenMax.fromTo(splash.node, speed,
           { strokeWidth: 2, y: yOffset, x: xOffset + x, opacity: 1, strokeDashoffset: pathLength }, // x adjusted for card offset
           { strokeWidth: 0, strokeDashoffset: - pathLength, opacity: 1, onComplete: onSplashComplete, onCompleteParams: [splash], ease:  SlowMo.ease.config(0.4, 0.1, false) }
        );
    }

    function onSplashComplete(splash) {
        if (splash && splash.remove) splash.remove();
        splash = null;
    }

    function makeLeaf() {
        var scale = 0.5 + (Math.random() * 0.5);
        var newLeaf;
        var areaY = sizes.card.height / 2;
        var y = areaY + (Math.random() * areaY);
        var endY = y - ((Math.random() * (areaY * 2)) - areaY);
        var x, endX, xBezier;
        var colors = ['#76993E', '#4A5E23', '#6D632F'];
        var color = colors[Math.floor(Math.random() * colors.length)];

        if (scale > 0.8) { // Outside leaf
             // Check if outerLeafHolder exists
             if (!outerLeafHolder || !outerLeafHolder.group) return; // Check group existence
            newLeaf = leaf.clone().appendTo(outerLeafHolder).attr({ fill: color });
            // Verwende die gespeicherten Offsets
            y = y + sizes.offset.top / 2;
            endY = endY + sizes.offset.top / 2;
            x = sizes.offset.left + sizes.card.width; // Start right of the card
            xBezier = x + (sizes.container.width - x) / 2; // Bezier point between start and edge
            endX = sizes.container.width + 50; // Fly off screen right

             // Apply mask
             newLeaf.attr({'clip-path': leafMask}); // Apply mask to outer leaves


        } else { // Inside leaf
             // Check if innerLeafHolder exists
             if (!innerLeafHolder || !innerLeafHolder.group) return; // Check group existence
            newLeaf = leaf.clone().appendTo(innerLeafHolder).attr({ fill: color });
            x = -100; // Start left of the card
            xBezier = sizes.card.width / 2;
            endX = sizes.card.width + 50; // Fly off screen right (relative to card)
        }

        leafs.push(newLeaf);

        var bezier = [{x:x, y:y}, {x: xBezier, y:(Math.random() * endY) + (endY / 3)}, {x: endX, y:endY}];
        TweenMax.fromTo(newLeaf.node, 2 + Math.random()*2, // Slower leaves
             { rotation: Math.random()* 180, x: x, y: y, scale:scale },
             { rotation: Math.random()* 360, bezier: bezier, onComplete: onLeafEnd, onCompleteParams: [newLeaf], ease: Power0.easeIn }
        );
    }

    function onLeafEnd(leafToRemove) {
        if (leafToRemove && leafToRemove.remove) leafToRemove.remove();
        leafToRemove = null;
        leafs = leafs.filter(item => item && item.paper); // Bereinigen

        if(leafs.length < settings.leafCount) {
            makeLeaf();
        }
    }

    function makeSnow() {
        var scale = 0.5 + (Math.random() * 0.5);
        var newSnow;
        var x = 20 + (Math.random() * (sizes.card.width - 40));
        var y = -10; // Start above card
        var endY;


        if (scale > 0.8) { // Outside snow (less frequent)
            // Check if outerSnowHolder exists
             if (!outerSnowHolder || !outerSnowHolder.circle) return;
            newSnow = outerSnowHolder.circle(0, 0, 5).attr({ fill: 'white' });
            endY = sizes.container.height + 10; // Fall to bottom of screen
             // Verwende die gespeicherten Offsets
            y = sizes.offset.top + settings.cloudHeight; // Start near clouds
            x = x + sizes.offset.left; // Adjust x based on card position
        } else { // Inside snow
            // Check if innerSnowHolder exists
            if (!innerSnowHolder || !innerSnowHolder.circle) return;
            newSnow = innerSnowHolder.circle(0, 0 ,5).attr({ fill: 'white' });
            endY = sizes.card.height + 10; // Fall to bottom of card
        }

        snow.push(newSnow);

        TweenMax.fromTo(newSnow.node, 3 + (Math.random() * 5), {x: x, y: y}, {y: endY, onComplete: onSnowEnd, onCompleteParams: [newSnow], ease: Power0.easeIn});
        TweenMax.fromTo(newSnow.node, 1,{scale: 0}, {scale: scale, ease: Power1.easeInOut});
        TweenMax.to(newSnow.node, 3, {x: x+((Math.random() * 150)-75), repeat: -1, yoyo: true, ease: Power1.easeInOut}); // Side to side drift
    }

    function onSnowEnd(flake) {
        if (flake && flake.remove) flake.remove();
        flake = null;
        snow = snow.filter(item => item && item.paper); // Bereinigen

        if(snow.length < settings.snowCount) {
            makeSnow();
        }
    }

    function startLightningTimer() {
        if(lightningTimeout) clearTimeout(lightningTimeout);
        // Only start if container has thunder class
        if(container.hasClass('thunder')) {
            lightningTimeout = setTimeout(lightning, Math.random()*6000 + 1000); // Wait at least 1 sec
        }
    }

    function lightning() {
        startLightningTimer(); // Schedule next one
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

        // Check if innerLightningHolder exists
         if (!innerLightningHolder || !innerLightningHolder.path) return;

        var strike = innerLightningHolder.path('M' + points.join(' '))
        .attr({
            fill: 'none',
            stroke: 'white',
            strokeWidth: 2 + Math.random()
        });

        TweenMax.to(strike.node, 1, {opacity: 0, ease:Power4.easeOut, onComplete: function(){ if(strike && strike.remove) strike.remove(); strike = null; }});
    }


    function tick() {
        tickCount++;
        var check = tickCount % settings.renewCheck;

        if (check === 0) { // Make check explicit comparison
            // Only create if count is > 0 and current number is less than target
            if(settings.rainCount > 0 && rain.length < settings.rainCount) makeRain();
            if(settings.leafCount > 0 && leafs.length < settings.leafCount) makeLeaf();
            if(settings.snowCount > 0 && snow.length < settings.snowCount) makeSnow();
        }

        // Cloud Animation
        for(var i = 0; i < clouds.length; i++) {
            if (!clouds[i] || !clouds[i].group) continue; // Skip if cloud group doesn't exist

            var cloud = clouds[i];
            var divisor = (i + 1);
            var speed = settings.windSpeed / divisor;

            // Invert direction for sun to match original if needed, or keep consistent
             // var direction = container.hasClass('sun') ? -1 : 1;
             // cloud.offset += speed * direction;
             cloud.offset += speed; // Consistent direction


            // Cloud looping logic
             var cloudWidth = sizes.card.width * 2; // Estimated width of the drawable cloud path part
             if (settings.windSpeed > 0 && cloud.offset > sizes.card.width + cloudWidth / 2) {
                  // Moved past the right edge, wrap around to the left
                  cloud.offset -= (cloudWidth + sizes.card.width);
              } else if (settings.windSpeed < 0 && cloud.offset < -(cloudWidth / 2)) {
                  // Moved past the left edge (if wind reversed), wrap around to the right
                  cloud.offset += (cloudWidth + sizes.card.width);
              }


            cloud.group.transform('t' + cloud.offset + ',' + 0);
        }

        requestAnimationFrame(tick); // Continue the loop
    }

    // App initialisieren
    init();

}); // End $(document).ready