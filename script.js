// script.js

// 📝 Fetch all DOM nodes in jQuery and Snap SVG
var container = $('.container');
var card = $('#card');
var innerSVG = Snap('#inner');
var outerSVG = Snap('#outer');
var backSVG = Snap('#back');
var summary = $('#summary');
var date = $('#date');
var temp = $('.temp');
var locationNameElement = $('#location-name'); // Referenz Ortsname

// *** Referenzen für Suche ***
var searchContainer = $('#location-search-container');
var searchInput = $('#location-search-input');
var suggestionsContainer = $('#location-suggestions');
var geolocationButton = $('#geolocation-button');

// Referenzen für Animationen
var weatherContainer1 = Snap.select('#layer1');
var weatherContainer2 = Snap.select('#layer2');
var weatherContainer3 = Snap.select('#layer3');
var innerRainHolder1 = weatherContainer1 ? weatherContainer1.group() : null;
var innerRainHolder2 = weatherContainer2 ? weatherContainer2.group() : null;
var innerRainHolder3 = weatherContainer3 ? weatherContainer3.group() : null;
var innerLeafHolder = weatherContainer1 ? weatherContainer1.group() : null;
var innerSnowHolder = weatherContainer1 ? weatherContainer1.group() : null;
var innerLightningHolder = weatherContainer1 ? weatherContainer1.group() : null;
var leafMask = outerSVG ? outerSVG.rect() : null;
var leaf = Snap.select('#leaf');
var sun = Snap.select('#sun');
var sunburst = Snap.select('#sunburst');
var outerSplashHolder = outerSVG ? outerSVG.group() : null;
var outerLeafHolder = outerSVG ? outerSVG.group() : null;
var outerSnowHolder = outerSVG ? outerSVG.group() : null;

var lightningTimeout;
var geocodeTimeout; // Für Debounce der Suche

// GSAP Plugin Registrierung
if (window.gsap && window.MotionPathPlugin) {
    try {
        gsap.registerPlugin(MotionPathPlugin);
        console.log("GSAP MotionPathPlugin registered.");
    } catch (e) {
        console.error("Error registering MotionPathPlugin:", e);
    }
} else {
    console.error("GSAP or MotionPathPlugin is not loaded!");
}

// Set mask for leaf holder
if (outerLeafHolder && leafMask) {
    outerLeafHolder.attr({
    	'clip-path': leafMask
    });
} else {
    console.error("outerLeafHolder or leafMask could not be initialized for clip-path.");
}

// create sizes object
var sizes = {
	container: {width: 0, height: 0},
	card: {width: 0, height: 0}
}

// grab cloud groups
var clouds = [
	{group: Snap.select('#cloud1'), offset: 0},
	{group: Snap.select('#cloud2'), offset: 0},
	{group: Snap.select('#cloud3'), offset: 0}
]

// set weather types
var weather = [
	{ type: 'snow', name: 'Schnee'},
	{ type: 'wind', name: 'Windig'},
	{ type: 'rain', name: 'Regen'},
	{ type: 'thunder', name: 'Gewitter'},
	{ type: 'sun', name: 'Sonnig'},
	{ type: 'cloudy', name: 'Bewölkt'}
];
var currentWeather = null;
var currentLat = 51.51;
var currentLon = 7.46;
var currentLocationName = "Dortmund";

var settings = {
	windSpeed: 2, rainCount: 0, leafCount: 0, snowCount: 0,
	cloudHeight: 100, cloudSpace: 30, cloudArch: 50,
	renewCheck: 10, splashBounce: 80
};

var tickCount = 0;
var rain = []; var leafs = []; var snow = [];

// Geocoding & Wetter API
const GEOCODING_API_URL_BASE = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_API_URL_BASE = "https://api.open-meteo.com/v1/forecast";

function fetchGeocodingData(query) {
    const url = `${GEOCODING_API_URL_BASE}?name=${encodeURIComponent(query)}&count=20&language=de&format=json`;
    console.log("Requesting Geocoding URL:", url);
    $.get(url)
        .done(function(data) { displaySuggestions(data.results); })
        .fail(function(jqXHR, textStatus, errorThrown) { console.error("Geocoding API Failed:", textStatus, errorThrown); suggestionsContainer.empty().hide(); });
}

function displaySuggestions(results) {
    suggestionsContainer.empty().hide(); if (!results || results.length === 0) return;
    const europeanCountries = ['ES', 'FR', 'PT', 'IT', 'PL', 'FI', 'SE', 'NO', 'AT', 'CH', 'NL', 'BE', 'LU', 'DK', 'GB', 'IE'];
    const featureCodeBonus = { 'PPLC': 10000, 'PPLA': 5000 };
    results.sort((a, b) => {
        let scoreA = 0, scoreB = 0;
        if (a.country_code === 'DE') scoreA += 100000; else if (europeanCountries.includes(a.country_code)) scoreA += 50000; else if (a.country_code === 'US') scoreA += 25000;
        if (b.country_code === 'DE') scoreB += 100000; else if (europeanCountries.includes(b.country_code)) scoreB += 50000; else if (b.country_code === 'US') scoreB += 25000;
        scoreA += featureCodeBonus[a.feature_code] || 0; scoreB += featureCodeBonus[b.feature_code] || 0;
        scoreA += (a.population || 0); scoreB += (b.population || 0);
        return scoreB - scoreA;
    });
    const uniqueLocations = []; const seenKeys = new Set();
    results.forEach(location => {
        const latRounded = Math.round(location.latitude * 100);
        const lonRounded = Math.round(location.longitude * 100);
        const key = `${location.name.toLowerCase()}_${location.country_code}_${latRounded}_${lonRounded}`;
        if (!seenKeys.has(key)) {
            uniqueLocations.push(location); seenKeys.add(key);
        }
    });
    uniqueLocations.slice(0, 10).forEach(location => {
        let details = [];
        if (location.admin1 && location.admin1 !== location.name) details.push(location.admin1);
        if (location.country) details.push(location.country);
        details = [...new Set(details)];
        const suggestionHTML = `<div data-lat="${location.latitude}" data-lon="${location.longitude}" data-name="${location.name}">${location.name}${details.length > 0 ? `<span class="suggestion-details">(${details.join(', ')})</span>` : ''}</div>`;
        suggestionsContainer.append(suggestionHTML);
    });
    if (uniqueLocations.length > 0) {
        $('#location-suggestions div').on('click', function() {
            const lat = $(this).data('lat');
            const lon = $(this).data('lon');
            const name = $(this).data('name');
            currentLat = lat; currentLon = lon; currentLocationName = name;
            fetchWeatherData(lat, lon, name);
            searchInput.val(name);
            suggestionsContainer.empty().hide();
        });
        suggestionsContainer.show();
    }
}

function fetchWeatherData(latitude, longitude, locationName = "Aktueller Standort") {
    const weatherApiUrl = `${WEATHER_API_URL_BASE}?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto&temperature_unit=celsius`;
    locationNameElement.text(locationName);
    summary.text("Lädt...");
    temp.html("--<span>c</span>");

    $.get(weatherApiUrl)
        .done(function(data) {
            if (data && data.current && data.current.temperature_2m !== undefined && data.current.weather_code !== undefined) {
                const current = data.current;
                const tempValue = Math.round(current.temperature_2m);
                const weatherCode = current.weather_code;
                temp.html(tempValue + '<span>c</span>');
                updateDate();
                const weatherType = getWeatherTypeFromCode(weatherCode);
                const targetWeather = weather.find(w => w.type === weatherType) || weather.find(w => w.type === 'cloudy');
                changeWeather(targetWeather);
            } else {
                handleApiError("Ungültige Wetter-API-Antwortstruktur.");
            }
        })
        .fail(function(jqXHR, textStatus) {
            handleApiError(`Wetterdaten konnten nicht geladen werden (${textStatus})`);
        });
}

function handleApiError(errorMsg) {
    temp.html("--<span>c</span>");
    summary.text("Fehler");
    date.text("Keine Daten");
    locationNameElement.text("Ort unbekannt");
}

function getWeatherTypeFromCode(code) {
    if ([0,1].includes(code)) return 'sun';
    if ([2,3].includes(code)) return 'cloudy';
    if ([45,48].includes(code)) return 'wind';
    if ([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)) return 'rain';
    if ([71,73,75,77,85,86].includes(code)) return 'snow';
    if ([95,96,99].includes(code)) return 'thunder';
    return 'cloudy';
}

function updateDate() {
    const now = new Date();
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    date.text(now.toLocaleDateString('de-DE', options));
}

function init() {
    onResize();
    weather.forEach(w => {
        const b = $('#button-' + w.type);
        if (b.length) {
            w.button = b;
            b.on('click', () => changeWeather(w));
        } else {
            console.warn("Button not found for:", w.type);
        }
    });
    clouds.forEach((c,i) => {
        if (c.group) {
            c.offset = Math.random() * sizes.card.width;
            drawCloud(c,i);
            gsap.set(c.group.node, { x: c.offset });
        } else {
            console.warn("Cloud group missing for index:", i);
        }
    });
    fetchWeatherData(currentLat, currentLon, currentLocationName);
    requestAnimationFrame(tick);
}

$(window).resize(onResize);
$(document).ready(function() {
    searchInput.on('input', function() {
        clearTimeout(geocodeTimeout);
        const q = $(this).val();
        if (q.length >= 3) {
            geocodeTimeout = setTimeout(() => fetchGeocodingData(q), 300);
        } else {
            suggestionsContainer.empty().hide();
        }
    });
    searchInput.on('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const first = $('#location-suggestions div:first-child');
            if (first.length) first.click();
            else if ($(this).val().length>=3) fetchGeocodingData($(this).val());
        }
    });
    geolocationButton.on('click', function() {
        if (navigator.geolocation) {
            locationNameElement.text("Suche Standort...");
            summary.text("");
            temp.html("--<span>c</span>");
            searchInput.val('');
            suggestionsContainer.empty().hide();
            navigator.geolocation.getCurrentPosition(pos => {
                currentLat = pos.coords.latitude;
                currentLon = pos.coords.longitude;
                currentLocationName = "Aktueller Standort";
                fetchWeatherData(currentLat, currentLon, currentLocationName);
            }, err => {
                let msg="Standort konnte nicht ermittelt werden.";
                if(err.code===err.PERMISSION_DENIED) msg="Standortzugriff verweigert.";
                else if(err.code===err.POSITION_UNAVAILABLE) msg="Standortinformationen nicht verfügbar.";
                else if(err.code===err.TIMEOUT) msg="Standortabfrage Zeitüberschreitung.";
                handleApiError(msg);
            }, { enableHighAccuracy:false, timeout:10000, maximumAge:600000 });
        } else {
            handleApiError("Geolocation wird nicht unterstützt.");
        }
    });
    $(document).on('click', function(evt) {
        if (!searchContainer.is(evt.target) && searchContainer.has(evt.target).length===0 &&
            !suggestionsContainer.is(evt.target) && suggestionsContainer.has(evt.target).length===0) {
            suggestionsContainer.hide();
        }
    });
    init();
});

function onResize() {
    sizes.container.width = container.width();
    sizes.container.height = container.height();
    sizes.card.width = card.width();
    sizes.card.height = card.height();
    sizes.card.offset = card.offset();
    if (innerSVG) innerSVG.attr({ width: sizes.card.width, height: sizes.card.height });
    if (outerSVG) outerSVG.attr({ width: sizes.container.width, height: sizes.container.height });
    if (backSVG)  backSVG.attr({ width: sizes.container.width, height: sizes.container.height });
    if (sunburst && sunburst.node) {
        gsap.set(sunburst.node, {
            transformOrigin:"50% 50%",
            x: sizes.container.width/2,
            y: sizes.card.height/2 + sizes.card.offset.top
        });
        if (!gsap.isTweening(sunburst.node)) {
            gsap.fromTo(sunburst.node,{rotation:0},{duration:20,rotation:360,repeat:-1,ease:"none"});
        }
    }
    if (leafMask && sizes.card.offset) {
        var maskX = sizes.card.offset.left + sizes.card.width;
        var maskW = sizes.container.width - maskX; if(maskW<0) maskW=0;
        leafMask.attr({ x:maskX, y:0, width:maskW, height:sizes.container.height });
    }
}

function drawCloud(cloud,i) {
    if (!cloud.group) return;
    var space = settings.cloudSpace*i;
    var height=space+settings.cloudHeight;
    var arch=height+settings.cloudArch+Math.random()*settings.cloudArch;
    var w=sizes.card.width;
    var p=['M'+[-w,0].join(','),''
        +[ w,0].join(',')
        ,'Q'+[w*2,height/2].join(','),[w,height].join(',')
        ,'Q'+[ w*0.5, arch ].join(','),[0,height].join(',')
        ,'Q'+[-w*0.5,arch].join(','),[-w,height].join(',')
        ,'Q'+[-w*2,height/2].join(','),[-w,0].join(',')].join(' ');
    if(!cloud.path) cloud.path=cloud.group.path();
    cloud.path.attr({ d:p });
}

function makeRain(){ /* … wie gehabt … */ }
function onRainEnd(line,width,x,type){ /* … */ }
function makeSplash(x,type){ /* … */ }
function onSplashComplete(splash){ /* … */ }
function makeLeaf(){ /* … */ }
function onLeafEnd(leaf){ /* … */ }
function makeSnow(){ /* … */ }
function onSnowEnd(flake){ /* … */ }

function tick(){
    requestAnimationFrame(tick);
    if(!currentWeather||!sizes.card.width) return;
    tickCount++;
    if(tickCount%settings.renewCheck){
        if(rain.length<settings.rainCount) makeRain();
        if(leafs.length<settings.leafCount) makeLeaf();
        if(snow.length<settings.snowCount) makeSnow();
    }
    clouds.forEach((c,i)=>{
        if(!c.group) return;
        if(currentWeather.type=='sun'){
            c.offset += settings.windSpeed/(i+1);
            if(c.offset>sizes.card.width*2.5) c.offset=-(sizes.card.width*1.5);
        } else {
            c.offset += settings.windSpeed/(i+1);
            if(c.offset>sizes.card.width) c.offset = c.offset - sizes.card.width;
        }
        c.group.transform('t'+c.offset+',0');
    });
}

function reset(){
    weather.forEach(w=>{ container.removeClass(w.type); if(w.button) w.button.removeClass('active'); });
    $('nav li a.active').removeClass('active');
    if(lightningTimeout) clearTimeout(lightningTimeout);
}

function updateSummaryText(){
    if(!currentWeather) return;
    summary.html(currentWeather.name);
    gsap.fromTo(summary,{x:30},{duration:1.5,opacity:1,x:0,ease:"power4.out"});
}

function startLightningTimer(){
    if(lightningTimeout) clearTimeout(lightningTimeout);
    if(currentWeather&&currentWeather.type=='thunder'){
        lightningTimeout = setTimeout(lightning, Math.random()*6000);
    }
}

function lightning(){
    if(!currentWeather||currentWeather.type!='thunder'||!innerLightningHolder) return;
    startLightningTimer();
    gsap.fromTo(card,{y:-30},{duration:0.75,y:0,ease:"elastic.out"});
    var pathX = 30 + Math.random()*(sizes.card.width-60);
    var steps = 20, yOff=20;
    var pts = ['M'+pathX+',0'];
    for(var i=0;i<steps;i++){
        var x = pathX + (Math.random()*yOff - yOff/2);
        var y = (sizes.card.height/steps)*(i+1);
        pts.push(x+','+y);
    }
    var strike = innerLightningHolder.path('M'+pts.join(' ')).attr({fill:'none',stroke:'white',strokeWidth:2+Math.random()});
    gsap.to(strika.node,{duration:1,opacity:0,ease:"power4.out",onComplete:function(){ strike.remove(); }});
}

function changeWeather(weatherData){
    var newWeather = weatherData.data ? weatherData.data : weatherData;
    if(!newWeather||!newWeather.type) return;
    reset();
    currentWeather = newWeather;
    gsap.killTweensOf(summary);
    gsap.to(summary,{duration:1,opacity:0,x:-30,onComplete:updateSummaryText,ease:"power4.in"});
    container.addClass(currentWeather.type);
    if(currentWeather.button) currentWeather.button.addClass('active');
    else $('#button-'+currentWeather.type).addClass('active');

    var windTarget, rainTarget, leafTarget, snowTarget;
    var sunXTarget = sizes.card.width/2, sunYTarget=-100;
    var sunburstScale=0.4, sunburstOpacity=0;
    switch(currentWeather.type){
        case 'wind': windTarget=3; rainTarget=0; leafTarget=5; snowTarget=0; break;
        case 'sun':  windTarget=20;rainTarget=0; leafTarget=0; snowTarget=0; sunburstScale=1; sunburstOpacity=0.8; sunYTarget = sizes.card.height/2 + (sizes.card.offset?sizes.card.offset.top:0); break;
        case 'rain': windTarget=0.5; rainTarget=10; leafTarget=0; snowTarget=0; break;
        case 'thunder': windTarget=0.5; rainTarget=60; leafTarget=0; snowTarget=0; break;
        case 'snow': windTarget=0.5; rainTarget=0; leafTarget=0; snowTarget=40; break;
        case 'cloudy':windTarget=0.5; rainTarget=0; leafTarget=0; snowTarget=0; break;
        default: windTarget=0.5; rainTarget=0; leafTarget=0; snowTarget=0;
    }
    gsap.to(settings,{duration:3,windSpeed:windTarget,ease:"power2.inOut"});
    gsap.to(settings,{duration:(currentWeather.type==='rain'||currentWeather.type==='thunder')?3:1,rainCount:rainTarget,ease:"power2.inOut"});
    gsap.to(settings,{duration:(currentWeather.type==='wind')?3:1,leafCount:leafTarget,ease:"power2.inOut"});
    gsap.to(settings,{duration:(currentWeather.type==='snow')?3:1,snowCount:snowTarget,ease:"power2.inOut"});
    if(sun&&sun.node) gsap.to(sun.node,{duration:(currentWeather.type==='sun')?4:2,x:sunXTarget,y:sunYTarget,ease:"power2.inOut"});
    if(sunburst&&sunburst.node) gsap.to(sunburst.node,{duration:(currentWeather.type==='sun')?4:2,scale:sunburstScale,opacity:sunburstOpacity,y:(sizes.container.height/2)-50,ease:"power2.inOut"});
    startLightningTimer();
}

$(document).ready(init);
