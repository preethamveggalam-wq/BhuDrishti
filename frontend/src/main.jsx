import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

class AppErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error){ return { error }; }
  render(){
    if(this.state.error){
      return <div style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#02090d",color:"#eff8f7",fontFamily:"system-ui",padding:24}}>
        <div style={{maxWidth:760,border:"1px solid rgba(72,230,173,.25)",borderRadius:18,padding:28,background:"#06151c"}}>
          <div style={{color:"#43e5ad",fontWeight:800,letterSpacing:".12em",fontSize:12}}>BHUDRISHTI STARTUP ERROR</div>
          <h1 style={{fontSize:30,margin:"12px 0"}}>The app loaded, but a browser module failed.</h1>
          <p style={{color:"#8ca6ad",lineHeight:1.6}}>Open the Antigravity terminal and check the first red error. Make sure you ran <b>npm install</b> and <b>npm run install:all</b> from the current BhuDrishti project folder.</p>
          <pre style={{whiteSpace:"pre-wrap",color:"#65e7b7",fontSize:12}}>{String(this.state.error?.message || this.state.error)}</pre>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button onClick={()=>location.reload()} style={{border:0,borderRadius:10,padding:"12px 18px",background:"#43e5ad",color:"#032016",fontWeight:800}}>Reload</button><button onClick={()=>{sessionStorage.setItem("bhudrishti_demo_safe","1");location.reload()}} style={{border:"1px solid rgba(72,230,173,.3)",borderRadius:10,padding:"12px 18px",background:"transparent",color:"#7be9c5",fontWeight:800}}>Enable Demo Safe</button></div>
        </div>
      </div>;
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(<AppErrorBoundary><App /></AppErrorBoundary>);
