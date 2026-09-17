import React, { useEffect, useMemo, useRef } from "react";
import { Map, NavigationControl, ScaleControl, setWorkerUrl } from "maplibre-gl";
import mapWorker from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";

setWorkerUrl(mapWorker);

const BRIGHT_STYLE = "https://tiles.openfreemap.org/styles/bright";
const CITY_CENTERS = {
  Hyderabad: [78.4867, 17.3850],
  Bengaluru: [77.5946, 12.9716],
  Mumbai: [72.8777, 19.0760],
  Delhi: [77.1025, 28.7041],
  Chennai: [80.2707, 13.0827],
  Pune: [73.8567, 18.5204],
  Kolkata: [88.3639, 22.5726],
  Ahmedabad: [72.5714, 23.0225],
  Visakhapatnam: [83.2185, 17.6868],
  Vijayawada: [80.6480, 16.5062],
  Warangal: [79.5941, 17.9689],
  Nizamabad: [78.0941, 18.6725],
};

function resolveCenter(context) {
  const lng = Number(context?.parcel?.longitude);
  const lat = Number(context?.parcel?.latitude);
  if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
  const named = CITY_CENTERS[context?.region];
  if (named) return named;
  return CITY_CENTERS.Hyderabad;
}

function circleFeature(center, radiusMeters = 900) {
  const [lng, lat] = center;
  const points = [];
  const latScale = 111320;
  const lngScale = 111320 * Math.max(0.25, Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= 64; i += 1) {
    const angle = (i / 64) * Math.PI * 2;
    points.push([
      lng + (Math.cos(angle) * radiusMeters) / lngScale,
      lat + (Math.sin(angle) * radiusMeters) / latScale,
    ]);
  }
  return { type: "Feature", properties: { modeled: true }, geometry: { type: "Polygon", coordinates: [points] } };
}

function CurrentMap({ center }) {
  const el = useRef(null);
  useEffect(() => {
    if (!el.current) return undefined;
    const map = new Map({ container: el.current, style: BRIGHT_STYLE, center, zoom: 13.3, pitch: 0, bearing: 0, attributionControl: true });
    map.addControl(new NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");
    map.on("load", () => {
      if (!map.getSource("policy-center")) {
        map.addSource("policy-center", { type: "geojson", data: { type: "Feature", geometry: { type: "Point", coordinates: center } } });
        map.addLayer({ id: "policy-center", type: "circle", source: "policy-center", paint: { "circle-radius": 6, "circle-color": "#1f7f6a", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });
      }
    });
    return () => map.remove();
  }, [center[0], center[1]]);
  return <div ref={el} className="policy-map-canvas-v50" />;
}

function ScenarioMap({ center, restriction }) {
  const el = useRef(null);
  const radius = Math.round(650 + Number(restriction || 0) * 9);
  const data = useMemo(() => circleFeature(center, radius), [center[0], center[1], radius]);
  useEffect(() => {
    if (!el.current) return undefined;
    const map = new Map({ container: el.current, style: BRIGHT_STYLE, center, zoom: 13.3, pitch: 35, bearing: -12, attributionControl: true });
    map.addControl(new NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");
    map.on("load", () => {
      map.addSource("policy-impact-zone", { type: "geojson", data });
      map.addLayer({ id: "policy-impact-fill", type: "fill", source: "policy-impact-zone", paint: { "fill-color": "#c68b2d", "fill-opacity": 0.22 } });
      map.addLayer({ id: "policy-impact-outline", type: "line", source: "policy-impact-zone", paint: { "line-color": "#b87918", "line-width": 2.2, "line-dasharray": [2, 2] } });
      map.addSource("policy-center-scenario", { type: "geojson", data: { type: "Feature", geometry: { type: "Point", coordinates: center } } });
      map.addLayer({ id: "policy-center-scenario", type: "circle", source: "policy-center-scenario", paint: { "circle-radius": 6, "circle-color": "#b87918", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });
    });
    return () => map.remove();
  }, [center[0], center[1], radius]);
  return <div ref={el} className="policy-map-canvas-v50" />;
}

export default function PolicyComparisonMap({ context, restriction, simulation }) {
  const center = useMemo(() => resolveCenter(context), [context?.region, context?.parcel?.latitude, context?.parcel?.longitude]);
  const after = simulation?.after || {};
  return <section className="policy-map-compare-v50">
    <div className="policy-map-compare-head-v50">
      <div><p className="eyebrow">SPATIAL POLICY COMPARISON</p><h2>Current geography vs modeled policy impact</h2><p>Both panels use the real map. Only the right panel adds a clearly labelled modeled impact zone around the active area.</p></div>
      <span>MODELED · NOT A LEGAL BOUNDARY</span>
    </div>
    <div className="policy-map-panes-v50">
      <article><div className="policy-map-label-v50"><b>CURRENT</b><span>Real geographic context</span></div><CurrentMap center={center}/></article>
      <article><div className="policy-map-label-v50"><b>POLICY SCENARIO</b><span>{restriction}% conversion restriction · modeled zone</span></div><ScenarioMap center={center} restriction={restriction}/></article>
    </div>
    <div className="policy-map-legend-v50"><span><i className="current"/>Real map context</span><span><i className="scenario"/>Modeled impact zone</span><b>{after?.agriculturalLand !== undefined ? `Scenario agriculture: ${after.agriculturalLand}%` : "Run simulation to populate impact metrics"}</b></div>
  </section>;
}
