// ===== Visit Summary drawer — where ד״ר נועה documents a visit =====
const VISIT_STATUSES = [
  { k:"waiting",   label:"ממתין",  icon:"clock",       fg:"#867667", bg:"#F2EDE7", solid:"#867667" },
  { k:"in",        label:"בטיפול", icon:"play",        fg:"#C2410C", bg:"#FFF3EB", solid:"#E0696D" },
  { k:"done",      label:"הושלם",  icon:"checkCircle", fg:"#2F7D5B", bg:"#E9F5EF", solid:"#2F7D5B" },
  { k:"cancelled", label:"בוטל",   icon:"x",           fg:"#B91C1C", bg:"#FEF2F2", solid:"#B91C1C" },
];

function aiDraft(visit){
  if(!visit) return "";
  const pet=petById(visit.petId);
  const t=VISIT_TYPES[visit.type].he;
  const lines={
    checkup:`בוצעה בדיקה כללית ל${pet.name}. סימנים חיוניים תקינים, משקל יציב. לא נמצאו ממצאים חריגים. מומלץ מעקב שגרתי בעוד 6 חודשים.`,
    vaccine:`ניתן חיסון ל${pet.name} לפי לוח החיסונים. ${pet.name} הגיב/ה היטב, לא נצפו תופעות לוואי מיידיות. תזכורת לחיסון הבא תישלח אוטומטית.`,
    surgery:`בוצע ההליך הכירורגי המתוכנן ל${pet.name}. ההליך עבר ללא סיבוכים. ניתנו הנחיות החלמה וצום. מעקב נדרש בעוד 10 ימים להסרת תפרים.`,
    followup:`ביקור מעקב ל${pet.name}. נצפה שיפור במצב הכללי בהשוואה לביקור הקודם. הטיפול ממשיך כמתוכנן.`,
    grooming:`בוצע טיפוח ל${pet.name}. מצב העור והפרווה תקין.`,
  };
  return lines[visit.type]||`בוצע ${t} ל${pet.name}.`;
}

const VisitDrawer = ({visit, open, onClose, onOpenClient})=>{
  const toast = useToast();
  const [status,setStatus]=useState("done");
  const [aiApproved,setAiApproved]=useState(false);
  const [summary,setSummary]=useState("");
  const [notes,setNotes]=useState("");
  const [editingAi,setEditingAi]=useState(false);
  useEffect(()=>{ if(open&&visit){ setStatus("done"); setAiApproved(false); setSummary(""); setNotes(""); setEditingAi(false); } },[open,visit]);
  if(!visit) return <Drawer open={open} onClose={onClose}/>;
  const pet=petById(visit.petId); const client=clientById(visit.clientId); const s=typeStyle(visit.type);
  const draft=aiDraft(visit);

  const field={width:"100%",padding:"13px 15px",borderRadius:13,border:"1px solid var(--line)",background:"var(--surface-2)",fontSize:15,color:"var(--ink)",lineHeight:1.6,resize:"vertical",fontFamily:"inherit"};
  const sectionLabel={fontSize:14,fontWeight:700,color:"var(--ink)",marginBottom:12,display:"flex",alignItems:"center",gap:8};

  return (
    <Drawer open={open} onClose={onClose} width={540}>
      {/* header */}
      <div style={{padding:"22px 26px",borderBottom:"1px solid var(--line-2)",display:"flex",alignItems:"center",gap:14}}>
        <AnimalAvatar pet={pet} size={52}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:9}}>
            <span style={{fontWeight:800,fontSize:19}}>{pet.name}</span>
            <span style={{fontSize:11.5,fontWeight:600,color:s.fg,background:s.bg,padding:"3px 10px",borderRadius:99}}>{VISIT_TYPES[visit.type].he}</span>
          </div>
          <div style={{fontSize:13.5,color:"var(--muted)",marginTop:3}}>{client.name} · {SPECIES[pet.species].he} · {pet.breed}</div>
        </div>
        <button onClick={onClose} style={{width:36,height:36,borderRadius:10,display:"grid",placeItems:"center",color:"var(--muted)",background:"var(--surface-2)",flexShrink:0}}><Icon name="x" size={19}/></button>
      </div>

      <div style={{padding:"22px 26px",overflowY:"auto",flex:1,display:"flex",flexDirection:"column",gap:26}}>
        {/* time strip */}
        <div style={{display:"flex",gap:10}}>
          {[["שעה",`${visit.start}`,"clock"],["סוג ביקור",VISIT_TYPES[visit.type].he,"note"],["מיקום",visit.loc==="home"?"ביקור בית":"במרפאה",visit.loc==="home"?"home":"pin"]].map(([l,v,ic])=>(
            <div key={l} style={{flex:1,background:"var(--surface-2)",border:"1px solid var(--line-2)",borderRadius:12,padding:"11px 13px"}}>
              <div style={{fontSize:11.5,color:"var(--faint)",fontWeight:600,marginBottom:5,display:"flex",alignItems:"center",gap:5}}><Icon name={ic} size={13}/>{l}</div>
              <div style={{fontSize:14,fontWeight:700,color:"var(--ink-2)"}}>{v}</div>
            </div>
          ))}
        </div>

        {/* STATUS — big clear buttons */}
        <div>
          <div style={sectionLabel}><Icon name="checkCircle" size={17}/> סטטוס הביקור</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {VISIT_STATUSES.map(st=>{
              const active=status===st.k;
              return (
                <button key={st.k} onClick={()=>{setStatus(st.k);toast(`הסטטוס עודכן ל"${st.label}"`,{icon:"check"});}} style={{
                  display:"flex",alignItems:"center",justifyContent:"center",gap:9,
                  padding:"15px",borderRadius:14,fontWeight:700,fontSize:15.5,
                  border:`1.5px solid ${active?st.solid:"var(--line)"}`,
                  background:active?st.solid:"var(--surface)",
                  color:active?"#fff":st.fg, transition:"all .15s",
                  boxShadow:active?"var(--sh-sm)":"none"
                }}
                onMouseEnter={e=>{if(!active){e.currentTarget.style.background=st.bg;e.currentTarget.style.borderColor=st.solid;}}}
                onMouseLeave={e=>{if(!active){e.currentTarget.style.background="var(--surface)";e.currentTarget.style.borderColor="var(--line)";}}}>
                  <Icon name={st.icon} size={19} sw={2.2}/> {st.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* AI summary */}
        <div>
          <div style={sectionLabel}><TomerChip size={22} withName={false}/> סיכום AI <span style={{fontWeight:500,fontSize:12.5,color:"var(--faint)"}}>· טיוטה לאישור</span></div>
          <div style={{background:"linear-gradient(150deg,#FDEFEF,#FEF7F6)",border:`1px solid ${aiApproved?"#BBE3D2":"#F8DADB"}`,borderRadius:15,padding:"16px 17px"}}>
            {editingAi
              ? <textarea autoFocus defaultValue={draft} rows={4} style={{...field,background:"#fff",border:"1px solid #F0C9CB",fontSize:14.5}} onBlur={()=>setEditingAi(false)}/>
              : <p style={{margin:0,fontSize:14.5,lineHeight:1.65,color:"var(--ink-2)"}}>{draft}</p>}
            <div style={{display:"flex",gap:10,marginTop:14}}>
              {aiApproved
                ? <Badge fg="#2F7D5B" bg="#E9F5EF" dot style={{fontSize:13,padding:"8px 14px"}}>הסיכום אושר ונשמר בתיק</Badge>
                : <React.Fragment>
                    <Btn onClick={()=>{setAiApproved(true);toast("סיכום ה-AI אושר ונוסף לתיק הרפואי ✓",{icon:"check"});}} icon="check" style={{flex:1}}>אשר סיכום</Btn>
                    <Btn variant="ghost" icon="note" onClick={()=>setEditingAi(true)} style={{flex:1}}>ערוך</Btn>
                  </React.Fragment>}
            </div>
          </div>
        </div>

        {/* Vet's own summary */}
        <div>
          <div style={sectionLabel}><Icon name="records" size={17}/> סיכום הוטרינר/ית</div>
          <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:11}}>
            {["בדיקה תקינה","ניתנה תרופה","נדרש מעקב","הופנה לבדיקות","ניתנו הנחיות"].map(chip=>(
              <button key={chip} onClick={()=>setSummary(t=> t? t+" · "+chip : chip)} style={{
                fontSize:13,fontWeight:600,color:"var(--teal-700)",background:"var(--teal-50)",
                border:"1px solid var(--teal-100)",padding:"7px 13px",borderRadius:99,transition:"all .15s"
              }}
              onMouseEnter={e=>{e.currentTarget.style.background="var(--teal-100)";}}
              onMouseLeave={e=>{e.currentTarget.style.background="var(--teal-50)";}}>+ {chip}</button>
            ))}
          </div>
          <textarea value={summary} onChange={e=>setSummary(e.target.value)} rows={4} placeholder="כתבי כאן את סיכום הביקור… (אפשר ללחוץ על תגיות מהירות מעל)" style={field}/>
        </div>

        {/* Notes */}
        <div>
          <div style={sectionLabel}><Icon name="note" size={17}/> הערות פנימיות <span style={{fontWeight:500,fontSize:12.5,color:"var(--faint)"}}>· לא נשלח ללקוח</span></div>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="הערה פנימית לצוות…" style={field}/>
        </div>
      </div>

      {/* footer actions — big and clear */}
      <div style={{padding:"16px 26px",borderTop:"1px solid var(--line-2)",display:"flex",gap:12,background:"var(--surface)"}}>
        <Btn size="lg" icon="check" style={{flex:1}} onClick={()=>{toast("הביקור נשמר בהצלחה ✓",{icon:"checkCircle"});onClose();}}>שמור ביקור</Btn>
        <Btn size="lg" variant="ghost" icon="user" onClick={()=>{onClose();onOpenClient(client);}}>כרטיס לקוח</Btn>
      </div>
    </Drawer>
  );
};

window.VisitDrawer = VisitDrawer;
