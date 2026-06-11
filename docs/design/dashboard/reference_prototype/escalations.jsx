// ===== Screen 4: Escalations =====
const EscalationCard = ({esc, onResolve, onOpenClient, onOpenCall}, idx)=>{
  const pet=petById(esc.petId); const client=clientById(esc.clientId);
  const c=urgencyColor(esc.urgency);
  const critical=esc.urgency>=8;
  const resolved=esc.status==="resolved";
  const [note,setNote]=useState("");
  const [expanded,setExpanded]=useState(false);
  return (
    <div style={{
      background:"var(--surface)",borderRadius:"var(--r-lg)",
      border:`1px solid ${critical&&!resolved?"var(--red-500)":"var(--line)"}`,
      boxShadow: critical&&!resolved?"0 6px 22px rgba(220,38,38,.12)":"var(--sh-sm)",
      overflow:"hidden", opacity:resolved?.62:1, position:"relative",
      transition:"opacity .3s"
    }}>
      {critical&&!resolved && <div style={{position:"absolute",insetInlineStart:0,top:0,bottom:0,width:4,background:"var(--red-500)"}}/>}
      <div style={{padding:"18px 20px"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:14}}>
          <div style={{display:"flex",alignItems:"center",gap:12,flex:1,minWidth:0}}>
            <span style={{width:42,height:42,borderRadius:11,background:c.bg,color:c.fg,display:"grid",placeItems:"center",flexShrink:0,animation:critical&&!resolved?"pulseRing 2s infinite":"none"}}>
              <Icon name="escalation" size={22}/>
            </span>
            <div style={{minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <span style={{fontWeight:700,fontSize:16}}>{esc.reason}</span>
                {critical&&!resolved && <Badge fg="#fff" bg="var(--red-600)">קריטי</Badge>}
                {resolved && <Badge fg="var(--teal-700)" bg="var(--teal-50)" dot>טופל</Badge>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6}}>
                <AnimalAvatar pet={pet} size={26}/>
                <span style={{fontSize:13.5,fontWeight:600,color:"var(--ink-2)"}}>{pet.name}</span>
                <span style={{fontSize:12.5,color:"var(--muted)"}}>· {client.name} · {SPECIES[pet.species].he}</span>
                <span style={{fontSize:12,color:"var(--faint)",fontVariantNumeric:"tabular-nums",display:"inline-flex",alignItems:"center",gap:4}}><Icon name="clock" size={13}/>{esc.time}</span>
              </div>
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:8,flexShrink:0}}>
            <UrgencyMeter value={esc.urgency}/>
          </div>
        </div>

        <p style={{margin:"14px 0 0",fontSize:13.5,lineHeight:1.6,color:"var(--ink-2)",background:"var(--surface-2)",borderRadius:11,padding:"12px 14px"}}>{esc.detail}</p>

        {!resolved && (
          <div style={{marginTop:14}}>
            {expanded ? (
              <div style={{animation:"fadeIn .2s"}}>
                <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="הוסף הערת טיפול (אופציונלי)…" rows={2} style={{
                  width:"100%",padding:"10px 12px",borderRadius:11,border:"1px solid var(--line)",background:"var(--surface-2)",fontSize:13.5,resize:"vertical",lineHeight:1.5,marginBottom:10
                }}/>
                <div style={{display:"flex",gap:10}}>
                  <Btn icon="check" onClick={()=>onResolve(esc.id,note)}>סמן כטופל</Btn>
                  <Btn variant="ghost" onClick={()=>setExpanded(false)}>ביטול</Btn>
                </div>
              </div>
            ) : (
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                <Btn icon="checkCircle" onClick={()=>setExpanded(true)}>טופל</Btn>
                {esc.callId && <Btn variant="ghost" icon="phoneIn" onClick={()=>onOpenCall(CALLS.find(x=>x.id===esc.callId))}>צפה בשיחה</Btn>}
                <Btn variant="ghost" icon="user" onClick={()=>onOpenClient(client)}>כרטיס לקוח</Btn>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const EscalationsScreen = ({onOpenClient, onOpenCall})=>{
  const [items,setItems]=useState(()=>ESCALATIONS.map(e=>({...e})));
  const toast=useToast();
  const open=items.filter(e=>e.status==="open").sort((a,b)=>b.urgency-a.urgency);
  const resolved=items.filter(e=>e.status==="resolved");
  const resolve=(id,note)=>{
    setItems(p=>p.map(e=>e.id===id?{...e,status:"resolved"}:e));
    toast("האסקלציה סומנה כטופלה ✓",{icon:"checkCircle"});
  };
  return (
    <div className="page-enter">
      <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <h1 style={{margin:0,fontSize:24,fontWeight:800}}>אסקלציות</h1>
          <div style={{fontSize:13.5,color:"var(--muted)",marginTop:4}}>מקרים שתומר העביר אליך — ממוינים לפי דחיפות</div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <Badge fg="var(--red-700)" bg="var(--red-50)" dot style={{fontSize:13,padding:"7px 13px"}}>{open.length} פתוחות</Badge>
          <Badge fg="var(--teal-700)" bg="var(--teal-50)" dot style={{fontSize:13,padding:"7px 13px"}}>{resolved.length} טופלו</Badge>
        </div>
      </div>

      {open.length===0 ? (
        <Card><EmptyState title="אין אסקלציות פתוחות 🐾" sub="תומר מטפל בכל השיחות הרגילות. כל הכבוד — הכל תחת שליטה!" icon="checkCircle"/></Card>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {open.map(e=> <EscalationCard key={e.id} esc={e} onResolve={resolve} onOpenClient={onOpenClient} onOpenCall={onOpenCall}/>)}
        </div>
      )}

      {resolved.length>0 && (
        <div style={{marginTop:28}}>
          <div style={{fontSize:13,fontWeight:700,color:"var(--faint)",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
            <Icon name="check" size={16}/> טופלו היום
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {resolved.map(e=> <EscalationCard key={e.id} esc={e} onResolve={resolve} onOpenClient={onOpenClient} onOpenCall={onOpenCall}/>)}
          </div>
        </div>
      )}
    </div>
  );
};

window.EscalationsScreen = EscalationsScreen;
