/* Handa front-end helpers: Leaflet maps, routing, small UI niceties.
   Pages declare a map by placing <div data-map="someJsonId"> and a matching
   <script type="application/json" id="someJsonId">{...}</script>. */

(function () {
  'use strict';

  const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const OSM_ATTR = '&copy; OpenStreetMap contributors';

  function readConfig(id) {
    const el = document.getElementById(id);
    if (!el) return {};
    try { return JSON.parse(el.textContent); } catch (e) { return {}; }
  }

  function colorDot(color) {
    return L.divIcon({
      className: 'pin',
      html: `<span style="display:block;width:18px;height:18px;border-radius:50%;
             background:${color};border:3px solid #fff;box-shadow:0 0 3px rgba(0,0,0,.5)"></span>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
  }

  const SEVERITY_COLOR = { low: '#0ea5e9', medium: '#f59e0b', high: '#dc2626' };

  function buildMap(el, cfg) {
    const center = cfg.center || { lat: 14.5995, lng: 120.9842 };
    const map = L.map(el).setView([center.lat, center.lng], cfg.zoom || 12);
    L.tileLayer(OSM_URL, { attribution: OSM_ATTR, maxZoom: 19 }).addTo(map);

    const bounds = [];
    let routeLayer = null;

    // User / home marker
    if (cfg.user && cfg.user.lat) {
      L.marker([cfg.user.lat, cfg.user.lng], { icon: colorDot('#2563eb') })
        .addTo(map)
        .bindPopup(`<strong>📍 ${cfg.user.label || 'Your location'}</strong>`);
      bounds.push([cfg.user.lat, cfg.user.lng]);
    }

    // Evacuation centres
    (cfg.centers || []).forEach(function (c) {
      if (c.lat == null) return;
      const statusColor = c.status === 'open' ? '#16a34a' : c.status === 'full' ? '#f59e0b' : '#9ca3af';
      let html =
        `<strong>🏠 ${c.name}</strong><br>` +
        `<span class="small">${c.address || ''}</span><br>` +
        `<span class="small">Capacity: ${c.capacity ?? '—'} · Status: ${c.status}</span>`;
      if (typeof c.distanceKm === 'number') {
        html += `<br><span class="small">~${c.distanceKm} km · ${c.durationMin} min drive</span>`;
      }
      if (cfg.user && cfg.user.lat) {
        html +=
          `<br><button class="btn btn-sm" style="margin-top:6px"
             onclick="Handa.route(${cfg.user.lat},${cfg.user.lng},${c.lat},${c.lng})">
             Get directions</button>`;
      }
      L.marker([c.lat, c.lng], { icon: colorDot(statusColor) }).addTo(map).bindPopup(html);
      bounds.push([c.lat, c.lng]);
    });

    // Incident reports
    (cfg.reports || []).forEach(function (r) {
      if (r.lat == null) return;
      L.marker([r.lat, r.lng], { icon: colorDot(SEVERITY_COLOR[r.severity] || '#6b7280') })
        .addTo(map)
        .bindPopup(
          `<strong>⚠️ ${r.title}</strong><br>` +
          `<span class="small">${r.type} · ${r.severity} · ${r.status}</span>`
        );
      bounds.push([r.lat, r.lng]);
    });

    if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });

    // Expose a routing helper bound to this map.
    Handa.route = async function (fromLat, fromLng, toLat, toLng) {
      try {
        const res = await fetch(
          `/api/route?fromLat=${fromLat}&fromLng=${fromLng}&toLat=${toLat}&toLng=${toLng}`
        );
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Route failed');
        if (routeLayer) map.removeLayer(routeLayer);
        routeLayer = L.geoJSON(data.route.geometry, {
          style: { color: '#dc2626', weight: 5, opacity: 0.8 },
        }).addTo(map);
        map.fitBounds(routeLayer.getBounds(), { padding: [40, 40] });
        routeLayer
          .bindPopup(
            `<strong>Route</strong><br>${data.route.distanceKm} km · about ${data.route.durationMin} min by car`
          )
          .openPopup();
      } catch (e) {
        alert('Could not get directions: ' + e.message);
      }
    };

    return map;
  }

  // Public namespace
  window.Handa = {
    route: function () {},
    // Confirm before destructive form submits (used by delete buttons).
    confirmSubmit: function (form, message) {
      if (confirm(message || 'Are you sure?')) form.submit();
      return false;
    },
  };

  // Auto-initialise every declared map after the DOM is ready.
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-map]').forEach(function (el) {
      buildMap(el, readConfig(el.getAttribute('data-map')));
    });
  });
})();
