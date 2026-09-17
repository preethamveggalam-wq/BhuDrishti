import React from "react";

export default function DigitalTwin({ expanded = false }) {
  const floors = [
    ["4F", "Unit 401", "Residential"],
    ["3F", "Unit 301", "Residential"],
    ["2F", "Unit 201", "Residential"],
    ["1F", "Unit 101", "Residential"],
    ["GF", "Ground", "Commercial"]
  ];

  return (
    <div className={`twin-stage ${expanded ? "expanded" : ""}`}>
      <div className="twin-glow" />
      <div className="building">
        {floors.map(([floor, unit, type], i) => (
          <div
            className="floor"
            key={floor}
            style={{ "--i": i }}
          >
            <div className="floor-face">
              <span className="floor-tag">{floor}</span>
              <strong>{unit}</strong>
              <small>{type}</small>
            </div>
            <div className="floor-window" />
          </div>
        ))}
        <div className="land-plot">
          <span>ULPIN</span>
          <strong>TG-HYD-1234-5678-9012</strong>
          <small>3,200 sq.m · Verified</small>
        </div>
      </div>
      <div className="twin-caption">
        <span>3D DIGITAL TWIN</span>
        <strong>Vertical property intelligence</strong>
      </div>
    </div>
  );
}
