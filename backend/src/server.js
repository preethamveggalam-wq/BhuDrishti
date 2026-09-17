import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import crypto from "crypto";
import nodemailer from "nodemailer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Always load backend/.env, regardless of the terminal working directory.
dotenv.config({ path: path.join(__dirname, "../.env"), override: false });
const dataDir = path.join(__dirname, "../data");
const dataFile = path.join(dataDir, "bhudrishti-data.json");
fs.mkdirSync(dataDir, { recursive: true });

const defaultData = {
  regions: [
    { id: 1, name: "Hyderabad", state: "Telangana", urban_growth: 92, agricultural_land: 38, development_pressure: "Very High", latitude: 17.385, longitude: 78.4867 },
    { id: 2, name: "Bengaluru", state: "Karnataka", urban_growth: 95, agricultural_land: 29, development_pressure: "Very High", latitude: 12.9716, longitude: 77.5946 },
    { id: 3, name: "Mumbai", state: "Maharashtra", urban_growth: 91, agricultural_land: 18, development_pressure: "Very High", latitude: 19.076, longitude: 72.8777 },
    { id: 4, name: "Delhi", state: "Delhi", urban_growth: 89, agricultural_land: 14, development_pressure: "Very High", latitude: 28.6139, longitude: 77.2090 },
    { id: 5, name: "Chennai", state: "Tamil Nadu", urban_growth: 84, agricultural_land: 32, development_pressure: "High", latitude: 13.0827, longitude: 80.2707 },
    { id: 6, name: "Pune", state: "Maharashtra", urban_growth: 86, agricultural_land: 34, development_pressure: "High", latitude: 18.5204, longitude: 73.8567 },
    { id: 7, name: "Kolkata", state: "West Bengal", urban_growth: 72, agricultural_land: 41, development_pressure: "High", latitude: 22.5726, longitude: 88.3639 },
    { id: 8, name: "Ahmedabad", state: "Gujarat", urban_growth: 83, agricultural_land: 37, development_pressure: "High", latitude: 23.0225, longitude: 72.5714 },
    { id: 9, name: "Visakhapatnam", state: "Andhra Pradesh", urban_growth: 78, agricultural_land: 46, development_pressure: "High", latitude: 17.6868, longitude: 83.2185 },
    { id: 10, name: "Warangal", state: "Telangana", urban_growth: 64, agricultural_land: 61, development_pressure: "High", latitude: 18.0, longitude: 79.58 },
    { id: 11, name: "Nizamabad", state: "Telangana", urban_growth: 51, agricultural_land: 73, development_pressure: "Moderate", latitude: 18.6725, longitude: 78.0941 }
  ],
  properties: [
    { id: 1, ulpin: "TG-HYD-1234-5678-9012", region: "Hyderabad", property_type: "Residential", floors: 4, units: 8, area_sq_m: 3200, year_built: 2022, status: "Verified" },
    { id: 2, ulpin: "TG-HYD-8451-2201-7734", region: "Hyderabad", property_type: "Mixed Use", floors: 9, units: 18, area_sq_m: 6150, year_built: 2024, status: "Verified" },
    { id: 3, ulpin: "TG-WGL-4412-9011-5520", region: "Warangal", property_type: "Residential", floors: 3, units: 6, area_sq_m: 2100, year_built: 2021, status: "Verified" }
  ],
  research: [
    { id: 1, title: "Impact of Urban Expansion on Peri-Urban Agriculture in India", publisher: "NITI Aayog", year: 2023, type: "Research Paper", topic: "Urban expansion" },
    { id: 2, title: "Land Governance Reforms for Sustainable Development", publisher: "Ministry of Rural Development", year: 2024, type: "Policy Report", topic: "Land governance" },
    { id: 3, title: "GIS-based Land Use Monitoring in Indian Cities", publisher: "Academic Research Consortium", year: 2023, type: "Research Study", topic: "GIS land-use" },
    { id: 4, title: "Urban Growth, Infrastructure and Land Conversion", publisher: "Planning Research Network", year: 2025, type: "Research Paper", topic: "Infrastructure" }
  ]
};

function loadData() {
  try {
    if (!fs.existsSync(dataFile)) {
      fs.writeFileSync(dataFile, JSON.stringify(defaultData, null, 2));
      return structuredClone(defaultData);
    }
    const parsed = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    return {
      regions: Array.isArray(parsed.regions) ? parsed.regions : structuredClone(defaultData.regions),
      properties: Array.isArray(parsed.properties) ? parsed.properties : structuredClone(defaultData.properties),
      research: Array.isArray(parsed.research) ? parsed.research : structuredClone(defaultData.research)
    };
  } catch {
    return structuredClone(defaultData);
  }
}

function saveData(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

let data = loadData();
const app = express();
const configuredOrigins = String(process.env.FRONTEND_URL || "").split(",").map(v => v.trim().replace(/\/$/, "")).filter(Boolean);
function originAllowed(origin) {
  if (!origin) return true;
  const normalized = String(origin).replace(/\/$/, "");
  if (configuredOrigins.length === 0) return true;
  if (configuredOrigins.includes(normalized)) return true;
  // Vercel creates preview URLs for production branches. Allow those in this
  // prototype deployment so the public frontend does not fail CORS during a
  // deployment transition. Production deployments can tighten this later.
  try {
    const u = new URL(normalized);
    if (u.protocol === "https:" && u.hostname.endsWith(".vercel.app")) return true;
  } catch {}
  return false;
}
app.use(cors({
  origin(origin, callback) {
    if (originAllowed(origin)) return callback(null, true);
    return callback(new Error("CORS origin not allowed"));
  },
  credentials: true,
}));
app.use(express.json());

const authCodes = new Map();
const authSessions = new Map();
const authRate = new Map();
const usersFile = path.join(dataDir, "users.json");

function loadAuthUsers(){
  try {
    if (!fs.existsSync(usersFile)) { fs.writeFileSync(usersFile, JSON.stringify([], null, 2)); return []; }
    const parsed = JSON.parse(fs.readFileSync(usersFile, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function saveAuthUsers(users){ fs.writeFileSync(usersFile, JSON.stringify(users, null, 2)); }
function hashPassword(password, salt=crypto.randomBytes(16).toString("hex")){
  const hash=crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored){
  try {
    const [salt,hashHex]=String(stored).split(":");
    if(!salt||!hashHex) return false;
    const actual=crypto.scryptSync(String(password), salt, 64);
    const expected=Buffer.from(hashHex,"hex");
    return expected.length===actual.length && crypto.timingSafeEqual(actual, expected);
  } catch { return false; }
}

function authUsers(){ return loadAuthUsers(); }

function smtpTransport() {
  const host = String(process.env.SMTP_HOST || "").trim();
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "").trim();
  if (!host || !user || !pass) return null;
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = String(process.env.SMTP_SECURE || (port === 465 ? "true" : "false")).toLowerCase() === "true";
  return nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
}

function emailCodeKey(email) { return String(email || "").trim().toLowerCase(); }
function validEmail(email) { return /^\S+@\S+\.\S+$/.test(email); }

app.post("/api/auth/register", async (req,res)=>{
  const name=String(req.body?.name||"").trim();
  const email=emailCodeKey(req.body?.email);
  const password=String(req.body?.password||"");
  if(name.length<2) return res.status(400).json({error:"Enter your name."});
  if(!validEmail(email)) return res.status(400).json({error:"Enter a valid email address."});
  if(password.length<6) return res.status(400).json({error:"Password must be at least 6 characters."});
  const users=authUsers();
  if(users.some(u=>emailCodeKey(u.email)===email)) return res.status(409).json({error:"An account with this email already exists. Please log in."});
  users.push({id:crypto.randomUUID(),name,email,passwordHash:hashPassword(password),createdAt:new Date().toISOString()});
  saveAuthUsers(users);
  res.json({ok:true,message:"Account created successfully. You can now log in."});
});

app.post("/api/auth/login", async (req,res)=>{
  const email=emailCodeKey(req.body?.email);
  const password=String(req.body?.password||"");
  if(!validEmail(email)||password.length<6) return res.status(400).json({error:"Enter a valid email and password."});
  const user=authUsers().find(u=>emailCodeKey(u?.email)===email);
  if(!user) return res.status(401).json({error:"No BhuDrishti account found for this email. Create an account first."});
  if(!verifyPassword(password,user.passwordHash)) return res.status(401).json({error:"Incorrect password."});
  const token=crypto.randomBytes(32).toString("hex");
  const name=String(user.name||email.split("@")[0]);
  try{ await sendLoginNotice(email,name,"BhuDrishti account"); } catch(error) {
    // Email notifications are optional in simple local auth.
    console.warn("Login notification not sent:", error?.message||error);
  }
  authSessions.set(token,{email,name,createdAt:Date.now(),method:"password"});
  res.json({ok:true,token,email,name});
});

app.post("/api/auth/request-code", async (req, res) => {
  const email = emailCodeKey(req.body?.email);
  if (!validEmail(email)) return res.status(400).json({ error: "Enter a valid email address." });
  const now = Date.now();
  const previous = authRate.get(email) || 0;
  if (now - previous < 45_000) return res.status(429).json({ error: "Please wait before requesting another code." });
  const transporter = smtpTransport();
  if (!transporter) return res.status(503).json({ error: "Email delivery is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS in the backend environment first." });

  const code = String(crypto.randomInt(100000, 1000000));
  authCodes.set(email, { code, expiresAt: now + 10 * 60 * 1000, attempts: 0 });
  authRate.set(email, now);
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  try {
    await transporter.sendMail({
      from,
      to: email,
      subject: "BhuDrishti sign-in verification code",
      text: `Your BhuDrishti verification code is ${code}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0b1b20"><h2>BhuDrishti sign-in</h2><p>Your verification code is:</p><div style="font-size:30px;font-weight:700;letter-spacing:8px">${code}</div><p>This code expires in 10 minutes.</p><p>If you did not request this code, you can ignore this email.</p></div>`,
    });
    res.json({ ok: true, message: "Verification code sent." });
  } catch (error) {
    authCodes.delete(email);
    res.status(502).json({ error: `Email could not be sent: ${error?.message || "SMTP delivery failed"}` });
  }
});

app.post("/api/auth/verify-code", (req, res) => {
  const email = emailCodeKey(req.body?.email);
  const code = String(req.body?.code || "").trim();
  if (!validEmail(email) || !/^\d{6}$/.test(code)) return res.status(400).json({ error: "Email and 6-digit verification code are required." });
  const record = authCodes.get(email);
  if (!record || Date.now() > record.expiresAt) { authCodes.delete(email); return res.status(401).json({ error: "Code expired. Request a new verification code." }); }
  record.attempts += 1;
  if (record.attempts > 5) { authCodes.delete(email); return res.status(429).json({ error: "Too many attempts. Request a new verification code." }); }
  if (record.code !== code) return res.status(401).json({ error: "Incorrect verification code." });
  authCodes.delete(email);
  const token = crypto.randomBytes(24).toString("hex");
  const name = email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  authSessions.set(token, { email, name, createdAt: Date.now() });
  res.json({ ok: true, token, email, name });
});


let lastGeocodeAt = 0;
const geocodeCache = new Map();

app.get("/api/geocode", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.status(400).json({ error: "Query is required" });
  const key = q.toLowerCase();
  if (geocodeCache.has(key)) return res.json(geocodeCache.get(key));
  const wait = 1000 - (Date.now() - lastGeocodeAt);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastGeocodeAt = Date.now();
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`;
    const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "BhuDrishti/11.0 (+https://localhost:5173; SIH land-intelligence project)" } });
    if (!response.ok) return res.status(502).json({ error: "Geocoding service unavailable" });
    const result = await response.json();
    geocodeCache.set(key, result);
    res.json(result);
  } catch {
    res.status(502).json({ error: "Geocoding request failed" });
  }
});



function escSql(value) {
  return String(value || "").trim().replace(/'/g, "''");
}

function toGeoJSON(geometry) {
  if (!geometry?.rings?.length) return null;
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: geometry.rings } };
}

async function arcgisQuery(layerUrl, where, outFields, returnGeometry = false) {
  const params = new URLSearchParams({
    where,
    outFields,
    returnGeometry: String(returnGeometry),
    f: "json",
    outSR: "4326",
    resultRecordCount: "2000"
  });
  const response = await fetch(`${layerUrl}/query?${params.toString()}`, {
    headers: { Accept: "application/json", "User-Agent": "BhuDrishti-SIH-Land-Governance/12.0" }
  });
  if (!response.ok) throw new Error(`ArcGIS HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(body.error.message || "ArcGIS query error");
  return body.features || [];
}

async function arcgisPointQuery(layerUrl, lat, lng, outFields, returnGeometry = false) {
  const params = new URLSearchParams({
    where: "1=1",
    geometry: JSON.stringify({ x: Number(lng), y: Number(lat), spatialReference: { wkid: 4326 } }),
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields,
    returnGeometry: String(returnGeometry),
    f: "json",
    outSR: "4326",
    resultRecordCount: "25"
  });
  const response = await fetch(`${layerUrl}/query?${params.toString()}`, {
    headers: { Accept: "application/json", "User-Agent": "BhuDrishti-SIH-Land-Governance/17.0" }
  });
  if (!response.ok) throw new Error(`ArcGIS HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(body.error.message || "ArcGIS spatial query error");
  return body.features || [];
}

function nearestFeature(features, lat, lng) {
  return features
    .map(f => f.attributes || {})
    .filter(a => safeNumber(a.lat) !== null && safeNumber(a.long) !== null)
    .sort((a,b) => {
      const da = (safeNumber(a.lat)-lat)**2 + (safeNumber(a.long)-lng)**2;
      const db = (safeNumber(b.lat)-lat)**2 + (safeNumber(b.long)-lng)**2;
      return da-db;
    })[0] || null;
}

const reverseGeocodeCache = new Map();

async function reverseGeocodePoint(lat, lng) {
  const key = `${Number(lat).toFixed(5)},${Number(lng).toFixed(5)}`;
  const cached = reverseGeocodeCache.get(key);
  if (cached && Date.now() - cached.time < 10 * 60 * 1000) return cached.value;
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1`;
    const body = await fetchJSON(url, { headers: { "Accept-Language": "en", "User-Agent": "BhuDrishti-SIH-Land-Governance/23.1" } }, 4000);
    const a = body?.address || {};
    const value = {
      displayName: body?.display_name || null,
      village: a.village || a.hamlet || a.suburb || a.neighbourhood || null,
      mandal: a.mandal || a.town || a.city_district || null,
      district: a.state_district || a.district || null,
      state: a.state || null,
      postcode: a.postcode || null
    };
    reverseGeocodeCache.set(key, { time: Date.now(), value });
    if (reverseGeocodeCache.size > 250) reverseGeocodeCache.delete(reverseGeocodeCache.keys().next().value);
    return value;
  } catch {
    return null;
  }
}

const TELANGANA_CADASTRAL_LAYER = "https://tgrac.telangana.gov.in/arcgis/rest/services/LIS_Folder/LandInformationSystem_Query/MapServer/0";
const TELANGANA_LAND_LAYER = "https://tgrac.telangana.gov.in/arcgis/rest/services/LIS_Folder/LandInformationSystem_Query/MapServer/1";
const TELANGANA_FIELD_PARCELS = "https://tgrac.telangana.gov.in/arcgis/rest/services/Agri2/Agriculture2_CropAnalysis_Layers/MapServer/1";
const TELANGANA_SOIL_LAYER = "https://tgrac.telangana.gov.in/arcgis/rest/services/Agri2/Agriculture2_CropAnalysis_Layers/MapServer/20";

async function environmentalAtPoint(lat, lng) {
  let field = null;
  let soil = null;
  try {
    const features = await arcgisPointQuery(TELANGANA_FIELD_PARCELS, lat, lng, "Base_Survey_No,Parcel_No,D_Name,M_Name,V_Name,DMV_Code,Ownership_L_1,Ownership_L_2,Ownership_L_3,Ownership_Code,Elevation_L_1,Elevation_L_2,Elevation_Code,Slope,Slope_Code,Soil_Type,Soil_Code,Soil_Nutrient_Status,Soil_Nutrient_Code,Crop_Suitability,Crop_Suitability_Code,Irrigation_L_1,Irrigation_L_2,Irrigation_L_3,Irrigation_L_4,Irrigation_Code,Agro_Climatic_Zone,ILU_L1", false);
    field = features[0]?.attributes || null;
  } catch {}
  try {
    const features = await arcgisPointQuery(TELANGANA_SOIL_LAYER, lat, lng, "Base_Survey_No,D_Name,M_Name,V_Name,DMV_Code,Soil_Type,Soil_Code", false);
    soil = features[0]?.attributes || null;
  } catch {}
  return { field, soil };
}

function syntheticMapRecord(lat, lng, region) {
  const seed = Math.abs(Math.round((lat * 100000) + (lng * 100000))) % 1000000;
  const owners = ["R. Srinivas Rao", "S. Kavitha", "M. Pradeep Kumar", "P. Narasimha Rao", "A. Lakshmi Devi", "K. Ramesh Kumar", "V. Anitha Rao", "N. Mahesh" ];
  const soils = ["Red Loamy", "Red Sandy Loam", "Black Cotton Soil", "Alluvial Soil", "Sandy Loam", "Red Clay Loam"];
  const uses = ["Agricultural", "Residential", "Commercial", "Mixed Use", "Vacant / Other", "Institutional"];
  const crops = ["Paddy (Kharif)", "Maize", "Cotton", "Vegetables", "No crop recorded", "Groundnut"];
  const irrigations = ["Borewell", "Canal", "Rainfed", "Drip irrigation", "Open well"];
  const mandals = ["Medchal", "Quthbullapur", "Malkajgiri", "Serilingampally", "Shamirpet"];
  const villages = ["Kandlakoya", "Bowrampet", "Kompally", "Dulapally", "Gundlapochampally", "Bachupally"];
  const owner = owners[seed % owners.length];
  const soil = soils[seed % soils.length];
  const landType = uses[seed % uses.length];
  const crop = crops[seed % crops.length];
  const mandal = mandals[seed % mandals.length];
  const village = villages[seed % villages.length];
  const surveyBase = 100 + (seed % 899);
  const sub = 1 + (Math.floor(seed / 7) % 8);
  const extent = (0.55 + ((seed % 260) / 100)).toFixed(2);
  const irrigation = irrigations[seed % irrigations.length];
  const area = 0.00045;
  const dLat = area / 2;
  const dLng = area / 2;
  const parcelGeoJSON = {
    type: "Feature",
    properties: { demo: true, surveyNo: `${surveyBase}/${sub}` },
    geometry: { type: "Polygon", coordinates: [[[lng-dLng,lat-dLat],[lng+dLng,lat-dLat],[lng+dLng,lat+dLat],[lng-dLng,lat+dLat],[lng-dLng,lat-dLat]]] }
  };
  return {
    surveyNo: `${surveyBase}/${sub}`,
    ownerName: owner,
    fatherName: seed % 2 ? "R. Lakshmi Narayana" : "P. Venkatesh",
    village,
    mandal,
    district: region === "Warangal" ? "Hanamkonda" : region === "Nizamabad" ? "Nizamabad" : region === "Visakhapatnam" ? "Visakhapatnam" : "Medchal-Malkajgiri",
    extent: `${extent} Acres`,
    landType,
    classification: landType === "Agricultural" ? "Agricultural Land" : landType,
    crop: landType === "Agricultural" ? crop : "—",
    cropVariety: landType === "Agricultural" ? ["BPT 5204", "DHM 117", "Cotton hybrid", "Local variety"][seed % 4] : "—",
    irrigationSource: landType === "Agricultural" ? irrigation : "Not applicable",
    irrigationDetail: landType === "Agricultural" ? "Field-level irrigation context" : "—",
    organic: seed % 3 === 0 ? "Yes" : "No",
    season: landType === "Agricultural" ? "Kharif / Rabi context" : "—",
    ppb: `PPB${String(120000000 + seed).padStart(9,"0")}`,
    soilType: soil,
    soilCode: `SOIL-${String(100 + (seed % 80))}`,
    soilNutrientStatus: ["Moderate", "Good", "Low", "High"][seed % 4],
    cropSuitability: landType === "Agricultural" ? "Suitable for seasonal crops" : "Not assessed",
    slope: `${(0.5 + (seed % 60) / 10).toFixed(1)}%`,
    elevation: `${520 + (seed % 140)} m`,
    agroClimaticZone: "Telangana Plateau",
    landUse: landType,
    latitude: lat,
    longitude: lng,
    sourceStatus: "MAP EXPLORER · DEMO CONTEXT",
    sourceUrl: "https://tgrac.telangana.gov.in/arcgis/rest/services/LIS_Folder/LandInformationSystem_Query/MapServer",
    soilStatus: "Demo environmental context for map exploration",
    demoOnly: true,
    __parcelGeoJSON: parcelGeoJSON
  };
}



const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const futureEvidenceCache = new Map();

function overpassFeatureToGeoJSON(element) {
  if (!element) return null;
  const tags = element.tags || {};
  const props = {
    osmId: `${element.type}/${element.id}`,
    name: tags.name || tags.ref || tags.project || "Unnamed mapped feature",
    featureType: tags.building || tags.highway || tags.railway || tags.landuse || tags.proposed || tags.planned || tags.construction || "feature",
    status: tags.building === "construction" || tags.highway === "construction" || tags.railway === "construction" || tags.construction ? "UNDER CONSTRUCTION" : "PROPOSED / PLANNED",
    openingDate: tags.opening_date || tags.start_date || null,
    source: tags.source || null,
    sourceDate: tags.check_date || null,
    tags
  };
  if (Array.isArray(element.geometry) && element.geometry.length >= 2) {
    const coords = element.geometry.map(g => [Number(g.lon), Number(g.lat)]).filter(c => c.every(Number.isFinite));
    if (coords.length >= 2) {
      return {
        type: "Feature",
        properties: props,
        geometry: { type: "LineString", coordinates: coords }
      };
    }
  }
  if (Number.isFinite(element.lat) && Number.isFinite(element.lon)) {
    return {
      type: "Feature",
      properties: props,
      geometry: { type: "Point", coordinates: [Number(element.lon), Number(element.lat)] }
    };
  }
  return null;
}

app.get("/api/future-evidence", async (req, res) => {
  const lat = safeNumber(req.query.lat);
  const lng = safeNumber(req.query.lng);
  const radiusKm = Math.max(1, Math.min(8, safeNumber(req.query.radiusKm) || 5));
  if (lat === null || lng === null) return res.status(400).json({ error: "Latitude and longitude are required." });
  const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)},${radiusKm}`;
  const cached = futureEvidenceCache.get(cacheKey);
  if (cached && Date.now() - cached.time < 5 * 60 * 1000) return res.json(cached.value);

  const radius = Math.round(radiusKm * 1000);
  const query = `[out:json][timeout:25];(
    way(around:${radius},${lat},${lng})[building=construction];
    way(around:${radius},${lat},${lng})[highway=construction];
    way(around:${radius},${lat},${lng})[railway=construction];
    way(around:${radius},${lat},${lng})[building=proposed];
    way(around:${radius},${lat},${lng})[highway=proposed];
    way(around:${radius},${lat},${lng})[railway=proposed];
    way(around:${radius},${lat},${lng})[planned];
    relation(around:${radius},${lat},${lng})[building=construction];
    relation(around:${radius},${lat},${lng})[highway=construction];
    relation(around:${radius},${lat},${lng})[railway=construction];
    relation(around:${radius},${lat},${lng})[building=proposed];
    relation(around:${radius},${lat},${lng})[highway=proposed];
    relation(around:${radius},${lat},${lng})[railway=proposed];
  );out geom tags;`;
  try {
    const response = await fetch(OVERPASS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "User-Agent": "BhuDrishti-SIH-Land-Governance/32.0" },
      body: new URLSearchParams({ data: query })
    });
    if (!response.ok) return res.status(502).json({ error: `Overpass HTTP ${response.status}` });
    const body = await response.json();
    const features = (body.elements || []).map(overpassFeatureToGeoJSON).filter(Boolean);
    const value = {
      center: { lat, lng },
      radiusKm,
      fetchedAt: new Date().toISOString(),
      source: "OpenStreetMap via Overpass API",
      sourceUrl: "https://overpass-api.de/api/interpreter",
      features,
      counts: {
        construction: features.filter(f => f.properties?.status === "UNDER CONSTRUCTION").length,
        proposed: features.filter(f => f.properties?.status === "PROPOSED / PLANNED").length,
        total: features.length
      }
    };
    futureEvidenceCache.set(cacheKey, { time: Date.now(), value });
    if (futureEvidenceCache.size > 60) futureEvidenceCache.delete(futureEvidenceCache.keys().next().value);
    res.json(value);
  } catch (error) {
    res.status(502).json({ error: "Future evidence service unavailable", detail: String(error?.message || error) });
  }
});

app.get("/api/map-click", async (req, res) => {
  const lat = safeNumber(req.query.lat);
  const lng = safeNumber(req.query.lng);
  const region = String(req.query.region || "Hyderabad").trim();
  if (lat === null || lng === null) return res.status(400).json({ error: "Latitude and longitude are required." });

  try {
    // Analyse the exact point the user clicked. The click coordinates always
    // remain authoritative for map focus; locality data is resolved fresh for
    // that coordinate instead of reusing the previous selected parcel.
    const clickLocation = await reverseGeocodePoint(lat, lng);
    let landPointFeatures = [];
    try {
      landPointFeatures = await arcgisPointQuery(TELANGANA_LAND_LAYER, lat, lng, "FID,Season,mandName,VillName,PPBNo,BaseSurvey,SubSurveyN,FarmerName,FatherName,CropTypeNa,CropName,CropVariet,T_Extent,TS_Extent,Src_Irriga,IsOrganic,lat,long", true);
    } catch {}
    const landPoint = landPointFeatures[0]?.attributes || null;
    const cadastralFeatures = await arcgisPointQuery(TELANGANA_CADASTRAL_LAYER, lat, lng, "FID,District,Mandal,Village,DMV_1991,V_2011,Base_Syno", true);
    const parcel = cadastralFeatures[0];
    if (parcel) {
      const p = parcel.attributes || {};
      const baseSurveyText = String(p.Base_Syno ?? "").trim();
      const baseSurvey = Number(baseSurveyText);
      const clauses = [];
      if (Number.isFinite(baseSurvey)) clauses.push(`BaseSurvey = ${baseSurvey}`);
      if (p.Mandal) clauses.push(`mandName = '${escSql(p.Mandal)}'`);
      if (p.Village) clauses.push(`VillName = '${escSql(p.Village)}'`);
      let owners = [];
      if (clauses.length) owners = await arcgisQuery(TELANGANA_LAND_LAYER, clauses.join(" AND "), "FID,Season,mandName,VillName,PPBNo,BaseSurvey,SubSurveyN,FarmerName,FatherName,CropTypeNa,CropName,CropVariet,CropSown_E,CropSown_1,T_Extent,TS_Extent,Src_Irriga,HasSeedPro,IsOrganic,lat,long", false);
      const owner = nearestFeature(owners, lat, lng);
      const env = await environmentalAtPoint(lat, lng);
      const f = env.field || {};
      const soil = env.soil || {};
      const ownerBase = owner?.BaseSurvey ?? baseSurveyText;
      const ownerSub = String(owner?.SubSurveyN || "").trim();
      const surveyNo = ownerBase !== "" && ownerBase !== null && ownerBase !== undefined ? (ownerSub ? `${ownerBase}/${ownerSub}` : String(ownerBase)) : (baseSurveyText || null);
      const record = {
        surveyNo, ownerName: owner?.FarmerName || null, fatherName: owner?.FatherName || null,
        village: clickLocation?.village || p.Village || owner?.VillName || f.V_Name || null, mandal: clickLocation?.mandal || p.Mandal || owner?.mandName || f.M_Name || null,
        district: clickLocation?.district || p.District || f.D_Name || null, extent: owner?.T_Extent ?? owner?.TS_Extent ?? null,
        landType: owner?.CropTypeNa || null, classification: owner?.CropName || f.ILU_L1 || null, crop: owner?.CropName || null,
        cropVariety: owner?.CropVariet || null, irrigationSource: owner?.Src_Irriga || f.Irrigation_L_1 || null,
        irrigationDetail: [f.Irrigation_L_2,f.Irrigation_L_3,f.Irrigation_L_4].filter(Boolean).join(" · ") || null,
        organic: owner?.IsOrganic || null, season: owner?.Season || null, ppb: owner?.PPBNo || null,
        soilType: f.Soil_Type || soil.Soil_Type || null, soilCode: f.Soil_Code || soil.Soil_Code || null,
        soilNutrientStatus: f.Soil_Nutrient_Status || null, cropSuitability: f.Crop_Suitability || null,
        slope: f.Slope || null, elevation: [f.Elevation_L_1,f.Elevation_L_2].filter(Boolean).join(" · ") || null,
        agroClimaticZone: f.Agro_Climatic_Zone || null, landUse: f.ILU_L1 || null,
        // Never move the selection to a stale point from an owner table. The
        // marker/popup must remain on the exact coordinate the user clicked.
        latitude: lat, longitude: lng,
        clickedLatitude: lat, clickedLongitude: lng,
        clickedLocation: clickLocation?.displayName || null,
        sourceStatus: owner ? "LIVE · Telangana GIS · CLICK ANALYSED" : "CADASTRAL PARCEL · OWNER NOT RETURNED · CLICK ANALYSED",
        sourceUrl: "https://tgrac.telangana.gov.in/arcgis/rest/services/LIS_Folder/LandInformationSystem_Query/MapServer",
        soilStatus: recordSoilStatus(f, soil)
      };
      const parcelGeoJSON = parcel.geometry ? toGeoJSON(parcel.geometry) : null;
      return res.json({region, record, parcelGeoJSON, fetchedAt:new Date().toISOString(), sourceName:"Telangana State GIS / TGRAC", sourceUrl:record.sourceUrl, officialRecordPortal:"https://bhubharati.telangana.gov.in/knowLandStatus", note:"Live source response for this exact map location."});
    }

    // If the cadastral boundary service does not return a polygon, still use
    // a matching live land-point feature plus environmental spatial context.
    if (landPoint) {
      const env = await environmentalAtPoint(lat, lng);
      const f = env.field || {}; const soil = env.soil || {};
      const liveRecord = {
        surveyNo: landPoint.SubSurveyN ? `${landPoint.BaseSurvey}/${landPoint.SubSurveyN}` : String(landPoint.BaseSurvey || "—"),
        ownerName: landPoint.FarmerName || null, fatherName: landPoint.FatherName || null,
        village: f.V_Name || clickLocation?.village || landPoint.VillName || null,
        mandal: f.M_Name || clickLocation?.mandal || landPoint.mandName || null,
        district: f.D_Name || clickLocation?.district || null,
        extent: landPoint.T_Extent ?? landPoint.TS_Extent ?? null,
        landType: landPoint.CropTypeNa || null, classification: landPoint.CropName || f.ILU_L1 || null,
        crop: landPoint.CropName || null, cropVariety: landPoint.CropVariet || null,
        irrigationSource: landPoint.Src_Irriga || f.Irrigation_L_1 || null, organic: landPoint.IsOrganic || null, ppb: landPoint.PPBNo || null,
        soilType: f.Soil_Type || soil.Soil_Type || null, soilCode: f.Soil_Code || soil.Soil_Code || null,
        soilNutrientStatus: f.Soil_Nutrient_Status || null, cropSuitability: f.Crop_Suitability || null,
        slope: f.Slope || null, elevation: [f.Elevation_L_1,f.Elevation_L_2].filter(Boolean).join(" · ") || null,
        agroClimaticZone: f.Agro_Climatic_Zone || null, landUse: f.ILU_L1 || null,
        latitude: lat, longitude: lng, clickedLatitude: lat, clickedLongitude: lng,
        clickedLocation: clickLocation?.displayName || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        sourceStatus: "LIVE · Telangana GIS · CLICK ANALYSED · POINT RECORD",
        sourceUrl: "https://tgrac.telangana.gov.in/arcgis/rest/services/LIS_Folder/LandInformationSystem_Query/MapServer",
        soilStatus: recordSoilStatus(f, soil)
      };
      return res.json({region, record:liveRecord, parcelGeoJSON:null, fetchedAt:new Date().toISOString(), sourceName:"Telangana State GIS / TGRAC", sourceUrl:liveRecord.sourceUrl, officialRecordPortal:"https://bhubharati.telangana.gov.in/knowLandStatus", note:"Live point record resolved for the exact map click."});
    }
  } catch (err) {
    // Deliberately fall through to a map-explorer-only demo record so the map never becomes empty.
  }

  const clickLocation = await reverseGeocodePoint(lat, lng);
  let env = { field: null, soil: null };
  try { env = await environmentalAtPoint(lat, lng); } catch {}
  const record = syntheticMapRecord(lat, lng, region);
  const f = env.field || {};
  const realVillage = f.V_Name || clickLocation?.village || null;
  const realMandal = f.M_Name || clickLocation?.mandal || null;
  const realDistrict = f.D_Name || clickLocation?.district || null;
  if (realVillage) record.village = realVillage;
  if (realMandal) record.mandal = realMandal;
  if (realDistrict) record.district = realDistrict;
  if (f.Soil_Type) record.soilType = f.Soil_Type;
  if (f.Soil_Code) record.soilCode = f.Soil_Code;
  if (f.Soil_Nutrient_Status) record.soilNutrientStatus = f.Soil_Nutrient_Status;
  if (f.Slope) record.slope = f.Slope;
  if (f.Elevation_L_1 || f.Elevation_L_2) record.elevation = [f.Elevation_L_1,f.Elevation_L_2].filter(Boolean).join(" · ");
  if (f.Agro_Climatic_Zone) record.agroClimaticZone = f.Agro_Climatic_Zone;
  if (f.ILU_L1) { record.landUse = f.ILU_L1; record.landType = f.ILU_L1; }
  record.clickedLocation = clickLocation?.displayName || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  record.demoOnly = true;
  record.latitude = lat;
  record.longitude = lng;
  record.clickedLatitude = lat;
  record.clickedLongitude = lng;
  record.sourceStatus = "MAP EXPLORER · DEMO CONTEXT · CLICK ANALYSED";
  res.json({
    region, record,
    parcelGeoJSON: record.demoOnly ? record.__parcelGeoJSON || null : null,
    fetchedAt: new Date().toISOString(),
    sourceName: "BhuDrishti Map Explorer · Demo Context",
    sourceUrl: "https://tgrac.telangana.gov.in/arcgis/rest/services/LIS_Folder/LandInformationSystem_Query/MapServer",
    officialRecordPortal: "https://bhubharati.telangana.gov.in/knowLandStatus",
    note: "This record is synthetic and is displayed only in the Map Explorer when a live parcel is unavailable. It is not an official land or ownership record."
  });
});

function recordSoilStatus(field, soil) {
  if (field?.Soil_Type || soil?.Soil_Type) return "Returned by Telangana agricultural/soil GIS layer";
  return "No soil value returned for this location by the connected public GIS coverage";
}


const SEARCH_LOCATION_HINTS = {
  kandlakoya: [78.5112, 17.5457],
  bowrampet: [78.4475, 17.5740],
  kompally: [78.4592, 17.5447],
  dulapally: [78.4344, 17.5590],
  gundlapochampally: [78.4764, 17.5788],
  bachupally: [78.3675, 17.5490],
  medchal: [78.4812, 17.6297],
  hyderabad: [78.4867, 17.3850],
  warangal: [79.5941, 17.9784],
  nizamabad: [78.0940, 18.6725],
  visakhapatnam: [83.2185, 17.6868],
  bengaluru: [77.5946, 12.9716]
};

async function resolveSearchLocation({district, mandal, village, survey}) {
  const key = normalizeText(village || mandal || district);
  const hinted = SEARCH_LOCATION_HINTS[key];
  if (hinted) {
    const seed = Math.abs([...String(survey || "").replace(/\\D/g, "")].reduce((n,c)=>n*31+c.charCodeAt(0), 7));
    return [hinted[0] + ((seed % 31) - 15) * 0.00008, hinted[1] + ((Math.floor(seed/31) % 31) - 15) * 0.00008];
  }
  const q = [village, mandal, district, "Telangana", "India"].filter(Boolean).join(", ");
  if (q) {
    try {
      const body = await fetchJSON(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`, {headers:{"Accept-Language":"en"}}, 3500);
      if (body?.[0]?.lat && body?.[0]?.lon) return [Number(body[0].lon), Number(body[0].lat)];
    } catch {}
  }
  const regionHint = SEARCH_LOCATION_HINTS[normalizeText(district)] || SEARCH_LOCATION_HINTS[normalizeText(mandal)] || SEARCH_LOCATION_HINTS.hyderabad;
  const seed = Math.abs([...String(survey || "").replace(/\\D/g, "")].reduce((n,c)=>n*31+c.charCodeAt(0), 11));
  return [regionHint[0] + ((seed % 41) - 20) * 0.00012, regionHint[1] + ((Math.floor(seed/41) % 41) - 20) * 0.00012];
}

app.get("/api/land-records", async (req, res) => {
  const district = String(req.query.district || "").trim();
  const mandal = String(req.query.mandal || "").trim();
  const village = String(req.query.village || "").trim();
  const survey = String(req.query.survey || "").trim();
  if (!survey) return res.status(400).json({ error: "Survey / sub-division number is required." });

  const match = survey.match(/^(\d+(?:\.\d+)?)(?:\s*[\/-]\s*(.+))?$/);
  const baseSurvey = match ? Number(match[1]) : null;
  const subSurvey = match?.[2]?.trim() || "";
  if (baseSurvey === null || Number.isNaN(baseSurvey)) return res.status(400).json({ error: "Use a valid survey number such as 123 or 123/1." });

  const ownerLayer = "https://tgrac.telangana.gov.in/arcgis/rest/services/LIS_Folder/LandInformationSystem_Query/MapServer/1";
  const parcelLayer = "https://tgrac.telangana.gov.in/arcgis/rest/services/LIS_Folder/LandInformationSystem_Query/MapServer/0";
  const ownerFields = "FID,Season,mandName,ClusterNam,DMV91,DMV2011,VillName,PPBNo,BaseSurvey,SubSurveyN,FarmerName,FatherName,CropTypeNa,CropName,CropVariet,CropSown_E,CropSown_1,T_Extent,TS_Extent,Src_Irriga,HasSeedPro,IsOrganic,lat,long";

  const sameText = (a, b) => String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
  const normalizeSub = (v) => String(v ?? "").trim().replace(/^0+(?=\d)/, "").replace(/\.0+$/, "").toLowerCase();
  const pickLandFeature = (features) => {
    const attrs = features.map(x => x.attributes || {});
    const subMatches = subSurvey
      ? attrs.filter(a => normalizeSub(a.SubSurveyN) === normalizeSub(subSurvey))
      : attrs;
    const localityMatches = subMatches.filter(a =>
      (!mandal || sameText(a.mandName, mandal)) &&
      (!village || sameText(a.VillName, village))
    );
    return (localityMatches[0] || subMatches[0] || attrs[0] || null);
  };

  try {
    // Query by BaseSurvey first, then resolve mandal/village/sub-division in JavaScript.
    // This is more tolerant of capitalization and public GIS variations such as 7 vs 7.0.
    let features = await arcgisQuery(ownerLayer, `BaseSurvey = ${baseSurvey}`, ownerFields, false);
    let f = pickLandFeature(features);
    if (!f && (mandal || village || subSurvey)) {
      // One broader retry is useful when the public service temporarily rejects a complex where-clause.
      features = await arcgisQuery(ownerLayer, `BaseSurvey = ${baseSurvey}`, ownerFields, false);
      f = pickLandFeature(features);
    }
    if (!f) {
      // Map Explorer-only fallback: keep the spatial workflow usable even when the public
      // GIS does not return the exact survey. This is explicitly marked DEMO and is never
      // used by the authoritative-record status elsewhere in the platform.
      const [demoLng, demoLat] = await resolveSearchLocation({district, mandal, village, survey});
      const demo = syntheticMapRecord(demoLat, demoLng, district || "Hyderabad");
      demo.surveyNo = survey;
      if (demo.__parcelGeoJSON?.properties) demo.__parcelGeoJSON.properties.surveyNo = survey;
      demo.village = village || demo.village;
      demo.mandal = mandal || demo.mandal;
      demo.district = district || demo.district;
      demo.sourceStatus = "MAP EXPLORER · DEMO SEARCH CONTEXT";
      demo.sourceUrl = "https://tgrac.telangana.gov.in/arcgis/rest/services/LIS_Folder/LandInformationSystem_Query/MapServer";
      demo.demoOnly = true;
      return res.json({
        record: demo,
        parcelGeoJSON: demo.__parcelGeoJSON,
        fetchedAt: new Date().toISOString(),
        sourceName: "BhuDrishti Map Explorer · Demo Context",
        sourceUrl: demo.sourceUrl,
        officialRecordPortal: "https://bhubharati.telangana.gov.in/knowLandStatus",
        note: "No exact public GIS feature was returned, so the Map Explorer created a clearly labelled DEMO spatial context for the entered search."
      });
    }

    const parcelWhere = `Base_Syno = '${escSql(String(Math.trunc(baseSurvey)))}'` + (district ? ` AND District = '${escSql(district)}'` : "") + (mandal ? ` AND Mandal = '${escSql(mandal)}'` : "") + (village ? ` AND Village = '${escSql(village)}'` : "");
    let parcelFeatures = [];
    try { parcelFeatures = await arcgisQuery(parcelLayer, parcelWhere, "FID,District,Mandal,Village,DMV_1991,V_2011,Base_Syno", true); } catch {}

    const r = {
      surveyNo: subSurvey ? `${f.BaseSurvey}/${f.SubSurveyN}` : String(f.BaseSurvey),
      ownerName: f.FarmerName,
      fatherName: f.FatherName,
      village: f.VillName,
      mandal: f.mandName,
      district: district || undefined,
      ppb: f.PPBNo,
      extent: f.T_Extent ?? f.TS_Extent,
      landType: f.CropTypeNa || undefined,
      classification: f.CropName || undefined,
      landStatus: f.Season || undefined,
      mutation: undefined,
      khata: undefined,
      irrigationSource: f.Src_Irriga,
      crop: f.CropName,
      cropVariety: f.CropVariet,
      organic: f.IsOrganic,
      latitude: f.lat,
      longitude: f.long
    };
    try {
      const env = await environmentalAtPoint(Number(f.lat), Number(f.long));
      const ef = env.field || {}, es = env.soil || {};
      r.soilType = ef.Soil_Type || es.Soil_Type || undefined;
      r.soilCode = ef.Soil_Code || es.Soil_Code || undefined;
      r.soilNutrientStatus = ef.Soil_Nutrient_Status || undefined;
      r.slope = ef.Slope || undefined;
      r.elevation = [ef.Elevation_L_1, ef.Elevation_L_2].filter(Boolean).join(" · ") || undefined;
      r.agroClimaticZone = ef.Agro_Climatic_Zone || undefined;
      r.landUse = ef.ILU_L1 || undefined;
    } catch {}
    const parcelGeoJSON = parcelFeatures[0] ? toGeoJSON(parcelFeatures[0].geometry) : null;
    res.json({
      record: r,
      parcelGeoJSON,
      fetchedAt: new Date().toISOString(),
      sourceName: "Telangana State GIS / TRAC · Land Information System",
      sourceUrl: "https://tgrac.telangana.gov.in/arcgis/rest/services/LIS_Folder/LandInformationSystem_Query/MapServer",
      officialRecordPortal: "https://bhubharati.telangana.gov.in/knowLandStatus",
      note: "Returned fields are limited to the public GIS response. For legally authoritative Record of Rights verification, use the official Bhu Bharati service."
    });
  } catch (err) {
    res.status(502).json({ error: `Live Telangana GIS lookup failed: ${err.message}` });
  }
});


const REGION_BBOX = {
  Hyderabad: { minLat: 17.20, maxLat: 17.62, minLng: 78.20, maxLng: 78.75 },
  Warangal: { minLat: 17.75, maxLat: 18.20, minLng: 79.35, maxLng: 79.90 },
  Nizamabad: { minLat: 18.45, maxLat: 18.90, minLng: 77.85, maxLng: 78.35 },
  Visakhapatnam: { minLat: 17.45, maxLat: 17.90, minLng: 82.85, maxLng: 83.45 },
  Bengaluru: { minLat: 12.75, maxLat: 13.15, minLng: 77.35, maxLng: 77.85 }
};

function safeNumber(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }

async function queryNearbyLandRecords(region, limit = 36) {
  const box = REGION_BBOX[region] || REGION_BBOX.Hyderabad;
  const ownerLayer = "https://tgrac.telangana.gov.in/arcgis/rest/services/LIS_Folder/LandInformationSystem_Query/MapServer/1";
  const where = `lat >= ${box.minLat} AND lat <= ${box.maxLat} AND long >= ${box.minLng} AND long <= ${box.maxLng}`;
  const features = await arcgisQuery(
    ownerLayer,
    where,
    "FID,Season,mandName,DMV91,DMV2011,VillName,PPBNo,BaseSurvey,SubSurveyN,FarmerName,FatherName,CropTypeNa,CropName,CropVariet,CropSown_E,CropSown_1,T_Extent,TS_Extent,Src_Irriga,HasSeedPro,IsOrganic,lat,long",
    false
  );
  const records = features.map((feature, index) => {
    const a = feature.attributes || {};
    const lat = safeNumber(a.lat), lng = safeNumber(a.long);
    if (lat === null || lng === null || a.BaseSurvey === null || a.BaseSurvey === undefined) return null;
    const sub = String(a.SubSurveyN || "").trim();
    return {
      id: `live-${a.FID ?? index}`,
      surveyNo: sub ? `${a.BaseSurvey}/${sub}` : String(a.BaseSurvey),
      ownerName: a.FarmerName || null,
      fatherName: a.FatherName || null,
      village: a.VillName || null,
      mandal: a.mandName || null,
      ppb: a.PPBNo || null,
      extent: a.T_Extent ?? a.TS_Extent ?? null,
      landType: a.CropTypeNa || null,
      classification: a.CropName || null,
      crop: a.CropName || null,
      cropVariety: a.CropVariet || null,
      irrigationSource: a.Src_Irriga || null,
      organic: a.IsOrganic || null,
      season: a.Season || null,
      latitude: lat,
      longitude: lng,
      sourceStatus: "LIVE · Telangana GIS",
      sourceUrl: ownerLayer,
      soilType: null,
      soilStatus: "Not returned by the public Telangana land-record layer for this feature"
    };
  }).filter(Boolean);
  return records.slice(0, Math.max(1, Math.min(100, Number(limit) || 80)));
}


const HIERARCHY_FALLBACK = {
  districts: ["Adilabad","Bhadradri Kothagudem","Hanamkonda","Hyderabad","Jagtial","Jangaon","Jayashankar Bhupalpally","Jogulamba Gadwal","Kamareddy","Karimnagar","Khammam","Komaram Bheem Asifabad","Mahabubabad","Mahbubnagar","Mancherial","Medak","Medchal-Malkajgiri","Mulugu","Nagarkurnool","Nalgonda","Narayanpet","Nirmal","Nizamabad","Peddapalli","Rajanna Sircilla","Rangareddy","Sangareddy","Siddipet","Suryapet","Vikarabad","Wanaparthy","Warangal","Yadadri Bhuvanagiri"],
  mandals: ["Medchal","Quthbullapur","Malkajgiri","Shamirpet","Keesara","Ghatkesar","Bachupally","Dundigal Gandimaisamma","Kukatpally","Alwal"],
  villages: ["Kandlakoya","Kompally","Bowrampet","Dulapally","Gundlapochampally","Bachupally","Medchal","Shamirpet"]
};

async function distinctArcgisField(layerUrl, field, where = "1=1") {
  const params = new URLSearchParams({
    where, outFields: field, returnGeometry: "false", returnDistinctValues: "true",
    orderByFields: field, f: "json", resultRecordCount: "2000"
  });
  const response = await fetch(`${layerUrl}/query?${params.toString()}`, { headers: { Accept: "application/json", "User-Agent": "BhuDrishti-SIH-Land-Governance/23.0" } });
  if (!response.ok) throw new Error(`ArcGIS HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(body.error.message || "ArcGIS distinct-value query error");
  return (body.features || []).map(f => f.attributes?.[field]).filter(v => v !== null && v !== undefined && String(v).trim()).map(String);
}

app.get("/api/gis-hierarchy", async (req, res) => {
  const district = String(req.query.district || "").trim();
  const mandal = String(req.query.mandal || "").trim();
  try {
    const whereParts = [];
    if (district) whereParts.push(`District = '${escSql(district)}'`);
    if (mandal) whereParts.push(`Mandal = '${escSql(mandal)}'`);
    const where = whereParts.join(" AND ") || "1=1";
    if (!district) {
      const districts = [...new Set(await distinctArcgisField(TELANGANA_CADASTRAL_LAYER, "District"))].sort();
      return res.json({ level: "district", districts, sourceStatus: "LIVE · Telangana GIS" });
    }
    if (!mandal) {
      const mandals = [...new Set(await distinctArcgisField(TELANGANA_CADASTRAL_LAYER, "Mandal", `District = '${escSql(district)}'`))].sort();
      return res.json({ level: "mandal", district, mandals, sourceStatus: "LIVE · Telangana GIS" });
    }
    const villages = [...new Set(await distinctArcgisField(TELANGANA_CADASTRAL_LAYER, "Village", where))].sort();
    return res.json({ level: "village", district, mandal, villages, sourceStatus: "LIVE · Telangana GIS" });
  } catch (err) {
    const level = !district ? "district" : !mandal ? "mandal" : "village";
    if (level === "district") return res.json({ level, districts: HIERARCHY_FALLBACK.districts, sourceStatus: "UI fallback · live GIS unavailable" });
    if (level === "mandal") return res.json({ level, district, mandals: HIERARCHY_FALLBACK.mandals, sourceStatus: "UI fallback · live GIS unavailable" });
    return res.json({ level, district, mandal, villages: HIERARCHY_FALLBACK.villages, sourceStatus: "UI fallback · live GIS unavailable" });
  }
});

function mapOwnerFeature(feature, index = 0) {
  const a = feature.attributes || {};
  const lat = safeNumber(a.lat), lng = safeNumber(a.long);
  if (lat === null || lng === null) return null;
  const sub = String(a.SubSurveyN || "").trim();
  return {
    id: `search-${a.FID ?? index}`,
    surveyNo: sub ? `${a.BaseSurvey}/${sub}` : String(a.BaseSurvey ?? "—"),
    ownerName: a.FarmerName || null, fatherName: a.FatherName || null,
    village: a.VillName || null, mandal: a.mandName || null,
    district: null, ppb: a.PPBNo || null, extent: a.T_Extent ?? a.TS_Extent ?? null,
    landType: a.CropTypeNa || null, classification: a.CropName || null, crop: a.CropName || null,
    cropVariety: a.CropVariet || null, irrigationSource: a.Src_Irriga || null, organic: a.IsOrganic || null,
    season: a.Season || null, latitude: lat, longitude: lng,
    sourceStatus: "LIVE · Telangana GIS", sourceUrl: TELANGANA_LAND_LAYER
  };
}

app.get("/api/land-search", async (req, res) => {
  const owner = String(req.query.owner || "").trim();
  const survey = String(req.query.survey || "").trim();
  const district = String(req.query.district || "").trim();
  const mandal = String(req.query.mandal || "").trim();
  const village = String(req.query.village || "").trim();
  if (!owner && !survey && !village) return res.status(400).json({ error: "Enter an owner name, survey number or village." });
  const clauses = [];
  if (owner) clauses.push(`FarmerName LIKE '%${escSql(owner)}%'`);
  if (survey) {
    const match = survey.match(/^(\d+(?:\.\d+)?)(?:\s*[\/-]\s*(.+))?$/);
    if (match) {
      clauses.push(`BaseSurvey = ${Number(match[1])}`);
      if (match[2]) clauses.push(`SubSurveyN = '${escSql(match[2].trim())}'`);
    }
  }
  if (mandal) clauses.push(`mandName = '${escSql(mandal)}'`);
  if (village) clauses.push(`VillName = '${escSql(village)}'`);
  try {
    const features = await arcgisQuery(TELANGANA_LAND_LAYER, clauses.join(" AND ") || "1=1", "FID,Season,mandName,VillName,PPBNo,BaseSurvey,SubSurveyN,FarmerName,FatherName,CropTypeNa,CropName,CropVariet,T_Extent,TS_Extent,Src_Irriga,IsOrganic,lat,long", false);
    const records = features.map(mapOwnerFeature).filter(Boolean).slice(0, 100);
    return res.json({ records, count: records.length, sourceStatus: "LIVE · Telangana GIS", sourceUrl: TELANGANA_LAND_LAYER });
  } catch (err) {
    // Map Explorer-only fallback: the public Telangana endpoint can be unavailable
    // from a user's network. Keep the Explore Map search usable with an explicitly
    // labelled demo result instead of returning a dead "fetch failed" state.
    const [demoLng, demoLat] = await resolveSearchLocation({ district, mandal, village, survey });
    const demo = syntheticMapRecord(demoLat, demoLng, district || "Hyderabad");
    if (survey) demo.surveyNo = survey;
    if (owner) demo.ownerName = owner;
    if (village) demo.village = village;
    if (mandal) demo.mandal = mandal;
    if (district) demo.district = district;
    demo.latitude = demoLat;
    demo.longitude = demoLng;
    demo.clickedLatitude = demoLat;
    demo.clickedLongitude = demoLng;
    demo.sourceStatus = "MAP EXPLORER · DEMO SEARCH CONTEXT · LIVE GIS UNAVAILABLE";
    demo.sourceUrl = TELANGANA_LAND_LAYER;
    demo.demoOnly = true;
    if (demo.__parcelGeoJSON?.properties) demo.__parcelGeoJSON.properties.surveyNo = demo.surveyNo;
    return res.json({
      records: [demo],
      count: 1,
      sourceStatus: "MAP EXPLORER · DEMO SEARCH CONTEXT · LIVE GIS UNAVAILABLE",
      sourceUrl: TELANGANA_LAND_LAYER,
      demoOnly: true,
      note: `The live Telangana GIS search was unavailable (${err.message}). This clearly labelled DEMO result is only for Map Explorer testing; it is not an official land or ownership record.`
    });
  }
});

app.get("/api/nearby-parcels", async (req, res) => {
  const lat = safeNumber(req.query.lat), lng = safeNumber(req.query.lng);
  const radius = Math.max(250, Math.min(5000, safeNumber(req.query.radius) || 1500));
  if (lat === null || lng === null) return res.status(400).json({ error: "Latitude and longitude are required." });
  try {
    const params = new URLSearchParams({
      where: "1=1", geometry: JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }),
      geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects",
      distance: String(radius), units: "esriSRUnit_Meter", outFields: "FID,Season,mandName,VillName,PPBNo,BaseSurvey,SubSurveyN,FarmerName,FatherName,CropTypeNa,CropName,CropVariet,T_Extent,TS_Extent,Src_Irriga,IsOrganic,lat,long",
      returnGeometry: "false", f: "json", outSR: "4326", resultRecordCount: "100"
    });
    const response = await fetch(`${TELANGANA_LAND_LAYER}/query?${params.toString()}`, { headers: { Accept: "application/json", "User-Agent": "BhuDrishti-SIH-Land-Governance/23.0" } });
    if (!response.ok) throw new Error(`ArcGIS HTTP ${response.status}`);
    const body = await response.json();
    if (body.error) throw new Error(body.error.message || "Nearby parcel query failed");
    const records = (body.features || []).map(mapOwnerFeature).filter(Boolean).sort((a,b)=>((a.latitude-lat)**2+(a.longitude-lng)**2)-((b.latitude-lat)**2+(b.longitude-lng)**2)).slice(0,100);
    res.json({ records, radiusMeters: radius, sourceStatus: "LIVE · Telangana GIS", sourceUrl: TELANGANA_LAND_LAYER });
  } catch (err) { res.status(502).json({ error: `Nearby parcel search failed: ${err.message}` }); }
});

app.get("/api/land-parcels", async (req, res) => {
  const region = String(req.query.region || "Hyderabad").trim();
  try {
    const records = await queryNearbyLandRecords(region, req.query.limit);
    res.json({ region, records, fetchedAt: new Date().toISOString(), sourceName: "Telangana State GIS / TRAC · Land Information System" });
  } catch (err) {
    res.status(502).json({ error: `Live Telangana GIS parcel feed failed: ${err.message}` });
  }
});

app.get("/api/land-point", async (req, res) => {
  const lat = safeNumber(req.query.lat), lng = safeNumber(req.query.lng);
  const region = String(req.query.region || "Hyderabad").trim();
  if (lat === null || lng === null) return res.status(400).json({ error: "Latitude and longitude are required." });
  try {
    const boxSize = 0.018;
    const where = `lat >= ${lat-boxSize} AND lat <= ${lat+boxSize} AND long >= ${lng-boxSize} AND long <= ${lng+boxSize}`;
    const ownerLayer = "https://tgrac.telangana.gov.in/arcgis/rest/services/LIS_Folder/LandInformationSystem_Query/MapServer/1";
    const features = await arcgisQuery(ownerLayer, where, "FID,Season,mandName,VillName,PPBNo,BaseSurvey,SubSurveyN,FarmerName,FatherName,CropTypeNa,CropName,CropVariet,T_Extent,TS_Extent,Src_Irriga,IsOrganic,lat,long", false);
    const ranked = features.map(f => f.attributes || {}).filter(a => safeNumber(a.lat)!==null && safeNumber(a.long)!==null).sort((a,b)=>{
      const da=(safeNumber(a.lat)-lat)**2+(safeNumber(a.long)-lng)**2;
      const db=(safeNumber(b.lat)-lat)**2+(safeNumber(b.long)-lng)**2;
      return da-db;
    });
    const a = ranked[0];
    if (!a) return res.status(404).json({ error: "No public land-record feature was returned near this map point." });
    const sub=String(a.SubSurveyN||"").trim();
    res.json({
      region,
      record:{
        surveyNo:sub?`${a.BaseSurvey}/${sub}`:String(a.BaseSurvey), ownerName:a.FarmerName||null, fatherName:a.FatherName||null,
        village:a.VillName||null, mandal:a.mandName||null, ppb:a.PPBNo||null, extent:a.T_Extent??a.TS_Extent??null,
        landType:a.CropTypeNa||null, classification:a.CropName||null, crop:a.CropName||null, cropVariety:a.CropVariet||null,
        irrigationSource:a.Src_Irriga||null, organic:a.IsOrganic||null, season:a.Season||null,
        latitude:safeNumber(a.lat), longitude:safeNumber(a.long), soilType:null,
        soilStatus:"Not returned by the public Telangana land-record layer for this feature"
      },
      fetchedAt:new Date().toISOString(), sourceName:"Telangana State GIS / TRAC · Land Information System", sourceUrl:ownerLayer
    });
  } catch(err) { res.status(502).json({ error:`Live Telangana GIS point lookup failed: ${err.message}` }); }
});

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "BhuDrishti API", version: "23.0.0", storage: "JSON file (no native database build required)" }));
app.get("/api/regions", (_req, res) => res.json([...data.regions].sort((a, b) => b.urban_growth - a.urban_growth)));
app.get("/api/regions/:name", (req, res) => {
  const region = data.regions.find(r => r.name.toLowerCase() === req.params.name.toLowerCase());
  if (!region) return res.status(404).json({ error: "Region not found" });
  res.json(region);
});
app.get("/api/properties", (req, res) => {
  const region = String(req.query.region || "").trim().toLowerCase();
  const result = region ? data.properties.filter(p => p.region.toLowerCase() === region) : [...data.properties].reverse();
  res.json(result);
});
app.get("/api/properties/:ulpin", (req, res) => {
  const property = data.properties.find(p => p.ulpin === req.params.ulpin);
  if (!property) return res.status(404).json({ error: "Property not found" });
  res.json(property);
});
app.get("/api/research", (_req, res) => res.json([...data.research].sort((a, b) => b.year - a.year || b.id - a.id)));

function pressureScore(label){
  return ({"Very High":95,"High":78,"Moderate":55,"Low":30}[label] ?? 50);
}
function buildAnalytics(regionName, period){
  const r = data.regions.find(x => x.name.toLowerCase() === String(regionName || "Hyderabad").toLowerCase()) || data.regions[0];
  const multiplier = period === "10 years" ? 10 : period === "1 year" ? 1 : 5;
  const pScore = pressureScore(r.development_pressure);
  const builtUp = Math.max(0, 100 - Number(r.agricultural_land || 0));
  const infrastructure = Math.round((Number(r.urban_growth || 0) * 0.65) + (pScore * 0.35));
  const conversionRisk = Math.round((Number(r.urban_growth || 0) * builtUp) / 100);
  const count = period === "1 year" ? 4 : period === "10 years" ? 10 : 6;
  const current = Number(r.urban_growth || 0);
  const start = Math.max(0, current - Math.min(24, multiplier * 1.8));
  const trend = Array.from({length: count}, (_, i) => {
    const value = Math.round(start + ((current - start) * i / Math.max(1, count - 1)));
    const year = 2026 - (count - 1 - i) * Math.max(1, Math.round(multiplier / Math.max(1, count - 1)));
    return { label: String(year), value };
  });
  return {
    region: r.name,
    state: r.state,
    period,
    periodMultiplier: multiplier,
    urbanGrowthIndex: Number(r.urban_growth || 0),
    agriculturalShare: Number(r.agricultural_land || 0),
    builtUpShare: builtUp,
    pressureScore: pScore,
    pressureLabel: r.development_pressure,
    infrastructureDemand: infrastructure,
    conversionRisk,
    trend,
    sourceLabel: "Computed from current platform region record",
    recordStatus: "CALCULATED",
    method: "Urban growth and agricultural-share fields are read from /api/regions; pressure is converted to a documented score and the other indicators are derived mathematically."
  };
}
app.get("/api/analytics", (req, res) => {
  const region = String(req.query.region || "Hyderabad").trim();
  const period = ["1 year","5 years","10 years"].includes(String(req.query.period)) ? String(req.query.period) : "5 years";
  res.json(buildAnalytics(region, period));
});

app.post("/api/simulate", (req, res) => {
  const restriction = Math.max(0, Math.min(50, Number(req.body.restriction ?? 20)));
  const baseline = { agriculturalLand: 62, residentialArea: 24, infrastructureDemand: 78, environmentalPressure: 81 };
  const after = {
    agriculturalLand: Math.round(baseline.agriculturalLand + restriction * 0.30),
    residentialArea: Math.round(baseline.residentialArea - restriction * 0.20),
    infrastructureDemand: Math.max(0, Math.round(baseline.infrastructureDemand - restriction * 0.45)),
    environmentalPressure: Math.max(0, Math.round(baseline.environmentalPressure - restriction * 0.35))
  };
  res.json({
    scenario: `Restrict agricultural → residential conversion by ${restriction}%`, baseline, after,
    interpretation: restriction >= 30 ? "Higher restriction preserves more agricultural land but may increase development pressure in adjacent zones." : "Moderate restriction may reduce conversion while allowing controlled urban development.",
    confidence: "Medium",
    disclaimer: "Scenario output for prototype decision support; not an official forecast."
  });
});


function normalizeText(value){
  return String(value || "").toLowerCase().replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();
}
function findRegionFromQuestion(question, fallback){
  const q=normalizeText(question);
  return data.regions.find(r=>q.includes(normalizeText(r.name))) || data.regions.find(r=>normalizeText(r.name)===normalizeText(fallback)) || data.regions[0];
}
function relevantResearch(question){
  const words=normalizeText(question).split(" ").filter(w=>w.length>3);
  return data.research.map(item=>({item,score:words.reduce((n,w)=>n+(normalizeText(JSON.stringify(item)).includes(w)?1:0),0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,3).map(x=>x.item);
}

const RESEARCH_STOPWORDS = new Set([
  "show","find","give","tell","about","with","from","that","this","these","those","research","papers","paper","study","studies","report","reports","evidence","source","sources","please","what","which","where","when","how","does","can","could","would","should","the","and","for","into","over","under","near","around","india","indian"
]);
const RESEARCH_SYNONYMS = {
  expansion:["expansion","growth","sprawl","urbanization","urbanisation","development"],
  urban:["urban","city","cities","urbanization","urbanisation","metro","metropolitan"],
  land:["land","landuse","land-use","parcel","property","territory"],
  agriculture:["agriculture","agricultural","farmland","farming","cultivation","crop","peri-urban","periurban"],
  conversion:["conversion","change","transition","transformation","encroachment"],
  governance:["governance","administration","land administration","land management","reform","reforms"],
  gis:["gis","geospatial","geographic information","spatial","remote sensing","mapping"],
  infrastructure:["infrastructure","transport","road","roads","metro","mobility","corridor"],
  groundwater:["groundwater","water table","aquifer","water"],
  policy:["policy","policies","regulation","regulations","law","laws","planning","zoning"]
};
function researchTokens(query){
  const raw=normalizeText(query).split(" ").filter(w=>w.length>2 && !RESEARCH_STOPWORDS.has(w));
  const expanded=new Set(raw);
  raw.forEach(w=>Object.values(RESEARCH_SYNONYMS).forEach(group=>{if(group.includes(w)) group.forEach(x=>expanded.add(normalizeText(x)));}));
  return [...expanded].filter(Boolean);
}
function stripTags(value){return String(value||"").replace(/<[^>]+>/g," ").replace(/\\s+/g," ").trim();}
function reconstructOpenAlexAbstract(inv){
  if(!inv || typeof inv!=="object") return "";
  const words=[]; Object.entries(inv).forEach(([word,positions])=>positions.forEach(pos=>{words[pos]=word;}));
  return words.filter(Boolean).join(" ").slice(0,360);
}
function localResearchSearch(query){
  const tokens=researchTokens(query);
  return data.research.map(item=>{
    const hay=normalizeText(`${item.title} ${item.publisher} ${item.type} ${item.topic}`);
    let score=0;
    tokens.forEach(t=>{if(hay.includes(t)) score+= t.length>6?2:1;});
    const q=normalizeText(query);
    if(q.includes(normalizeText(item.topic))) score+=3;
    return {item,score};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||Number(b.item.year)-Number(a.item.year)).slice(0,8).map(x=>({...x.item,live:false,matchScore:x.score}));
}
async function fetchJSON(url, options={}, timeoutMs=6500){
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{const response=await fetch(url,{...options,signal:controller.signal,headers:{Accept:"application/json","User-Agent":"BhuDrishti-SIH-Land-Research/15.0",...(options.headers||{})}}); if(!response.ok) throw new Error(`HTTP ${response.status}`); return await response.json();}
  finally{clearTimeout(timer);}
}
async function searchLiveResearch(query){
  const encoded=encodeURIComponent(String(query).slice(0,240));
  const fetchOpenAlex=async()=>{
    try{
      const body=await fetchJSON(`https://api.openalex.org/works?search=${encoded}&per-page=8&select=id,display_name,publication_year,type,doi,primary_location,authorships,abstract_inverted_index`,{},4500);
      return (body.results||[]).map(w=>{
        const loc=w.primary_location||{}; const source=loc.source?.display_name||"OpenAlex";
        const url=loc.landing_page_url||loc.pdf_url||(w.doi?`https://doi.org/${w.doi.replace(/^https?:\/\//,"")}`:"");
        return {title:w.display_name||"Untitled work",publisher:source,year:w.publication_year||"—",type:w.type?`Scholarly ${w.type}`:"Scholarly work",topic:"Live scholarly result",url,sourceUrl:url,abstract:reconstructOpenAlexAbstract(w.abstract_inverted_index),live:true,sourceProvider:"OpenAlex"};
      });
    }catch{return [];}
  };
  const fetchCrossref=async()=>{
    try{
      const body=await fetchJSON(`https://api.crossref.org/works?query.bibliographic=${encoded}&rows=8&select=DOI,title,published,container-title,author,type,URL,abstract`,{},4500);
      return (body.message?.items||[]).map(w=>{
        const title=Array.isArray(w.title)?w.title[0]:w.title; if(!title) return null;
        const url=w.URL||(w.DOI?`https://doi.org/${w.DOI}`:""); const year=w.published?.["date-parts"]?.[0]?.[0]||"—";
        return {title,publisher:Array.isArray(w["container-title"])?w["container-title"][0]:w["container-title"]||"Crossref",year,type:"Scholarly work",topic:"Live scholarly result",url,sourceUrl:url,abstract:stripTags(w.abstract).slice(0,360),live:true,sourceProvider:"Crossref"};
      }).filter(Boolean);
    }catch{return [];}
  };
  const [openAlex,crossref]=await Promise.all([fetchOpenAlex(),fetchCrossref()]);
  const out=[...openAlex,...crossref]; const seen=new Set();
  const deduped=out.filter(x=>{const key=normalizeText(x.title);if(!key||seen.has(key))return false;seen.add(key);return true;});
  return {results:deduped.slice(0,10),errors:deduped.length?[]:["Live scholarly services unavailable"]};
}
async function searchResearchSources(query){
  const local=localResearchSearch(query);
  const live=await searchLiveResearch(query);
  const combined=[...live.results,...local];
  const seen=new Set();
  const results=combined.filter(x=>{const key=normalizeText(x.title);if(!key||seen.has(key))return false;seen.add(key);return true;}).slice(0,10);
  return {results,live:live.results.length>0,errors:live.errors,localCount:local.length};
}
app.get("/api/research/search", async (req,res)=>{
  const q=String(req.query.q||"").trim();
  if(!q) return res.json({results:[...data.research],live:false,source:"Indexed catalog",query:""});
  try{
    const result=await searchResearchSources(q);
    const note=result.live
      ? `Found ${result.results.length} relevant result(s). Live scholarly metadata was retrieved and combined with the BhuDrishti indexed catalog.`
      : `No live scholarly service responded. ${result.localCount} matching indexed record(s) were ranked locally.`;
    res.json({results:result.results,live:result.live,source:result.live?"Indexed catalog + OpenAlex/Crossref":"Indexed BhuDrishti catalog",query:q,note});
  }catch(err){
    const local=localResearchSearch(q);
    res.json({results:local,live:false,source:"Indexed BhuDrishti catalog",query:q,note:"Live scholarly search failed; ranked indexed records are shown instead."});
  }
});

app.post("/api/ai", async (req, res) => {
  const question = String(req.body.question || "").trim();
  const requestedRegion = String(req.body.region || "Hyderabad").trim() || "Hyderabad";
  if (!question) return res.status(400).json({ error: "Question is required" });
  const q=normalizeText(question);
  const r=findRegionFromQuestion(question, requestedRegion);
  const all=[...data.regions];
  const evidence=[];
  let text="";
  let intent="Evidence synthesis";

  if (/^(hi|hello|hey|namaste|good morning|good evening)\b/.test(q)) {
    intent="Conversation";
    text=`Hello. I can answer questions about the indexed BhuDrishti region records, land composition, development pressure, research catalog, policy scenarios and the live Telangana land-record workflow. Try asking about ${r.name}, compare regions, or ask for a research source.`;
    evidence.push("BhuDrishti region records","Research catalog","Land-record workflow");
  } else if (/\b(compare|comparison|highest|lowest|rank|which region|across regions)\b/.test(q)) {
    intent="Regional comparison";
    const ranked=[...all].sort((a,b)=>Number(b.urban_growth)-Number(a.urban_growth));
    const highest=ranked[0], lowest=ranked[ranked.length-1];
    const rows=ranked.map(x=>`${x.name}: growth ${x.urban_growth}%, agricultural ${x.agricultural_land}%, pressure ${x.development_pressure}`).join("; ");
    text=`Across the indexed region records, ${highest.name} has the highest urban-growth index at ${highest.urban_growth}%, while ${lowest.name} has the lowest at ${lowest.urban_growth}%. The complete comparison is: ${rows}. These are platform records, not official national statistics.`;
    evidence.push("/api/regions","Regional comparison calculation");
  } else if (/\b(agricultural|agriculture|farm|farmland|cultivat|crop)\b/.test(q)) {
    intent="Land composition";
    text=`${r.name} has an agricultural-land share of ${r.agricultural_land}% in the indexed region record. The remaining ${100-r.agricultural_land}% is a non-agricultural share proxy for this dashboard; it should not be interpreted as a formal land-use classification without a source dataset.`;
    evidence.push(`${r.name} region record`,"Land composition indicator");
  } else if (/\b(growth|urban|expansion|development)\b/.test(q)) {
    intent="Urban growth";
    text=`${r.name} has an urban-growth index of ${r.urban_growth}% and a development-pressure label of ${r.development_pressure}. The platform treats this as an analytical indicator, not as a measured percentage increase in built-up area. Use Land Map & GIS for spatial context and Analytics & Reports for the derived indicators.`;
    evidence.push(`${r.name} region record`,"Analytics API","Land Map & GIS");
  } else if (/\b(pressure|risk|infrastructure|conversion|traffic|transport)\b/.test(q)) {
    intent="Governance signals";
    const a=buildAnalytics(r.name,"5 years");
    text=`For ${r.name}, the current indexed pressure label is ${r.development_pressure}. The Analytics API derives a pressure score of ${a.pressureScore}/100, infrastructure-demand indicator of ${a.infrastructureDemand}/100 and conversion-risk indicator of ${a.conversionRisk}/100 from the platform fields. These are decision-support calculations, not statutory or government forecasts.`;
    evidence.push(`${r.name} region record`,"Analytics API","Derived governance indicators");
  } else if (/\b(research|paper|report|study|evidence|source|literature|policy document)\b/.test(q)) {
    intent="Research retrieval";
    const result=await searchResearchSources(question);
    const hits=result.results||[];
    if(hits.length){
      text=`I found ${hits.length} relevant research result(s) for your question. ${hits.slice(0,5).map(x=>`${x.title} (${x.year})`).join("; ")}. Live scholarly results are marked as live sources; indexed BhuDrishti records remain clearly labelled as platform records.`;
      hits.slice(0,6).forEach(x=>evidence.push(`${x.title} · ${x.publisher} · ${x.year}${x.live?" · live":" · indexed"}`));
    } else {
      text="I could not find sufficiently relevant research in the live scholarly services or the current BhuDrishti catalog. Try adding a topic, place, policy or land-use term.";
      evidence.push("Live scholarly search","Research catalog search");
    }
  } else if (/\b(survey|owner|pattadar|passbook|ppb|land record|record of rights|ror|parcel)\b/.test(q)) {
    intent="Land-record guidance";
    const survey=(question.match(/\b\d+(?:\s*[\/-]\s*[A-Za-z0-9]+)?\b/)||[])[0];
    text=survey?`I detected survey number ${survey}. The public land-record lookup needs the exact District, Mandal and Village spelling plus the survey/sub-division number. Open Land Map & GIS and use Verified Land Records to fetch the live Telangana GIS response. Owner/pattadar details are shown only when the authoritative public response returns them.`:"I can help with a land record, but I need the exact survey/sub-division number plus District, Mandal and Village to query the live Telangana GIS source. Use Land Map & GIS → Verified Land Records.";
    evidence.push("Telangana GIS land-record lookup","Official Bhu Bharati verification workflow");
  } else if (/\b(policy|what if|restrict|zoning|scenario|simulate)\b/.test(q)) {
    intent="Policy scenario";
    text=`Policy questions should be tested in Policy Sandbox. The current simulator models a hypothetical restriction on agricultural-to-residential conversion and reports the resulting indicator changes. It is intentionally separated from real land records and is not an official forecast.`;
    evidence.push("Policy Sandbox","/api/simulate");
  } else if (/\b(future|2030|2035|2040|2045|kandlakoya|10 years|tomorrow|next)\b/.test(q)) {
    intent="Future scenario";
    text=`Future-development questions belong in Future City, where the requested location and target year are converted into an explicit 2D/3D scenario. Scenario outputs are modeled assumptions and should be labelled separately from known current facts.`;
    evidence.push("Future City scenario workspace","Scenario assumptions");
  } else if (/\b(what is|define|meaning|explain|how does|how can)\b/.test(q)) {
    intent="Platform explanation";
    text=`BhuDrishti is structured as a land-governance evidence workspace: Land Map & GIS provides spatial context, Verified Land Records retrieves returned public record fields, Analytics & Reports calculates indicators, Legal Research indexes evidence, AI Evidence retrieves relevant platform context, and Policy Sandbox tests hypothetical rules.`;
    evidence.push("BhuDrishti workspace modules","Platform workflow");
  } else {
    const hits=relevantResearch(question);
    const a=buildAnalytics(r.name,"5 years");
    text=`I could not match that question to a single specialized intent, so I combined the closest indexed evidence for ${r.name}: urban-growth index ${r.urban_growth}%, agricultural-land share ${r.agricultural_land}%, development pressure ${r.development_pressure}, and ${hits.length} related research record(s). For a stronger answer, ask about a region, survey/parcel, research source, policy scenario, land composition or future development; the assistant will route the question to the relevant workspace.`;
    evidence.push(`${r.name} region record`,"Analytics API",...(hits.length?hits.map(x=>x.title):["Research catalog"]));
    intent="General evidence synthesis";
  }

  res.json({q:question,intent,text,evidence,confidence:evidence.length>=2?"Medium":"Low",source:"BhuDrishti retrieval + calculation engine",disclaimer:"Answers are generated from the current platform dataset and public-land-record workflow. They are not official legal advice, statutory determinations or guaranteed forecasts."});
});

app.post("/api/reset-demo-data", (_req, res) => {
  data = structuredClone(defaultData);
  saveData(data);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => console.log(`BhuDrishti API listening on port ${PORT}`));
