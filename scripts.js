// scripts.js - Snap.svg / GSAP Version (Clean Base)

$(document).ready(function() { // jQuery ready

    // --- Globale Variablen & DOM Referenzen ---
    var $container = $('.container');
    var $card = $('#card');
    var innerSVG = Snap('#inner');
    var outerSVG = Snap('#outer');
    var backSVG = Snap('#back');
    var $description = $('#description');
    var $date = $('#date');
    var $location = $('#location');
    var $temp = $('.temp');
    var $feelsLike = $('#feels-like');
    var $overlayContainer = $('#overlay-container'); // Für Loading/Error Messages

    // Snap.svg Elemente für Animationen
    var weatherContainer1 = Snap.select('#layer1');
    var weatherContainer2 = Snap.select('#layer2');
    var weatherContainer3 = Snap.select('#layer3');
    var innerRainHolder1 = weatherContainer1.group();
    var innerRainHolder2 = weatherContainer2.group();
    var innerRainHolder3 = weatherContainer3.group();
    var innerLeafHolder = weatherContainer1.group();
    var innerSnowHolder = weatherContainer1.group();
    var innerLightningHolder = weatherContainer1.group();
    var leafMask = outerSVG.rect(); // Maske muss erstellt werden, auch wenn wind nicht genutzt wird
    var leaf = Snap.select('#leaf');
    var sun = Snap.select('#sun');
    var sunburst = Snap.select('#sunburst');
    var outerSplashHolder = outerSVG.group();
    var outerLeafHolder = outerSVG.group();
    // outerSnowHolder war ungenutzt

    // Unsere Referenzen (Vanilla JS für Input/Buttons)
    const cityInput = document.getElementById('city');
    const themeToggle = document.getElementById('theme-toggle');
    const autocompleteDropdown = document.getElementById('autocomplete-dropdown');
    const searchButton = document.getElementById('search-button');
    const locationButton = document.getElementById('location-button');
    const favoritesSelect = document.getElementById('favorites-select');
    const refreshButton = document.getElementById('refresh-button');

    // --- Konstanten & API Keys ---
    const GEOAPIFY_API_KEY = '6b73ef3534d24e6f9f9cbbd26bdf2e99';
    const FAVORITES_KEY = 'weatherAppFavorites';

    // --- Zustand, Animation & Wetter-Mapping ---
    let autocompleteTimeout, currentSuggestions = [], manualOverrideActive = false, currentCoords = null, currentCityName = null, currentApiData = null;
    var lightningTimeout;
    var sizes = { container: {width: 0, height: 0}, card: {width: 0, height: 0}, cardOffset: {top: 0, left: 0}};
    var clouds = [{group: Snap.select('#cloud1')}, {group: Snap.select('#cloud2')}, {group: Snap.select('#cloud3')}];
    // Wettertypen für Animationen (muss mit CSS-Klassen übereinstimmen)
    var weatherTypes = [ { type: 'snow', name: 'Schnee'}, { type: 'wind', name: 'Windig'}, { type: 'rain', name: 'Regen'}, { type: 'thunder', name: 'Gewitter'}, { type: 'fog', name: 'Nebel'}, { type: 'cloud', name: 'Bewölkt'}, { type: 'sun', name: 'Sonnig'} ];
    var currentWeatherType = weatherTypes.find(w => w.type === 'sun'); // Start mit Sonne
    // GSAP Settings für Animationen
    var settings = { windSpeed: 2, rainCount: 0, leafCount: 0, snowCount: 0, cloudHeight: 100, cloudSpace: 30, cloudArch: 50, renewCheck: 10, splashBounce: 80 };
    var tickCount = 0;
    var rain = [], leafs = [], snow = [];

    // Mapping von Wetter-Codes zu Beschreibungen/Icons
    const weatherConditions = { 0: { icon: 'sun', desc: 'Klarer Himmel' }, 1: { icon: 'cloud-sun', desc: 'Überwiegend klar' }, 2: { icon: 'cloud', desc: 'Teilweise bewölkt' }, 3: { icon: 'cloud', desc: 'Bedeckt' }, 45: { icon: 'smog', desc: 'Nebel' }, 48: { icon: 'smog', desc: 'Gefrierender Nebel' }, 51: { icon: 'cloud-rain', desc: 'Leichter Nieselregen' }, 53: { icon: 'cloud-rain', desc: 'Mäßiger Nieselregen' }, 55: { icon: 'cloud-showers-heavy', desc: 'Starker Nieselregen' }, 56: { icon: 'snowflake', desc: 'Leichter gefrierender Nieselregen' }, 57: { icon: 'snowflake', desc: 'Starker gefrierender Nieselregen' }, 61: { icon: 'cloud-rain', desc: 'Leichter Regen' }, 63: { icon: 'cloud-showers-heavy', desc: 'Mäßiger Regen' }, 65: { icon: 'cloud-showers-heavy', desc: 'Starker Regen' }, 66: { icon: 'snowflake', desc: 'Gefrierender Regen' }, 67: { icon: 'snowflake', desc: 'Gefrierender Regen' }, 71: { icon: 'snowflake', desc: 'Leichter Schneefall' }, 73: { icon: 'snowflake', desc: 'Mäßiger Schneefall' }, 75: { icon: 'snowflake', desc: 'Starker Schneefall' }, 77: { icon: 'icicles', desc: 'Schneekörner' }, 80: { icon: 'cloud-sun-rain', desc: 'Leichte Regenschauer' }, 81: { icon: 'cloud-showers-heavy', desc: 'Mäßige Regenschauer' }, 82: { icon: 'cloud-showers-heavy', desc: 'Heftige Regenschauer' }, 85: { icon: 'snowflake', desc: 'Leichte Schneeschauer' }, 86: { icon: 'snowflake', desc: 'Starke Schneeschauer' }, 95: { icon: 'cloud-bolt', desc: 'Gewitter' }, 96: { icon: 'cloud-bolt', desc: 'Gewitter mit leichtem Hagel' }, 99: { icon: 'cloud-bolt', desc: 'Gewitter mit starkem Hagel' } };
    function getWeatherCondition(code) { return weatherConditions[code] || { icon: 'question-circle', desc: `Unbekannt (${code})` }; }


    // --- Initialisierung ---
    function init() {
        onResize(); initializeTheme(); loadFavorites(); setupEventListeners();
        // Wolken initial zeichnen
        for(var i=0;i<clouds.length;i++){clouds[i].offset=Math.random()*sizes.card.width;drawCloud(clouds[i],i);}
        // Sonne initial positionieren & ausblenden
        TweenMax.set(sun.node,{x:sizes.card.width/2,y:-100}); TweenMax.set(sunburst.node,{opacity:0});
        // Startzustand (Prompt oder Standort)
        autoDetectLocation();
        // Animations-Loop starten
        requestAnimationFrame(tick);
    }

    // --- Event Listener Setup ---
    function setupEventListeners() { cityInput.addEventListener('input', handleAutocompleteInput); cityInput.addEventListener('keydown', handleInputKeydown); searchButton.addEventListener('click', getWeatherByCityName); locationButton.addEventListener('click', () => getLocationWeather(false)); themeToggle.addEventListener('click', toggleThemeManually); favoritesSelect.addEventListener('change', handleFavoriteSelection); refreshButton.addEventListener('click', handleRefresh); document.addEventListener('click', handleClickOutsideAutocomplete); document.addEventListener('keydown', handleEscapeKey); $(window).resize(onResize); }

    // --- Resize Handler ---
    function onResize(){sizes.container.width=$container.width(); sizes.container.height=$container.height(); sizes.card.width=$card.width(); sizes.card.height=$card.height(); var cO=$card.offset(); sizes.cardOffset.top=cO?cO.top:0; sizes.cardOffset.left=cO?cO.left:0; innerSVG.attr({width:sizes.card.width,height:sizes.card.height}); outerSVG.attr({width:sizes.container.width,height:sizes.container.height}); backSVG.attr({width:sizes.container.width,height:sizes.container.height}); TweenMax.set(sunburst.node,{transformOrigin:"50% 50%",x:sizes.container.width/2,y:(sizes.card.height/2)+sizes.cardOffset.top}); if(!TweenMax.isTweening(sunburst.node))TweenMax.fromTo(sunburst.node,20,{rotation:0},{rotation:360,repeat:-1,ease:Power0.easeInOut}); leafMask.attr({x:sizes.cardOffset.left,y:0,width:sizes.container.width-sizes.cardOffset.left,height:sizes.container.height}); outerLeafHolder.attr({'clip-path':leafMask}); }

    // --- Cloud Drawing ---
    function drawCloud(c,i){var sp=settings.cloudSpace*i, h=sp+settings.cloudHeight, a=h+settings.cloudArch+(Math.random()*settings.cloudArch), w=sizes.card.width, p=[]; p.push('M'+[-(w),sizes.card.height].join(',')); p.push([w,sizes.card.height].join(',')); p.push('Q'+[w*2,h/2+sizes.card.height].join(',')); p.push([w,h].join(',')); p.push('Q'+[w*0.5,a].join(',')); p.push([0,h].join(',')); p.push('Q'+[w*-0.5,a].join(',')); p.push([-w,h].join(',')); p.push('Q'+[-(w*2),h/2+sizes.card.height].join(',')); p.push([-(w),sizes.card.height].join(',')); var pa=p.join(' '); if(!c.path)c.path=c.group.path(); c.path.animate({d:pa},0); c.group.transform('t'+c.offset+','+(sizes.card.height-h)); }

    // --- Partikel Erstellung & Animation (Rain, Leaf, Snow - Original CodePen Logik) ---
    function makeRain(){var lW=Math.random()*3, lL=currentWeatherType.type=='thunder'?35:14, x=Math.random()*(sizes.card.width-40)+20, h=this['innerRainHolder'+(3-Math.floor(lW))], l=h.path('M0,0 0,'+lL).attr({fill:'none',stroke:currentWeatherType.type=='thunder'?'#aaa':'#5B92E5',strokeWidth:lW}); rain.push(l); TweenMax.fromTo(l.node,1,{x:x,y:0-lL},{delay:Math.random(),y:sizes.card.height,ease:Power2.easeIn,onComplete:onRainEnd,onCompleteParams:[l,lW,x,currentWeatherType.type]}); } function onRainEnd(l,w,x,t){if(l&&l.remove)l.remove(); l=null; rain=rain.filter(i=>i!==null&&i.paper); if(rain.length<settings.rainCount)makeRain(); if(w>2)makeSplash(x,t); } function makeSplash(x,t){var sL=t=='thunder'?30:20, sB=t=='thunder'?120:100, sD=80, spd=t=='thunder'?0.7:0.5, sU=0-(Math.random()*sB), rX=((Math.random()*sD)-(sD/2)), pts=[]; pts.push('M0,0'); pts.push('Q'+rX+','+sU); pts.push((rX*2)+','+sD); var s=outerSplashHolder.path(pts.join(' ')).attr({fill:"none",stroke:t=='thunder'?'#aaa':'#5B92E5',strokeWidth:1}), pL=Snap.path.getTotalLength(s), xO=sizes.cardOffset.left, yO=sizes.cardOffset.top+sizes.card.height; if(s.node)s.node.style.strokeDasharray=pL+' '+pL; TweenMax.fromTo(s.node,spd,{strokeWidth:2,y:yO,x:xO+x,opacity:1,strokeDashoffset:pL},{strokeWidth:0,strokeDashoffset:-pL,opacity:1,onComplete:onSplashComplete,onCompleteParams:[s],ease:SlowMo.ease.config(0.4,0.1,false)}) } function onSplashComplete(s){if(s&&s.remove)s.remove(); s=null;} function makeLeaf(){var sc=0.5+(Math.random()*0.5), nL, aY=sizes.card.height/2, y=aY+(Math.random()*aY), eY=y-((Math.random()*(aY*2))-aY), x,eX,xB, clrs=['#76993E','#4A5E23','#6D632F'], clr=clrs[Math.floor(Math.random()*clrs.length)]; if(sc>0.8){nL=leaf.clone().appendTo(outerLeafHolder).attr({fill:clr}); y=y+sizes.cardOffset.top/2; eY=eY+sizes.cardOffset.top/2; x=sizes.cardOffset.left-100; xB=x+(sizes.container.width-sizes.cardOffset.left)/2; eX=sizes.container.width+50;}else{nL=leaf.clone().appendTo(innerLeafHolder).attr({fill:clr}); x=-100; xB=sizes.card.width/2; eX=sizes.card.width+50;} leafs.push(nL); var bz=[{x:x,y:y},{x:xB,y:(Math.random()*eY)+(eY/3)},{x:eX,y:eY}]; TweenMax.fromTo(nL.node,2+Math.random()*2,{rotation:Math.random()*180,x:x,y:y,scale:sc},{rotation:Math.random()*360,bezier:bz,onComplete:onLeafEnd,onCompleteParams:[nL],ease:Power0.easeIn})} function onLeafEnd(l){if(l&&l.remove)l.remove(); l=null; leafs=leafs.filter(i=>i!==null&&i.paper); if(leafs.length<settings.leafCount)makeLeaf();} function makeSnow(){var sc=0.5+(Math.random()*0.5), nS, x=20+(Math.random()*(sizes.card.width-40)), eY, y=-10; nS=innerSnowHolder.circle(0,0,5).attr({fill:'white'}); eY=sizes.card.height+10; y=settings.cloudHeight-10; snow.push(nS); TweenMax.fromTo(nS.node,3+(Math.random()*5),{x:x,y:y},{y:eY,onComplete:onSnowEnd,onCompleteParams:[nS],ease:Power0.easeIn}); TweenMax.fromTo(nS.node,1,{scale:0},{scale:sc,ease:Power1.easeInOut}); TweenMax.to(nS.node,3,{x:x+((Math.random()*150)-75),repeat:-1,yoyo:true,ease:Power1.easeInOut});} function onSnowEnd(f){if(f&&f.remove)f.remove(); f=null; snow=snow.filter(i=>i!==null&&i.paper); if(snow.length<settings.snowCount)makeSnow();}

    // --- Animations-Loop (Tick) ---
    function tick(){tickCount++; var check=tickCount%settings.renewCheck; if(check){if(rain.length<settings.rainCount)makeRain(); if(leafs.length<settings.leafCount)makeLeaf(); if(snow.length<settings.snowCount)makeSnow();} for(var i=0;i<clouds.length;i++){var c=clouds[i], nX, cW=sizes.card.width; if(currentWeatherType.type=='sun'){if(c.offset<cW*1.5)c.offset+=settings.windSpeed/(i+1); nX=c.offset;}else{c.offset+=settings.windSpeed/(i+1); if(c.offset>=cW)c.offset=c.offset-cW*2; nX=c.offset;} c.group.transform('t'+nX+','+(sizes.card.height-(settings.cloudSpace*i+settings.cloudHeight)));} requestAnimationFrame(tick);}

    // --- Wetterwechsel Logik (Vereinfacht, keine tsParticles) ---
    function mapWeatherCodeToType(code, windSpeed) {
        const wc = Number(code), ws = Number(windSpeed);
        if (wc <= 1) return 'sun';
        if (wc === 95 || wc === 96 || wc === 99) return 'thunder';
        if ((wc >= 51 && wc <= 67) || (wc >= 80 && wc <= 82)) return 'rain';
        if ((wc >= 71 && wc <= 77) || (wc >= 85 && wc <= 86) || wc === 66 || wc === 67) return 'snow';
        if (wc === 45 || wc === 48) return 'fog'; // Nebel-Typ
        if (wc === 2 || wc === 3) {
             if (ws >= 25) return 'wind'; // Windig, wenn windig genug
             else return 'cloud';         // Sonst nur bewölkt
        }
        return 'sun'; // Fallback
    }
    function changeWeather(weatherTypeKey) {
        var weatherData = weatherTypes.find(w => w.type === weatherTypeKey) || weatherTypes.find(w => w.type === 'sun');
        // Setze Klasse am .container für CSS-Effekte (Hintergrund etc.)
        weatherTypes.forEach(w => $container.removeClass(w.type));
        $container.addClass(weatherData.type);
        currentWeatherType = weatherData; // Zustand speichern

        // --- Steuere GSAP-Animationen über 'settings' ---
        let tWS=0.5; // Standard Wind (Wolkenbewegung)
        if (weatherData.type === 'wind') tWS = 5;
        if (weatherData.type === 'sun') tWS = 10; // Schnelles Rausbewegen der Wolken
        if (weatherData.type === 'thunder') tWS = 0.8;
        TweenMax.to(settings, 3, { windSpeed: tWS, ease: Power2.easeInOut });

        let tRC = (weatherData.type === 'rain') ? 20 : ((weatherData.type === 'thunder') ? 50 : 0);
        TweenMax.to(settings, 3, { rainCount: tRC, ease: Power2.easeInOut });

        let tLC = (weatherData.type === 'wind') ? 7 : 0;
        TweenMax.to(settings, 3, { leafCount: tLC, ease: Power2.easeInOut });

        let tSC = (weatherData.type === 'snow') ? 30 : 0;
        TweenMax.to(settings, 3, { snowCount: tSC, ease: Power2.easeInOut });

        // Sonnen-Animation
        if (weatherData.type === 'sun') {
            TweenMax.to(sun.node, 4, { x: sizes.card.width / 2, y: sizes.card.height * 0.35, opacity: 1, ease: Power2.easeInOut });
            TweenMax.to(sunburst.node, 4, { scale: 1, opacity: 0.8, y: (sizes.card.height * 0.35) + sizes.cardOffset.top, ease: Power2.easeInOut });
        } else {
            TweenMax.to(sun.node, 2, { y: -100, opacity: 0, ease: Power2.easeIn });
            TweenMax.to(sunburst.node, 2, { scale: 0.4, opacity: 0, y: (sizes.container.height / 2) - 50, ease: Power2.easeIn });
        }
        startLightningTimer(); // Startet nur, wenn Typ 'thunder' ist
    }

    // --- Blitz-Funktionen (wie vorher) ---
    function startLightningTimer(){if(lightningTimeout)clearTimeout(lightningTimeout); if(currentWeatherType.type=='thunder')lightningTimeout=setTimeout(lightning,Math.random()*6000+2000);} function lightning(){startLightningTimer(); TweenMax.fromTo($card,0.75,{y:-10},{y:0,ease:Elastic.easeOut}); var pX=30+Math.random()*(sizes.card.width-60), yO=20, steps=20, pts=[pX+',0']; for(var i=0;i<steps;i++){var x=pX+(Math.random()*yO-(yO/2)), y=(sizes.card.height/steps)*(i+1); pts.push(x+','+y);} var s=innerLightningHolder.path('M'+pts.join(' ')).attr({fill:'none',stroke:'white',strokeWidth:2+Math.random()}); TweenMax.to(s.node,1,{opacity:0,ease:Power4.easeOut,onComplete:function(){if(s)s.remove(); s=null}});}

    // --- Unsere API & Rendering Logik (Vereinfacht für Kern-Daten) ---
    function showOverlayMessage(type, message) {
        $overlayContainer.empty(); // Alte Overlays entfernen
        const iconClass = type === 'loading' ? 'fa-spinner fa-spin' : (type === 'error' ? 'fa-triangle-exclamation' : 'fa-map-location-dot');
        const divClass = type + '-state';
        const html = `<div class="${divClass}"> <i class="fas ${iconClass}"></i> <div>${message}</div> </div>`;
        $overlayContainer.html(html);
    }
    function hideOverlayMessage() { $overlayContainer.empty(); }

    function renderWeatherData(locationName, weatherData) {
        hideOverlayMessage();
        const { current, daily } = weatherData; // Nur current und daily nötig für Kernanzeige
        currentApiData = weatherData;

        // Aktualisiere Kern-UI-Elemente
        $location.text(locationName);
        $temp.html(`${Math.round(current.temperature_2m)}<span>°C</span>`);
        $description.text(getWeatherCondition(current.weathercode).desc);
        $date.text(new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }));
        $feelsLike.text(`Gefühlt: ${Math.round(current.apparent_temperature)}°`);

        // Trigger die korrekte Animation basierend auf dem Wettercode
        const mappedType = mapWeatherCodeToType(current.weathercode, current.windspeed_10m);
        changeWeather(mappedType);

        // Favoriten-Button (wenn wir ihn später hinzufügen)
        // const favs=getFavorites(); const isFav=favs.some(fav=>fav.lat===currentCoords?.lat&&fav.lon===currentCoords?.lon); updateFavoriteButtonState(isFav);
    }
    // UV-Beschreibung (für später, falls Details-Grid kommt)
    // const getUVDescription=(uv)=>{/*...*/};

    // --- API Call & Datenverarbeitung (vereinfachter API Call) ---
    async function getWeatherFromCoords(lat, lon, locationName) {
        currentCoords = { lat, lon }; currentCityName = locationName;
        showOverlayMessage('loading', `Lade Wetter für ${locationName}...`);
        // Stoppe Partikel-Erzeugung für Übergang
        TweenMax.to(settings, 1, { rainCount: 0, leafCount: 0, snowCount: 0 });

        const params = [ `latitude=${lat.toFixed(4)}`,`longitude=${lon.toFixed(4)}`,
                         'current=temperature_2m,relativehumidity_2m,apparent_temperature,is_day,precipitation,weathercode,surface_pressure,windspeed_10m,winddirection_10m,uv_index',
                         'daily=weathercode,temperature_2m_max,temperature_2m_min', // Nur Min/Max für Daily nötig (aktuell nicht angezeigt)
                         'temperature_unit=celsius', 'windspeed_unit=kmh', 'precipitation_unit=mm', 'timezone=auto', 'forecast_days=1' ];
        const apiUrl = `https://api.open-meteo.com/v1/forecast?${params.join('&')}`;
        try { const r = await fetch(apiUrl); if (!r.ok){const eD=await r.json().catch(()=>({}));throw new Error(`API Fehler: ${r.status} ${eD.reason||''}`);} const d = await r.json(); if (!d.current || !d.daily) throw new Error('Unvollständige Daten.'); renderWeatherData(locationName, d); } catch (error) { console.error('Fehler:', error); handleFetchError(error); }
    }

    // --- Initial Prompt / Error States ---
    function showInitialPrompt(){showOverlayMessage('initial','Gib eine Stadt ein oder nutze deinen Standort.'); currentCoords=null; currentCityName=null; currentApiData=null; /*updateFavoriteButtonState(false);*/ changeWeather('sun');} function showError(message){showOverlayMessage('error',message); currentCoords=null; currentCityName=null; currentApiData=null; changeWeather('sun');}

    // --- Restliche Hilfsfunktionen (Autocomplete, Favoriten, Theme, Geo, etc. - gekürzt für Übersicht) ---
    function initializeTheme(){const pL=window.matchMedia&&window.matchMedia('(prefers-color-scheme:light)').matches;if(pL)applyLightTheme();else applyDarkTheme();updateThemeToggleIcon();if(window.matchMedia){const q=window.matchMedia('(prefers-color-scheme:light)');q.addEventListener('change',(e)=>{if(!manualOverrideActive){if(e.matches)applyLightTheme();else applyDarkTheme();updateThemeToggleIcon();if(currentCoords)handleRefresh();}});}} function toggleThemeManually(){manualOverrideActive=true;const iL=document.body.classList.contains('light-theme');if(iL)applyDarkTheme();else applyLightTheme();updateThemeToggleIcon();if(currentCoords)handleRefresh();} function applyLightTheme(){document.body.classList.add('light-theme');} function applyDarkTheme(){document.body.classList.remove('light-theme');} function updateThemeToggleIcon(){themeToggle.innerHTML=document.body.classList.contains('light-theme')?'<i class="fas fa-moon"></i>':'<i class="fas fa-sun"></i>';themeToggle.setAttribute('aria-label',document.body.classList.contains('light-theme')?'Dark Mode':'Light Mode');} function getFavorites(){const f=localStorage.getItem(FAVORITES_KEY);return f?JSON.parse(f):[];} function saveFavorites(f){localStorage.setItem(FAVORITES_KEY,JSON.stringify(f));loadFavorites();} function loadFavorites(){const f=getFavorites();favoritesSelect.innerHTML='<option value="">Favoriten...</option>';f.forEach((fav,i)=>{const o=document.createElement('option');o.value=i;o.textContent=fav.name;favoritesSelect.appendChild(o);});} function addFavorite(n,la,lo){/* Logik bleibt */} function handleFavoriteSelection(){const i=favoritesSelect.value;if(i==="")return;const f=getFavorites();const s=f[parseInt(i)];if(s){cityInput.value=s.name;getWeatherFromCoords(s.lat,s.lon,s.name);}favoritesSelect.value="";} function updateFavoriteButtonState(isFav){/* Logik bleibt, aber Button fehlt noch */} function handleRefresh(){if(currentCoords&&currentApiData){renderWeatherData(currentCityName,currentApiData);}else if(currentCoords){getWeatherFromCoords(currentCoords.lat,currentCoords.lon,currentCityName);}else{getLocationWeather(false);}} function handleAutocompleteInput(e){clearTimeout(autocompleteTimeout);const s=e.target.value.trim();if(s.length<2){hideAutocomplete();return;}autocompleteTimeout=setTimeout(async()=>{try{const r=await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(s)}&type=city&lang=de&limit=5&format=json&apiKey=${GEOAPIFY_API_KEY}`);if(!r.ok)throw Error();const d=await r.json();currentSuggestions=d.results||[];showAutocompleteSuggestions(currentSuggestions);}catch(err){hideAutocomplete();}},300);} function showAutocompleteSuggestions(suggestions){if(!suggestions||suggestions.length===0){hideAutocomplete();return;}autocompleteDropdown.innerHTML=suggestions.map(s=>{const c=s.city||s.name||s.address_line1;const co=s.country;const dn=c&&co?`${c}, ${co}`:s.formatted;return`<div class="autocomplete-item" data-lat="${s.lat}" data-lon="${s.lon}" data-name="${dn}">${highlightMatch(dn,cityInput.value)}</div>`;}).join('');$(autocompleteDropdown).find('.autocomplete-item').on('click',function(){const n=$(this).data('name');const la=parseFloat($(this).data('lat'));const lo=parseFloat($(this).data('lon'));cityInput.value=n;hideAutocomplete();cityInput.blur();getWeatherFromCoords(la,lo,n);});autocompleteDropdown.style.display='block';} function hideAutocomplete(){autocompleteDropdown.style.display='none';autocompleteDropdown.innerHTML='';currentSuggestions=[];} function handleInputKeydown(e){if(e.key==='Enter'){e.preventDefault();if(autocompleteDropdown.style.display==='block'&&currentSuggestions.length>0){$(autocompleteDropdown).find('.autocomplete-item').first().trigger('click');}else{hideAutocomplete();getWeatherByCityName();}cityInput.blur();}else if(e.key==='Escape'){hideAutocomplete();}} function handleClickOutsideAutocomplete(e){if(!$(e.target).closest('.autocomplete-container').length){hideAutocomplete();}} function handleEscapeKey(e){if(e.key==='Escape')hideAutocomplete();} function highlightMatch(text,query){if(!query||!text)return text||'';const eq=query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const rgx=new RegExp(`(${eq})`,'gi');return text.replace(rgx,'<b>$1</b>');} async function getWeatherByCityName(){const city=cityInput.value.trim();if(!city){showError('Bitte gib einen Stadtnamen ein.');return;}showOverlayMessage('loading','Suche Stadt...');hideAutocomplete();try{const geoR=await fetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(city)}&limit=1&lang=de&format=json&apiKey=${GEOAPIFY_API_KEY}`);if(!geoR.ok)throw new Error(`Geoapify Fehler`);const geoD=await geoR.json();if(!geoD.results||geoD.results.length===0)throw new Error(`Stadt "${city}" nicht gefunden.`);const{lat,lon,formatted}=geoD.results[0];const locN=geoD.results[0].city||formatted;await getWeatherFromCoords(lat,lon,locN);}catch(error){handleFetchError(error);}} async function getLocationWeather(isAutoDetect=false){if(!navigator.geolocation){showError('Geolocation nicht unterstützt.');return;}showOverlayMessage('loading','Ermittle Standort...');navigator.geolocation.getCurrentPosition(async(pos)=>{const{latitude,longitude}=pos.coords;try{const revGeoR=await fetch(`https://api.geoapify.com/v1/geocode/reverse?lat=${latitude}&lon=${longitude}&lang=de&format=json&apiKey=${GEOAPIFY_API_KEY}`);let locN=`Lat ${latitude.toFixed(2)}, Lon ${longitude.toFixed(2)}`;if(revGeoR.ok){const locD=await revGeoR.json();if(locD.results?.length>0)locN=locD.results[0].city||locD.results[0].village||locD.results[0].suburb||locD.results[0].formatted;}await getWeatherFromCoords(latitude,longitude,locN);}catch(error){await getWeatherFromCoords(latitude,longitude,`Lat ${latitude.toFixed(2)}, Lon ${longitude.toFixed(2)}`);}},(err)=>{if(!isAutoDetect)handleGeolocationError(err);else showInitialPrompt();},{enableHighAccuracy:false,timeout:10000,maximumAge:300000});} async function autoDetectLocation(){if(!navigator.geolocation||!navigator.permissions){showInitialPrompt();return;}try{const perm=await navigator.permissions.query({name:'geolocation'});if(perm.state==='granted')getLocationWeather(true);else showInitialPrompt();perm.onchange=()=>{if(perm.state==='granted'&&$('#overlay-container').children().length)getLocationWeather(true);else if(perm.state!=='granted'&&$('.loading-state').length)showInitialPrompt();};}catch(error){showInitialPrompt();}} function handleGeolocationError(error){let msg='Standort nicht ermittelt.';if(error.code===1)msg='Zugriff verweigert.';if(error.code===2)msg='Position nicht verfügbar.';if(error.code===3)msg='Timeout.';showError(msg);} function handleFetchError(error){let msg='Fehler.';if(error.message.includes('Stadt')&&error.message.includes('gefunden'))msg=error.message;else if(error.message.toLowerCase().includes('fetch')||error.message.toLowerCase().includes('network'))msg='Netzwerkfehler.';else if(error.message.includes('API')||error.message.includes('Fehler'))msg='API Problem.';else if(error.message.includes('Unvollständige'))msg='Daten unvollständig.';console.error("Fetch Error:",error);showError(msg);}

    // --- App Start ---
    init();

}); // Ende jQuery ready

