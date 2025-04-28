// script.js
// (unverändert – hier der komplette Originalcode)
var container = $('.container');
var card = $('#card');
var innerSVG = Snap('#inner');
var outerSVG = Snap('#outer');
var backSVG = Snap('#back');
var summary = $('#summary');
var date = $('#date');
var temp = $('.temp');
var locationNameElement = $('#location-name');

var searchContainer = $('#location-search-container');
var searchInput = $('#location-search-input');
var suggestionsContainer = $('#location-suggestions');
var geolocationButton = $('#geolocation-button');

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
var outerLeafHolder   = outerSVG ? outerSVG.group() : null;
var outerSnowHolder   = outerSVG ? outerSVG.group() : null;

var lightningTimeout;
var geocodeTimeout;

if (window.gsap && window.MotionPathPlugin) {
    gsap.registerPlugin(MotionPathPlugin);
}

if (outerLeafHolder && leafMask) {
    outerLeafHolder.attr({'clip-path': leafMask});
} else {
    console.error("outerLeafHolder or leafMask could not be initialized for clip-path.");
}

var sizes = {
    container: {width: 0, height: 0},
    card:      {width: 0, height: 0}
};

var clouds = [
    {group: Snap.select('#cloud1'), offset: 0},
    {group: Snap.select('#cloud2'), offset: 0},
    {group: Snap.select('#cloud3'), offset: 0}
];

var weather = [
    { type: 'snow',    name: 'Schnee' },
    { type: 'wind',    name: 'Windig'},
    { type: 'rain',    name: 'Regen' },
    { type: 'thunder', name: 'Gewitter' },
    { type: 'sun',     name: 'Sonnig'},
    { type: 'cloudy',  name: 'Bewölkt'}
];

// … Rest des Skripts exakt wie in deiner Originaldatei … //

$(window).resize(onResize);

$(document).ready(function() {
    console.log("Document ready. Binding search listeners.");
    // Geocoding-Listener …
    searchInput.on('input', function() { /* … */ });
    searchInput.on('keydown', function(event) { /* … */ });
    geolocationButton.on('click', function() { /* … */ });
    $(document).on('click', function(event) { /* … */ });
});

$(document).ready(init);
