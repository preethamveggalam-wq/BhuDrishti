import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const cityBlocks = [
  { id:"A1", x:-5.4,z:-2.8,w:1.8,d:1.5,h:1.1,type:"residential" }, { id:"A2", x:-3.3,z:-2.7,w:1.4,d:1.6,h:2.0,type:"residential" },
  { id:"A3", x:-1.5,z:-2.8,w:1.5,d:1.5,h:3.2,type:"commercial" }, { id:"A4", x:0.4,z:-2.8,w:1.6,d:1.5,h:2.2,type:"mixed" },
  { id:"A5", x:2.6,z:-2.8,w:1.5,d:1.6,h:3.8,type:"commercial" }, { id:"A6", x:4.5,z:-2.8,w:1.7,d:1.5,h:1.5,type:"residential" },
  { id:"B1", x:-5.2,z:-.8,w:2.0,d:1.4,h:2.6,type:"residential" }, { id:"B2", x:-2.9,z:-.8,w:1.6,d:1.5,h:4.4,type:"commercial" },
  { id:"B3", x:-.8,z:-.8,w:1.7,d:1.5,h:2.0,type:"residential" }, { id:"B4", x:1.4,z:-.8,w:1.5,d:1.6,h:5.3,type:"commercial" },
  { id:"B5", x:3.6,z:-.8,w:1.7,d:1.5,h:2.8,type:"mixed" }, { id:"C1", x:-4.5,z:1.2,w:1.7,d:1.5,h:1.4,type:"agricultural" },
  { id:"C2", x:-2.4,z:1.2,w:1.5,d:1.5,h:2.3,type:"residential" }, { id:"C3", x:-.2,z:1.2,w:1.6,d:1.6,h:4.8,type:"commercial" },
  { id:"C4", x:2.0,z:1.2,w:1.5,d:1.5,h:2.9,type:"mixed" }, { id:"C5", x:4.1,z:1.2,w:1.6,d:1.5,h:1.2,type:"agricultural" },
  { id:"D1", x:-3.9,z:3.2,w:1.9,d:1.5,h:2.0,type:"residential" }, { id:"D2", x:-1.7,z:3.2,w:1.5,d:1.5,h:3.0,type:"mixed" },
  { id:"D3", x:.6,z:3.2,w:1.7,d:1.6,h:6.2,type:"commercial" }, { id:"D4", x:3.0,z:3.2,w:1.8,d:1.5,h:2.2,type:"residential" },
];
const palettes={residential:{wall:"#507f76",roof:"#274a47",glass:"#b8e9df",accent:"#42e2ae"},commercial:{wall:"#8b6d39",roof:"#4c3e25",glass:"#d6e5e7",accent:"#efb44e"},mixed:{wall:"#4b7880",roof:"#294d54",glass:"#bcecf0",accent:"#48cce9"},agricultural:{wall:"#58794b",roof:"#2c4a2e",glass:"#c7e9d5",accent:"#91c84c"}};

function Ground(){return <group>
  <mesh rotation-x={-Math.PI/2} position={[0,-.12,0]} receiveShadow><planeGeometry args={[18,14]}/><meshStandardMaterial color="#07161a" roughness={.92}/></mesh>
  <mesh rotation-x={-Math.PI/2} position={[0,-.07,4.9]}><planeGeometry args={[18,1.45]}/><meshStandardMaterial color="#171d1f" roughness={.95}/></mesh>
  <mesh rotation-x={-Math.PI/2} position={[-6,-.07,0]}><planeGeometry args={[1.25,9]}/><meshStandardMaterial color="#171d1f" roughness={.95}/></mesh>
  <mesh rotation-x={-Math.PI/2} position={[0,-.065,4.2]}><planeGeometry args={[17.8,.04]}/><meshBasicMaterial color="#3c4b4d"/></mesh>
  <mesh rotation-x={-Math.PI/2} position={[-5.4,-.065,0]}><planeGeometry args={[.04,8.4]}/><meshBasicMaterial color="#3c4b4d"/></mesh>
  {[-4,-2,0,2,4].map(x=><mesh key={x} rotation-x={-Math.PI/2} position={[x,-.04,0]}><planeGeometry args={[.025,12]}/><meshBasicMaterial color="#17404a" transparent opacity={.55}/></mesh>)}
  {[-5,-3,-1,1,3,5].map(z=><mesh key={z} rotation-x={-Math.PI/2} position={[0,-.04,z]}><planeGeometry args={[17,.025]}/><meshBasicMaterial color="#17404a" transparent opacity={.55}/></mesh>)}
</group>}

function Window({position,rotation=[0,0,0],scale=[1,1,1],lit=false}){return <mesh position={position} rotation={rotation} scale={scale}><planeGeometry args={[.5,.34]}/><meshStandardMaterial color={lit?"#f4ead0":"#9fd6d4"} emissive={lit?"#d49d4a":"#163f43"} emissiveIntensity={lit?.55:.18} roughness={.2} metalness={.2}/></mesh>}
function Tree({x,z,s=1}){return <group position={[x,0,z]} scale={s}><mesh position={[0,.35,0]}><cylinderGeometry args={[.07,.09,.7,8]}/><meshStandardMaterial color="#5c4730"/></mesh><mesh position={[0,.78,0]}><sphereGeometry args={[.42,12,10]}/><meshStandardMaterial color="#2e7b5c" roughness={.95}/></mesh></group>}
function Lamp({x,z}){return <group position={[x,.1,z]}><mesh position={[0,.65,0]}><cylinderGeometry args={[.025,.035,1.3,8]}/><meshStandardMaterial color="#677b7d"/></mesh><mesh position={[0,1.32,0]}><sphereGeometry args={[.09,10,8]}/><meshBasicMaterial color="#bdf8e6"/></mesh></group>}

function DetailedBuilding({data,selected,onSelect,layer}){
 const ref=useRef(); const [hover,setHover]=useState(false); const p=palettes[data.type];
 const floors=Math.max(1,Math.round(data.h)); const opacity=layer==="agriculture"&&data.type!=="agricultural"?.28:1;
 useFrame((_,dt)=>{if(ref.current){const s=selected?1.06:hover?1.025:1;ref.current.scale.y=THREE.MathUtils.lerp(ref.current.scale.y,s,dt*7)}});
 const floorH=data.h/floors;
 return <group ref={ref} position={[data.x,data.h/2-.02,data.z]} onClick={e=>{e.stopPropagation();onSelect(data)}} onPointerOver={e=>{e.stopPropagation();setHover(true)}} onPointerOut={()=>setHover(false)}>
   <mesh castShadow receiveShadow><boxGeometry args={[data.w,data.h,data.d]}/><meshStandardMaterial color={selected?"#d9fff5":p.wall} roughness={.65} metalness={.12} transparent opacity={opacity}/></mesh>
   {Array.from({length:floors}).map((_,i)=>{const y=-data.h/2+floorH*(i+.5);return <group key={i}>
     {[-.34,0,.34].map((r,j)=><Window key={j} position={[r*data.w,y,data.d/2+.008]} scale={[data.w*1.35,1,1]} lit={selected&&j===1}/>) }
     <mesh position={[0,-data.h/2+floorH*(i+1),0]}><boxGeometry args={[data.w+.03,.025,data.d+.03]}/><meshBasicMaterial color="#d0ebe7" transparent opacity={.28}/></mesh>
   </group>})}
   <mesh position={[0,data.h/2+.04,0]}><boxGeometry args={[data.w+.08,.08,data.d+.08]}/><meshStandardMaterial color={p.roof} roughness={.8}/></mesh>
   {data.type!=="agricultural"&&<mesh position={[0,data.h/2+.12,0]}><boxGeometry args={[data.w*.36,.04,data.d*.5]}/><meshStandardMaterial color="#173536"/></mesh>}
   {selected&&<mesh position={[0,-data.h/2-.01,0]}><boxGeometry args={[data.w+.2,.04,data.d+.2]}/><meshBasicMaterial color="#48e6ad" transparent opacity={.9}/></mesh>}
 </group>
}
function SceneContent({selected,setSelected,layer,cameraMode}){const {camera}=useThree();
 useEffect(()=>{const targets={perspective:[10,8.5,12],top:[0,15,.01],close:[6,5.5,7]};const p=targets[cameraMode]||targets.perspective;camera.position.set(...p);camera.lookAt(0,1.5,0)},[camera,cameraMode]);
 useFrame((state)=>{if(cameraMode!=="perspective")return;const t=state.clock.elapsedTime*.025;const r=15.5;camera.position.x=Math.cos(t)*r;camera.position.z=Math.sin(t)*r;camera.position.y=8.5;camera.lookAt(0,1.2,0)});
 return <><color attach="background" args={["#031016"]}/><ambientLight intensity={1.35}/><directionalLight castShadow position={[7,14,8]} intensity={3.5} color="#d9fff4"/><pointLight position={[-7,5,-4]} intensity={22} distance={18} color="#20d9a1"/><pointLight position={[5,4,5]} intensity={14} distance={16} color="#48cce9"/><Ground/>
 {cityBlocks.map(b=><DetailedBuilding key={b.id} data={b} selected={selected?.id===b.id} onSelect={setSelected} layer={layer}/>) }
 {[[-6.8,2.8],[6.6,2.8],[-6.6,-3.2],[6.5,-2.9]].map(([x,z],i)=><Tree key={i} x={x} z={z} s={.9}/>)}
 {[[-4.8,4.0],[4.8,4.0],[-4.8,-3.5],[4.8,-3.5]].map(([x,z],i)=><Lamp key={i} x={x} z={z}/>)}
 </>}
export default function CityScene({selected,setSelected,layer,cameraMode}){return <Canvas shadows dpr={[1,1.8]} camera={{position:[10,8.5,12],fov:42,near:.1,far:100}} onCreated={({camera})=>camera.lookAt(0,1,0)} fallback={<div className="webgl-fallback">3D WebGL is unavailable on this device.</div>}><SceneContent selected={selected} setSelected={setSelected} layer={layer} cameraMode={cameraMode}/></Canvas>}
