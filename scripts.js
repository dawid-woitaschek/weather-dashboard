// scripts.js

$(document).ready(function() { // Sicherstellen, dass DOM bereit ist

    // --- Globale Variablen & DOM Referenzen ---
    // CodePen Referenzen (jQuery & Snap.svg)
    var $container = $('.container');
    var $card = $('#card');
    var innerSVG = Snap('#inner');
    var outerSVG = Snap('#outer');
    var backSVG = Snap('#back');
    // KORREKTUR: Wir deklarieren $description hier, passend zur ID #description
    var $description = $('#description'); // <<<<<<<< HIER WAR DER FEHLER ($summary war falsch)
    var $date = $('#date');
    var $location = $('#location');
    var $temp = $('.temp');
    var $feelsLike = $('#feels-like');
    var $detailsGridPlaceholder = $('#details-grid-placeholder');

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

    // Unsere Referenzen (Vanilla JS)
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

    // --- Variablen für Zustand & Animation ---
    let autocompleteTimeout, currentSuggestions = [], manualOverrideActive = false, currentCoords = null, currentCityName = null, currentApiData = null;
    var lightningTimeout;
    var sizes = { container: {width: 0, height: 0}, card: {width: 0, height: 0}, cardOffset: {top: 0, left: 0}};
    var clouds = [{group: Snap.select('#cloud1')}, {group: Snap.select('#cloud2')}, {group: Snap.select('#cloud3')}];
    var weatherTypes = [ { type: 'snow', name: 'Schnee'}, { type: 'wind', name: 'Windig'}, { type: 'rain', name: 'Regen'}, { type: 'thunder', name: 'Gewitter'}, { type: 'fog', name: 'Nebel'}, { type: 'sun', name: 'Sonnig'} ];
    var currentWeatherType = weatherTypes[5];
    var settings = { windSpeed: 2, rainCount: 0, leafCount: 0, snowCount: 0, cloudHeight: 100, cloudSpace: 30, cloudArch: 50, renewCheck: 10, splashBounce: 80 };
    var tickCount = 0;
    var rain = [], leafs = [], snow = [];

    // --- Initialisierung ---
    function init() {
        onResize();
        initializeTheme();
        loadFavorites();
        setupEventListeners();
        for(var i = 0; i < clouds.length; i++) { clouds[i].offset = Math.random() * sizes.card.width; drawCloud(clouds[i], i); }
        TweenMax.set(sun.node, { x: sizes.card.width / 2, y: -100 });
        TweenMax.set(sunburst.node, { opacity: 0 });
        autoDetectLocation();
        requestAnimationFrame(tick);
    }

    // --- Event Listener Setup ---
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
        $(window).resize(onResize);
    }

    // --- Resize Handler ---
    function onResize() {
        sizes.container.width = $container.width();
        sizes.container.height = $container.height();
        sizes.card.width = $card.width();
        sizes.card.height = $card.height();
        var cardOffsetJQ = $card.offset();
        sizes.cardOffset.top = cardOffsetJQ ? cardOffsetJQ.top : 0;
        sizes.cardOffset.left = cardOffsetJQ ? cardOffsetJQ.left : 0;
        innerSVG.attr({ width: sizes.card.width, height: sizes.card.height });
        outerSVG.attr({ width: sizes.container.width, height: sizes.container.height });
        backSVG.attr({ width: sizes.container.width, height: sizes.container.height });
        TweenMax.set(sunburst.node, { transformOrigin:"50% 50%", x: sizes.container.width / 2, y: (sizes.card.height/2) + sizes.cardOffset.top });
        if (!TweenMax.isTweening(sunburst.node)) TweenMax.fromTo(sunburst.node, 20, {rotation: 0}, {rotation: 360, repeat: -1, ease: Power0.easeInOut});
        leafMask.attr({x: sizes.cardOffset.left, y: 0, width: sizes.container.width - sizes.cardOffset.left, height: sizes.container.height});
        outerLeafHolder.attr({'clip-path': leafMask});
    }

    // --- Cloud Drawing ---
    function drawCloud(cloud, i) {
        var space  = settings.cloudSpace * i; var height = space + settings.cloudHeight; var arch = height + settings.cloudArch + (Math.random() * settings.cloudArch); var width = sizes.card.width; var points = [];
        points.push('M' + [-(width), sizes.card.height].join(',')); points.push([width, sizes.card.height].join(',')); points.push('Q' + [width * 2, height / 2 + sizes.card.height].join(',')); points.push([width, height].join(',')); points.push('Q' + [width * 0.5, arch].join(',')); points.push([0, height].join(',')); points.push('Q' + [width * -0.5, arch].join(',')); points.push([-width, height].join(',')); points.push('Q' + [- (width * 2), height/2 + sizes.card.height].join(',')); points.push([-(width), sizes.card.height].join(','));
        var path = points.join(' '); if(!cloud.path) cloud.path = cloud.group.path(); cloud.path.animate({ d: path }, 0); cloud.group.transform('t' + cloud.offset + ',' + (sizes.card.height - height));
    }

    // --- Partikel Erstellung & Animation (Rain, Leaf, Snow) ---
    function makeRain() { var lW=Math.random()*3, lL=currentWeatherType.type=='thunder'?35:14, x=Math.random()*(sizes.card.width-40)+20, h=this['innerRainHolder'+(3-Math.floor(lW))], l=h.path('M0,0 0,'+lL).attr({fill:'none',stroke:currentWeatherType.type=='thunder'?'#777':'#005FFF',strokeWidth:lW}); rain.push(l); TweenMax.fromTo(l.node,1,{x:x,y:0-lL},{delay:Math.random(),y:sizes.card.height,ease:Power2.easeIn,onComplete:onRainEnd,onCompleteParams:[l,lW,x,currentWeatherType.type]}); }
    function onRainEnd(l,w,x,t) { if(l&&l.remove)l.remove(); l=null; rain=rain.filter(i=>i!==null&&i.paper); if(rain.length<settings.rainCount)makeRain(); if(w>2)makeSplash(x,t); }
    function makeSplash(x,t) { var sL=t=='thunder'?30:20, sB=t=='thunder'?120:100, sD=80, spd=t=='thunder'?0.7:0.5, sU=0-(Math.random()*sB), rX=((Math.random()*sD)-(sD/2)), pts=[]; pts.push('M0,0'); pts.push('Q'+rX+','+sU); pts.push((rX*2)+','+sD); var s=outerSplashHolder.path(pts.join(' ')).attr({fill:"none",stroke:t=='thunder'?'#777':'#005FFF',strokeWidth:1}), pL=Snap.path.getTotalLength(s), xO=sizes.cardOffset.left, yO=sizes.cardOffset.top+sizes.card.height; if(s.node)s.node.style.strokeDasharray=pL+' '+pL; TweenMax.fromTo(s.node,spd,{strokeWidth:2,y:yO,x:xO+x,opacity:1,strokeDashoffset:pL},{strokeWidth:0,strokeDashoffset:-pL,opacity:1,onComplete:onSplashComplete,onCompleteParams:[s],ease:SlowMo.ease.config(0.4,0.1,false)}) }
    function onSplashComplete(s) { if(s&&s.remove)s.remove(); s=null; }
    function makeLeaf() { var sc=0.5+(Math.random()*0.5), nL, aY=sizes.card.height/2, y=aY+(Math.random()*aY), eY=y-((Math.random()*(aY*2))-aY), x,eX,xB, clrs=['#76993E','#4A5E23','#6D632F'], clr=clrs[Math.floor(Math.random()*clrs.length)]; if(sc>0.8){nL=leaf.clone().appendTo(outerLeafHolder).attr({fill:clr}); y=y+sizes.cardOffset.top/2; eY=eY+sizes.cardOffset.top/2; x=sizes.cardOffset.left-100; xB=x+(sizes.container.width-sizes.cardOffset.left)/2; eX=sizes.container.width+50;}else{nL=leaf.clone().appendTo(innerLeafHolder).attr({fill:clr}); x=-100; xB=sizes.card.width/2; eX=sizes.card.width+50;} leafs.push(nL); var bz=[{x:x,y:y},{x:xB,y:(Math.random()*eY)+(eY/3)},{x:eX,y:eY}]; TweenMax.fromTo(nL.node,2+Math.random()*2,{rotation:Math.random()*180,x:x,y:y,scale:sc},{rotation:Math.random()*360,bezier:bz,onComplete:onLeafEnd,onCompleteParams:[nL],ease:Power0.easeIn}) }
    function onLeafEnd(l) { if(l&&l.remove)l.remove(); l=null; leafs=leafs.filter(i=>i!==null&&i.paper); if(leafs.length<settings.leafCount)makeLeaf(); }
    function makeSnow() { var sc=0.5+(Math.random()*0.5), nS, x=20+(Math.random()*(sizes.card.width-40)), eY, y=-10; nS=innerSnowHolder.circle(0,0,5).attr({fill:'white'}); eY=sizes.card.height+10; y=settings.cloudHeight-10; snow.push(nS); TweenMax.fromTo(nS.node,3+(Math.random()*5),{x:x,y:y},{y:eY,onComplete:onSnowEnd,onCompleteParams:[nS],ease:Power0.easeIn}); TweenMax.fromTo(nS.node,1,{scale:0},{scale:sc,ease:Power1.easeInOut}); TweenMax.to(nS.node,3,{x:x+((Math.random()*150)-75),repeat:-1,yoyo:true,ease:Power1.easeInOut}); }
    function onSnowEnd(f) { if(f&&f.remove)f.remove(); f=null; snow=snow.filter(i=>i!==null&&i.paper); if(snow.length<settings.snowCount)makeSnow(); }

    // --- Animations-Loop (Tick) ---
    function tick() { tickCount++; var check=tickCount%settings.renewCheck; if(check){if(rain.length<settings.rainCount)makeRain(); if(leafs.length<settings.leafCount)makeLeaf(); if(snow.length<settings.snowCount)makeSnow();} for(var i=0;i<clouds.length;i++){var c=clouds[i], nX, cW=sizes.card.width; if(currentWeatherType.type=='sun'){if(c.offset<cW*1.5)c.offset+=settings.windSpeed/(i+1); nX=c.offset;}else{c.offset+=settings.windSpeed/(i+1); if(c.offset>=cW)c.offset=c.offset-cW*2; nX=c.offset;} c.group.transform('t'+nX+','+(sizes.card.height-(settings.cloudSpace*i+settings.cloudHeight)));} requestAnimationFrame(tick); }

    // --- Wetterwechsel Logik ---
    function mapWeatherCodeToType(code, windSpeed) { const wc=Number(code), ws=Number(windSpeed); if(wc<=1)return'sun'; if(wc===95||wc===96||wc===99)return'thunder'; if((wc>=51&&wc<=67)||(wc>=80&&wc<=82))return'rain'; if((wc>=71&&wc<=77)||(wc>=85&&wc<=86)||wc===66||wc===67)return'snow'; if(wc===45||wc===48)return'fog'; if(wc===2||wc===3){if(ws>=25)return'wind';else return'cloud';} return'sun'; }
    function changeWeather(weatherTypeKey) { var weatherData=weatherTypes.find(w=>w.type===weatherTypeKey)||weatherTypes.find(w=>w.type==='sun'); weatherTypes.forEach(w=>$container.removeClass(w.type)); $container.addClass(weatherData.type); currentWeatherType=weatherData; let tWS=0.5; if(weatherData.type==='wind')tWS=5; if(weatherData.type==='sun')tWS=10; if(weatherData.type==='thunder')tWS=0.8; TweenMax.to(settings,3,{windSpeed:tWS,ease:Power2.easeInOut}); let tRC=0; if(weatherData.type==='rain')tRC=20; if(weatherData.type==='thunder')tRC=50; TweenMax.to(settings,3,{rainCount:tRC,ease:Power2.easeInOut}); let tLC=0; if(weatherData.type==='wind')tLC=7; TweenMax.to(settings,3,{leafCount:tLC,ease:Power2.easeInOut}); let tSC=0; if(weatherData.type==='snow')tSC=30; TweenMax.to(settings,3,{snowCount:tSC,ease:Power2.easeInOut}); if(weatherData.type==='sun'){TweenMax.to(sun.node,4,{x:sizes.card.width/2,y:sizes.card.height*0.35,opacity:1,ease:Power2.easeInOut}); TweenMax.to(sunburst.node,4,{scale:1,opacity:0.8,y:(sizes.card.height*0.35)+sizes.cardOffset.top,ease:Power2.easeInOut});}else{TweenMax.to(sun.node,2,{y:-100,opacity:0,ease:Power2.easeIn}); TweenMax.to(sunburst.node,2,{scale:0.4,opacity:0,y:(sizes.container.height/2)-50,ease:Power2.easeIn});} startLightningTimer(); }
    function startLightningTimer() { if(lightningTimeout)clearTimeout(lightningTimeout); if(currentWeatherType.type=='thunder')lightningTimeout=setTimeout(lightning,Math.random()*6000+2000); }
    function lightning() { startLightningTimer(); TweenMax.fromTo($card,0.75,{y:-10},{y:0,ease:Elastic.easeOut}); var pX=30+Math.random()*(sizes.card.width-60), yO=20, steps=20, pts=[pX+',0']; for(var i=0;i<steps;i++){var x=pX+(Math.random()*yO-(yO/2)), y=(sizes.card.height/steps)*(i+1); pts.push(x+','+y);} var s=innerLightningHolder.path('M'+pts.join(' ')).attr({fill:'none',stroke:'white',strokeWidth:2+Math.random()}); TweenMax.to(s.node,1,{opacity:0,ease:Power4.easeOut,onComplete:function(){if(s)s.remove(); s=null}}); }

    // --- Unsere API & Rendering Logik ---
    function showOverlayMessage(type,message){$('.loading-state,.error-state,.initial-prompt').remove(); const iC=type==='loading'?'fa-spinner fa-spin':(type==='error'?'fa-triangle-exclamation':'fa-map-location-dot'); const dC=type+'-state'; const h=`<div class="${dC}"> <i class="fas ${iC}"></i> <div>${message}</div> </div>`; $card.append(h);} function hideOverlayMessage(){$('.loading-state,.error-state,.initial-prompt').remove();}
    function renderWeatherData(locationName,weatherData){ hideOverlayMessage(); const{current,hourly,daily}=weatherData; currentApiData=weatherData; $location.text(locationName); $temp.html(`${Math.round(current.temperature_2m)}<span>°C</span>`);
    // KORREKTUR: Verwende die deklarierte Variable $description
    $description.text(getWeatherCondition(current.weathercode).desc); // <<<<<< HIER WAR DER FEHLER
    $date.text(new Date().toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long'})); $feelsLike.text(`Gefühlt: ${Math.round(current.apparent_temperature)}°`); const dH=` <div class="details-grid"> <div class="detail-item"> <div class="label"><i class="fas fa-temperature-high"></i> Max</div> <div class="value">${Math.round(daily.temperature_2m_max[0]??'--')}°</div> </div> <div class="detail-item"> <div class="label"><i class="fas fa-temperature-low"></i> Min</div> <div class="value">${Math.round(daily.temperature_2m_min[0]??'--')}°</div> </div> <div class="detail-item"> <div class="label"><i class="fas fa-wind"></i> Wind</div> <div class="value"> ${Math.round(current.windspeed_10m)}<span class="unit">km/h</span> <i class="fas fa-location-arrow wind-dir-icon" style="transform: rotate(${current.winddirection_10m-45}deg);" title="${current.winddirection_10m}°"></i> </div> </div> <div class="detail-item"> <div class="label"><i class="fas fa-tint"></i> Feuchte</div> <div class="value">${current.relativehumidity_2m}<span class="unit">%</span></div> </div> <div class="detail-item"> <div class="label"><i class="fas fa-cloud-showers-heavy"></i> Niederschl.</div> <div class="value">${current.precipitation}<span class="unit">mm</span></div> </div> <div class="detail-item"> <div class="label"><i class="fas fa-sun"></i> UV-Index</div> <div class="value">${Math.round(current.uv_index??0)} <span class="unit uv-desc">${getUVDescription(current.uv_index)}</span></div> </div> </div>`; $detailsGridPlaceholder.html(dH); const mappedType=mapWeatherCodeToType(current.weathercode,current.windspeed_10m); changeWeather(mappedType); const favs=getFavorites(); const isFav=favs.some(fav=>fav.lat===currentCoords?.lat&&fav.lon===currentCoords?.lon); updateFavoriteButtonState(isFav); } const getUVDescription=(uv)=>{if(uv===null||uv===undefined)return''; const rUv=Math.round(uv); if(rUv<=2)return'Niedrig'; if(rUv<=5)return'Mittel'; if(rUv<=7)return'Hoch'; if(rUv<=10)return'Sehr hoch'; return'Extrem';};
    async function getWeatherFromCoords(lat,lon,locationName){ currentCoords={lat,lon}; currentCityName=locationName; showOverlayMessage('loading',`Lade Wetter für ${locationName}...`); TweenMax.to(settings,1,{rainCount:0,leafCount:0,snowCount:0}); const params=[`latitude=${lat.toFixed(4)}`,`longitude=${lon.toFixed(4)}`,'current=temperature_2m,relativehumidity_2m,apparent_temperature,is_day,precipitation,weathercode,surface_pressure,windspeed_10m,winddirection_10m,uv_index','daily=weathercode,temperature_2m_max,temperature_2m_min,sunrise,sunset','temperature_unit=celsius','windspeed_unit=kmh','precipitation_unit=mm','timezone=auto','forecast_days=1']; const apiUrl=`https://api.open-meteo.com/v1/forecast?${params.join('&')}`; try{const r=await fetch(apiUrl); if(!r.ok){const eD=await r.json().catch(()=>({})); throw new Error(`Open-Meteo Fehler: ${r.status} ${eD.reason||''}`);} const d=await r.json(); if(!d.current||!d.daily)throw new Error('Unvollständige Daten.'); renderWeatherData(locationName,d);}catch(error){console.error('Fehler:',error); handleFetchError(error);}}
    function showInitialPrompt(){showOverlayMessage('initial','Gib eine Stadt ein oder nutze deinen Standort.'); currentCoords=null; currentCityName=null; currentApiData=null; updateFavoriteButtonState(false); changeWeather('sun');} function showError(message){showOverlayMessage('error',message); currentCoords=null; currentCityName=null; currentApiData=null; changeWeather('sun');}
    // --- Restliche Hilfsfunktionen (Autocomplete, Favoriten, Theme, Geo, etc.) ---
    function initializeTheme(){const pL=window.matchMedia&&window.matchMedia('(prefers-color-scheme:light)').matches;if(pL)applyLightTheme();else applyDarkTheme();updateThemeToggleIcon();if(window.matchMedia){const q=window.matchMedia('(prefers-color-scheme:light)');q.addEventListener('change',(e)=>{if(!manualOverrideActive){if(e.matches)applyLightTheme();else applyDarkTheme();updateThemeToggleIcon();if(currentCoords)handleRefresh();}});}} function toggleThemeManually(){manualOverrideActive=true;const iL=document.body.classList.contains('light-theme');if(iL)applyDarkTheme();else applyLightTheme();updateThemeToggleIcon();if(currentCoords)handleRefresh();} function applyLightTheme(){document.body.classList.add('light-theme');} function applyDarkTheme(){document.body.classList.remove('light-theme');} function updateThemeToggleIcon(){themeToggle.innerHTML=document.body.classList.contains('light-theme')?'<i class="fas fa-moon"></i>':'<i class="fas fa-sun"></i>';themeToggle.setAttribute('aria-label',document.body.classList.contains('light-theme')?'Dark Mode':'Light Mode');} function getFavorites(){const f=localStorage.getItem(FAVORITES_KEY);return f?JSON.parse(f):[];} function saveFavorites(f){localStorage.setItem(FAVORITES_KEY,JSON.stringify(f));loadFavorites();} function loadFavorites(){const f=getFavorites();favoritesSelect.innerHTML='<option value="">Favoriten...</option>';f.forEach((fav,i)=>{const o=document.createElement('option');o.value=i;o.textContent=fav.name;favoritesSelect.appendChild(o);});} function addFavorite(n,la,lo){if(!n||la===null||lo===null)return;const f=getFavorites();if(!f.some(fav=>fav.lat===la&&fav.lon===lo)){f.push({name:n,lat:la,lon:lo});saveFavorites(f);updateFavoriteButtonState(true);}} function handleFavoriteSelection(){const i=favoritesSelect.value;if(i==="")return;const f=getFavorites();const s=f[parseInt(i)];if(s){cityInput.value=s.name;getWeatherFromCoords(s.lat,s.lon,s.name);}favoritesSelect.value="";} function updateFavoriteButtonState(isFav){const b=$('#add-favorite-button');if(b.length){b.toggleClass('is-favorite',isFav);b.html(isFav?'<i class="fas fa-heart"></i>':'<i class="far fa-heart"></i>');b.attr('title',isFav?'Aus Favoriten entfernen (n.i.)':'Zu Favoriten hinzufügen');}} function handleRefresh(){if(currentCoords&&currentApiData){renderWeatherData(currentCityName,currentApiData);}else if(currentCoords){getWeatherFromCoords(currentCoords.lat,currentCoords.lon,currentCityName);}else{getLocationWeather(false);}} function handleAutocompleteInput(e){clearTimeout(autocompleteTimeout);const s=e.target.value.trim();if(s.length<2){hideAutocomplete();return;}autocompleteTimeout=setTimeout(async()=>{try{const r=await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(s)}&type=city&lang=de&limit=5&format=json&apiKey=${GEOAPIFY_API_KEY}`);if(!r.ok)throw Error();const d=await r.json();currentSuggestions=d.results||[];showAutocompleteSuggestions(currentSuggestions);}catch(err){hideAutocomplete();}},300);} function showAutocompleteSuggestions(suggestions){if(!suggestions||suggestions.length===0){hideAutocomplete();return;}autocompleteDropdown.innerHTML=suggestions.map(s=>{const c=s.city||s.name||s.address_line1;const co=s.country;const dn=c&&co?`${c}, ${co}`:s.formatted;return`<div class="autocomplete-item" data-lat="${s.lat}" data-lon="${s.lon}" data-name="${dn}">${highlightMatch(dn,cityInput.value)}</div>`;}).join('');$(autocompleteDropdown).find('.autocomplete-item').on('click',function(){const n=$(this).data('name');const la=parseFloat($(this).data('lat'));const lo=parseFloat($(this).data('lon'));cityInput.value=n;hideAutocomplete();cityInput.blur();getWeatherFromCoords(la,lo,n);});autocompleteDropdown.style.display='block';} function hideAutocomplete(){autocompleteDropdown.style.display='none';autocompleteDropdown.innerHTML='';currentSuggestions=[];} function handleInputKeydown(e){if(e.key==='Enter'){e.preventDefault();if(autocompleteDropdown.style.display==='block'&&currentSuggestions.length>0){$(autocompleteDropdown).find('.autocomplete-item').first().trigger('click');}else{hideAutocomplete();getWeatherByCityName();}cityInput.blur();}else if(e.key==='Escape'){hideAutocomplete();}} function handleClickOutsideAutocomplete(e){if(!$(e.target).closest('.autocomplete-container').length){hideAutocomplete();}} function handleEscapeKey(e){if(e.key==='Escape')hideAutocomplete();} function highlightMatch(text,query){if(!query||!text)return text||'';const eq=query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const rgx=new RegExp(`(${eq})`,'gi');return text.replace(rgx,'<b>$1</b>');} async function getWeatherByCityName(){const city=cityInput.value.trim();if(!city){showError('Bitte gib einen Stadtnamen ein.');return;}showOverlayMessage('loading','Suche Stadt...');hideAutocomplete();try{const geoR=await fetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(city)}&limit=1&lang=de&format=json&apiKey=${GEOAPIFY_API_KEY}`);if(!geoR.ok)throw new Error(`Geoapify Fehler`);const geoD=await geoR.json();if(!geoD.results||geoD.results.length===0)throw new Error(`Stadt "${city}" nicht gefunden.`);const{lat,lon,formatted}=geoD.results[0];const locN=geoD.results[0].city||formatted;await getWeatherFromCoords(lat,lon,locN);}catch(error){handleFetchError(error);}} async function getLocationWeather(isAutoDetect=false){if(!navigator.geolocation){showError('Geolocation nicht unterstützt.');return;}showOverlayMessage('loading','Ermittle Standort...');navigator.geolocation.getCurrentPosition(async(pos)=>{const{latitude,longitude}=pos.coords;try{const revGeoR=await fetch(`https://api.geoapify.com/v1/geocode/reverse?lat=${latitude}&lon=${longitude}&lang=de&format=json&apiKey=${GEOAPIFY_API_KEY}`);let locN=`Lat ${latitude.toFixed(2)}, Lon ${longitude.toFixed(2)}`;if(revGeoR.ok){const locD=await revGeoR.json();if(locD.results?.length>0)locN=locD.results[0].city||locD.results[0].village||locD.results[0].suburb||locD.results[0].formatted;}await getWeatherFromCoords(latitude,longitude,locN);}catch(error){await getWeatherFromCoords(latitude,longitude,`Lat ${latitude.toFixed(2)}, Lon ${longitude.toFixed(2)}`);}},(err)=>{if(!isAutoDetect)handleGeolocationError(err);else showInitialPrompt();},{enableHighAccuracy:false,timeout:10000,maximumAge:300000});} async function autoDetectLocation(){if(!navigator.geolocation||!navigator.permissions){showInitialPrompt();return;}try{const perm=await navigator.permissions.query({name:'geolocation'});if(perm.state==='granted')getLocationWeather(true);else showInitialPrompt();perm.onchange=()=>{if(perm.state==='granted'&&$('.initial-prompt, .error-state').length)getLocationWeather(true);else if(perm.state!=='granted'&&$('.loading-state').length)showInitialPrompt();};}catch(error){showInitialPrompt();}} function handleGeolocationError(error){let msg='Standort nicht ermittelt.';if(error.code===1)msg='Zugriff verweigert.';if(error.code===2)msg='Position nicht verfügbar.';if(error.code===3)msg='Timeout.';showError(msg);} function handleFetchError(error){let msg='Fehler.';if(error.message.includes('Stadt')&&error.message.includes('gefunden'))msg=error.message;else if(error.message.toLowerCase().includes('fetch')||error.message.toLowerCase().includes('network'))msg='Netzwerkfehler.';else if(error.message.includes('API')||error.message.includes('Fehler'))msg='API Problem.';else if(error.message.includes('Unvollständige'))msg='Daten unvollständig.';console.error("Fetch Error:",error);showError(msg);}

    // --- App Start ---
    init();

}); // Ende jQuery ready
