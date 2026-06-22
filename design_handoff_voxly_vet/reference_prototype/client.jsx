// ===== Screen 5: Clients list + profile =====

const ClientsScreen = ({onOpenClient})=>{
  const [q,setQ]=useState("");
  const list=CLIENTS.filter(c=> !q || c.name.includes(q) || c.phone.includes(q) || c.pets.some(p=>p.name.includes(q)));
  return (
    <div className="page-enter">
      <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <h1 style={{margin:0,fontSize:24,fontWeight:800}}>לקוחות</h1>
          <div style={{fontSize:13.5,color:"var(--muted)",marginTop:4}}>{CLIENTS.length} לקוחות רשומים במרפאה</div>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <div style={{position:"relative",minWidth:240}}>
            <span style={{position:"absolute",insetInlineStart:12,top:"50%",transform:"translateY(-50%)",color:"var(--faint)"}}><Icon name="search" size={17}/></span>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="חיפוש לקוח או חיה…" style={{width:"100%",padding:"10px 38px 10px 12px",borderRadius:11,border:"1px solid var(--line)",background:"var(--surface)",fontSize:13.5}}/>
          </div>
          <Btn icon="plus">לקוח חדש</Btn>
        </div>
      </div>

      {list.length===0 ? <Card><EmptyState title="לא נמצאו לקוחות" sub="נסה חיפוש אחר." icon="clients"/></Card> : (
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(330px,1fr))",gap:16}}>
        {list.map(c=>(
          <Card key={c.id} hover onClick={()=>onOpenClient(c)} pad={18}>
            <div style={{display:"flex",alignItems:"center",gap:13}}>
              <PersonAvatar initials={c.initials} size={48}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:15.5}}>{c.name}</div>
                <div style={{fontSize:12.5,color:"var(--muted)",fontVariantNumeric:"tabular-nums",direction:"ltr",textAlign:"right"}}>{c.phone}</div>
              </div>
              <span style={{color:"var(--faint)"}}><Icon name="chevron" size={18}/></span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginTop:15,paddingTop:14,borderTop:"1px solid var(--line-2)"}}>
              <div style={{display:"flex"}}>
                {c.pets.map((p,i)=>(
                  <div key={p.id} style={{marginInlineStart:i?-10:0,border:"2px solid var(--surface)",borderRadius:"50%"}}>
                    <AnimalAvatar pet={p} size={34} ring={false}/>
                  </div>
                ))}
              </div>
              <span style={{fontSize:13,color:"var(--muted)"}}>{c.pets.map(p=>p.name).join(" · ")}</span>
              <span style={{marginInlineStart:"auto",fontSize:12,color:"var(--faint)"}}>{c.city}</span>
            </div>
          </Card>
        ))}
      </div>
      )}
    </div>
  );
};

const InfoRow = ({icon, label, value, ltr})=>(
  <div style={{display:"flex",alignItems:"center",gap:11,padding:"10px 0",borderBottom:"1px solid var(--line-2)"}}>
    <span style={{width:32,height:32,borderRadius:9,background:"var(--surface-2)",color:"var(--teal-600)",display:"grid",placeItems:"center",flexShrink:0}}><Icon name={icon} size={17}/></span>
    <span style={{fontSize:13,color:"var(--muted)",width:54,flexShrink:0}}>{label}</span>
    <span style={{fontSize:13.5,fontWeight:600,color:"var(--ink-2)",whiteSpace:"nowrap",...(ltr?{direction:"ltr",marginInlineStart:"auto"}:{marginInlineStart:"auto"})}}>{value}</span>
  </div>
);

const PetCard = ({pet})=>(
  <div style={{background:"var(--surface)",border:"1px solid var(--line)",borderRadius:14,padding:16,boxShadow:"var(--sh-sm)"}}>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:13}}>
      <AnimalAvatar pet={pet} size={48}/>
      <div>
        <div style={{fontWeight:700,fontSize:16}}>{pet.name}</div>
        <div style={{fontSize:12.5,color:"var(--muted)"}}>{SPECIES[pet.species].he} · {pet.breed}</div>
      </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
      {[["מין",pet.sex],["גיל",pet.age],["משקל",pet.weight],["צבע","—"]].slice(0,3).map(([l,v])=>(
        <div key={l} style={{background:"var(--surface-2)",borderRadius:9,padding:"8px 10px"}}>
          <div style={{fontSize:11,color:"var(--faint)",fontWeight:600}}>{l}</div>
          <div style={{fontSize:13,fontWeight:700,color:"var(--ink-2)",marginTop:2}}>{v}</div>
        </div>
      ))}
    </div>
  </div>
);

const Timeline2 = ({events})=>(
  <div style={{position:"relative",paddingInlineStart:22}}>
    <div style={{position:"absolute",insetInlineStart:6,top:6,bottom:6,width:2,background:"var(--line)"}}/>
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {events.map((e,i)=>(
        <div key={i} style={{position:"relative"}}>
          <span style={{position:"absolute",insetInlineStart:-22,top:3,width:14,height:14,borderRadius:"50%",background:e.color||"var(--teal-500)",border:"3px solid var(--surface)",boxShadow:"0 0 0 1.5px var(--line)"}}/>
          <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:8}}>
            <span style={{fontWeight:600,fontSize:14,color:"var(--ink-2)"}}>{e.title}</span>
            <span style={{fontSize:12,color:"var(--faint)",fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>{e.date}</span>
          </div>
          {e.note && <div style={{fontSize:13,color:"var(--muted)",marginTop:3,lineHeight:1.5}}>{e.note}</div>}
        </div>
      ))}
    </div>
  </div>
);

const ClientProfile = ({client, onBack, onOpenCall})=>{
  const [tab,setTab]=useState("visits");
  const calls=CALLS.filter(c=>c.clientId===client.id);
  const pA=client.pets[0].name; const pB=client.pets[1]?client.pets[1].name:pA;
  const visits=[
    {title:`בדיקה כללית — ${pA}`,date:"15.04.2026",note:"מצב כללי תקין, עודכנו חיסונים.",color:"var(--t-checkup)"},
    {title:`חיסון משושה — ${pB}`,date:"02.01.2026",note:"ניתן ללא תופעות לוואי.",color:"var(--t-vaccine)"},
    {title:`מעקב רפואי — ${pA}`,date:"20.11.2025",note:"בדיקת דם שגרתית — תוצאות תקינות.",color:"var(--t-followup)"},
  ];
  const medical=client.pets.flatMap(p=>(MEDICAL[p.id]||[]).map(m=>({...m,pet:p.name}))).slice(0,4);
  const tabs=[["visits","היסטוריית ביקורים"],["calls","שיחות עם תומר"],["medical","תיעוד רפואי"]];
  return (
    <div className="page-enter">
      <button onClick={onBack} style={{display:"inline-flex",alignItems:"center",gap:7,fontSize:13.5,fontWeight:600,color:"var(--muted)",marginBottom:16}}
        onMouseEnter={e=>e.currentTarget.style.color="var(--teal-700)"} onMouseLeave={e=>e.currentTarget.style.color="var(--muted)"}>
        <Icon name="chevR" size={17}/> חזרה ללקוחות
      </button>

      <div style={{display:"grid",gridTemplateColumns:"320px 1fr",gap:22,alignItems:"start"}}>
        {/* left: identity */}
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Card>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",textAlign:"center",paddingBottom:6}}>
              <PersonAvatar initials={client.initials} size={72}/>
              <div style={{fontWeight:800,fontSize:19,marginTop:12}}>{client.name}</div>
              <div style={{fontSize:13,color:"var(--muted)",marginTop:3}}>לקוח/ה מאז {client.since}</div>
              <div style={{display:"flex",gap:8,marginTop:14}}>
                <Btn variant="soft" size="sm" icon="phone">התקשר</Btn>
                <Btn variant="ghost" size="sm" icon="mail">הודעה</Btn>
              </div>
            </div>
            <div style={{marginTop:8}}>
              <InfoRow icon="phone" label="טלפון" value={client.phone} ltr/>
              <InfoRow icon="mail" label="אימייל" value={client.email} ltr/>
              <InfoRow icon="pin" label="עיר" value={client.city}/>
            </div>
          </Card>
        </div>

        {/* right: pets + history */}
        <div style={{display:"flex",flexDirection:"column",gap:20}}>
          <div>
            <SectionTitle sub={`${client.pets.length} חיות מחמד רשומות`}>חיות מחמד</SectionTitle>
            <div style={{display:"grid",gridTemplateColumns:client.pets.length>1?"1fr 1fr":"1fr",gap:14}}>
              {client.pets.map(p=> <PetCard key={p.id} pet={p}/>)}
            </div>
          </div>

          <Card pad={0}>
            <div style={{display:"flex",gap:4,padding:"6px",borderBottom:"1px solid var(--line-2)"}}>
              {tabs.map(([k,l])=>(
                <button key={k} onClick={()=>setTab(k)} style={{
                  padding:"9px 16px",borderRadius:9,fontSize:13.5,fontWeight:600,transition:"all .15s",
                  background:tab===k?"var(--teal-50)":"transparent",color:tab===k?"var(--teal-700)":"var(--muted)"
                }}>{l}</button>
              ))}
            </div>
            <div style={{padding:22}}>
              {tab==="visits" && <Timeline2 events={visits}/>}
              {tab==="calls" && (calls.length? (
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {calls.map(c=>(
                    <button key={c.id} onClick={()=>onOpenCall(c)} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 13px",borderRadius:12,border:"1px solid var(--line-2)",textAlign:"start",transition:"all .15s"}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--teal-200)";e.currentTarget.style.background="var(--surface-2)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--line-2)";e.currentTarget.style.background="transparent";}}>
                      <TomerChip size={32} withName={false}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13.5,fontWeight:600,color:"var(--ink-2)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.summary}</div>
                        <div style={{fontSize:12,color:"var(--faint)",marginTop:3,fontVariantNumeric:"tabular-nums"}}>היום {c.time} · {c.dur} · {c.topic}</div>
                      </div>
                      <CallStatus status={c.status}/>
                    </button>
                  ))}
                </div>
              ): <EmptyState title="אין שיחות" sub="עדיין לא התקבלו שיחות מלקוח זה." icon="phone"/>)}
              {tab==="medical" && (medical.length? <Timeline2 events={medical.map(m=>({title:`${m.title} — ${m.pet}`,date:m.date,note:m.note,color:"var(--t-surgery)"}))}/> : <EmptyState title="אין תיעוד רפואי" sub="לא קיים תיעוד רפואי שמור." icon="records"/>)}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

window.ClientsScreen = ClientsScreen;
window.ClientProfile = ClientProfile;
