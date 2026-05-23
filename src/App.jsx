import React, { useState, useEffect } from "react"; 

const STORAGE_KEY = "tradejournal_v4";
const NOTES_KEY   = "tradejournal_notes_v1";

const CONFLUENCES = [
  { id: "htf_bias",      label: "HTF Bias",        icon: "📊" },
  { id: "rej_zone",      label: "Rejection Zone",   icon: "🎯" },
  { id: "ifvg",          label: "IFVG / Inversion", icon: "⚡" },
  { id: "mss",           label: "MSS",              icon: "🔀" },
  { id: "htf_fvg",       label: "HTF FVG",          icon: "🔲" },
  { id: "ema_tap",       label: "EMA Tap",          icon: "〰️" },
  { id: "poi",           label: "Point of Interest",icon: "🔵" },
  { id: "session_sweep", label: "Session Sweep",    icon: "🌊" },
  { id: "pdh_pdl",       label: "PDH / PDL",        icon: "📌" },
  { id: "volume",        label: "Volume Confirm",   icon: "📈" },
];

function autoGrade(confluences) {
  const has = (id) => confluences.includes(id);
  let score = 0;
  const missing = [];
  if (has("htf_bias"))  { score += 20; } else { missing.push("HTF Bias"); }
  if (has("rej_zone"))  { score += 20; } else { missing.push("Rejection Zone"); }
  if (has("ifvg"))      { score += 15; } else { missing.push("IFVG/Inversion"); }
  if (has("mss"))       { score += 15; } else { missing.push("MSS"); }
  if (has("htf_fvg"))   { score += 15; } else { missing.push("HTF FVG"); }
  if (has("ema_tap"))   { score += 8; }
  if (has("session_sweep")) { score += 6; }
  if (has("poi"))    { score += 4; }
  if (has("pdh_pdl")) { score += 3; }
  if (has("volume"))  { score += 2; }
  score = Math.min(score, 100);
  let grade, label, color, reason;
  if (score >= 90)      { grade="Aplus"; label="A+"; color="#22c55e"; reason="Elite setup. Max size."; }
  else if (score >= 75) { grade="A";     label="A";  color="#86efac"; reason="Strong setup. Full size."; }
  else if (score >= 60) { grade="Bplus"; label="B+"; color="#f59e0b"; reason="Decent. Reduced size."; }
  else if (score >= 45) { grade="B";     label="B";  color="#fb923c"; reason="Marginal. You said no B setups."; }
  else                  { grade="C";     label="C";  color="#ef4444"; reason="Missing: " + missing.join(", ") + "."; }
  return { grade, label, color, reason, score };
}

// ─── HISTORICAL ───────────────────────────────────────────────────────────────
const HISTORICAL = [
  { id:"imp_20260519_1918", date:"2026-05-19T19:18:25", market:"NQ", direction:"SHORT", pnl:-3740.00, result:"L",  units:40, leverage:20, confluences:[], grade:"A", gradeLabel:"A", score:75, imported:true },
  { id:"imp_20260519_1040", date:"2026-05-19T10:40:53", market:"NQ", direction:"SHORT", pnl:2310.00,  result:"W",  units:40, leverage:20, confluences:[], grade:"A", gradeLabel:"A", score:75, imported:true },
  { id:"imp_20260519_0308", date:"2026-05-19T03:08:28", market:"NQ", direction:"SHORT", pnl:40.00,    result:"BE", units:40, leverage:20, confluences:[], grade:"A", gradeLabel:"A", score:75, imported:true },
  { id:"imp_20260518_0739", date:"2026-05-18T07:39:42", market:"NQ", direction:"SHORT", pnl:-2480.00, result:"L",  units:40, leverage:20, confluences:[], grade:"A", gradeLabel:"A", score:75, imported:true },
  { id:"imp_20260514_1050", date:"2026-05-14T10:50:37", market:"NQ", direction:"LONG",  pnl:7408.75,  result:"W",  units:55, leverage:20, confluences:[], grade:"A", gradeLabel:"A", score:75, imported:true },
  { id:"imp_20260514_0959", date:"2026-05-14T09:59:42", market:"NQ", direction:"LONG",  pnl:-161.50,  result:"BE", units:34, leverage:20, confluences:[], grade:"A", gradeLabel:"A", score:75, imported:true },
  { id:"imp_20260513_1152", date:"2026-05-13T11:52:16", market:"NQ", direction:"LONG",  pnl:-25.50,   result:"BE", units:34, leverage:20, confluences:[], grade:"A", gradeLabel:"A", score:75, imported:true },
];

function fmt(n) {
  const abs = Math.abs(n);
  const sign = n >= 0 ? "+" : "-";
  return sign + "$" + abs.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function getDateKey(date) {
  const d = new Date(date);
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
}
function getMonthKey(date) { const d = new Date(date); return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0"); }
function getMonthLabel(key){ const [y,m] = key.split("-"); return new Date(+y,+m-1,1).toLocaleString("en-US",{month:"long",year:"numeric"}); }

const MARKET_COLOR = { NQ:"#00d4ff", XAU:"#f5c842", XAG:"#c0c0c0", BTC:"#f7931a" };

function storageSave(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) { console.warn("save failed", e); }
}
function storageLoad(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch(e) { return fallback; }
}

export default function TradeJournal() {
  const [loaded,    setLoaded]    = useState(false);
  const [trades,    setTrades]    = useState([]);
  const [dayNotes,  setDayNotes]  = useState({});
  const [view,      setView]      = useState("calendar");
  const [logMode,   setLogMode]   = useState("now");
  const [step,      setStep]      = useState(1);
  const [form,      setForm]      = useState({ market:null, direction:null, confluences:[], units:"", pnl:"", result:null, beOutcome:null, pastDate:"", pastTime:"" });
  const [saved,     setSaved]     = useState(false);
  const [calMonth,  setCalMonth]  = useState(() => getMonthKey(new Date()));
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayModal,  setDayModal]  = useState(null);

  // Load persisted data on mount
  useEffect(() => {
    const savedTrades = storageLoad(STORAGE_KEY, []);
    const savedNotes  = storageLoad(NOTES_KEY,   {});
    const savedIds    = new Set(savedTrades.map(function(t){ return t.id; }));
    const merged      = HISTORICAL.filter(function(h){ return !savedIds.has(h.id); }).concat(savedTrades);
    merged.sort(function(a,b){ return new Date(b.date) - new Date(a.date); });
    setTrades(merged);
    setDayNotes(savedNotes);
    setLoaded(true);
  }, []);

  // Persist trades whenever they change (after initial load)
  useEffect(() => {
    if (!loaded) return;
    const userTrades = trades.filter(function(t){ return !t.imported; });
    storageSave(STORAGE_KEY, userTrades);
  }, [trades, loaded]);

  // Persist notes whenever they change
  useEffect(() => {
    if (!loaded) return;
    storageSave(NOTES_KEY, dayNotes);
  }, [dayNotes, loaded]);

  const [editModal,   setEditModal]  = useState(null); // trade being edited

  const [confirmDelete, setConfirmDelete] = useState(null); // trade id pending delete

  const deleteTrade = (id) => {
    setTrades(prev => prev.filter(t => t.id !== id));
  };

  const openEdit = (t) => {
    setEditModal({
      id: t.id,
      market: t.market,
      direction: t.direction,
      units: String(t.units),
      pnl: String(Math.abs(t.pnl)),
      result: t.result,
      beOutcome: t.beOutcome || null,
      confluences: t.confluences || [],
      date: getDateKey(t.date),
      time: new Date(t.date).toTimeString ? (String(new Date(t.date).getHours()).padStart(2,"0") + ":" + String(new Date(t.date).getMinutes()).padStart(2,"0")) : "12:00",
    });
  };

  const saveEdit = () => {
    if (!editModal) return;
    const gradeResult = autoGrade(editModal.confluences);
    const rawPnl = parseFloat(editModal.pnl) || 0;
    const pnlNum = editModal.result === "BE" ? rawPnl : rawPnl * (editModal.result === "W" ? 1 : -1);
    const leverage = editModal.market === "NQ" ? 20 : editModal.market === "XAU" ? 50 : editModal.market === "XAG" ? 50 : 1;
    setTrades(prev => prev.map(t => t.id !== editModal.id ? t : {
      ...t,
      market: editModal.market,
      direction: editModal.direction,
      units: parseFloat(editModal.units) || t.units,
      pnl: pnlNum,
      result: editModal.result,
      beOutcome: editModal.result === "BE" ? editModal.beOutcome : null,
      confluences: editModal.confluences,
      grade: gradeResult.grade, gradeLabel: gradeResult.label, score: gradeResult.score,
      date: editModal.date + "T" + editModal.time + ":00",
      imported: false,
    }).sort((a,b) => new Date(b.date) - new Date(a.date)));
    setEditModal(null);
  };

  const resetForm = () => { setForm({ market:null, direction:null, confluences:[], units:"", pnl:"", result:null, beOutcome:null, pastDate:"", pastTime:"" }); setStep(1); setSaved(false); setLogMode("now"); };
  const toggleConf = (id) => setForm(f => ({ ...f, confluences: f.confluences.includes(id) ? f.confluences.filter(c=>c!==id) : [...f.confluences, id] }));

  const submitTrade = () => {
    const market = form.market;
    const leverage = market === "NQ" ? 20 : market === "XAU" ? 50 : market === "XAG" ? 50 : 1;
    const gradeResult = autoGrade(form.confluences);
    const rawPnl = parseFloat(form.pnl);
    const pnlNum = form.result === "BE" ? rawPnl : rawPnl * (form.result === "W" ? 1 : -1);
    let tradeDate;
    if (logMode === "past" && form.pastDate) {
      const timeStr = form.pastTime || "12:00";
      tradeDate = form.pastDate + "T" + timeStr + ":00";
    } else {
      const now = new Date();
      tradeDate = now.getFullYear() + "-" + String(now.getMonth()+1).padStart(2,"0") + "-" + String(now.getDate()).padStart(2,"0") + "T" + String(now.getHours()).padStart(2,"0") + ":" + String(now.getMinutes()).padStart(2,"0") + ":00";
    }
    const trade = {
      id: Date.now().toString(),
      date: tradeDate,
      market, direction: form.direction,
      confluences: form.confluences,
      grade: gradeResult.grade, gradeLabel: gradeResult.label, score: gradeResult.score,
      units: parseFloat(form.units), leverage, pnl: pnlNum, result: form.result,
      beOutcome: form.result === "BE" ? form.beOutcome : null,
    };
    setTrades(prev => [trade, ...prev].sort((a,b) => new Date(b.date)-new Date(a.date)));
    setSaved(true);
  };

  // ── CALENDAR LOGIC ──────────────────────────────────────────────────────────
  const calYear  = parseInt(calMonth.split("-")[0]);
  const calMonthN = parseInt(calMonth.split("-")[1]) - 1;
  const firstDay = new Date(calYear, calMonthN, 1).getDay();
  const daysInMonth = new Date(calYear, calMonthN + 1, 0).getDate();

  const tradesByDay = {};
  trades.forEach(t => {
    const dk = getDateKey(t.date);
    if (!tradesByDay[dk]) tradesByDay[dk] = [];
    tradesByDay[dk].push(t);
  });

  const dayPnl = (dk) => (tradesByDay[dk] || []).reduce((s,t) => s+t.pnl, 0);
  const calPrevMonth = () => { const d = new Date(calYear, calMonthN-1,1); setCalMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); setSelectedDay(null); };
  const calNextMonth = () => { const d = new Date(calYear, calMonthN+1,1); setCalMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); setSelectedDay(null); };

  const months = [...new Set(trades.map(t => getMonthKey(t.date)))].sort().reverse();
  const allW = trades.filter(t=>t.result==="W").length;
  const allL = trades.filter(t=>t.result==="L").length;
  const allBE = trades.filter(t=>t.result==="BE").length;
  const wr = (allW+allL) > 0 ? Math.round((allW/(allW+allL))*100) : 0;
  const totalPnl = trades.reduce((s,t)=>s+t.pnl,0);

  const selectedDayTrades = selectedDay ? (tradesByDay[selectedDay] || []) : [];

  const pnlColor = (n) => n > 0 ? "#22c55e" : n < 0 ? "#ef4444" : "#888";

  const grade = autoGrade(form.confluences);

  if (!loaded) {
    return (
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#08080f",flexDirection:"column",gap:12}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:".1em",color:"#22c55e"}}>TRADE JOURNAL</div>
        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:"#778899",letterSpacing:".1em"}}>LOADING...</div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#08080f;color:#f0f0f8;font-family:'DM Sans',sans-serif;min-height:100vh}
        .app{max-width:480px;margin:0 auto;min-height:100vh;display:flex;flex-direction:column;padding-bottom:40px}

        .nav{display:flex;border-bottom:1px solid #111120;background:#08080f;position:sticky;top:0;z-index:20}
        .nb{flex:1;padding:13px 6px;background:none;border:none;color:#778899;font-family:'DM Sans',sans-serif;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;cursor:pointer;transition:color .2s;border-bottom:2px solid transparent}
        .nb.on{color:#f0f0f8;border-bottom-color:#22c55e}

        /* ── CALENDAR ── */
        .cal-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px 10px}
        .cal-month{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:.06em;color:#f0f0f8}
        .cal-nav{background:none;border:1px solid #222232;color:#666;border-radius:6px;width:30px;height:30px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;transition:all .2s}
        .cal-nav:hover{border-color:#22c55e;color:#22c55e}
        .cal-summary{display:flex;gap:8px;padding:0 20px 12px}
        .cal-stat{flex:1;background:#0d0d18;border:1px solid #1a1a2a;border-radius:8px;padding:8px 10px;text-align:center}
        .cs-val{font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:.04em}
        .cs-lbl{font-family:'JetBrains Mono',monospace;font-size:8px;color:#778899;text-transform:uppercase;letter-spacing:.08em}
        .dow-row{display:grid;grid-template-columns:repeat(7,1fr);padding:0 12px;gap:2px;margin-bottom:2px}
        .dow{font-family:'JetBrains Mono',monospace;font-size:8px;color:#778899;text-align:center;padding:4px 0;text-transform:uppercase}
        .cal-grid{display:grid;grid-template-columns:repeat(7,1fr);padding:0 12px;gap:2px}
        .cal-day{aspect-ratio:1;border-radius:6px;border:1px solid #0d0d18;background:#09090f;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;transition:all .15s;position:relative;min-height:44px}
        .cal-day:hover{border-color:#22c55e22}
        .cal-day.empty{background:transparent;border-color:transparent;cursor:default}
        .cal-day.has-trades{border-color:#252535}
        .cal-day.profit{background:rgba(34,197,94,.08);border-color:rgba(34,197,94,.2)}
        .cal-day.loss{background:rgba(239,68,68,.06);border-color:rgba(239,68,68,.15)}
        .cal-day.breakeven{background:rgba(161,161,170,.05);border-color:rgba(161,161,170,.15)}
        .cal-day.selected{border-color:#22c55e!important;box-shadow:0 0 0 1px #22c55e22}
        .cal-day.today{border-color:#f59e0b44}
        .day-num{font-family:'JetBrains Mono',monospace;font-size:9px;color:#778899;font-weight:600}
        .cal-day.has-trades .day-num{color:#ccd}
        .day-pnl{font-family:'JetBrains Mono',monospace;font-size:7px;font-weight:600}
        .day-dot{width:4px;height:4px;border-radius:50%;background:#444}
        .cal-day.profit .day-dot{background:#22c55e}
        .cal-day.loss .day-dot{background:#ef4444}

        /* DAY DETAIL */
        .day-detail{margin:10px 12px 0;background:#09090f;border:1px solid #1a1a2a;border-radius:10px;overflow:hidden}
        .dd-header{padding:10px 14px;border-bottom:1px solid #111120;display:flex;align-items:center;justify-content:space-between}
        .dd-date{font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:.06em;color:#aaa}
        .dd-pnl{font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:600}
        .dd-trade{padding:10px 14px;border-bottom:1px solid #0d0d18;display:flex;align-items:center;gap:10px}
        .dd-trade:last-child{border-bottom:none}
        .dd-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
        .dd-dot.W{background:#22c55e}.dd-dot.L{background:#ef4444}.dd-dot.BE{background:#888}
        .dd-info{flex:1}
        .dd-top{display:flex;align-items:center;gap:6px;margin-bottom:2px}
        .dd-market{font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:.04em}
        .dd-dir{font-size:10px;font-weight:600;padding:1px 6px;border-radius:3px}
        .dd-dir.LONG{background:rgba(34,197,94,.12);color:#22c55e}
        .dd-dir.SHORT{background:rgba(239,68,68,.1);color:#ef4444}
        .dd-meta{font-size:10px;color:#8899bb}
        .dd-amt{font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:600}
        .imp-badge{font-family:'JetBrains Mono',monospace;font-size:8px;color:#667;background:#111120;border-radius:3px;padding:1px 5px}

        /* ── LOG ── */
        .log-header{padding:20px 20px 8px}
        .log-title{font-family:'Bebas Neue',sans-serif;font-size:36px;letter-spacing:.05em;line-height:1}
        .log-sub{font-family:'JetBrains Mono',monospace;font-size:9px;color:#778;text-transform:uppercase;letter-spacing:.1em;margin-top:3px}

        .steps{display:flex;gap:4px;padding:0 20px 16px}
        .sdot{flex:1;height:3px;border-radius:2px;background:#1a1a2a;transition:background .3s}
        .sdot.done{background:#22c55e}.sdot.active{background:#86efac}

        .sec{padding:0 20px 16px}
        .sec-lbl{font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:.05em;color:#aaa;margin-bottom:10px}

        .mkt-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .mkt-card{padding:18px 14px;border-radius:10px;border:2px solid #1a1a2a;background:#0a0a14;cursor:pointer;transition:all .2s;text-align:left}
        .mkt-card.on{border-color:var(--ac);background:color-mix(in srgb,var(--ac) 8%,#0a0a14)}
        .mkt-name{font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:.04em}
        .mkt-lev{font-family:'JetBrains Mono',monospace;font-size:10px;color:#8899bb;margin-top:2px}

        .dir-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .dir-btn{padding:16px;border-radius:10px;border:2px solid #1a1a2a;background:#0a0a14;cursor:pointer;font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:.05em;transition:all .2s}
        .dir-btn.long{color:#22c55e}.dir-btn.long.on{border-color:#22c55e;background:rgba(34,197,94,.08)}
        .dir-btn.short{color:#ef4444}.dir-btn.short.on{border-color:#ef4444;background:rgba(239,68,68,.08)}

        .conf-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
        .conf-chip{padding:10px 12px;border-radius:8px;border:2px solid #1a1a2a;background:#0a0a14;cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:7px}
        .conf-chip.on{border-color:#22c55e;background:rgba(34,197,94,.06)}
        .conf-icon{font-size:14px}
        .conf-label{font-size:11px;font-weight:600;color:#99aabb}
        .conf-chip.on .conf-label{color:#86efac}

        .grade-preview{margin-top:12px;padding:12px 14px;border-radius:8px;border:2px solid var(--gc);background:color-mix(in srgb,var(--gc) 8%,transparent)}
        .gp-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
        .gp-grade{font-family:'Bebas Neue',sans-serif;font-size:30px;letter-spacing:.04em;color:var(--gc);line-height:1}
        .gp-score{font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:600;color:var(--gc)}
        .gp-bar-bg{height:5px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden;margin-bottom:6px}
        .gp-bar{height:100%;border-radius:3px;background:var(--gc);transition:width .4s}
        .gp-reason{font-size:11px;color:var(--gc);opacity:.85}

        .igrp{display:flex;flex-direction:column;gap:10px}
        .irow{display:flex;flex-direction:column;gap:4px}
        .ilbl{font-family:'JetBrains Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#99aabb}
        .ninp{background:#06060c;border:1px solid #1a1a2a;border-radius:8px;padding:10px 14px;color:#f0f0f8;font-family:'JetBrains Mono',monospace;font-size:18px;outline:none;width:100%;transition:border-color .15s}
        .ninp:focus{border-color:#22c55e}
        .ninp::placeholder{color:#252535}

        .res-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
        .res-btn{padding:18px 8px;border-radius:10px;border:2px solid #1a1a2a;background:#0a0a14;cursor:pointer;font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:.05em;transition:all .2s}
        .res-btn.w{color:#22c55e}.res-btn.w.on{border-color:#22c55e;background:rgba(34,197,94,.08)}
        .res-btn.be{color:#aaa}.res-btn.be.on{border-color:#aaa;background:rgba(161,161,170,.08)}
        .res-btn.l{color:#ef4444}.res-btn.l.on{border-color:#ef4444;background:rgba(239,68,68,.08)}

        .next-btn{width:100%;padding:14px;border-radius:10px;border:none;background:#22c55e;color:#000;font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:.1em;cursor:pointer;transition:all .2s;margin-top:8px}
        .next-btn:hover{background:#16a34a}
        .next-btn:disabled{background:#1a1a2a;color:#556;cursor:not-allowed}
        .back-btn{background:none;border:none;color:#667;font-size:12px;cursor:pointer;padding:8px 0;font-family:'DM Sans',sans-serif}
        .back-btn:hover{color:#aaa}

        .saved-box{margin:16px 20px;padding:22px;border-radius:14px;border:2px solid #22c55e;background:rgba(34,197,94,.05);text-align:center}
        .saved-icon{font-size:36px;margin-bottom:10px}
        .saved-title{font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:.05em;color:#22c55e}
        .saved-pnl{font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:600;margin:6px 0}
        .saved-pnl.W{color:#22c55e}.saved-pnl.L{color:#ef4444}.saved-pnl.BE{color:#888}
        .saved-detail{font-size:12px;color:#778;margin-bottom:14px}
        .new-btn{width:100%;padding:12px;border-radius:8px;border:2px solid #22c55e;background:none;color:#22c55e;font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:.1em;cursor:pointer}

        /* ── STATS ── */
        .stats-wrap{padding:16px 20px 0}
        .stats-title{font-family:'Bebas Neue',sans-serif;font-size:36px;letter-spacing:.05em;margin-bottom:12px}
        .sgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px}
        .scard{background:#09090f;border:1px solid #1a1a2a;border-radius:10px;padding:14px}
        .scard.full{grid-column:1/-1}
        .sval{font-family:'Bebas Neue',sans-serif;font-size:30px;letter-spacing:.03em}
        .sval.g{color:#22c55e}.sval.r{color:#ef4444}.sval.y{color:#f59e0b}.sval.b{color:#60a5fa}
        .slbl{font-size:10px;color:#8888aa;font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}
        .ssub{font-size:10px;color:#666688;font-family:'JetBrains Mono',monospace;margin-top:2px}

        .month-scroll{display:flex;gap:6px;padding-bottom:12px;overflow-x:auto;scrollbar-width:none}
        .month-scroll::-webkit-scrollbar{display:none}
        .mchip{padding:5px 12px;border-radius:20px;border:1px solid #1a1a2e;background:#09090f;color:#8888aa;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;transition:all .2s;flex-shrink:0}
        .mchip.on{border-color:#22c55e;color:#22c55e;background:rgba(34,197,94,.06)}

        .hist-list{display:flex;flex-direction:column;gap:6px;margin-top:8px}
        .htrade{background:#09090f;border:1px solid #1a1a2e;border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:10px}
        .hdot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
        .hdot.W{background:#22c55e}.hdot.L{background:#ef4444}.hdot.BE{background:#888}
        .hinfo{flex:1}
        .htop{display:flex;align-items:center;gap:7px;margin-bottom:2px}
        .hmkt{font-family:'Bebas Neue',sans-serif;font-size:17px;letter-spacing:.04em}
        .hdir{font-size:10px;font-weight:600;padding:1px 6px;border-radius:3px}
        .hdir.LONG{background:rgba(34,197,94,.1);color:#22c55e}
        .hdir.SHORT{background:rgba(239,68,68,.08);color:#ef4444}
        .hgrade{font-size:10px;color:#f59e0b;font-weight:700}
        .hmeta{font-size:10px;color:#778899;font-family:'JetBrains Mono',monospace}
        .hpnl{font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:600}
        .hdate{font-size:9px;color:#667788;margin-top:1px;text-align:right}
        /* ── LOG MODE TOGGLE ── */
        .log-mode-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0 20px 16px}
        .log-mode-btn{padding:11px;border-radius:10px;border:2px solid #1a1a2e;background:#0a0a14;cursor:pointer;font-family:'Bebas Neue',sans-serif;font-size:15px;letter-spacing:.06em;color:#778899;transition:all .2s}
        .log-mode-btn.on{border-color:#22c55e;background:rgba(34,197,94,.07);color:#86efac}
        .past-date-wrap{display:flex;flex-direction:column;gap:10px}
        .date-inp{background:#06060c;border:1px solid #1a1a2e;border-radius:8px;padding:10px 14px;color:#dde0f0;font-family:'JetBrains Mono',monospace;font-size:15px;outline:none;width:100%;transition:border-color .15s;-webkit-appearance:none;color-scheme:dark}
        .date-inp:focus{border-color:#22c55e}
        .past-badge{display:inline-block;font-family:'JetBrains Mono',monospace;font-size:9px;color:#f59e0b;background:rgba(245,158,11,.12);border-radius:4px;padding:2px 7px;letter-spacing:.06em;margin-left:6px;vertical-align:middle}

        /* ── EDIT / DELETE ── */
        .edit-del-row{display:flex;gap:6px;margin-top:6px}
        .edit-btn{flex:1;padding:7px;border-radius:7px;border:1px solid #1a1a2e;background:none;color:#778899;font-family:'Bebas Neue',sans-serif;font-size:13px;letter-spacing:.06em;cursor:pointer;transition:all .2s}
        .edit-btn:hover{border-color:#4488ff;color:#88aaff}
        .del-btn{padding:7px 12px;border-radius:7px;border:1px solid #2a1010;background:none;color:#ef4444;font-family:'Bebas Neue',sans-serif;font-size:13px;letter-spacing:.06em;cursor:pointer;transition:all .2s}
        .del-btn:hover{background:rgba(239,68,68,.08)}
        .edit-modal-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
        .edit-field{display:flex;flex-direction:column;gap:4px}
        .edit-lbl{font-family:'JetBrains Mono',monospace;font-size:9px;color:#778899;text-transform:uppercase;letter-spacing:.08em}
        .edit-inp{background:#06060c;border:1px solid #1a1a2e;border-radius:7px;padding:9px 12px;color:#dde0f0;font-family:'JetBrains Mono',monospace;font-size:13px;outline:none;width:100%;color-scheme:dark}
        .edit-inp:focus{border-color:#22c55e}
        .edit-btn-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px}
        .ebb{padding:9px 4px;border-radius:8px;border:2px solid #1a1a2e;background:#08080f;cursor:pointer;font-family:'Bebas Neue',sans-serif;font-size:14px;letter-spacing:.04em;color:#778899;transition:all .15s;text-align:center}
        .ebb.on-mkt{border-color:var(--mc);color:var(--mc);background:color-mix(in srgb,var(--mc) 8%,#08080f)}
        .ebb.on-dir-long{border-color:#22c55e;color:#22c55e;background:rgba(34,197,94,.07)}
        .ebb.on-dir-short{border-color:#ef4444;color:#ef4444;background:rgba(239,68,68,.07)}
        .ebb.on-w{border-color:#22c55e;color:#22c55e;background:rgba(34,197,94,.07)}
        .ebb.on-be{border-color:#888;color:#ccc;background:rgba(200,200,200,.05)}
        .ebb.on-l{border-color:#ef4444;color:#ef4444;background:rgba(239,68,68,.07)}

        /* ── DAY NOTES MODAL ── */
        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:50;display:flex;align-items:flex-end;justify-content:center}
        .modal{width:100%;max-width:480px;background:#0d0d1a;border-radius:18px 18px 0 0;border:1px solid #1a1a2e;padding:20px;max-height:85vh;overflow-y:auto}
        .modal-handle{width:36px;height:4px;background:#2a2a3e;border-radius:2px;margin:0 auto 16px}
        .modal-title{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:.06em;color:#f0f0f8;margin-bottom:4px}
        .modal-date{font-family:'JetBrains Mono',monospace;font-size:9px;color:#778899;text-transform:uppercase;letter-spacing:.1em;margin-bottom:14px}
        .modal-textarea{width:100%;background:#08080f;border:1px solid #1a1a2e;border-radius:10px;padding:12px 14px;color:#dde0f0;font-family:'DM Sans',sans-serif;font-size:14px;line-height:1.6;outline:none;resize:none;min-height:120px;transition:border-color .15s}
        .modal-textarea::placeholder{color:#334}
        .modal-textarea:focus{border-color:#22c55e}
        .modal-bias-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
        .modal-bias-btn{padding:10px;border-radius:8px;border:2px solid #1a1a2e;background:#08080f;cursor:pointer;font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:.04em;transition:all .2s}
        .modal-bias-btn.bull{color:#22c55e}.modal-bias-btn.bull.on{border-color:#22c55e;background:rgba(34,197,94,.08)}
        .modal-bias-btn.bear{color:#ef4444}.modal-bias-btn.bear.on{border-color:#ef4444;background:rgba(239,68,68,.08)}
        .modal-save-btn{width:100%;margin-top:12px;padding:13px;border-radius:10px;border:none;background:#22c55e;color:#000;font-family:'Bebas Neue',sans-serif;font-size:17px;letter-spacing:.1em;cursor:pointer}
        .modal-close-btn{width:100%;margin-top:8px;padding:10px;border-radius:10px;border:1px solid #1a1a2e;background:none;color:#778899;font-family:'Bebas Neue',sans-serif;font-size:14px;letter-spacing:.1em;cursor:pointer}
        .day-note-dot{position:absolute;top:4px;right:4px;width:4px;height:4px;border-radius:50%;background:#f59e0b}

        /* ── BE OUTCOME ── */
        .be-outcome-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px}
        .be-out-btn{padding:12px 6px;border-radius:10px;border:2px solid #1a1a2e;background:#0a0a14;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:11px;font-weight:600;transition:all .2s;color:#99aabb;text-align:center;line-height:1.4}
        .be-out-btn.tp.on{border-color:#22c55e;background:rgba(34,197,94,.08);color:#22c55e}
        .be-out-btn.sl.on{border-color:#ef4444;background:rgba(239,68,68,.08);color:#ef4444}
        .be-out-btn.consol.on{border-color:#f59e0b;background:rgba(245,158,11,.08);color:#f59e0b}
        .be-outcome-tag{font-size:9px;font-family:'JetBrains Mono',monospace;padding:2px 6px;border-radius:3px;font-weight:700}
        .be-outcome-tag.tp{background:rgba(34,197,94,.15);color:#22c55e}
        .be-outcome-tag.sl{background:rgba(239,68,68,.12);color:#ef4444}
        .be-outcome-tag.consol{background:rgba(245,158,11,.12);color:#f59e0b}
      `}</style>

      <div className="app">
        {/* NAV */}
        <div className="nav">
          {[["calendar","📅 Calendar"],["log","📝 Log"],["stats","📊 Stats"]].map(([id,lbl])=>(
            <button key={id} className={`nb ${view===id?"on":""}`} onClick={()=>setView(id)}>{lbl}</button>
          ))}
        </div>

        {/* ── CALENDAR VIEW ── */}
        {view==="calendar" && (
          <>
            <div className="cal-header">
              <button className="cal-nav" onClick={calPrevMonth}>‹</button>
              <div className="cal-month">{getMonthLabel(calMonth)}</div>
              <button className="cal-nav" onClick={calNextMonth}>›</button>
            </div>

            {/* Month summary */}
            {(() => {
              const mTrades = trades.filter(t => getMonthKey(t.date) === calMonth);
              const mPnl = mTrades.reduce((s,t)=>s+t.pnl,0);
              const mW = mTrades.filter(t=>t.result==="W").length;
              const mL = mTrades.filter(t=>t.result==="L").length;
              const mWR = (mW+mL)>0 ? Math.round(mW/(mW+mL)*100) : 0;
              return (
                <div className="cal-summary">
                  <div className="cal-stat">
                    <div className="cs-val" style={{color:mPnl>=0?"#22c55e":"#ef4444"}}>{fmt(mPnl)}</div>
                    <div className="cs-lbl">Month P&L</div>
                  </div>
                  <div className="cal-stat">
                    <div className="cs-val" style={{color:mWR>=70?"#22c55e":mWR>=50?"#f59e0b":"#ef4444"}}>{mWR}%</div>
                    <div className="cs-lbl">Win Rate</div>
                  </div>
                  <div className="cal-stat">
                    <div className="cs-val" style={{color:"#f0f0f8"}}>{mTrades.length}</div>
                    <div className="cs-lbl">Trades</div>
                  </div>
                </div>
              );
            })()}

            {/* Day of week headers */}
            <div className="dow-row">
              {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d=><div key={d} className="dow">{d}</div>)}
            </div>

            {/* Calendar grid */}
            <div className="cal-grid">
              {Array.from({length:firstDay}).map((_,i)=>(
                <div key={`e${i}`} className="cal-day empty" />
              ))}
              {Array.from({length:daysInMonth}).map((_,i)=>{
                const day = i+1;
                const dk = `${calMonth}-${String(day).padStart(2,"0")}`;
                const dayTrades = tradesByDay[dk] || [];
                const pnl = dayPnl(dk);
                const hasTrades = dayTrades.length > 0;
                const todayStr = getDateKey(new Date());
                const isToday = dk === todayStr;
                const isSelected = dk === selectedDay;
                let cls = "cal-day";
                if (hasTrades) cls += " has-trades";
                if (hasTrades && pnl > 50) cls += " profit";
                else if (hasTrades && pnl < -50) cls += " loss";
                else if (hasTrades) cls += " breakeven";
                if (isToday) cls += " today";
                if (isSelected) cls += " selected";
                return (
                  <div key={dk} className={cls} onClick={()=>setDayModal({ dk, draft: (dayNotes[dk] && dayNotes[dk].notes) || "", bias: (dayNotes[dk] && dayNotes[dk].bias) || null })}>
                    <div className="day-num">{day}</div>
                    {hasTrades && (
                      <>
                        <div className="day-dot" />
                        <div className="day-pnl" style={{color:pnlColor(pnl)}}>{pnl>0?"+":""}${Math.round(Math.abs(pnl)/100)*100 >= 1000 ? (Math.abs(pnl)/1000).toFixed(1)+"k" : Math.abs(pnl).toFixed(0)}</div>
                      </>
                    )}
                    {dayNotes[dk] && dayNotes[dk].notes && <div className="day-note-dot"/>}
                  </div>
                );
              })}
            </div>

            {/* Selected day detail - still shown below grid when modal not open */}
            {selectedDay && (tradesByDay[selectedDay]||[]).length > 0 && !dayModal && (
              <div className="day-detail">
                <div className="dd-header">
                  <div className="dd-date">{new Date(selectedDay).toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"})}</div>
                  <div className="dd-pnl" style={{color:pnlColor(dayPnl(selectedDay))}}>{fmt(dayPnl(selectedDay))}</div>
                </div>
                {(tradesByDay[selectedDay]||[]).map(t=>(
                  <div key={t.id} className="dd-trade">
                    <div className={`dd-dot ${t.result}`} />
                    <div className="dd-info">
                      <div className="dd-top">
                        <span className="dd-market" style={{color:MARKET_COLOR[t.market]||"#888"}}>{t.market}</span>
                        <span className={`dd-dir ${t.direction}`}>{t.direction}</span>
                        {t.beOutcome && <span className={`be-outcome-tag ${t.beOutcome}`}>{t.beOutcome==="tp"?"→ TP":t.beOutcome==="sl"?"→ SL":"Consol."}</span>}
                        {t.imported && <span className="imp-badge">imported</span>}
                      </div>
                      <div className="dd-meta">{t.units} units · {new Date(t.date).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}</div>
                      <div className="edit-del-row">
                        <button className="edit-btn" onClick={()=>{ setDayModal(null); openEdit(t); }}>✏️ Edit</button>
                        <button className="del-btn" onClick={()=>setConfirmDelete(t.id)}>🗑 Delete</button>
                      </div>
                    </div>
                    <div>
                      <div className="dd-amt" style={{color:pnlColor(t.pnl)}}>{fmt(t.pnl)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── DAY NOTES MODAL ── */}
        {dayModal && (
          <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setDayModal(null); }}>
            <div className="modal">
              <div className="modal-handle"/>
              <div className="modal-title">{new Date(dayModal.dk+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</div>
              <div className="modal-date">Day Notes & Bias</div>

              {(tradesByDay[dayModal.dk]||[]).length > 0 && (
                <div style={{marginBottom:14,background:"#08080f",borderRadius:10,border:"1px solid #1a1a2e",overflow:"hidden"}}>
                  {(tradesByDay[dayModal.dk]||[]).map(t=>(
                    <div key={t.id} className="dd-trade" style={{borderBottom:"1px solid #0d0d18"}}>
                      <div className={`dd-dot ${t.result}`} />
                      <div className="dd-info">
                        <div className="dd-top">
                          <span className="dd-market" style={{color:MARKET_COLOR[t.market]||"#888"}}>{t.market}</span>
                          <span className={`dd-dir ${t.direction}`}>{t.direction}</span>
                          {t.beOutcome && <span className={`be-outcome-tag ${t.beOutcome}`}>{t.beOutcome==="tp"?"→ TP":t.beOutcome==="sl"?"→ SL":"Consol."}</span>}
                        </div>
                        <div className="dd-meta">{new Date(t.date).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}</div>
                        <div className="edit-del-row">
                          <button className="edit-btn" onClick={()=>{ setDayModal(null); openEdit(t); }}>✏️ Edit</button>
                          <button className="del-btn" onClick={()=>{ setDayModal(null); setConfirmDelete(t.id); }}>🗑 Delete</button>
                        </div>
                      </div>
                      <div className="dd-amt" style={{color:pnlColor(t.pnl)}}>{fmt(t.pnl)}</div>
                    </div>
                  ))}
                  <div style={{padding:"8px 14px",display:"flex",justifyContent:"space-between",borderTop:"1px solid #1a1a2e"}}>
                    <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:"#778899"}}>Day P&L</span>
                    <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:600,color:pnlColor(dayPnl(dayModal.dk))}}>{fmt(dayPnl(dayModal.dk))}</span>
                  </div>
                </div>
              )}

              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"#778899",textTransform:"uppercase",letterSpacing:".1em",marginBottom:6}}>Daily Bias</div>
              <div className="modal-bias-row">
                <button className={`modal-bias-btn bull ${dayModal.bias==="bull"?"on":""}`} onClick={()=>setDayModal(m=>({...m,bias:m.bias==="bull"?null:"bull"}))}>▲ Bullish</button>
                <button className={`modal-bias-btn bear ${dayModal.bias==="bear"?"on":""}`} onClick={()=>setDayModal(m=>({...m,bias:m.bias==="bear"?null:"bear"}))}>▼ Bearish</button>
              </div>

              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"#778899",textTransform:"uppercase",letterSpacing:".1em",margin:"14px 0 6px"}}>Notes</div>
              <textarea
                className="modal-textarea"
                placeholder="Market structure, key levels, what you saw, lessons..."
                value={dayModal.draft}
                onChange={e=>setDayModal(m=>({...m,draft:e.target.value}))}
                rows={5}
              />

              <button className="modal-save-btn" onClick={()=>{
                setDayNotes(n=>({...n,[dayModal.dk]:{notes:dayModal.draft,bias:dayModal.bias}}));
                setDayModal(null);
              }}>SAVE</button>
              <button className="modal-close-btn" onClick={()=>setDayModal(null)}>CANCEL</button>
            </div>
          </div>
        )}

        {/* ── LOG VIEW ── */}
        {view==="log" && (
          <>
            {saved ? (
              <div className="saved-box">
                <div className="saved-icon">{form.result==="W"?"🏆":form.result==="BE"?"🤝":"📉"}</div>
                <div className="saved-title">Trade Logged</div>
                <div className={`saved-pnl ${form.result}`}>{form.result==="BE"?`~$${parseFloat(form.pnl).toFixed(0)}`:form.result==="W"?`+$${parseFloat(form.pnl).toFixed(0)}`:`-$${parseFloat(form.pnl).toFixed(0)}`}</div>
                <div className="saved-detail">{form.market} · {form.direction} · {autoGrade(form.confluences).label} · {form.units} units{logMode==="past" && form.pastDate ? ` · ${new Date(form.pastDate+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}` : ""}</div>
                <button className="new-btn" onClick={resetForm}>+ LOG ANOTHER</button>
              </div>
            ) : (
              <>
                <div className="log-header">
                  <div className="log-title">LOG TRADE{logMode==="past" && <span className="past-badge">PAST</span>}</div>
                  <div className="log-sub">{logMode==="past" ? `Step ${step} of 7` : `Step ${step} of 6`} — tap to select</div>
                </div>

                {/* Mode toggle */}
                <div className="log-mode-row">
                  <button className={`log-mode-btn ${logMode==="now"?"on":""}`} onClick={()=>{setLogMode("now");setStep(1);}}>🕐 NOW</button>
                  <button className={`log-mode-btn ${logMode==="past"?"on":""}`} onClick={()=>{setLogMode("past");setStep(0);}}>📅 PAST TRADE</button>
                </div>

                <div className="steps">
                  {(logMode==="past"?[0,1,2,3,4,5,6]:[1,2,3,4,5,6]).map(s=><div key={s} className={`sdot ${s<step?"done":s===step?"active":""}`}/>)}
                </div>

                {/* Step 0 — Past Date (only in past mode) */}
                {step===0 && logMode==="past" && (
                  <div className="sec">
                    <div className="sec-lbl">When was this trade?</div>
                    <div className="past-date-wrap">
                      <div className="irow">
                        <div className="ilbl">Date</div>
                        <input className="date-inp" type="date" value={form.pastDate} onChange={e=>setForm(f=>({...f,pastDate:e.target.value}))} max={new Date().toISOString().slice(0,10)} />
                      </div>
                      <div className="irow">
                        <div className="ilbl">Time (optional)</div>
                        <input className="date-inp" type="time" value={form.pastTime} onChange={e=>setForm(f=>({...f,pastTime:e.target.value}))} />
                      </div>
                    </div>
                    <button className="next-btn" disabled={!form.pastDate} onClick={()=>setStep(1)} style={{marginTop:14}}>NEXT →</button>
                  </div>
                )}

                {/* Step 1 — Market */}
                {step===1 && (
                  <div className="sec">
                    <div className="sec-lbl">Market</div>
                    <div className="mkt-grid">
                      {[["NQ","NAS100","#00d4ff",20],["XAU","XAUUSD","#f5c842",50]].map(([id,name,color,lev])=>(
                        <button key={id} className={`mkt-card ${form.market===id?"on":""}`} style={{"--ac":color}} onClick={()=>{setForm(f=>({...f,market:id}));setStep(2)}}>
                          <div className="mkt-name" style={{color}}>{id}</div>
                          <div className="mkt-lev">{name} · {lev}:1</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step 2 — Direction */}
                {step===2 && (
                  <div className="sec">
                    <div className="sec-lbl">Direction</div>
                    <div className="dir-grid">
                      <button className={`dir-btn long ${form.direction==="LONG"?"on":""}`} onClick={()=>{setForm(f=>({...f,direction:"LONG"}));setStep(3)}}>▲ LONG</button>
                      <button className={`dir-btn short ${form.direction==="SHORT"?"on":""}`} onClick={()=>{setForm(f=>({...f,direction:"SHORT"}));setStep(3)}}>▼ SHORT</button>
                    </div>
                    <button className="back-btn" onClick={()=>setStep(logMode==="past"?0:1)}>← Back</button>
                  </div>
                )}

                {/* Step 3 — Confluences */}
                {step===3 && (
                  <div className="sec">
                    <div className="sec-lbl">Confluences</div>
                    <div className="conf-grid">
                      {CONFLUENCES.map(c=>(
                        <button key={c.id} className={`conf-chip ${form.confluences.includes(c.id)?"on":""}`} onClick={()=>toggleConf(c.id)}>
                          <span className="conf-icon">{c.icon}</span>
                          <span className="conf-label">{c.label}</span>
                        </button>
                      ))}
                    </div>
                    {form.confluences.length>0 && (
                      <div className="grade-preview" style={{"--gc":grade.color}}>
                        <div className="gp-top">
                          <div className="gp-grade">{grade.label}</div>
                          <div className="gp-score">{grade.score}/100</div>
                        </div>
                        <div className="gp-bar-bg"><div className="gp-bar" style={{width:`${grade.score}%`}}/></div>
                        <div className="gp-reason">{grade.reason}</div>
                      </div>
                    )}
                    <button className="next-btn" disabled={form.confluences.length===0} onClick={()=>setStep(4)} style={{marginTop:14}}>NEXT →</button>
                    <button className="back-btn" onClick={()=>setStep(2)}>← Back</button>
                  </div>
                )}

                {/* Step 4 — Numbers */}
                {step===4 && (
                  <div className="sec">
                    <div className="sec-lbl">Position Size</div>
                    <div className="igrp">
                      <div className="irow">
                        <div className="ilbl">Units / Lots</div>
                        <input className="ninp" type="number" inputMode="decimal" placeholder="0.00" value={form.units} onChange={e=>setForm(f=>({...f,units:e.target.value}))} />
                      </div>
                      <div className="irow">
                        <div className="ilbl">P&L Amount ($)</div>
                        <input className="ninp" type="number" inputMode="decimal" placeholder="0" value={form.pnl} onChange={e=>setForm(f=>({...f,pnl:e.target.value}))} />
                      </div>
                    </div>
                    <button className="next-btn" disabled={!form.units||!form.pnl} onClick={()=>setStep(5)} style={{marginTop:14}}>NEXT →</button>
                    <button className="back-btn" onClick={()=>setStep(3)}>← Back</button>
                  </div>
                )}

                {/* Step 5 — Result */}
                {step===5 && (
                  <div className="sec">
                    <div className="sec-lbl">Result</div>
                    <div className="res-grid">
                      <button className={`res-btn w ${form.result==="W"?"on":""}`} onClick={()=>setForm(f=>({...f,result:"W"}))}>WIN</button>
                      <button className={`res-btn be ${form.result==="BE"?"on":""}`} onClick={()=>setForm(f=>({...f,result:"BE"}))}>BE</button>
                      <button className={`res-btn l ${form.result==="L"?"on":""}`} onClick={()=>setForm(f=>({...f,result:"L"}))}>LOSS</button>
                    </div>
                    {form.result==="BE" && (
                      <div style={{marginTop:10,padding:"10px 14px",background:"#06060c",borderRadius:8,border:"1px solid #111120"}}>
                        <div className="ilbl" style={{marginBottom:4}}>Actual P&L (+ or -)</div>
                        <input className="ninp" type="number" inputMode="decimal" placeholder="-50" value={form.pnl} onChange={e=>setForm(f=>({...f,pnl:e.target.value}))} />
                      </div>
                    )}
                    <button className="next-btn" disabled={!form.result||(form.result==="BE"&&!form.pnl)} onClick={()=>setStep(6)} style={{marginTop:14}}>NEXT →</button>
                    <button className="back-btn" onClick={()=>setStep(4)}>← Back</button>
                  </div>
                )}

                {/* Step 6 — BE Outcome + Save */}
                {step===6 && (
                  <div className="sec">
                    {form.result==="BE" && (
                      <>
                        <div className="sec-lbl">After BE — what happened?</div>
                        <div className="be-outcome-grid">
                          <button className={`be-out-btn tp ${form.beOutcome==="tp"?"on":""}`} onClick={()=>setForm(f=>({...f,beOutcome:f.beOutcome==="tp"?null:"tp"}))}>
                            🎯<br/>→ TP<br/><span style={{fontSize:9,opacity:.7}}>Hit target</span>
                          </button>
                          <button className={`be-out-btn sl ${form.beOutcome==="sl"?"on":""}`} onClick={()=>setForm(f=>({...f,beOutcome:f.beOutcome==="sl"?null:"sl"}))}>
                            ❌<br/>→ SL<br/><span style={{fontSize:9,opacity:.7}}>Stopped out</span>
                          </button>
                          <button className={`be-out-btn consol ${form.beOutcome==="consol"?"on":""}`} onClick={()=>setForm(f=>({...f,beOutcome:f.beOutcome==="consol"?null:"consol"}))}>
                            〰️<br/>Consol.<br/><span style={{fontSize:9,opacity:.7}}>Chopped</span>
                          </button>
                        </div>
                      </>
                    )}
                    <button className="next-btn" onClick={submitTrade} style={{marginTop:14}}>SAVE TRADE ✓</button>
                    <button className="back-btn" onClick={()=>setStep(5)}>← Back</button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── STATS VIEW ── */}
        {view==="stats" && (
          <div className="stats-wrap">
            <div className="stats-title">STATS</div>

            {trades.length === 0 ? (
              <div style={{textAlign:"center",padding:"40px 20px",color:"#778899",fontFamily:"'JetBrains Mono',monospace",fontSize:12}}>No trades logged yet.</div>
            ) : (() => {
              // ── computed values ──────────────────────────────────────
              const wins  = trades.filter(t => t.result === "W");
              const losses = trades.filter(t => t.result === "L");
              const bes   = trades.filter(t => t.result === "BE");
              const wr    = (wins.length + losses.length) > 0 ? Math.round(wins.length / (wins.length + losses.length) * 100) : 0;
              const tPnl  = trades.reduce((s,t) => s + t.pnl, 0);
              const avgWin  = wins.length  > 0 ? wins.reduce((s,t)=>s+t.pnl,0)  / wins.length  : 0;
              const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s,t)=>s+t.pnl,0) / losses.length) : 0;
              const rr = avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : "—";
              const grossWin  = wins.reduce((s,t)=>s+t.pnl,0);
              const grossLoss = Math.abs(losses.reduce((s,t)=>s+t.pnl,0));
              const pf = grossLoss > 0 ? (grossWin / grossLoss).toFixed(2) : "—";
              const best  = trades.reduce((b,t) => t.pnl > b.pnl ? t : b, trades[0]);
              const worst = trades.reduce((w,t) => t.pnl < w.pnl ? t : w, trades[0]);
              const avgScore = Math.round(trades.reduce((s,t)=>s+(t.score||0),0) / trades.length);

              // streak
              let curStreak = 0, streakType = "";
              for (let i = 0; i < trades.length; i++) {
                const r = trades[i].result;
                if (i === 0) { streakType = r; curStreak = r !== "BE" ? 1 : 0; continue; }
                if (r === streakType && r !== "BE") curStreak++;
                else break;
              }

              // last 10
              const last10 = trades.slice(0, 10);
              const l10pnl = last10.reduce((s,t)=>s+t.pnl,0);
              const l10w   = last10.filter(t=>t.result==="W").length;
              const l10wr  = (l10w + last10.filter(t=>t.result==="L").length) > 0
                ? Math.round(l10w / (l10w + last10.filter(t=>t.result==="L").length) * 100) : 0;

              // weekly stats — group by ISO week
              const getWeekKey = (dateStr) => {
                const d = new Date(dateStr);
                const day = d.getDay(); // 0=Sun
                const diff = day === 0 ? -6 : 1 - day; // shift to Monday
                const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
                return mon.getFullYear() + "-" + String(mon.getMonth()+1).padStart(2,"0") + "-" + String(mon.getDate()).padStart(2,"0");
              };
              const weekMap = {};
              trades.forEach(t => {
                const wk = getWeekKey(t.date);
                if (!weekMap[wk]) weekMap[wk] = [];
                weekMap[wk].push(t);
              });
              const weeks = Object.keys(weekMap).sort().reverse().slice(0, 8);

              // daily avg & best trading day of week
              const dowMap = {0:[], 1:[], 2:[], 3:[], 4:[], 5:[], 6:[]};
              trades.forEach(t => { dowMap[new Date(t.date).getDay()].push(t.pnl); });
              const dowLabels = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
              const bestDow = Object.entries(dowMap)
                .filter(([,v]) => v.length > 0)
                .map(([k,v]) => ({ day: parseInt(k), avg: v.reduce((a,b)=>a+b,0)/v.length, count: v.length }))
                .sort((a,b) => b.avg - a.avg)[0];

              // long vs short
              const longs  = trades.filter(t => t.direction === "LONG");
              const shorts = trades.filter(t => t.direction === "SHORT");
              const lPnl = longs.reduce((s,t)=>s+t.pnl,0);
              const sPnl = shorts.reduce((s,t)=>s+t.pnl,0);
              const lWR  = longs.filter(t=>t.result==="W").length;
              const lLR  = longs.filter(t=>t.result==="L").length;
              const sWR  = shorts.filter(t=>t.result==="W").length;
              const sLR  = shorts.filter(t=>t.result==="L").length;
              const longWR  = (lWR+lLR)>0 ? Math.round(lWR/(lWR+lLR)*100) : 0;
              const shortWR = (sWR+sLR)>0 ? Math.round(sWR/(sWR+sLR)*100) : 0;

              // grade dist
              const gradeDist = {Aplus:0, A:0, Bplus:0, B:0, C:0};
              trades.forEach(t => { if (gradeDist[t.grade] !== undefined) gradeDist[t.grade]++; });
              const gradeColors = { Aplus:"#22c55e", A:"#86efac", Bplus:"#f59e0b", B:"#fb923c", C:"#ef4444" };
              const gradeLabels = { Aplus:"A+", A:"A", Bplus:"B+", B:"B", C:"C" };

              // annualized (simple: daily avg * 252 trading days)
              const sortedDates = trades.map(t=>new Date(t.date)).sort((a,b)=>a-b);
              const spanDays = sortedDates.length > 1
                ? Math.max(1, (sortedDates[sortedDates.length-1] - sortedDates[0]) / 86400000)
                : 1;
              const dailyAvg = tPnl / spanDays;
              const annualized = Math.round(dailyAvg * 365);

              return (
                <>
                  {/* Row 1 — P&L + WR */}
                  <div className="sgrid">
                    <div className="scard full">
                      <div className="slbl">All-Time P&L</div>
                      <div className={`sval ${tPnl>=0?"g":"r"}`}>{fmt(tPnl)}</div>
                      <div className="ssub">{trades.length} trades · {wins.length}W {losses.length}L {bes.length}BE</div>
                    </div>
                    <div className="scard">
                      <div className="slbl">Win Rate</div>
                      <div className={`sval ${wr>=70?"g":wr>=50?"y":"r"}`}>{wr}%</div>
                      <div className="ssub">excl. BE</div>
                    </div>
                    <div className="scard">
                      <div className="slbl">Avg Score</div>
                      <div className={`sval ${avgScore>=75?"g":avgScore>=60?"y":"r"}`}>{avgScore}</div>
                      <div className="ssub">setup quality</div>
                    </div>
                  </div>

                  {/* Row 2 — RR, PF, streak */}
                  <div className="sgrid">
                    <div className="scard">
                      <div className="slbl">Avg R:R</div>
                      <div className="sval b">{rr}</div>
                      <div className="ssub">win / loss</div>
                    </div>
                    <div className="scard">
                      <div className="slbl">Profit Factor</div>
                      <div className={`sval ${parseFloat(pf)>=1.5?"g":parseFloat(pf)>=1?"y":"r"}`}>{pf}</div>
                      <div className="ssub">gross W / gross L</div>
                    </div>
                    <div className="scard">
                      <div className="slbl">Current Streak</div>
                      <div className={`sval ${streakType==="W"?"g":streakType==="L"?"r":"b"}`}>{curStreak > 0 ? `${curStreak}${streakType}` : "—"}</div>
                      <div className="ssub">in a row</div>
                    </div>
                    <div className="scard">
                      <div className="slbl">Ann. Return</div>
                      <div className={`sval ${annualized>=0?"g":"r"}`} style={{fontSize:22}}>{annualized >= 0 ? "+" : ""}{annualized >= 1000 || annualized <= -1000 ? `$${(annualized/1000).toFixed(1)}k` : `$${annualized}`}</div>
                      <div className="ssub">proj / year</div>
                    </div>
                  </div>

                  {/* Row 3 — avg win / loss */}
                  <div className="sgrid">
                    <div className="scard">
                      <div className="slbl">Avg Win</div>
                      <div className="sval g" style={{fontSize:22}}>{fmt(avgWin)}</div>
                      <div className="ssub">{wins.length} wins</div>
                    </div>
                    <div className="scard">
                      <div className="slbl">Avg Loss</div>
                      <div className="sval r" style={{fontSize:22}}>-{fmt(avgLoss)}</div>
                      <div className="ssub">{losses.length} losses</div>
                    </div>
                    <div className="scard">
                      <div className="slbl">Best Trade</div>
                      <div className="sval g" style={{fontSize:20}}>{fmt(best.pnl)}</div>
                      <div className="ssub">{best.market} · {new Date(best.date).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
                    </div>
                    <div className="scard">
                      <div className="slbl">Worst Trade</div>
                      <div className="sval r" style={{fontSize:20}}>{fmt(worst.pnl)}</div>
                      <div className="ssub">{worst.market} · {new Date(worst.date).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
                    </div>
                  </div>

                  {/* Last 10 trades */}
                  <div className="stat-section">
                    <div className="stat-section-hdr">
                      <span>LAST 10 TRADES</span>
                      <span style={{color:l10pnl>=0?"#22c55e":"#ef4444",fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:600}}>{fmt(l10pnl)}</span>
                    </div>
                    <div style={{display:"flex",gap:3,marginBottom:8}}>
                      {last10.map((t,i) => (
                        <div key={i} style={{flex:1,height:28,borderRadius:4,background:t.result==="W"?"#22c55e":t.result==="L"?"#ef4444":"#555",display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,fontFamily:"'JetBrains Mono',monospace",color:"#000",fontWeight:700}}>
                          {t.result}
                        </div>
                      ))}
                      {Array.from({length: Math.max(0, 10-last10.length)}).map((_,i) => (
                        <div key={"e"+i} style={{flex:1,height:28,borderRadius:4,background:"#111120"}} />
                      ))}
                    </div>
                    <div className="ssub">{l10wr}% win rate · {l10w}W {last10.filter(t=>t.result==="L").length}L over last {last10.length}</div>
                  </div>

                  {/* Long vs Short */}
                  <div className="stat-section">
                    <div className="stat-section-hdr"><span>LONG VS SHORT</span></div>
                    <div className="sgrid" style={{marginBottom:0}}>
                      <div className="scard">
                        <div style={{color:"#22c55e",fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:".06em",marginBottom:4}}>▲ LONG</div>
                        <div className={`sval ${longWR>=70?"g":longWR>=50?"y":"r"}`} style={{fontSize:26}}>{longWR}%</div>
                        <div className="ssub">{longs.length} trades</div>
                        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,fontWeight:600,color:lPnl>=0?"#22c55e":"#ef4444",marginTop:4}}>{fmt(lPnl)}</div>
                      </div>
                      <div className="scard">
                        <div style={{color:"#ef4444",fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:".06em",marginBottom:4}}>▼ SHORT</div>
                        <div className={`sval ${shortWR>=70?"g":shortWR>=50?"y":"r"}`} style={{fontSize:26}}>{shortWR}%</div>
                        <div className="ssub">{shorts.length} trades</div>
                        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,fontWeight:600,color:sPnl>=0?"#22c55e":"#ef4444",marginTop:4}}>{fmt(sPnl)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Weekly breakdown */}
                  <div className="stat-section">
                    <div className="stat-section-hdr"><span>WEEKLY BREAKDOWN</span></div>
                    {weeks.map(wk => {
                      const wt = weekMap[wk];
                      const wpnl = wt.reduce((s,t)=>s+t.pnl,0);
                      const ww = wt.filter(t=>t.result==="W").length;
                      const wl = wt.filter(t=>t.result==="L").length;
                      const wwr = (ww+wl)>0 ? Math.round(ww/(ww+wl)*100) : 0;
                      const [wy, wm, wd] = wk.split("-").map(Number);
                      const monDate = new Date(wy, wm-1, wd);
                      const friDate = new Date(wy, wm-1, wd + 4);
                      return (
                        <div key={wk} className="week-row">
                          <div style={{flex:1}}>
                            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"#778899"}}>
                              {monDate.toLocaleDateString("en-US",{month:"short",day:"numeric"})} – {friDate.toLocaleDateString("en-US",{month:"short",day:"numeric"})}
                            </div>
                            <div style={{display:"flex",gap:2,marginTop:4}}>
                              {wt.map((t,i) => <div key={i} style={{width:8,height:8,borderRadius:2,background:t.result==="W"?"#22c55e":t.result==="L"?"#ef4444":"#555"}} />)}
                            </div>
                          </div>
                          <div style={{textAlign:"right"}}>
                            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:600,color:wpnl>=0?"#22c55e":"#ef4444"}}>{fmt(wpnl)}</div>
                            <div className="ssub">{wt.length}t · {wwr}%WR</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Best day of week */}
                  <div className="stat-section">
                    <div className="stat-section-hdr"><span>P&L BY DAY OF WEEK</span></div>
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {[1,2,3,4,5].map(d => {
                        const dTrades = dowMap[d];
                        if (dTrades.length === 0) return null;
                        const dPnl = dTrades.reduce((a,b)=>a+b,0);
                        const dAvg = dPnl / dTrades.length;
                        const maxAbs = Math.max(...[1,2,3,4,5].map(x => Math.abs(dowMap[x].reduce((a,b)=>a+b,0))), 1);
                        const barW = Math.round(Math.abs(dPnl) / maxAbs * 100);
                        return (
                          <div key={d} style={{display:"flex",alignItems:"center",gap:8}}>
                            <div style={{width:28,fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"#778899",textTransform:"uppercase"}}>{dowLabels[d]}</div>
                            <div style={{flex:1,height:20,background:"#0d0d18",borderRadius:4,overflow:"hidden",position:"relative"}}>
                              <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${barW}%`,background:dPnl>=0?"rgba(34,197,94,.3)":"rgba(239,68,68,.25)",borderRadius:4}}/>
                              <div style={{position:"absolute",left:8,top:0,height:"100%",display:"flex",alignItems:"center",fontFamily:"'JetBrains Mono',monospace",fontSize:9,fontWeight:600,color:dPnl>=0?"#22c55e":"#ef4444"}}>
                                {fmt(dPnl)}
                              </div>
                            </div>
                            <div style={{width:40,fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"#778899",textAlign:"right"}}>{dTrades.length}t</div>
                          </div>
                        );
                      })}
                    </div>
                    {bestDow && (
                      <div style={{marginTop:8,fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"#f59e0b"}}>
                        Best day: {dowLabels[bestDow.day]} (avg {fmt(Math.round(bestDow.avg))}/trade)
                      </div>
                    )}
                  </div>

                  {/* Setup grade distribution */}
                  <div className="stat-section">
                    <div className="stat-section-hdr"><span>SETUP GRADE DIST.</span></div>
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {["Aplus","A","Bplus","B","C"].map(g => {
                        const count = gradeDist[g];
                        const pct = trades.length > 0 ? Math.round(count/trades.length*100) : 0;
                        return (
                          <div key={g} style={{display:"flex",alignItems:"center",gap:8}}>
                            <div style={{width:22,fontFamily:"'Bebas Neue',sans-serif",fontSize:14,color:gradeColors[g]}}>{gradeLabels[g]}</div>
                            <div style={{flex:1,height:20,background:"#0d0d18",borderRadius:4,overflow:"hidden",position:"relative"}}>
                              <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${pct}%`,background:gradeColors[g]+"33",borderRadius:4,transition:"width .4s"}}/>
                              <div style={{position:"absolute",left:8,top:0,height:"100%",display:"flex",alignItems:"center",fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:gradeColors[g]}}>{count} trades</div>
                            </div>
                            <div style={{width:30,fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"#778899",textAlign:"right"}}>{pct}%</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Market breakdown */}
                  <div className="stat-section">
                    <div className="stat-section-hdr"><span>BY MARKET</span></div>
                    <div className="sgrid" style={{marginBottom:0}}>
                      {[{id:"NQ",label:"NAS100",color:"#00d4ff"},{id:"XAU",label:"XAUUSD",color:"#f5c842"}].map(({id,label,color}) => {
                        const mt = trades.filter(t => t.market === id);
                        if (mt.length === 0) return null;
                        const mW = mt.filter(t=>t.result==="W").length;
                        const mL = mt.filter(t=>t.result==="L").length;
                        const mBE = mt.filter(t=>t.result==="BE").length;
                        const mWR = (mW+mL)>0 ? Math.round(mW/(mW+mL)*100) : 0;
                        const mPnl = mt.reduce((s,t)=>s+t.pnl,0);
                        return (
                          <div key={id} className="scard">
                            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:".06em",color}}>{id}</div>
                              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:"#778899",textTransform:"uppercase"}}>{label}</div>
                            </div>
                            <div className={`sval ${mWR>=70?"g":mWR>=50?"y":"r"}`} style={{fontSize:26}}>{mWR}%</div>
                            <div className="ssub">{mt.length}t · {mW}W {mL}L {mBE>0?mBE+"BE":""}</div>
                            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,fontWeight:600,color:mPnl>=0?"#22c55e":"#ef4444",marginTop:4}}>{fmt(mPnl)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Monthly breakdown */}
                  <div className="stat-section">
                    <div className="stat-section-hdr"><span>BY MONTH</span></div>
                    <div className="month-scroll">
                      {months.map(m=>{
                        const mt = trades.filter(t=>getMonthKey(t.date)===m);
                        const mp = mt.reduce((s,t)=>s+t.pnl,0);
                        return (
                          <button key={m} className="mchip" style={{color:mp>=0?"#22c55e":"#ef4444",borderColor:mp>=0?"rgba(34,197,94,.2)":"rgba(239,68,68,.15)"}} onClick={()=>{setCalMonth(m);setView("calendar")}}>
                            {getMonthLabel(m).split(" ")[0]} {fmt(mp)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Recent trades list */}
                  <div className="stat-section">
                    <div className="stat-section-hdr"><span>RECENT TRADES</span></div>
                    <div className="hist-list">
                      {trades.slice(0,20).map(t=>(
                        <div key={t.id} className="htrade" style={{flexDirection:"column",alignItems:"stretch",gap:6}}>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <div className={`hdot ${t.result}`}/>
                            <div className="hinfo">
                              <div className="htop">
                                <span className="hmkt" style={{color:MARKET_COLOR[t.market]||"#888"}}>{t.market}</span>
                                <span className={`hdir ${t.direction}`}>{t.direction}</span>
                                <span className="hgrade">{t.gradeLabel}</span>
                                {t.beOutcome && <span className={`be-outcome-tag ${t.beOutcome}`}>{t.beOutcome==="tp"?"→TP":t.beOutcome==="sl"?"→SL":"Con."}</span>}
                              </div>
                              <div className="hmeta">{t.units} units · {new Date(t.date).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
                            </div>
                            <div style={{marginLeft:"auto",textAlign:"right"}}>
                              <div className="hpnl" style={{color:pnlColor(t.pnl)}}>{fmt(t.pnl)}</div>
                              <div className="hdate">{t.score}/100</div>
                            </div>
                          </div>
                          <div className="edit-del-row">
                            <button className="edit-btn" onClick={()=>openEdit(t)}>✏️ Edit</button>
                            <button className="del-btn" onClick={()=>setConfirmDelete(t.id)}>🗑 Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}
        {/* ── CONFIRM DELETE MODAL ── */}
        {confirmDelete && (
          <div className="modal-overlay" onClick={()=>setConfirmDelete(null)}>
            <div className="modal" onClick={e=>e.stopPropagation()}>
              <div className="modal-handle"/>
              <div className="modal-title" style={{color:"#ef4444"}}>DELETE TRADE?</div>
              <div className="modal-date" style={{marginBottom:20}}>This can't be undone.</div>
              <button style={{width:"100%",padding:14,borderRadius:10,border:"none",background:"#ef4444",color:"#fff",fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:".1em",cursor:"pointer",marginBottom:8}}
                onClick={()=>{ deleteTrade(confirmDelete); setConfirmDelete(null); }}>
                YES, DELETE
              </button>
              <button className="modal-close-btn" onClick={()=>setConfirmDelete(null)}>CANCEL</button>
            </div>
          </div>
        )}

        {/* ── EDIT TRADE MODAL ── */}
        {editModal && (
          <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setEditModal(null); }}>
            <div className="modal">
              <div className="modal-handle"/>
              <div className="modal-title">EDIT TRADE</div>
              <div className="modal-date" style={{marginBottom:14}}>Tap to change any field</div>

              {/* Market */}
              <div className="edit-lbl" style={{marginBottom:6}}>Market</div>
              <div className="edit-btn-grid" style={{gridTemplateColumns:"1fr 1fr 1fr 1fr"}}>
                {[{id:"NQ",c:"#00d4ff"},{id:"XAU",c:"#f5c842"},{id:"XAG",c:"#c0c0c0"},{id:"BTC",c:"#f7931a"}].map(({id,c})=>(
                  <button key={id} className={"ebb" + (editModal.market===id?" on-mkt":"")} style={{"--mc":c}} onClick={()=>setEditModal(m=>({...m,market:id}))}>{id}</button>
                ))}
              </div>

              {/* Direction */}
              <div className="edit-lbl" style={{marginBottom:6,marginTop:10}}>Direction</div>
              <div className="edit-btn-grid" style={{gridTemplateColumns:"1fr 1fr"}}>
                <button className={"ebb"+(editModal.direction==="LONG"?" on-dir-long":"")} onClick={()=>setEditModal(m=>({...m,direction:"LONG"}))}>▲ LONG</button>
                <button className={"ebb"+(editModal.direction==="SHORT"?" on-dir-short":"")} onClick={()=>setEditModal(m=>({...m,direction:"SHORT"}))}>▼ SHORT</button>
              </div>

              {/* Result */}
              <div className="edit-lbl" style={{marginBottom:6,marginTop:10}}>Result</div>
              <div className="edit-btn-grid">
                <button className={"ebb"+(editModal.result==="W"?" on-w":"")} onClick={()=>setEditModal(m=>({...m,result:"W"}))}>WIN</button>
                <button className={"ebb"+(editModal.result==="BE"?" on-be":"")} onClick={()=>setEditModal(m=>({...m,result:"BE"}))}>BE</button>
                <button className={"ebb"+(editModal.result==="L"?" on-l":"")} onClick={()=>setEditModal(m=>({...m,result:"L"}))}>LOSS</button>
              </div>

              {/* BE outcome */}
              {editModal.result==="BE" && (
                <>
                  <div className="edit-lbl" style={{marginBottom:6,marginTop:10}}>After BE</div>
                  <div className="edit-btn-grid">
                    <button className={"ebb"+(editModal.beOutcome==="tp"?" on-w":"")} onClick={()=>setEditModal(m=>({...m,beOutcome:m.beOutcome==="tp"?null:"tp"}))}>→ TP</button>
                    <button className={"ebb"+(editModal.beOutcome==="sl"?" on-l":"")} onClick={()=>setEditModal(m=>({...m,beOutcome:m.beOutcome==="sl"?null:"sl"}))}>→ SL</button>
                    <button className={"ebb"+(editModal.beOutcome==="consol"?" on-be":"")} onClick={()=>setEditModal(m=>({...m,beOutcome:m.beOutcome==="consol"?null:"consol"}))}>Consol.</button>
                  </div>
                </>
              )}

              {/* P&L, Units, Date, Time */}
              <div className="edit-modal-grid" style={{marginTop:12}}>
                <div className="edit-field">
                  <div className="edit-lbl">P&L ($)</div>
                  <input className="edit-inp" type="number" inputMode="decimal" placeholder="0.00" value={editModal.pnl} onChange={e=>setEditModal(m=>({...m,pnl:e.target.value}))} />
                </div>
                <div className="edit-field">
                  <div className="edit-lbl">Units</div>
                  <input className="edit-inp" type="number" inputMode="decimal" placeholder="0" value={editModal.units} onChange={e=>setEditModal(m=>({...m,units:e.target.value}))} />
                </div>
                <div className="edit-field">
                  <div className="edit-lbl">Date</div>
                  <input className="edit-inp date-inp" type="date" value={editModal.date} onChange={e=>setEditModal(m=>({...m,date:e.target.value}))} />
                </div>
                <div className="edit-field">
                  <div className="edit-lbl">Time</div>
                  <input className="edit-inp date-inp" type="time" value={editModal.time} onChange={e=>setEditModal(m=>({...m,time:e.target.value}))} />
                </div>
              </div>

              <button className="modal-save-btn" onClick={saveEdit} style={{marginTop:4}}>SAVE CHANGES ✓</button>
              <button className="modal-close-btn" onClick={()=>setEditModal(null)}>CANCEL</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}