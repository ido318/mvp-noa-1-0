// ===== Screen 2: Calendar (week view) =====
const CAL_START_H = 8, CAL_END_H = 19, CAL_HOUR_PX = 58;
const DAYS = [
  {he:"ראשון", short:"א׳", date:"07"},
  {he:"שני",   short:"ב׳", date:"08"},
  {he:"שלישי", short:"ג׳", date:"09"},
  {he:"רביעי", short:"ד׳", date:"10"},
  {he:"חמישי", short:"ה׳", date:"11"},
  {he:"שישי",  short:"ו׳", date:"12"},
  {he:"שבת",   short:"ש׳", date:"13"},
];
const TODAY_DAY_IDX = 4;

function cmin(t){ const [h,m]=t.split(":").map(Number); return h*60+m; }
function fromMin(min){ const h=Math.floor(min/60), m=min%60; return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`; }

const NewApptModal = ({open, onClose, onCreate, preset})=>{
  const [form,setForm]=useState({clientId:"c1",petId:"p1",type:"checkup",day:4,start:"09:00",dur:30});
  useEffect(()=>{ if(open&&preset) setForm(f=>({...f,...preset})); },[open,preset]);
  const client=clientById(form.clientId);
  const set=(k,v)=>setForm(f=>{ const nf={...f,[k]:v}; if(k==="clientId"){ nf.petId=clientById(v).pets[0].id; } return nf; });
  const field={display:"block",fontSize:12.5,fontWeight:600,color:"var(--ink-2)",marginBottom:6};
  const inp={width:"100%",padding:"10px 12px",borderRadius:10,border:"1px solid var(--line)",background:"var(--surface-2)",fontSize:14,color:"var(--ink)",appearance:"none"};
  return (
    <Modal open={open} onClose={onClose} title="תור חדש" sub="קביעת תור במרפאה" width={520}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div style={{gridColumn:"1 / -1"}}>
          <label style={field}>לקוח</label>
          <select style={inp} value={form.clientId} onChange={e=>set("clientId",e.target.value)}>
            {CLIENTS.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label style={field}>חיית מחמד</label>
          <select style={inp} value={form.petId} onChange={e=>set("petId",e.target.value)}>
            {client.pets.map(p=><option key={p.id} value={p.id}>{p.name} · {SPECIES[p.species].he}</option>)}
          </select>
        </div>
        <div>
          <label style={field}>סוג ביקור</label>
          <select style={inp} value={form.type} onChange={e=>set("type",e.target.value)}>
            {Object.entries(VISIT_TYPES).map(([k,v])=><option key={k} value={k}>{v.he}</option>)}
          </select>
        </div>
        <div>
          <label style={field}>יום</label>
          <select style={inp} value={form.day} onChange={e=>set("day",Number(e.target.value))}>
            {DAYS.map((d,i)=><option key={i} value={i}>{d.he} {d.date}.06</option>)}
          </select>
        </div>
        <div>
          <label style={field}>שעת התחלה</label>
          <input type="time" style={inp} value={form.start} onChange={e=>set("start",e.target.value)}/>
        </div>
        <div style={{gridColumn:"1 / -1"}}>
          <label style={field}>משך (דקות)</label>
          <div style={{display:"flex",gap:8}}>
            {[30,45,60,90].map(d=>(
              <button key={d} onClick={()=>set("dur",d)} style={{
                flex:1,padding:"9px",borderRadius:10,fontWeight:600,fontSize:13.5,
                border:`1px solid ${form.dur===d?"var(--teal-500)":"var(--line)"}`,
                background:form.dur===d?"var(--teal-50)":"var(--surface-2)",
                color:form.dur===d?"var(--teal-700)":"var(--muted)"
              }}>{d}׳</button>
            ))}
          </div>
        </div>
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"flex-start",marginTop:24}}>
        <Btn onClick={()=>onCreate(form)} icon="check">קבע תור</Btn>
        <Btn variant="ghost" onClick={onClose}>ביטול</Btn>
      </div>
    </Modal>
  );
};

const CalendarScreen = ({onOpenClient})=>{
  const [appts,setAppts]=useState(()=>WEEK_APPTS.map(a=>({...a})));
  const [modal,setModal]=useState(false);
  const [preset,setPreset]=useState(null);
  const [drag,setDrag]=useState(null); // {id, grabOffsetMin}
  const [hoverNew,setHoverNew]=useState(null);
  const bodyRef=useRef(null);
  const toast=useToast();
  const hours=[]; for(let h=CAL_START_H;h<CAL_END_H;h++) hours.push(h);
  const pxPerMin=CAL_HOUR_PX/60;

  const geom=()=>{
    const el=bodyRef.current; if(!el) return null;
    const r=el.getBoundingClientRect();
    return {r, colW:r.width/7, scrollTop:el.scrollTop};
  };

  const onPointerDown=(e,a)=>{
    e.preventDefault();
    const g=geom(); if(!g) return;
    const yMin=CAL_START_H*60 + (e.clientY - g.r.top + g.scrollTop)/pxPerMin;
    setDrag({id:a.id, grabOffsetMin: yMin - cmin(a.start)});
    window.addEventListener("pointermove",onMove);
    window.addEventListener("pointerup",onUp);
  };
  const onMove=useCallback((e)=>{
    const el=bodyRef.current; if(!el) return;
    const r=el.getBoundingClientRect(); const colW=r.width/7;
    setDrag(d=>{
      if(!d) return d;
      // RTL: column 0 on the right
      let col=Math.floor((r.right - e.clientX)/colW); col=Math.max(0,Math.min(6,col));
      let yMin=CAL_START_H*60 + (e.clientY - r.top + el.scrollTop)/pxPerMin - d.grabOffsetMin;
      yMin=Math.round(yMin/15)*15;
      setAppts(prev=>prev.map(a=>{
        if(a.id!==d.id) return a;
        const maxStart=CAL_END_H*60 - a.dur;
        const ny=Math.max(CAL_START_H*60, Math.min(maxStart, yMin));
        return {...a, day:col, start:fromMin(ny)};
      }));
      return d;
    });
  },[]);
  const onUp=useCallback(()=>{
    window.removeEventListener("pointermove",onMove);
    window.removeEventListener("pointerup",onUp);
    setDrag(d=>{ if(d){ const a=document.querySelector("body"); } return null; });
    setTimeout(()=>toast("התור עודכן ✓ נשלחה הודעת אישור ללקוח",{icon:"calendar2"}),60);
  },[onMove,toast]);

  const create=(form)=>{
    const id="n"+Math.random().toString(36).slice(2,6);
    setAppts(p=>[...p,{...form,id}]);
    setModal(false);
    toast(`נקבע תור חדש — ${VISIT_TYPES[form.type].he} ביום ${DAYS[form.day].he}`,{icon:"check"});
  };

  const openNewAt=(day,hour)=>{ setPreset({day,start:`${String(hour).padStart(2,"0")}:00`}); setModal(true); };

  return (
    <div className="page-enter">
      <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <h1 style={{margin:0,fontSize:24,fontWeight:800}}>יומן</h1>
          <div style={{fontSize:13.5,color:"var(--muted)",marginTop:4}}>7–13 ביוני 2026 · גרור תור כדי לשנות מועד</div>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:2,background:"var(--surface)",border:"1px solid var(--line)",borderRadius:10,padding:3}}>
            <button style={{width:32,height:32,borderRadius:8,display:"grid",placeItems:"center",color:"var(--muted)"}} onMouseEnter={e=>e.currentTarget.style.background="var(--surface-2)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}><Icon name="chevR" size={18}/></button>
            <span style={{fontSize:13.5,fontWeight:600,padding:"0 10px",color:"var(--ink-2)"}}>השבוע</span>
            <button style={{width:32,height:32,borderRadius:8,display:"grid",placeItems:"center",color:"var(--muted)"}} onMouseEnter={e=>e.currentTarget.style.background="var(--surface-2)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}><Icon name="chevL" size={18}/></button>
          </div>
          <Btn icon="plus" onClick={()=>{setPreset(null);setModal(true);}}>תור חדש</Btn>
        </div>
      </div>

      {/* legend */}
      <div style={{display:"flex",gap:16,marginBottom:14,flexWrap:"wrap"}}>
        {Object.entries(VISIT_TYPES).map(([k,v])=>{ const s=typeStyle(k); return (
          <span key={k} style={{display:"inline-flex",alignItems:"center",gap:7,fontSize:12.5,color:"var(--muted)",fontWeight:500}}>
            <span style={{width:11,height:11,borderRadius:4,background:s.fg}}/>{v.he}
          </span>
        );})}
      </div>

      <Card pad={0} style={{overflow:"hidden"}}>
        {/* day headers */}
        <div style={{display:"grid",gridTemplateColumns:"54px repeat(7,1fr)",borderBottom:"1px solid var(--line)"}}>
          <div/>
          {DAYS.map((d,i)=>(
            <div key={i} style={{padding:"13px 6px",textAlign:"center",borderInlineStart:"1px solid var(--line-2)",background:i===TODAY_DAY_IDX?"var(--teal-50)":"transparent"}}>
              <div style={{fontSize:12.5,color:i===TODAY_DAY_IDX?"var(--teal-700)":"var(--muted)",fontWeight:600}}>{d.he}</div>
              <div style={{fontSize:18,fontWeight:800,marginTop:2,color:i===TODAY_DAY_IDX?"var(--teal-700)":"var(--ink)"}}>{d.date}</div>
            </div>
          ))}
        </div>
        {/* body */}
        <div ref={bodyRef} style={{position:"relative",maxHeight:"calc(100vh - 320px)",overflowY:"auto"}}>
          <div style={{display:"grid",gridTemplateColumns:"54px repeat(7,1fr)",position:"relative"}}>
            {/* hour gutter */}
            <div>
              {hours.map(h=>(
                <div key={h} style={{height:CAL_HOUR_PX,position:"relative"}}>
                  <span style={{position:"absolute",right:8,top:-8,fontSize:11.5,fontWeight:600,color:"var(--faint)",fontVariantNumeric:"tabular-nums"}}>{String(h).padStart(2,"0")}:00</span>
                </div>
              ))}
            </div>
            {/* day columns */}
            {DAYS.map((d,di)=>(
              <div key={di} style={{position:"relative",borderInlineStart:"1px solid var(--line-2)",background:di===TODAY_DAY_IDX?"rgba(15,181,168,.03)":"transparent"}}>
                {hours.map(h=>(
                  <div key={h} onClick={()=>openNewAt(di,h)} style={{height:CAL_HOUR_PX,borderTop:"1px solid var(--line-2)",cursor:"copy",transition:"background .12s"}}
                    onMouseEnter={e=>{e.currentTarget.style.background="rgba(15,181,168,.06)";}}
                    onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}/>
                ))}
                {appts.filter(a=>a.day===di).map(a=>{
                  const pet=petById(a.petId); const client=clientById(a.clientId); const s=typeStyle(a.type);
                  const top=(cmin(a.start)-CAL_START_H*60)*pxPerMin;
                  const height=Math.max(a.dur*pxPerMin-3,26);
                  const isDrag=drag&&drag.id===a.id;
                  return (
                    <div key={a.id} onPointerDown={e=>onPointerDown(e,a)} style={{
                      position:"absolute",top,height,right:2,left:2,
                      background:s.bg,borderRadius:8,borderInlineStart:`3px solid ${s.fg}`,
                      padding:"4px 7px",overflow:"hidden",cursor:isDrag?"grabbing":"grab",
                      boxShadow:isDrag?"var(--sh-lg)":"none",zIndex:isDrag?50:1,
                      transition:isDrag?"none":"box-shadow .15s",userSelect:"none",
                      transform:isDrag?"scale(1.02)":"none"
                    }}>
                      <div style={{display:"flex",alignItems:"center",gap:5}}>
                        <AnimalIcon species={pet.species} size={13} sw={2}/>
                        <span style={{fontSize:11.5,fontWeight:700,color:s.fg,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{pet.name}</span>
                      </div>
                      {height>40 && <div style={{fontSize:10.5,color:"var(--ink-2)",marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{a.start} · {VISIT_TYPES[a.type].he}</div>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </Card>

      <NewApptModal open={modal} onClose={()=>setModal(false)} onCreate={create} preset={preset}/>
    </div>
  );
};

window.CalendarScreen = CalendarScreen;
