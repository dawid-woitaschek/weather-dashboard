// script.js

// DOM-Referenzen
const container = $('.container'),
      card      = $('#card'),
      innerSVG  = Snap('#inner'),
      outerSVG  = Snap('#outer'),
      backSVG   = Snap('#back'),
      summary   = $('#summary'),
      dateEl    = $('#date'),
      tempEl    = $('.temp'),
      locNameEl = $('#location-name'),
      searchCnt = $('#location-search-container'),
      searchIn  = $('#location-search-input'),
      sugCnt    = $('#location-suggestions'),
      geoBtn    = $('#geolocation-button');

// SVG-Containers
const cloudLayers = [
  { group: Snap.select('#cloud1'), path: null, offset: 0 },
  { group: Snap.select('#cloud2'), path: null, offset: 0 },
  { group: Snap.select('#cloud3'), path: null, offset: 0 }
];

// Leaf, Rain, Snow, Lightning Holder
const outerLeaves   = outerSVG.group(),
      outerSplashes = outerSVG.group(),
      outerSnow     = outerSVG.group();
const innerRainHolders  = [
  Snap.select('#layer1')?.group(),
  Snap.select('#layer2')?.group(),
  Snap.select('#layer3')?.group()
].filter(Boolean);
const innerLeafHolder     = Snap.select('#layer1')?.group(),
      innerSnowHolder     = Snap.select('#layer1')?.group(),
      innerLightningHolder= Snap.select('#layer1')?.group();
const leafMask = outerSVG.rect();

// Sonne & Sunburst
const leafDef  = Snap.select('#leaf'),
      sun      = Snap.select('#sun'),
      sunburst = Snap.select('#sunburst');

// State & Settings
let sizes = { container:{}, card:{}, offset:{} },
    weatherTypes = [
      { type:'snow', name:'Schnee' },
      { type:'wind', name:'Windig' },
      { type:'rain', name:'Regen' },
      { type:'thunder', name:'Gewitter' },
      { type:'sun', name:'Sonnig' },
      { type:'cloudy', name:'Bewölkt' }
    ],
    settings = {
      windSpeed:2, rainCount:0, leafCount:0, snowCount:0,
      cloudSpace:30, cloudHeight:100, cloudArch:50,
      renewCheck:10
    },
    currentWeather = null,
    currentLat  = 51.51,
    currentLon  = 7.46,
    currentName = "Dortmund",
    lightningTimeout,
    geocodeTimeout;

// Geocoding & Wetter-API
const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search",
      WEATHER_URL = "https://api.open-meteo.com/v1/forecast";

function fetchGeocodingData(query) {
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(query)}&count=20&language=de&format=json`;
  $.get(url)
   .done(data => displaySuggestions(data.results))
   .fail(() => sugCnt.empty().hide());
}

function displaySuggestions(results) {
  sugCnt.empty().hide();
  if (!results?.length) return;
  const euro = ['DE','FR','IT','ES','PL','NL','BE','AT','CH','SE','NO','DK','FI','GB','IE'];
  const bonus = { PPLC:10000, PPLA:5000 };
  results.sort((a,b)=>{
    let sa=0,sb=0;
    if(a.country_code==='DE') sa+=100000; else if(euro.includes(a.country_code)) sa+=50000;
    if(b.country_code==='DE') sb+=100000; else if(euro.includes(b.country_code)) sb+=50000;
    sa += bonus[a.feature_code]||0; sb += bonus[b.feature_code]||0;
    sa += a.population||0; sb += b.population||0;
    return sb - sa;
  });
  const seen=new Set(), unique=[];
  for(const loc of results){
    const key = `${loc.name}_${loc.country_code}_${Math.round(loc.latitude*100)}_${Math.round(loc.longitude*100)}`;
    if(!seen.has(key)){ seen.add(key); unique.push(loc); }
    if(unique.length>=10) break;
  }
  for(const loc of unique){
    let det = [];
    if(loc.admin1 && loc.admin1!==loc.name) det.push(loc.admin1);
    if(loc.country) det.push(loc.country);
    const html = `<div data-lat="${loc.latitude}" data-lon="${loc.longitude}" data-name="${loc.name}">${loc.name}${det.length?` <span class="suggestion-details">(${det.join(', ')})</span>`:''}</div>`;
    sugCnt.append(html);
  }
  sugCnt.find('div').on('click',function(){
    const lat = $(this).data('lat'),
          lon = $(this).data('lon'),
          name= $(this).data('name');
    currentLat=lat; currentLon=lon; currentName=name;
    searchIn.val(name);
    fetchWeatherData(lat,lon,name);
    sugCnt.empty().hide();
  });
  sugCnt.show();
}

function fetchWeatherData(lat,lon,name="Aktueller Standort") {
  const url = `${WEATHER_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto&temperature_unit=celsius`;
  locNameEl.text(name);
  summary.text("Lädt…");
  tempEl.html("--<span>c</span>");
  $.get(url)
    .done(data=>{
      const cur = data.current;
      if(cur?.temperature_2m!=null && cur?.weather_code!=null){
        const t = Math.round(cur.temperature_2m);
        tempEl.html(`${t}<span>c</span>`);
        updateDate();
        const type = getWeatherTypeFromCode(cur.weather_code);
        changeWeather(weatherTypes.find(w=>w.type===type) || weatherTypes.find(w=>w.type==='cloudy'));
      } else handleApiError("Ungültige Daten");
    })
    .fail(_=>handleApiError("API Fehler"));
}

function handleApiError(msg){
  tempEl.html("--<span>c</span>");
  summary.text("Fehler");
  dateEl.text("Keine Daten");
  locNameEl.text("Ort unbekannt");
}

function getWeatherTypeFromCode(code){
  if([0,1].includes(code)) return 'sun';
  if([2,3].includes(code)) return 'cloudy';
  if([45,48].includes(code)) return 'wind';
  if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)) return 'rain';
  if([71,73,75,77,85,86].includes(code)) return 'snow';
  if([95,96,99].includes(code)) return 'thunder';
  return 'cloudy';
}

function updateDate(){
  const now = new Date(),
        opts= { weekday:'long', day:'numeric', month:'long' };
  dateEl.text(now.toLocaleDateString('de-DE',opts));
}

// Initialisierung
function init(){
  onResize();
  // Buttons binden
  weatherTypes.forEach(w=>{
    const btn = $('#button-'+w.type);
    if(btn.length){ w.button=btn; btn.on('click',()=>changeWeather(w)); }
  });
  // Clouds zeichnen
  cloudLayers.forEach((c,i)=>{
    if(c.group){
      c.offset = Math.random()*sizes.card.width;
      drawCloud(c,i);
      gsap.set(c.group.node,{ x:c.offset });
    }
  });
  fetchWeatherData(currentLat,currentLon,currentName);
  requestAnimationFrame(tick);
}

$(window).resize(onResize);
$(document).ready(()=>{
  searchIn.on('input',()=>{
    clearTimeout(geocodeTimeout);
    const q = searchIn.val();
    if(q.length>=3) geocodeTimeout=setTimeout(()=>fetchGeocodingData(q),300);
    else sugCnt.empty().hide();
  });
  searchIn.on('keydown',e=>{
    if(e.key==='Enter'){ e.preventDefault(); sugCnt.find('div:first').click(); }
  });
  geoBtn.on('click',()=>{
    if(navigator.geolocation){
      locNameEl.text("Standort…");
      summary.text("");
      tempEl.html("--<span>c</span>");
      searchIn.val('');
      sugCnt.empty().hide();
      navigator.geolocation.getCurrentPosition(pos=>{
        currentLat=pos.coords.latitude;
        currentLon=pos.coords.longitude;
        currentName="Aktueller Standort";
        fetchWeatherData(currentLat,currentLon,currentName);
      },err=>{
        const code = err.code;
        let msg="Standortfehler";
        if(code===err.PERMISSION_DENIED) msg="Zugriff verweigert";
        else if(code===err.POSITION_UNAVAILABLE) msg="Nicht verfügbar";
        else if(code===err.TIMEOUT) msg="Zeitüberschreitung";
        handleApiError(msg);
      },{ enableHighAccuracy:false, timeout:10000, maximumAge:600000 });
    } else handleApiError("Keine Geolocation");
  });
  $(document).on('click',e=>{
    if(!searchCnt.is(e.target)&&!searchCnt.has(e.target).length&&
       !sugCnt.is(e.target)&&!sugCnt.has(e.target).length){
      sugCnt.hide();
    }
  });
  init();
});

// Zeichnet eine Wolke
function drawCloud(c,i){
  if(!c.group) return;
  const w = sizes.card.width,
        space = settings.cloudSpace * i,
        height = space + settings.cloudHeight,
        arch   = height + settings.cloudArch + Math.random()*settings.cloudArch;
  const pts = [
    `M${-w},0`, `${w},0`,
    `Q${2*w},${height}`, `${w},${height}`,
    `Q${w/2},${arch}`, `0,${height}`,
    `Q${-w/2},${arch}`, `${-w},${height}`,
    `Q${-2*w},${height}`, `${-w},0`
  ].join(' ');
  if(!c.path) c.path = c.group.path();
  c.path.attr({ d:pts });
}

// Animationstakt
function tick(){
  requestAnimationFrame(tick);
  if(!currentWeather||!sizes.card.width) return;

  // Wolken
  cloudLayers.forEach((c,i)=>{
    const step = settings.windSpeed / (i+1);
    if(currentWeather.type==='sun'){
      if(c.offset > sizes.card.width*2.5) c.offset = -sizes.card.width*1.5;
      else c.offset += step;
    } else {
      c.offset = (c.offset + step) % sizes.card.width;
    }
    c.group.transform(`t${c.offset},0`);
  });

  // Regen
  while(innerRainHolders.length < settings.rainCount) makeRain();
  // Blätter
  while(innerLeafHolder?.children().length < settings.leafCount) makeLeaf();
  // Schnee
  while(innerSnowHolder?.children().length < settings.snowCount) makeSnow();
}

// Regen erzeugen
function makeRain(){
  if(!currentWeather) return;
  const width = Math.random()*3,
        len   = currentWeather.type==='thunder'?35:14,
        x     = Math.random()*(sizes.card.width-40)+20;
  let holder = width<1?innerRainHolders[0]:width<2?innerRainHolders[1]:innerRainHolders[2];
  if(!holder) return;
  const drop = holder.path(`M0,0 L0,${len}`).attr({
    fill:'none',
    stroke: currentWeather.type==='thunder'?'#777':'#00f',
    strokeWidth: width
  });
  gsap.fromTo(drop.node,
    { x, y: -len },
    { y: sizes.card.height, duration:1, delay:Math.random(), ease:"power2.in",
      onComplete: ()=>{ drop.remove(); }
    }
  );
}

// Leaf
function makeLeaf(){
  if(!leafDef||!outerLeaves) return;
  const scale = 0.5+Math.random()*0.5,
        color = ['#76993E','#4A5E23','#6D632F'][Math.floor(Math.random()*3)],
        startX = sizes.card.offset.left - 100,
        endX   = sizes.container.width + 50,
        yStart = Math.random()*sizes.container.height,
        yEnd   = Math.random()*sizes.container.height;
  const newLeaf = leafDef.clone().appendTo(outerLeaves).attr({ fill: color });
  gsap.fromTo(newLeaf.node,
    { x: startX, y: yStart, scale, rotation:Math.random()*360 },
    { motionPath:{
        path:[{x:startX,y:yStart},{x:(startX+endX)/2,y:(yStart+yEnd)/2},{x:endX,y:yEnd}],
        curviness:1.25, autoRotate:true
      },
      duration:4+Math.random()*4,
      onComplete:()=>newLeaf.remove()
    }
  );
}

// Schnee
function makeSnow(){
  if(!outerSnow) return;
  const scale = 0.5+Math.random()*0.5,
        x     = 20+Math.random()*(sizes.card.width-40),
        yStart= -10,
        yEnd  = sizes.card.height+10;
  const flake = outerSnow.circle(0,0,5).attr({ fill:'white' });
  gsap.fromTo(flake.node,
    { x: x+sizes.card.offset.left, y: sizes.card.offset.top, scale:0 },
    { y: yEnd, scale, duration:3+Math.random()*5, ease:"none",
      onComplete:()=>flake.remove()
    }
  );
}

// Blitz
function lightning(){
  if(!currentWeather||currentWeather.type!=='thunder'||!innerLightningHolder) return;
  startLightningTimer();
  gsap.fromTo(card,{ y:-30 },{ y:0, duration:0.75, ease:"elastic.out" });
  const pathX = 30 + Math.random()*(sizes.card.width-60),
        steps = 20, off = 20;
  const pts = [`M${pathX},0`];
  for(let i=1;i<=steps;i++){
    const x = pathX + (Math.random()*off - off/2),
          y = (sizes.card.height/steps)*i;
    pts.push(`${x},${y}`);
  }
  const d = pts.join(' ');
  const strike = innerLightningHolder.path(d).attr({ fill:'none', stroke:'white', strokeWidth:2+Math.random() });
  const length = strike.getTotalLength();
  strike.node.style.strokeDasharray = `${length} ${length}`;
  gsap.fromTo(strike.node,
    { strokeDashoffset:length, opacity:1 },
    { strokeDashoffset:-length, opacity:0, duration:1, ease:"power4.out",
      onComplete:()=>strike.remove()
    }
  );
}

function reset(){
  weatherTypes.forEach(w=>{
    container.removeClass(w.type);
    w.button?.removeClass('active');
  });
  $('nav li a.active').removeClass('active');
  clearTimeout(lightningTimeout);
}

function updateSummaryText(){
  if(!currentWeather) return;
  summary.html(currentWeather.name);
  gsap.fromTo(summary,{ x:30, opacity:0 },{ x:0, opacity:1, duration:1.5, ease:"power4.out" });
}

function startLightningTimer(){
  clearTimeout(lightningTimeout);
  if(currentWeather?.type==='thunder'){
    lightningTimeout = setTimeout(lightning, Math.random()*6000);
  }
}

function changeWeather(w){
  reset();
  currentWeather = w;
  gsap.killTweensOf(summary.node);
  gsap.to(summary.node,{ opacity:0, x:-30, duration:1, ease:"power4.in", onComplete:updateSummaryText });
  container.addClass(w.type);
  w.button?.addClass('active');

  // Ziele setzen
  let wind=0.5, rain=0, leaf=0, snow=0;
  let sunX = sizes.card.width/2, sunY = -100;
  let sbScale=0.4, sbOp=0;
  switch(w.type){
    case 'wind': wind=3; leaf=5; break;
    case 'rain': rain=10; break;
    case 'thunder': rain=60; break;
    case 'snow': snow=40; break;
    case 'sun':
      wind=20; sbScale=1; sbOp=0.8;
      sunY = sizes.card.height/2 + sizes.card.offset.top;
      break;
  }
  gsap.to(settings,{ windSpeed:wind, duration:3, ease:"power2.inOut" });
  gsap.to(settings,{ rainCount:rain, duration:(w.type==='rain'||w.type==='thunder')?3:1, ease:"power2.inOut" });
  gsap.to(settings,{ leafCount:leaf, duration:(w.type==='wind')?3:1, ease:"power2.inOut" });
  gsap.to(settings,{ snowCount:snow, duration:(w.type==='snow')?3:1, ease:"power2.inOut" });

  if(sun?.node)    gsap.to(sun.node,    { x:sunX, y:sunY, duration:(w.type==='sun')?4:2, ease:"power2.inOut" });
  if(sunburst?.node) gsap.to(sunburst.node, { scale:sbScale, opacity:sbOp, duration:(w.type==='sun')?4:2, ease:"power2.inOut" });

  startLightningTimer();
}
