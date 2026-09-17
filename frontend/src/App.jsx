import React, { useEffect, useMemo, useState } from "react";
import RealWorldMap from "./components/RealWorldMap";
import FutureScenario from "./components/FutureScenario";
import LandRecords from "./components/LandRecords";
import MapExplorerSearch from "./components/MapExplorerSearch";
import AI from "./components/AI";
import PolicyComparisonMap from "./components/PolicyComparisonMap";
import { regions as fallbackRegions, research as fallbackResearch } from "./data/demo";

const API = "/api";
const tabs = [
  ["home","Overview"],["explore","Land Map & GIS"],["dashboard","Analytics & Reports"],["research","Legal Research"],
  ["ai","AI Evidence"],["policy","Policy Sandbox"],["future","Future City"]
];
const sideTabs = [
  ["home","Overview","⌘"],["explore","Land Map & GIS","▣"],["disputes","Dispute Docket","⚒"],["dashboard","Analytics & Reports","▥"],
  ["governance","Data Governance","▤"],["policy","Policy Sandbox","⚖"],["research","Legal Research","▧"],["admin","Administration","◉"]
];

const beneficiaries = [
  ["Government","Evaluate land-use trends and support policy planning."],
  ["Researchers","Access verified datasets, reports and regional studies."],
  ["Students","Learn spatial analysis and complete academic projects."],
  ["Urban Planners","Study zoning patterns and city expansion needs."]
];

const workflow = [
  ["01","Data Ingestion","Upload public records, reports and maps."],
  ["02","Unified Database","Organize geography, metadata and evidence."],
  ["03","Processing","Map, render, compare and retrieve."],
  ["04","Clean UI","Make complex information understandable."],
  ["05","Decisions","Turn evidence into planning options."]
];

function App(){
  const [view,setView]=useState("home");
  const [region,setRegion]=useState("Hyderabad");
  const [regions,setRegions]=useState(fallbackRegions);
  const [research,setResearch]=useState(fallbackResearch);
  const [apiOnline,setApiOnline]=useState(false);
  const [activeLayer,setActiveLayer]=useState("Land Use");
  const [selectedBuilding,setSelectedBuilding]=useState(null);
  const [mapMode,setMapMode]=useState("3D");
  const [year,setYear]=useState(2026);
  const [historyCompare,setHistoryCompare]=useState(false);
  const [restriction,setRestriction]=useState(20);
  const [simulation,setSimulation]=useState(null);
  const [question,setQuestion]=useState("");
  const [answer,setAnswer]=useState(null);
  const [search,setSearch]=useState("");
  const [researchResults,setResearchResults]=useState(fallbackResearch);
  const [researchMeta,setResearchMeta]=useState({source:"Indexed catalog",live:false,query:""});
  const [researchLoading,setResearchLoading]=useState(false);
  const [dashboardPeriod,setDashboardPeriod]=useState("5 years");
  const [dashboardData,setDashboardData]=useState(null);
  const [researchOpen,setResearchOpen]=useState(null);
  const [parcelGeoJSON,setParcelGeoJSON]=useState(null);
  const [landRecord,setLandRecord]=useState(null);
  const [selectedParcel,setSelectedParcel]=useState(null);
  const [contextBrief,setContextBrief]=useState(null);
  const [areaAnalysis,setAreaAnalysis]=useState(null);
  const [showLogin,setShowLogin]=useState(false);
  const [authMode,setAuthMode]=useState("signin");
  const [authForm,setAuthForm]=useState({name:"",email:"",password:""});
  const [authMessage,setAuthMessage]=useState("");
  const [authUser,setAuthUser]=useState(()=>{try{return JSON.parse(sessionStorage.getItem("bhudrishti_auth_user")||"null")}catch{return null}});
  const [officerMode,setOfficerMode]=useState(()=>sessionStorage.getItem("bhudrishti_officer_mode")==="1");
  const [demoSafe,setDemoSafe]=useState(()=>sessionStorage.getItem("bhudrishti_demo_safe")==="1");
  const [runtimeIssue,setRuntimeIssue]=useState("");

  useEffect(()=>{
    if(demoSafe){
      setRegions(fallbackRegions);
      setResearch(fallbackResearch);
      setResearchResults(fallbackResearch);
      setApiOnline(false);
      return;
    }
    Promise.all([
      fetch(`${API}/regions`).then(r=>r.json()),
      fetch(`${API}/research`).then(r=>r.json())
    ]).then(([r,p])=>{
      setRegions(r.map(x=>({name:x.name,state:x.state,growth:x.urban_growth,agri:x.agricultural_land,pressure:x.development_pressure})));
      setResearch(p);
      setResearchResults(p);
      setApiOnline(true);
    }).catch(()=>setApiOnline(false));
  },[demoSafe]);

  useEffect(()=>{
    const onError=(e)=>setRuntimeIssue(e?.error?.message||e?.message||"A browser error was detected.");
    const onReject=(e)=>setRuntimeIssue(e?.reason?.message||String(e?.reason||"An async operation failed."));
    window.addEventListener("error",onError);
    window.addEventListener("unhandledrejection",onReject);
    return()=>{window.removeEventListener("error",onError);window.removeEventListener("unhandledrejection",onReject);};
  },[]);

  useEffect(()=>{const handler=(e)=>setRegion(e.detail);window.addEventListener("bhudrishti-city-change",handler);return()=>window.removeEventListener("bhudrishti-city-change",handler)},[]);


  const selected=regions.find(r=>r.name===region)||regions[0];

  useEffect(()=>{
    if(demoSafe){setDashboardData(null);return;}
    fetch(`${API}/analytics?region=${encodeURIComponent(region)}&period=${encodeURIComponent(dashboardPeriod)}`)
      .then(r=>r.ok?r.json():Promise.reject())
      .then(setDashboardData).catch(()=>setDashboardData(null));
  },[region,dashboardPeriod,demoSafe]);
  const navigate=(id)=>{setView(id);window.history.replaceState(null,"",`#${id}`);window.scrollTo({top:0,behavior:"smooth"});};
  useEffect(()=>{const h=()=>{const id=window.location.hash.slice(1);if(tabs.some(x=>x[0]===id))setView(id)};h();window.addEventListener("hashchange",h);return()=>window.removeEventListener("hashchange",h)},[]);

  const simulate=async()=>{
    const fallback=()=>setSimulation({baseline:{agriculturalLand:62,residentialArea:24,infrastructureDemand:78,environmentalPressure:81},after:{agriculturalLand:Math.round(62+restriction*.3),residentialArea:Math.max(0,Math.round(24-restriction*.2)),infrastructureDemand:Math.max(0,Math.round(78-restriction*.45)),environmentalPressure:Math.max(0,Math.round(81-restriction*.35))},confidence:"Medium",interpretation:"Prototype scenario output; not an official forecast."});
    if(demoSafe){fallback();return;}
    try{const r=await fetch(`${API}/simulate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({restriction,context:contextBrief})});if(!r.ok)throw new Error("Simulation unavailable");setSimulation(await r.json())}
    catch{fallback();}
  };

  const askAI=async()=>{
    const q=question.trim()||`What are the major land-use changes observed in ${region} over the last few years?`;
    const fallback=()=>setAnswer({q,text:`For ${region}, the platform's demonstration evidence points to urban expansion, infrastructure accessibility and changing land-use pressure as the main signals.${contextBrief?.parcel?.surveyNo?` The active context is survey ${contextBrief.parcel.surveyNo} in ${contextBrief.parcel.village||region}.`:""} Use the linked research records and map layers to inspect the supporting context.`,evidence:["Land-use time series","Regional statistics","Research Hub records","Policy context"],confidence:"Medium",source:"BhuDrishti demonstration dataset",disclaimer:"Prototype grounded-answer demo — not an official government answer."});
    if(demoSafe){fallback();return;}
    try{
      const r=await fetch(`${API}/ai`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:q,region,context:contextBrief})});
      if(!r.ok) throw new Error("AI unavailable");
      setAnswer(await r.json());
    }catch{fallback();}
  };
  const filteredResearch=useMemo(()=>researchResults,[researchResults]);

  const searchResearch=async(queryOverride=search)=>{
    const q=String(queryOverride||"").trim();
    if(!q){ setResearchResults(research); setResearchMeta({source:"Indexed catalog",live:false,query:""}); return; }
    setResearchLoading(true);
    const localSearch=()=>{
      setResearchResults(research.filter(item=>{
        const text=JSON.stringify(item).toLowerCase();
        return q.toLowerCase().split(/\s+/).some(word=>word.length>3 && text.includes(word));
      }));
      setResearchMeta({source:"Indexed catalog fallback",live:false,query:q,note:"Demo-safe local research matching is active; external scholarly search is bypassed."});
    };
    if(demoSafe){localSearch();setResearchLoading(false);return;}
    try{
      const r=await fetch(`${API}/research/search?q=${encodeURIComponent(q)}&region=${encodeURIComponent(region)}`);
      if(!r.ok) throw new Error("Research search unavailable");
      const body=await r.json();
      setResearchResults(body.results||[]);
      setResearchMeta({source:body.source||"Research search",live:!!body.live,query:q,note:body.note||""});
    }catch{localSearch();}
    finally{setResearchLoading(false);}
  };

  return <div className="app-v4">
    <header className="nav-v4">
      <button className="brand-v4" onClick={()=>navigate("home")}><div className="brand-mark-v4">✦</div><div><b>BhuDrishti</b><span>National Digital Platform for Land Governance</span></div></button>
      <nav>{tabs.map(([id,label])=><button key={id} className={view===id?"active":""} onClick={()=>navigate(id)}>{label}</button>)}</nav>
      <div className="nav-right"><button className={`safety-toggle-v52 ${demoSafe?"active":""}`} onClick={()=>{setDemoSafe(v=>{const next=!v;sessionStorage.setItem("bhudrishti_demo_safe",next?"1":"0");return next;});setRuntimeIssue("")}}>{demoSafe?"✓ Demo Safe":"Demo Safe"}</button><button className={`officer-toggle-v51 ${officerMode?"active":""}`} onClick={()=>{setOfficerMode(v=>{const next=!v;sessionStorage.setItem("bhudrishti_officer_mode",next?"1":"0");return next;});}}>{officerMode?"✓ Officer Mode":"Officer Mode"}</button>{authUser?<div className="login-user-v4"><span>{authUser.name||authUser.email}</span><button className="login-v4" onClick={()=>{sessionStorage.removeItem("bhudrishti_auth_user");setAuthUser(null)}}>Logout</button></div>:<button className="login-v4" onClick={()=>{setShowLogin(true);setAuthMessage("");setAuthForm({name:"",email:"",password:""})}}>Login</button>}</div>
    </header>
    {demoSafe&&<div className="demo-safe-banner-v52"><div><b>DEMO SAFE MODE</b><span>External data calls are bypassed where possible. BhuDrishti uses local fallback content so the workflow stays usable if a service is unavailable.</span></div><button onClick={()=>setDemoSafe(false)}>Return to live mode</button></div>}
    {runtimeIssue&&!demoSafe&&<div className="runtime-issue-banner-v52" role="status"><div><b>LIVE SERVICE NOTICE</b><span>{runtimeIssue}</span></div><button onClick={()=>{sessionStorage.setItem("bhudrishti_demo_safe","1");setDemoSafe(true);setRuntimeIssue("")}}>Enable Demo Safe</button><button className="dismiss" onClick={()=>setRuntimeIssue("")}>×</button></div>}

    {showLogin&&<AuthModal mode={authMode} setMode={setAuthMode} setMessage={setAuthMessage} form={authForm} setForm={setAuthForm} message={authMessage} onClose={()=>{setShowLogin(false);setAuthMessage("")}} onLogin={async()=>{
      const name=String(authForm.name||"").trim();
      const email=authForm.email.trim().toLowerCase();
      const password=String(authForm.password||"");
      if(authMode==="register" && name.length<2){setAuthMessage("Enter your name.");return;}
      if(!/^\S+@\S+\.\S+$/.test(email)){setAuthMessage("Enter a valid email address.");return;}
      if(password.length<6){setAuthMessage("Password must be at least 6 characters.");return;}
      setAuthMessage("");
      try{
        const endpoint=authMode==="register"?`${API}/auth/register`:`${API}/auth/login`;
        const payload=authMode==="register"?{name,email,password}:{email,password};
        const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
        const body=await r.json().catch(()=>({}));
        if(!r.ok) throw new Error(body.error||"Request failed.");
        if(authMode==="register"){
          setAuthMode("signin");
          setAuthForm({name:"",email,password:""});
          setAuthMessage("Account created successfully. Log in with the same email and password.");
          return;
        }
        const user={name:body.name||email.split("@")[0],email,token:body.token};
        sessionStorage.setItem("bhudrishti_auth_user",JSON.stringify(user));
        setAuthUser(user);
        setShowLogin(false);
      }catch(err){setAuthMessage(err.message||"Authentication failed.");}
    }} />}

    <div className="governance-layout-v12">
      <aside className="governance-sidebar-v12">
        <button className="sidebar-brand-v12" onClick={()=>navigate("home")}><span>▣</span><div><b>LAND GOVERNANCE</b><strong>Records & Mapping</strong><small>Cadastral workspace</small></div></button>
        <p className="sidebar-label-v12">WORKSPACE</p>
        <div className="sidebar-nav-v12">{sideTabs.map(([id,label,icon])=><button key={id} className={view===id?"active":""} onClick={()=>navigate(id)}><i>{icon}</i><span>{label}</span></button>)}</div>
        <div className="sidebar-divider-v12"/>
        <p className="sidebar-label-v12">INTELLIGENCE</p>
        <button className={view==="ai"?"side-tool active":"side-tool"} onClick={()=>navigate("ai")}>✦ <span>AI Evidence</span></button>
        <button className={view==="future"?"side-tool active":"side-tool"} onClick={()=>navigate("future")}>◇ <span>Future City</span></button>
      </aside>
      <main className="governance-main-v12"><ErrorBoundary>
        {view==="home"&&<Home navigate={navigate} regions={regions} setRegion={setRegion} setContextBrief={setContextBrief} officerMode={officerMode}/>} 
        {view==="explore"&&<Explore region={region} setRegion={setRegion} regions={regions} selected={selected} activeLayer={activeLayer} setActiveLayer={setActiveLayer} mapMode={mapMode} setMapMode={setMapMode} year={year} setYear={setYear} historyCompare={historyCompare} setHistoryCompare={setHistoryCompare} selectedBuilding={selectedBuilding} setSelectedBuilding={setSelectedBuilding} navigate={navigate} parcelGeoJSON={parcelGeoJSON} setParcelGeoJSON={setParcelGeoJSON} landRecord={landRecord} setLandRecord={setLandRecord} selectedParcel={selectedParcel} setSelectedParcel={setSelectedParcel} setQuestion={setQuestion} setSearch={setSearch} setContextBrief={setContextBrief} areaAnalysis={areaAnalysis} setAreaAnalysis={setAreaAnalysis} officerMode={officerMode}/>} 
        {view==="dashboard"&&<Dashboard region={region} selected={selected} period={dashboardPeriod} setPeriod={setDashboardPeriod} regions={regions} data={dashboardData}/>} 
        {view==="research"&&<Research search={search} setSearch={setSearch} filteredResearch={filteredResearch} openRecord={setResearchOpen} searchResearch={searchResearch} loading={researchLoading} meta={researchMeta} navigate={navigate} context={contextBrief}/>} 
        {view==="ai"&&<AI region={region} question={question} setQuestion={setQuestion} answer={answer} askAI={askAI} navigate={navigate} context={contextBrief}/>} 
        {view==="policy"&&<Policy restriction={restriction} setRestriction={setRestriction} simulation={simulation} simulate={simulate} context={contextBrief}/>} 
        {view==="future"&&<FutureScenario region={region} setRegion={setRegion} navigate={navigate}/>} 
                {view==="disputes"&&<GovernancePlaceholder title="Dispute Docket" text="Track land-related disputes, acquisition issues, objections and rectification requests. Each case should be linked to an authoritative record in production." navigate={navigate}/>}
        {view==="governance"&&<GovernancePlaceholder title="Data Governance" text="Show dataset provenance, source authority, update date, spatial coverage, licence, quality checks and verification state for every layer." navigate={navigate}/>}
        {view==="admin"&&<GovernancePlaceholder title="Administration" text="Manage authorised users, data-source connections, audit logs and role-based access. Authentication is intentionally not fabricated in this prototype." navigate={navigate}/>}
      </ErrorBoundary></main>
    </div>
    {researchOpen&&<ResearchModal record={researchOpen} onClose={()=>setResearchOpen(null)}/>}
    <footer className="footer-v4"><span>BhuDrishti · National Land Intelligence</span><span>Land Data · Maps · Research · AI Evidence · Policy Simulation</span><span>Prototype · Source status is shown inside each workspace</span></footer>
  </div>;
}

class ErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state={error:null}; }
  static getDerivedStateFromError(error){ return {error}; }
  componentDidCatch(error){ console.error("BhuDrishti UI error", error); }
  render(){
    if(this.state.error){
      return <div className="error-screen-v34"><div><p className="eyebrow">RECOVERY MODE · NO BLANK SCREEN</p><h1>This workspace hit an error.</h1><p>The rest of BhuDrishti is still available. Reload this workspace, return home, or switch to Demo Safe Mode so the core workflow can continue without depending on external services.</p><div><button className="primary-v4" onClick={()=>window.location.reload()}>Reload workspace</button><button className="secondary-v4" onClick={()=>{this.setState({error:null});window.location.hash="#home";window.location.reload()}}>Open home</button><button className="secondary-v4" onClick={()=>{sessionStorage.setItem("bhudrishti_demo_safe","1");window.location.hash="#home";window.location.reload()}}>Enable Demo Safe</button></div><small>{String(this.state.error?.message||this.state.error)}</small></div></div>
    }
    return this.props.children;
  }
}

function Shell({eyebrow,title,subtitle,children,wide=false,officerMode=false}){return <section className={`page-v4 ${wide?"wide":""}`}><div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1 dangerouslySetInnerHTML={{__html:title}}/></div>{subtitle&&<p className="page-subtitle">{subtitle}</p>}</div>{officerMode&&<div className="officer-banner-v51"><div><b>OFFICER MODE</b><span>Decision-focused workspace · evidence → impact → options</span></div><span className="officer-banner-pill">HUMAN REVIEW REQUIRED</span></div>}{children}</section>}

function Home({navigate,regions,setRegion,setContextBrief,officerMode}){return <Shell eyebrow="NATIONAL DIGITAL PLATFORM FOR LAND GOVERNANCE" title={'One place.<br/><span>One view. Better decisions.</span>'} subtitle="A digital system that brings land data, spatial maps, research, visual analytics and evidence tools together so researchers and government officials can make better land decisions." officerMode={officerMode}>
  <div className="home-grid home-grid-v13"><div className="home-copy"><div className="hero-kicker"><span>WHY THIS PLATFORM</span> SCATTERED INFORMATION → UNIFIED EVIDENCE</div><p>Bring maps, land records, research, analytics and policy evidence into one workspace. BhuDrishti is designed around the questions an officer or researcher actually asks: <b>where is change happening, what evidence supports it, and what decision could follow?</b></p><div className="home-actions"><button className="primary-v4" onClick={()=>navigate("explore")}>Explore Land Map ↗</button><button className="secondary-v4" onClick={()=>navigate("ai")}>Ask AI Evidence →</button></div><div className="home-note"><b>SOURCE-AWARE</b><span>Each workspace labels live, public GIS, indexed, derived and modeled information separately.</span></div></div><div className="home-command-panel"><div className="command-orbit"><span>LAND</span><span>DATA</span><span>EVIDENCE</span><span>POLICY</span><i></i></div><div className="home-command-stats"><div><small>MAP</small><b>GIS</b><span>Real-world spatial context</span></div><div><small>RECORDS</small><b>ROR</b><span>Survey & land-record lookup</span></div><div><small>AI</small><b>Q&A</b><span>Question-specific evidence</span></div><div><small>POLICY</small><b>WHAT-IF</b><span>Scenario comparison</span></div></div></div></div>
  <div className="platform-need-grid"><div><b>Spatial Maps</b><span>GIS and administrative boundaries</span></div><div><b>Government Reports</b><span>Department archives and policies</span></div><div><b>Academic Studies</b><span>Papers and case studies</span></div><div><b>Statistics</b><span>Census and demographics</span></div></div>
  <div className="module-grid-v11">{tabs.slice(1).map(([id,label],i)=><button key={id} onClick={()=>navigate(id)}><span>0{i+1}</span><b>{label}</b><small>{moduleText(id)}</small><em>Open workspace →</em></button>)}</div>
  <DemoScenarioLauncher regions={regions} setRegion={setRegion} setContextBrief={setContextBrief} navigate={navigate}/>
  <div className="section-title-v11"><p className="eyebrow">TARGET BENEFICIARIES</p><h2>Designed for people who need land evidence, not just files.</h2></div>
  <div className="beneficiary-grid-v11">{beneficiaries.map(([a,b],i)=><article key={a}><span>0{i+1}</span><b>{a}</b><p>{b}</p></article>)}</div>
  <div className="workflow-v11"><div className="section-title-v11"><p className="eyebrow">WORKFLOW ARCHITECTURE</p><h2>Data collection → processing → informed human action.</h2></div><div className="workflow-grid-v11">{workflow.map(([n,a,b])=><div key={n}><span>{n}</span><b>{a}</b><small>{b}</small></div>)}</div></div>
  <div className="roadmap-v11"><div><p className="eyebrow">TODAY · LEVEL 2 PROTOTYPE</p><h2>Demonstrated features</h2><p>Interactive map, selected Telangana demo data, dashboard analytics, searchable research records, grounded-answer prototype, policy simulator and a 2D/3D future-city scenario workspace.</p></div><div><p className="eyebrow">FUTURE EXPANSION</p><h2>Scale with authoritative systems</h2><p>All-India coverage · satellite imagery · mobile survey workflows · PostgreSQL/PostGIS · secure government integrations · production RAG/LLM.</p></div></div>
</Shell>}
function moduleText(id){return ({explore:"Hierarchical spatial exploration and mapped evidence.",dashboard:"Key land-use indicators and visual comparisons.",research:"Search papers, reports, datasets and policy records.",ai:"Ask questions and inspect the evidence behind answers.",policy:"Test hypothetical zoning and land-use decisions.",future:"Explore possible future development in 2D and 3D."})[id]||""}

function Explore({region,setRegion,regions,selected,activeLayer,setActiveLayer,mapMode,setMapMode,year,setYear,historyCompare,setHistoryCompare,selectedBuilding,setSelectedBuilding,navigate,parcelGeoJSON,setParcelGeoJSON,landRecord,setLandRecord,selectedParcel,setSelectedParcel,setQuestion,setSearch,setContextBrief,areaAnalysis,setAreaAnalysis,officerMode}){
  const [nearby, setNearby] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState("");

  useEffect(() => {
    const r = selectedParcel?.record;
    if (!r || !Number.isFinite(Number(r.latitude)) || !Number.isFinite(Number(r.longitude))) { setNearby([]); return; }
    let cancelled = false;
    setNearbyLoading(true); setNearbyError("");
    fetch(`/api/nearby-parcels?lat=${encodeURIComponent(r.latitude)}&lng=${encodeURIComponent(r.longitude)}&radius=1500`)
      .then(res => res.json().then(body => ({ok:res.ok, body})))
      .then(({ok,body}) => { if (cancelled) return; if (!ok) throw new Error(body.error || "Nearby parcel lookup failed"); setNearby((body.records || []).filter(x => x.surveyNo !== r.surveyNo).slice(0,8)); })
      .catch(err => { if (!cancelled) { setNearby([]); setNearbyError(err.message || "Nearby parcel lookup failed"); } })
      .finally(() => { if (!cancelled) setNearbyLoading(false); });
    return () => { cancelled = true; };
  }, [selectedParcel]);

  const history = useMemo(() => {
    const growth = Number(selected?.growth || 50);
    const agri = Number(selected?.agri || 50);
    const progress = Math.max(0, Math.min(1, (Number(year) - 2010) / 16));
    const baselinePressure = Math.max(10, Math.min(70, Math.round(18 + growth * 0.30)));
    const pressure = Math.round(baselinePressure + (growth - baselinePressure) * progress);
    const baselineAgri = Math.max(agri, Math.min(95, Math.round(agri + (100 - agri) * 0.22)));
    const agriRetention = Math.round(baselineAgri + (agri - baselineAgri) * progress);
    return {
      progress, baselinePressure, pressure, baselineAgri, agriRetention,
      changeIndex: Math.max(0, Math.round(pressure - baselinePressure)),
      year: Number(year), growth, agri
    };
  }, [selected, year]);

  async function focusNearby(r) {
    try {
      const params = new URLSearchParams({ district: r.district || selectedParcel?.record?.district || "", mandal: r.mandal || "", village: r.village || "", survey: r.surveyNo || "" });
      const res = await fetch(`/api/land-records?${params}`);
      const body = await res.json();
      if (res.ok) {
        setLandRecord({ ...body, focusNonce: Date.now() });
        setSelectedParcel(body);
        setParcelGeoJSON(body.parcelGeoJSON || null);
        return;
      }
    } catch {}
    setLandRecord({ record:r, focusNonce:Date.now() });
    setSelectedParcel({record:r});
  }

  return <Shell wide eyebrow="01 / INTERACTIVE LAND MAP" title={'From national view<br/><span>to local evidence.</span>'} subtitle="Explore a real basemap, search public GIS land records, inspect parcels and compare nearby land context." officerMode={officerMode}>
    <div className="explore-v4 real-explore">
      <div className="explore-toolbar">
        <div className="region-switch-v4">{regions.map(r=><button className={r.name===region?"active":""} key={r.name} onClick={()=>setRegion(r.name)}>{r.name}</button>)}</div>
        <div className="map-toggle"><button className={mapMode==="2D"?"active":""} onClick={()=>setMapMode("2D")}>Map</button><button className={mapMode==="Satellite"?"active":""} onClick={()=>setMapMode("Satellite")}>Satellite</button><button className={mapMode==="3D"?"active":""} onClick={()=>setMapMode("3D")}>3D</button></div>
      </div>
      <MapExplorerSearch onRecord={setLandRecord} onParcel={setParcelGeoJSON} onResults={()=>{}} selectedRecord={selectedParcel}/>
      <div className="real-map-grid">
        <div className="real-map-panel"><RealWorldMap region={region} setRegion={setRegion} selectedBuilding={selectedBuilding} setSelectedBuilding={setSelectedBuilding} mapMode={mapMode} setMapMode={setMapMode} parcelGeoJSON={parcelGeoJSON} focusRecord={landRecord} onSelectedRecord={setSelectedParcel} onParcel={setParcelGeoJSON} historyYear={year} historyGrowth={selected?.growth||50} historyAgri={selected?.agri||50}/></div>
        <aside className="map-info-v4">
          <p className="eyebrow">PROPERTY DETAILS</p><h2>{selectedParcel?.record?.village || region}</h2><span>{selectedParcel?.record?.mandal ? `${selectedParcel.record.mandal} · ` : ""}{selectedParcel?.record?.district || selected?.state || "India"}</span>
          <div className="metric-row"><div><small>Urban growth</small><b>+{selected?.growth}%</b></div><div><small>Agricultural</small><b>{selected?.agri}%</b></div><div><small>Pressure</small><b>{selected?.pressure}</b></div></div>
          <div className="hierarchy-v11"><b>SPATIAL HIERARCHY</b><span>India → State → District → Mandal → Village → Survey</span><small>{selectedParcel?.record?.surveyNo ? `Selected: Survey ${selectedParcel.record.surveyNo}` : `Selected: ${selected?.state} → ${region} → mapped area`}</small></div>
          <div className="selected-land-details-v16">
            <div className="selected-land-head"><div><p>SELECTED PARCEL</p><h3>{selectedParcel?.record?.surveyNo||selectedBuilding?.surveyNo||"Select a parcel"}</h3></div><span>{selectedParcel?.record?.demoOnly?"DEMO":"LIVE"}</span></div>
            <div className="land-detail-grid-v16">
              <div><small>Owner / Pattadar</small><b>{selectedParcel?.record?.ownerName||selectedBuilding?.ownerName||"Not returned"}</b></div>
              <div><small>Father / Husband</small><b>{selectedParcel?.record?.fatherName||"—"}</b></div>
              <div><small>Village</small><b>{selectedParcel?.record?.village||"—"}</b></div>
              <div><small>Mandal</small><b>{selectedParcel?.record?.mandal||"—"}</b></div>
              <div><small>District</small><b>{selectedParcel?.record?.district||"—"}</b></div>
              <div><small>Extent</small><b>{selectedParcel?.record?.extent||"—"}</b></div>
              <div><small>Land use</small><b>{selectedParcel?.record?.landUse||selectedParcel?.record?.landType||"—"}</b></div>
              <div><small>Crop</small><b>{selectedParcel?.record?.classification||selectedParcel?.record?.crop||"—"}</b></div>
              <div><small>Crop variety</small><b>{selectedParcel?.record?.cropVariety||"—"}</b></div>
              <div><small>Irrigation</small><b>{selectedParcel?.record?.irrigationSource||"—"}</b></div>
              <div><small>Soil</small><b>{selectedParcel?.record?.soilType||selectedParcel?.record?.soilStatus||"Not returned"}</b></div>
              <div><small>Soil nutrient</small><b>{selectedParcel?.record?.soilNutrientStatus||"—"}</b></div>
              <div><small>Slope</small><b>{selectedParcel?.record?.slope||"—"}</b></div>
              <div><small>Elevation</small><b>{selectedParcel?.record?.elevation||"—"}</b></div>
              <div><small>PPB</small><b>{selectedParcel?.record?.ppb||"—"}</b></div>
              <div><small>Coordinates</small><b>{selectedParcel?.record?.latitude!==undefined&&selectedParcel?.record?.longitude!==undefined?`${Number(selectedParcel.record.latitude).toFixed(5)}, ${Number(selectedParcel.record.longitude).toFixed(5)}`:"—"}</b></div>
            </div>
            <div className="property-actions"><a href="https://bhubharati.telangana.gov.in/knowLandStatus" target="_blank" rel="noreferrer">View official record ↗</a>{parcelGeoJSON&&<span>✓ Parcel boundary loaded</span>}</div>
            <small className="selected-land-source-v16">Source badge follows the returned record. Map Explorer DEMO contexts are explicitly non-authoritative.</small>
          </div>
          <div className="nearby-parcels-panel"><div className="nearby-head"><div><p>NEARBY PARCELS</p><b>Within 1.5 km</b></div><span>{nearbyLoading ? "Loading…" : nearby.length}</span></div>{nearbyError&&<small className="nearby-error">{nearbyError}</small>}{!nearbyLoading&&!nearby.length&&!nearbyError&&<small className="nearby-empty">Select a live parcel to load nearby public GIS records.</small>}{nearby.map(r=><button key={`${r.id}-${r.surveyNo}`} onClick={()=>focusNearby(r)}><span>Survey {r.surveyNo}</span><b>{r.ownerName||"Owner not returned"}</b><small>{r.village||"—"} · {r.mandal||"—"}</small></button>)}</div>
          <div className="legend-v4"><b>MAP LAYERS</b>{["Land Use","Urban Expansion","Agriculture","Infrastructure","Density","Policy Zones"].map(x=><button key={x} className={activeLayer===x?"active":""} onClick={()=>setActiveLayer(x)}><i/>{x}</button>)}</div>
        </aside>
        </div>
        <IntelligenceContextPanel region={region} selected={selected} parcel={selectedParcel?.record||null} year={year} nearby={nearby} navigate={navigate} setQuestion={setQuestion} setSearch={setSearch} setContextBrief={setContextBrief} areaAnalysis={areaAnalysis} setAreaAnalysis={setAreaAnalysis} />
        <DataConfidencePanel parcel={selectedParcel?.record||null} selected={selected} year={year}/><GovernanceAlertsPanel region={region} selected={selected} parcel={selectedParcel?.record||null}/><AreaComparisonPanel region={region} selected={selected} regions={regions} setRegion={setRegion} navigate={navigate}/>
        <section className="history-analysis-v29">
          <div className="history-analysis-head">
            <div>
              <p className="eyebrow">LAND-CHANGE ANALYSIS</p>
              <h2>See how the modeled land-change state evolves.</h2>
              <p>Drag the year. The map overlay changes with the selected year while the live street/satellite basemap stays current.</p>
            </div>
            <div className="history-year-badge"><span>SELECTED YEAR</span><b>{year}</b><small>2010 → 2026</small></div>
          </div>
          <div className="history-slider-large">
            <div className="history-slider-labels"><span>2010</span><b>{year}</b><span>2026</span></div>
            <input aria-label="Land-change analysis year" type="range" min="2010" max="2026" step="1" value={year} onChange={e=>setYear(+e.target.value)}/>
            <div className="history-slider-ticks-v29"><span>2010</span><span>2015</span><span>2020</span><span>2026</span></div>
          </div>
          <div className="history-metrics-v29">
            <article><span>URBAN PRESSURE</span><b>{history.pressure}</b><small>modeled index</small><i style={{width:`${history.pressure}%`}}/></article>
            <article><span>AGRICULTURAL RETENTION</span><b>{history.agriRetention}%</b><small>modeled proxy</small><i style={{width:`${history.agriRetention}%`}}/></article>
            <article><span>CHANGE INTENSITY</span><b>{history.changeIndex}</b><small>change vs 2010 baseline</small><i style={{width:`${Math.min(100,history.changeIndex*2)}%`}}/></article>
          </div>
          <div className="history-footer-v29">
            <button type="button" className={historyCompare?"active":""} onClick={()=>setHistoryCompare(v=>!v)}>{historyCompare?"Hide 2010 ↔ 2026 comparison":"Compare 2010 ↔ 2026"}</button>
            <div className="history-legend-v29"><span><i className="hist-low"/>Lower change</span><span><i className="hist-mid"/>Moderate</span><span><i className="hist-high"/>Higher change</span></div>
            <small><b>MODELLED:</b> This overlay is a spatial analytical proxy, not historical satellite imagery or an official historical time series.</small>
          </div>
          {historyCompare&&<div className="history-compare-v29">
            <div><small>2010 BASELINE</small><strong>{history.baselinePressure}</strong><span>urban pressure</span><em>{history.baselineAgri}% agricultural retention</em></div>
            <div className="history-compare-arrow">→</div>
            <div><small>{year} ANALYSIS</small><strong>{history.pressure}</strong><span>urban pressure</span><em>{history.agriRetention}% agricultural retention</em></div>
          </div>}
        </section>
        <p className="map-truth-note">Public GIS targets are loaded and clustered for exploration. Selecting a parcel opens its returned details and boundary where the connected source provides them.</p>
      </div>
      <LandRecords onParcel={setParcelGeoJSON} onRecord={setLandRecord} onSelected={setSelectedParcel}/>
  </Shell>
}

function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","":"&quot;","'":"&#39;"}[m]));}

function AreaAnalysisPanel({context,parcel,nearby,onClose}){
  const items=[
    ["LAND", parcel?.landUse||parcel?.landType||"Area context", "Source record / map context"],
    ["DEVELOPMENT", `${context.metrics?.pressure ?? "—"}/100`, "Derived screening signal"],
    ["ENVIRONMENT", `${context.metrics?.flood ?? "—"}/100`, "Derived environmental screen"],
    ["INFRASTRUCTURE", `${context.metrics?.infrastructure ?? "—"}/100`, "Derived demand signal"],
    ["MOBILITY", `${context.metrics?.mobility ?? "—"}/100`, "Derived stress signal"],
    ["PEOPLE", Number(context.metrics?.population||0).toLocaleString(), "Scenario-derived proxy"],
  ];
  const chain=[
    ["01","SOURCE DATA", parcel?.demoOnly?"Map Explorer demo context":"Public GIS / live where returned"],
    ["02","SPATIAL ANALYSIS", "Selected coordinates + parcel / nearby geography"],
    ["03","DERIVED SIGNALS", "Pressure, conversion, environment, infrastructure and mobility"],
    ["04","EVIDENCE", "Research, map layers and policy context can be opened from this location"],
    ["05","DECISION", "Compare scenarios before making a human planning decision"],
  ];
  return <section className="area-analysis-v50"><div className="area-analysis-head-v50"><div><p className="eyebrow">AREA INTELLIGENCE · ANALYSED</p><h2>{parcel?.surveyNo?`Survey ${parcel.surveyNo}`:`${context.region} area`}</h2><p>{parcel?.village||context.region} · analysis generated from the active geographic context.</p></div><button className="analysis-close-v50" onClick={onClose}>Hide analysis</button></div><div className="area-analysis-grid-v50">{items.map(([label,value,note])=><article key={label}><span>{label}</span><b>{value}</b><small>{note}</small></article>)}</div><div className="evidence-chain-v50"><div className="evidence-chain-head-v50"><div><p className="eyebrow">EVIDENCE CHAIN</p><h3>Data → analysis → evidence → decision</h3></div><span>SOURCE-AWARE</span></div><div className="evidence-chain-grid-v50">{chain.map(([n,label,text])=><div key={n}><i>{n}</i><b>{label}</b><small>{text}</small></div>)}</div><p className="evidence-chain-note-v50">Each derived value is labelled as derived or scenario-based. Official records remain the authoritative source for legal ownership and statutory decisions.</p></div><div className="analysis-actions-v50"><button onClick={()=>window.scrollTo({top:document.body.scrollHeight,behavior:"smooth"})}>Review related sections ↓</button><span>{nearby?.length||0} nearby public GIS records available</span></div></section>;}

function IntelligenceContextPanel({region,selected,parcel,year,nearby,navigate,setQuestion,setSearch,setContextBrief,areaAnalysis,setAreaAnalysis}){
  const [whyKey,setWhyKey]=useState("");
  const seedText = `${region}|${parcel?.surveyNo||"area"}|${year}`;
  const seed = [...seedText].reduce((n,c)=>(n*33+c.charCodeAt(0))%1000,17);
  const growth = Number(selected?.growth||50);
  const agri = Number(selected?.agri||50);
  const pressureBase = Number((String(selected?.pressure || "70").match(/\d+/)||["70"])[0]);
  const pressure = Math.max(12,Math.min(99,Math.round((pressureBase*0.75)+(growth*0.35))));
  const conversion = Math.max(8,Math.min(94,Math.round((100-agri)*0.62 + growth*0.2)));
  const flood = 18 + (seed%46);
  const infrastructure = Math.max(15,Math.min(95,Math.round(34 + growth*0.48 + (parcel?8:0))));
  const mobility = Math.max(12,Math.min(96,Math.round(28 + growth*0.55 + (seed%16))));
  const population = 12000 + (seed%36000);
  const jobs = 4500 + (seed%15000);
  const context={region,year,parcel,metrics:{pressure,conversion,flood,infrastructure,mobility,population,jobs},source:'BhuDrishti derived context'};
  const explain=()=>{setContextBrief?.(context); setQuestion?.(parcel?.surveyNo?`Explain the land-use change, development pressure, environmental risks and infrastructure context around survey ${parcel.surveyNo} in ${parcel.village||region}.`: `Explain the land-use change, development pressure, environmental risks and infrastructure context around ${region}.`); navigate('ai');};
  const research=()=>{setContextBrief?.(context); setSearch?.(`land-use change development planning ${parcel?.village||region}`); navigate('research');};
  const policy=()=>{setContextBrief?.(context); navigate('policy');};
  const brief=()=>{
    const title = `${parcel?.surveyNo?`Survey ${parcel.surveyNo}`:`${region} Area`} Decision Brief`;
    const sourceStatus = parcel?.demoOnly ? "MAP EXPLORER DEMO CONTEXT" : "PUBLIC GIS / LIVE WHERE RETURNED";
    const chain = [
      ["Source data", sourceStatus, "Parcel facts follow the returned GIS record when available."],
      ["Spatial analysis", "Map click / parcel context", "Coordinates, nearby parcels and regional indicators are derived from the selected geography."],
      ["Derived signals", `${pressure}/100 pressure · ${conversion}/100 conversion`, "Screening indicators; not statutory classifications or official forecasts."],
      ["Decision use", "Compare options", "Use the evidence and modeled impacts to support human review and planning."],
    ];
    const metrics = [
      ["Urban pressure", pressure], ["Land conversion signal", conversion], ["Environmental screen", flood],
      ["Infrastructure demand", infrastructure], ["Mobility stress", mobility]
    ];
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;margin:40px;color:#10242a;line-height:1.5}h1{margin:0 0 6px;color:#0c6555}h2{margin-top:26px;color:#16434b}table{border-collapse:collapse;width:100%;margin-top:10px}th,td{border:1px solid #d7e1e4;padding:10px;text-align:left;font-size:13px}th{background:#edf7f4}.badge{display:inline-block;padding:5px 8px;border-radius:999px;background:#e8f8f2;color:#17634f;font-weight:700;font-size:11px}.muted{color:#60747a;font-size:12px}.foot{margin-top:28px;padding-top:12px;border-top:1px solid #d7e1e4;color:#60747a;font-size:11px}</style></head><body><span class="badge">BHUDRISHTI · DECISION SUPPORT</span><h1>${escapeHtml(title)}</h1><p class="muted">Location: ${escapeHtml(parcel?.village?parcel.village+', ':'' )}${escapeHtml(region)} · Year context: ${year} · Generated: ${new Date().toLocaleString()}</p><h2>Land context</h2><table><tr><th>Field</th><th>Value</th></tr><tr><td>Survey</td><td>${escapeHtml(parcel?.surveyNo||'Area-level')}</td></tr><tr><td>Owner / Pattadar</td><td>${escapeHtml(parcel?.ownerName||'Not returned')}</td></tr><tr><td>Land use</td><td>${escapeHtml(parcel?.landUse||parcel?.landType||'Not returned')}</td></tr><tr><td>Extent</td><td>${escapeHtml(parcel?.extent||'Not returned')}</td></tr><tr><td>Soil</td><td>${escapeHtml(parcel?.soilType||'Not returned')}</td></tr><tr><td>Irrigation</td><td>${escapeHtml(parcel?.irrigationSource||'Not returned')}</td></tr></table><h2>Derived screening indicators</h2><table><tr><th>Indicator</th><th>Value</th></tr>${metrics.map(([l,v])=>`<tr><td>${escapeHtml(l)}</td><td>${v}/100</td></tr>`).join('')}</table><h2>Evidence chain</h2><table><tr><th>Stage</th><th>Status</th><th>How it is used</th></tr>${chain.map(([a,b,c])=>`<tr><td>${escapeHtml(a)}</td><td>${escapeHtml(b)}</td><td>${escapeHtml(c)}</td></tr>`).join('')}</table><h2>Nearby context</h2><p>${nearby?.length||0} nearby public GIS records were available to the current workspace lookup.</p><div class="foot">BhuDrishti separates source records from derived indicators and modeled scenarios. This brief is decision-support only and is not a legal title, statutory determination, or guaranteed forecast.</div></body></html>`;
    const blob=new Blob([html],{type:'text/html;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`BhuDrishti_${(parcel?.surveyNo||region).replace(/[^a-z0-9_-]+/gi,'_')}_decision_brief.html`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),800);
  };
  const kpis=[["Urban pressure",pressure,"Derived"],["Conversion signal",conversion,"Derived"],["Environment screen",flood,"Derived"],["Infrastructure",infrastructure,"Derived"],["Mobility",mobility,"Derived"]];
  return <section className="intelligence-context-v34">
    <div className="intelligence-head-v34"><div><p className="eyebrow">UNIFIED LAND INTELLIGENCE</p><h2>{parcel?.surveyNo?`Survey ${parcel.surveyNo}`:`${region} area context`} <span>· {year}</span></h2><p>One geographic context shared across map, research, AI, policy and future planning.</p></div><div className="context-badge-v34">{parcel?.demoOnly?'MAP EXPLORER DEMO':'PUBLIC GIS / LIVE WHERE RETURNED'}</div></div>
    <div className="intelligence-grid-v34">
      <article className="dna-card-v34"><div className="card-mini-head-v34"><span>LAND DNA</span><b>{parcel?.surveyNo||'AREA'}</b></div><div className="dna-rows-v34"><div><small>LOCATION</small><b>{parcel?.village||region}</b></div><div><small>LAND USE</small><b>{parcel?.landUse||parcel?.landType||'Area context'}</b></div><div><small>EXTENT</small><b>{parcel?.extent||'Not returned'}</b></div><div><small>SOIL</small><b>{parcel?.soilType||'Not returned'}</b></div><div><small>IRRIGATION</small><b>{parcel?.irrigationSource||'Not returned'}</b></div><div><small>COORDINATES</small><b>{Number.isFinite(Number(parcel?.latitude))?`${Number(parcel.latitude).toFixed(5)}, ${Number(parcel.longitude).toFixed(5)}`:'Map context'}</b></div></div></article>
      <article className="radar-card-v34"><div className="card-mini-head-v34"><span>LAND RISK RADAR</span><b>SCREENING</b></div><div className="risk-list-v34">{kpis.slice(0,3).map(([label,val,tag])=><div key={label}><div className="risk-row-head-v52"><span>{label}</span><button type="button" onClick={()=>setWhyKey(whyKey===label?"":label)} aria-label={`Why am I seeing ${label}?`}>Why?</button></div><b>{val}</b><i><em style={{width:`${val}%`}}/></i><small>{tag} · not a legal determination</small>{whyKey===label&&<div className="why-popover-v52"><b>Why am I seeing this?</b><p>{label==="Urban pressure"?`This is derived from the active area's growth indicator and development-pressure context for ${region}. It helps prioritize review; it is not an official government score.`:label==="Conversion signal"?`This is a screening indicator derived from non-agricultural share and growth pressure in the active context. A high value signals where land-use change may deserve investigation; it does not establish an illegal conversion.`:`This environmental screen is a derived proxy from the active geographic context. It is intended for triage and should be checked against authoritative environmental datasets.`}</p><small>Source type: derived analysis · Review the source data before a decision.</small></div>}</div>)}</div></article>
      <article className="mobility-card-v34"><div className="card-mini-head-v34"><span>PEOPLE + MOBILITY</span><b>AREA MODEL</b></div><div className="mobility-kpis-v34"><div><small>PEOPLE</small><b>{population.toLocaleString()}</b><span>scenario-derived proxy</span></div><div><small>JOBS</small><b>{jobs.toLocaleString()}+</b><span>scenario-derived proxy</span></div><div><small>INFRA</small><b>{infrastructure}</b><span>derived demand</span></div><div><small>MOBILITY</small><b>{mobility}</b><span>derived stress</span></div></div></article>
    </div>
    <div className="intelligence-actions-v34"><button className="analyze-area-primary-v50" onClick={()=>setAreaAnalysis?.(context)}>◉ Analyze This Area</button><button onClick={explain}>✦ Explain this area</button><button onClick={research}>↗ Research this area</button><button onClick={policy}>⚖ Policy Sandbox</button><button onClick={()=>navigate('future')}>◇ Future City</button><button onClick={brief}>⇩ Decision Brief</button><button onClick={()=>setWhyKey(whyKey==="People + Mobility"?"":"People + Mobility")}>Why are these modeled?</button></div>
    {whyKey==="People + Mobility"&&<div className="why-wide-v52"><b>Why are these values modeled?</b><p>People and jobs are scenario-derived proxies for the active area. They are included to help compare demand and mobility pressure, not as census counts or official employment forecasts.</p><small>Source type: modeled proxy · Use verified population/employment datasets for statutory planning.</small></div>}
    {areaAnalysis&&<AreaAnalysisPanel context={areaAnalysis} parcel={parcel} nearby={nearby} onClose={()=>setAreaAnalysis?.(null)} />}
    <div className="intelligence-note-v34"><span>Unified context:</span> map selection feeds the analytical, evidence and scenario workspaces. <b>Derived indicators are clearly marked.</b></div>
  </section>
}


function DataConfidencePanel({parcel,selected,year}){
  const live=!!parcel && !parcel.demoOnly;
  const demo=!!parcel?.demoOnly;
  const items=[
    [live?"VERIFIED / PUBLIC GIS":"MAP EXPLORER DEMO", live?"Live/public source returned":"Synthetic fallback is confined to Map Explorer", live?"Source record should be checked before legal use":"Not an official ownership record", live?"high":"demo"],
    [selected?.name?"CITY INDICATORS":"REGIONAL CONTEXT", "Regional indicators feed the current analytical context", "Derived/computed; not a statutory classification", "derived"],
    ["SPATIAL ANALYSIS", "Coordinates, nearby parcels and map layers", "Derived from the selected geography", "derived"],
    [year>2026?"SCENARIO":year<2026?"HISTORICAL CONTEXT":"PRESENT", year>2026?"Future outputs are modeled":"Historical/current imagery or mapped context", year>2026?"Not an official forecast":"Source availability varies by year", year>2026?"scenario":"source"]
  ];
  return <section className="confidence-panel-v51"><div className="confidence-head-v51"><div><p className="eyebrow">DATA CONFIDENCE & PROVENANCE</p><h2>Know what each signal means.</h2><p>Source type follows the current context; it does not turn derived or modeled values into official records.</p></div><span>TRACEABLE</span></div><div className="confidence-grid-v51">{items.map(([title,body,note,kind])=><article key={title} className={kind}><div className="confidence-badge-v51">{title}</div><b>{body}</b><small>{note}</small></article>)}</div><div className="confidence-legend-v51"><span><i className="verified"/> Verified / public source</span><span><i className="derived"/> Derived indicator</span><span><i className="scenario"/> Scenario / modeled</span><span><i className="demo"/> Demo fallback</span></div></section>;
}

function GovernanceAlertsPanel({region,selected,parcel}){
  const growth=Number(selected?.growth||50);
  const agri=Number(selected?.agri||50);
  const alerts=[
    {level:growth>=88?"HIGH":"WATCH",title:"Urban expansion signal",text:`${region} has a ${growth}/100 growth indicator in this workspace.`,tone:growth>=88?"high":"watch"},
    {level:agri<=35?"HIGH":"WATCH",title:"Agricultural conversion signal",text:`Agricultural share is shown as ${agri}% for the selected city context.`,tone:agri<=35?"high":"watch"},
    {level:"WATCH",title:"Infrastructure pressure",text:"Derived demand should be reviewed alongside roads, transit and planned development.",tone:"watch"},
    {level:"INFO",title:"Source verification",text:parcel?.demoOnly?"This parcel is a Map Explorer demo context; verify official records before action.":"Use the source badge and official record link before legal/statutory decisions.",tone:"info"}
  ];
  return <section className="alerts-panel-v51"><div className="alerts-head-v51"><div><p className="eyebrow">LAND GOVERNANCE ALERT CENTER</p><h2>Signals that deserve attention.</h2></div><span>{alerts.filter(a=>a.level!=="INFO").length} active signals</span></div><div className="alerts-grid-v51">{alerts.map(a=><article key={a.title} className={a.tone}><div><b>{a.level}</b><span>{a.title}</span></div><p>{a.text}</p><small>Screening signal · not a legal determination</small></article>)}</div></section>;
}

function AreaComparisonPanel({region,selected,regions,setRegion,navigate}){
  const options=regions.filter(r=>r.name!==region);
  const [compareCity,setCompareCity]=useState(options[0]?.name||region);
  useEffect(()=>{if(!options.some(r=>r.name===compareCity))setCompareCity(options[0]?.name||region)},[region,options.map(o=>o.name).join("|")]);
  const other=regions.find(r=>r.name===compareCity)||regions[0];
  const metrics=[
    ["Urban growth", Number(selected?.growth||0), Number(other?.growth||0)],
    ["Agricultural share", Number(selected?.agri||0), Number(other?.agri||0)],
    ["Development pressure", Number(String(selected?.pressure||"").match(/\d+/)?.[0]||0), Number(String(other?.pressure||"").match(/\d+/)?.[0]||0)],
  ];
  return <section className="compare-areas-v51"><div className="compare-areas-head-v51"><div><p className="eyebrow">COMPARE TWO AREAS</p><h2>{region} vs another city</h2><p>Compare the same indicators side-by-side using the platform's current city context.</p></div><div className="compare-selector-v51"><label>SECOND CITY</label><select value={compareCity} onChange={e=>setCompareCity(e.target.value)}>{options.map(r=><option key={r.name}>{r.name}</option>)}</select></div></div><div className="compare-cards-v51"><article><span>{region}</span><b>{selected?.state||"India"}</b><small>Primary context</small></article><div className="compare-vs-v51">VS</div><article><span>{other?.name}</span><b>{other?.state||"India"}</b><small>Comparison context</small></article></div><div className="compare-metric-grid-v51">{metrics.map(([label,a,b])=><div key={label}><span>{label}</span><div className="compare-values-v51"><b>{a}</b><i><em style={{width:`${Math.min(100,a)}%`}}/></i><strong>{b}</strong></div><small>{a>b?region:other?.name} shows the higher value in this derived comparison.</small></div>)}</div><div className="compare-actions-v51"><button onClick={()=>{setRegion(compareCity);navigate("explore")}}>Use {compareCity} as primary →</button><button className="secondary-v4" onClick={()=>navigate("dashboard")}>Open analytics comparison ↗</button></div></section>;
}

function DemoScenarioLauncher({regions,setRegion,setContextBrief,navigate}){
  const scenarios=[
    {title:"Urban Expansion",city:"Hyderabad",target:"Explore",description:"Trace growth signals, selected parcels and governance alerts.",action:()=>navigate("explore")},
    {title:"Agricultural Conversion",city:"Bengaluru",target:"Policy Sandbox",description:"Open a city context and test a land-conversion policy scenario.",action:()=>navigate("policy")},
    {title:"Infrastructure Planning",city:"Visakhapatnam",target:"Future City",description:"Move from current context into a future development scenario.",action:()=>navigate("future")}
  ];
  return <section className="demo-scenarios-v51"><div className="demo-scenarios-head-v51"><div><p className="eyebrow">DEMO SCENARIOS</p><h2>Three click-ready stories for the SIH walkthrough.</h2><p>Each scenario preloads a city context and opens the relevant workspace.</p></div><span>FAST START</span></div><div className="demo-scenarios-grid-v51">{scenarios.map(sc=><button key={sc.title} onClick={()=>{setRegion(sc.city);setContextBrief({region:sc.city,year:2026,parcel:null,metrics:{pressure:regions.find(r=>r.name===sc.city)?.growth||0,conversion:Math.max(0,100-(regions.find(r=>r.name===sc.city)?.agri||50)),flood:40,infrastructure:65,mobility:58,population:15000,jobs:6000},source:"Prebuilt demo scenario"});sc.action()}}><div><b>{sc.title}</b><span>{sc.city} · {sc.target}</span></div><p>{sc.description}</p><em>Launch scenario →</em></button>)}</div></section>;
}

function Dashboard({region,selected,period,setPeriod,regions,data}){const d=data||{urbanGrowthIndex:selected?.growth||0,agriculturalShare:selected?.agri||0,builtUpShare:100-(selected?.agri||0),pressureScore:0,pressureLabel:selected?.pressure||"Unknown",infrastructureDemand:0,conversionRisk:0,trend:[]};return <Shell eyebrow="02 / ANALYTICS & REPORTS" title={'Measure what<br/><span>the data actually says.</span>'} subtitle="Choose a city to reframe the analytics workspace. The selector contains cities only; every metric updates to the selected city."><div className="dashboard-toolbar-v11"><div className="dashboard-location-select"><label htmlFor="dashboard-city">CITY</label><select id="dashboard-city" value={region} onChange={e=>window.dispatchEvent(new CustomEvent("bhudrishti-city-change",{detail:e.target.value}))}>{regions.map(r=><option key={r.name} value={r.name}>{r.name}</option>)}</select><span>{selected?.state||"India"}</span></div><div className="period-switch-v11">{["1 year","5 years","10 years"].map(p=><button key={p} className={period===p?"active":""} onClick={()=>setPeriod(p)}>{p}</button>)}</div></div><div className="analytics-accuracy-strip"><span>DATA CHECK</span><b>{d.recordStatus||"Calculated"}</b><small>{d.method||"Derived directly from current city indicators."}</small></div><div className="dashboard-grid-v11"><article className="dash-card-v11 large"><div className="card-head"><span>ANALYTICAL TREND · {region}</span><b>{d.urbanGrowthIndex}%</b></div><div className="bars-v4">{(d.trend||[]).map(point=><div key={point.label} style={{height:`${Math.max(8,Math.min(100,point.value))}%`}}><span>{point.label}</span></div>)}</div><p className="chart-note-v13">Normalized indicator trend for the selected city and period. It is a computed view, not a historical government time series.</p></article><article className="dash-card-v11"><span>LAND COMPOSITION · {region}</span><div className="composition-v13"><div><b>{d.agriculturalShare}%</b><span>Agricultural</span></div><div><b>{d.builtUpShare}%</b><span>Non-agricultural / built-up proxy</span></div></div><div className="composition-bar-v13"><i style={{width:`${d.agriculturalShare}%`}}/></div></article><article className="dash-card-v11"><span>KEY INDICATORS · {region}</span><div className="big-number-v11">{d.urbanGrowthIndex}<small>urban growth index</small></div><div className="big-number-v11">{d.pressureScore}<small>development pressure score</small></div><div className="big-number-v11">{d.infrastructureDemand}<small>derived infrastructure demand</small></div></article><article className="dash-card-v11"><span>GOVERNANCE SIGNALS · {region}</span><div className="signal-row-v11"><b>{d.pressureLabel}</b><span>Development pressure</span></div><div className="signal-row-v11"><b>{d.conversionRisk}%</b><span>Derived conversion-risk indicator</span></div><div className="signal-row-v11"><b>{d.periodMultiplier}×</b><span>Selected reporting window</span></div></article></div><div className="comparison-v11"><div><p className="eyebrow">CITY COMPARISON</p><h2>Compare the same metric across cities.</h2></div>{regions.slice(0,8).map(r=><div className="compare-row-v11" key={r.name}><span>{r.name}</span><i><em style={{width:`${Math.min(100,r.growth)}%`}}/></i><b>{r.growth}</b></div>)}</div></Shell>}

function AuthModal({mode,setMode,setMessage,form,setForm,message,onClose,onLogin}){return <div className="auth-overlay-v4" role="dialog" aria-modal="true" aria-label="BhuDrishti account access"><div className="auth-modal-v4">
  <button className="auth-close-v4" onClick={onClose} aria-label="Close">×</button>
  <p className="eyebrow">BHUDRISHTI ACCESS</p>
  <h2>{mode==="register"?"Create your BhuDrishti account":"Sign in to BhuDrishti"}</h2>
  <p className="auth-note-v4">{mode==="register"?"Create a simple BhuDrishti account with your name, email and password.":"Use the email and password you registered with on BhuDrishti."}</p>
  {mode==="register"&&<label>Name<input value={form.name||""} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Your name" autoComplete="name"/></label>}
  <label>Email<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="you@example.com" autoComplete="username email"/></label>
  <label>Password<input type="password" value={form.password||""} onChange={e=>setForm({...form,password:e.target.value})} placeholder="At least 6 characters" autoComplete={mode==="register"?"new-password":"current-password"}/></label>
  {message&&<div className="auth-message-v4" role="alert">{message}</div>}
  <button className="primary-v4 auth-submit-v4" onClick={onLogin}>{mode==="register"?"Create account →":"Log in →"}</button>
  <button className="secondary-v4" style={{width:"100%",marginTop:10}} onClick={()=>{setMode(mode==="register"?"signin":"register");setForm({name:mode==="register"?"":form.name,email:form.email,password:""});setMessage("")}}>{mode==="register"?"Already have an account? Log in":"New here? Create an account"}</button>
</div></div>}

function Research({search,setSearch,filteredResearch,openRecord,searchResearch,loading,meta,navigate,context}){
  const records=Array.isArray(filteredResearch)?filteredResearch:[];
  const submit=(e)=>{e.preventDefault();searchResearch();};
  const applyContext=()=>{
    if(!context)return;
    const q=`${context.parcel?.surveyNo?`survey ${context.parcel.surveyNo} `:""}${context.parcel?.village||context.region||""} land-use governance planning evidence`.trim();
    setSearch(q); searchResearch(q);
  };
  return <Shell
    eyebrow="04 / LEGAL RESEARCH"
    title={'Research the <br/><span>evidence behind land decisions.</span>'}
    subtitle="Search indexed research, policy records and live scholarly metadata where available. Research records support analysis but do not replace the authoritative publication or legal source."
  >
    {context&&<div className="research-context-v34"><span>ACTIVE CONTEXT</span><b>{context.parcel?.surveyNo?`Survey ${context.parcel.surveyNo}`:context.region||"Selected area"}</b><small>{context.parcel?.village||context.region||"Regional research context"} · derived map context</small><button onClick={applyContext}>Research this area →</button></div>}
    <div className="research-search-v15">
      <form className="research-natural-search" onSubmit={submit}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search laws, land-use change, planning, GIS, governance…" aria-label="Search research" />
        <button className="primary-v4" type="submit" disabled={loading}>{loading?"Searching…":"Search research →"}</button>
        <button className="secondary-v4" type="button" onClick={()=>{setSearch("");searchResearch("")}}>Clear</button>
      </form>
      <div className="research-search-examples-v15">
        {["urban expansion India","land governance reforms","GIS-based land use monitoring"].map(q=><button key={q} type="button" onClick={()=>{setSearch(q);searchResearch(q)}}>{q}</button>)}
      </div>
      <div className="research-source-note-v15"><b>{meta?.live?"LIVE DISCOVERY":"INDEXED CATALOG"}</b><span>{meta?.note||"Results are source-aware; publication text remains the authoritative source for its claims."}</span></div>
    </div>
    <div className="research-filter-note">{records.length} record{records.length===1?"":"s"} shown{meta?.query?` for “${meta.query}”`:""}.</div>
    {records.length===0
      ? <div className="empty-state-v11"><b>No matching research records.</b><p>Try a broader topic such as urban expansion, land governance, planning or GIS.</p></div>
      : <div className="research-grid-v4">{records.map((item,index)=>{
          const r=Array.isArray(item)?{title:item[0],publisher:item[1],year:item[2]}:item||{};
          const title=r.title||`Research record ${index+1}`;
          const publisher=r.publisher||r.source||"Indexed source";
          const year=String(r.year||"—");
          const topic=r.topic||"Land governance";
          const abstract=r.abstract||"Metadata record. Open the source or inspect the record details for how it can support spatial analysis.";
          const url=r.url||r.sourceUrl;
          return <article key={`${title}-${year}-${index}`} className="live-research-card-v15">
            <p className="eyebrow">{r.type||"RESEARCH RECORD"}</p>
            <h3>{title}</h3>
            <div className="research-meta-v13"><span><b>Source</b>{publisher}</span><span><b>Year</b>{year}</span><span><b>Topic</b>{topic}</span></div>
            <p className="research-abstract-v15">{abstract}</p>
            <div className="research-card-actions-v15"><button type="button" onClick={()=>openRecord(r)}>Open details ↗</button>{url&&<a href={url} target="_blank" rel="noreferrer">Open source ↗</a>}</div>
          </article>;
        })}</div>}
    <div className="research-card-actions-v15" style={{marginTop:24}}><button type="button" onClick={()=>navigate("explore")}>← Back to Land Map & GIS</button><button type="button" onClick={()=>navigate("ai")}>Ask AI Evidence →</button></div>
  </Shell>;
}

function ResearchModal({record,onClose}){if(!record)return null;const title=record.title||record[0],publisher=record.publisher||record[1],year=String(record.year||record[2]),type=record.type||"Research record",topic=record.topic||"Land governance",url=record.url||record.sourceUrl;const live=!!record.live;return <div className="modal-backdrop-v13" onClick={onClose}><div className="research-modal-v13" onClick={e=>e.stopPropagation()}><button className="modal-close-v13" onClick={onClose}>×</button><p className="eyebrow">{type.toUpperCase()} {live?"· LIVE SOURCE":"· INDEXED RECORD"}</p><h2>{title}</h2><div className="research-meta-v13"><span><b>Publisher / source</b>{publisher}</span><span><b>Year</b>{year}</span><span><b>Topic</b>{topic}</span></div><div className="research-body-v13"><p>{live?"This metadata was retrieved from a live scholarly discovery service. The publication itself remains the authoritative source for its claims.":"This record is indexed in the BhuDrishti research workspace. It is not presented as an official government publication unless an authoritative source is attached."}</p>{record.abstract&&<p><b>Abstract / summary:</b> {record.abstract}</p>}<p><b>Use in analysis:</b> cross-check research evidence with spatial records, land indicators and applicable government policy before drawing a governance conclusion.</p></div><div className="research-modal-actions-v13">{url?<a href={url} target="_blank" rel="noreferrer">Open source ↗</a>:<span>No source URL stored for this record.</span>}<button onClick={onClose}>Close</button></div></div></div>}

function Policy({restriction,setRestriction,simulation,simulate,context}){const base=simulation?.baseline||{agriculturalLand:62,residentialArea:24,infrastructureDemand:78,environmentalPressure:81};const after=simulation?.after||base;return <Shell eyebrow="05 / WHAT-IF POLICY SIMULATOR" title={'Test a policy<br/><span>before the real world.</span>'} subtitle="Explore a hypothetical land-use rule against the same real geographic context. The map comparison is explicitly modeled and does not change legal parcels or official records."><div className="policy-context-v34"><div><span>ACTIVE CONTEXT</span><b>{context?.parcel?.village || context?.region || "Regional analysis"}</b><small>{context?.parcel?.surveyNo ? `Survey ${context.parcel.surveyNo}` : "No parcel selected"}</small></div><div><span>CURRENT SIGNALS</span><b>{context?.metrics?.pressure ?? "—"} pressure · {context?.metrics?.infrastructure ?? "—"} infra</b><small>Derived screening values, not statutory indicators</small></div></div><div className="policy-v4"><aside><p>STEP 1 · CURRENT STATE</p><h2>Existing land balance</h2><div className="mini-state-v11"><span>Agriculture <b>{base.agriculturalLand}%</b></span><span>Urban built-up <b>{base.residentialArea}%</b></span><span>Forest / other <b>15%</b></span></div><p>STEP 2 · HYPOTHETICAL RULE</p><h2>Restrict agricultural → residential conversion</h2><label>Restriction <b>{restriction}%</b></label><input type="range" min="0" max="50" value={restriction} onChange={e=>setRestriction(+e.target.value)}/><button className="primary-v4 full" onClick={simulate}>Run simulation →</button></aside><div className="scenario-v4"><div><small>STEP 3 · ESTIMATED IMPACT</small><b>AGRICULTURAL LAND<br/>{base.agriculturalLand}% → {after.agriculturalLand}%</b></div><div><small>RESIDENTIAL AREA</small><b>{base.residentialArea}% → {after.residentialArea}%</b></div><div><small>INFRASTRUCTURE DEMAND</small><b>{base.infrastructureDemand}% → {after.infrastructureDemand}%</b></div><div><small>ENVIRONMENTAL PRESSURE</small><b>{base.environmentalPressure}% → {after.environmentalPressure}%</b></div><p>{simulation?.interpretation||"Run the scenario to generate an estimated outcome. Prototype model only."}</p><strong>Decision note:</strong><span>Use this to compare options, not to predict a guaranteed outcome or replace statutory planning processes.</span></div></div><PolicyComparisonMap context={context} restriction={restriction} simulation={simulation} /></Shell>}

function GovernancePlaceholder({title,text,navigate}){return <Shell eyebrow="LAND GOVERNANCE WORKSPACE" title={`${title}<br/><span>Connected to evidence.</span>`} subtitle={text}><div className="governance-placeholder-v12"><div><span>WORKSPACE STATUS</span><b>Ready for authoritative integration</b><p>{text}</p></div><div><b>Recommended record links</b><button onClick={()=>navigate("explore")}>Open Land Map & GIS →</button><button onClick={()=>navigate("research")}>Open Legal Research →</button><button onClick={()=>navigate("ai")}>Ask AI Evidence →</button></div></div></Shell>}


export default App;
