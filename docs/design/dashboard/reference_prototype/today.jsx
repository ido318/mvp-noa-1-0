// ===== Screen 1: Today =====
const TODAY_START_H = 8, TODAY_END_H = 19, HOUR_PX = 86;
const NOW_TIME = "13:20"; // demo "current" time

function toMin(t){ const [h,m]=t.split(":").map(Number); return h*60+m; }

const ApptCard = ({appt, onOpen})=>{
  const pet=petById(appt.petId); const client=clientById(appt.clientId);
  const s=typeStyle(appt.type);
  const top=(toMin(appt.start)-TODAY_START_H*60)*(HOUR_PX/60);
  const height=Math.max(appt.dur*(HOUR_PX/60)-6, 44);
  const compact=appt.dur<=30;
  return (
    <div onClick={()=>onOpen(client)} style={{
      position:"absolute", top, height, right:0, left:8,
      background:"var(--surface)", borderRadius:13,
      border:"1px solid var(--line)", borderInlineStart:`4px solid ${s.fg}`,
      boxShadow:"var(--sh-sm)", padding: compact?"8px 12px":"11px 13px",
      cursor:"pointer", overflow:"hidden", transition:"box-shadow .2s, transform .15s",
      display:"flex", alignItems:"center", gap:11
    }}
    onMouseEnter={e=>{e.currentTarget.style.boxShadow="var(--sh-md)";e.currentTarget.style.transform="translateX(-3px)";}}
    onMouseLeave={e=>{e.currentTarget.style.boxShadow="var(--sh-sm)";e.currentTarget.style.transform="none";}}>
      <AnimalAvatar pet={pet} size={compact?32:38}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontWeight:700,fontSize:compact?13.5:14.5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{pet.name}</span>
          <span style={{fontSize:12.5,color:"var(--muted)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>· {client.name}</span>
        </div>
        {!compact && <div style={{fontSize:12.5,color:"var(--faint)",marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{appt.note}</div>}
      </div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:6,flexShrink:0}}>
        <span style={{display:"flex",alignItems:"center",gap:5}}>
          {appt.loc==="home" && <span title="ביקור בית" style={{display:"grid",placeItems:"center",color:"var(--teal-600)"}}><Icon name="home" size={14} sw={2}/></span>}
          <span style={{fontVariantNumeric:"tabular-nums",fontWeight:700,fontSize:13,color:"var(--ink-2)"}}>{appt.start}</span>
        </span>
        {!compact && <span style={{fontSize:11.5,fontWeight:600,color:s.fg,background:s.bg,padding:"2px 8px",borderRadius:99}}>{VISIT_TYPES[appt.type].he}</span>}
      </div>
    </div>
  );
};

const Timeline = ({onOpenClient})=>{
  const hours=[]; for(let h=TODAY_START_H;h<=TODAY_END_H;h++) hours.push(h);
  const nowTop=(toMin(NOW_TIME)-TODAY_START_H*60)*(HOUR_PX/60);
  return (
    <Card pad={0} style={{overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 22px",borderBottom:"1px solid var(--line-2)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{width:34,height:34,borderRadius:10,background:"var(--teal-50)",color:"var(--teal-600)",display:"grid",placeItems:"center"}}><Icon name="today" size={20}/></span>
          <div>
            <div style={{fontWeight:700,fontSize:16}}>לוח התורים של היום</div>
            <div style={{fontSize:12.5,color:"var(--muted)"}}>{APPTS_TODAY.length} תורים מתוכננים · 08:00–19:00</div>
          </div>
        </div>
        <Badge fg="var(--teal-700)" bg="var(--teal-50)" dot>עכשיו {NOW_TIME}</Badge>
      </div>
      <div style={{position:"relative",padding:"6px 22px 22px",maxHeight:"calc(100vh - 280px)",overflowY:"auto"}}>
        <div style={{position:"relative",marginTop:8}}>
          {/* hour grid */}
          <div style={{position:"relative",marginInlineStart:54}}>
            {hours.map((h,i)=>(
              <div key={h} style={{height:HOUR_PX,borderTop:"1px solid var(--line-2)",position:"relative"}}>
                <span style={{position:"absolute",right:-54,top:-9,fontSize:12,fontWeight:600,color:"var(--faint)",fontVariantNumeric:"tabular-nums",width:44,textAlign:"left"}}>
                  {String(h).padStart(2,"0")}:00
                </span>
              </div>
            ))}
            {/* now indicator */}
            <div style={{position:"absolute",top:nowTop,right:0,left:0,zIndex:5,display:"flex",alignItems:"center",pointerEvents:"none"}}>
              <span style={{width:9,height:9,borderRadius:"50%",background:"var(--red-500)",boxShadow:"0 0 0 3px rgba(239,68,68,.18)"}}/>
              <span style={{flex:1,height:2,background:"var(--red-500)",opacity:.85}}/>
            </div>
            {/* appointments */}
            {APPTS_TODAY.map(a=> <ApptCard key={a.id} appt={a} onOpen={onOpenClient}/>)}
          </div>
        </div>
      </div>
    </Card>
  );
};

// ---------- Summary cards ----------
const CallsTodayCard = ({onGoCalls, onOpenCall})=>{
  const done=CALLS.filter(c=>c.status!=="active").length;
  const recent=CALLS.slice(0,3);
  return (
    <Card>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <TomerChip withName={false} size={34}/>
          <div>
            <div style={{fontWeight:700,fontSize:15}}>שיחות שתומר ענה היום</div>
            <div style={{fontSize:12.5,color:"var(--muted)"}}>הסוכן הקולי שלך</div>
          </div>
        </div>
        <div style={{textAlign:"left"}}>
          <div style={{fontSize:28,fontWeight:800,lineHeight:1,color:"var(--teal-700)"}}>{CALLS.length}</div>
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:2}}>
        {recent.map(c=>{
          const client=c.clientId?clientById(c.clientId):null;
          return (
            <button key={c.id} onClick={()=>onOpenCall(c)} style={{
              display:"flex",alignItems:"center",gap:11,padding:"9px 8px",borderRadius:10,textAlign:"start",
              transition:"background .15s"
            }} onMouseEnter={e=>e.currentTarget.style.background="var(--surface-2)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <span style={{fontVariantNumeric:"tabular-nums",fontSize:12.5,fontWeight:600,color:"var(--faint)",width:40}}>{c.time}</span>
              <span style={{flex:1,fontSize:13.5,fontWeight:500,color:"var(--ink-2)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                {client?client.name:"מתקשר לא מזוהה"}
              </span>
              <CallStatus status={c.status}/>
            </button>
          );
        })}
      </div>
      <button onClick={onGoCalls} style={{marginTop:12,width:"100%",padding:"10px",borderRadius:10,background:"var(--surface-2)",color:"var(--teal-700)",fontWeight:600,fontSize:13.5,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}
        onMouseEnter={e=>e.currentTarget.style.background="var(--teal-50)"} onMouseLeave={e=>e.currentTarget.style.background="var(--surface-2)"}>
        לכל השיחות <Icon name="chevron" size={16}/>
      </button>
    </Card>
  );
};

const EscalationsHeroCard = ({onGo})=>{
  const open=ESCALATIONS.filter(e=>e.status==="open").sort((a,b)=>b.urgency-a.urgency);
  const top=open[0];
  return (
    <Card style={{borderColor:"var(--red-100)",boxShadow:"0 6px 22px rgba(220,38,38,.08)",overflow:"hidden",position:"relative"}}>
      <div style={{position:"absolute",top:0,right:0,left:0,height:4,background:"linear-gradient(90deg,var(--red-500),var(--amber-500))"}}/>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,marginTop:2}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{width:36,height:36,borderRadius:10,background:"var(--red-50)",color:"var(--red-600)",display:"grid",placeItems:"center", animation:"pulseRing 2s infinite"}}><Icon name="escalation" size={20}/></span>
          <div>
            <div style={{fontWeight:700,fontSize:15}}>אסקלציות פתוחות</div>
            <div style={{fontSize:12.5,color:"var(--muted)"}}>דורשות את תשומת לבך</div>
          </div>
        </div>
        <div style={{fontSize:28,fontWeight:800,lineHeight:1,color:"var(--red-600)"}}>{open.length}</div>
      </div>
      {top && (()=>{ const pet=petById(top.petId); const client=clientById(top.clientId); const c=urgencyColor(top.urgency);
        return (
          <div style={{background:c.bg,borderRadius:13,padding:"13px 14px",border:`1px solid ${c.ring}`}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:9}}>
              <Badge fg="#fff" bg={c.fg} style={{fontWeight:700}}>הכי דחוף</Badge>
              <UrgencyMeter value={top.urgency}/>
            </div>
            <div style={{fontWeight:700,fontSize:14.5,color:"var(--ink)"}}>{top.reason}</div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8}}>
              <AnimalAvatar pet={pet} size={28}/>
              <span style={{fontSize:13,color:"var(--ink-2)",fontWeight:600}}>{pet.name}</span>
              <span style={{fontSize:12.5,color:"var(--muted)"}}>· {client.name}</span>
              <span style={{marginInlineStart:"auto",fontSize:12,color:"var(--faint)",fontVariantNumeric:"tabular-nums"}}>{top.time}</span>
            </div>
          </div>
        );
      })()}
      <Btn variant="danger" onClick={onGo} style={{width:"100%",marginTop:13}} icon="chevron">טפל באסקלציות</Btn>
    </Card>
  );
};

const StatTile = ({value, label, icon, tone="teal", delta})=>{
  const tones={teal:{fg:"var(--teal-700)",bg:"var(--teal-50)"},amber:{fg:"var(--amber-600)",bg:"var(--amber-50)"},violet:{fg:"#7C5BD6",bg:"#F3ECFB"}};
  const t=tones[tone];
  return (
    <div style={{flex:1,background:"var(--surface)",border:"1px solid var(--line)",borderRadius:14,padding:"15px 16px",boxShadow:"var(--sh-sm)"}}>
      <span style={{width:32,height:32,borderRadius:9,background:t.bg,color:t.fg,display:"grid",placeItems:"center",marginBottom:10}}><Icon name={icon} size={18}/></span>
      <div style={{fontSize:25,fontWeight:800,lineHeight:1,color:"var(--ink)"}}>{value}</div>
      <div style={{fontSize:12.5,color:"var(--muted)",marginTop:4,fontWeight:500}}>{label}</div>
    </div>
  );
};

const TodayScreen = ({nav, onOpenClient, onOpenCall, loading})=>{
  if(loading){
    return (
      <div style={{display:"grid",gridTemplateColumns:"1fr 360px",gap:22,alignItems:"start"}}>
        <Card pad={22}><SkeletonRow w="40%" h={20}/><div style={{marginTop:20,display:"flex",flexDirection:"column",gap:14}}>{Array.from({length:5}).map((_,i)=><SkeletonRow key={i} h={56} style={{borderRadius:13}}/>)}</div></Card>
        <div style={{display:"flex",flexDirection:"column",gap:16}}><SkeletonCard/><SkeletonCard/></div>
      </div>
    );
  }
  return (
    <div className="page-enter">
      <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:22,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontSize:13.5,color:"var(--teal-600)",fontWeight:600,marginBottom:3}}>בוקר טוב, ד״ר נועה 🌤️</div>
          <h1 style={{margin:0,fontSize:26,fontWeight:800,letterSpacing:"-.02em"}}>היום במרפאה</h1>
          <div style={{fontSize:13.5,color:"var(--muted)",marginTop:4}}>{TODAY_LABEL}</div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <StatTile value={APPTS_TODAY.length} label="תורים היום" icon="calendar2" tone="teal"/>
          <StatTile value={CALLS.length} label="שיחות" icon="calls" tone="amber"/>
          <StatTile value="2" label="לקוחות חדשים" icon="clients" tone="violet"/>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 360px",gap:22,alignItems:"start"}}>
        <Timeline onOpenClient={onOpenClient}/>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <EscalationsHeroCard onGo={()=>nav("escalations")}/>
          <CallsTodayCard onGoCalls={()=>nav("calls")} onOpenCall={onOpenCall}/>
        </div>
      </div>
    </div>
  );
};

window.TodayScreen = TodayScreen;
