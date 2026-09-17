CREATE TABLE regions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  urban_growth INTEGER NOT NULL,
  agricultural_land INTEGER NOT NULL,
  development_pressure TEXT NOT NULL,
  latitude REAL,
  longitude REAL
);

CREATE TABLE properties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ulpin TEXT UNIQUE NOT NULL,
  region TEXT NOT NULL,
  property_type TEXT NOT NULL,
  floors INTEGER NOT NULL,
  units INTEGER NOT NULL,
  area_sq_m REAL NOT NULL,
  year_built INTEGER NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE research (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  publisher TEXT NOT NULL,
  year INTEGER NOT NULL,
  type TEXT NOT NULL,
  topic TEXT NOT NULL
);
