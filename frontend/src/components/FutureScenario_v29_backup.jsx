import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Map, NavigationControl, ScaleControl, Popup, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import mapWorker from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
setWorkerUrl(mapWorker);

const DEFAULT_LOCATION = "Kandlakoya";
const DEFAULT_CENTER = [78.5112, 17.5457];
const KANDLAKOYA = DEFAULT_CENTER;

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
  ];
  return [
    { label: "OpenStreetMap / Nominatim", text: "Geographic place context resolved from the searched location" },
    { label: "OpenFreeMap", text: "Real-world map context for the selected place" },
    { label: "BhuDrishti scenario engine", text: "Modeled future buildings, infrastructure, population and jobs" },
  ];
}

function scenarioFor(year, completion, location = DEFAULT_LOCATION) {
  const years = Math.max(0, year - 2026);
  const progress = Math.min(1, completion / 100);
  const maturity = Math.min(1, years / 10);
  const nameSeed = [...location.toLowerCase()].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 997, 17);
  const isKandlakoya = location.toLowerCase().includes("kandlakoya");
  const basePopulation = isKandlakoya ? 2802 : 12000 + (nameSeed % 42000);
  const baseWorkers = isKandlakoya ? 10000 : 4500 + (nameSeed % 12500);
  const baseHomes = isKandlakoya ? 337 : 180 + (nameSeed % 920);
  const baseBuilt = isKandlakoya ? 292244 : 90000 + (nameSeed % 260000);
  const growth = Math.min(100, Math.round(18 + years * 3.1 + progress * 24 + (nameSeed % 9)));
  const built = Math.round(baseBuilt * progress * Math.min(1, 0.35 + years / 10));
  const workers = Math.round(baseWorkers * progress * (1 + Math.min(years, 10) * 0.035));
  const residents = Math.round(baseHomes * progress);
  const roads = Math.max(1, Math.round(1 + progress * 3 + years * 0.15));
  const green = Math.max(8, Math.round(17 - years * 0.35 + progress * 2));
  const population = Math.round(basePopulation * (1 + years * 0.035) + residents * 2.6);
  const traffic = Math.round(42 + years * 2.4 + progress * 20 + (nameSeed % 8));
  const transit = Math.min(5, Math.round(1 + maturity * 2 + progress));
  return { growth, built, workers, residents, roads, green, population, traffic, transit, isKandlakoya };
}

function parseQuestion(text) {
  const q = text.toLowerCase();
  const yearMatch = q.match(/(?:after|in|by)\s+(\d{1,2})\s*(?:years?|yrs?)/i);
  const explicitYear = q.match(/\b(20\d{2})\b/);
  const years = yearMatch ? Number(yearMatch[1]) : explicitYear ? Math.max(1, Number(explicitYear[1]) - 2026) : 10;
  const year = explicitYear ? Number(explicitYear[1]) : Math.min(2045, Math.max(2027, 2026 + years));
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

function FutureMap2D({ year, completion, satellite, center = DEFAULT_CENTER, location = DEFAULT_LOCATION, onSelect }) {
  const el = useRef(null), mapRef = useRef(null);
  const style = satellite
    ? { version: 8, sources: { esri: { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community" } }, layers: [{ id: "esri-imagery", type: "raster", source: "esri", minzoom: 0, maxzoom: 19 }] }
    : "https://tiles.openfreemap.org/styles/bright";

  useEffect(() => {
    if (!el.current || mapRef.current) return;
    const map = new Map({ container: el.current, style, center, zoom: 13.6, pitch: 0, bearing: 0, attributionControl: true });
    mapRef.current = map;
    map.addControl(new NavigationControl(), "top-right");
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");
    map.on("load", () => addFutureLayers(map, year, completion, center, location));
    return () => { map.remove(); mapRef.current = null; };
  }, [satellite]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource("future-sites");
    const roads = map.getSource("future-roads");
    if (src) src.setData(scenarioGeo(year, completion, center, location));
    if (roads) roads.setData(roadGeo(year, center, location));
  }, [year, completion, center, location]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center, zoom: 13.6, pitch: 0, bearing: 0, duration: 900 });
  }, [center]);

  return <div className="future-map2d">
    <div ref={el} className="future-map-canvas" />
    <div className="future-map-label"><b>{location} · {year}</b><span>{satellite ? "Satellite context + modeled future footprint" : "Real-color basemap + modeled future footprint"}</span></div>
    <div className="future-map-hint">Click a colored zone to inspect the scenario addition</div>
    <div className="future-legend"><span><i className="it" />Employment</span><span><i className="res" />Residential</span><span><i className="com" />Commercial</span><span><i className="green" />Public realm</span></div>
  </div>;
}

function addFutureLayers(map, year, completion, center = DEFAULT_CENTER, location = DEFAULT_LOCATION) {
  map.addSource("future-sites", { type: "geojson", data: scenarioGeo(year, completion, center, location) });
  map.addSource("future-roads", { type: "geojson", data: roadGeo(year, center, location) });
  map.addLayer({ id: "future-roads-casing", type: "line", source: "future-roads", paint: { "line-color": "#ffffff", "line-opacity": 0.65, "line-width": 6 } });
  map.addLayer({ id: "future-roads-line", type: "line", source: "future-roads", paint: { "line-color": "#35bda0", "line-opacity": 0.95, "line-width": 2, "line-dasharray": [2, 2] } });
  map.addLayer({ id: "future-sites-fill", type: "fill", source: "future-sites", paint: { "fill-color": ["match", ["get", "kind"], "it", "#1db98c", "res", "#2196e0", "com", "#e4a33f", "green", "#4b9b68", "#4ce3b1"], "fill-opacity": 0.48, "fill-outline-color": "#ffffff" } });
  map.addLayer({ id: "future-sites-line", type: "line", source: "future-sites", paint: { "line-color": "#ffffff", "line-opacity": 0.8, "line-width": 2 } });
  map.on("click", "future-sites-fill", (e) => {
    const p = e.features?.[0]?.properties;
    if (!p) return;
    onFuturePopup(map, e.lngLat, p);
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

function CityFutureScene({ year, completion, layer, location = DEFAULT_LOCATION, onPick }) {
  const { camera } = useThree();
  const [hover, setHover] = useState(null);
  const s = scenarioFor(year, completion, location);
  const maturity = Math.min(1, (year - 2026) / 10) * (completion / 100);
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
  const showFuture = layer !== "existing";
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

export default function FutureScenario() {
  const [query, setQuery] = useState("Show me how Kandlakoya will look like after 10 years, what will be added in the city, and how many people may work there.");
  const [activeLocation, setActiveLocation] = useState(DEFAULT_LOCATION);
  const [activeCenter, setActiveCenter] = useState(DEFAULT_CENTER);
  const [geoError, setGeoError] = useState("");
  const [year, setYear] = useState(2036);
  const [completion, setCompletion] = useState(75);
  const [mode, setMode] = useState("3D");
  const [mapView, setMapView] = useState("map");
  const [layer, setLayer] = useState("all");
  const [result, setResult] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState(null);
  const parsed = useMemo(() => parseQuestion(query), [query]);
  const s = scenarioFor(year, completion, activeLocation);
  const horizon = year - 2026;
  const sources = useMemo(() => sourcesFor(activeLocation), [activeLocation]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setYear((v) => v >= 2045 ? 2027 : v + 1), 900);
    return () => clearInterval(id);
  }, [playing]);

  const analyze = async () => {
    const p = parseQuestion(query);
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
      <div className="future-query-copy"><p className="eyebrow">AI FUTURE CITY EXPLORER</p><h1>Ask what a place could<br /><span>become.</span></h1><p>Type any city, town, district, village or landmark and a future question. The explorer geocodes the place, centers the real map there, and builds a clearly labeled scenario model — then shows the same future in 2D and 3D.</p></div>
      <div className="future-input-v20"><div className="future-input-top"><span>SCENARIO QUERY</span><b>Search any place · Natural language</b></div><textarea placeholder="Example: Show me how Bengaluru will look after 10 years with new transit, homes and jobs." value={query} onChange={(e) => setQuery(e.target.value)} /><div className="future-query-actions"><button className="primary-v4" onClick={analyze}>Analyze future →</button><button className="secondary-v4" onClick={() => setQuery("Show me how Bengaluru will look in 2040 with new jobs, homes, roads, transit and green areas.")}>Try example</button></div>{geoError && <div className="future-geocode-error">{geoError}</div>}</div>
    </div>

    <div className="future-control-v20">
      <div><span>LOCATION</span><b>{activeLocation}</b><small>Any searchable place</small></div>
      <div><span>TARGET YEAR</span><b>{year}</b><input type="range" min="2027" max="2045" value={year} onChange={(e) => setYear(+e.target.value)} /></div>
      <div><span>SCENARIO COMPLETION</span><b>{completion}%</b><input type="range" min="25" max="100" value={completion} onChange={(e) => setCompletion(+e.target.value)} /></div>
      <button className={`play-year ${playing ? "active" : ""}`} onClick={() => setPlaying((v) => !v)}>{playing ? "Pause" : "Play timeline"}</button>
    </div>

    {result && <div className="future-summary-v20"><div><span>BASELINE</span><b>2026 · Known context</b></div><i>→</i><div><span>SCENARIO</span><b>{year} · {horizon} years</b></div><i>→</i><div><span>OUTPUT</span><b>2D map + 3D city</b></div><p>This is a modeled “what-if” view. Proposed buildings, population, jobs and infrastructure are scenario outputs — not guaranteed future government plans.</p></div>}

    <div className="future-view-toolbar-v20">
      <div className="future-view-switch"><button className={mode === "2D" ? "active" : ""} onClick={() => setMode("2D")}>2D MAP</button><button className={mode === "3D" ? "active" : ""} onClick={() => setMode("3D")}>3D CITY</button></div>
      {mode === "2D" ? <div className="future-view-switch"><button className={mapView === "map" ? "active" : ""} onClick={() => setMapView("map")}>REAL COLOR</button><button className={mapView === "satellite" ? "active" : ""} onClick={() => setMapView("satellite")}>SATELLITE</button></div> : <div className="future-view-switch"><button className={layer === "all" ? "active" : ""} onClick={() => setLayer("all")}>ALL</button><button className={layer === "existing" ? "active" : ""} onClick={() => setLayer("existing")}>TODAY</button><button className={layer === "scenario" ? "active" : ""} onClick={() => setLayer("scenario")}>FUTURE</button><button className={layer === "infrastructure" ? "active" : ""} onClick={() => setLayer("infrastructure")}>INFRA</button></div>}
    </div>

    <div className="future-visual-v20">
      <div className="future-viewport-v20">
        {mode === "2D" ? <FutureMap2D year={year} completion={completion} satellite={mapView === "satellite"} center={activeCenter} location={activeLocation} onSelect={setSelected} /> : <div className="future-3d-v20"><Canvas shadows dpr={[1, 1.8]} camera={{ position: [19, 13, 21], fov: 42 }}><CityFutureScene year={year} completion={completion} layer={layer} location={activeLocation} onPick={setSelected} /></Canvas><div className="future-3d-label-v20"><b>{activeLocation} · {year}</b><span>Procedural 3D scenario · click a building</span></div><div className="future-3d-legend"><span><i className="existing" />Today</span><span><i className="future" />Modeled</span><span><i className="road" />Mobility</span></div><div className="future-3d-hint-v21">Drag to orbit · wheel to zoom · right-drag to pan</div></div>}
      </div>
      <aside className="future-inspector-v20">
        <p className="eyebrow">SCENARIO INTELLIGENCE</p>
        <h2>{selected ? (selected.type === "it" ? "IT / Employment District" : selected.type === "res" ? "Residential Growth" : "Commercial Services") : `${activeLocation} in focus`}</h2>
        <p>{selected ? "Selected element from the modeled 3D city. Its geometry is illustrative and tied to the scenario controls." : "Change the year or completion to see the urban form evolve. Select a modeled building for its role."}</p>
        <div className="future-kpi-grid"><div><span>PEOPLE</span><b>{s.population.toLocaleString()}</b><small>modeled area population</small></div><div><span>JOBS</span><b>{s.workers.toLocaleString()}+</b><small>potential direct workers*</small></div><div><span>HOMES</span><b>{s.residents}</b><small>modeled residential units</small></div><div><span>BUILT-UP</span><b>{Math.round(s.built / 1000)}k</b><small>m² scenario delivery</small></div></div>
        <div className="future-change-list"><b>WHAT GETS ADDED</b><span>▸ Employment / IT district</span><span>▸ Residential growth</span><span>▸ Commercial + service activity</span><span>▸ Road / mobility connections</span><span>▸ Green and public-realm areas</span></div>
        <div className="future-bars"><div><span>Development pressure</span><b>{s.growth}%</b><i><em style={{ width: `${s.growth}%` }} /></i></div><div><span>Traffic intensity</span><b>{s.traffic}%</b><i><em style={{ width: `${Math.min(100, s.traffic)}%` }} /></i></div><div><span>Transit connectivity</span><b>{s.transit}/5</b><i><em style={{ width: `${Math.min(100, s.transit * 20)}%` }} /></i></div></div>
        <small className="future-footnote">*For Kandlakoya, employment uses the reported 10,000+ capacity context. For other searched places, employment, population and built-up figures are deterministic scenario assumptions based on the selected place and controls. They are not government forecasts.</small>
      </aside>
    </div>

    <div className="future-evidence-v20"><div><p className="eyebrow">KNOWN TODAY</p><b>{activeLocation} geographic context</b><span>The real map is centered on the searched place. Current projects, sanctioned footprints, ownership and employment must be verified against authoritative local datasets before being treated as official.</span></div><div><p className="eyebrow">MODELED FUTURE</p><b>{year} scenario · {completion}% completion</b><span>Buildings, roads, jobs, homes, population and indicators are generated from the scenario controls. They are visual decision-support assumptions, not predictions.</span></div><div><p className="eyebrow">SOURCE TRAIL</p>{sources.map((x) => <span key={x.label}>• <b>{x.label}</b> — {x.text}</span>)}</div></div>
  </ShellFuture>;
}

function ShellFuture({ children }) {
  return <section className="page-v4 wide"><div className="page-heading"><div><p className="eyebrow">08 / FUTURE CITY</p><h1>See the future<br /><span>before it arrives.</span></h1></div><p className="page-subtitle">Scenario planning for any searchable place — with real geographic context, explicit assumptions and a synchronized 2D / 3D view.</p></div>{children}</section>;
}
