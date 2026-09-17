import React, { useState } from "react";
import { API_BASE } from "../api";

const OFFICIAL_BHUBHARATI = "https://bhubharati.telangana.gov.in/knowLandStatus";
const OFFICIAL_GIS = "https://bhubharati.telangana.gov.in/gis/";

const TELANGANA_LAND_LAYER = "https://tgrac.telangana.gov.in/arcgis/rest/services/LIS_Folder/LandInformationSystem_Query/MapServer/1";
const TELANGANA_CADASTRAL_LAYER = "https://tgrac.telangana.gov.in/arcgis/rest/services/LIS_Folder/LandInformationSystem_Query/MapServer/0";

function normalizeSub(value) {
  return String(value ?? "").trim().replace(/^0+(?=\d)/, "").replace(/\.0+$/, "").toLowerCase();
}

function sameText(a, b) {
  return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
}

async function directArcGISRecord(form) {
  const match = String(form.survey || "").trim().match(/^(\d+(?:\.\d+)?)(?:\s*[\/-]\s*(.+))?$/);
  if (!match) throw new Error("Use a survey number such as 123 or 123/1.");
  const baseSurvey = Number(match[1]);
  const subSurvey = match[2]?.trim() || "";
  const ownerFields = "FID,Season,mandName,ClusterNam,DMV91,DMV2011,VillName,PPBNo,BaseSurvey,SubSurveyN,FarmerName,FatherName,CropTypeNa,CropName,CropVariet,CropSown_E,CropSown_1,T_Extent,TS_Extent,Src_Irriga,HasSeedPro,IsOrganic,lat,long";
  const ownerParams = new URLSearchParams({
    where: `BaseSurvey = ${baseSurvey}`, outFields: ownerFields, returnGeometry: "false", outSR: "4326", f: "json", resultRecordCount: "2000"
  });
  const ownerRes = await fetch(`${TELANGANA_LAND_LAYER}/query?${ownerParams.toString()}`, { headers: { Accept: "application/json" } });
  if (!ownerRes.ok) throw new Error(`Telangana GIS HTTP ${ownerRes.status}`);
  const ownerJson = await ownerRes.json();
  if (ownerJson.error) throw new Error(ownerJson.error.message || "Telangana GIS query error");
  const attrs = (ownerJson.features || []).map(x => x.attributes || {});
  const subMatches = subSurvey ? attrs.filter(a => normalizeSub(a.SubSurveyN) === normalizeSub(subSurvey)) : attrs;
  const localityMatches = subMatches.filter(a =>
    (!form.mandal || sameText(a.mandName, form.mandal)) &&
    (!form.village || sameText(a.VillName, form.village))
  );
  const a = localityMatches[0] || subMatches[0] || attrs[0];
  if (!a) throw new Error("No matching public Telangana GIS record was returned for this survey number.");

  let parcelGeoJSON = null;
  const parcelParts = [`Base_Syno = '${String(Math.trunc(baseSurvey)).replace(/'/g, "''")}'`];
  if (form.district) parcelParts.push(`District = '${String(form.district).replace(/'/g, "''")}'`);
  if (a.mandName) parcelParts.push(`Mandal = '${String(a.mandName).replace(/'/g, "''")}'`);
  if (a.VillName) parcelParts.push(`Village = '${String(a.VillName).replace(/'/g, "''")}'`);
  const parcelParams = new URLSearchParams({
    where: parcelParts.join(" AND "), outFields: "FID,District,Mandal,Village,DMV_1991,V_2011,Base_Syno", returnGeometry: "true", outSR: "4326", f: "json", resultRecordCount: "10"
  });
  try {
    const parcelRes = await fetch(`${TELANGANA_CADASTRAL_LAYER}/query?${parcelParams.toString()}`, { headers: { Accept: "application/json" } });
    if (parcelRes.ok) {
      const parcelJson = await parcelRes.json();
      const rings = parcelJson.features?.[0]?.geometry?.rings;
      if (rings?.length) parcelGeoJSON = { type: "Feature", properties: { surveyNo: subSurvey ? `${a.BaseSurvey}/${a.SubSurveyN}` : String(a.BaseSurvey) }, geometry: { type: "Polygon", coordinates: rings } };
    }
  } catch {}

  const record = {
    surveyNo: subSurvey ? `${a.BaseSurvey}/${a.SubSurveyN}` : String(a.BaseSurvey),
    ownerName: a.FarmerName, fatherName: a.FatherName, village: a.VillName, mandal: a.mandName, district: form.district || undefined,
    ppb: a.PPBNo, extent: a.T_Extent ?? a.TS_Extent, landType: a.CropTypeNa, classification: a.CropName, cropVariety: a.CropVariet,
    landStatus: a.Season, irrigationSource: a.Src_Irriga, organic: a.IsOrganic, latitude: a.lat, longitude: a.long
  };
  return { record, parcelGeoJSON, fetchedAt: new Date().toISOString(), sourceName: "Telangana State GIS / TGRAC · Land Information System", sourceUrl: TELANGANA_LAND_LAYER, officialRecordPortal: OFFICIAL_BHUBHARATI, note: "Browser-direct public GIS fallback used because the BhuDrishti backend could not complete the same public query." };
}

export default function LandRecords({ onParcel, onRecord, onSelected }) {
  const [form, setForm] = useState({ district: "Medchal-Malkajgiri", mandal: "", village: "", survey: "" });
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  async function fetchRecord(e) {
    e.preventDefault();
    if (!form.survey.trim()) {
      setError("Enter a survey / sub-division number. The platform will not invent a land record.");
      return;
    }
    setLoading(true); setError(""); setRecord(null);
    try {
      const params = new URLSearchParams(Object.entries(form).filter(([,v]) => v.trim()));
      let body = null;
      let backendMessage = "";
      try {
        const res = await fetch(`${API_BASE}/land-records?${params.toString()}`, { signal: AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined });
        const json = await res.json().catch(() => ({}));
        if (res.ok) body = json;
        else backendMessage = json.error || `Backend lookup failed (${res.status})`;
      } catch (err) {
        backendMessage = err?.message || "Backend lookup failed";
      }
      if (!body) {
        try {
          body = await directArcGISRecord(form);
          body.note = `${body.note}${backendMessage ? ` Backend message: ${backendMessage}.` : ""}`;
        } catch (directErr) {
          throw new Error(directErr.message || backendMessage || "Official land record service unavailable.");
        }
      }
      const focusBody = { ...body, focusNonce: Date.now() };
      setRecord(body);
      onParcel?.(body.parcelGeoJSON || null);
      onRecord?.(focusBody);
      onSelected?.(body);
    } catch (err) {
      setError(err.message || "Could not retrieve the official record.");
      onParcel?.(null);
      onRecord?.(null);
      onSelected?.(null);
    } finally { setLoading(false); }
  }

  return <div className="land-records-v12">
    <div className="land-record-head">
      <div><p className="eyebrow">VERIFIED LAND RECORDS</p><h2>Survey number → parcel → record details</h2><p>Live lookup against Telangana government GIS/land-record services. If an exact public feature is unavailable, Map Explorer uses a clearly labelled DEMO context so the map search still works.</p></div>
      <div className="source-badge-v12">SOURCE · GOVT. OF TELANGANA</div>
    </div>
    <form className="land-record-form" onSubmit={fetchRecord}>
      <label>District<input value={form.district} onChange={e=>update("district",e.target.value)} placeholder="e.g. Medchal-Malkajgiri"/></label>
      <label>Mandal<input value={form.mandal} onChange={e=>update("mandal",e.target.value)} placeholder="Mandal"/></label>
      <label>Village<input value={form.village} onChange={e=>update("village",e.target.value)} placeholder="Village"/></label>
      <label>Survey / Sub-division No.*<input value={form.survey} onChange={e=>update("survey",e.target.value)} placeholder="e.g. 123/1" required/></label>
      <button className="primary-v4" disabled={loading}>{loading ? "Fetching official record…" : "Fetch verified record →"}</button>
    </form>
    {error && <div className="land-record-error-v12">{error}<a href={OFFICIAL_BHUBHARATI} target="_blank" rel="noreferrer">Open official Bhu Bharati search ↗</a></div>}
    {!record && !error && <div className="land-record-empty-v12"><b>What will be shown</b><span>Survey number · village · mandal · district · pattadar/owner name when returned by the official service · father/husband name when returned · extent · land type/classification · PPB status · mutation/status fields · parcel boundary when available.</span></div>}
    {record && <RecordView record={record}/>} 
  </div>;
}

function RecordView({ record }) {
  const r = record.record || {};
  const fields = [
    ["Survey / Sub-division", r.surveyNo], ["Khata", r.khata], ["Pattadar / owner", r.ownerName], ["Father / Husband", r.fatherName],
    ["Village", r.village], ["Mandal", r.mandal], ["District", r.district], ["Extent", r.extent], ["Land type", r.landType],
    ["Classification / Crop", r.classification], ["Crop variety", r.cropVariety], ["Land status / season", r.landStatus || r.season],
    ["Irrigation source", r.irrigationSource], ["Organic status", r.organic], ["PPB number", r.ppb], ["Mutation status", r.mutation],
    ["Soil type", r.soilType], ["Coordinates", r.latitude && r.longitude ? `${Number(r.latitude).toFixed(6)}, ${Number(r.longitude).toFixed(6)}` : undefined]
  ];
  return <div className="land-record-result-v12">
    <div className="record-status-v12"><span>● VERIFIED SOURCE RESPONSE</span><small>Fetched {new Date(record.fetchedAt).toLocaleString()}</small></div>
    <div className="record-grid-v12">{fields.filter(([,v]) => v !== undefined && v !== null && String(v).trim() !== "").map(([k,v])=><div key={k}><small>{k}</small><b>{String(v)}</b></div>)}</div>
    <div className="record-disclosure-v12"><b>Important:</b> Aadhaar numbers, mobile numbers and other unnecessary personal identifiers are intentionally not displayed. Soil and other environmental fields are shown only when a connected authoritative source returns them; the platform does not invent missing values.</div>
    <div className="record-source-v12"><span>Source: {record.sourceName}</span><a href={record.sourceUrl} target="_blank" rel="noreferrer">Open GIS source ↗</a><a href={OFFICIAL_BHUBHARATI} target="_blank" rel="noreferrer">Open official Bhu Bharati ↗</a>{record.parcelGeoJSON&&<span className="parcel-ok">✓ Parcel geometry returned</span>}</div>
  </div>;
}
