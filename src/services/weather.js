'use strict';

// API #1 - Open-Meteo (https://open-meteo.com). Free, no API key.
// Returns current conditions + a short daily forecast and a human-readable
// summary we can show on the dashboard.

const { fetchJson } = require('./http');
const config = require('../config');

// WMO weather interpretation codes -> friendly text + emoji.
const WMO = {
  0: ['Clear sky', '☀️'],
  1: ['Mainly clear', '🌤️'],
  2: ['Partly cloudy', '⛅'],
  3: ['Overcast', '☁️'],
  45: ['Fog', '🌫️'], 48: ['Rime fog', '🌫️'],
  51: ['Light drizzle', '🌦️'], 53: ['Drizzle', '🌦️'], 55: ['Heavy drizzle', '🌧️'],
  61: ['Light rain', '🌦️'], 63: ['Rain', '🌧️'], 65: ['Heavy rain', '🌧️'],
  66: ['Freezing rain', '🌧️'], 67: ['Heavy freezing rain', '🌧️'],
  71: ['Light snow', '🌨️'], 73: ['Snow', '🌨️'], 75: ['Heavy snow', '❄️'],
  77: ['Snow grains', '🌨️'],
  80: ['Light showers', '🌦️'], 81: ['Showers', '🌧️'], 82: ['Violent showers', '⛈️'],
  85: ['Snow showers', '🌨️'], 86: ['Heavy snow showers', '❄️'],
  95: ['Thunderstorm', '⛈️'], 96: ['Thunderstorm w/ hail', '⛈️'], 99: ['Severe thunderstorm', '⛈️'],
};

function describe(code) {
  const [text, icon] = WMO[code] || ['Unknown', '❓'];
  return { text, icon };
}

// Flags conditions residents should act on.
function riskFlags(current, daily) {
  const flags = [];
  if (current.wind_gusts_10m >= 60) flags.push('Strong wind gusts');
  if (current.precipitation >= 7.5) flags.push('Heavy rain right now');
  if ([65, 82, 99].includes(current.weather_code)) flags.push('Severe weather');
  if (daily && daily.precipitation_sum && daily.precipitation_sum[0] >= 50) {
    flags.push('High rainfall expected today');
  }
  return flags;
}

async function getWeather(lat, lng) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lng,
    current:
      'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,precipitation',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max',
    timezone: 'auto',
    forecast_days: '4',
  });

  const data = await fetchJson(`${config.api.openMeteo}?${params.toString()}`);
  const current = data.current || {};
  const daily = data.daily || {};

  const forecast = (daily.time || []).map((date, i) => ({
    date,
    code: daily.weather_code[i],
    ...describe(daily.weather_code[i]),
    max: daily.temperature_2m_max[i],
    min: daily.temperature_2m_min[i],
    rain: daily.precipitation_sum[i],
    rainChance: daily.precipitation_probability_max
      ? daily.precipitation_probability_max[i]
      : null,
  }));

  return {
    source: 'Open-Meteo',
    temperature: current.temperature_2m,
    feelsLike: current.apparent_temperature,
    humidity: current.relative_humidity_2m,
    wind: current.wind_speed_10m,
    gusts: current.wind_gusts_10m,
    precipitation: current.precipitation,
    ...describe(current.weather_code),
    flags: riskFlags(current, daily),
    forecast,
    fetchedAt: new Date().toISOString(),
  };
}

module.exports = { getWeather, describe };
