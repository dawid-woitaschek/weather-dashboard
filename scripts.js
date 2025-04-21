// scripts.js - SVG Clean Base

$(document).ready(function() {

    // --- Globale Variablen & Snap.svg Referenzen (CodePen Basis) ---
    var $container = $('.container');
    var $card = $('#card');
    var innerSVG = Snap('#inner');
    var outerSVG = Snap('#outer');
    var backSVG = Snap('#back');
    var $description = $('#description');
    var $date = $('#date');
    var $location = $('#location');
    var $temp = $('.temp');
    var $overlayContainer = $('#overlay-container'); // Für Loading/Error

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

    // --- API & Zustand (Minimal) ---
    const GEOAPIFY_API_KEY = '6b73ef3534d24e6f9f9cbbd26bdf2e99';
    let currentCoords = null;
    let currentCityName = null;
    let currentApiData = null; // Letzte gültige API-Daten

    // --- Animation & Mapping (CodePen Basis + Unsere Anpassung) ---
    var lightningTimeout;
    var sizes = { container: {width: 0, height: 0}, card: {width: 0, height: 0}, cardOffset: {top: 0, left: 0}};
    var clouds = [{group: Snap.select('#cloud1')}, {group: Snap.select('#cloud2')}, {group: Snap.select('#cloud3')}];
    var weatherTypes = [ { type: 'snow', name: 'Schnee'}, { type: 'wind', name: 'Windig'}, { type: 'rain', name: 'Regen'}, { type: 'thunder', name: 'Gewitter'}, { type: 'fog', name: 'Nebel'}, { type: 'cloud', name: 'Bewölkt'}, { type: 'sun', name: 'Sonnig'} ];
    var currentWeatherType = weatherTypes.find(w => w.type === 'sun');
    var settings = { windSpeed: 2, rainCount: 0, leafCount: 0, snowCount: 0, cloudHeight: 100, cloudSpace: 30, cloudArch: 50, renewCheck: 10, splashBounce: 80 };
    var tickCount = 0;
    var rain = [], leafs = [], snow = [];

    // Wettercode zu Beschreibung
    const weatherConditions = { 0: { desc: 'Klarer Himmel' }, 1: { desc: 'Überwiegend klar' }, 2: { desc: 'Teilweise bewölkt' }, 3: { desc: 'Bedeckt' }, 45: { desc: 'Nebel' }, 48: { desc: 'Gefrierender Nebel' }, 51: { desc: 'Leichter Nieselregen' }, 53: { desc: 'Mäßiger Nieselregen' }, 55: { desc: 'Starker Nieselregen' }, 56: { desc: 'Leichter gefrierender Nieselregen' }, 57: { desc: 'Starker gefrierender Nieselregen' }, 61: { desc: 'Leichter Regen' }, 63: { desc: 'Mäßiger Regen' }, 65: { desc: 'Starker Regen' }, 66: { desc: 'Gefrierender Regen' }, 67: { desc: 'Gefrierender Regen' }, 71: { desc: 'Leichter Schneefall' }, 73: { desc: 'Mäßiger Schneefall' }, 75: { desc: 'Starker Schneefall' }, 77: { desc: 'Schneekörner' }, 80: { desc: 'Leichte Regenschauer' }, 81: { desc: 'Mäßige Regenschauer' }, 82: { desc: 'Heftige Regenschauer' }, 85: { desc: 'Leichte Schneeschauer' }, 86: { desc: 'Starke Schneeschauer' }, 95: { desc: 'Gewitter' }, 96: { desc: 'Gewitter mit leichtem Hagel' }, 99: { desc: 'Gewitter mit starkem Hagel' } };
    function getWeatherCondition(code) { return weatherConditions[code] || { desc: `Wettercode ${code}` }; }

    // --- Initialisierung (CodePen Basis) ---
    function init() {
        onResize();
        for(var i=0;i<clouds.length;i++){clouds[i].offset=Math.random()*sizes.card.width;drawCloud(clouds[i],i);}
        TweenMax.set(sun.node,{x:sizes.card.width/2,y:-100}); TweenMax.set(sunburst.node,{opacity:0});
        // Start mit Prompt
        showInitialPrompt();
        // Event Listener für unsere Controls
        setupSimpleEventListeners();
        // Animations-Loop
        requestAnimationFrame(tick);
        // Resize Listener
        $(window).resize(onResize);
    }

    // --- Minimale Event Listener ---
    function setupSimpleEventListeners() {
        $('#search-btn').on('click', () => {
            const city = $('#city-input').val();
            getWeatherByCityName(city);
        });
        $('#city-input').on('keydown', (e) => {
            if (e.key === 'Enter') {
                const city = $('#city-input').val();
                getWeatherByCityName(city);
            }
        });
        $('#location-btn').on('click', () => {
            getLocationWeather();
        });
        // Kein Theme Toggle, keine Favoriten, kein Autocomplete
    }

    // --- Resize Handler (CodePen) ---
    function onResize(){sizes.container.width=$container.width(); sizes.container.height=$container.height(); sizes.card.width=$card.width(); sizes.card.height=$card.height(); var cO=$card.offset(); sizes.cardOffset.top=cO?cO.top:0; sizes.cardOffset.left=cO?cO.left:0; innerSVG.attr({width:sizes.card.width,height:sizes.card.height}); outerSVG.attr({width:sizes.container.width,height:sizes.container.height}); backSVG.attr({width:sizes.container.width,height:sizes.container.height}); TweenMax.set(sunburst.node,{transformOrigin:"50% 50%",x:sizes.container.width/2,y:(sizes.card.height/2)+sizes.cardOffset.top}); if(!TweenMax.isTweening(sunburst.node))TweenMax.fromTo(sunburst.node,20,{rotation:0},{rotation:360,repeat:-1,ease:Power0.easeInOut}); leafMask.attr({x:sizes.cardOffset.left,y:0,width:sizes.container.width-sizes.cardOffset.left,height:sizes.container.height}); outerLeafHolder.attr({'clip-path':leafMask}); }

    // --- Cloud Drawing (CodePen) ---
    function drawCloud(c,i){var sp=settings.cloudSpace*i, h=sp+settings.cloudHeight, a=h+settings.cloudArch+(Math.random()*settings.cloudArch), w=sizes.card.width, p=[]; p.push('M'+[-(w),sizes.card.height].join(',')); p.push([w,sizes.card.height].join(',')); p.push('Q'+[w*2,h/2+sizes.card.height].join(',')); p.push([w,h].join(',')); p.push('Q'+[w*0.5,a].join(',')); p.push([0,h].join(',')); p.push('Q'+[w*-0.5,a].join(',')); p.push([-w,h].join(',')); p.push('Q'+[-(w*2),h/2+sizes.card.height].join(',')); p.push([-(w),sizes.card.height].join(',')); var pa=p.join(' '); if(!c.path)c.path=c.group.path(); c.path.animate({d:pa},0); c.group.transform('t'+c.offset+','+(sizes.card.height-h)); }

    // --- Partikel Erstellung & Animation (CodePen, KORRIGIERT für 'this') ---
    function makeRain() {
        var lineWidth = Math.random() * 3;
        var lineLength = currentWeatherType.type == 'thunder' ? 35 : 14;
        var x = Math.random() * (sizes.card.width - 40) + 20;
        // KORREKTUR: Direkter Zugriff auf globale Variablen statt 'this'
        var holder;
        var floorWidth = Math.floor(lineWidth);
        if (floorWidth <= 0) holder = innerRainHolder3;
        else if (floorWidth === 1) holder = innerRainHolder2;
        else holder = innerRainHolder1;
        // --- Ende Korrektur
        var line = holder.path('M0,0 0,' + lineLength).attr({ fill: 'none', stroke: currentWeatherType.type == 'thunder' ? '#aaa' : '#5B92E5', strokeWidth: lineWidth });
        rain.push(line);
        TweenMax.fromTo(line.node, 1, { x: x, y: 0 - lineLength }, { delay: Math.random(), y: sizes.card.height, ease: Power2.easeIn, onComplete: onRainEnd, onCompleteParams: [line, lineWidth, x, currentWeatherType.type] });
    }
    function onRainEnd(l,w,x,t){if(l&&l.remove)l.remove(); l=null; rain=rain.filter(i=>i!==null&&i.paper); if(rain.length<settings.rainCount)makeRain(); if(w>2)makeSplash(x,t); } function makeSplash(x,t){var sL=t=='thunder'?30:20, sB=t=='thunder'?120:100, sD=80, spd=t=='thunder'?0.7:0.5, sU=0-(Math.random()*sB), rX=((Math.random()*sD)-(sD/2)), pts=[]; pts.push('M0,0'); pts.push('Q'+rX+','+sU); pts.push((rX*2)+','+sD); var s=outerSplashHolder.path(pts.join(' ')).attr({fill:"none",stroke:t=='thunder'?'#aaa':'#5B92E5',strokeWidth:1}), pL=Snap.path.getTotalLength(s), xO=sizes.cardOffset.left, yO=sizes.cardOffset.top+sizes.card.height; if(s.node)s.node.style.strokeDasharray=pL+' '+pL; TweenMax.fromTo(s.node,spd,{strokeWidth:2,y:yO,x:xO+x,opacity:1,strokeDashoffset:pL},{strokeWidth:0,strokeDashoffset:-pL,opacity:1,onComplete:onSplashComplete,onCompleteParams:[s],ease:SlowMo.ease.config(0.4,0.1,false)}) } function onSplashComplete(s){if(s&&s.remove)s.remove(); s=null;} function makeLeaf(){var sc=0.5+(Math.random()*0.5), nL, aY=sizes.card.height/2, y=aY+(Math.random()*aY), eY=y-((Math.random()*(aY*2))-aY), x,eX,xB, clrs=['#76993E','#4A5E23','#6D632F'], clr=clrs[Math.floor(Math.random()*clrs.length)]; if(sc>0.8){nL=leaf.clone().appendTo(outerLeafHolder).attr({fill:clr}); y=y+sizes.cardOffset.top/2; eY=eY+sizes.cardOffset.top/2; x=sizes.cardOffset.left-100; xB=x+(sizes.container.width-sizes.cardOffset.left)/2; eX=sizes.container.width+50;}else{nL=leaf.clone().appendTo(innerLeafHolder).attr({fill:clr}); x=-100; xB=sizes.card.width/2; eX=sizes.card.width+50;} leafs.push(nL); var bz=[{x:x,y:y},{x:xB,y:(Math.random()*eY)+(eY/3)},{x:eX,y:eY}]; TweenMax.fromTo(nL.node,2+Math.random()*2,{rotation:Math.random()*180,x:x,y:y,scale:sc},{rotation:Math.random()*360,bezier:bz,onComplete:onLeafEnd,onCompleteParams:[nL],ease:Power0.easeIn})} function onLeafEnd(l){if(l&&l.remove)l.remove(); l=null; leafs=leafs.filter(i=>i!==null&&i.paper); if(leafs.length<settings.leafCount)makeLeaf();} function makeSnow(){var sc=0.5+(Math.random()*0.5), nS, x=20+(Math.random()*(sizes.card.width-40)), eY, y=-10; nS=innerSnowHolder.circle(0,0,5).attr({fill:'white'}); eY=sizes.card.height+10; y=settings.cloudHeight-10; snow.push(nS); TweenMax.fromTo(nS.node,3+(Math.random()*5),{x:x,y:y},{y:eY,onComplete:onSnowEnd,onCompleteParams:[nS],ease:Power0.easeIn}); TweenMax.fromTo(nS.node,1,{scale:0},{scale:sc,ease:Power1.easeInOut}); TweenMax.to(nS.node,3,{x:x+((Math.random()*150)-75),repeat:-1,yoyo:true,ease:Power1.easeInOut});} function onSnowEnd(f){if(f&&f.remove)f.remove(); f=null; snow=snow.filter(i=>i!==null&&i.paper); if(snow.length<settings.snowCount)makeSnow();}

    // --- Animations-Loop (Tick - CodePen) ---
    function tick(){tickCount++; var check=tickCount%settings.renewCheck; if(check){if(rain.length<settings.rainCount)makeRain(); if(leafs.length<settings.leafCount)makeLeaf(); if(snow.length<settings.snowCount)makeSnow();} for(var i=0;i<clouds.length;i++){var c=clouds[i], nX, cW=sizes.card.width; if(currentWeatherType.type=='sun'){if(c.offset<cW*1.5)c.offset+=settings.windSpeed/(i+1); nX=c.offset;}else{c.offset+=settings.windSpeed/(i+1); if(c.offset>=cW)c.offset=c.offset-cW*2; nX=c.offset;} c.group.transform('t'+nX+','+(sizes.card.height-(settings.cloudSpace*i+settings.cloudHeight)));} requestAnimationFrame(tick);}

    // --- Wetterwechsel Logik (CodePen + Mapping) ---
    function mapWeatherCodeToType(code, windSpeed) { const wc=Number(code),ws=Number(windSpeed); if(wc<=1)return'sun'; if(wc===95||wc===96||wc===99)return'thunder'; if((wc>=51&&wc<=67)||(wc>=80&&wc<=82))return'rain'; if((wc>=71&&wc<=77)||(wc>=85&&wc<=86)||wc===66||wc===67)return'snow'; if(wc===45||wc===48)return'fog'; if(wc===2||wc===3){if(ws>=25)return'wind';else return'cloud';} return'sun';}
    function changeWeather(weatherTypeKey) { var weatherData=weatherTypes.find(w=>w.type===weatherTypeKey)||weatherTypes.find(w=>w.type==='sun'); weatherTypes.forEach(w=>$container.removeClass(w.type)); $container.addClass(weatherData.type); currentWeatherType=weatherData; let tWS=0.5; if(weatherData.type==='wind')tWS=5; if(weatherData.type==='sun')tWS=10; if(weatherData.type==='thunder')tWS=0.8; TweenMax.to(settings,3,{windSpeed:tWS,ease:Power2.easeInOut}); let tRC=0; if(weatherData.type==='rain')tRC=20; if(weatherData.type==='thunder')tRC=50; TweenMax.to(settings,3,{rainCount:tRC,ease:Power2.easeInOut}); let tLC=0; if(weatherData.type==='wind')tLC=7; TweenMax.to(settings,3,{leafCount:tLC,ease:Power2.easeInOut}); let tSC=0; if(weatherData.type==='snow')tSC=30; TweenMax.to(settings,3,{snowCount:tSC,ease:Power2.easeInOut}); if(weatherData.type==='sun'){TweenMax.to(sun.node,4,{x:sizes.card.width/2,y:sizes.card.height*0.35,opacity:1,ease:Power2.easeInOut}); TweenMax.to(sunburst.node,4,{scale:1,opacity:0.8,y:(sizes.card.height*0.35)+sizes.cardOffset.top,ease:Power2.easeInOut});}else{TweenMax.to(sun.node,2,{y:-100,opacity:0,ease:Power2.easeIn}); TweenMax.to(sunburst.node,2,{scale:0.4,opacity:0,y:(sizes.container.height/2)-50,ease:Power2.easeIn});} startLightningTimer();}
    function startLightningTimer(){if(lightningTimeout)clearTimeout(lightningTimeout); if(currentWeatherType.type=='thunder')lightningTimeout=setTimeout(lightning,Math.random()*6000+2000);} function lightning(){startLightningTimer(); TweenMax.fromTo($card,0.75,{y:-10},{y:0,ease:Elastic.easeOut}); var pX=30+Math.random()*(sizes.card.width-60), yO=20, steps=20, pts=[pX+',0']; for(var i=0;i<steps;i++){var x=pX+(Math.random()*yO-(yO/2)), y=(sizes.card.height/steps)*(i+1); pts.push(x+','+y);} var s=innerLightningHolder.path('M'+pts.join(' ')).attr({fill:'none',stroke:'white',strokeWidth:2+Math.random()}); TweenMax.to(s.node,1,{opacity:0,ease:Power4.easeOut,onComplete:function(){if(s)s.remove(); s=null}});}

    // --- API & Rendering (Minimal) ---
    function showOverlayMessage(type, message) { $overlayContainer.empty(); const iC = type === 'loading' ? 'fa-spinner fa-spin' : (type === 'error' ? 'fa-triangle-exclamation' : 'fa-map-location-dot'); const dC = type + '-state'; const h = `<div class="${dC}"> <i class="fas ${iC}"></i> <div>${message}</div> </div>`; $overlayContainer.html(h); }
    function hideOverlayMessage() { $overlayContainer.empty(); }

    function renderWeatherData(locationName, weatherData) {
        hideOverlayMessage();
        const { current } = weatherData; // Nur current wird für die Anzeige gebraucht
        currentApiData = weatherData; // Speichern für evtl. Refresh

        // UI Aktualisieren
        $location.text(locationName);
        $temp.html(`${Math.round(current.temperature_2m)}<span>°C</span>`);
        $description.text(getWeatherCondition(current.weathercode).desc);
        $date.text(new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }));
        // $feelsLike.text(`Gefühlt: ${Math.round(current.apparent_temperature)}°`); // Vorerst entfernt

        // Animation triggern
        const mappedType = mapWeatherCodeToType(current.weathercode, current.windspeed_10m);
        changeWeather(mappedType);
    }

    // --- API Calls (Minimal) ---
    async function getWeatherFromCoords(lat, lon, locationName) {
        currentCoords = { lat, lon }; currentCityName = locationName;
        showOverlayMessage('loading', `Lade Wetter für ${locationName}...`);
        // Stoppe Partikel-Erzeugung
        TweenMax.to(settings, 1, { rainCount: 0, leafCount: 0, snowCount: 0 });

        // Nur die nötigsten Parameter holen
        const params = [ `latitude=${lat.toFixed(4)}`,`longitude=${lon.toFixed(4)}`,
                         'current=temperature_2m,apparent_temperature,weathercode,windspeed_10m', // Minimal-Set
                         'temperature_unit=celsius', 'windspeed_unit=kmh', 'timezone=auto' ];
        const apiUrl = `https://api.open-meteo.com/v1/forecast?${params.join('&')}`;
        try { const r = await fetch(apiUrl); if (!r.ok){const eD=await r.json().catch(()=>({}));throw new Error(`API Fehler: ${r.status}`);} const d = await r.json(); if (!d.current) throw new Error('Unvollständige Daten.'); renderWeatherData(locationName, d); } catch (error) { console.error('Fehler:', error); handleFetchError(error); }
    }
    async function getWeatherByCityName(city) { if (!city) { showError('Bitte gib einen Stadtnamen ein.'); return; } showOverlayMessage('loading', 'Suche Stadt...'); try { const geoR = await fetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(city)}&limit=1&lang=de&format=json&apiKey=${GEOAPIFY_API_KEY}`); if (!geoR.ok) throw new Error(`Geoapify Fehler`); const geoD = await geoR.json(); if (!geoD.results || geoD.results.length === 0) throw new Error(`Stadt nicht gefunden.`); const { lat, lon, formatted } = geoD.results[0]; const locN = geoD.results[0].city || formatted; await getWeatherFromCoords(lat, lon, locN); } catch (error) { handleFetchError(error); } }
    async function getLocationWeather() { if (!navigator.geolocation) { showError('Geolocation nicht unterstützt.'); return; } showOverlayMessage('loading', 'Ermittle Standort...'); navigator.geolocation.getCurrentPosition( async (pos) => { const { latitude, longitude } = pos.coords; try { const revGeoR = await fetch(`https://api.geoapify.com/v1/geocode/reverse?lat=${latitude}&lon=${longitude}&lang=de&format=json&apiKey=${GEOAPIFY_API_KEY}`); let locN = `Lat ${latitude.toFixed(2)}, Lon ${longitude.toFixed(2)}`; if (revGeoR.ok) { const locD = await revGeoR.json(); if (locD.results?.length > 0) locN = locD.results[0].city || locD.results[0].village || locD.results[0].suburb || locD.results[0].formatted; } await getWeatherFromCoords(latitude, longitude, locN); } catch (error) { await getWeatherFromCoords(latitude, longitude, `Lat ${latitude.toFixed(2)}, Lon ${longitude.toFixed(2)}`); } }, (err) => { handleGeolocationError(err); }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }); }
    async function autoDetectLocation() { /* Minimal: Versucht nur einmal beim Laden */ if (navigator.geolocation) { getLocationWeather(); } else { showInitialPrompt(); } }
    function handleGeolocationError(error){let m='Standort nicht ermittelt.';if(error.code===1)m='Zugriff verweigert.';if(error.code===2)m='Position nicht verfügbar.';if(error.code===3)m='Timeout.';showError(m);} function handleFetchError(error){let m='Fehler.';if(error.message.includes('Stadt'))m=error.message;else if(error.message.toLowerCase().includes('fetch')||error.message.toLowerCase().includes('network'))m='Netzwerkfehler.';else if(error.message.includes('API'))m='API Problem.'; console.error("Fetch Error:",error);showError(m);} function showInitialPrompt(){showOverlayMessage('initial','Gib eine Stadt ein oder nutze deinen Standort.'); currentCoords=null; currentCityName=null; currentApiData=null; changeWeather('sun');} function showError(message){showOverlayMessage('error',message); currentCoords=null; currentCityName=null; currentApiData=null; changeWeather('sun');}

    // --- App Start ---
    init();

}); // Ende jQuery ready
