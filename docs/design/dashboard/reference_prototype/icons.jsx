// ===== Icons — clean line set, 24x24, RTL-aware =====
const I = ({d, size=22, sw=1.8, fill="none", children, style, vb="0 0 24 24"})=>(
  <svg width={size} height={size} viewBox={vb} fill={fill} stroke="currentColor"
       strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
    {d ? <path d={d}/> : children}
  </svg>
);

// ---------- Animal icons ----------
const AnimalIcon = ({species, size=22, sw=1.8})=>{
  const common={size, sw};
  switch(species){
    case "dog": return (
      <I {...common}><g>
        <path d="M5.5 8.2C4.3 7 3.4 8 3.6 9.8c.15 1.3.9 2 1.8 2.3"/>
        <path d="M18.5 8.2c1.2-1.2 2.1-.2 1.9 1.6-.15 1.3-.9 2-1.8 2.3"/>
        <path d="M5.4 12c0-3.6 2.7-6.2 6.6-6.2S18.6 8.4 18.6 12c0 3-1.6 5.4-4 6.4-.9.4-1.6 1.2-1.6 1.2s-.7-.8-1.6-1.2c-2.4-1-4-3.4-4-6.4Z"/>
        <circle cx="9.6" cy="11.4" r=".9" fill="currentColor" stroke="none"/>
        <circle cx="14.4" cy="11.4" r=".9" fill="currentColor" stroke="none"/>
        <path d="M12 14.2c-.7 0-1.2.4-1.2.4M12 14.2c.7 0 1.2.4 1.2.4M12 14.2v1.3"/>
      </g></I>);
    case "cat": return (
      <I {...common}><g>
        <path d="M5.5 9.5 4.2 5.4l3.5 2.2M18.5 9.5l1.3-4.1-3.5 2.2"/>
        <path d="M5.5 11.6c0-3 2.9-5 6.5-5s6.5 2 6.5 5c0 3.4-2.9 6.4-6.5 6.4S5.5 15 5.5 11.6Z"/>
        <circle cx="9.6" cy="11.6" r=".9" fill="currentColor" stroke="none"/>
        <circle cx="14.4" cy="11.6" r=".9" fill="currentColor" stroke="none"/>
        <path d="M12 13.6v.9M12 14.5c-.5 0-.9.3-.9.3M12 14.5c.5 0 .9.3.9.3"/>
        <path d="M5.2 13.2 2.6 12.6M5 14.6l-2.4.3M18.8 13.2l2.6-.6M19 14.6l2.4.3"/>
      </g></I>);
    case "rabbit": return (
      <I {...common}><g>
        <path d="M9 9.2C8.2 6 7.4 2.6 9 2.6c1.5 0 1.9 3.4 2 6.2M15 9.2c.8-3.2 1.6-6.6 0-6.6-1.5 0-1.9 3.4-2 6.2"/>
        <path d="M6.5 14.4c0-3 2.4-5 5.5-5s5.5 2 5.5 5c0 3-2.4 5.4-5.5 5.4S6.5 17.4 6.5 14.4Z"/>
        <circle cx="10" cy="14" r=".8" fill="currentColor" stroke="none"/>
        <circle cx="14" cy="14" r=".8" fill="currentColor" stroke="none"/>
        <path d="M12 15.8v.8M12 16.6c-.5 0-.8.3-.8.3M12 16.6c.5 0 .8.3.8.3"/>
      </g></I>);
    case "bird": return (
      <I {...common}><g>
        <path d="M16 7.2a3.6 3.6 0 0 0-3.6-3.6c-3.6 0-5.4 3-5.4 6.2 0 4 2.6 7.4 6 7.4 2.5 0 4.4-1.7 4.4-4 0-2-1.3-3.3-3-3.6"/>
        <path d="M16 7.2 20.4 6l-3.4 2.8"/>
        <circle cx="13.6" cy="7.6" r=".9" fill="currentColor" stroke="none"/>
        <path d="M9 17.6 8 21M12 18 12 21"/>
      </g></I>);
    case "hamster": return (
      <I {...common}><g>
        <circle cx="8.2" cy="8" r="2"/><circle cx="15.8" cy="8" r="2"/>
        <path d="M4.5 13c0-3.4 3-5.6 7.5-5.6S19.5 9.6 19.5 13c0 3.4-3.2 5.8-7.5 5.8S4.5 16.4 4.5 13Z"/>
        <circle cx="9.6" cy="12.6" r=".9" fill="currentColor" stroke="none"/>
        <circle cx="14.4" cy="12.6" r=".9" fill="currentColor" stroke="none"/>
        <path d="M12 14.4c-.6 0-1 .4-1 .4M12 14.4c.6 0 1 .4 1 .4M12 14.4v1.1"/>
      </g></I>);
    case "reptile": return (
      <I {...common}><g>
        <path d="M3 13c2-.4 3.4-1.6 5.4-1.6 1.4 0 2.2 1 3.6 1s2.4-2.4 4.6-2.4c1.8 0 2.8 1.4 4.4 1.4"/>
        <path d="M3 13c1.2 1.6 3 2.6 5.4 2.6 1.6 0 2.4-.8 3.6-.8s2.2 1 4.2 1c1.8 0 3-1 3.8-2.4"/>
        <path d="M6 11.6 5 9.4M9.5 11.8 9 9.4M19 11.4l1.2-2M16 10.2l.4-2.2"/>
        <circle cx="20.4" cy="12" r=".7" fill="currentColor" stroke="none"/>
      </g></I>);
    default: return (
      <I {...common}><g>
        <circle cx="8" cy="9" r="1.8"/><circle cx="16" cy="9" r="1.8"/><circle cx="6" cy="13.5" r="1.6"/><circle cx="18" cy="13.5" r="1.6"/>
        <path d="M12 12.5c2.4 0 4 1.8 4 3.8 0 1.6-1.4 2.4-4 2.4s-4-.8-4-2.4c0-2 1.6-3.8 4-3.8Z"/>
      </g></I>);
  }
};

// ---------- UI icons ----------
const Icon = ({name, size=22, sw=1.8})=>{
  const c={size, sw};
  switch(name){
    case "today":     return <I {...c}><g><rect x="3.5" y="4.5" width="17" height="16" rx="3"/><path d="M3.5 9.5h17M8 3v3M16 3v3"/><circle cx="12" cy="14.5" r="2.2" fill="currentColor" stroke="none"/></g></I>;
    case "calendar":  return <I {...c}><g><rect x="3.5" y="4.5" width="17" height="16" rx="3"/><path d="M3.5 9.5h17M8 3v3M16 3v3M7.5 13h3M13.5 13h3M7.5 16.5h3M13.5 16.5h3"/></g></I>;
    case "calls":     return <I {...c} d="M6.5 4.5c-1.2 0-2.2 1-2.1 2.2.4 7 5.9 12.5 12.9 12.9 1.2.1 2.2-.9 2.2-2.1v-2.1c0-.9-.6-1.6-1.5-1.8l-2.1-.5c-.7-.2-1.5.1-1.9.7l-.5.7c-2-1-3.6-2.6-4.6-4.6l.7-.5c.6-.4.9-1.2.7-1.9l-.5-2.1C9.1 5.1 8.4 4.5 7.5 4.5Z"/>;
    case "escalation":return <I {...c}><g><path d="M12 3.5 21 19H3L12 3.5Z"/><path d="M12 9.5v4.2"/><circle cx="12" cy="16.6" r="1" fill="currentColor" stroke="none"/></g></I>;
    case "clients":   return <I {...c}><g><circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><path d="M16 5.5a3 3 0 0 1 0 6M17.5 14.7c2 .5 3 2.2 3 4.8"/></g></I>;
    case "pets":      return <I {...c}><g><circle cx="7" cy="8.5" r="1.9"/><circle cx="17" cy="8.5" r="1.9"/><circle cx="4.5" cy="13.5" r="1.7"/><circle cx="19.5" cy="13.5" r="1.7"/><path d="M12 11.5c2.6 0 4.4 2 4.4 4.2 0 1.8-1.6 2.8-4.4 2.8s-4.4-1-4.4-2.8c0-2.2 1.8-4.2 4.4-4.2Z"/></g></I>;
    case "records":   return <I {...c}><g><path d="M6 3.5h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z"/><path d="M13.5 3.5V8h4.5"/><path d="M12 11v5M9.5 13.5h5"/></g></I>;
    case "settings":  return <I {...c}><g><circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3"/></g></I>;
    case "search":    return <I {...c}><g><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l4.5 4.5"/></g></I>;
    case "bell":      return <I {...c} d="M6 9.5a6 6 0 1 1 12 0c0 4 1.2 5.4 2 6.2.5.5.1 1.3-.6 1.3H4.6c-.7 0-1.1-.8-.6-1.3.8-.8 2-2.2 2-6.2ZM9.5 19.5a2.5 2.5 0 0 0 5 0"/>;
    case "chevron":   return <I {...c} d="M14.5 6 8.5 12l6 6"/>;
    case "chevL":     return <I {...c} d="M14.5 6 8.5 12l6 6"/>;
    case "chevR":     return <I {...c} d="M9.5 6 15.5 12l-6 6"/>;
    case "chevDown":  return <I {...c} d="M6 9.5 12 15.5 18 9.5"/>;
    case "plus":      return <I {...c} d="M12 5v14M5 12h14"/>;
    case "check":     return <I {...c} d="M5 12.5 10 17.5 19 7"/>;
    case "checkCircle":return <I {...c}><g><circle cx="12" cy="12" r="9"/><path d="M8 12.2 11 15.2 16 9.2"/></g></I>;
    case "x":         return <I {...c} d="M6 6l12 12M18 6 6 18"/>;
    case "clock":     return <I {...c}><g><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></g></I>;
    case "phoneIn":   return <I {...c}><g><path d="M6.5 5.5c-1.2 0-2.2 1-2.1 2.2.4 7 5.9 12.5 12.9 12.9 1.2.1 2.2-.9 2.2-2.1v-2.1c0-.9-.6-1.6-1.5-1.8l-2.1-.5c-.7-.2-1.5.1-1.9.7l-.5.7c-2-1-3.6-2.6-4.6-4.6l.7-.5c.6-.4.9-1.2.7-1.9l-.5-2.1C9.1 6.1 8.4 5.5 7.5 5.5Z"/><path d="M15 3.5v4h4M15 7.5 21 2"/></g></I>;
    case "user":      return <I {...c}><g><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.4 3-5.6 7-5.6s7 2.2 7 5.6"/></g></I>;
    case "phone":     return <I {...c} d="M6.5 5.5c-1.2 0-2.2 1-2.1 2.2.4 7 5.9 12.5 12.9 12.9 1.2.1 2.2-.9 2.2-2.1v-2.1c0-.9-.6-1.6-1.5-1.8l-2.1-.5c-.7-.2-1.5.1-1.9.7l-.5.7c-2-1-3.6-2.6-4.6-4.6l.7-.5c.6-.4.9-1.2.7-1.9l-.5-2.1C9.1 6.1 8.4 5.5 7.5 5.5Z"/>;
    case "mail":      return <I {...c}><g><rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M4 7l8 5.5L20 7"/></g></I>;
    case "pin":       return <I {...c}><g><path d="M12 21s6.5-5.4 6.5-10.5A6.5 6.5 0 0 0 5.5 10.5C5.5 15.6 12 21 12 21Z"/><circle cx="12" cy="10.3" r="2.3"/></g></I>;
    case "weight":    return <I {...c}><g><path d="M5 8.5h14l1.5 11a1 1 0 0 1-1 1.2H4.5a1 1 0 0 1-1-1.2L5 8.5Z"/><path d="M9 8.5a3 3 0 0 1 6 0"/></g></I>;
    case "calendar2": return <I {...c}><g><rect x="3.5" y="4.5" width="17" height="16" rx="3"/><path d="M3.5 9.5h17M8 3v3M16 3v3"/></g></I>;
    case "sparkle":   return <I {...c} d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6L12 3Z"/>;
    case "dots":      return <I {...c}><g><circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none"/></g></I>;
    case "note":      return <I {...c}><g><path d="M5 5.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v9l-4 4H7a2 2 0 0 1-2-2V5.5Z"/><path d="M19 14.5h-4v4M8.5 8.5h7M8.5 11.5h5"/></g></I>;
    case "filter":    return <I {...c} d="M4 6h16M7 12h10M10 18h4"/>;
    case "play":      return <I {...c}><g><circle cx="12" cy="12" r="8.5"/><path d="M10 8.8 16 12l-6 3.2V8.8Z" fill="currentColor" stroke="none"/></g></I>;
    case "wave":      return <I {...c} d="M3 12h2l2-5 3 12 3-16 2.5 9H21"/>;
    case "logout":    return <I {...c}><g><path d="M14 7V5.5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V17"/><path d="M10 12h10M17 9l3 3-3 3"/></g></I>;
    case "home":      return <I {...c}><g><path d="M4 11 12 4l8 7"/><path d="M5.5 9.6V19a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.6"/><path d="M9.5 20v-5h5v5"/></g></I>;
    default:          return <I {...c}><circle cx="12" cy="12" r="8"/></I>;
  }
};

window.AnimalIcon = AnimalIcon;
window.Icon = Icon;
