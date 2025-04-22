// scripts.js – Vollständige Version mit Cloud‑Fix

$(document).ready(function() {

    // --- Globale Variablen & Snap.svg Referenzen ---
    var $container = $('.container');
    var $card      = $('#card');
    var innerSVG   = Snap('#inner');
    var outerSVG   = Snap('#outer');
    var backSVG    = Snap('#back');
    var $description      = $('#description');
    var $date             = $('#date');
    var $location         = $('#location');
    var $temp             = $('.temp');
    var $overlayContainer = $('#overlay-container');

    var weatherContainer1     = Snap.select('#layer1'),
        weatherContainer2     = Snap.select('#layer2'),
        weatherContainer3     = Snap.select('#layer3');

    var innerRainHolder1   = weatherContainer1.group(),
        innerRainHolder2   = weatherContainer2.group(),
        innerRainHolder3   = weatherContainer3.group(),
        innerLeafHolder    = weatherContainer1.group(),
        innerSnowHolder    = weatherContainer1.group(),
        innerLightningHolder = weatherContainer1.group();

    var leafMask = outerSVG.rect(),
        leaf     = Snap.select('#leaf'),
        sun      = Snap.select('#sun'),
        sunburst = Snap.select('#sunburst');

    var outerSplashHolder = outerSVG.group(),
        outerLeafHolder   = outerSVG.group();

    // --- API‑ & Autocomplete‑Zustand ---
    const GEOAPIFY_API_KEY = '6b73ef3534d24e6f9f9cbbd26bdf2e99';
    let currentCoords     = null,
        currentCityName   = null,
        currentApiData    = null;

    let autocompleteTimeout,
        currentSuggestions = [];

    // --- Animations‑ & Wetter‑Mapping ---
    var lightningTimeout;
    var sizes = {
        container: { width: 0, height: 0 },
        card:      { width: 0, height: 0 },
        cardOffset:{ top: 0, left: 0 }
    };

    var clouds = [
        { group: Snap.select('#cloud1') },
        { group: Snap.select('#cloud2') },
        { group: Snap.select('#cloud3') }
    ];

    var weatherTypes = [
        { type: 'snow',    name: 'Schnee' },
        { type: 'wind',    name: 'Windig' },
        { type: 'rain',    name: 'Regen' },
        { type: 'thunder', name: 'Gewitter' },
        { type: 'fog',     name: 'Nebel' },
        { type: 'cloud',   name: 'Bewölkt' },
        { type: 'sun',     name: 'Sonnig' }
    ];

    var currentWeatherType = weatherTypes.find(w => w.type === 'sun');

    var settings = {
        windSpeed:    2,
        rainCount:    0,
        leafCount:    0,
        snowCount:    0,
        cloudHeight:  100,
        cloudSpace:   30,
        cloudArch:    50,
        renewCheck:   10,
        splashBounce: 80
    };

    var tickCount = 0,
        rain      = [],
        leafs     = [],
        snow      = [];

    const weatherConditions = {
        0:  { desc: 'Klarer Himmel' },
        1:  { desc: 'Überwiegend klar' },
        2:  { desc: 'Teilweise bewölkt' },
        3:  { desc: 'Bedeckt' },
        45: { desc: 'Nebel' },
        48: { desc: 'Gefrierender Nebel' },
        51: { desc: 'Leichter Nieselregen' },
        53: { desc: 'Mäßiger Nieselregen' },
        55: { desc: 'Starker Nieselregen' },
        56: { desc: 'Leichter gefrierender Nieselregen' },
        57: { desc: 'Starker gefrierender Nieselregen' },
        61: { desc: 'Leichter Regen' },
        63: { desc: 'Mäßiger Regen' },
        65: { desc: 'Starker Regen' },
        66: { desc: 'Gefrierender Regen' },
        67: { desc: 'Gefrierender Regen' },
        71: { desc: 'Leichter Schneefall' },
        73: { desc: 'Mäßiger Schneefall' },
        75: { desc: 'Starker Schneefall' },
        77: { desc: 'Schneekörner' },
        80: { desc: 'Leichte Regenschauer' },
        81: { desc: 'Mäßige Regenschauer' },
        82: { desc: 'Heftige Regenschauer' },
        85: { desc: 'Leichte Schneeschauer' },
        86: { desc: 'Starke Schneeschauer' },
        95: { desc: 'Gewitter' },
        96: { desc: 'Gewitter mit leichtem Hagel' },
        99: { desc: 'Gewitter mit starkem Hagel' }
    };
    function getWeatherCondition(code) {
        return weatherConditions[code] || { desc: `Wettercode ${code}` };
    }

    // ⚙ App‑Initialisierung
    function init() {
        onResize();

        // 🚀 Clouds initial zeichnen
        for (var i = 0; i < clouds.length; i++) {
            clouds[i].offset = Math.random() * sizes.card.width;
            drawCloud(clouds[i], i);
        }

        // Sonne & Sunburst initial verstecken
        TweenMax.set(sun.node, { x: sizes.card.width / 2, y: -100 });
        TweenMax.set(sunburst.node, { opacity: 0 });

        setupEventListeners();
        requestAnimationFrame(tick);
        $(window).resize(onResize);

        // Default‑Stadt
        getWeatherByCityName('Dortmund');
    }

    // 📐 Resize Handler
    function onResize() {
        sizes.container.width  = $container.width();
        sizes.container.height = $container.height();
        sizes.card.width       = $card.width();
        sizes.card.height      = $card.height();

        var cO = $card.offset();
        sizes.cardOffset.top  = cO ? cO.top  : 0;
        sizes.cardOffset.left = cO ? cO.left : 0;

        innerSVG.attr({ width: sizes.card.width, height: sizes.card.height });
        outerSVG.attr({ width: sizes.container.width, height: sizes.container.height });
        backSVG.attr({ width: sizes.container.width, height: sizes.container.height });

        // Sunburst zentrieren & rotieren
        TweenMax.set(sunburst.node, {
            transformOrigin: "50% 50%",
            x: sizes.container.width / 2,
            y: (sizes.card.height / 2) + sizes.cardOffset.top
        });
        if (!TweenMax.isTweening(sunburst.node)) {
            TweenMax.fromTo(sunburst.node, 20, { rotation: 0 }, { rotation: 360, repeat: -1, ease: Power0.easeInOut });
        }

        // Leaf‑Mask positionieren
        leafMask.attr({
            x:      sizes.cardOffset.left,
            y:      0,
            width:  sizes.container.width - sizes.cardOffset.left,
            height: sizes.container.height
        });
        outerLeafHolder.attr({ 'clip-path': leafMask });
    }

    // ☁️ Cloud‑Zeichnung (oben bei Y=0)
    function drawCloud(cloud, i) {
        var space  = settings.cloudSpace * i;
        var height = space + settings.cloudHeight;
        var arch   = height + settings.cloudArch + (Math.random() * settings.cloudArch);
        var width  = sizes.card.width;

        var pathData = [
            'M'   + [ -width, 0 ].join(','),
            [ width, 0 ].join(','),
            'Q'   + [ width * 2, height / 2 ].join(','),
            [ width, height ].join(','),
            'Q'   + [ width * 0.5, arch ].join(','),
            [ 0, height ].join(','),
            'Q'   + [ -width * 0.5, arch ].join(','),
            [ -width, height ].join(','),
            'Q'   + [ -width * 2, height / 2 ].join(','),
            [ -width, 0 ].join(',')
        ].join(' ');

        if (!cloud.path) {
            cloud.path = cloud.group.path();
        }
        cloud.path.attr({ d: pathData });
    }

    // 💧 Regen-Drop
    function makeRain() {
        var lineWidth  = Math.random() * 3;
        var lineLength = currentWeatherType.type == 'thunder' ? 35 : 14;
        var x = Math.random() * (sizes.card.width - 40) + 20;
        var layerIndex = Math.floor(lineWidth);
        var holder = layerIndex <= 0 ? innerRainHolder3 : (layerIndex === 1 ? innerRainHolder2 : innerRainHolder1);

        var drop = holder.path('M0,0 0,' + lineLength).attr({
            fill: 'none',
            stroke: currentWeatherType.type == 'thunder' ? '#777' : '#0000ff',
            strokeWidth: lineWidth
        });
        rain.push(drop);
        TweenMax.fromTo(drop.node, 1, { x: x, y: -lineLength }, {
            delay: Math.random(),
            y: sizes.card.height,
            ease: Power2.easeIn,
            onComplete: onRainEnd,
            onCompleteParams: [drop, lineWidth, x, currentWeatherType.type]
        });
    }
    function onRainEnd(drop, width, x, type) {
        if (drop.remove) drop.remove();
        rain = rain.filter(r => r.paper);
        if (rain.length < settings.rainCount) makeRain();
        if (width > 2) makeSplash(x, type);
    }

    // 💦 Splash
    function makeSplash(x, type) {
        var splashLength  = type == 'thunder' ? 30 : 20;
        var splashBounce  = type == 'thunder' ? 120 : 100;
        var splashDistance= 80;
        var speed         = type == 'thunder' ? 0.7 : 0.5;
        var up            = -(Math.random() * splashBounce);
        var randomX       = (Math.random() * splashDistance) - (splashDistance / 2);

        var pts = ['M0,0',
                   'Q' + randomX + ',' + up,
                   (randomX * 2) + ',' + splashDistance].join(' ');
        var splash = outerSplashHolder.path(pts).attr({
            fill: 'none',
            stroke: type == 'thunder' ? '#777' : '#0000ff',
            strokeWidth: 1
        });

        var pathLen = Snap.path.getTotalLength(splash);
        splash.node.style.strokeDasharray = pathLen + ' ' + pathLen;

        TweenMax.fromTo(splash.node, speed, {
            strokeWidth: 2,
            y: sizes.cardOffset.top + sizes.card.height,
            x: sizes.cardOffset.left + 20 + x,
            opacity: 1,
            strokeDashoffset: pathLen
        }, {
            strokeWidth: 0,
            strokeDashoffset: -pathLen,
            opacity: 1,
            onComplete: onSplashComplete,
            onCompleteParams: [splash],
            ease: SlowMo.ease.config(0.4, 0.1, false)
        });
    }
    function onSplashComplete(splash) {
        if (splash.remove) splash.remove();
    }

    // 🍃 Leaf
    function makeLeaf() {
        var scale = 0.5 + (Math.random() * 0.5);
        var newLeaf, x, y, endX, endY, xBezier;
        var colors = ['#76993E','#4A5E23','#6D632F'];
        var color  = colors[Math.floor(Math.random() * colors.length)];

        var areaY = sizes.card.height / 2;
        y        = areaY + (Math.random() * areaY);
        endY     = y - ((Math.random() * (areaY * 2)) - areaY);

        if (scale > 0.8) {
            newLeaf = leaf.clone().appendTo(outerLeafHolder).attr({ fill: color });
            y     += sizes.cardOffset.top / 2;
            endY  += sizes.cardOffset.top / 2;
            x      = sizes.cardOffset.left - 100;
            xBezier= x + (sizes.container.width - sizes.cardOffset.left) / 2;
            endX   = sizes.container.width + 50;
        } else {
            newLeaf = leaf.clone().appendTo(innerLeafHolder).attr({ fill: color });
            x       = -100;
            xBezier = sizes.card.width / 2;
            endX    = sizes.card.width + 50;
        }

        leafs.push(newLeaf);
        var bezier = [{ x: x, y: y },
                      { x: xBezier, y: (Math.random() * endY) + (endY / 3) },
                      { x: endX, y: endY }];

        TweenMax.fromTo(newLeaf.node, 2, {
            rotation: Math.random() * 180,
            x: x, y: y, scale: scale
        }, {
            rotation: Math.random() * 360,
            bezier: bezier,
            onComplete: onLeafEnd,
            onCompleteParams: [newLeaf],
            ease: Power0.easeIn
        });
    }
    function onLeafEnd(leaf) {
        if (leaf.remove) leaf.remove();
        leafs = leafs.filter(l => l.paper);
        if (leafs.length < settings.leafCount) makeLeaf();
    }

    // ❄️ Snow
    function makeSnow() {
        var scale = 0.5 + (Math.random() * 0.5);
        var x     = 20 + (Math.random() * (sizes.card.width - 40));
        var y     = settings.cloudHeight - 10;
        var endY  = sizes.card.height + 10;

        var flake = innerSnowHolder.circle(0, 0, 5).attr({ fill: 'white' });
        snow.push(flake);

        TweenMax.fromTo(flake.node, 3 + (Math.random() * 5), {
            x: x, y: y
        }, {
            y: endY,
            onComplete: onSnowEnd.bind(null, flake),
            ease: Power0.easeIn
        });
        TweenMax.fromTo(flake.node, 1, { scale: 0 }, { scale: scale, ease: Power1.easeInOut });
        TweenMax.to(flake.node, 3, { x: x + ((Math.random() * 150) - 75), repeat: -1, yoyo: true, ease: Power1.easeInOut });
    }
    function onSnowEnd(flake) {
        if (flake.remove) flake.remove();
        snow = snow.filter(s => s.paper);
        if (snow.length < settings.snowCount) makeSnow();
    }

    // 🔄 Animations‑Loop (tick)
    function tick() {
        tickCount++;
        var check = tickCount % settings.renewCheck;

        if (check) {
            if (rain.length  < settings.rainCount) makeRain();
            if (leafs.length < settings.leafCount) makeLeaf();
            if (snow.length  < settings.snowCount) makeSnow();
        }

        // Clouds: nur X‑Translation, Y bleibt 0
        for (var i = 0; i < clouds.length; i++) {
            var cloud = clouds[i];
            cloud.offset += settings.windSpeed / (i + 1);
            if (cloud.offset > sizes.card.width) {
                cloud.offset -= sizes.card.width;
            }
            cloud.group.transform('t' + cloud.offset + ',0');
        }

        requestAnimationFrame(tick);
    }

    // 🌡️ Mapping & Wetterwechsel
    function mapWeatherCodeToType(code, windSpeed) {
        var wc = Number(code), ws = Number(windSpeed);
        if (wc <= 1) return 'sun';
        if (wc === 95 || wc === 96 || wc === 99) return 'thunder';
        if ((wc >= 51 && wc <= 67) || (wc >= 80 && wc <= 82)) return 'rain';
        if ((wc >= 71 && wc <= 77) || (wc >= 85 && wc <= 86)) return 'snow';
        if (wc === 45 || wc === 48) return 'fog';
        if (wc === 2 || wc === 3) return ws >= 25 ? 'wind' : 'cloud';
        return 'sun';
    }

    function changeWeather(typeKey) {
        var w = weatherTypes.find(w => w.type === typeKey) || weatherTypes.find(w => w.type === 'sun');
        weatherTypes.forEach(wt => $container.removeClass(wt.type));
        $container.addClass(w.type);
        currentWeatherType = w;

        // WindSpeed
        var tws = w.type === 'wind' ? 5 : (w.type === 'sun' ? 10 : (w.type === 'thunder' ? 0.8 : 0.5));
        TweenMax.to(settings, 3, { windSpeed: tws, ease: Power2.easeInOut });

        // rainCount
        var trc = w.type === 'rain' ? 20 : (w.type === 'thunder' ? 50 : 0);
        TweenMax.to(settings, 3, { rainCount: trc, ease: Power2.easeInOut });

        // leafCount
        var tlc = w.type === 'wind' ? 7 : 0;
        TweenMax.to(settings, 3, { leafCount: tlc, ease: Power2.easeInOut });

        // snowCount
        var tsc = w.type === 'snow' ? 30 : 0;
        TweenMax.to(settings, 3, { snowCount: tsc, ease: Power2.easeInOut });

        // Sonne Position
        if (w.type === 'sun') {
            TweenMax.to(sun.node,     4, { x: sizes.card.width/2, y: sizes.card.height*0.35, opacity:1, ease: Power2.easeInOut });
            TweenMax.to(sunburst.node,4, { scale:1, opacity:0.8, y:(sizes.card.height*0.35)+sizes.cardOffset.top, ease: Power2.easeInOut });
        } else {
            TweenMax.to(sun.node,     2, { y:-100, opacity:0, ease: Power2.easeIn });
            TweenMax.to(sunburst.node,2, { scale:0.4, opacity:0, y:(sizes.container.height/2)-50, ease: Power2.easeIn });
        }

        startLightningTimer();
    }

    // ⚡ Lightning
    function startLightningTimer() {
        if (lightningTimeout) clearTimeout(lightningTimeout);
        if (currentWeatherType.type === 'thunder') {
            lightningTimeout = setTimeout(lightning, Math.random() * 6000 + 2000);
        }
    }

    function lightning() {
        startLightningTimer();
        TweenMax.fromTo($card, 0.75, { y: -10 }, { y: 0, ease: Elastic.easeOut });

        var pathX   = 30 + Math.random() * (sizes.card.width - 60),
            yOffset = 20,
            steps   = 20,
            pts     = [pathX + ',0'];

        for (var i = 0; i < steps; i++) {
            var x = pathX + (Math.random() * yOffset - yOffset/2),
                y = (sizes.card.height / steps) * (i + 1);
            pts.push(x + ',' + y);
        }

        var strike = innerLightningHolder.path('M' + pts.join(' ')).attr({
            fill: 'none',
            stroke: 'white',
            strokeWidth: 2 + Math.random()
        });

        TweenMax.to(strike.node, 1, {
            opacity: 0,
            ease: Power4.easeOut,
            onComplete: function() { strike.remove(); }
        });
    }

    // 📡 Overlay Messages
    function showOverlayMessage(type, message) {
        $overlayContainer.empty();
        var icon = type === 'loading' ? 'fas fa-spinner fa-spin'
                  : type === 'error'   ? 'fas fa-triangle-exclamation'
                                         : 'fas fa-map-location-dot';
        var cls  = type + '-state';
        var html = '<div class="' + cls + '"><i class="' + icon + '"></i><div>' + message + '</div></div>';
        $overlayContainer.html(html);
    }
    function hideOverlayMessage() {
        $overlayContainer.empty();
    }

    // 🌤️ Daten rendern
    function renderWeatherData(locationName, weatherData) {
        hideOverlayMessage();
        var current = weatherData.current;
        currentApiData = weatherData;

        $temp.html(Math.round(current.temperature_2m) + '<span>°C</span>');
        $location.text(locationName);
        $description.text(getWeatherCondition(current.weathercode).desc);
        $date.text(new Date().toLocaleDateString('de-DE', { weekday:'long', day:'numeric', month:'long' }));

        var mapped = mapWeatherCodeToType(current.weathercode, current.windspeed_10m);
        changeWeather(mapped);
    }

    // 🌐 API‑Aufrufe
    async function getWeatherFromCoords(lat, lon, locationName) {
        currentCoords   = { lat, lon };
        currentCityName = locationName;
        showOverlayMessage('loading', 'Lade Wetter für ' + locationName + '...');
        TweenMax.to(settings, 1, { rainCount:0, leafCount:0, snowCount:0 });

        var params = [
            'latitude=' + lat.toFixed(4),
            'longitude=' + lon.toFixed(4),
            'current=temperature_2m,weathercode,windspeed_10m',
            'temperature_unit=celsius',
            'windspeed_unit=kmh',
            'timezone=auto'
        ].join('&');

        var url = 'https://api.open-meteo.com/v1/forecast?' + params;
        try {
            var res = await fetch(url);
            if (!res.ok) throw new Error('API Fehler: ' + res.status);
            var data = await res.json();
            if (!data.current) throw new Error('Unvollständige Daten.');
            renderWeatherData(locationName, data);
        } catch (err) {
            console.error(err);
            handleFetchError(err);
        }
    }

    async function getWeatherByCityName(city) {
        if (!city) { showError('Bitte gib einen Stadtnamen ein.'); return; }
        showOverlayMessage('loading', 'Suche Stadt...');
        hideAutocomplete();

        try {
            var geoR = await fetch(
                'https://api.geoapify.com/v1/geocode/search?text=' +
                encodeURIComponent(city) +
                '&limit=1&lang=de&format=json&apiKey=' +
                GEOAPIFY_API_KEY
            );
            if (!geoR.ok) throw new Error('Geoapify Fehler');
            var geoD = await geoR.json();
            if (!geoD.results || geoD.results.length === 0) throw new Error('Stadt nicht gefunden.');
            var r = geoD.results[0];
            var name = r.city || r.formatted;
            await getWeatherFromCoords(r.lat, r.lon, name);
        } catch (err) {
            console.error(err);
            handleFetchError(err);
        }
    }

    function getLocationWeather() {
        if (!navigator.geolocation) { showError('Geolocation nicht unterstützt.'); return; }
        showOverlayMessage('loading', 'Ermittle Standort...');
        navigator.geolocation.getCurrentPosition(async function(pos) {
            var lat = pos.coords.latitude,
                lon = pos.coords.longitude;
            try {
                var rev = await fetch(
                    'https://api.geoapify.com/v1/geocode/reverse?lat=' +
                    lat + '&lon=' + lon +
                    '&lang=de&format=json&apiKey=' +
                    GEOAPIFY_API_KEY
                );
                var locName = 'Lat ' + lat.toFixed(2) + ', Lon ' + lon.toFixed(2);
                if (rev.ok) {
                    var locD = await rev.json();
                    if (locD.results.length > 0) {
                        locName = locD.results[0].city ||
                                  locD.results[0].village ||
                                  locD.results[0].suburb ||
                                  locD.results[0].formatted;
                    }
                }
                await getWeatherFromCoords(lat, lon, locName);
            } catch (err) {
                console.error(err);
                await getWeatherFromCoords(lat, lon, 'Lat ' + lat.toFixed(2) + ', Lon ' + lon.toFixed(2));
            }
        }, function(err) {
            handleGeolocationError(err);
        }, { enableHighAccuracy: false, timeout:10000, maximumAge:300000 });
    }

    function handleGeolocationError(error) {
        var msg = 'Standort nicht ermittelt.';
        if (error.code === 1) msg = 'Zugriff verweigert.';
        if (error.code === 2) msg = 'Position nicht verfügbar.';
        if (error.code === 3) msg = 'Timeout.';
        showError(msg);
    }

    function handleFetchError(error) {
        var msg = 'Fehler.';
        var m   = error.message.toLowerCase();
        if (m.includes('stadt')) msg = error.message;
        else if (m.includes('network') || m.includes('fetch')) msg = 'Netzwerkfehler.';
        else if (m.includes('api')) msg = 'API Problem.';
        showError(msg);
    }

    function showError(message) {
        showOverlayMessage('error', message);
        changeWeather('sun');
    }

    // 🔍 Autocomplete
    function handleAutocompleteInput(e) {
        clearTimeout(autocompleteTimeout);
        var query = e.target.value.trim();
        if (query.length < 2) {
            hideAutocomplete();
            return;
        }
        autocompleteTimeout = setTimeout(async function() {
            try {
                var res = await fetch(
                    'https://api.geoapify.com/v1/geocode/autocomplete?text=' +
                    encodeURIComponent(query) +
                    '&type=city&lang=de&limit=5&format=json&apiKey=' +
                    GEOAPIFY_API_KEY
                );
                if (!res.ok) throw new Error('Autocomplete API failed');
                var data = await res.json();
                currentSuggestions = data.results || [];
                showAutocompleteSuggestions(currentSuggestions);
            } catch (err) {
                console.error(err);
                hideAutocomplete();
            }
        }, 300);
    }

    function showAutocompleteSuggestions(suggestions) {
        var dd = $('#autocomplete-dropdown').empty();
        if (!suggestions.length) return hideAutocomplete();
        suggestions.forEach(function(s) {
            var city = s.city || s.name || s.address_line1,
                country = s.country || '',
                display = city && country ? city + ', ' + country : s.formatted;
            var $item = $('<div>')
                .addClass('autocomplete-item')
                .attr('data-lat', s.lat)
                .attr('data-lon', s.lon)
                .attr('data-name', display)
                .html(highlightMatch(display, $('#city-input').val()));
            $item.on('click', function() {
                $('#city-input').val(display);
                hideAutocomplete();
                getWeatherFromCoords(s.lat, s.lon, display);
            });
            dd.append($item);
        });
        dd.show();
    }

    function hideAutocomplete() {
        $('#autocomplete-dropdown').hide().empty();
        currentSuggestions = [];
    }

    function handleInputKeydown(e) {
        var dd = $('#autocomplete-dropdown');
        if (e.key === 'Enter') {
            e.preventDefault();
            if (dd.is(':visible') && currentSuggestions.length) {
                dd.find('.autocomplete-item').first().click();
            } else {
                hideAutocomplete();
                getWeatherByCityName($('#city-input').val());
            }
        }
        if (e.key === 'Escape') hideAutocomplete();
    }

    function handleClickOutsideAutocomplete(e) {
        if (!$(e.target).closest('.autocomplete-container').length) {
            hideAutocomplete();
        }
    }

    function handleEscapeKey(e) {
        if (e.key === 'Escape') hideAutocomplete();
    }

    function highlightMatch(text, query) {
        if (!query) return text;
        var esc = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return text.replace(new RegExp('(' + esc + ')', 'gi'), '<b>$1</b>');
    }

    // 🚀 Start
    init();

}); // Ende jQuery ready
