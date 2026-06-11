// ===== VOXLY Vet — demo data (Hebrew, realistic) =====

const TODAY_LABEL = "יום רביעי, 11 ביוני 2026";

const SPECIES = {
  dog:    { he:"כלב",  icon:"dog" },
  cat:    { he:"חתול", icon:"cat" },
  rabbit: { he:"ארנב", icon:"rabbit" },
  bird:   { he:"ציפור", icon:"bird" },
  hamster:{ he:"אוגר", icon:"hamster" },
  reptile:{ he:"זוחל", icon:"reptile" },
};

const VISIT_TYPES = {
  checkup:  { he:"בדיקה",  hue:"checkup" },
  vaccine:  { he:"חיסון",  hue:"vaccine" },
  surgery:  { he:"ניתוח",  hue:"surgery" },
  followup: { he:"מעקב",   hue:"followup" },
  grooming: { he:"טיפוח",  hue:"grooming" },
};

// ---- Clients & their pets ----
const CLIENTS = [
  { id:"c1", name:"יעל ברקוביץ'", phone:"052-4471290", email:"yael.b@gmail.com", city:"תל אביב", since:"2021", initials:"יב",
    pets:[
      { id:"p1", name:"לונה", species:"dog", breed:"גולדן רטריבר", sex:"נקבה", age:"4 שנים", weight:"28 ק\"ג", color:"#E88858" },
      { id:"p2", name:"מיצי", species:"cat", breed:"חתול בית", sex:"נקבה", age:"7 שנים", weight:"4.2 ק\"ג", color:"#5B7CFA" },
    ]},
  { id:"c2", name:"דניאל אבוקסיס", phone:"054-8123390", email:"daniel.abu@walla.co.il", city:"גבעתיים", since:"2019", initials:"דא",
    pets:[ { id:"p3", name:"רקס", species:"dog", breed:"רועה גרמני", sex:"זכר", age:"6 שנים", weight:"34 ק\"ג", color:"#3E9C86" } ]},
  { id:"c3", name:"נועה פרידמן", phone:"050-9920174", email:"noa.fr@gmail.com", city:"רמת גן", since:"2023", initials:"נפ",
    pets:[
      { id:"p4", name:"שוקו", species:"dog", breed:"פודל טוי", sex:"זכר", age:"2 שנים", weight:"4.5 ק\"ג", color:"#E88858" },
      { id:"p5", name:"קוקי", species:"cat", breed:"סיאמי", sex:"זכר", age:"3 שנים", weight:"4.1 ק\"ג", color:"#9B6BD6" },
    ]},
  { id:"c4", name:"איתי שרעבי", phone:"053-7710458", email:"itay.sh@gmail.com", city:"יהוד", since:"2020", initials:"אש",
    pets:[ { id:"p6", name:"בלוז", species:"cat", breed:"בריטי קצר שיער", sex:"זכר", age:"5 שנים", weight:"5.8 ק\"ג", color:"#5B7CFA" } ]},
  { id:"c5", name:"מירב כהן", phone:"052-3398812", email:"merav.cohen@gmail.com", city:"סביון", since:"2018", initials:"מכ",
    pets:[
      { id:"p7", name:"ג'ינג'ר", species:"dog", breed:"פומרניאן", sex:"נקבה", age:"3 שנים", weight:"3.1 ק\"ג", color:"#E88858" },
      { id:"p8", name:"נמו", species:"cat", breed:"מיקס חצר", sex:"זכר", age:"4 שנים", weight:"4.8 ק\"ג", color:"#5B7CFA" },
    ]},
  { id:"c6", name:"עומר לוי", phone:"058-6602231", email:"omer.levi@gmail.com", city:"תל אביב", since:"2024", initials:"על",
    pets:[ { id:"p9", name:"פלאפי", species:"cat", breed:"פרסי", sex:"נקבה", age:"3 שנים", weight:"3.4 ק\"ג", color:"#9B6BD6" } ]},
  { id:"c7", name:"שירה גולדמן", phone:"054-2218876", email:"shira.g@gmail.com", city:"גבעתיים", since:"2022", initials:"שג",
    pets:[ { id:"p10", name:"מקס", species:"dog", breed:"לברדור", sex:"זכר", age:"8 שנים", weight:"31 ק\"ג", color:"#3E9C86" } ]},
  { id:"c8", name:"רון מזרחי", phone:"050-4455190", email:"ron.m@gmail.com", city:"רמת גן", since:"2023", initials:"רמ",
    pets:[ { id:"p11", name:"קלאוד", species:"cat", breed:"רגדול", sex:"נקבה", age:"2 שנים", weight:"3.8 ק\"ג", color:"#5B7CFA" } ]},
];

function petById(id){ for(const c of CLIENTS){ const p=c.pets.find(x=>x.id===id); if(p) return {...p, owner:c}; } return null; }
function clientById(id){ return CLIENTS.find(c=>c.id===id); }

// ---- Today's appointments (8:00–19:00, 24h) ----
const APPTS_TODAY = [
  { id:"a1",  start:"08:30", dur:30, clientId:"c5", petId:"p7",  type:"vaccine",  loc:"home",   note:"חיסון משושה שנתי" },
  { id:"a2",  start:"09:00", dur:45, clientId:"c2", petId:"p3",  type:"checkup",  loc:"clinic", note:"בדיקת אוזניים — גירוד" },
  { id:"a3",  start:"10:00", dur:90, clientId:"c1", petId:"p1",  type:"surgery",  loc:"clinic", note:"עיקור — מתוכנן" },
  { id:"a4",  start:"11:45", dur:30, clientId:"c7", petId:"p10", type:"followup", loc:"home",   note:"מעקב פציעת רגל" },
  { id:"a5",  start:"12:30", dur:30, clientId:"c4", petId:"p6",  type:"checkup",  loc:"home",   note:"בדיקה כללית" },
  { id:"a6",  start:"14:00", dur:30, clientId:"c3", petId:"p4",  type:"checkup",  loc:"clinic", note:"בדיקת שיניים" },
  { id:"a7",  start:"15:00", dur:45, clientId:"c8", petId:"p11", type:"vaccine",  loc:"home",   note:"חיסון מרובעת לחתול" },
  { id:"a8",  start:"16:30", dur:30, clientId:"c6", petId:"p9",  type:"checkup",  loc:"home",   note:"בדיקת עור" },
  { id:"a9",  start:"17:15", dur:60, clientId:"c1", petId:"p2",  type:"followup", loc:"clinic", note:"מעקב בדיקות דם" },
];

// ---- Week appointments for calendar (offsets from Sunday=0 .. Sat=6) ----
const WEEK_APPTS = [
  { id:"w1", day:0, start:"09:00", dur:45, clientId:"c2", petId:"p3", type:"checkup" },
  { id:"w2", day:0, start:"11:00", dur:30, clientId:"c4", petId:"p6", type:"vaccine" },
  { id:"w3", day:0, start:"14:30", dur:60, clientId:"c7", petId:"p10", type:"surgery" },
  { id:"w4", day:1, start:"08:30", dur:30, clientId:"c5", petId:"p7", type:"followup" },
  { id:"w5", day:1, start:"10:00", dur:45, clientId:"c1", petId:"p1", type:"checkup" },
  { id:"w6", day:1, start:"13:00", dur:30, clientId:"c8", petId:"p11", type:"vaccine" },
  { id:"w7", day:1, start:"16:00", dur:30, clientId:"c6", petId:"p9", type:"checkup" },
  { id:"w8", day:2, start:"08:30", dur:90, clientId:"c1", petId:"p1", type:"surgery" },
  { id:"w9", day:2, start:"11:00", dur:30, clientId:"c7", petId:"p10", type:"followup" },
  { id:"w10", day:2, start:"12:30", dur:30, clientId:"c4", petId:"p6", type:"checkup" },
  { id:"w11", day:2, start:"15:00", dur:45, clientId:"c8", petId:"p11", type:"vaccine" },
  { id:"w12", day:3, start:"09:00", dur:45, clientId:"c2", petId:"p3", type:"checkup" },
  { id:"w13", day:3, start:"11:30", dur:30, clientId:"c3", petId:"p4", type:"checkup" },
  { id:"w14", day:3, start:"14:00", dur:30, clientId:"c6", petId:"p9", type:"vaccine" },
  { id:"w15", day:4, start:"08:30", dur:30, clientId:"c5", petId:"p7", type:"vaccine" },
  { id:"w16", day:4, start:"10:00", dur:60, clientId:"c1", petId:"p2", type:"surgery" },
  { id:"w17", day:4, start:"13:30", dur:45, clientId:"c7", petId:"p10", type:"followup" },
  { id:"w18", day:4, start:"16:00", dur:30, clientId:"c4", petId:"p6", type:"grooming" },
  { id:"w19", day:5, start:"09:30", dur:30, clientId:"c8", petId:"p11", type:"checkup" },
  { id:"w20", day:5, start:"11:00", dur:45, clientId:"c2", petId:"p3", type:"vaccine" },
];

// ---- Voice calls (Tomer) ----
const CALLS = [
  { id:"v1", time:"08:12", phone:"052-3398812", clientId:"c5", dur:"2:48", status:"done",   summary:"בקשה לקביעת חיסון שנתי לג'ינג'ר. נקבע תור ל-11.6 בשעה 08:30.", topic:"קביעת תור", sentiment:"חיובי", transcriptLen:14 },
  { id:"v2", time:"08:47", phone:"050-1129384", clientId:null, dur:"1:05", status:"done",   summary:"מתקשר לא מזוהה בירר שעות פתיחה ושירותי חירום. נמסר מידע, הופנה לאתר.", topic:"מידע כללי", sentiment:"נייטרלי", transcriptLen:6 },
  { id:"v3", time:"09:33", phone:"054-8123390", clientId:"c2", dur:"4:21", status:"escalated", summary:"רקס סובל מהקאות חוזרות מאז אתמול. תומר זיהה סימני אזהרה והעלה אסקלציה דחופה לד\"ר נועה.", topic:"מצב חירום", sentiment:"מודאג", transcriptLen:22 },
  { id:"v4", time:"10:18", phone:"058-6602231", clientId:"c6", dur:"3:12", status:"done",   summary:"שאלה על תזונה נכונה לחתול. תומר מסר המלצות ושלח דף מידע ב-SMS.", topic:"ייעוץ", sentiment:"חיובי", transcriptLen:11 },
  { id:"v5", time:"11:02", phone:"050-9920174", clientId:"c3", dur:"0:38", status:"missed",  summary:"השיחה נותקה לפני שתומר הספיק לזהות את הפונה. נשלחה הודעת מעקב.", topic:"—", sentiment:"—", transcriptLen:2 },
  { id:"v6", time:"11:51", phone:"053-7710458", clientId:"c4", dur:"2:09", status:"done",   summary:"דחיית תור בלוז משעה 12:30 — נקבע מחדש ליום חמישי. בוצע אישור.", topic:"שינוי תור", sentiment:"נייטרלי", transcriptLen:9 },
  { id:"v7", time:"12:40", phone:"054-2218876", clientId:"c7", dur:"5:47", status:"escalated", summary:"מקס מסרב לאכול 3 ימים וחלש. הועלתה אסקלציה — דורש בדיקה דחופה.", topic:"מצב חירום", sentiment:"מודאג", transcriptLen:26 },
  { id:"v8", time:"13:25", phone:"052-4471290", clientId:"c1", dur:"1:54", status:"done",   summary:"אישור הגעה לעיקור של לונה והנחיות צום לפני הניתוח. נמסרו הנחיות.", topic:"הכנה לניתוח", sentiment:"חיובי", transcriptLen:8 },
  { id:"v9", time:"14:31", phone:"050-4455190", clientId:"c8", dur:"0:00", status:"active",  summary:"שיחה פעילה כעת — תומר מטפל בפנייה.", topic:"בתהליך", sentiment:"—", transcriptLen:0 },
];

// ---- Escalations ----
const ESCALATIONS = [
  { id:"e1", urgency:9, reason:"הקאות חוזרות + עייפות קיצונית", clientId:"c2", petId:"p3", time:"09:33", callId:"v3", status:"open",
    detail:"הבעלים מדווח על 5 התקפי הקאה ב-12 שעות, סירוב לשתות. תומר זיהה סיכון להתייבשות וחסימת מעי אפשרית." },
  { id:"e2", urgency:8, reason:"סירוב לאכול 3 ימים + חולשה", clientId:"c7", petId:"p10", time:"12:40", callId:"v7", status:"open",
    detail:"מקס (לברדור, 8) לא אכל מזה 3 ימים, מתנהג בחוסר עניין. גיל מבוגר מעלה את רמת הדחיפות." },
  { id:"e3", urgency:6, reason:"פצע פתוח ברגל אחורית", clientId:"c4", petId:"p6", time:"10:55", callId:null, status:"open",
    detail:"בלוז עם שריטה עמוקה, דימום קל שנעצר. הבעלים שלח תמונה. ממתין להערכת ד\"ר נועה אם נדרשת תפירה." },
  { id:"e4", urgency:4, reason:"שאלה על מינון תרופה", clientId:"c5", petId:"p7", time:"08:20", callId:null, status:"open",
    detail:"בלבול לגבי מינון אנטיביוטיקה לג'ינג'ר. תומר העביר לאישור רפואי לפני מתן הנחיה." },
  { id:"e5", urgency:7, reason:"קשיי נשימה פתאומיים", clientId:"c3", petId:"p5", time:"07:50", callId:null, status:"resolved",
    detail:"קוקי נשם בכבדות בבוקר. ד\"ר נועה הנחתה להביא מיידית — המצב התייצב לאחר בדיקה." },
];

// ---- Recent medical records (for client profile) ----
const MEDICAL = {
  p1:[ { date:"15.04.2026", title:"בדיקה שגרתית", note:"מצב כללי תקין. משקל יציב. עודכנו חיסונים.", vet:"ד\"ר נועה" },
       { date:"02.01.2026", title:"חיסון משושה", note:"ניתן ללא תופעות לוואי.", vet:"ד\"ר נועה" } ],
  p2:[ { date:"20.03.2026", title:"בדיקת דם", note:"ערכי כליה גבוליים — מומלץ מעקב בעוד 3 חודשים.", vet:"ד\"ר נועה" } ],
};

Object.assign(window,{
  TODAY_LABEL, SPECIES, VISIT_TYPES, CLIENTS, APPTS_TODAY, WEEK_APPTS,
  CALLS, ESCALATIONS, MEDICAL, petById, clientById
});
