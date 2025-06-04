function getWeatherTypeFromCode(code) {
  if ([0, 1].includes(code)) return 'sun';
  if ([2, 3].includes(code)) return 'cloudy';
  if ([45, 48].includes(code)) return 'wind';
  if ([51, 53, 55, 56, 57].includes(code)) return 'rain';
  if ([61, 63, 65, 66, 67].includes(code)) return 'rain';
  if ([71, 73, 75, 77].includes(code)) return 'snow';
  if ([80, 81, 82].includes(code)) return 'rain';
  if ([85, 86].includes(code)) return 'snow';
  if ([95, 96, 99].includes(code)) return 'thunder';
  return 'cloudy';
}

module.exports = { getWeatherTypeFromCode };
