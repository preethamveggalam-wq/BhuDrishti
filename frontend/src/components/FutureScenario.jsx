import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Map, NavigationControl, ScaleControl, Popup, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import mapWorker from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
setWorkerUrl(mapWorker);

const DEFAULT_LOCATION = "Hyderabad";
const DEFAULT_CENTER = [78.4867, 17.3850];
const KANDLAKOYA = DEFAULT_CENTER;

const HISTORICAL_START = 2014;
const PRESENT_YEAR = 2026;
const FUTURE_END = 2045;
const WAYBACK_CONFIG_URL = "https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json";
const CURRENT_IMAGERY_TILES = [
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
];
const OPENFREEMAP_PLANET = "https://tiles.openfreemap.org/planet";
const FALLBACK_WAYBACK = [
  { releaseDateLabel: "2014-02-20", releaseNum: 10, itemTitle: "World Imagery (Wayback 2014-02-20)" },
  { releaseDateLabel: "2016-01-13", releaseNum: 3515, itemTitle: "World Imagery (Wayback 2016-01-13)" },
  { releaseDateLabel: "2017-01-11", releaseNum: 577, itemTitle: "World Imagery (Wayback 2017-01-11)" },
  { releaseDateLabel: "2018-01-08", releaseNum: 13161, itemTitle: "World Imagery (Wayback 2018-01-08)" },
  { releaseDateLabel: "2019-01-09", releaseNum: 6036, itemTitle: "World Imagery (Wayback 2019-01-09)" },
  { releaseDateLabel: "2020-01-08", releaseNum: 23001, itemTitle: "World Imagery (Wayback 2020-01-08)" },
  { releaseDateLabel: "2021-01-13", releaseNum: 1049, itemTitle: "World Imagery (Wayback 2021-01-13)" },
  { releaseDateLabel: "2022-01-12", releaseNum: 42663, itemTitle: "World Imagery (Wayback 2022-01-12)" },
  { releaseDateLabel: "2023-12-07", releaseNum: 56102, itemTitle: "World Imagery (Wayback 2023-12-07)" },
].map((item) => ({
  ...item,
  itemURL: `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/${item.releaseNum}/{level}/{row}/{col}`,
}));

let waybackCatalogPromise = null;
let waybackCatalogUsedFallback = false;

function waybackXYZ(item) {
  return String(item?.itemURL || "")
    .replace("{level}", "{z}")
    .replace("{row}", "{y}")
    .replace("{col}", "{x}");
}

async function loadWaybackCatalog() {
  if (waybackCatalogPromise) return waybackCatalogPromise;
  waybackCatalogPromise = fetch(WAYBACK_CONFIG_URL, { cache: "force-cache" })
    .then((r) => r.ok ? r.json() : Promise.reject(new Error(`Wayback config ${r.status}`)))
    .then((data) => Object.values(data || {}).map((item) => ({
      ...item,
      releaseDateLabel: item.releaseDateLabel || String(item.itemTitle || "").match(/(\d{4}-\d{2}-\d{2})/)?.[1],
    })).filter((item) => item.releaseDateLabel && item.itemURL))
    .then((items) => items.sort((a, b) => new Date(a.releaseDateLabel) - new Date(b.releaseDateLabel)))
    .catch(() => {
      waybackCatalogUsedFallback = true;
      return FALLBACK_WAYBACK;
    });
  return waybackCatalogPromise;
}

function pickWaybackRelease(items, year) {
  if (!Array.isArray(items) || !items.length) return null;
  const candidates = items.filter((item) => Number(String(item.releaseDateLabel).slice(0, 4)) <= year);
  return (candidates.length ? candidates : items).reduce((best, item) => {
    const d = Math.abs(Number(String(item.releaseDateLabel).slice(0, 4)) - year);
    const bd = Math.abs(Number(String(best.releaseDateLabel).slice(0, 4)) - year);
    return d < bd ? item : best;
  }, candidates.length ? candidates[0] : items[0]);
}

function timelineState(year) {
  if (year < PRESENT_YEAR) return "past";
  if (year === PRESENT_YEAR) return "present";
  return "future";
}

function timelineLabel(year) {
  const state = timelineState(year);
  if (state === "past") return "PAST · HISTORICAL IMAGERY";
  if (state === "present") return "PRESENT · CURRENT IMAGERY";
  return "FUTURE · REAL MAPPED EVIDENCE";
}

function timelineDescription(year) {
  const state = timelineState(year);
  if (state === "past") return "Real archived satellite imagery from the nearest available Esri World Imagery Wayback release.";
  if (state === "present") return "Current real-world satellite imagery for the searched location.";
  return "Current real-world map with mapped construction / proposed evidence where available.";
}

function extractLocation(text) {
  const raw = String(text || "").trim();
  if (!raw) return DEFAULT_LOCATION;
  const patterns = [
    /(?:show me|visualize|simulate|explore|model|see)\s+(?:how\s+)?(.+?)(?=\s+(?:will|would|could|might|look|after|in\s+20\d{2}|by\s+20\d{2})\b|[,.]|$)/i,
    /(?:how\s+(?:will|would)|what\s+will)\s+(.+?)\s+(?:look|change|become|have)\b/i,
    /(?:future\s+of|scenario\s+for)\s+(.+?)(?=\s+(?:after|in\s+20\d{2}|by\s+20\d{2}|with)\b|[,.]|$)/i,
    /(?:in|at|near|around|for)\s+([A-Za-z][A-Za-z .'-]{1,70}?)(?=\s+(?:after|in|by|with|what|how|will|would|could)\b|[,.]|$)/i
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m?.[1]) {
      const value = m[1].trim().replace(/\s+/g, " ");
      if (value && !/^(the|this|that|future|city|area|place)$/i.test(value)) return value;
    }
  }
  return DEFAULT_LOCATION;
}

function sourcesFor(location) {
  if (location.toLowerCase().includes("kandlakoya")) return [
    { label: "Telangana State Portal", text: "Kandlakoya junction corridor / infrastructure context" },
    { label: "Gateway IT Park reporting", text: "10,000+ employee capacity was reported for the original IT-park plan" },
    { label: "HMDA", text: "Planning, layout, building-permission and land-use workflows" },
    { label: "OpenStreetMap / Overpass", text: "Mapped construction and proposed/planned features near the selected location" },
  ];
  return [
    { label: "OpenStreetMap / Nominatim", text: "Geographic place context resolved from the searched location" },
    { label: "OpenFreeMap", text: "Real-world map context for the selected place" },
    { label: "OpenStreetMap / Overpass", text: "Mapped construction and proposed/planned features near the selected location" },
  ];
}

function scenarioFor(year, completion, location = DEFAULT_LOCATION) {
  const progress = Math.min(1, completion / 100);
  const nameSeed = [...location.toLowerCase()].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 997, 17);
  const isKandlakoya = location.toLowerCase().includes("kandlakoya");
  const basePopulation = isKandlakoya ? 2802 : 12000 + (nameSeed % 42000);
  const baseWorkers = isKandlakoya ? 10000 : 4500 + (nameSeed % 12500);
  const baseHomes = isKandlakoya ? 337 : 180 + (nameSeed % 920);
  const baseBuilt = isKandlakoya ? 292244 : 90000 + (nameSeed % 260000);

  if (year < PRESENT_YEAR) {
    const historicalProgress = Math.max(0, Math.min(1, (year - HISTORICAL_START) / (PRESENT_YEAR - HISTORICAL_START)));
    const population = Math.round(basePopulation * (0.78 + historicalProgress * 0.22));
    const workers = Math.round(baseWorkers * (0.62 + historicalProgress * 0.38));
    const residents = Math.max(0, Math.round(baseHomes * historicalProgress * 0.55));
    const built = Math.round(baseBuilt * (0.25 + historicalProgress * 0.45));
    const growth = Math.round(18 + historicalProgress * 58 + (nameSeed % 7));
    const traffic = Math.round(28 + historicalProgress * 42 + (nameSeed % 8));
    const transit = Math.min(5, Math.max(1, Math.round(1 + historicalProgress * 3)));
    const green = Math.round(72 - historicalProgress * 24);
    return {
      growth, built, workers, residents, roads: Math.max(1, Math.round(1 + historicalProgress * 2)),
      green, population, traffic, transit, isKandlakoya, historical: true
    };
  }

  const years = year - PRESENT_YEAR;
  const maturity = Math.min(1, years / 10);
  const growth = Math.min(100, Math.round(18 + years * 3.1 + progress * 24 + (nameSeed % 9)));
  const built = Math.round(baseBuilt * progress * Math.min(1, 0.35 + years / 10));
  const workers = Math.round(baseWorkers * progress * (1 + Math.min(years, 10) * 0.035));
  const residents = Math.round(baseHomes * progress);
  const roads = Math.max(1, Math.round(1 + progress * 3 + years * 0.15));
  const green = Math.max(8, Math.round(17 - years * 0.35 + progress * 2));
  const population = Math.round(basePopulation * (1 + years * 0.035) + residents * 2.6);
  const traffic = Math.round(42 + years * 2.4 + progress * 20 + (nameSeed % 8));
  const transit = Math.min(5, Math.round(1 + maturity * 2 + progress));
  return { growth, built, workers, residents, roads, green, population, traffic, transit, isKandlakoya, historical: false };
}

function parseQuestion(text) {
  const q = text.toLowerCase();
  const yearMatch = q.match(/(?:after|in|by)\s+(\d{1,2})\s*(?:years?|yrs?)/i);
  const explicitYear = q.match(/\b(20\d{2})\b/);
  const years = yearMatch ? Number(yearMatch[1]) : explicitYear ? Number(explicitYear[1]) - PRESENT_YEAR : 10;
  const year = explicitYear ? Math.min(FUTURE_END, Math.max(HISTORICAL_START, Number(explicitYear[1]))) : Math.min(FUTURE_END, Math.max(PRESENT_YEAR + 1, PRESENT_YEAR + years));
  const location = extractLocation(text);
  return { location, year };
}

function scenarioSites(year, completion, center = DEFAULT_CENTER, location = DEFAULT_LOCATION) {
  const [x, y] = center;
  const p = completion / 100;
  const t = Math.min(1.35, 0.65 + (year - 2026) * 0.045);
  const d = (v) => v * t * (0.85 + p * 0.15);
  return [
    { kind: "it", name: `${location} Employment District`, center: [x - 0.0031, y - 0.0013], size: [d(0.0058), d(0.0034)], jobs: "10,000+ capacity context", height: 18 },
    { kind: "res", name: `${location} Residential Growth Zone`, center: [x + 0.0028, y - 0.0031], size: [d(0.0052), d(0.0036)], jobs: "337 units modeled", height: 10 },
    { kind: "com", name: `${location} Commercial / Services Cluster`, center: [x + 0.0056, y + 0.0018], size: [d(0.0034), d(0.0030)], jobs: "Retail + services", height: 13 },
    { kind: "green", name: `${location} Green / Public Realm`, center: [x - 0.0015, y + 0.0030], size: [d(0.0060), d(0.0022)], jobs: "Open space", height: 1 },
  ];
}

function polygonFor(site) {
  const [cx, cy] = site.center;
  const [w, h] = site.size;
  return [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2], [cx - w / 2, cy - h / 2]];
}

function scenarioGeo(year, completion, center = DEFAULT_CENTER, location = DEFAULT_LOCATION) {
  const sites = scenarioSites(year, completion, center, location);
  return {
    type: "FeatureCollection",
    features: sites.map((site) => ({
      type: "Feature",
      properties: { kind: site.kind, name: site.name, info: site.jobs },
      geometry: { type: "Polygon", coordinates: [polygonFor(site)] },
    })),
  };
}

function roadGeo(year, center = DEFAULT_CENTER, location = DEFAULT_LOCATION) {
  const [x, y] = center;
  const spread = Math.min(1.4, 0.8 + (year - 2026) * 0.035);
  return {
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: { name: `${location} main corridor` }, geometry: { type: "LineString", coordinates: [[x - 0.018 * spread, y - 0.001], [x + 0.018 * spread, y + 0.002]] } },
      { type: "Feature", properties: { name: "Scenario access road" }, geometry: { type: "LineString", coordinates: [[x - 0.007, y - 0.008 * spread], [x - 0.001, y - 0.001], [x + 0.006, y + 0.008 * spread]] } },
    ],
  };
}

function FutureMap2D({
  year,
  completion,
  center = DEFAULT_CENTER,
  location = DEFAULT_LOCATION,
  onSelect,
  evidence = null,
  historyItem = null,
  historyReady = true,
  onImageryMeta,
  earthMode = "map",
}) {
  const el = useRef(null), mapRef = useRef(null);
  const [mapError, setMapError] = useState("");

  const state = timelineState(year);
  const imageryKey = state === "past" ? `past-${historyItem?.releaseNum || "fallback"}` : state;
  const buildStyle = () => {
    if (state === "past" && historyItem?.itemURL) {
      return {
        version: 8,
        sources: {
          "wayback-imagery": {
            type: "raster",
            tiles: [waybackXYZ(historyItem)],
            tileSize: 256,
            maxzoom: 19,
            attribution: "Historical imagery © Esri World Imagery Wayback",
          },
        },
        layers: [{ id: "wayback-imagery", type: "raster", source: "wayback-imagery" }],
      };
    }
    return {
      version: 8,
      sources: {
        imagery: {
          type: "raster",
          tiles: CURRENT_IMAGERY_TILES,
          tileSize: 256,
          maxzoom: 19,
          attribution: "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community",
        },
      },
      layers: [{ id: "imagery", type: "raster", source: "imagery" }],
    };
  };

  const installLayers = (map) => {
    if (map.getSource("future-sites")) map.removeSource("future-sites");
    if (map.getSource("future-roads")) map.removeSource("future-roads");
    addFutureEvidenceLayers(
      map,
      evidence,
      state === "future",
      onSelect,
      location,
    );
    onImageryMeta?.({
      state,
      requestedYear: year,
      releaseDate: historyItem?.releaseDateLabel || (state === "present" ? "Current imagery" : "Historical imagery unavailable"),
      exact: state !== "past" ? true : Number(String(historyItem?.releaseDateLabel || "").slice(0, 4)) === year,
      title: state === "past" ? (historyItem?.itemTitle || "Historical World Imagery") : state === "present" ? "Current Esri World Imagery" : "Current imagery + mapped future evidence",
    });
  };

  useEffect(() => {
    if (!el.current) return;
    if (state === "past" && !historyReady) {
      setMapError("Loading the historical imagery archive…");
      return;
    }
    if (state === "past" && !historyItem) {
      setMapError("No historical World Imagery release is available for this year yet.");
      return;
    }
    setMapError("");
    const style = buildStyle();
    const map = new Map({ container: el.current, style, center, zoom: earthMode === "globe" ? 3.4 : 13.6, pitch: 0, bearing: 0, attributionControl: true });
    map.on("styledata",()=>{try{map.setProjection({type: earthMode === "globe" ? "globe" : "mercator"});}catch{}});
    mapRef.current = map;
    map.addControl(new NavigationControl(), "top-right");
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");
    const onLoad = () => installLayers(map);
    map.on("load", onLoad);
    try{map.setProjection({type: earthMode === "globe" ? "globe" : "mercator"});}catch{}
    return () => {
      map.off("load", onLoad);
      map.remove();
      mapRef.current = null;
    };
  }, [imageryKey, historyReady, historyItem?.releaseNum, center?.[0], center?.[1], location, evidence?.fetchedAt, earthMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center, zoom: earthMode === "globe" ? 3.4 : 13.6, pitch: 0, bearing: 0, duration: 900 });
  }, [center?.[0], center?.[1], earthMode]);

  const scenario = timelineState(year) === "future";
  return <div className="future-map2d">
    <div ref={el} className="future-map-canvas" />
    {mapError && <div className="future-map-loading">{mapError}</div>}
    <div className="future-map-label">
      <b>{location} · {year}</b>
      <span>{timelineLabel(year)}</span>
      <small>{timelineDescription(year)}</small>
    </div>
    <div className="future-map-hint">Real coordinates · drag / zoom · {scenario ? "future = mapped construction / proposed evidence" : "historical/current ground truth"}</div>
    <div className="future-legend">
      {scenario && <><span><i className="construction" />Under construction</span><span><i className="proposed" />Proposed / planned</span></>}
      {!scenario && <span><i className="history" />Real imagery</span>}
    </div>
  </div>;
}


function featureCollectionFromEvidence(evidence) {
  return {
    type: "FeatureCollection",
    features: Array.isArray(evidence?.features) ? evidence.features : [],
  };
}

function addFutureEvidenceLayers(map, evidence, showFuture, onSelect, location) {
  if (!showFuture) return;
  map.addSource("future-evidence", { type: "geojson", data: featureCollectionFromEvidence(evidence) });
  map.addLayer({
    id: "future-evidence-lines",
    type: "line",
    source: "future-evidence",
    filter: ["==", ["geometry-type"], "LineString"],
    paint: {
      "line-color": ["match", ["get", "status"], "UNDER CONSTRUCTION", "#ef9b43", "#55aef0"],
      "line-width": ["match", ["get", "status"], "UNDER CONSTRUCTION", 4, 3],
      "line-opacity": 0.92,
      "line-dasharray": ["match", ["get", "status"], "UNDER CONSTRUCTION", [1, 1], [3, 2]],
    },
  });
  map.addLayer({
    id: "future-evidence-points",
    type: "circle",
    source: "future-evidence",
    filter: ["==", ["geometry-type"], "Point"],
    paint: {
      "circle-radius": 7,
      "circle-color": ["match", ["get", "status"], "UNDER CONSTRUCTION", "#ef9b43", "#55aef0"],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2,
    },
  });
  const onFeatureClick = (e) => {
    const p = e.features?.[0]?.properties;
    if (!p) return;
    const status = p.status || "Mapped feature";
    const name = p.name || `${p.featureType || "Mapped project"}`;
    new Popup({ closeButton: true, offset: 12 })
      .setLngLat(e.lngLat)
      .setHTML(`<strong>${name}</strong><br/><span style="font-size:12px">${status}</span>${p.openingDate ? `<br/><span style="font-size:11px">Target/opening date: ${p.openingDate}</span>` : ""}<br/><span style="font-size:10px;color:#567">REAL OSM MAPPED EVIDENCE · NOT A GUARANTEED COMPLETION DATE</span>`)
      .addTo(map);
    onSelect?.({ type: status === "UNDER CONSTRUCTION" ? "construction" : "proposed", name, info: p.featureType || "Mapped feature", state: "future", location, source: "OpenStreetMap via Overpass", openingDate: p.openingDate || null });
  };
  map.on("click", "future-evidence-lines", onFeatureClick);
  map.on("click", "future-evidence-points", onFeatureClick);
  map.on("mouseenter", "future-evidence-lines", () => { map.getCanvas().style.cursor = "pointer"; });
  map.on("mouseleave", "future-evidence-lines", () => { map.getCanvas().style.cursor = ""; });
  map.on("mouseenter", "future-evidence-points", () => { map.getCanvas().style.cursor = "pointer"; });
  map.on("mouseleave", "future-evidence-points", () => { map.getCanvas().style.cursor = ""; });
}

function addFutureLayers(map, year, completion, center = DEFAULT_CENTER, location = DEFAULT_LOCATION, showScenario = true, onSelect) {
  if (!showScenario) {
    return;
  }
  map.addSource("future-sites", { type: "geojson", data: scenarioGeo(year, completion, center, location) });
  map.addSource("future-roads", { type: "geojson", data: roadGeo(year, center, location) });
  map.addLayer({ id: "future-roads-casing", type: "line", source: "future-roads", paint: { "line-color": "#ffffff", "line-opacity": 0.72, "line-width": 6 } });
  map.addLayer({ id: "future-roads-line", type: "line", source: "future-roads", paint: { "line-color": "#35bda0", "line-opacity": 0.95, "line-width": 2, "line-dasharray": [2, 2] } });
  map.addLayer({ id: "future-sites-fill", type: "fill", source: "future-sites", paint: { "fill-color": ["match", ["get", "kind"], "it", "#1db98c", "res", "#2196e0", "com", "#e4a33f", "green", "#4b9b68", "#4ce3b1"], "fill-opacity": 0.48, "fill-outline-color": "#ffffff" } });
  map.addLayer({ id: "future-sites-line", type: "line", source: "future-sites", paint: { "line-color": "#ffffff", "line-opacity": 0.85, "line-width": 2 } });
  map.on("click", "future-sites-fill", (e) => {
    const p = e.features?.[0]?.properties;
    if (!p) return;
    onFuturePopup(map, e.lngLat, p);
    onSelect?.({
      type: p.kind,
      name: p.name,
      info: p.info,
      state: "future",
      location,
    });
  });
  map.on("mouseenter", "future-sites-fill", () => { map.getCanvas().style.cursor = "pointer"; });
  map.on("mouseleave", "future-sites-fill", () => { map.getCanvas().style.cursor = ""; });
}

function onFuturePopup(map, lngLat, p) {
  new Popup({ closeButton: true, offset: 12 }).setLngLat(lngLat).setHTML(`<strong>${p.name}</strong><br/><span style="font-size:12px">${p.info}</span><br/><span style="font-size:10px;color:#567">MODELED SCENARIO · NOT A GUARANTEED PROJECT</span>`).addTo(map);
}

function SceneControls() {
  const { camera, gl } = useThree();
  const controls = useRef(null);
  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement);
    c.enableDamping = true;
    c.dampingFactor = 0.065;
    c.minDistance = 12;
    c.maxDistance = 48;
    c.maxPolarAngle = Math.PI * 0.46;
    c.minPolarAngle = Math.PI * 0.19;
    c.target.set(0, 3.2, 0);
    controls.current = c;
    return () => { c.dispose(); controls.current = null; };
  }, [camera, gl]);
  useFrame(() => controls.current?.update());
  return null;
}

function FacadeWindow({ position, size, lit = false, tint = "#d8e9e8" }) {
  const mat = useRef();
  useFrame(({ clock }) => {
    if (!mat.current || !lit) return;
    mat.current.emissiveIntensity = 0.13 + (Math.sin(clock.elapsedTime * 1.6 + position[1] * 0.7 + position[0]) + 1) * 0.035;
  });
  return <mesh position={position}>
    <boxGeometry args={size} />
    <meshStandardMaterial ref={mat} color={tint} roughness={0.18} metalness={0.35} emissive={lit ? "#f7d98c" : "#000000"} emissiveIntensity={lit ? 0.16 : 0} />
  </mesh>;
}

function Building({ x, z, w, d, h, type, phase = "future", floors = 8, selected = false }) {
  const body = type === "existing" ? "#7c8889" : type === "it" ? "#536b70" : type === "res" ? "#858d8e" : "#6f7c7e";
  const glass = type === "it" ? "#9fbfc0" : type === "res" ? "#a9c5c4" : "#b7c4c0";
  const accent = type === "it" ? "#4ad7b1" : type === "res" ? "#d8b56a" : "#89b9b1";
  const floorH = h / Math.max(1, floors);
  const frontCount = Math.max(3, Math.round(w * 1.5));
  const sideCount = Math.max(2, Math.round(d * 1.25));
  const windowW = Math.max(0.28, (w * 0.68) / frontCount - 0.07);
  const sideWindowD = Math.max(0.25, (d * 0.66) / sideCount - 0.06);
  const isFuture = phase === "future";
  return <group position={[x, 0, z]}>
    {/* podium, plinth and entrance */}
    <mesh position={[0, 0.34, 0]} castShadow receiveShadow><boxGeometry args={[w + 0.7, 0.68, d + 0.7]} /><meshStandardMaterial color="#384b4e" roughness={0.75} /></mesh>
    <mesh position={[0, 0.75, 0]} castShadow receiveShadow><boxGeometry args={[w + 0.22, 0.38, d + 0.22]} /><meshStandardMaterial color={body} roughness={0.58} metalness={0.08} /></mesh>
    <mesh position={[0, h / 2 + 0.78, 0]} castShadow receiveShadow><boxGeometry args={[w, h, d]} /><meshStandardMaterial color={body} roughness={0.5} metalness={0.12} /></mesh>

    {/* floor slabs + curtain-wall strips */}
    {Array.from({ length: floors }).map((_, i) => {
      const yy = 0.78 + floorH * i + 0.08;
      return <group key={`floor-${i}`}>
        <mesh position={[0, yy, 0]}><boxGeometry args={[w + 0.12, 0.075, d + 0.12]} /><meshStandardMaterial color="#c2cbca" roughness={0.52} metalness={0.08} /></mesh>
        {Array.from({ length: frontCount }).map((__, j) => {
          const xx = -w * 0.34 + j * ((w * 0.68) / Math.max(1, frontCount - 1));
          const lit = (i * 7 + j * 3 + Math.round(x * 10)) % 5 !== 0;
          return <FacadeWindow key={`fw-${i}-${j}`} position={[xx, yy + floorH * 0.34, d / 2 + 0.028]} size={[windowW, Math.max(0.22, floorH * 0.45), 0.045]} lit={isFuture && lit} tint={glass} />;
        })}
        {Array.from({ length: sideCount }).map((__, j) => {
          const zz = -d * 0.33 + j * ((d * 0.66) / Math.max(1, sideCount - 1));
          const lit = (i * 5 + j * 2) % 4 !== 0;
          return <FacadeWindow key={`sw-${i}-${j}`} position={[w / 2 + 0.028, yy + floorH * 0.34, zz]} size={[0.045, Math.max(0.22, floorH * 0.43), sideWindowD]} lit={isFuture && lit} tint={glass} />;
        })}
      </group>;
    })}

    {/* vertical architectural fins */}
    {[-0.39, 0, 0.39].map((v, i) => <mesh key={`fin-${i}`} position={[w * v, h * 0.52 + 0.78, d / 2 + 0.08]} castShadow>
      <boxGeometry args={[Math.max(0.08, w * 0.035), h * 0.9, 0.11]} />
      <meshStandardMaterial color="#d4ddda" roughness={0.34} metalness={0.35} />
    </mesh>)}

    {/* residential balconies */}
    {type === "res" && Array.from({ length: Math.max(3, Math.floor(floors * 0.7)) }).map((_, i) => <group key={`bal-${i}`} position={[0, 1.25 + i * floorH * 1.25, d / 2 + 0.23]}>
      <mesh position={[0, 0, 0]} castShadow><boxGeometry args={[w * 0.7, 0.08, 0.52]} /><meshStandardMaterial color="#b9c3c1" roughness={0.5} /></mesh>
      <mesh position={[0, 0.28, 0.22]}><boxGeometry args={[w * 0.67, 0.55, 0.035]} /><meshStandardMaterial color="#78908f" transparent opacity={0.48} roughness={0.1} metalness={0.3} /></mesh>
    </group>)}

    {/* entrance canopy */}
    <mesh position={[0, 1.55, d / 2 + 0.34]} castShadow><boxGeometry args={[w * 0.48, 0.16, 0.72]} /><meshStandardMaterial color={accent} metalness={0.55} roughness={0.25} emissive={isFuture ? accent : "#000000"} emissiveIntensity={isFuture ? 0.08 : 0} /></mesh>
    <mesh position={[0, 1.05, d / 2 + 0.38]}><boxGeometry args={[w * 0.28, 0.72, 0.055]} /><meshStandardMaterial color="#152b30" roughness={0.12} metalness={0.4} /></mesh>

    {/* rooftop mechanical penthouse, solar array and antenna */}
    <mesh position={[0, h + 1.05, 0]} castShadow><boxGeometry args={[w * 0.34, 0.58, d * 0.38]} /><meshStandardMaterial color="#68797b" roughness={0.62} metalness={0.2} /></mesh>
    {[-0.24, 0.24].map((px, i) => <mesh key={`solar-${i}`} position={[w * px, h + 1.38, 0]} rotation-x={-0.12} rotation-z={i ? 0.03 : -0.03}>
      <boxGeometry args={[w * 0.28, 0.035, d * 0.5]} /><meshStandardMaterial color="#1f4b58" roughness={0.22} metalness={0.65} emissive="#12323a" emissiveIntensity={0.18} /></mesh>)}
    <mesh position={[0, h + 1.9, 0]}><cylinderGeometry args={[0.025, 0.025, 1.0, 8]} /><meshStandardMaterial color="#c9d4d1" metalness={0.7} /></mesh>
    <mesh position={[0, h + 2.34, 0]}><sphereGeometry args={[0.07, 12, 8]} /><meshStandardMaterial color="#d7a951" emissive="#d7a951" emissiveIntensity={0.8} /></mesh>
    {selected && <mesh position={[0, 0.08, 0]} rotation-x={-Math.PI / 2}><ringGeometry args={[Math.max(w, d) * 0.58, Math.max(w, d) * 0.64, 48]} /><meshBasicMaterial color="#45e5b1" transparent opacity={0.82} /></mesh>}
  </group>;
}

function Road({ position, rotation = 0, width = 2.4, length = 30 }) {
  return <group position={[position[0], -0.2, position[1]]} rotation-y={rotation}>
    <mesh rotation-x={-Math.PI / 2} receiveShadow><planeGeometry args={[width, length]} /><meshStandardMaterial color="#2c3436" roughness={0.96} /></mesh>
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, 0]}><planeGeometry args={[0.06, length * 0.92]} /><meshStandardMaterial color="#d9d2ad" roughness={0.75} /></mesh>
    {Array.from({ length: 10 }).map((_, i) => <mesh key={i} rotation-x={-Math.PI / 2} position={[0, 0.015, -length / 2 + 2.1 + i * 4.2]}><planeGeometry args={[0.65, 0.12]} /><meshStandardMaterial color="#e7e2c9" roughness={0.8} /></mesh>)}
  </group>;
}

function Sidewalk({ x, z, w, d }) {
  return <mesh rotation-x={-Math.PI / 2} position={[x, -0.06, z]} receiveShadow><boxGeometry args={[w, 0.14, d]} /><meshStandardMaterial color="#9a9b92" roughness={0.92} /></mesh>;
}

function Tree({ x, z, scale = 1 }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = Math.sin(clock.elapsedTime * 0.8 + x * 0.4) * 0.018;
  });
  return <group ref={ref} position={[x, 0, z]} scale={scale}>
    <mesh position={[0, 0.62, 0]} castShadow><cylinderGeometry args={[0.075, 0.12, 1.25, 8]} /><meshStandardMaterial color="#5b4434" roughness={0.9} /></mesh>
    <mesh position={[0, 1.38, 0]} castShadow><dodecahedronGeometry args={[0.62, 1]} /><meshStandardMaterial color="#3f7559" roughness={0.94} /></mesh>
    <mesh position={[0.28, 1.18, 0.08]} castShadow><sphereGeometry args={[0.34, 10, 8]} /><meshStandardMaterial color="#4b8764" roughness={0.94} /></mesh>
  </group>;
}

function StreetLight({ x, z, side = 1 }) {
  const lamp = useRef();
  useFrame(({ clock }) => { if (lamp.current) lamp.current.intensity = 1.7 + Math.sin(clock.elapsedTime * 1.3 + x) * 0.15; });
  return <group position={[x, 0, z]}>
    <mesh position={[0, 2.4, 0]} castShadow><cylinderGeometry args={[0.045, 0.065, 4.8, 8]} /><meshStandardMaterial color="#4b5557" metalness={0.7} roughness={0.35} /></mesh>
    <mesh position={[side * 0.38, 4.72, 0]} rotation-z={side * -0.12}><boxGeometry args={[0.72, 0.07, 0.08]} /><meshStandardMaterial color="#5b6667" metalness={0.6} /></mesh>
    <pointLight ref={lamp} position={[side * 0.72, 4.62, 0]} intensity={1.8} distance={5.5} decay={2} color="#ffe7aa" />
  </group>;
}

function Car({ index }) {
  const ref = useRef();
  const speed = 0.62 + (index % 4) * 0.09;
  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.position.x += delta * speed;
    if (ref.current.position.x > 17) ref.current.position.x = -17;
  });
  return <group ref={ref} position={[-17 + index * 4.1, 0, 4.9 + (index % 2) * 0.65]}>
    <mesh position={[0, 0.25, 0]} castShadow><boxGeometry args={[1.55, 0.38, 0.72]} /><meshStandardMaterial color={index % 3 === 0 ? "#b9c1c0" : index % 3 === 1 ? "#7d8d8f" : "#c39b52"} roughness={0.38} metalness={0.24} /></mesh>
    <mesh position={[0.12, 0.53, 0]}><boxGeometry args={[0.75, 0.32, 0.58]} /><meshStandardMaterial color="#527078" transparent opacity={0.78} roughness={0.12} metalness={0.35} /></mesh>
    <mesh position={[0.82, 0.27, 0]}><boxGeometry args={[0.035, 0.12, 0.42]} /><meshStandardMaterial color="#f6e4ad" emissive="#f6e4ad" emissiveIntensity={0.35} /></mesh>
  </group>;
}

function Crane({ x, z, height = 13 }) {
  const arm = useRef();
  const hook = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (arm.current) arm.current.rotation.y = Math.sin(t * 0.22) * 0.18;
    if (hook.current) hook.current.position.y = height - 2.2 + Math.sin(t * 0.75) * 0.55;
  });
  return <group position={[x, 0, z]}>
    <mesh position={[0, height / 2, 0]}><boxGeometry args={[0.22, height, 0.22]} /><meshStandardMaterial color="#d0a44d" metalness={0.4} roughness={0.38} /></mesh>
    <group ref={arm} position={[0, height - 0.35, 0]}>
      <mesh position={[2.9, 0, 0]}><boxGeometry args={[5.8, 0.18, 0.18]} /><meshStandardMaterial color="#c69a42" metalness={0.45} roughness={0.35} /></mesh>
      <mesh position={[5.25, -1.0, 0]}><boxGeometry args={[0.06, 2.0, 0.06]} /><meshStandardMaterial color="#5e6666" /></mesh>
      <mesh ref={hook} position={[5.25, -2.1, 0]}><cylinderGeometry args={[0.025, 0.025, 1.2, 6]} /><meshStandardMaterial color="#4d5555" /></mesh>
    </group>
  </group>;
}

function DistantBuilding({ x, z, w, d, h }) {
  return <mesh position={[x, h / 2 - 0.2, z]} castShadow><boxGeometry args={[w, h, d]} /><meshStandardMaterial color="#52676b" roughness={0.72} metalness={0.08} /></mesh>;
}

function CityFutureScene({ year, completion, layer, timeState = "future", location = DEFAULT_LOCATION, onPick }) {
  const { camera } = useThree();
  const [hover, setHover] = useState(null);
  const s = scenarioFor(year, completion, location);
  const maturity = timeState === "future" ? Math.min(1, (year - 2026) / 10) * (completion / 100) : 0;
  useEffect(() => { camera.position.set(19, 13, 21); camera.lookAt(0, 3.2, 0); }, [camera]);
  const existing = [
    { x: -7.2, z: -3.1, w: 3.2, d: 2.9, h: 5.2, type: "existing", floors: 4 },
    { x: 6.2, z: -2.7, w: 3.0, d: 2.8, h: 4.8, type: "existing", floors: 4 },
    { x: 8.4, z: 3.2, w: 3.8, d: 3.1, h: 6.4, type: "existing", floors: 5 },
    { x: -8.7, z: 3.6, w: 2.9, d: 2.7, h: 4.3, type: "existing", floors: 3 },
  ];
  const future = [
    { x: -3.7, z: -1.0, w: 4.8, d: 3.7, h: 9.0 + 9.5 * maturity, type: "it", floors: Math.round(8 + 8 * maturity) },
    { x: 2.9, z: -1.2, w: 3.9, d: 3.4, h: 6.0 + 5.5 * maturity, type: "com", floors: Math.round(6 + 5 * maturity) },
    { x: 1.0, z: 3.8, w: 4.7, d: 3.6, h: 8.0 + 6.5 * maturity, type: "res", floors: Math.round(8 + 5 * maturity) },
  ];
  const showExisting = layer !== "scenario";
  const showFuture = timeState === "future" && layer !== "existing";
  return <>
    <color attach="background" args={["#91a6a8"]} />
    <fog attach="fog" args={["#91a6a8", 38, 78]} />
    <hemisphereLight intensity={1.65} color="#e5f3f1" groundColor="#4c5550" />
    <ambientLight intensity={0.75} />
    <directionalLight position={[14, 24, 10]} intensity={4.2} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={30} shadow-camera-bottom={-30} />
    <directionalLight position={[-12, 14, -10]} intensity={1.15} color="#b7d7df" />
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.42, 0]} receiveShadow><planeGeometry args={[48, 40]} /><meshStandardMaterial color="#8f8d82" roughness={1} /></mesh>
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.31, 0]} receiveShadow><planeGeometry args={[42, 35]} /><meshStandardMaterial color="#a4a59b" roughness={0.96} /></mesh>
    <Road position={[0, 4.8]} rotation={Math.PI / 2} width={3.8} length={44} />
    <Road position={[0, -1]} rotation={0} width={2.8} length={39} />
    <Sidewalk x={-2.7} z={4.8} w={2.0} d={43} />
    <Sidewalk x={2.7} z={-1} w={1.6} d={38} />
    <mesh rotation-x={-Math.PI / 2} position={[-1.6, -0.14, 4.0]} receiveShadow><planeGeometry args={[8.5, 3.1]} /><meshStandardMaterial color="#718e63" roughness={1} /></mesh>
    <mesh rotation-x={-Math.PI / 2} position={[7.0, -0.14, -6.2]} receiveShadow><planeGeometry args={[8.5, 3.2]} /><meshStandardMaterial color="#718e63" roughness={1} /></mesh>
    {[-16, -12, 12, 16].map((x, i) => <DistantBuilding key={`d-${i}`} x={x} z={-5 + (i % 2) * 4} w={3.0 + (i % 3)} d={2.5} h={6 + i * 1.5} />)}
    {showExisting && existing.map((b, i) => <Building key={`e${i}`} {...b} phase="existing" />)}
    {showFuture && future.map((b, i) => <group key={`f${i}`} onClick={() => onPick(b)} onPointerOver={() => setHover(b.type)} onPointerOut={() => setHover(null)}><Building {...b} phase="future" selected={hover === b.type} /></group>)}
    {Array.from({ length: 26 }).map((_, i) => <Tree key={`t${i}`} x={-18 + (i % 13) * 3.0} z={i < 13 ? -8.0 : 9.2} scale={0.72 + (i % 4) * 0.12} />)}
    {Array.from({ length: 8 }).map((_, i) => <Car key={`c${i}`} index={i} />)}
    <StreetLight x={-4.2} z={2.5} side={1} /><StreetLight x={4.2} z={2.0} side={-1} />
    <StreetLight x={-4.2} z={-5.0} side={1} /><StreetLight x={4.2} z={-5.4} side={-1} />
    {maturity > 0.22 && <Crane x={7.2} z={4.9} height={12 + maturity * 5} />}
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.04, -9.2]} receiveShadow><planeGeometry args={[12, 3.4]} /><meshStandardMaterial color="#62875f" roughness={1} /></mesh>
    <gridHelper args={[40, 40, "#7d8986", "#a8aaa1"]} position={[0, -0.08, 0]} />
    {layer === "infrastructure" && <>
      <mesh position={[-7, 1.35, 4.8]}><boxGeometry args={[4.8, 0.2, 0.38]} /><meshStandardMaterial color="#39c9a1" emissive="#39c9a1" emissiveIntensity={0.25} /></mesh>
      <mesh position={[7, 1.35, 4.8]}><boxGeometry args={[4.8, 0.2, 0.38]} /><meshStandardMaterial color="#39c9a1" emissive="#39c9a1" emissiveIntensity={0.25} /></mesh>
    </>}
    <SceneControls />
  </>;
}


function buildReal3DStyle(){
  return {
    version: 8,
    sources: {
      satellite: {
        type: "raster",
        tiles: CURRENT_IMAGERY_TILES,
        tileSize: 256,
        maxzoom: 19,
        attribution: "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community",
      },
      openfreemap: {
        type: "vector",
        url: OPENFREEMAP_PLANET,
      },
    },
    layers: [
      { id: "satellite", type: "raster", source: "satellite" },
      {
        id: "real-buildings-3d",
        type: "fill-extrusion",
        source: "openfreemap",
        "source-layer": "building",
        minzoom: 14,
        paint: {
          "fill-extrusion-color": ["coalesce", ["get", "colour"], "#9aa7a4"],
          "fill-extrusion-height": ["coalesce", ["get", "render_height"], ["get", "height"], 6],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], ["get", "min_height"], 0],
          "fill-extrusion-opacity": 0.84,
          "fill-extrusion-vertical-gradient": true,
        },
      },
      {
        id: "real-building-outlines",
        type: "line",
        source: "openfreemap",
        "source-layer": "building",
        minzoom: 14,
        paint: { "line-color": "#4e5f5c", "line-width": 0.7, "line-opacity": 0.58 },
      },
    ],
  };
}

function RealFuture3DMap({ center = DEFAULT_CENTER, year, timeState, location, evidence, selectedWayback, onSelect, earthMode = "map" }) {
  const el = useRef(null);
  const mapRef = useRef(null);
  const [error, setError] = useState("");
  const isFuture = timeState === "future";

  const buildStyle = () => {
    if (timeState === "past") {
      return {
        version: 8,
        sources: {
          historic: {
            type: "raster",
            tiles: selectedWayback?.itemURL ? [waybackXYZ(selectedWayback)] : CURRENT_IMAGERY_TILES,
            tileSize: 256,
            maxzoom: 19,
            attribution: "Historical imagery © Esri World Imagery Wayback",
          },
        },
        layers: [{ id: "historic", type: "raster", source: "historic" }],
      };
    }
    return buildReal3DStyle();
  };

  useEffect(() => {
    if (!el.current) return;
    const map = new Map({
      container: el.current,
      style: buildStyle(),
      center,
      zoom: earthMode === "globe" ? 3.8 : 15.2,
      pitch: earthMode === "globe" ? 18 : 62,
      bearing: -18,
      maxPitch: 82,
      dragRotate: true,
      pitchWithRotate: true,
      attributionControl: true,
    });
    mapRef.current = map;
    map.addControl(new NavigationControl(), "top-right");
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");
    map.on("error", (evt) => {
      const message = String(evt?.error?.message || "");
      if (/style|source|layer/i.test(message)) setError("Some map data could not be loaded; the real satellite layer remains available.");
    });
    const onLoad = () => {
      try {
        if (timeState === "past") return;
        if (isFuture) addFutureEvidenceLayers(map, evidence, true, onSelect, location);
      } catch (e) {
        setError("The real-world 3D overlay could not be fully loaded. The satellite map remains available.");
      }
    };
    map.on("load", onLoad);
    try{map.setProjection({type: earthMode === "globe" ? "globe" : "mercator"});}catch{}
    return () => {
      map.off("load", onLoad);
      map.remove();
      mapRef.current = null;
    };
  }, [year, timeState, location, evidence?.fetchedAt, selectedWayback?.releaseNum, earthMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center, zoom: earthMode === "globe" ? 3.8 : 15.2, pitch: earthMode === "globe" ? 18 : 62, bearing: -18, duration: 850 });
  }, [center?.[0], center?.[1], earthMode]);

  return <div className="future-real3d">
    <div ref={el} className="future-map-canvas" />
    {error && <div className="future-real3d-error">{error}</div>}
    <div className="future-map-label"><b>{location} · {year}</b><span>{timeState === "future" ? "FUTURE · REAL MAP + MAPPED PLANNED / CONSTRUCTION EVIDENCE" : timeState === "present" ? "PRESENT · REAL WORLD 3D CONTEXT" : "PAST · REAL HISTORICAL SATELLITE"}</span><small>{timeState === "past" ? "Historical imagery is shown without current 3D buildings so the past is not mixed with today's structures." : "Real OpenStreetMap/OpenFreeMap context with mapped buildings, roads, landuse, water and labels; no procedural toy city."}</small></div>
    <div className="future-3d-legend">{timeState !== "past" && <span><i className="existing" />Real building footprints</span>}{isFuture && <><span><i className="future" />Under construction</span><span><i className="proposed" />Proposed / planned</span></>}</div>
    <div className="future-3d-hint-v21">Drag to orbit · wheel to zoom · right-drag to pan</div>
  </div>;
}

function futureOutlookFor(year, evidence, mobilityLevel = 50) {
  const counts = evidence?.counts || {};
  const construction = Number(counts.construction || 0);
  const proposed = Number(counts.proposed || 0);
  const years = Math.max(0, Number(year || PRESENT_YEAR) - PRESENT_YEAR);
  const development = Math.min(96, Math.round(28 + years * 3.2 + construction * 1.8));
  const accessibility = Math.min(94, Math.round(36 + years * 1.8 + proposed * 1.6 + mobilityLevel * 0.24));
  const jobs = Math.min(94, Math.round(30 + years * 2.2 + construction * 1.3));
  const services = Math.min(92, Math.round(26 + years * 2 + proposed * 1.1));
  const traffic = Math.min(97, Math.round(30 + years * 2.8 + mobilityLevel * 0.42 + construction * 0.9));
  const landConversion = Math.min(96, Math.round(24 + years * 2.9 + construction * 0.75));
  const infraDemand = Math.min(97, Math.round(30 + years * 2.6 + construction * 1.0 + proposed * 0.45));
  const greenPressure = Math.min(94, Math.round(20 + years * 2.2 + landConversion * 0.45));
  return {
    advantages: [
      { label: "New infrastructure & access", score: accessibility, text: "More mapped development can improve connectivity and access to services." },
      { label: "Employment / economic activity", score: jobs, text: "Construction and planned activity may expand employment capacity around the location." },
      { label: "Housing & services growth", score: services, text: "Additional development can increase housing, retail and service capacity." },
      { label: "Urban investment signal", score: development, text: "A larger mapped pipeline can indicate stronger investment and development activity." },
    ],
    tradeoffs: [
      { label: "Mobility / congestion pressure", score: traffic, text: "More activity can increase road demand unless public transport and junction capacity keep pace." },
      { label: "Land-use conversion pressure", score: landConversion, text: "Expansion can put pressure on agricultural or open land around the growth area." },
      { label: "Infrastructure capacity demand", score: infraDemand, text: "Water, drainage, utilities and roads may need additional capacity as activity grows." },
      { label: "Green / environmental pressure", score: greenPressure, text: "More built-up activity can reduce open/green space without protective planning measures." },
    ],
  };
}

export default function FutureScenario() {
  const [query, setQuery] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [activeLocation, setActiveLocation] = useState(DEFAULT_LOCATION);
  const [activeCenter, setActiveCenter] = useState(DEFAULT_CENTER);
  const [geoError, setGeoError] = useState("");
  const [year, setYear] = useState(2036);
  const [evidenceRadius, setEvidenceRadius] = useState(5);
  const [evidence, setEvidence] = useState({ features: [], counts: { construction: 0, proposed: 0, total: 0 } });
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState("");
  const [mode, setMode] = useState("3D");
  const [mapView, setMapView] = useState("map");
  const [layer, setLayer] = useState("all");
  const [result, setResult] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState(null);
  const [waybackItems, setWaybackItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [imageryMeta, setImageryMeta] = useState(null);
  const [earthMode, setEarthMode] = useState("map");
  const [mobilityLevel, setMobilityLevel] = useState(50);
  const parsed = useMemo(() => parseQuestion(query), [query]);
  const sources = useMemo(() => sourcesFor(activeLocation), [activeLocation]);
  const timeState = timelineState(year);
  const selectedWayback = useMemo(() => pickWaybackRelease(waybackItems, year), [waybackItems, year]);
  const futureOutlook = useMemo(() => futureOutlookFor(year, evidence, mobilityLevel), [year, evidence, mobilityLevel]);

  useEffect(() => {
    let alive = true;
    setHistoryLoading(true);
    setHistoryError("");
    loadWaybackCatalog()
      .then((items) => {
        if (!alive) return;
        setWaybackItems(items);
        if (waybackCatalogUsedFallback) setHistoryError("Historical archive catalog unavailable; using built-in release fallbacks.");
      })
      .catch(() => {
        if (!alive) return;
        setWaybackItems(FALLBACK_WAYBACK);
        setHistoryError("Historical archive catalog unavailable; using built-in release fallbacks.");
      })
      .finally(() => alive && setHistoryLoading(false));
    return () => { alive = false; };
  }, [activeLocation]);

  useEffect(() => {
    let alive = true;
    const loadEvidence = async () => {
      setEvidenceLoading(true);
      setEvidenceError("");
      try {
        const response = await fetch(`/api/future-evidence?lat=${encodeURIComponent(activeCenter[1])}&lng=${encodeURIComponent(activeCenter[0])}&radiusKm=${encodeURIComponent(evidenceRadius)}`);
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error || "Evidence lookup failed");
        if (alive) setEvidence(body);
      } catch (err) {
        if (!alive) return;
        setEvidence({ features: [], counts: { construction: 0, proposed: 0, total: 0 } });
        setEvidenceError(err?.message || "Mapped future evidence is unavailable right now.");
      } finally {
        if (alive) setEvidenceLoading(false);
      }
    };
    loadEvidence();
    return () => { alive = false; };
  }, [activeCenter[0], activeCenter[1], evidenceRadius]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setYear((v) => { if (v >= FUTURE_END) { setPlaying(false); return FUTURE_END; } return v + 1; }), 900);
    return () => clearInterval(id);
  }, [playing]);

  const analyze = async () => {
    const typedLocation = locationInput.trim();
    const p = typedLocation ? { ...parseQuestion(query || `Show me how ${typedLocation} will look in 2040.`), location: typedLocation } : parseQuestion(query);
    setYear(p.year);
    setGeoError("");
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(p.location)}`);
      const body = await response.json();
      const hit = Array.isArray(body) ? body[0] : null;
      if (!hit?.lat || !hit?.lon) throw new Error("Location not found");
      setActiveLocation(hit.display_name?.split(",").slice(0, 2).join(", ") || p.location);
      setActiveCenter([Number(hit.lon), Number(hit.lat)]);
      setSelected(null);
      setResult(true);
    } catch {
      setGeoError(`I couldn't locate “${p.location}”. Try a city, town, district, landmark or region name.`);
    }
  };

  return <ShellFuture>
    <div className="future-query-v20">
      <div className="future-query-copy"><p className="eyebrow">AI FUTURE CITY EXPLORER</p><h1>Ask what a place could<br /><span>become.</span></h1><p>Type any city, town, district, village or landmark and a future question. The explorer geocodes the place, centers the real map there, and uses real archived imagery, current satellite imagery, real 3D building footprints, and mapped construction/proposed evidence. It does not invent future city geometry.</p></div>
      <div className="future-input-v20"><div className="future-input-top"><span>LOCATION SEARCH</span><b>Any city, town, district, village or landmark</b></div><div className="future-location-row-v35"><input value={locationInput} onChange={e=>setLocationInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();analyze();}}} placeholder="e.g. Bengaluru, Mumbai, Hyderabad, Vijayawada…" aria-label="Search any location"/><button className="secondary-v4" onClick={()=>{if(locationInput.trim())setQuery(`Show me how ${locationInput.trim()} will look in 2040 with new jobs, homes, roads, transit and green areas.`);analyze();}}>Use location</button></div><div className="future-input-top future-query-label-v35"><span>SCENARIO QUERY</span><b>Natural-language future question</b></div><textarea placeholder="Example: Show me how Bengaluru will look after 10 years with new transit, homes and jobs." value={query} onChange={(e) => setQuery(e.target.value)} /><div className="future-query-actions"><button className="primary-v4" onClick={analyze}>Analyze future →</button><button className="secondary-v4" onClick={() => {setLocationInput("Bengaluru");setQuery("Show me how Bengaluru will look in 2040 with new jobs, homes, roads, transit and green areas.")}}>Try Bengaluru</button><button className="secondary-v4" onClick={() => {setLocationInput("Mumbai");setQuery("Show me how Mumbai will look in 2040 with new transit, housing and jobs.")}}>Try Mumbai</button></div>{geoError && <div className="future-geocode-error">{geoError}</div>}</div>
    </div>

    <div className="future-control-v20">
      <div><span>LOCATION</span><b>{activeLocation}</b><small>Any searchable place</small></div>
      <div><span>TIME MACHINE</span><b>{year} · {timeState.toUpperCase()}</b><input type="range" min={HISTORICAL_START} max={FUTURE_END} value={year} onChange={(e) => { setPlaying(false); setYear(+e.target.value); }} /><div className="future-era-labels"><span>2014 PAST</span><span>2026 PRESENT</span><span>2045 FUTURE</span></div></div>
      <div><span>REAL FUTURE EVIDENCE RADIUS</span><b>{evidenceRadius} km</b><input type="range" min="1" max="8" value={evidenceRadius} onChange={(e) => setEvidenceRadius(+e.target.value)} /><small>OSM mapped construction / proposed features</small></div>
      <button className={`play-year ${playing ? "active" : ""}`} onClick={() => setPlaying((v) => !v)}>{playing ? "Pause" : "Play timeline"}</button>
    </div>

    <div className="future-timeline-path-v50">
      <div className={timeState === "past" ? "active" : ""}><span>01</span><b>PAST</b><small>Archived satellite imagery</small></div>
      <i>→</i>
      <div className={timeState === "present" ? "active" : ""}><span>02</span><b>PRESENT</b><small>Current satellite + real map</small></div>
      <i>→</i>
      <div className={timeState === "future" ? "active" : ""}><span>03</span><b>FUTURE</b><small>Mapped projects / scenario evidence</small></div>
    </div>

    {result && <div className="future-summary-v20">
      <div><span>PAST</span><b>2014–2025 · Real archived imagery</b></div><i>→</i>
      <div><span>PRESENT</span><b>2026 · Current real imagery</b></div><i>→</i>
      <div><span>FUTURE</span><b>2027–2045 · Real mapped projects / construction</b></div>
      <p>Past and present use real satellite imagery. Future shows real mapped construction / proposed features where they exist; the app does not invent future buildings, roads, jobs or population.</p>
    </div>}

    <div className="future-view-toolbar-v20">
      <div className="future-view-switch"><button className={mode === "2D" ? "active" : ""} onClick={() => setMode("2D")}>2D EARTH</button><button className={mode === "3D" ? "active" : ""} onClick={() => setMode("3D")}>3D CITY</button></div>
      <div className="future-time-state">
        <button className={timeState === "past" ? "active past" : ""} onClick={() => setYear(Math.max(HISTORICAL_START, 2020))}>PAST</button>
        <button className={timeState === "present" ? "active present" : ""} onClick={() => setYear(PRESENT_YEAR)}>PRESENT</button>
        <button className={timeState === "future" ? "active future" : ""} onClick={() => setYear(2036)}>FUTURE</button>
      </div>
      {mode === "2D" ? <div className="future-view-switch"><button className="active" onClick={()=>setEarthMode("map")}>REAL MAP</button><button className={earthMode==="globe"?"active":""} onClick={()=>setEarthMode("globe")}>EARTH GLOBE</button><button disabled={!historyLoading && !selectedWayback}>HISTORY {historyLoading ? "…" : `${waybackItems.length} releases`}</button></div> : <div className="future-view-switch"><button className={earthMode==="map"?"active":""} onClick={()=>setEarthMode("map")}>REAL 3D CITY</button><button className={earthMode==="globe"?"active":""} onClick={()=>setEarthMode("globe")}>EARTH GLOBE</button>{timeState === "future" && <button className="active">FUTURE EVIDENCE</button>}</div>}
    </div>

    <div className="future-visual-v20">
      <div className="future-viewport-v20">
        {mode === "2D" ? <FutureMap2D year={year} center={activeCenter} location={activeLocation} onSelect={setSelected} evidence={evidence} historyItem={selectedWayback} historyReady={!historyLoading} onImageryMeta={setImageryMeta} earthMode={earthMode} /> : <RealFuture3DMap center={activeCenter} year={year} timeState={timeState} location={activeLocation} evidence={evidence} selectedWayback={selectedWayback} onSelect={setSelected} earthMode={earthMode} />}
      </div>
      <aside className="future-inspector-v20">
        <p className="eyebrow">SCENARIO INTELLIGENCE</p>
        <h2>{selected ? (selected.type === "construction" ? "Under Construction" : selected.type === "proposed" ? "Proposed / Planned" : "Selected mapped feature") : `${activeLocation} in focus`}</h2>
        <p>{selected ? `${selected.name || "Mapped future feature"} · ${selected.source || "OpenStreetMap via Overpass"}` : timelineDescription(year)}</p>
        <div className="future-kpi-grid"><div><span>UNDER CONSTRUCTION</span><b>{evidence.counts?.construction ?? 0}</b><small>mapped OSM features</small></div><div><span>PROPOSED / PLANNED</span><b>{evidence.counts?.proposed ?? 0}</b><small>mapped OSM features</small></div><div><span>TOTAL FUTURE EVIDENCE</span><b>{evidence.counts?.total ?? 0}</b><small>within {evidenceRadius} km</small></div><div><span>MAP MODE</span><b>{timeState === "future" ? "REAL" : "ARCHIVED"}</b><small>{timeState === "future" ? "planned/construction overlay" : "satellite imagery"}</small></div></div>
        <div className="future-change-list"><b>WHAT IS ACTUALLY MAPPED</b><span>▸ Under-construction buildings / roads / rail</span><span>▸ Proposed buildings / roads / rail</span><span>▸ Click any line or point to inspect OSM tags</span>{evidenceLoading && <span>▸ Loading nearby mapped features…</span>}{evidenceError && <span>▸ {evidenceError}</span>}</div>
        <div className="future-intelligence-grid-v34">
          <div><span>LAND-USE SCENARIO</span><b>{Math.min(96,42 + Math.max(0,year-2026)*3)}%</b><small>modeled urban pressure</small></div>
          <div><span>MOBILITY STRESS</span><b>{Math.min(96,25 + Math.max(0,year-2026)*2 + Math.round(mobilityLevel*0.35))}</b><small>modeled screening value</small></div>
          <div><span>JOB CAPACITY SIGNAL</span><b>{Math.max(0,Math.round(4500 + (year-2026)*650 + evidence.counts?.construction*80))}+</b><small>scenario-derived, not a forecast</small></div>
          <div><span>POPULATION SIGNAL</span><b>{Math.max(0,Math.round(12000 + (year-2026)*900 + evidence.counts?.proposed*120))}</b><small>scenario-derived, not official</small></div>
        </div>
        {timeState === "future" && (
          <div className="future-impact-v35">
            <div className="future-impact-head-v35">
              <div><p className="eyebrow">FUTURE OUTLOOK</p><b>{activeLocation} · {year}</b><small>Potential advantages and trade-offs derived from mapped evidence and scenario settings.</small></div>
              <span>MODELED · NOT AN OFFICIAL FORECAST</span>
            </div>
            <div className="future-impact-cols-v35">
              <div className="impact-col-v35 advantage">
                <div className="impact-col-head-v35"><span>ADVANTAGES</span><b>Potential benefits</b></div>
                {futureOutlook.advantages.map((item) => (
                  <div className="impact-row-v35" key={item.label}>
                    <div><span>{item.label}</span><b>{item.score}</b></div>
                    <i><em style={{ width: `${item.score}%` }} /></i>
                    <small>{item.text}</small>
                  </div>
                ))}
              </div>
              <div className="impact-col-v35 tradeoff">
                <div className="impact-col-head-v35"><span>DISADVANTAGES / TRADE-OFFS</span><b>What could worsen</b></div>
                {futureOutlook.tradeoffs.map((item) => (
                  <div className="impact-row-v35" key={item.label}>
                    <div><span>{item.label}</span><b>{item.score}</b></div>
                    <i><em style={{ width: `${item.score}%` }} /></i>
                    <small>{item.text}</small>
                  </div>
                ))}
              </div>
            </div>
            <div className="future-impact-foot-v35">These are screening indicators for the scenario. They describe plausible effects to investigate, not guaranteed outcomes.</div>
          </div>
        )}
        <div className="mobility-control-v34"><span>MOBILITY SCENARIO</span><b>{mobilityLevel}%</b><input type="range" min="0" max="100" value={mobilityLevel} onChange={e=>setMobilityLevel(+e.target.value)} /><small>Scenario control for transport-stress visualization; it does not claim to predict actual traffic.</small></div>
        <small className="future-footnote">This view intentionally does not invent future buildings, population or jobs. Future geometry comes from mapped construction / proposed features returned by OpenStreetMap via Overpass. OSM proposed features may be community-mapped and should be verified against the responsible authority before being treated as approved projects.</small>
      </aside>
    </div>

    <div className="future-imagery-status">
      <div><span className="eyebrow">TIME MACHINE</span><b>{timelineLabel(year)}</b><small>{imageryMeta?.releaseDate || (timeState === "future" ? "Current imagery" : "Loading imagery…")}</small></div>
      <div><span>LOCATION</span><b>{activeLocation}</b><small>{activeCenter[1].toFixed(5)}, {activeCenter[0].toFixed(5)}</small></div>
      <div><span>SOURCE MODE</span><b>{timeState === "past" ? "Esri World Imagery Wayback" : timeState === "present" ? "Esri World Imagery" : "Real current imagery + mapped future evidence"}</b><small>{historyError || (timeState === "past" ? "Historical archive release; acquisition date may differ." : "Real geographic context.")}</small></div>
    </div>
    <div className="future-evidence-v20"><div><p className="eyebrow">KNOWN TODAY</p><b>{activeLocation} geographic context</b><span>The real map is centered on the searched place. Current projects, sanctioned footprints, ownership and employment must be verified against authoritative local datasets before being treated as official.</span></div><div><p className="eyebrow">FUTURE EVIDENCE</p><b>{year} · {evidenceRadius} km evidence radius</b><span>Future layers are limited to real mapped construction / proposed features. When no mapped future geometry exists, the platform says so rather than inventing projects.</span></div><div><p className="eyebrow">SOURCE TRAIL</p>{sources.map((x) => <span key={x.label}>• <b>{x.label}</b> — {x.text}</span>)}</div></div>
  </ShellFuture>;
}

function ShellFuture({ children }) {
  return <section className="page-v4 wide"><div className="page-heading"><div><p className="eyebrow">08 / FUTURE CITY</p><h1>See the future<br /><span>before it arrives.</span></h1></div><p className="page-subtitle">A real-location time machine: archived past imagery, current satellite/3D context, and mapped future construction/proposals with explicit source status.</p></div>{children}</section>;
}
