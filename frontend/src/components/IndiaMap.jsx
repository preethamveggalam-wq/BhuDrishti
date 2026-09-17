import React from "react";

const cities = [
  ["Delhi", 53, 19, "north"],
  ["Ahmedabad", 36, 44, "west"],
  ["Mumbai", 31, 58, "west"],
  ["Hyderabad", 48, 61, "south"],
  ["Bengaluru", 43, 75, "south"],
  ["Chennai", 56, 78, "south"],
  ["Kolkata", 75, 46, "east"],
];

export default function IndiaMap({ active = "Hyderabad" }) {
  return (
    <div className="india-3d-map">
      <div className="terrain-grid" />
      <div className="terrain-glow" />
      <div className="india-terrain" aria-label="3D stylized India land intelligence map">
        <svg viewBox="0 0 600 700" className="india-terrain-svg">
          <defs>
            <linearGradient id="indiaFill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#39e9a1" stopOpacity=".72"/>
              <stop offset=".55" stopColor="#159e78" stopOpacity=".58"/>
              <stop offset="1" stopColor="#073e42" stopOpacity=".78"/>
            </linearGradient>
            <linearGradient id="indiaSide" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#35c994"/>
              <stop offset="1" stopColor="#06352f"/>
            </linearGradient>
            <filter id="softGlow">
              <feGaussianBlur stdDeviation="9"/>
            </filter>
          </defs>
          <path className="india-shadow" d="M270 48 L340 73 365 125 415 160 391 212 438 257 423 310 463 351 442 395 412 447 387 510 358 562 343 623 302 671 276 628 263 580 232 539 221 489 185 449 154 399 112 374 101 330 121 294 105 258 139 224 145 179 178 157 186 111 225 84 240 54Z"/>
          <path className="india-extrusion" d="M270 48 L340 73 365 125 415 160 391 212 438 257 423 310 463 351 442 395 412 447 387 510 358 562 343 623 302 671 276 628 263 580 232 539 221 489 185 449 154 399 112 374 101 330 121 294 105 258 139 224 145 179 178 157 186 111 225 84 240 54Z" transform="translate(0 20)"/>
          <path className="india-fill" d="M270 48 L340 73 365 125 415 160 391 212 438 257 423 310 463 351 442 395 412 447 387 510 358 562 343 623 302 671 276 628 263 580 232 539 221 489 185 449 154 399 112 374 101 330 121 294 105 258 139 224 145 179 178 157 186 111 225 84 240 54Z"/>
          <path className="india-outline" d="M270 48 L340 73 365 125 415 160 391 212 438 257 423 310 463 351 442 395 412 447 387 510 358 562 343 623 302 671 276 628 263 580 232 539 221 489 185 449 154 399 112 374 101 330 121 294 105 258 139 224 145 179 178 157 186 111 225 84 240 54Z"/>
          <path className="river-line" d="M320 110 C285 180 360 205 335 285 S370 390 295 470 S310 570 285 625"/>
          <path className="river-line faint" d="M220 205 C280 235 255 305 195 350 S215 445 250 500"/>
          <g className="terrain-blocks">
            <rect x="205" y="320" width="62" height="45"/>
            <rect x="280" y="285" width="75" height="55"/>
            <rect x="330" y="355" width="60" height="70"/>
            <rect x="245" y="410" width="70" height="65"/>
            <rect x="305" y="470" width="52" height="45"/>
            <rect x="180" y="270" width="42" height="30"/>
          </g>
        </svg>

        {cities.map(([name, x, y]) => (
          <div
            key={name}
            className={`city-pin ${name === active ? "active" : ""}`}
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <span className="pin-dot" />
            <span className="pin-label">{name}</span>
          </div>
        ))}
      </div>

      <div className="map-toolbar">
        <button>⌁</button>
        <button>◎</button>
        <button>＋</button>
        <button>−</button>
        <button className="toolbar-3d">3D</button>
      </div>

      <div className="map-view-switch">
        <span>SELECT VIEW</span>
        <div><button>2D</button><button className="on">3D</button><button>Satellite</button></div>
        <span className="time-label">TIME PERIOD</span>
        <div className="timebar"><i/><b/></div>
        <div className="years"><small>2010</small><small>2015</small><small>2020</small><small>2026</small><button>▶</button></div>
      </div>

      <div className="map-mode-list">
        {["Land Use","Urban Expansion","Agricultural Land","Infrastructure","Development Density","Elevation (3D)","Policy Zones"].map((item, i) =>
          <div className={i === 0 ? "mode active" : "mode"} key={item}><span>{["⌂","◫","♧","⌁","▦","◇","⬡"][i]}</span>{item}</div>
        )}
      </div>

      <div className="map-legend-3d">
        <strong>LAND USE · 2026</strong>
        <span><i className="res"/>Residential</span>
        <span><i className="com"/>Commercial</span>
        <span><i className="agr"/>Agricultural</span>
        <span><i className="for"/>Forest</span>
        <span><i className="wat"/>Water</span>
      </div>

      <div className="map-stats">
        <div><b>28+</b><small>States & UTs</small></div>
        <div><b>700M+</b><small>Land Parcels*</small></div>
        <div><b>1000+</b><small>Research Papers*</small></div>
        <div><b>50+</b><small>Policy Documents*</small></div>
      </div>
    </div>
  );
}
