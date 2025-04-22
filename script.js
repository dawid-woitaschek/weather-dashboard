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
        gsap.set(sunburst.node, { // Verwende gsap.set
            transformOrigin:"50% 50%",
            x: sizes.container.width / 2,
            y: sizes.offset.top + (sizes.card.height / 2)
        });
        // Nur starten, wenn nicht schon läuft (oder neu starten)
        if (!gsap.isTweening(sunburst.node)) { // *** KORRIGIERT ***
             gsap.fromTo(sunburst.node, 20, {rotation: 0}, {rotation: 360, repeat: -1, ease: 'none'}); // *** KORRIGIERT (gsap statt TweenMax) ***
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
            gsap.to(sun.node, 0.5, { // Schnelleres Update bei Resize // *** KORRIGIERT (gsap statt TweenMax) ***
                 x: sizes.card.width / 2,
                 y: sizes.card.height / 2,
                 ease: Power2.easeInOut
            });
             gsap.to(sunburst.node, 0.5, { // Schnelleres Update bei Resize // *** KORRIGIERT (gsap statt TweenMax) ***
                 scale: 1,
                 opacity: 0.8,
                 y: sizes.offset.top + (sizes.card.height / 2), // Update Y position
                 ease: Power2.easeInOut
             });
        } else {
             gsap.to(sunburst.node, 0.5, { // Update Y position even when hidden // *** KORRIGIERT (gsap statt TweenMax) ***
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
                 suggestionsDiv.hide().empty();
            }
        } else if (e.key === 'Escape') {
             suggestionsDiv.hide().empty();
        }
    }

    function triggerSearchFromInput() {
         const firstSuggestion = suggestionsDiv.find('div:first-child');
         if (firstSuggestion.length && suggestionsDiv.is(":visible")) {
             selectSuggestion(firstSuggestion.data('lat'), firstSuggestion.data('lon'), firstSuggestion.text());
         } else if (locationInput.val().length >= 3) {
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
            // Zeige kurz Feedback im Input-Feld
            locationInput.val("Standort wird ermittelt...");
            navigator.geolocation.getCurrentPosition(position => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                fetchReverseGeocode(lat, lon); // Versuche Namen zu bekommen

            }, error => {
                console.error("Geolocation error:", error);
                alert("Standort konnte nicht abgerufen werden. Bitte Berechtigung prüfen. Zeige Standardort.");
                locationInput.val(""); // Reset input field on error
                fetchWeather(currentCoords.lat, currentCoords.lon, currentPlaceName); // Fallback to default
            });
        } else {
            alert("Geolocation wird von diesem Browser nicht unterstützt.");
            fetchWeather(currentCoords.lat, currentCoords.lon, currentPlaceName); // Fallback to default
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
                     if (props.city && props.country) {
                        placeName = `${props.city}, ${props.country}`;
                     } else if (props.suburb && props.city) {
                         placeName = `${props.suburb}, ${props.city}`;
                     } else if (props.county && props.country) { // Added county as fallback
                        placeName = `${props.county}, ${props.country}`;
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
                 locationInput.val("Aktueller Standort"); // Show default name in input
                 fetchWeather(lat, lon, "Aktueller Standort"); // Fetch weather with default name
            });
    }


    function fetchWeather(lat, lon, name) {
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lon);

        console.log(`Attempting fetch for: Name=${name}, Lat=${lat} (Type: ${typeof lat}), Lon=${lon} (Type: ${typeof lon})`);

        if (isNaN(latitude) || isNaN(longitude)) {
            console.error("Invalid coordinates received or parsed:", lat, lon);
            showError("Ungültige Koordinaten erhalten.");
            return;
        }

        const formattedLat = latitude.toFixed(4);
        const formattedLon = longitude.toFixed(4);

        // *** KORREKTUR: Parameter an funktionierende Version angepasst ***
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${formattedLat}&longitude=${formattedLon}¤t=temperature_2m,weathercode&temperature_unit=celsius&windspeed_unit=kmh&timezone=auto`;
        // Hinweis: windspeed_10m hinzugefügt, falls du es für die Wind-Animation brauchst, sonst weglassen.
        // Falls nicht benötigt: const url = `https://api.open-meteo.com/v1/forecast?latitude=${formattedLat}&longitude=${formattedLon}¤t=temperature_2m,weathercode&temperature_unit=celsius&timezone=auto`;

        console.log(`Request URL: ${url}`);

        summary.text('Lädt...');
        temp.html('--<span>°C</span>');
        locationDisplay.text(name || "...");

        fetch(url)
            .then(response => {
                 if (!response.ok) {
                     // Versuche, detailliertere Fehlermeldung von der API zu bekommen (falls vorhanden)
                     return response.json().catch(() => null).then(errorBody => {
                         let errorMsg = `HTTP error! status: ${response.status} ${response.statusText}`;
                         if (errorBody && errorBody.reason) {
                             errorMsg += ` - Reason: ${errorBody.reason}`;
                         }
                         throw new Error(errorMsg);
                     });
                 }
                 return response.json();
            })
            .then(data => {
                // *** KORREKTUR: Datenstruktur an neuen Parameter angepasst ***
                if (data && data.current && data.current.time) { // Prüfe auf 'current' und eine Variable darin (z.B. 'time')
                    // Baue das benötigte 'current_weather' Objekt manuell nach
                    const weather = {
                        temperature: data.current.temperature_2m,
                        weathercode: data.current.weathercode,
                        // windspeed: data.current.windspeed_10m, // Falls angefordert und benötigt
                        time: data.current.time // Kann nützlich sein
                    };
                    updateUI(weather, name);
                } else {
                    console.error("Valid response but missing 'current' data:", data);
                    showError("Wetterdaten Format ungültig.");
                }
            })
            .catch(error => {
                console.error('Error fetching or parsing Open-Meteo data:', error);
                showError(`API Fehler: ${error.message}`);
            });
    }


    // ------------------- UI UPDATE & WETTER-MAPPING -------------------

    function updateUI(weatherData, placeName) {
        // Temperatur aktualisieren
        const temperature = Math.round(weatherData.temperature);
        temp.html(`${temperature}<span>°C</span>`);

        // Datum aktualisieren
        const now = new Date();
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
        let windSpeed = 0.5; // Default wind
        let rainCount = 0;
        let snowCount = 0;
        let leafCount = 0; // Reset leaf count


        // Mapping basierend auf WMO Weather interpretation codes (Open-Meteo Docs)
        switch (code) {
            case 0: theme = 'sun'; summaryText = 'Klarer Himmel'; windSpeed = 10; break;
            case 1: theme = 'sun'; summaryText = 'Meist klar'; windSpeed = 8; break; // Slightly less wind
            case 2: theme = 'overcast'; summaryText = 'Teilweise bewölkt'; windSpeed = 1; break;
            case 3: theme = 'overcast'; summaryText = 'Bedeckt'; windSpeed = 0.5; break;
            case 45: theme = 'overcast'; summaryText = 'Nebel'; windSpeed = 0.2; break; // Fog -> less wind visual
            case 48: theme = 'overcast'; summaryText = 'Reifnebel'; windSpeed = 0.2; break;
            case 51: theme = 'rain'; summaryText = 'Leichter Nieselregen'; rainCount = 5; break;
            case 53: theme = 'rain'; summaryText = 'Mäßiger Nieselregen'; rainCount = 10; break;
            case 55: theme = 'rain'; summaryText = 'Starker Nieselregen'; rainCount = 20; break;
            case 56: theme = 'snow'; summaryText = 'Leichter gefrierender Nieselregen'; snowCount = 10; break;
            case 57: theme = 'snow'; summaryText = 'Dichter gefrierender Nieselregen'; snowCount = 20; break;
            case 61: theme = 'rain'; summaryText = 'Leichter Regen'; rainCount = 10; windSpeed = 1; break;
            case 63: theme = 'rain'; summaryText = 'Mäßiger Regen'; rainCount = 30; windSpeed = 1.5; break;
            case 65: theme = 'rain'; summaryText = 'Starker Regen'; rainCount = 60; windSpeed = 2; break;
            case 66: theme = 'snow'; summaryText = 'Leichter gefrierender Regen'; snowCount = 20; windSpeed = 1; break;
            case 67: theme = 'snow'; summaryText = 'Starker gefrierender Regen'; snowCount = 40; windSpeed = 1.5; break;
            case 71: theme = 'snow'; summaryText = 'Leichter Schneefall'; snowCount = 15; windSpeed = 0.5; break;
            case 73: theme = 'snow'; summaryText = 'Mäßiger Schneefall'; snowCount = 30; windSpeed = 1; break;
            case 75: theme = 'snow'; summaryText = 'Starker Schneefall'; snowCount = 50; windSpeed = 1.5; break;
            case 77: theme = 'snow'; summaryText = 'Schneegriesel'; snowCount = 20; break;
            case 80: theme = 'rain'; summaryText = 'Leichte Regenschauer'; rainCount = 15; windSpeed = 1.5; break;
            case 81: theme = 'rain'; summaryText = 'Mäßige Regenschauer'; rainCount = 35; windSpeed = 2; break;
            case 82: theme = 'rain'; summaryText = 'Heftige Regenschauer'; rainCount = 60; windSpeed = 2.5; break;
            case 85: theme = 'snow'; summaryText = 'Leichte Schneeschauer'; snowCount = 20; windSpeed = 1.5; break;
            case 86: theme = 'snow'; summaryText = 'Starke Schneeschauer'; snowCount = 40; windSpeed = 2; break;
            case 95: theme = 'thunder'; summaryText = 'Gewitter'; rainCount = 40; windSpeed = 2.5; break;
            case 96: theme = 'thunder'; summaryText = 'Gewitter mit leichtem Hagel'; rainCount = 50; windSpeed = 3; break;
            case 99: theme = 'thunder'; summaryText = 'Gewitter mit starkem Hagel'; rainCount = 60; windSpeed = 3.5; break;
            default: theme = 'overcast'; summaryText = 'Bedeckt'; windSpeed = 0.5; break; // Fallback
        }

        // Optional: Wind (Blätter) - Hier könntest du `weatherData.windspeed_10m` prüfen, falls angefordert
        // Beispiel: if (weatherData.windspeed_10m > 20 && theme !== 'rain' && theme !== 'snow' && theme !== 'thunder') {
        //    theme = 'wind'; // Change theme to wind visually
        //    summaryText = 'Windig'; // Update summary text
        //    leafCount = 5;
        //    windSpeed = 3; // Set wind speed for wind theme
        //}

        // Anwenden der visuellen Änderungen und Animationen
        applyWeatherVisuals(theme, summaryText, windSpeed, rainCount, snowCount, leafCount);
    }

    function resetVisuals() {
        // Alle Klassen entfernen, die das Wetterthema steuern
        container.removeClass('sun rain snow thunder wind overcast');
        // Alle Animationszähler auf 0 setzen und laufende Tweens stoppen
        gsap.killTweensOf(settings); // Wichtig: Laufende Animationen der Settings stoppen
        gsap.to(settings, 1, { rainCount: 0, snowCount: 0, leafCount: 0, windSpeed: 0.5, ease: Power2.easeOut }); // Reset settings smoothly

        // Sonne ausblenden und Tweens stoppen
        gsap.killTweensOf(sun.node);
        gsap.killTweensOf(sunburst.node);
        gsap.to(sun.node, 1, { x: sizes.card.width / 2, y: -100, ease: Power2.easeInOut });
        gsap.to(sunburst.node, 1, { scale: 0.4, opacity: 0, y: sizes.offset.top + (sizes.card.height/2) - 50, ease: Power2.easeInOut });

         // Blitz-Timer stoppen
         if (lightningTimeout) clearTimeout(lightningTimeout);
    }

    function applyWeatherVisuals(theme, summaryText, windSpeed, rainCount, snowCount, leafCount) {
        resetVisuals(); // Erst alles zurücksetzen

        // Summary Text animieren
        gsap.killTweensOf(summary); // Vorherige Animation stoppen // *** KORRIGIERT (gsap statt TweenMax) ***
        gsap.to(summary, 0.1, { // Erst schnell ausblenden // *** KORRIGIERT (gsap statt TweenMax) ***
            opacity: 0,
            x: -30,
            ease: Power4.easeIn,
            onComplete: function() {
                summary.html(summaryText); // Text aktualisieren
                gsap.to(summary, 1.5, { // Dann einblenden // *** KORRIGIERT (gsap statt TweenMax) ***
                     opacity: 1,
                     x: 0,
                     ease: Power4.easeOut
                 });
            }
        });


        container.addClass(theme); // Neue Wetterklasse hinzufügen

        // Animationseinstellungen basierend auf dem Thema anpassen
        // Stoppe vorherige Animationen von 'settings' bevor neue gestartet werden
        gsap.killTweensOf(settings);
        gsap.to(settings, 3, { // *** KORRIGIERT (gsap statt TweenMax) ***
             windSpeed: windSpeed,
             rainCount: rainCount,
             snowCount: snowCount,
             leafCount: leafCount, // Add leaf count here
             ease: Power2.easeInOut // Use consistent easing
         });

        // Sonne und Blitz speziell behandeln
        if (theme === 'sun') {
             // Sonne einblenden
             gsap.to(sun.node, 4, { x: sizes.card.width / 2, y: sizes.card.height / 2, ease: Power2.easeInOut }); // *** KORRIGIERT (gsap statt TweenMax) ***
             gsap.to(sunburst.node, 4, { scale: 1, opacity: 0.8, y: sizes.offset.top + (sizes.card.height / 2), ease: Power2.easeInOut }); // *** KORRIGIERT (gsap statt TweenMax) ***
        }
         // else part for sun/sunburst is handled by resetVisuals

        if (theme === 'thunder') {
             startLightningTimer();
        }
        // else part for lightning is handled by resetVisuals
    }

    // ------------------- CORE ANIMATION LOGIC (angepasst auf gsap) -------------------

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
        cloud.path.attr({ d: path });
    }

    function makeRain() {
        var isThunder = container.hasClass('thunder');
        var lineWidth = Math.random() * 3;
        var lineLength = isThunder ? 35 : 14;
        var x = Math.random() * (sizes.card.width - 40) + 20;
        // Dynamically get holder based on width
        var holderIndex = 3 - Math.floor(lineWidth);
        var holder = window['innerRainHolder' + holderIndex]; // Access global var

        if (!holder || typeof holder.path !== 'function') return; // Check if holder and path method exist

        var line = holder.path('M0,0 0,' + lineLength).attr({
            fill: 'none',
            stroke: isThunder ? '#777' : '#0000ff',
            strokeWidth: lineWidth
        });

        rain.push(line);

        gsap.fromTo(line.node, 1, {x: x, y: 0 - lineLength}, {delay: Math.random(), y: sizes.card.height, ease: Power2.easeIn, onComplete: onRainEnd, onCompleteParams: [line, lineWidth, x, isThunder]}); // *** KORRIGIERT (gsap statt TweenMax) ***
    }

    function onRainEnd(line, width, x, isThunder) {
        if (line && typeof line.remove === 'function') line.remove();
        line = null;
        rain = rain.filter(item => item && item.paper);

        if(rain.length < settings.rainCount) {
            makeRain();
            if(width > 2) makeSplash(x, isThunder);
        }
    }

     function makeSplash(x, isThunder) {
        var type = isThunder ? 'thunder' : 'rain';
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

        if (!outerSplashHolder || typeof outerSplashHolder.path !== 'function') return;

        var splash = outerSplashHolder.path(points.join(' ')).attr({
            fill: "none",
            stroke: type === 'thunder' ? '#777' : '#0000ff',
            strokeWidth: 1
        });

        var pathLength;
        try {
            pathLength = splash.getTotalLength(); // Can throw error if path is degenerate
        } catch (e) {
            console.error("Error getting path length for splash:", e);
            if (splash && typeof splash.remove === 'function') splash.remove();
            return; // Don't animate if length is invalid
        }

        var xOffset = sizes.offset.left;
        var yOffset = sizes.offset.top + sizes.card.height;

        if (splash.node) { // Ensure node exists
            splash.node.style.strokeDasharray = pathLength + ' ' + pathLength;

             gsap.fromTo(splash.node, speed, // *** KORRIGIERT (gsap statt TweenMax) ***
               { strokeWidth: 2, y: yOffset, x: xOffset + x, opacity: 1, strokeDashoffset: pathLength },
               { strokeWidth: 0, strokeDashoffset: - pathLength, opacity: 1, onComplete: onSplashComplete, onCompleteParams: [splash], ease:  SlowMo.ease.config(0.4, 0.1, false) }
             );
         } else {
             // If node doesn't exist somehow, attempt removal
             if (splash && typeof splash.remove === 'function') splash.remove();
         }
    }

    function onSplashComplete(splash) {
        if (splash && typeof splash.remove === 'function') splash.remove();
        splash = null;
    }

     function makeLeaf() {
        var scale = 0.5 + (Math.random() * 0.5);
        var newLeaf;
        var areaY = sizes.card.height / 2;
        var y = areaY + (Math.random() * areaY);
        var endY = y - ((Math.random() * (areaY * 2)) - areaY)
        var x, endX, xBezier;
        var colors = ['#76993E', '#4A5E23', '#6D632F'];
        var color = colors[Math.floor(Math.random() * colors.length)];

        var targetHolder; // Decide where the leaf goes

        if (scale > 0.8 && outerLeafHolder && typeof outerLeafHolder.group === 'object') { // Outside leaf
            targetHolder = outerLeafHolder;
            y = y + sizes.offset.top / 2;
            endY = endY + sizes.offset.top / 2;
            x = sizes.offset.left + sizes.card.width;
            xBezier = x + (sizes.container.width - x) / 2;
            endX = sizes.container.width + 50;
        } else if (innerLeafHolder && typeof innerLeafHolder.group === 'object') { // Inside leaf
            targetHolder = innerLeafHolder;
            x = -100;
            xBezier = sizes.card.width / 2;
            endX = sizes.card.width + 50;
        } else {
            return; // No valid holder found
        }

         // Clone leaf and append to the chosen holder
         try {
            newLeaf = leaf.clone();
            if (targetHolder && typeof targetHolder.append === 'function') { // Check if append method exists
                targetHolder.append(newLeaf);
            } else {
                 console.error("Target holder cannot append:", targetHolder);
                 return;
            }
            newLeaf.attr({ fill: color }); // Set color after appending
         } catch (e) {
             console.error("Error cloning/appending leaf:", e);
             return;
         }


        // Apply mask if it's an outer leaf
        if (targetHolder === outerLeafHolder && leafMask) {
            newLeaf.attr({'clip-path': leafMask});
        }

        leafs.push(newLeaf);

        var bezier = [{x:x, y:y}, {x: xBezier, y:(Math.random() * endY) + (endY / 3)}, {x: endX, y:endY}];
        gsap.fromTo(newLeaf.node, 2 + Math.random()*2, // *** KORRIGIERT (gsap statt TweenMax) ***
             { rotation: Math.random()* 180, x: x, y: y, scale:scale },
             { rotation: Math.random()* 360, bezier: bezier, onComplete: onLeafEnd, onCompleteParams: [newLeaf], ease: Power0.easeIn }
        );
    }


    function onLeafEnd(leafToRemove) {
        if (leafToRemove && typeof leafToRemove.remove === 'function') leafToRemove.remove();
        leafToRemove = null;
        leafs = leafs.filter(item => item && item.paper);

        if(leafs.length < settings.leafCount) {
            makeLeaf();
        }
    }

    function makeSnow() {
        var scale = 0.5 + (Math.random() * 0.5);
        var newSnow;
        var x = 20 + (Math.random() * (sizes.card.width - 40));
        var y = -10;
        var endY;
        var targetHolder;

        if (scale > 0.8 && outerSnowHolder && typeof outerSnowHolder.circle === 'function') { // Outside snow
            targetHolder = outerSnowHolder;
            endY = sizes.container.height + 10;
            y = sizes.offset.top + settings.cloudHeight;
            x = x + sizes.offset.left;
        } else if (innerSnowHolder && typeof innerSnowHolder.circle === 'function') { // Inside snow
            targetHolder = innerSnowHolder;
            endY = sizes.card.height + 10;
        } else {
            return; // No valid holder
        }

        try {
            newSnow = targetHolder.circle(0, 0, 5).attr({ fill: 'white' });
        } catch(e) {
            console.error("Error creating snow circle:", e);
            return;
        }


        snow.push(newSnow);

        gsap.fromTo(newSnow.node, 3 + (Math.random() * 5), {x: x, y: y}, {y: endY, onComplete: onSnowEnd, onCompleteParams: [newSnow], ease: Power0.easeIn}); // *** KORRIGIERT (gsap statt TweenMax) ***
        gsap.fromTo(newSnow.node, 1,{scale: 0}, {scale: scale, ease: Power1.easeInOut}); // *** KORRIGIERT (gsap statt TweenMax) ***
        gsap.to(newSnow.node, 3, {x: x+((Math.random() * 150)-75), repeat: -1, yoyo: true, ease: Power1.easeInOut}); // *** KORRIGIERT (gsap statt TweenMax) ***
    }


    function onSnowEnd(flake) {
        if (flake && typeof flake.remove === 'function') flake.remove();
        flake = null;
        snow = snow.filter(item => item && item.paper);

        if(snow.length < settings.snowCount) {
            makeSnow();
        }
    }

    function startLightningTimer() {
        if(lightningTimeout) clearTimeout(lightningTimeout);
        if(container.hasClass('thunder')) {
            lightningTimeout = setTimeout(lightning, Math.random()*6000 + 1000);
        }
    }

    function lightning() {
        startLightningTimer();
        gsap.fromTo(card, 0.75, {y: -30}, {y:0, ease:Elastic.easeOut}); // *** KORRIGIERT (gsap statt TweenMax) ***

        var pathX = 30 + Math.random() * (sizes.card.width - 60);
        var yOffset = 20;
        var steps = 20;
        var points = [pathX + ',0'];
        for(var i = 0; i < steps; i++) {
            var x = pathX + (Math.random() * yOffset - (yOffset / 2));
            var y = (sizes.card.height / steps) * (i + 1)
            points.push(x + ',' + y);
        }

        if (!innerLightningHolder || typeof innerLightningHolder.path !== 'function') return;

        var strike;
        try {
             strike = innerLightningHolder.path('M' + points.join(' '))
             .attr({
                 fill: 'none',
                 stroke: 'white',
                 strokeWidth: 2 + Math.random()
             });
        } catch (e) {
             console.error("Error creating lightning strike path:", e);
             return;
        }


        gsap.to(strike.node, 1, {opacity: 0, ease:Power4.easeOut, onComplete: function(){ if(strike && typeof strike.remove === 'function') strike.remove(); strike = null; }}); // *** KORRIGIERT (gsap statt TweenMax) ***
    }


    function tick() {
        tickCount++;
        var check = tickCount % settings.renewCheck;

        if (check === 0) {
            if(settings.rainCount > 0 && rain.length < settings.rainCount) makeRain();
            if(settings.leafCount > 0 && leafs.length < settings.leafCount) makeLeaf();
            if(settings.snowCount > 0 && snow.length < settings.snowCount) makeSnow();
        }

        // Cloud Animation
        for(var i = 0; i < clouds.length; i++) {
            if (!clouds[i] || !clouds[i].group || typeof clouds[i].group.transform !== 'function') continue; // Check if group and transform exist

            var cloud = clouds[i];
            var divisor = (i + 1);
            var speed = settings.windSpeed / divisor;

            cloud.offset += speed;

            var cloudWidth = sizes.card.width * 2;
             if (settings.windSpeed > 0 && cloud.offset > sizes.card.width + cloudWidth / 2) {
                  cloud.offset -= (cloudWidth + sizes.card.width);
              } else if (settings.windSpeed < 0 && cloud.offset < -(cloudWidth / 2)) {
                  cloud.offset += (cloudWidth + sizes.card.width);
              }

             // Apply transformation using Snap SVG's transform method
             try {
                 clouds[i].group.transform('t' + cloud.offset + ',' + 0);
             } catch (e) {
                 console.error("Error transforming cloud:", e, clouds[i].group);
             }
        }

        requestAnimationFrame(tick);
    }

    // App initialisieren
    init();

}); // End $(document).ready