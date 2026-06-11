// ===== Screen 3: Voice calls =====

// Reusable call detail drawer (used here + on Today)
const CallDrawer = ({call, open, onClose, onOpenClient})=>{
  if(!call) return <Drawer open={open} onClose={onClose}/>;
  const client=call.clientId?clientById(call.clientId):null;
  const transcript = call.status==="missed" ? [] : [
    {who:"tomer", t:"שלום, הגעתם למרפאת Get A Vet, מדבר תומר. איך אפשר לעזור?"},
    {who:"caller", t: call.topic==="מצב חירום" ? "היי, אני ממש מודאג, החיה שלי לא מרגישה טוב מאתמול." : "היי, רציתי לקבוע תור."},
    {who:"tomer", t: call.topic==="מצב חירום" ? "אני מבין שזה מדאיג. ספר לי בדיוק מה קורה — מתי זה התחיל ומה הסימפטומים?" : "בשמחה. מה שם החיה ומה סוג הביקור?"},
    {who:"caller", t: call.summary.split(".")[0]+"."},
    {who:"tomer", t: call.status==="escalated" ? "תודה. זה נשמע כמו מצב שמצריך התייחסות דחופה — אני מעביר את הפרטים לד״ר נועה כעת." : "מעולה, רשמתי הכל. שלחתי לך אישור ב-SMS. יום טוב!"},
  ];
  return (
    <Drawer open={open} onClose={onClose} width={460}>
      <div style={{padding:"22px 24px",borderBottom:"1px solid var(--line-2)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{width:34,height:34,borderRadius:10,background:"var(--teal-50)",color:"var(--teal-600)",display:"grid",placeItems:"center"}}><Icon name="phoneIn" size={19}/></span>
          <div>
            <div style={{fontWeight:700,fontSize:15.5}}>פרטי שיחה</div>
            <div style={{fontSize:12.5,color:"var(--muted)",fontVariantNumeric:"tabular-nums"}}>היום · {call.time}</div>
          </div>
        </div>
        <button onClick={onClose} style={{width:34,height:34,borderRadius:9,display:"grid",placeItems:"center",color:"var(--muted)",background:"var(--surface-2)"}}><Icon name="x" size={18}/></button>
      </div>
      <div style={{padding:"20px 24px",overflowY:"auto",flex:1}}>
        {/* caller block */}
        <div style={{display:"flex",alignItems:"center",gap:13,marginBottom:18}}>
          {client ? <PersonAvatar initials={client.initials} size={48}/> :
            <span style={{width:48,height:48,borderRadius:"50%",background:"var(--surface-2)",border:"1px solid var(--line)",display:"grid",placeItems:"center",color:"var(--faint)"}}><Icon name="user" size={24}/></span>}
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:16}}>{client?client.name:"מתקשר לא מזוהה"}</div>
            <div style={{fontSize:13,color:"var(--muted)",fontVariantNumeric:"tabular-nums",direction:"ltr",textAlign:"right"}}>{call.phone}</div>
          </div>
          <CallStatus status={call.status}/>
        </div>

        {/* meta row */}
        <div style={{display:"flex",gap:10,marginBottom:18}}>
          {[["משך",call.dur,"clock"],["נושא",call.topic,"note"],["סנטימנט",call.sentiment,"wave"]].map(([l,v,ic])=>(
            <div key={l} style={{flex:1,background:"var(--surface-2)",border:"1px solid var(--line-2)",borderRadius:11,padding:"11px 12px"}}>
              <div style={{fontSize:11.5,color:"var(--faint)",fontWeight:600,marginBottom:5,display:"flex",alignItems:"center",gap:5}}><Icon name={ic} size={13}/>{l}</div>
              <div style={{fontSize:13.5,fontWeight:700,color:"var(--ink-2)"}}>{v}</div>
            </div>
          ))}
        </div>

        {/* AI summary */}
        <div style={{background:"linear-gradient(150deg,#FDEFEF,#FEF7F6)",border:"1px solid #F8DADB",borderRadius:14,padding:"15px 16px",marginBottom:18}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:9}}>
            <TomerChip size={26}/>
            <span style={{fontSize:12,fontWeight:700,color:"#C9494E",background:"#fff",padding:"3px 9px",borderRadius:99,display:"inline-flex",alignItems:"center",gap:5}}><Icon name="sparkle" size={13}/>סיכום AI</span>
          </div>
          <p style={{margin:0,fontSize:14,lineHeight:1.6,color:"var(--ink-2)"}}>{call.summary}</p>
        </div>

        {/* transcript */}
        <div style={{fontSize:12.5,fontWeight:700,color:"var(--faint)",marginBottom:11,textTransform:"none"}}>תמליל השיחה</div>
        {transcript.length===0 ? (
          <EmptyState title="אין תמליל" sub="השיחה נותקה לפני שהתקיימה שיחה." icon="phone"/>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {transcript.map((m,i)=>(
              <div key={i} style={{display:"flex",gap:9,flexDirection:m.who==="tomer"?"row":"row-reverse"}}>
                {m.who==="tomer"
                  ? <TomerChip size={28} withName={false}/>
                  : (client?<PersonAvatar initials={client.initials} size={28}/>:<span style={{width:28,height:28,borderRadius:"50%",background:"var(--surface-2)",border:"1px solid var(--line)",display:"grid",placeItems:"center",color:"var(--faint)"}}><Icon name="user" size={15}/></span>)}
                <div style={{
                  maxWidth:"78%",fontSize:13.5,lineHeight:1.5,padding:"9px 12px",borderRadius:13,
                  background:m.who==="tomer"?"#FDEFEF":"var(--surface-2)",
                  color:"var(--ink-2)",
                  borderTopRightRadius:m.who==="tomer"?13:4, borderTopLeftRadius:m.who==="tomer"?4:13
                }}>{m.t}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{padding:"16px 24px",borderTop:"1px solid var(--line-2)",display:"flex",gap:10}}>
        {client && <Btn variant="soft" icon="user" style={{flex:1}} onClick={()=>{onClose();onOpenClient(client);}}>כרטיס לקוח</Btn>}
        <Btn variant="ghost" icon="play" style={{flex:1}}>השמע הקלטה</Btn>
      </div>
    </Drawer>
  );
};

const CallsScreen = ({openCall, onOpenCall})=>{
  const [filter,setFilter]=useState("all");
  const [query,setQuery]=useState("");
  const filters=[["all","הכל"],["done","הושלמו"],["escalated","הוסלמו"],["missed","נכשלו"],["active","פעילות"]];
  const rows=CALLS.filter(c=>{
    if(filter!=="all"&&c.status!==filter) return false;
    if(query){ const client=c.clientId?clientById(c.clientId):null; const hay=`${client?client.name:""} ${c.phone} ${c.topic}`; return hay.includes(query); }
    return true;
  });
  const th={textAlign:"start",fontSize:12,fontWeight:700,color:"var(--faint)",padding:"0 14px 12px"};
  const td={padding:"14px",fontSize:14,color:"var(--ink-2)",verticalAlign:"middle"};

  return (
    <div className="page-enter">
      <div style={{marginBottom:20}}>
        <h1 style={{margin:0,fontSize:24,fontWeight:800}}>שיחות</h1>
        <div style={{fontSize:13.5,color:"var(--muted)",marginTop:4,display:"flex",alignItems:"center",gap:6}}>
          תומר ענה ל-<b style={{color:"var(--teal-700)"}}>{CALLS.length}</b> שיחות היום · <TomerChip size={20}/>
        </div>
      </div>

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:14,flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:6,background:"var(--surface)",border:"1px solid var(--line)",borderRadius:11,padding:4}}>
          {filters.map(([k,l])=>(
            <button key={k} onClick={()=>setFilter(k)} style={{
              padding:"7px 14px",borderRadius:8,fontSize:13.5,fontWeight:600,transition:"all .15s",
              background:filter===k?"var(--teal-600)":"transparent", color:filter===k?"#fff":"var(--muted)"
            }}>{l}</button>
          ))}
        </div>
        <div style={{position:"relative",minWidth:240}}>
          <span style={{position:"absolute",insetInlineStart:12,top:"50%",transform:"translateY(-50%)",color:"var(--faint)"}}><Icon name="search" size={17}/></span>
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="חיפוש לפי שם, טלפון, נושא…" style={{
            width:"100%",padding:"10px 38px 10px 12px",borderRadius:11,border:"1px solid var(--line)",background:"var(--surface)",fontSize:13.5
          }}/>
        </div>
      </div>

      <Card pad={0} style={{overflow:"hidden"}}>
        {rows.length===0 ? <EmptyState title="לא נמצאו שיחות" sub="נסה לשנות את הסינון או החיפוש." icon="phone"/> : (
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{borderBottom:"1px solid var(--line)"}}>
            <th style={{...th,paddingTop:16}}>שעה</th><th style={{...th,paddingTop:16}}>מתקשר</th>
            <th style={{...th,paddingTop:16}}>לקוח מזוהה</th><th style={{...th,paddingTop:16}}>משך</th>
            <th style={{...th,paddingTop:16}}>נושא</th><th style={{...th,paddingTop:16}}>סטטוס</th>
            <th style={{...th,paddingTop:16}}>נענה ע״י</th><th style={{...th,paddingTop:16,width:30}}></th>
          </tr></thead>
          <tbody>
            {rows.map((c,i)=>{ const client=c.clientId?clientById(c.clientId):null;
              return (
              <tr key={c.id} onClick={()=>onOpenCall(c)} style={{borderBottom:i<rows.length-1?"1px solid var(--line-2)":"none",cursor:"pointer",transition:"background .15s"}}
                onMouseEnter={e=>e.currentTarget.style.background="var(--surface-2)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <td style={{...td,fontVariantNumeric:"tabular-nums",fontWeight:700,color:"var(--ink)"}}>{c.time}</td>
                <td style={{...td,fontVariantNumeric:"tabular-nums",direction:"ltr",textAlign:"right"}}>{c.phone}</td>
                <td style={td}>
                  {client ? <span style={{display:"inline-flex",alignItems:"center",gap:9}}><PersonAvatar initials={client.initials} size={30}/><b style={{fontWeight:600}}>{client.name}</b></span>
                    : <span style={{color:"var(--faint)",fontStyle:"normal"}}>לא מזוהה</span>}
                </td>
                <td style={{...td,fontVariantNumeric:"tabular-nums"}}>{c.dur}</td>
                <td style={td}>{c.topic}</td>
                <td style={td}><CallStatus status={c.status}/></td>
                <td style={td}><TomerChip size={24}/></td>
                <td style={{...td,color:"var(--faint)"}}><Icon name="chevron" size={16}/></td>
              </tr>
            );})}
          </tbody>
        </table>
        )}
      </Card>
    </div>
  );
};

window.CallDrawer = CallDrawer;
window.CallsScreen = CallsScreen;
