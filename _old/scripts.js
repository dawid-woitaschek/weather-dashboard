// scripts.js – Vollständige Version mit Cloud‑Fix und Event Listener Setup

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

    var innerRainHolder1    = weatherContainer1.group(),
        innerRainHolder2    = weatherContainer2.group(),
        innerRainHolder3    = weatherContainer3.group(),
        innerLeafHolder     = weatherContainer1.group(),
        innerSnowHolder     = weatherContainer1.group(),
        innerLightningHolder= weatherContainer1.group();

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
        currentSuggestions=[];

    // --- Animations‑ & Wetter‑Mapping ---
    var lightningTimeout;
    var sizes = {
        container: { width:0, height:0 },
        card:      { width:0, height:0 },
        cardOffset:{ top:0, left:0 }
    };

    var clouds = [
        { group: Snap.select('#cloud1') },
        { group: Snap.select('#cloud2') },
        { group: Snap.select('#cloud3') }
    ];

    var weatherTypes = [
        { type:'snow',    name:'Schnee' },
        { type:'wind',    name:'Windig' },
        { type:'rain',    name:'Regen' },
        { type:'thunder', name:'Gewitter' },
        { type:'fog',     name:'Nebel' },
        { type:'cloud',   name:'Bewölkt' },
        { type:'sun',     name:'Sonnig' }
    ];

    var currentWeatherType = weatherTypes.find(w => w.type==='sun');

    var settings = {
        windSpeed:   2,
        rainCount:   0,
        leafCount:   0,
        snowCount:   0,
        cloudHeight: 100,
        cloudSpace:  30,
        cloudArch:   50,
        renewCheck:  10,
        splashBounce:80
    };

    var tickCount = 0, rain = [], leafs = [], snow = [];

    const weatherConditions = {
        0:  { desc:'Klarer Himmel' },
        1:  { desc:'Überwiegend klar' },
        2:  { desc:'Teilweise bewölkt' },
        3:  { desc:'Bedeckt' },
        45: { desc:'Nebel' },
        48: { desc:'Gefrierender Nebel' },
        51: { desc:'Leichter Nieselregen' },
        53: { desc:'Mäßiger Nieselregen' },
        55: { desc:'Starker Nieselregen' },
        56: { desc:'Leichter gefrierender Nieselregen' },
        57: { desc:'Starker gefrierender Nieselregen' },
        61: { desc:'Leichter Regen' },
        63: { desc:'Mäßiger Regen' },
        65: { desc:'Starker Regen' },
        66: { desc:'Gefrierender Regen' },
        67: { desc:'Gefrierender Regen' },
        71: { desc:'Leichter Schneefall' },
        73: { desc:'Mäßiger Schneefall' },
        75: { desc:'Starker Schneefall' },
        77: { desc:'Schneekörner' },
        80: { desc:'Leichte Regenschauer' },
        81: { desc:'Mäßige Regenschauer' },
        82: { desc:'Heftige Regenschauer' },
        85: { desc:'Leichte Schneeschauer' },
        86: { desc:'Starke Schneeschauer' },
        95: { desc:'Gewitter' },
        96: { desc:'Gewitter mit leichtem Hagel' },
        99: { desc:'Gewitter mit starkem Hagel' }
    };
    function getWeatherCondition(code) {
        return weatherConditions[code] || { desc:`Wettercode ${code}` };
    }

    // ⚙ App‑Initialisierung
    function init() {
        onResize();

        // Clouds initial zeichnen
        for (var i=0; i<clouds.length; i++) {
            clouds[i].offset = Math.random() * sizes.card.width;
            drawCloud(clouds[i], i);
        }

        // Sonne initial verstecken
        TweenMax.set(sun.node,     { x: sizes.card.width/2, y: -100 });
        TweenMax.set(sunburst.node,{ opacity: 0 });

        setupEventListeners();
        requestAnimationFrame(tick);
        $(window).resize(onResize);

        // Default‑City
        getWeatherByCityName('Dortmund');
    }

    // 🖱 Event Listener Setup
    function setupEventListeners() {
        $('#search-btn').on('click', () => getWeatherByCityName($('#city-input').val()));
        $('#location-btn').on('click', getLocationWeather);
        $('#city-input').on('input',  handleAutocompleteInput);
        $('#city-input').on('keydown', handleInputKeydown);
        $(document).on('click',  handleClickOutsideAutocomplete);
        $(document).on('keydown', handleEscapeKey);
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
            transformOrigin:"50% 50%",
            x: sizes.container.width/2,
            y: (sizes.card.height/2) + sizes.cardOffset.top
        });
        if (!TweenMax.isTweening(sunburst.node)) {
            TweenMax.fromTo(sunburst.node, 20, {rotation:0}, {rotation:360,repeat:-1,ease:Power0.easeInOut});
        }

        // Leaf‑Mask definieren
        leafMask.attr({
            x: sizes.cardOffset.left,
            y: 0,
            width: sizes.container.width - sizes.cardOffset.left,
            height: sizes.container.height
        });
        outerLeafHolder.attr({ 'clip-path': leafMask });
    }

    // ☁️ Cloud‑Zeichnung (oben bei Y=0)
    function drawCloud(cloud, i) {
        var space  = settings.cloudSpace * i;
        var height = space + settings.cloudHeight;
        var arch   = height + settings.cloudArch + (Math.random()*settings.cloudArch);
        var width  = sizes.card.width;

        var pathData = [
            'M' + [-width,0].join(','),
            [width,0].join(','),
            'Q' + [width*2, height/2].join(','),
            [width, height].join(','),
            'Q' + [width*0.5, arch].join(','),
            [0, height].join(','),
            'Q' + [-width*0.5, arch].join(','),
            [-width, height].join(','),
            'Q' + [-width*2, height/2].join(','),
            [-width,0].join(',')
        ].join(' ');

        if (!cloud.path) {
            cloud.path = cloud.group.path();
        }
        cloud.path.attr({ d: pathData });
    }

    // 💧 Regen
    function makeRain() {
        var lw = Math.random()*3;
        var ll = currentWeatherType.type=='thunder'?35:14;
        var x  = Math.random()*(sizes.card.width-40)+20;
        var idx = Math.floor(lw),
            holder = idx<=0?innerRainHolder3:(idx===1?innerRainHolder2:innerRainHolder1);
        var drop = holder.path('M0,0 0,'+ll).attr({
            fill:'none',
            stroke: currentWeatherType.type=='thunder'? '#777':'#0000ff',
            strokeWidth: lw
        });
        rain.push(drop);
        TweenMax.fromTo(drop.node,1,
            {x:x,y:-ll},
            {
              delay:Math.random(),
              y:sizes.card.height,
              ease:Power2.easeIn,
              onComplete:onRainEnd,
              onCompleteParams:[drop,lw,x,currentWeatherType.type]
            }
        );
    }
    function onRainEnd(drop,lw,x,type) {
        if (drop.remove) drop.remove();
        rain = rain.filter(r=>r.paper);
        if (rain.length<settings.rainCount) makeRain();
        if (lw>2) makeSplash(x,type);
    }

    // 💦 Splash
    function makeSplash(x,type) {
        var sl = type=='thunder'?30:20,
            sb = type=='thunder'?120:100,
            sd = 80,
            sp = type=='thunder'?0.7:0.5,
            up = -(Math.random()*sb),
            rx = (Math.random()*sd)-(sd/2);
        var pts = ['M0,0','Q'+rx+','+up,(rx*2)+','+sd].join(' ');
        var spl = outerSplashHolder.path(pts).attr({
            fill:'none',
            stroke: type=='thunder'? '#777':'#0000ff',
            strokeWidth:1
        });
        var length = Snap.path.getTotalLength(spl);
        spl.node.style.strokeDasharray = length+' '+length;
        TweenMax.fromTo(spl.node,sp,
            {
              strokeWidth:2,
              y:sizes.cardOffset.top+sizes.card.height,
              x:sizes.cardOffset.left+20+x,
              opacity:1,
              strokeDashoffset:length
            },
            {
              strokeWidth:0,
              strokeDashoffset:-length,
              opacity:1,
              onComplete:onSplashComplete,
              onCompleteParams:[spl],
              ease:SlowMo.ease.config(0.4,0.1,false)
            }
        );
    }
    function onSplashComplete(spl) {
        if (spl.remove) spl.remove();
    }

    // 🍃 Leaf
    function makeLeaf() {
        var scale = 0.5 + (Math.random()*0.5);
        var color = ['#76993E','#4A5E23','#6D632F'][Math.floor(Math.random()*3)];
        var areaY = sizes.card.height/2;
        var y     = areaY + (Math.random()*areaY);
        var endY  = y - ((Math.random()*(areaY*2))-areaY);
        var x, xB, endX, newLeaf;

        if (scale>0.8) {
            newLeaf = leaf.clone().appendTo(outerLeafHolder).attr({ fill:color });
            y     += sizes.cardOffset.top/2;
            endY  += sizes.cardOffset.top/2;
            x      = sizes.cardOffset.left-100;
            xB     = x + (sizes.container.width - sizes.cardOffset.left)/2;
            endX   = sizes.container.width+50;
        } else {
            newLeaf= leaf.clone().appendTo(innerLeafHolder).attr({ fill:color });
            x      = -100;
            xB     = sizes.card.width/2;
            endX   = sizes.card.width+50;
        }

        leafs.push(newLeaf);
        var bz = [{x:x,y:y},{x:xB,y:(Math.random()*endY)+(endY/3)},{x:endX,y:endY}];
        TweenMax.fromTo(newLeaf.node,2,
            {rotation:Math.random()*180,x:x,y:y,scale:scale},
            {
              rotation:Math.random()*360,
              bezier:bz,
              onComplete:onLeafEnd,
              onCompleteParams:[newLeaf],
              ease:Power0.easeIn
            }
        );
    }
    function onLeafEnd(leaf) {
        if (leaf.remove) leaf.remove();
        leafs = leafs.filter(l=>l.paper);
        if (leafs.length<settings.leafCount) makeLeaf();
    }

    // ❄️ Snow
    function makeSnow() {
        var scale = 0.5 + (Math.random()*0.5);
        var x     = 20 + (Math.random()*(sizes.card.width-40));
        var startY= settings.cloudHeight - 10;
        var endY  = sizes.card.height + 10;
        var flake = innerSnowHolder.circle(0,0,5).attr({ fill:'white' });
        snow.push(flake);
        TweenMax.fromTo(flake.node,3+(Math.random()*5),
            {x:x,y:startY},
            {
              y:endY,
              onComplete:onSnowEnd.bind(null,flake),
              ease:Power0.easeIn
            }
        );
        TweenMax.fromTo(flake.node,1,{scale:0},{scale:scale,ease:Power1.easeInOut});
        TweenMax.to(flake.node,3,{x:x+((Math.random()*150)-75),repeat:-1,yoyo:true,ease:Power1.easeInOut});
    }
    function onSnowEnd(f) {
        if (f.remove) f.remove();
        snow = snow.filter(s=>s.paper);
        if (snow.length<settings.snowCount) makeSnow();
    }

    // 🔄 Animations‑Loop (tick)
    function tick() {
        tickCount++;
        if (tickCount % settings.renewCheck === 0) {
            if (rain.length  < settings.rainCount) makeRain();
            if (leafs.length < settings.leafCount) makeLeaf();
            if (snow.length  < settings.snowCount) makeSnow();
        }
        clouds.forEach(function(c,i){
            c.offset += settings.windSpeed/(i+1);
            if (c.offset> sizes.card.width) c.offset -= sizes.card.width;
            c.group.transform('t'+c.offset+',0');
        });
        requestAnimationFrame(tick);
    }

    // 🌡️ Wetter‑Mapping & Wechsel
    function mapWeatherCodeToType(code, windSpeed) {
        var wc = +code, ws = +windSpeed;
        if (wc<=1)                            return 'sun';
        if ([95,96,99].includes(wc))          return 'thunder';
        if ((wc>=51&&wc<=67)||(wc>=80&&wc<=82))return 'rain';
        if ((wc>=71&&wc<=77)||(wc>=85&&wc<=86))return 'snow';
        if ([45,48].includes(wc))             return 'fog';
        if ([2,3].includes(wc))               return ws>=25?'wind':'cloud';
        return 'sun';
    }

    function changeWeather(typeKey) {
        var w = weatherTypes.find(w=>w.type===typeKey) || weatherTypes.find(w=>w.type==='sun');
        weatherTypes.forEach(wt=>$container.removeClass(wt.type));
        $container.addClass(w.type);
        currentWeatherType = w;

        // windSpeed
        var tws = w.type==='wind'?5:(w.type==='sun'?10:(w.type==='thunder'?0.8:0.5));
        TweenMax.to(settings,3,{windSpeed:tws,ease:Power2.easeInOut});

        // rainCount
        var trc = w.type==='rain'?20:(w.type==='thunder'?50:0);
        TweenMax.to(settings,3,{rainCount:trc,ease:Power2.easeInOut});

        // leafCount
        var tlc = w.type==='wind'?7:0;
        TweenMax.to(settings,3,{leafCount:tlc,ease:Power2.easeInOut});

        // snowCount
        var tsc = w.type==='snow'?30:0;
        TweenMax.to(settings,3,{snowCount:tsc,ease:Power2.easeInOut});

        // Sonne
        if (w.type==='sun') {
            TweenMax.to(sun.node,     4,{x:sizes.card.width/2,y:sizes.card.height*0.35,opacity:1,ease:Power2.easeInOut});
            TweenMax.to(sunburst.node,4,{scale:1,opacity:0.8,y:(sizes.card.height*0.35)+sizes.cardOffset.top,ease:Power2.easeInOut});
        } else {
            TweenMax.to(sun.node,     2,{y:-100,opacity:0,ease:Power2.easeIn});
            TweenMax.to(sunburst.node,2,{scale:0.4,opacity:0,y:(sizes.container.height/2)-50,ease:Power2.easeIn});
        }

        startLightningTimer();
    }

    // ⚡ Lightning
    function startLightningTimer() {
        clearTimeout(lightningTimeout);
        if (currentWeatherType.type==='thunder') {
            lightningTimeout = setTimeout(lightning, Math.random()*6000+2000);
        }
    }
    function lightning() {
        startLightningTimer();
        TweenMax.fromTo($card,0.75,{y:-10},{y:0,ease:Elastic.easeOut});
        var pathX   = 30 + Math.random()*(sizes.card.width-60),
            yOff    = 20,
            steps   = 20,
            pts     = [pathX+',0'];
        for (var i=0; i<steps; i++){
            var x = pathX + (Math.random()*yOff - yOff/2),
                y = (sizes.card.height/steps)*(i+1);
            pts.push(x+','+y);
        }
        var strike = innerLightningHolder.path('M'+pts.join(',')).attr({
            fill:'none',
            stroke:'white',
            strokeWidth:2+Math.random()
        });
        TweenMax.to(strike.node,1,{opacity:0,ease:Power4.easeOut,onComplete:function(){strike.remove();}});
    }

    // 📡 Overlay
    function showOverlayMessage(type, msg) {
        $overlayContainer.empty();
        var icon = type==='loading'?'fas fa-spinner fa-spin'
                  : type==='error'? 'fas fa-triangle-exclamation'
                                  :'fas fa-map-location-dot';
        var html = '<div class="'+type+'-state"><i class="'+icon+'"></i><div>'+msg+'</div></div>';
        $overlayContainer.html(html);
    }
    function hideOverlayMessage() {
        $overlayContainer.empty();
    }

    // 🌤️ Rendern
    function renderWeatherData(locName, data) {
        hideOverlayMessage();
        var cur = data.current;
        $temp.html(Math.round(cur.temperature_2m)+'<span>°C</span>');
        $location.text(locName);
        $description.text(getWeatherCondition(cur.weathercode).desc);
        $date.text(new Date().toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long'}));
        var mapped = mapWeatherCodeToType(cur.weathercode, cur.windspeed_10m);
        changeWeather(mapped);
    }

    // 🌐 API‑Funktionen
    async function getWeatherFromCoords(lat, lon, locName) {
        currentCoords = {lat,lon};
        currentCityName = locName;
        showOverlayMessage('loading','Lade Wetter für '+locName+'…');
        TweenMax.to(settings,1,{rainCount:0,leafCount:0,snowCount:0});
        var url = 'https://api.open-meteo.com/v1/forecast?latitude='+lat.toFixed(4)
                +'&longitude='+lon.toFixed(4)
                +'&current=temperature_2m,weathercode,windspeed_10m'
                +'&temperature_unit=celsius'
                +'&windspeed_unit=kmh'
                +'&timezone=auto';
        try {
            var res = await fetch(url);
            if (!res.ok) throw new Error('API Fehler '+res.status);
            var json = await res.json();
            if (!json.current) throw new Error('Unvollständige Daten.');
            renderWeatherData(locName, json);
        } catch(err) {
            console.error(err);
            handleFetchError(err);
        }
    }

    async function getWeatherByCityName(city) {
        if (!city) { showError('Bitte gib einen Stadtnamen ein.'); return; }
        showOverlayMessage('loading','Suche Stadt…');
        hideAutocomplete();
        try {
            var geo = await fetch(
                'https://api.geoapify.com/v1/geocode/search?text='+encodeURIComponent(city)
                +'&limit=1&lang=de&format=json&apiKey='+GEOAPIFY_API_KEY
            );
            if (!geo.ok) throw new Error('Geoapify Fehler');
            var data = await geo.json();
            if (!data.results||!data.results.length) throw new Error('Stadt nicht gefunden.');
            var r = data.results[0],
                name = r.city||r.formatted;
            await getWeatherFromCoords(r.lat,r.lon,name);
        } catch(err) {
            console.error(err);
            handleFetchError(err);
        }
    }

    function getLocationWeather() {
        if (!navigator.geolocation) { showError('Geolocation nicht unterstützt.'); return; }
        showOverlayMessage('loading','Ermittle Standort…');
        navigator.geolocation.getCurrentPosition(async function(pos){
            var lat = pos.coords.latitude, lon=pos.coords.longitude;
            try {
                var rev = await fetch(
                    'https://api.geoapify.com/v1/geocode/reverse?lat='+lat+'&lon='+lon
                    +'&lang=de&format=json&apiKey='+GEOAPIFY_API_KEY
                );
                var name = 'Lat '+lat.toFixed(2)+', Lon '+lon.toFixed(2);
                if (rev.ok){
                    var d=await rev.json();
                    if (d.results?.length){
                        name = d.results[0].city || d.results[0].village || d.results[0].formatted;
                    }
                }
                await getWeatherFromCoords(lat,lon,name);
            } catch(err){
                console.error(err);
                await getWeatherFromCoords(lat,lon,'Lat '+lat.toFixed(2)+', Lon '+lon.toFixed(2));
            }
        }, function(err){
            handleGeolocationError(err);
        }, { enableHighAccuracy:false, timeout:10000, maximumAge:300000 });
    }

    function handleGeolocationError(err) {
        var m='Standort nicht ermittelt.';
        if (err.code===1) m='Zugriff verweigert.';
        if (err.code===2) m='Position nicht verfügbar.';
        if (err.code===3) m='Timeout.';
        showError(m);
    }

    function handleFetchError(err) {
        var msg='Fehler.';
        var m = err.message.toLowerCase();
        if (m.includes('stadt')) msg = err.message;
        else if (m.includes('network')||m.includes('fetch')) msg='Netzwerkfehler.';
        else if (m.includes('api')) msg='API Problem.';
        showError(msg);
    }

    function showError(msg) {
        showOverlayMessage('error', msg);
        changeWeather('sun');
    }

    // 🔍 Autocomplete
    function handleAutocompleteInput(e) {
        clearTimeout(autocompleteTimeout);
        var q = e.target.value.trim();
        if (q.length<2) return hideAutocomplete();
        autocompleteTimeout = setTimeout(async function(){
            try {
                var res = await fetch(
                    'https://api.geoapify.com/v1/geocode/autocomplete?text='+encodeURIComponent(q)
                    +'&type=city&lang=de&limit=5&format=json&apiKey='+GEOAPIFY_API_KEY
                );
                if (!res.ok) throw new Error('Autocomplete failed');
                var d = await res.json();
                currentSuggestions = d.results||[];
                showAutocompleteSuggestions(currentSuggestions);
            } catch(err){
                console.error(err);
                hideAutocomplete();
            }
        }, 300);
    }

    function showAutocompleteSuggestions(list) {
        var dd = $('#autocomplete-dropdown').empty();
        if (!list.length) return hideAutocomplete();
        list.forEach(function(s){
            var city    = s.city||s.name||s.address_line1,
                country = s.country||'',
                disp    = city&&country?city+', '+country:s.formatted;
            var $item = $('<div>')
              .addClass('autocomplete-item')
              .attr('data-lat', s.lat)
              .attr('data-lon', s.lon)
              .attr('data-name', disp)
              .html(highlightMatch(disp, $('#city-input').val()));
            $item.on('click', function(){
                $('#city-input').val(disp);
                hideAutocomplete();
                getWeatherFromCoords(s.lat,s.lon,disp);
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
        if (e.key==='Enter') {
            e.preventDefault();
            if (dd.is(':visible') && currentSuggestions.length) {
                dd.find('.autocomplete-item').first().click();
            } else {
                hideAutocomplete();
                getWeatherByCityName($('#city-input').val());
            }
        }
        if (e.key==='Escape') hideAutocomplete();
    }

    function handleClickOutsideAutocomplete(e) {
        if (!$(e.target).closest('.autocomplete-container').length) {
            hideAutocomplete();
        }
    }

    function handleEscapeKey(e) {
        if (e.key==='Escape') hideAutocomplete();
    }

    function highlightMatch(text, q) {
        if (!q) return text;
        var esc = q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),
            re  = new RegExp('('+esc+')','gi');
        return text.replace(re,'<b>$1</b>');
    }

    // 🚀 Starte App
    init();

}); // Ende jQuery ready
