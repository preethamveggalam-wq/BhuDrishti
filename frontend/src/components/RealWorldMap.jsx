import React, { useEffect, useRef, useState } from "react";
import { API_BASE } from "../api";
import { Map, NavigationControl, ScaleControl, GeolocateControl, Popup, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import mapWorker from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

setWorkerUrl(mapWorker);

const MAP_STYLES = {
  "2D": "https://tiles.openfreemap.org/styles/bright",
  // Use the stable bright OpenFreeMap vector style as the base for 3D, then
  // add real OpenMapTiles building extrusion after the style loads. This
  // avoids a blank canvas when a provider-specific 3D style fails to load.
  "3D": "https://tiles.openfreemap.org/styles/bright"
};

const SATELLITE_STYLE = {
  version: 8,
  sources: {
    esri: {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
    }
  },
  layers: [{ id: "esri-imagery", type: "raster", source: "esri", minzoom: 0, maxzoom: 19 }]
};

function mapStyleFor(mode) { return mode === "Satellite" ? SATELLITE_STYLE : (MAP_STYLES[mode] || MAP_STYLES["2D"]); }
function mapCameraFor(mode) { return mode === "3D" ? { pitch: 58, bearing: -18 } : { pitch: 0, bearing: 0 }; }

const REGIONS = {
  Hyderabad: [78.4867, 17.3850],
  Warangal: [79.5941, 17.9784],
  Nizamabad: [78.0940, 18.6725],
  Visakhapatnam: [83.2185, 17.6868],
  Bengaluru: [77.5946, 12.9716],
};

const FALLBACK_TARGETS = {
  Hyderabad: [
    [78.390,17.455],[78.430,17.430],[78.475,17.410],[78.520,17.430],[78.565,17.405],[78.610,17.380],
    [78.350,17.385],[78.405,17.365],[78.455,17.350],[78.505,17.360],[78.555,17.350],[78.620,17.340],
    [78.330,17.330],[78.385,17.315],[78.445,17.300],[78.515,17.315],[78.575,17.300],[78.650,17.300],
    [78.365,17.470],[78.415,17.470],[78.465,17.455],[78.515,17.455],[78.565,17.450],[78.615,17.430],
    [78.335,17.405],[78.385,17.395],[78.435,17.390],[78.485,17.390],[78.535,17.385],[78.585,17.375]
  ],
  Warangal: [[79.52,17.99],[79.56,17.96],[79.60,17.94],[79.64,17.98],[79.68,17.95],[79.72,17.92],[79.55,18.03],[79.62,18.04]],
  Nizamabad: [[78.03,18.70],[78.07,18.67],[78.11,18.65],[78.15,18.69],[78.20,18.66],[78.08,18.73],[78.18,18.72]],
  Visakhapatnam: [[83.15,17.75],[83.20,17.72],[83.25,17.70],[83.30,17.68],[83.35,17.65],[83.18,17.67],[83.28,17.75]],
  Bengaluru: [[77.52,13.03],[77.57,13.00],[77.62,12.98],[77.67,12.95],[77.72,12.92],[77.55,13.06],[77.68,13.04]]
};

function escapeHtml(value) {
  return String(value ?? "—").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
}

export default function RealWorldMap({ region, setRegion, selectedBuilding, setSelectedBuilding, mapMode, setMapMode, parcelGeoJSON, focusRecord, onSelectedRecord, onParcel }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("Click anywhere on the map to inspect the nearest land record");
  const [liveCount, setLiveCount] = useState(0);
  const [recordLoading, setRecordLoading] = useState(false);

  const refresh = () => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    refreshLivePoints(map, region, setLiveCount, setMessage, setRecordLoading, setSelectedBuilding, onSelectedRecord, onParcel, popupRef);
  };

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = new Map({
      container: mapEl.current,
      style: mapStyleFor(mapMode),
      center: REGIONS[region] || REGIONS.Hyderabad,
      zoom: 11.2,
      pitch: mapCameraFor(mapMode).pitch,
      bearing: mapCameraFor(mapMode).bearing,
      attributionControl: true,
      projection: "mercator",
      maxPitch: 85,
      dragRotate: true,
      pitchWithRotate: true,
    });
    mapRef.current = map;
    map.addControl(new NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-left");
    map.addControl(new GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }), "top-right");

    map.on("load", () => {
      addParcelSource(map, parcelGeoJSON);
      refresh();
      installBackgroundClick(map, region, setMessage, setRecordLoading, setSelectedBuilding, onSelectedRecord, onParcel, popupRef);
    });
    map.on("error", () => setMessage("Map provider unavailable — check internet connection"));
    return () => {
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    addParcelSource(map, parcelGeoJSON);
  }, [parcelGeoJSON]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const center = REGIONS[region];
    if (center) map.flyTo({ center, zoom: 11.2, ...mapCameraFor(mapMode), duration: 1000 });
    if (map.isStyleLoaded()) refresh();
  }, [region]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const camera = mapCameraFor(mapMode);
    setMessage(mapMode === "Satellite" ? "Satellite imagery · real-color basemap" : mapMode === "3D" ? "3D city view loading…" : "Bright street map loading…");
    map.setStyle(mapStyleFor(mapMode));
    const restore = () => {
      map.setProjection("mercator");
      map.setPitch(camera.pitch);
      map.setBearing(camera.bearing);
      addParcelSource(map, parcelGeoJSON);
      if (mapMode === "3D") ensure3DLayerAfterStyleLoad(map);
      refreshLivePoints(map, region, setLiveCount, setMessage, setRecordLoading, setSelectedBuilding, onSelectedRecord, onParcel, popupRef);
      installBackgroundClick(map, region, setMessage, setRecordLoading, setSelectedBuilding, onSelectedRecord, onParcel, popupRef);
    };
    map.once("style.load", restore);
    return () => map.off("style.load", restore);
  }, [mapMode, region]);

  useEffect(() => {
    const map = mapRef.current;
    const r = focusRecord?.record || focusRecord;
    if (!map || !r) return;
    const lng = Number(r.longitude), lat = Number(r.latitude);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    map.flyTo({ center: [lng, lat], zoom: 17, ...mapCameraFor(mapMode), duration: 1600 });
    setMessage(`Focused on Survey ${r.surveyNo || "—"} · ${r.village || "selected parcel"}`);
    showRecordPopup(map, [lng, lat], r, popupRef);
  }, [focusRecord, mapMode]);

  async function findPlace() {
    const q = search.trim();
    if (!q || searching) return;
    setSearching(true); setMessage("Searching location…");
    try {
      const response = await fetch(`${API_BASE}/geocode?q=${encodeURIComponent(q)}`);
      if (!response.ok) throw new Error("Search failed");
      const results = await response.json();
      if (!results.length) throw new Error("Location not found");
      const item = results[0];
      const lng = Number(item.lon), lat = Number(item.lat);
      mapRef.current?.flyTo({ center: [lng, lat], zoom: 15, ...mapCameraFor(mapMode), duration: 1400 });
      setMessage(item.display_name);
    } catch { setMessage("Location not found. Try a city, landmark or address."); }
    finally { setSearching(false); }
  }

  return <div className="real-map-wrap">
    <div ref={mapEl} className="real-map" />
    <div className="real-map-topbar">
      <div className="real-map-title"><span>LIVE WORLD MAP</span><b>Land parcels · real-world GIS base</b><small>{liveCount ? `${liveCount} live land-record targets loaded` : "Loading live land-record targets…"}</small></div>
      <div className="real-map-search"><input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key === "Enter" && findPlace()} placeholder="Search city, address or place…"/><button onClick={findPlace} disabled={searching}>{searching ? "…" : "Search"}</button></div>
    </div>
    <div className="real-map-region-pills">{Object.keys(REGIONS).map(name=><button key={name} className={region===name?"active":""} onClick={()=>{setRegion(name);setMessage(`${name} selected · loading live land records…`)}}>{name}</button>)}</div>
    <div className="real-map-mode"><button className={mapMode==="2D"?"active":""} onClick={()=>setMapMode("2D")}>Map</button><button className={mapMode==="Satellite"?"active":""} onClick={()=>setMapMode("Satellite")}>Satellite</button><button className={mapMode==="3D"?"active":""} onClick={()=>setMapMode("3D")}>3D</button></div>
    <div className="real-map-status compact"><i/>{recordLoading ? "Analyzing clicked location…" : message}</div>
    <div className="real-map-note">Map © OpenStreetMap contributors · OpenFreeMap · Land records © Telangana GIS/TRAC</div>
  </div>;
}

function add3DBuildings(map) {
  const sourceId = "openmaptiles";
  const layerId = "bhudrishti-3d-buildings";
  if (map.getLayer(layerId)) return true;
  if (!map.getSource(sourceId)) return false;
  try {
    map.addLayer({
      id: layerId,
      type: "fill-extrusion",
      source: sourceId,
      "source-layer": "building",
      minzoom: 12.5,
      paint: {
        "fill-extrusion-color": ["coalesce", ["get", "colour"], "#9fb3b3"],
        "fill-extrusion-height": ["coalesce", ["to-number", ["get", "render_height"]], ["to-number", ["get", "height"]], 10],
        "fill-extrusion-base": ["coalesce", ["to-number", ["get", "render_min_height"]], 0],
        "fill-extrusion-opacity": 0.88,
        "fill-extrusion-vertical-gradient": true
      }
    });
    return true;
  } catch { return false; }
}

function ensure3DLayerAfterStyleLoad(map, attempts = 0) {
  if (map.getLayer("bhudrishti-3d-buildings")) return;
  if (add3DBuildings(map)) return;
  if (attempts >= 12) return;
  window.setTimeout(() => ensure3DLayerAfterStyleLoad(map, attempts + 1), 250);
}

async function refreshLivePoints(map, region, setLiveCount, setMessage, setRecordLoading, setSelectedBuilding, onSelectedRecord, onParcel, popupRef) {
  const sourceId = "bhudrishti-properties";
  const fillId = "bhudrishti-property-glow";
  const pointId = "bhudrishti-property-points";
  [fillId, pointId, "bhudrishti-clusters", "bhudrishti-cluster-count"].forEach(id => { if (map.getLayer(id)) map.removeLayer(id); });
  if (map.getSource(sourceId)) map.removeSource(sourceId);
  let records = [];
  try {
    const response = await fetch(`${API_BASE}/land-parcels?region=${encodeURIComponent(region)}&limit=60`);
    if (!response.ok) throw new Error("Live GIS unavailable");
    const body = await response.json();
    records = body.records || [];
  } catch {
    setMessage("Live GIS targets unavailable. You can still click anywhere for a live parcel lookup.");
  }

  if (!records.length) {
    const targets = FALLBACK_TARGETS[region] || FALLBACK_TARGETS.Hyderabad;
    const features = targets.map((coords, i) => ({ type:"Feature", properties:{ id:`target-${i+1}`, surveyNo:"Lookup required", ownerName:"Not loaded", status:"CLICK TO LOOK UP" }, geometry:{type:"Point",coordinates:coords} }));
    map.addSource(sourceId,{type:"geojson",data:{type:"FeatureCollection",features},cluster:true,clusterMaxZoom:15,clusterRadius:55});
    map.addLayer({id:"bhudrishti-clusters",type:"circle",source:sourceId,filter:["has","point_count"],paint:{"circle-color":"#efb44e","circle-radius":20,"circle-opacity":0.82,"circle-stroke-color":"#fff2d0","circle-stroke-width":1.5}});
    map.addLayer({id:"bhudrishti-cluster-count",type:"symbol",source:sourceId,filter:["has","point_count"],layout:{"text-field":["get","point_count_abbreviated"],"text-size":11},paint:{"text-color":"#2d1b00"}});
    map.addLayer({id:fillId,type:"circle",source:sourceId,filter:["!has","point_count"],paint:{"circle-radius":15,"circle-color":"#efb44e","circle-opacity":0.14,"circle-blur":0.8}});
    map.addLayer({id:pointId,type:"circle",source:sourceId,filter:["!has","point_count"],paint:{"circle-radius":7,"circle-color":"#efb44e","circle-stroke-color":"#fff2d0","circle-stroke-width":1.5}});
    setLiveCount(0);
    wirePointClick(map, pointId, setMessage, setRecordLoading, setSelectedBuilding, onSelectedRecord, onParcel, popupRef, region);
    wireClusterClick(map);
    return;
  }

  const features = records.filter(r=>Number.isFinite(Number(r.longitude))&&Number.isFinite(Number(r.latitude))).map(r => ({ type:"Feature", properties:r, geometry:{type:"Point",coordinates:[Number(r.longitude),Number(r.latitude)]} }));
  map.addSource(sourceId,{type:"geojson",data:{type:"FeatureCollection",features},cluster:true,clusterMaxZoom:15,clusterRadius:55,clusterMinPoints:3});
  map.addLayer({id:"bhudrishti-clusters",type:"circle",source:sourceId,filter:["has","point_count"],paint:{"circle-color":["step",["get","point_count"],"#35e8b0",20,"#20b8e9",50,"#efb44e"],"circle-radius":["step",["get","point_count"],18,20,23,50,28],"circle-opacity":0.86,"circle-stroke-color":"#eafff8","circle-stroke-width":1.5}});
  map.addLayer({id:"bhudrishti-cluster-count",type:"symbol",source:sourceId,filter:["has","point_count"],layout:{"text-field":["get","point_count_abbreviated"],"text-size":11},paint:{"text-color":"#041612"}});
  map.addLayer({id:fillId,type:"circle",source:sourceId,filter:["!has","point_count"],paint:{"circle-radius":14,"circle-color":"#35e8b0","circle-opacity":0.13,"circle-blur":0.8}});
  map.addLayer({id:pointId,type:"circle",source:sourceId,filter:["!has","point_count"],paint:{"circle-radius":7,"circle-color":"#35e8b0","circle-stroke-color":"#eafff8","circle-stroke-width":1.5}});
  setLiveCount(features.length);
  setMessage(`${features.length} live GIS targets loaded · clustered for fast exploration`);
  wirePointClick(map, pointId, setMessage, setRecordLoading, setSelectedBuilding, onSelectedRecord, onParcel, popupRef, region);
  wireClusterClick(map);
}

function wireClusterClick(map) {
  if (map.__bhudrishtiClusterHandlers) {
    map.off("click", "bhudrishti-clusters", map.__bhudrishtiClusterHandlers.click);
    map.off("mouseenter", "bhudrishti-clusters", map.__bhudrishtiClusterHandlers.enter);
    map.off("mouseleave", "bhudrishti-clusters", map.__bhudrishtiClusterHandlers.leave);
  }
  const click = e => {
    const feature = e.features?.[0];
    const clusterId = feature?.properties?.cluster_id;
    if (clusterId === undefined) return;
    const source = map.getSource("bhudrishti-properties");
    source?.getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err) return;
      map.easeTo({ center: feature.geometry.coordinates, zoom: Math.min(zoom, 17), duration: 650 });
    });
  };
  const enter = () => map.getCanvas().style.cursor = "pointer";
  const leave = () => map.getCanvas().style.cursor = "";
  map.on("click", "bhudrishti-clusters", click);
  map.on("mouseenter", "bhudrishti-clusters", enter);
  map.on("mouseleave", "bhudrishti-clusters", leave);
  map.__bhudrishtiClusterHandlers = {click, enter, leave};
}

function installBackgroundClick(map, region, setMessage, setRecordLoading, setSelectedBuilding, onSelectedRecord, onParcel, popupRef) {
  if (map.__bhudrishtiBackgroundClick) map.off("click", map.__bhudrishtiBackgroundClick);
  const handler = async e => {
    const pointLayer = "bhudrishti-property-points";
    const hit = map.getLayer(pointLayer) ? map.queryRenderedFeatures(e.point, { layers: [pointLayer] }) : [];
    if (hit?.length) return;
    await lookupMapLocation(map, e.lngLat.lng, e.lngLat.lat, region, setMessage, setRecordLoading, setSelectedBuilding, onSelectedRecord, onParcel, popupRef);
  };
  map.__bhudrishtiBackgroundClick = handler;
  map.on("click", handler);
}

function wirePointClick(map, pointId, setMessage, setRecordLoading, setSelectedBuilding, onSelectedRecord, onParcel, popupRef, region) {
  map.__bhudrishtiPointHandlers = map.__bhudrishtiPointHandlers || {};
  const previous = map.__bhudrishtiPointHandlers[pointId];
  if (previous) {
    map.off("click", pointId, previous.click);
    map.off("mouseenter", pointId, previous.enter);
    map.off("mouseleave", pointId, previous.leave);
  }
  const clickHandler = async e => {
    const coords = e.lngLat;
    await lookupMapLocation(map, coords.lng, coords.lat, region, setMessage, setRecordLoading, setSelectedBuilding, onSelectedRecord, onParcel, popupRef);
  };
  const enterHandler = () => map.getCanvas().style.cursor = "pointer";
  const leaveHandler = () => map.getCanvas().style.cursor = "";
  map.on("click", pointId, clickHandler);
  map.on("mouseenter", pointId, enterHandler);
  map.on("mouseleave", pointId, leaveHandler);
  map.__bhudrishtiPointHandlers[pointId] = {click:clickHandler, enter:enterHandler, leave:leaveHandler};
}

async function lookupMapLocation(map, lng, lat, region, setMessage, setRecordLoading, setSelectedBuilding, onSelectedRecord, onParcel, popupRef) {
  if (setRecordLoading) setRecordLoading(true);
  setMessage(`Analysing exact click ${lat.toFixed(6)}, ${lng.toFixed(6)}…`);
  try {
    const response = await fetch(`${API_BASE}/map-click?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&region=${encodeURIComponent(region)}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Map location could not be read.");
    const r = { ...(body.record || {}), latitude: lat, longitude: lng, clickedLatitude: lat, clickedLongitude: lng };
    setSelectedBuilding(r);
    onSelectedRecord?.(body);
    onParcel?.(body.parcelGeoJSON || null);
    map.flyTo({center:[lng,lat],zoom:17,duration:900,pitch:map.getPitch(),bearing:map.getBearing()});
    showRecordPopup(map,[lng,lat],r,popupRef);
    setMessage(`Exact click: ${lat.toFixed(6)}, ${lng.toFixed(6)} · ${r.village || "locality not returned"} · ${r.surveyNo || "survey not returned"}`);
  } catch (err) {
    const fallback = {surveyNo:"No cadastral survey returned",ownerName:null,village:null,mandal:null,district:null,soilType:null,latitude:lat,longitude:lng,clickedLatitude:lat,clickedLongitude:lng,sourceStatus:"NO AUTHORITATIVE PARCEL RETURNED",clickedLocation:`${lat.toFixed(6)}, ${lng.toFixed(6)}`};
    setSelectedBuilding(fallback);
    onSelectedRecord?.({record:fallback,sourceStatus:fallback.sourceStatus});
    onParcel?.(null);
    showRecordPopup(map,[lng,lat],fallback,popupRef,true);
    setMessage(`Exact click ${lat.toFixed(6)}, ${lng.toFixed(6)} · ${err.message || "No parcel returned"}`);
  } finally { if (setRecordLoading) setRecordLoading(false); }
}

function showRecordPopup(map, lngLat, r, popupRef, warning=false) {
  popupRef.current?.remove();
  const rows = [
    ["Owner / Pattadar", r.ownerName], ["Survey No.", r.surveyNo], ["District", r.district], ["Mandal", r.mandal],
    ["Village", r.village], ["Clicked location", Number.isFinite(Number(r.clickedLatitude)) && Number.isFinite(Number(r.clickedLongitude)) ? `${Number(r.clickedLatitude).toFixed(6)}, ${Number(r.clickedLongitude).toFixed(6)}` : null], ["Extent", r.extent], ["Land / Crop", r.classification || r.landType], ["Soil", r.soilType],
    ["Irrigation", r.irrigationSource], ["Coordinates", Number.isFinite(Number(r.latitude)) && Number.isFinite(Number(r.longitude)) ? `${Number(r.latitude).toFixed(6)}, ${Number(r.longitude).toFixed(6)}` : null]
  ];
  const content = `<div class="bhudrishti-popup-content ${warning?"warning":""}">
    <div class="popup-kicker">${escapeHtml(r.sourceStatus || "LIVE GIS RECORD")}</div>
    <h3>${escapeHtml(r.surveyNo || "Parcel details unavailable")}</h3>
    <div class="popup-location">${escapeHtml(r.village || "Location not returned")} · ${escapeHtml(r.mandal || "Mandal unavailable")} · ${escapeHtml(r.district || "District unavailable")}</div>
    <div class="popup-click-location">CLICKED: ${escapeHtml(r.clickedLocation || `${Number(r.clickedLatitude ?? r.latitude).toFixed(6)}, ${Number(r.clickedLongitude ?? r.longitude).toFixed(6)}`)}</div>
    <div class="popup-owner"><span>OWNER / PATTADAR</span><b>${escapeHtml(r.ownerName || "Not available")}</b></div>
    <div class="popup-mini-grid">${rows.slice(1,9).map(([k,v])=>`<div><span>${escapeHtml(k)}</span><b>${escapeHtml(v ?? "Not returned")}</b></div>`).join("")}</div>
    ${r.demoOnly ? `<div class="popup-source demo-popup-source">DEMO MAP CONTEXT · not an official ownership record</div>` : (r.sourceUrl ? `<div class="popup-source">Source: Telangana GIS / TGRAC</div>` : "")}
  </div>`;
  popupRef.current = new Popup({closeButton:true,offset:14,maxWidth:"370px",className:"bhudrishti-map-popup"}).setLngLat(lngLat).setHTML(content).addTo(map);
}

function addParcelSource(map, parcelGeoJSON) {
  const sourceId = "bhudrishti-land-parcel";
  const fillId = "bhudrishti-land-parcel-fill";
  const lineId = "bhudrishti-land-parcel-line";
  if (map.getLayer(fillId)) map.removeLayer(fillId);
  if (map.getLayer(lineId)) map.removeLayer(lineId);
  if (map.getSource(sourceId)) map.removeSource(sourceId);
  if (!parcelGeoJSON) return;
  map.addSource(sourceId,{type:"geojson",data:parcelGeoJSON});
  map.addLayer({id:fillId,type:"fill",source:sourceId,paint:{"fill-color":"#35e8b0","fill-opacity":0.24}});
  map.addLayer({id:lineId,type:"line",source:sourceId,paint:{"line-color":"#54f1c2","line-width":4}});
}
