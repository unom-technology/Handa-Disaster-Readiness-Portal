'use strict';

// API #3 - GDACS Global Disaster Alert and Coordination System (gdacs.org).
// Free, no API key. Returns current disaster events (tropical cyclones, floods,
// earthquakes, volcanoes, droughts, wildfires) affecting a country.

const { fetchJson } = require('./http');
const config = require('../config');

const EVENT_LABELS = {
  TC: 'Tropical Cyclone',
  FL: 'Flood',
  EQ: 'Earthquake',
  VO: 'Volcano',
  DR: 'Drought',
  WF: 'Wildfire',
};

async function getAlerts(country = 'Philippines', { days = 30 } = {}) {
  const to = new Date();
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10);

  const params = new URLSearchParams({
    eventlist: 'TC;FL;EQ;VO;DR;WF',
    alertlevel: 'Green;Orange;Red',
    country,
    fromDate: fmt(from),
    toDate: fmt(to),
  });

  const data = await fetchJson(`${config.api.gdacs}?${params.toString()}`, {
    timeout: 15000,
  });

  const events = (data.features || []).map((f) => {
    const p = f.properties;
    return {
      id: p.eventid,
      type: EVENT_LABELS[p.eventtype] || p.eventtype,
      typeCode: p.eventtype,
      name: p.name || p.description,
      description: p.htmldescription,
      alertLevel: p.alertlevel, // Green | Orange | Red
      severity: p.severitydata ? p.severitydata.severitytext : '',
      country: p.country,
      from: p.fromdate,
      to: p.todate,
      lat: f.geometry ? f.geometry.coordinates[1] : null,
      lng: f.geometry ? f.geometry.coordinates[0] : null,
      report: p.url ? p.url.report : null,
    };
  });

  // Highest alert first (Red > Orange > Green), then most recent.
  const rank = { Red: 3, Orange: 2, Green: 1 };
  events.sort(
    (a, b) =>
      (rank[b.alertLevel] || 0) - (rank[a.alertLevel] || 0) ||
      new Date(b.from) - new Date(a.from)
  );

  return {
    source: 'GDACS',
    count: events.length,
    highest: events.length ? events[0].alertLevel : null,
    events,
    fetchedAt: new Date().toISOString(),
  };
}

module.exports = { getAlerts };
