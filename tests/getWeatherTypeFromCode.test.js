const { getWeatherTypeFromCode } = require('../getWeatherTypeFromCode.js');

describe('getWeatherTypeFromCode', () => {
  test('returns sun for codes 0 and 1', () => {
    expect(getWeatherTypeFromCode(0)).toBe('sun');
    expect(getWeatherTypeFromCode(1)).toBe('sun');
  });

  test('returns cloudy for codes 2 and 3', () => {
    expect(getWeatherTypeFromCode(2)).toBe('cloudy');
    expect(getWeatherTypeFromCode(3)).toBe('cloudy');
  });

  test('returns rain for code 63', () => {
    expect(getWeatherTypeFromCode(63)).toBe('rain');
  });

  test('returns snow for code 75', () => {
    expect(getWeatherTypeFromCode(75)).toBe('snow');
  });

  test('returns thunder for code 95', () => {
    expect(getWeatherTypeFromCode(95)).toBe('thunder');
  });

  test('returns cloudy for unknown code', () => {
    expect(getWeatherTypeFromCode(999)).toBe('cloudy');
  });
});
