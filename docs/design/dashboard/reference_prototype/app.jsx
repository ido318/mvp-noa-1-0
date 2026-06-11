// ===== App shell + routing =====
const NAV = [
  {k:"today", label:"היום", icon:"today"},
  {k:"calendar", label:"יומן", icon:"calendar"},
  {k:"calls", label:"שיחות", icon:"calls"},
  {k:"escalations", label:"אסקלציות", icon:"escalation"},
  {k:"clients", label:"לקוחות", icon:"clients"},
  {k:"pets", label:"חיות מחמד", icon:"pets"},
  {k:"records", label:"תיקים רפואיים", icon:"records"},
  {k:"settings", label:"הגדרות", icon:"settings"},
];

const Logo = ()=>(
  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
    <img src="assets/getavet-logo.png" alt="Get A Vet" style={{width:138,height:"auto",display:"block"}}/>
    <div style={{fontSize:10.5,color:"var(--faint)",fontWeight:600,letterSpacing:".04em",textAlign:"center"}}>מערכת ניהול · VOXLY</div>
  </div>
);

const Sidebar = ({route, setRoute})=>{
  const open=ESCALATIONS.filter(e=>e.status==="open").length;
  const badges={escalations:open};
  return (
    <aside style={{width:"var(--side-w)",flexShrink:0,background:"var(--surface)",borderInlineStart:"1px solid var(--line)",display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{padding:"22px 20px 18px"}}><Logo/></div>
      <nav style={{flex:1,padding:"6px 14px",display:"flex",flexDirection:"column",gap:3}}>
        {NAV.map(n=>{
          const active=route===n.k || (route==="clientProfile"&&n.k==="clients");
          return (
            <button key={n.k} onClick={()=>setRoute(n.k)} style={{
              display:"flex",alignItems:"center",gap:12,padding:"11px 14px",borderRadius:12,
              fontSize:14.5,fontWeight:active?700:500,textAlign:"start",position:"relative",
              color:active?"var(--teal-700)":"var(--ink-2)",
              background:active?"var(--teal-50)":"transparent",transition:"all .16s"
            }}
            onMouseEnter={e=>{if(!active)e.currentTarget.style.background="var(--surface-2)";}}
            onMouseLeave={e=>{if(!active)e.currentTarget.style.background="transparent";}}>
              <span style={{color:active?"var(--teal-600)":"var(--faint)",display:"grid",placeItems:"center"}}><Icon name={n.icon} size={21}/></span>
              <span style={{flex:1}}>{n.label}</span>
              {badges[n.k]>0 && <span style={{fontSize:11.5,fontWeight:700,color:"#fff",background:"var(--red-500)",borderRadius:99,minWidth:20,height:20,padding:"0 6px",display:"grid",placeItems:"center"}}>{badges[n.k]}</span>}
              {active && <span style={{position:"absolute",insetInlineEnd:-14,top:"50%",transform:"translateY(-50%)",width:3,height:22,borderRadius:99,background:"var(--teal-600)"}}/>}
            </button>
          );
        })}
      </nav>
      <div style={{padding:14,borderTop:"1px solid var(--line-2)"}}>
        <div style={{display:"flex",alignItems:"center",gap:11,padding:"8px 10px",borderRadius:12}}>
          <PersonAvatar initials="נ" size={38}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:13.5}}>ד״ר נועה כבשני</div>
            <div style={{fontSize:11.5,color:"var(--faint)"}}>וטרינרית ראשית</div>
          </div>
          <button style={{color:"var(--faint)",padding:6,borderRadius:8}} onMouseEnter={e=>e.currentTarget.style.color="var(--muted)"} onMouseLeave={e=>e.currentTarget.style.color="var(--faint)"}><Icon name="logout" size={18}/></button>
        </div>
      </div>
    </aside>
  );
};

const Header = ({onBell})=>{
  const [q,setQ]=useState("");
  const open=ESCALATIONS.filter(e=>e.status==="open").length;
  return (
    <header style={{height:"var(--header-h)",flexShrink:0,background:"var(--surface)",borderBottom:"1px solid var(--line)",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 28px",gap:20}}>
      <div style={{position:"relative",flex:1,maxWidth:440}}>
        <span style={{position:"absolute",insetInlineStart:14,top:"50%",transform:"translateY(-50%)",color:"var(--faint)"}}><Icon name="search" size={18}/></span>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="חיפוש לקוחות, חיות, שיחות…" style={{
          width:"100%",padding:"11px 42px 11px 14px",borderRadius:12,border:"1px solid var(--line)",
          background:"var(--surface-2)",fontSize:14,transition:"border-color .2s, background .2s"
        }}
        onFocus={e=>{e.target.style.borderColor="var(--teal-400)";e.target.style.background="var(--surface)";}}
        onBlur={e=>{e.target.style.borderColor="var(--line)";e.target.style.background="var(--surface-2)";}}/>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <div style={{textAlign:"start",whiteSpace:"nowrap"}}>
          <div style={{fontSize:13.5,fontWeight:700,color:"var(--ink-2)"}}>מרפאת Get A Vet</div>
          <div style={{fontSize:11.5,color:"var(--faint)"}}>מגדלי גינדי TLV · תל אביב</div>
        </div>
        <div style={{width:1,height:30,background:"var(--line)"}}/>
        <button onClick={onBell} style={{position:"relative",width:42,height:42,borderRadius:12,display:"grid",placeItems:"center",color:"var(--ink-2)",background:"var(--surface-2)",transition:"background .15s"}}
          onMouseEnter={e=>e.currentTarget.style.background="var(--line-2)"} onMouseLeave={e=>e.currentTarget.style.background="var(--surface-2)"}>
          <Icon name="bell" size={21}/>
          {open>0 && <span style={{position:"absolute",top:7,insetInlineEnd:8,minWidth:17,height:17,padding:"0 4px",borderRadius:99,background:"var(--red-500)",color:"#fff",fontSize:10.5,fontWeight:700,display:"grid",placeItems:"center",border:"2px solid var(--surface)"}}>{open}</span>}
        </button>
      </div>
    </header>
  );
};

// Simple pets grid screen
const PetsScreen = ({onOpenClient})=>{
  const all=CLIENTS.flatMap(c=>c.pets.map(p=>({...p,owner:c})));
  return (
    <div className="page-enter">
      <div style={{marginBottom:20}}>
        <h1 style={{margin:0,fontSize:24,fontWeight:800}}>חיות מחמד</h1>
        <div style={{fontSize:13.5,color:"var(--muted)",marginTop:4}}>{all.length} חיות מחמד במעקב המרפאה</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:14}}>
        {all.map(p=>(
          <Card key={p.id} hover pad={16} onClick={()=>onOpenClient(p.owner)}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <AnimalAvatar pet={p} size={48}/>
              <div style={{minWidth:0}}>
                <div style={{fontWeight:700,fontSize:15}}>{p.name}</div>
                <div style={{fontSize:12.5,color:"var(--muted)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{SPECIES[p.species].he} · {p.breed}</div>
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:7,marginTop:13,paddingTop:12,borderTop:"1px solid var(--line-2)",fontSize:12.5,color:"var(--faint)"}}>
              <Icon name="user" size={14}/> {p.owner.name}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

const Placeholder = ({title, sub, icon})=>(
  <div className="page-enter">
    <div style={{marginBottom:20}}><h1 style={{margin:0,fontSize:24,fontWeight:800}}>{title}</h1></div>
    <Card style={{minHeight:380,display:"grid",placeItems:"center"}}><EmptyState title={sub} sub="המסך הזה יפותח בהמשך — מחוץ לסקופ הנוכחי." icon={icon}/></Card>
  </div>
);

const App = ()=>{
  const [route,setRoute]=useState("today");
  const [selClient,setSelClient]=useState(null);
  const [openCall,setOpenCall]=useState(null);
  const [drawer,setDrawer]=useState(false);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{ const t=setTimeout(()=>setLoading(false),780); return ()=>clearTimeout(t); },[]);

  const goClient=(c)=>{ setSelClient(c); setRoute("clientProfile"); window.scrollTo&&window.scrollTo(0,0); };
  const showCall=(c)=>{ setOpenCall(c); setDrawer(true); };
  const nav=(r)=>{ setRoute(r); };

  // wrap setRoute to reset client when leaving
  const navTo=(r)=>{ if(r!=="clientProfile") setSelClient(null); setDrawer(false); setRoute(r); };

  let content;
  switch(route){
    case "today": content=<TodayScreen nav={nav} onOpenClient={goClient} onOpenCall={showCall} loading={loading}/>; break;
    case "calendar": content=<CalendarScreen onOpenClient={goClient}/>; break;
    case "calls": content=<CallsScreen openCall={openCall} onOpenCall={showCall}/>; break;
    case "escalations": content=<EscalationsScreen onOpenClient={goClient} onOpenCall={showCall}/>; break;
    case "clients": content=<ClientsScreen onOpenClient={goClient}/>; break;
    case "clientProfile": content=<ClientProfile client={selClient} onBack={()=>navTo("clients")} onOpenCall={showCall}/>; break;
    case "pets": content=<PetsScreen onOpenClient={goClient}/>; break;
    case "records": content=<Placeholder title="תיקים רפואיים" sub="כאן יופיעו כל התיקים הרפואיים" icon="records"/>; break;
    case "settings": content=<Placeholder title="הגדרות" sub="הגדרות המרפאה ותומר" icon="settings"/>; break;
    default: content=null;
  }

  return (
    <ToastProvider>
      <div className="app">
        <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0,height:"100%"}}>
          <Header onBell={()=>navTo("escalations")}/>
          <main style={{flex:1,overflowY:"auto",padding:"28px 32px 40px"}}>
            <div style={{maxWidth:1240,margin:"0 auto"}}>{content}</div>
          </main>
        </div>
        <Sidebar route={route} setRoute={navTo}/>
      </div>
      <CallDrawer call={openCall} open={drawer} onClose={()=>setDrawer(false)} onOpenClient={goClient}/>
    </ToastProvider>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
