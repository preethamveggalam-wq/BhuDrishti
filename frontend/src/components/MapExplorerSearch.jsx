import React, { useEffect, useMemo, useState } from "react";

export default function MapExplorerSearch({ onRecord, onParcel, onResults, selectedRecord }) {
  const [districts, setDistricts] = useState([]);
  const [mandals, setMandals] = useState([]);
  const [villages, setVillages] = useState([]);
  const [form, setForm] = useState({ district: "Medchal-Malkajgiri", mandal: "", village: "", survey: "", owner: "" });
  const [loading, setLoading] = useState(false);
  const [loadingHierarchy, setLoadingHierarchy] = useState(false);
  const [error, setError] = useState("");
  const [sourceStatus, setSourceStatus] = useState("Loading GIS hierarchy…");
  const [results, setResults] = useState([]);

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  useEffect(() => { loadHierarchy("district", "", ""); }, []);
  useEffect(() => { if (form.district) loadHierarchy("mandal", form.district, ""); else { setMandals([]); setVillages([]); } }, [form.district]);
  useEffect(() => { if (form.district && form.mandal) loadHierarchy("village", form.district, form.mandal); else setVillages([]); }, [form.district, form.mandal]);

  async function loadHierarchy(level, district, mandal) {
    setLoadingHierarchy(true);
    try {
      const params = new URLSearchParams();
      if (district) params.set("district", district);
      if (mandal) params.set("mandal", mandal);
      const body = await (await fetch(`/api/gis-hierarchy?${params}`)).json();
      setSourceStatus(body.sourceStatus || "GIS hierarchy");
      if (level === "district") setDistricts(body.districts || []);
      if (level === "mandal") setMandals(body.mandals || []);
      if (level === "village") setVillages(body.villages || []);
    } catch {
      setSourceStatus("GIS hierarchy unavailable");
    } finally { setLoadingHierarchy(false); }
  }

  async function searchLand(e) {
    e?.preventDefault();
    if (!form.owner.trim() && !form.survey.trim() && !form.village.trim()) {
      setError("Enter an owner name, survey number, or choose a village.");
      return;
    }
    setLoading(true); setError(""); setResults([]);
    try {
      const params = new URLSearchParams(Object.entries(form).filter(([,v]) => String(v).trim()));
      const res = await fetch(`/api/land-search?${params}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Land search failed");
      setResults(body.records || []);
      onResults?.(body.records || []);
      if (body.records?.[0]) selectRecord(body.records[0]);
      if (!body.records?.length) setError("No matching public GIS records were returned. Try a broader owner name, village, or survey number.");
    } catch (err) { setError(err.message || "Land search failed"); }
    finally { setLoading(false); }
  }

  async function selectRecord(r) {
    try {
      const params = new URLSearchParams({ district: form.district || "", mandal: r.mandal || form.mandal || "", village: r.village || form.village || "", survey: r.surveyNo || "" });
      const res = await fetch(`/api/land-records?${params}`);
      const body = await res.json();
      if (res.ok) {
        onRecord?.({ ...body, focusNonce: Date.now() });
        onParcel?.(body.parcelGeoJSON || null);
        return;
      }
    } catch {}
    onRecord?.({ record: r, focusNonce: Date.now() });
    onParcel?.(null);
  }

  const resultLabel = useMemo(() => results.length ? `${results.length} GIS match${results.length === 1 ? "" : "es"}` : "Owner / survey search", [results.length]);

  return <section className="map-explorer-search">
    <div className="map-search-head">
      <div><p className="eyebrow">GIS SEARCH & FILTERS</p><h3>Find a parcel or owner</h3><span>District → Mandal → Village → Survey, or search by owner name.</span></div>
      <small className={sourceStatus.includes("LIVE") ? "gis-live" : "gis-fallback"}>{sourceStatus}</small>
    </div>
    <form className="map-search-grid" onSubmit={searchLand}>
      <label>District<select value={form.district} onChange={e=>{update("district",e.target.value);update("mandal","");update("village","");}}><option value="">All districts</option>{districts.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
      <label>Mandal<select value={form.mandal} disabled={!form.district || loadingHierarchy} onChange={e=>{update("mandal",e.target.value);update("village","");}}><option value="">All mandals</option>{mandals.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
      <label>Village<select value={form.village} disabled={!form.mandal || loadingHierarchy} onChange={e=>update("village",e.target.value)}><option value="">All villages</option>{villages.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
      <label>Survey / Sub-division<input value={form.survey} onChange={e=>update("survey",e.target.value)} placeholder="123/1"/></label>
      <label>Owner / Pattadar<input value={form.owner} onChange={e=>update("owner",e.target.value)} placeholder="Search owner name"/></label>
      <button className="primary-v4 map-search-submit" disabled={loading}>{loading ? "Searching…" : "Search GIS →"}</button>
    </form>
    <div className="map-search-footer"><span>{resultLabel}</span><span>Live source: Telangana State GIS / TGRAC when available</span></div>
    {error && <div className="map-search-error">{error}</div>}
    {!!results.length && <div className="map-search-results">{results.slice(0,8).map(r=><button key={`${r.id}-${r.surveyNo}`} className={selectedRecord?.record?.surveyNo === r.surveyNo ? "selected" : ""} onClick={()=>selectRecord(r)}><b>Survey {r.surveyNo}</b><span>{r.ownerName || "Owner not returned"}</span><small>{r.village || "Village —"} · {r.mandal || "Mandal —"}</small></button>)}</div>}
  </section>;
}
