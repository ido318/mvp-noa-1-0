// ===== Shared UI components =====
const { useState, useEffect, useRef, useCallback, createContext, useContext } = React;

// ---------- helpers ----------
function hhmm(t){ return t; } // already 24h "HH:MM"
function addMinutes(t, m){
  const [h,mm]=t.split(":").map(Number);
  const tot=h*60+mm+m; const nh=Math.floor(tot/60), nm=tot%60;
  return `${String(nh).padStart(2,"0")}:${String(nm).padStart(2,"0")}`;
}
function urgencyColor(u){
  if(u>=8) return { fg:"#B91C1C", bg:"#FEF2F2", ring:"#F2B8B8", bar:"#DC2626" };
  if(u>=6) return { fg:"#C2410C", bg:"#FFF3EB", ring:"#FAC9A3", bar:"#F97316" };
  if(u>=4) return { fg:"#B45309", bg:"#FEF8EA", ring:"#F6DDA0", bar:"#F59E0B" };
  return { fg:"#2F7D5B", bg:"#E9F5EF", ring:"#BBE3D2", bar:"#3E9C86" };
}
function typeStyle(type){
  const map={
    checkup:{fg:"var(--t-checkup)",bg:"var(--t-checkup-bg)"},
    vaccine:{fg:"var(--t-vaccine)",bg:"var(--t-vaccine-bg)"},
    surgery:{fg:"var(--t-surgery)",bg:"var(--t-surgery-bg)"},
    followup:{fg:"var(--t-followup)",bg:"var(--t-followup-bg)"},
    grooming:{fg:"var(--t-grooming)",bg:"var(--t-grooming-bg)"},
  };
  return map[type]||map.checkup;
}

// ---------- Animal avatar ----------
const AnimalAvatar = ({pet, size=42, ring=true})=>{
  if(!pet) return null;
  const sp=SPECIES[pet.species];
  return (
    <div style={{
      width:size, height:size, borderRadius:"50%",
      background:pet.color+"1A", color:pet.color,
      display:"grid", placeItems:"center", flexShrink:0,
      boxShadow: ring? `inset 0 0 0 1.5px ${pet.color}33`:"none"
    }}>
      <AnimalIcon species={pet.species} size={size*0.56} sw={1.7}/>
    </div>
  );
};

// ---------- Person avatar (initials) ----------
const PersonAvatar = ({name, initials, size=40, color="var(--teal-600)"})=>(
  <div style={{
    width:size,height:size,borderRadius:"50%",flexShrink:0,
    background:"linear-gradient(145deg,var(--teal-100),var(--teal-50))",
    color:"var(--teal-700)", display:"grid",placeItems:"center",
    fontWeight:700, fontSize:size*0.36, boxShadow:"inset 0 0 0 1.5px rgba(14,124,134,.16)"
  }}>{initials}</div>
);

// ---------- Generic card ----------
const Card = ({children, style, className="", pad=20, onClick, hover})=>(
  <div onClick={onClick} className={className} style={{
    background:"var(--surface)", borderRadius:"var(--r-lg)",
    border:"1px solid var(--line)", boxShadow:"var(--sh-sm)",
    padding:pad, ...(hover?{cursor:"pointer",transition:"box-shadow .2s,transform .2s, border-color .2s"}:{}), ...style
  }}
  onMouseEnter={hover?e=>{e.currentTarget.style.boxShadow="var(--sh-md)";e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.borderColor="var(--teal-200)";}:undefined}
  onMouseLeave={hover?e=>{e.currentTarget.style.boxShadow="var(--sh-sm)";e.currentTarget.style.transform="none";e.currentTarget.style.borderColor="var(--line)";}:undefined}
  >{children}</div>
);

// ---------- Section title ----------
const SectionTitle = ({children, sub, action})=>(
  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
    <div>
      <h2 style={{margin:0,fontSize:18,fontWeight:700,color:"var(--ink)"}}>{children}</h2>
      {sub && <div style={{fontSize:13,color:"var(--muted)",marginTop:2}}>{sub}</div>}
    </div>
    {action}
  </div>
);

// ---------- Badge / pill ----------
const Badge = ({children, fg="var(--teal-700)", bg="var(--teal-50)", dot, style})=>(
  <span style={{
    display:"inline-flex",alignItems:"center",gap:6,
    fontSize:12.5,fontWeight:600,color:fg,background:bg,
    padding:"4px 10px",borderRadius:99,lineHeight:1.4,...style
  }}>
    {dot && <span style={{width:6,height:6,borderRadius:"50%",background:fg}}/>}
    {children}
  </span>
);

const TypePill = ({type})=>{
  const s=typeStyle(type);
  return <Badge fg={s.fg} bg={s.bg} dot>{VISIT_TYPES[type].he}</Badge>;
};

const CallStatus = ({status})=>{
  const map={
    done:{t:"הושלמה",fg:"#2F7D5B",bg:"#E9F5EF",dot:true},
    missed:{t:"נכשלה",fg:"#867667",bg:"#F2EDE7",dot:true},
    escalated:{t:"הוסלמה",fg:"#B91C1C",bg:"#FEF2F2",dot:true},
    active:{t:"בתהליך",fg:"#C2410C",bg:"#FFF3EB",dot:true},
  };
  const m=map[status]||map.done;
  return <span style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:12.5,fontWeight:600,color:m.fg,background:m.bg,padding:"4px 10px",borderRadius:99}}>
    <span style={{width:6,height:6,borderRadius:"50%",background:m.fg, animation: status==="active"?"pulseRing 1.5s infinite":"none"}}/>
    {m.t}
  </span>;
};

// ---------- Urgency meter ----------
const UrgencyMeter = ({value, showLabel=true})=>{
  const c=urgencyColor(value);
  return (
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <div style={{display:"flex",gap:3}}>
        {Array.from({length:10}).map((_,i)=>(
          <span key={i} style={{
            width:7,height:18,borderRadius:3,
            background: i<value? c.bar : "var(--line)",
            transition:"background .3s"
          }}/>
        ))}
      </div>
      {showLabel && <span style={{fontWeight:800,fontSize:15,color:c.fg,minWidth:34}}>{value}<span style={{fontSize:11,color:"var(--faint)",fontWeight:600}}>/10</span></span>}
    </div>
  );
};

// ---------- Tomer avatar / chip ----------
const TomerChip = ({size=28, withName=true})=>(
  <span style={{display:"inline-flex",alignItems:"center",gap:8}}>
    <span style={{
      width:size,height:size,borderRadius:"50%",flexShrink:0,
      background:"linear-gradient(145deg,#F0888B,#DE5A60)",
      display:"grid",placeItems:"center",color:"#fff",
      boxShadow:"0 2px 6px rgba(222,90,96,.35)", position:"relative"
    }}>
      <Icon name="wave" size={size*0.6} sw={2}/>
    </span>
    {withName && <span style={{fontWeight:600,fontSize:13.5,color:"var(--ink-2)"}}>תומר</span>}
  </span>
);

// ---------- Empty state ----------
const EmptyState = ({title, sub, icon="pets"})=>(
  <div style={{textAlign:"center",padding:"54px 20px",animation:"fadeIn .4s"}}>
    <div style={{
      width:74,height:74,borderRadius:"50%",margin:"0 auto 16px",
      background:"var(--teal-50)",color:"var(--teal-400)",
      display:"grid",placeItems:"center", animation:"pawIn .5s var(--ease) both"
    }}>
      <Icon name={icon} size={36} sw={1.6}/>
    </div>
    <div style={{fontWeight:700,fontSize:16.5,color:"var(--ink-2)"}}>{title}</div>
    {sub && <div style={{fontSize:13.5,color:"var(--muted)",marginTop:6,maxWidth:300,marginInline:"auto"}}>{sub}</div>}
  </div>
);

// ---------- Skeleton row ----------
const SkeletonRow = ({h=16, w="100%", style})=> <div className="skeleton" style={{height:h,width:w,...style}}/>;

const SkeletonCard = ()=>(
  <Card>
    <div style={{display:"flex",gap:14,alignItems:"center"}}>
      <div className="skeleton" style={{width:46,height:46,borderRadius:"50%"}}/>
      <div style={{flex:1}}>
        <SkeletonRow w="55%" h={14}/>
        <SkeletonRow w="35%" h={11} style={{marginTop:9}}/>
      </div>
      <SkeletonRow w={60} h={24} style={{borderRadius:99}}/>
    </div>
  </Card>
);

// ---------- Toast system ----------
const ToastCtx = createContext(()=>{});
const useToast = ()=> useContext(ToastCtx);

const ToastProvider = ({children})=>{
  const [toasts,setToasts]=useState([]);
  const push=useCallback((msg, opts={})=>{
    const id=Math.random().toString(36).slice(2);
    setToasts(t=>[...t,{id,msg,...opts}]);
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)), opts.duration||3400);
  },[]);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div style={{position:"fixed",bottom:24,left:24,zIndex:9000,display:"flex",flexDirection:"column",gap:10}}>
        {toasts.map(t=>(
          <div key={t.id} style={{
            display:"flex",alignItems:"center",gap:11,
            background:"var(--ink)",color:"#fff",padding:"13px 16px",
            borderRadius:13,boxShadow:"var(--sh-pop)",animation:"toastIn .3s var(--ease)",
            minWidth:260,maxWidth:380,fontSize:14,fontWeight:500
          }}>
            <span style={{
              width:26,height:26,borderRadius:"50%",flexShrink:0,display:"grid",placeItems:"center",
              background: t.tone==="warn"?"var(--amber-500)":"var(--teal-500)", color:"#fff"
            }}>
              <Icon name={t.icon||"check"} size={16} sw={2.4}/>
            </span>
            <span style={{flex:1}}>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
};

// ---------- Modal shell ----------
const Modal = ({open, onClose, children, width=520, title, sub})=>{
  useEffect(()=>{
    if(!open) return;
    const h=e=>{ if(e.key==="Escape") onClose(); };
    window.addEventListener("keydown",h); return ()=>window.removeEventListener("keydown",h);
  },[open,onClose]);
  if(!open) return null;
  return (
    <div onMouseDown={onClose} style={{
      position:"fixed",inset:0,zIndex:8000,background:"rgba(19,33,31,.42)",
      backdropFilter:"blur(3px)",display:"grid",placeItems:"center",animation:"fadeIn .2s",padding:20
    }}>
      <div onMouseDown={e=>e.stopPropagation()} style={{
        background:"var(--surface)",borderRadius:"var(--r-xl)",width,maxWidth:"100%",
        boxShadow:"var(--sh-pop)",animation:"scaleIn .26s var(--ease)",overflow:"hidden",maxHeight:"90vh",display:"flex",flexDirection:"column"
      }}>
        {(title||sub) && (
          <div style={{padding:"22px 24px 0",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              {title && <h3 style={{margin:0,fontSize:19,fontWeight:700}}>{title}</h3>}
              {sub && <div style={{fontSize:13.5,color:"var(--muted)",marginTop:4}}>{sub}</div>}
            </div>
            <button onClick={onClose} style={{width:34,height:34,borderRadius:9,display:"grid",placeItems:"center",color:"var(--muted)",background:"var(--surface-2)"}}
              onMouseEnter={e=>e.currentTarget.style.background="var(--line-2)"} onMouseLeave={e=>e.currentTarget.style.background="var(--surface-2)"}>
              <Icon name="x" size={18}/>
            </button>
          </div>
        )}
        <div style={{padding:24, overflowY:"auto"}}>{children}</div>
      </div>
    </div>
  );
};

// ---------- Drawer (slides from LEFT in RTL) ----------
const Drawer = ({open, onClose, children, width=440})=>{
  useEffect(()=>{
    if(!open) return;
    const h=e=>{ if(e.key==="Escape") onClose(); };
    window.addEventListener("keydown",h); return ()=>window.removeEventListener("keydown",h);
  },[open,onClose]);
  return (
    <React.Fragment>
      <div onClick={onClose} style={{
        position:"fixed",inset:0,zIndex:7000,background:"rgba(19,33,31,.34)",
        backdropFilter:"blur(2px)", opacity:open?1:0, pointerEvents:open?"auto":"none",
        transition:"opacity .3s"
      }}/>
      <div style={{
        position:"fixed",top:0,bottom:0,left:0,zIndex:7001,width,maxWidth:"94vw",
        background:"var(--surface)",boxShadow:"var(--sh-pop)",
        transform:open?"translateX(0)":"translateX(-104%)",
        transition:"transform .36s var(--ease)", display:"flex",flexDirection:"column"
      }}>
        {open && children}
      </div>
    </React.Fragment>
  );
};

// ---------- Primary / ghost buttons ----------
const Btn = ({children, icon, onClick, variant="primary", size="md", style, type="button"})=>{
  const pads={sm:"7px 13px",md:"10px 18px",lg:"13px 22px"};
  const fz={sm:13,md:14,lg:15};
  const variants={
    primary:{background:"var(--teal-600)",color:"#fff",boxShadow:"0 2px 8px rgba(14,141,130,.28)"},
    ghost:{background:"var(--surface)",color:"var(--ink-2)",border:"1px solid var(--line)"},
    soft:{background:"var(--teal-50)",color:"var(--teal-700)"},
    danger:{background:"var(--red-600)",color:"#fff"},
    dangerSoft:{background:"var(--red-50)",color:"var(--red-700)"},
  };
  return (
    <button type={type} onClick={onClick} style={{
      display:"inline-flex",alignItems:"center",gap:8,justifyContent:"center",
      fontWeight:600,fontSize:fz[size],padding:pads[size],borderRadius:11,
      transition:"filter .18s, transform .12s, box-shadow .2s", ...variants[variant], ...style
    }}
    onMouseEnter={e=>{e.currentTarget.style.filter="brightness(1.04)";}}
    onMouseLeave={e=>{e.currentTarget.style.filter="none";}}
    onMouseDown={e=>{e.currentTarget.style.transform="scale(.97)";}}
    onMouseUp={e=>{e.currentTarget.style.transform="none";}}
    >
      {icon && <Icon name={icon} size={size==="sm"?16:18} sw={2}/>}
      {children}
    </button>
  );
};

Object.assign(window,{
  AnimalAvatar, PersonAvatar, Card, SectionTitle, Badge, TypePill, CallStatus,
  UrgencyMeter, TomerChip, EmptyState, SkeletonRow, SkeletonCard,
  ToastProvider, useToast, Modal, Drawer, Btn,
  hhmm, addMinutes, urgencyColor, typeStyle
});
