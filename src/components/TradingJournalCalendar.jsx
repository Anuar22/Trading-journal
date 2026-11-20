import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Search,
  Trash2,
  Pencil,
  Moon,
  Sun,
  Target,
  Upload,
  Flame,
  Trophy,
  Activity,
  Download,
  LogOut,
  Scale,
  Calendar as CalendarIcon,
  Image as ImageIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import AuthGate from "@/components/AuthGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const STRATEGIES = [
  "London breakout",
  "NY reversal",
  "Liquidity sweep",
  "Trend continuation",
  "Scalp",
  "Range fade",
  "CRT / Engulfing",
];

function toLocalIsoDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseLocalDate(isoDate) {
  if (!isoDate) return new Date();
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

const defaultForm = (date = toLocalIsoDate()) => ({
  id: "",
  date,
  pair: "",
  direction: "buy",
  entry: "",
  exit: "",
  lotSize: "",
  riskPercent: "",
  pnl: "",
  strategy: "",
  session: "london",
  confidence: "3",
  grade: "A",
  screenshot: "",
  note: "",
});

function formatMoney(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function getMonthGrid(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();
  const cells = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, prevMonthDays - i), currentMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: new Date(year, month, day), currentMonth: true });
  }
  while (cells.length < 42) {
    const nextDay = cells.length - (firstDay + daysInMonth) + 1;
    cells.push({ date: new Date(year, month + 1, nextDay), currentMonth: false });
  }
  return cells;
}

function getHeatLevel(dayPnl) {
  if (dayPnl >= 300) return "strong-green";
  if (dayPnl > 0) return "green";
  if (dayPnl <= -300) return "strong-red";
  if (dayPnl < 0) return "red";
  return "neutral";
}

function getCurrentStreak(trades) {
  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));
  const daily = new Map();
  for (const t of sorted) {
    daily.set(t.date, (daily.get(t.date) || 0) + Number(t.pnl || 0));
  }
  const days = [...daily.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  let streak = 0;
  let type = null;
  for (let i = days.length - 1; i >= 0; i--) {
    const pnl = days[i][1];
    const currentType = pnl >= 0 ? "win" : "loss";
    if (!type) type = currentType;
    if (currentType === type) streak += 1;
    else break;
  }
  return { streak, type };
}

function mapRowToTrade(row) {
  return {
    id: row.id,
    date: row.trade_date,
    pair: row.pair,
    direction: row.direction,
    entry: row.entry_price ?? "",
    exit: row.exit_price ?? "",
    lotSize: row.lot_size ?? "",
    riskPercent: row.risk_percent ?? "",
    pnl: row.pnl ?? "",
    strategy: row.strategy ?? "",
    session: row.session ?? "london",
    confidence: String(row.confidence ?? "3"),
    grade: row.grade ?? "A",
    screenshot: row.screenshot_url ?? "",
    note: row.note ?? "",
  };
}

function Sparkline({ points, positive = true, dark = true }) {
  if (!points.length) {
    return (
      <div
        className={cls(
          "flex h-28 w-full items-center justify-center rounded-2xl border border-dashed text-xs",
          dark ? "border-white/10 text-slate-500" : "border-slate-300 text-slate-400"
        )}
      >
        Log trades to plot your equity curve
      </div>
    );
  }
  const width = 520;
  const height = 110;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const path = points
    .map((p, i) => {
      const x = (i / Math.max(points.length - 1, 1)) * (width - 16) + 8;
      const y = height - ((p - min) / range) * (height - 16) - 8;
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-28 w-full overflow-visible">
      <path
        d={path}
        fill="none"
        stroke={positive ? "#22c55e" : "#f43f5e"}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function TradingJournalCalendar() {
  const fileInputRef = useRef(null);
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("tz-theme");
    return saved ? saved === "dark" : true;
  });

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(toLocalIsoDate());
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(defaultForm());
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [trades, setTrades] = useState([]);
  const [loadingTrades, setLoadingTrades] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Sync dark mode class to <html> so Dialog & Select portals inherit theme properly
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("tz-theme", dark ? "dark" : "light");
  }, [dark]);

  // Listen for Supabase Auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthChecked(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthChecked(true);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Load trades from Supabase
  useEffect(() => {
    if (!user) {
      setTrades([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingTrades(true);
      const { data, error } = await supabase
        .from("trades")
        .select("*")
        .order("trade_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (!cancelled && !error && data) {
        setTrades(data.map(mapRowToTrade));
      }
      if (!cancelled) setLoadingTrades(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const filteredTrades = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return trades;
    return trades.filter((t) =>
      [t.pair, t.strategy, t.session, t.direction, t.note, t.grade, t.date]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [trades, search]);

  const stats = useMemo(() => {
    const total = filteredTrades.length;
    const winningTrades = filteredTrades.filter((t) => Number(t.pnl) > 0);
    const losingTrades = filteredTrades.filter((t) => Number(t.pnl) < 0);
    const grossProfit = winningTrades.reduce((s, t) => s + Number(t.pnl || 0), 0);
    const grossLoss = Math.abs(losingTrades.reduce((s, t) => s + Number(t.pnl || 0), 0));
    const pnl = grossProfit - grossLoss;
    const avg = total ? pnl / total : 0;
    const avgWin = winningTrades.length ? grossProfit / winningTrades.length : 0;
    const avgLoss = losingTrades.length ? grossLoss / losingTrades.length : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
    const winRate = total ? (winningTrades.length / total) * 100 : 0;

    return {
      total,
      wins: winningTrades.length,
      losses: losingTrades.length,
      pnl,
      avg,
      avgWin,
      avgLoss,
      profitFactor,
      winRate,
    };
  }, [filteredTrades]);

  const byDate = useMemo(() => {
    const map = {};
    for (const trade of filteredTrades) {
      map[trade.date] ??= [];
      map[trade.date].push(trade);
    }
    return map;
  }, [filteredTrades]);

  const selectedTrades = useMemo(() => {
    return (byDate[selectedDate] || []).sort((a, b) => Number(b.pnl) - Number(a.pnl));
  }, [byDate, selectedDate]);

  const monthCells = useMemo(() => getMonthGrid(currentMonth), [currentMonth]);

  const monthlyTrades = useMemo(() => {
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    return filteredTrades.filter((t) => {
      const d = parseLocalDate(t.date);
      return d.getFullYear() === y && d.getMonth() === m;
    });
  }, [filteredTrades, currentMonth]);

  const monthlyPnl = monthlyTrades.reduce((sum, t) => sum + Number(t.pnl || 0), 0);

  const equitySeries = useMemo(() => {
    const sorted = [...filteredTrades].sort((a, b) => a.date.localeCompare(b.date));
    let running = 0;
    return sorted.map((trade) => {
      running += Number(trade.pnl || 0);
      return running;
    });
  }, [filteredTrades]);

  const strategyStats = useMemo(() => {
    const map = new Map();
    for (const t of filteredTrades) {
      const key = t.strategy || "Uncategorized";
      if (!map.has(key)) map.set(key, { name: key, count: 0, pnl: 0, wins: 0 });
      const item = map.get(key);
      item.count += 1;
      item.pnl += Number(t.pnl || 0);
      if (Number(t.pnl) > 0) item.wins += 1;
    }
    return [...map.values()].sort((a, b) => b.pnl - a.pnl);
  }, [filteredTrades]);

  const currentStreak = useMemo(() => getCurrentStreak(filteredTrades), [filteredTrades]);

  const bestDay = useMemo(() => {
    const entries = Object.entries(byDate).map(([date, dayTrades]) => ({
      date,
      pnl: dayTrades.reduce((sum, t) => sum + Number(t.pnl || 0), 0),
    }));
    return entries.sort((a, b) => b.pnl - a.pnl)[0];
  }, [byDate]);

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function openNewTrade(date = selectedDate) {
    setSaveError("");
    setScreenshotFile(null);
    setForm(defaultForm(date));
    setOpen(true);
  }

  function editTrade(trade) {
    setSaveError("");
    setScreenshotFile(null);
    setForm(trade);
    setOpen(true);
  }

  function handleScreenshotUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setScreenshotFile(file);
    updateForm("screenshot", URL.createObjectURL(file));
  }

  async function saveTrade() {
    if (!user || saving) return;
    if (!form.date || !form.pair.trim() || form.pnl === "") {
      setSaveError("Please fill in Date, Pair/Symbol, and Profit/Loss ($).");
      return;
    }

    setSaving(true);
    setSaveError("");

    try {
      let screenshotUrl = form.screenshot?.startsWith("http") ? form.screenshot : null;

      if (screenshotFile) {
        const ext = screenshotFile.name.split(".").pop() || "png";
        const filePath = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("trade-screenshots")
          .upload(filePath, screenshotFile, { upsert: false });

        if (uploadError) throw uploadError;

        const { data: pub } = supabase.storage
          .from("trade-screenshots")
          .getPublicUrl(filePath);
        screenshotUrl = pub.publicUrl;
      }

      const rowPayload = {
        user_id: user.id,
        trade_date: form.date,
        pair: form.pair.trim().toUpperCase(),
        direction: form.direction,
        entry_price: form.entry === "" ? null : Number(form.entry),
        exit_price: form.exit === "" ? null : Number(form.exit),
        lot_size: form.lotSize === "" ? null : Number(form.lotSize),
        risk_percent: form.riskPercent === "" ? null : Number(form.riskPercent),
        pnl: Number(form.pnl),
        strategy: form.strategy || null,
        session: form.session || "london",
        confidence: Number(form.confidence || 3),
        grade: form.grade || "A",
        screenshot_url: screenshotUrl,
        note: form.note || "",
      };

      if (form.id) {
        const { data, error } = await supabase
          .from("trades")
          .update(rowPayload)
          .eq("id", form.id)
          .select()
          .single();
        if (error) throw error;
        const updated = mapRowToTrade(data);
        setTrades((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        setSelectedDate(updated.date);
      } else {
        const { data, error } = await supabase
          .from("trades")
          .insert([rowPayload])
          .select()
          .single();
        if (error) throw error;
        const created = mapRowToTrade(data);
        setTrades((prev) => [created, ...prev]);
        setSelectedDate(created.date);
      }

      setScreenshotFile(null);
      setOpen(false);
      setForm(defaultForm(form.date));
    } catch (err) {
      setSaveError(err.message || "Could not save trade.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTrade(id) {
    if (!user) return;
    const { error } = await supabase.from("trades").delete().eq("id", id);
    if (!error) {
      setTrades((prev) => prev.filter((t) => t.id !== id));
    }
  }

  function exportCsv() {
    if (!filteredTrades.length) return;
    const headers = [
      "Date",
      "Pair",
      "Direction",
      "Session",
      "Entry",
      "Exit",
      "LotSize",
      "RiskPercent",
      "PnL",
      "Strategy",
      "Confidence",
      "Grade",
      "Note",
    ];
    const rows = filteredTrades.map((t) =>
      [
        t.date,
        t.pair,
        t.direction,
        t.session,
        t.entry,
        t.exit,
        t.lotSize,
        t.riskPercent,
        t.pnl,
        t.strategy,
        t.confidence,
        t.grade,
        `"${String(t.note || "").replace(/"/g, '""')}"`,
      ].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tradezellah-export-${toLocalIsoDate()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!authChecked) return null;
  if (!user) return <AuthGate />;

  // Explicit theme classes so modal & dropdowns are always high-contrast
  const dialogSurface = dark
    ? "border-slate-800 bg-[#0d1220] text-slate-100"
    : "border-slate-200 bg-white text-slate-900";
  const fieldSurface = dark
    ? "border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500"
    : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400";
  const selectContentSurface = dark
    ? "border-slate-700 bg-slate-900 text-slate-100"
    : "border-slate-200 bg-white text-slate-900";
  const labelTone = dark ? "text-slate-200" : "text-slate-700";

  return (
    <div
      className={cls(
        "min-h-screen w-full transition-colors",
        dark ? "bg-[#070a12] text-white" : "bg-slate-100 text-slate-900"
      )}
    >
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        {/* Header Banner */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={cls(
            "mb-6 overflow-hidden rounded-[28px] border p-6 shadow-2xl",
            dark
              ? "border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.18),transparent_25%),radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_25%),linear-gradient(135deg,#0d1220,#121a31,#18152f)]"
              : "border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100"
          )}
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div
                className={cls(
                  "mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium tracking-wide",
                  dark
                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                    : "border-emerald-600/20 bg-emerald-50 text-emerald-700"
                )}
              >
                <Flame className="h-4 w-4" />
                Cloud-Synced Trading Journal
              </div>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                Trade review with a funded-dashboard feel.
              </h1>
              <p className={cls("mt-2 max-w-2xl text-sm md:text-base", dark ? "text-slate-300" : "text-slate-600")}>
                Log every setup, track your equity, review strategy edge, and build a visual heatmap of your discipline.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div
                className={cls(
                  "flex items-center gap-2 rounded-2xl border px-3 py-1.5",
                  dark ? "border-white/10 bg-white/5" : "border-slate-300 bg-white"
                )}
              >
                <Search className="h-4 w-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search pair, strategy, note..."
                  className="h-7 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
                />
              </div>

              <Button
                onClick={exportCsv}
                variant="outline"
                className={cls(
                  "rounded-2xl",
                  dark ? "border-white/15 bg-white/5 text-white hover:bg-white/10" : "border-slate-300 bg-white text-slate-900"
                )}
                title="Export filtered trades to CSV"
              >
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>

              <Button
                onClick={() => setDark((v) => !v)}
                variant="outline"
                className={cls(
                  "rounded-2xl",
                  dark ? "border-white/15 bg-white/5 text-white hover:bg-white/10" : "border-slate-300 bg-white text-slate-900"
                )}
              >
                {dark ? <Sun className="mr-2 h-4 w-4 text-amber-400" /> : <Moon className="mr-2 h-4 w-4 text-slate-700" />}
                {dark ? "Light" : "Dark"}
              </Button>

              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button
                    onClick={() => openNewTrade()}
                    className="rounded-2xl bg-emerald-500 px-5 font-semibold text-slate-950 hover:bg-emerald-400"
                  >
                    <Plus className="mr-2 h-4 w-4" /> Add Trade
                  </Button>
                </DialogTrigger>

                <DialogContent className={cls("max-h-[90vh] overflow-y-auto rounded-3xl border sm:max-w-3xl", dialogSurface)}>
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold">
                      {form.id ? "Edit Trade Entry" : "Log New Trade"}
                    </DialogTitle>
                  </DialogHeader>

                  {saveError && (
                    <div className="rounded-xl border border-rose-500/40 bg-rose-500/15 p-3 text-xs text-rose-400">
                      {saveError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className={labelTone}>Date</Label>
                      <Input
                        type="date"
                        value={form.date}
                        onChange={(e) => updateForm("date", e.target.value)}
                        className={fieldSurface}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={labelTone}>Pair / Symbol</Label>
                      <Input
                        placeholder="XAUUSD"
                        value={form.pair}
                        onChange={(e) => updateForm("pair", e.target.value)}
                        className={fieldSurface}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={labelTone}>Direction</Label>
                      <Select value={form.direction} onValueChange={(v) => updateForm("direction", v)}>
                        <SelectTrigger className={fieldSurface}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className={selectContentSurface}>
                          <SelectItem value="buy">Buy (Long)</SelectItem>
                          <SelectItem value="sell">Sell (Short)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className={labelTone}>Session</Label>
                      <Select value={form.session} onValueChange={(v) => updateForm("session", v)}>
                        <SelectTrigger className={fieldSurface}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className={selectContentSurface}>
                          <SelectItem value="asia">Asia</SelectItem>
                          <SelectItem value="london">London</SelectItem>
                          <SelectItem value="new-york">New York</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className={labelTone}>Entry Price</Label>
                      <Input
                        type="number"
                        step="any"
                        placeholder="2335.40"
                        value={form.entry}
                        onChange={(e) => updateForm("entry", e.target.value)}
                        className={fieldSurface}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={labelTone}>Exit Price</Label>
                      <Input
                        type="number"
                        step="any"
                        placeholder="2342.10"
                        value={form.exit}
                        onChange={(e) => updateForm("exit", e.target.value)}
                        className={fieldSurface}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={labelTone}>Lot Size</Label>
                      <Input
                        type="number"
                        step="any"
                        placeholder="0.50"
                        value={form.lotSize}
                        onChange={(e) => updateForm("lotSize", e.target.value)}
                        className={fieldSurface}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={labelTone}>Risk %</Label>
                      <Input
                        type="number"
                        step="any"
                        placeholder="1.0"
                        value={form.riskPercent}
                        onChange={(e) => updateForm("riskPercent", e.target.value)}
                        className={fieldSurface}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={labelTone}>Profit / Loss ($)</Label>
                      <Input
                        type="number"
                        step="any"
                        value={form.pnl}
                        onChange={(e) => updateForm("pnl", e.target.value)}
                        placeholder="120.50 or -45"
                        className={fieldSurface}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={labelTone}>Strategy</Label>
                      <Select value={form.strategy || undefined} onValueChange={(v) => updateForm("strategy", v)}>
                        <SelectTrigger className={fieldSurface}>
                          <SelectValue placeholder="Select strategy" />
                        </SelectTrigger>
                        <SelectContent className={selectContentSurface}>
                          {STRATEGIES.map((strategy) => (
                            <SelectItem key={strategy} value={strategy}>
                              {strategy}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className={labelTone}>Confidence (1–5)</Label>
                      <Select value={form.confidence} onValueChange={(v) => updateForm("confidence", v)}>
                        <SelectTrigger className={fieldSurface}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className={selectContentSurface}>
                          {["1", "2", "3", "4", "5"].map((v) => (
                            <SelectItem key={v} value={v}>
                              {v} / 5
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className={labelTone}>Trade Grade</Label>
                      <Select value={form.grade} onValueChange={(v) => updateForm("grade", v)}>
                        <SelectTrigger className={fieldSurface}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className={selectContentSurface}>
                          {["A", "B", "C", "D"].map((v) => (
                            <SelectItem key={v} value={v}>
                              Grade {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label className={labelTone}>Chart Screenshot</Label>
                      <div className="mt-1 flex flex-wrap items-center gap-3">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleScreenshotUpload}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className={cls("rounded-2xl", fieldSurface)}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="mr-2 h-4 w-4" /> Upload Screenshot
                        </Button>
                        {form.screenshot && <Badge variant="secondary">Chart image ready</Badge>}
                      </div>
                      {form.screenshot && (
                        <div className="mt-3 overflow-hidden rounded-2xl border border-slate-700/50">
                          <img src={form.screenshot} alt="Trade screenshot" className="h-48 w-full object-cover" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label className={labelTone}>Execution &amp; Psychology Notes</Label>
                      <Textarea
                        rows={4}
                        value={form.note}
                        onChange={(e) => updateForm("note", e.target.value)}
                        placeholder="HTF bias, liquidity sweep, entry trigger, and what to improve next time..."
                        className={fieldSurface}
                      />
                    </div>
                  </div>

                  <div className="mt-5 flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setOpen(false)}
                      className={cls("rounded-2xl", fieldSurface)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      disabled={saving}
                      onClick={saveTrade}
                      className="rounded-2xl bg-emerald-500 font-semibold text-slate-950 hover:bg-emerald-400"
                    >
                      {saving ? "Saving..." : form.id ? "Update Trade" : "Save Trade"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Button
                onClick={() => supabase.auth.signOut()}
                variant="outline"
                size="icon"
                title={`Sign out (${user.email})`}
                className={cls(
                  "rounded-2xl",
                  dark ? "border-white/15 bg-white/5 text-slate-300 hover:bg-white/10" : "border-slate-300 bg-white text-slate-700"
                )}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Top KPI Cards (6 metrics including Profit Factor) */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            {
              title: "Net PnL",
              value: formatMoney(stats.pnl),
              icon: DollarSign,
              tone: stats.pnl >= 0 ? "text-emerald-500" : "text-rose-500",
            },
            {
              title: "Win Rate",
              value: `${stats.winRate.toFixed(0)}%`,
              icon: Target,
              tone: "text-blue-500",
            },
            {
              title: "Profit Factor",
              value: stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2),
              icon: Scale,
              tone: stats.profitFactor >= 1.5 ? "text-emerald-500" : "text-amber-500",
            },
            {
              title: "Total Trades",
              value: loadingTrades ? "..." : stats.total,
              icon: BarChart3,
              tone: "text-violet-500",
            },
            {
              title: "Day Streak",
              value: `${currentStreak.streak || 0} ${currentStreak.type || "days"}`,
              icon: Trophy,
              tone: currentStreak.type === "win" ? "text-emerald-500" : "text-rose-500",
            },
            {
              title: "Best Day",
              value: bestDay ? formatMoney(bestDay.pnl) : "$0.00",
              icon: Activity,
              tone: "text-amber-500",
            },
          ].map((item) => (
            <Card
              key={item.title}
              className={cls(
                "rounded-3xl border shadow-lg",
                dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"
              )}
            >
              <CardContent className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className={cls("text-xs font-medium", dark ? "text-slate-400" : "text-slate-500")}>
                    {item.title}
                  </span>
                  <item.icon className={cls("h-4 w-4", item.tone)} />
                </div>
                <div className={cls("text-xl font-bold", item.tone)}>{item.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Workspace */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          {/* Left Sidebar */}
          <div className="space-y-6">
            <Card className={cls("rounded-3xl border shadow-lg", dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white")}>
              <CardHeader>
                <CardTitle className="text-base">This Month Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  className={cls(
                    "flex items-center justify-between rounded-2xl border p-4",
                    monthlyPnl >= 0
                      ? "border-emerald-500/25 bg-emerald-500/10"
                      : "border-rose-500/25 bg-rose-500/10"
                  )}
                >
                  <div>
                    <div className={cls("text-xs", dark ? "text-slate-400" : "text-slate-500")}>Monthly PnL</div>
                    <div className={cls("text-2xl font-bold", monthlyPnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
                      {formatMoney(monthlyPnl)}
                    </div>
                  </div>
                  {monthlyPnl >= 0 ? (
                    <TrendingUp className="h-6 w-6 text-emerald-500" />
                  ) : (
                    <TrendingDown className="h-6 w-6 text-rose-500" />
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2.5 text-center">
                  <div className={cls("rounded-2xl p-3", dark ? "bg-white/5" : "bg-slate-50")}>
                    <div className="text-xs text-slate-400">Wins</div>
                    <div className="mt-1 text-lg font-semibold text-emerald-500">{stats.wins}</div>
                  </div>
                  <div className={cls("rounded-2xl p-3", dark ? "bg-white/5" : "bg-slate-50")}>
                    <div className="text-xs text-slate-400">Losses</div>
                    <div className="mt-1 text-lg font-semibold text-rose-500">{stats.losses}</div>
                  </div>
                  <div className={cls("rounded-2xl p-3", dark ? "bg-white/5" : "bg-slate-50")}>
                    <div className="text-xs text-slate-400">Expectancy</div>
                    <div className="mt-1 text-lg font-semibold">{formatMoney(stats.avg)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-center">
                  <div className={cls("rounded-2xl p-3", dark ? "bg-white/5" : "bg-slate-50")}>
                    <div className="text-xs text-slate-400">Avg Win</div>
                    <div className="mt-1 text-sm font-semibold text-emerald-500">+{formatMoney(stats.avgWin)}</div>
                  </div>
                  <div className={cls("rounded-2xl p-3", dark ? "bg-white/5" : "bg-slate-50")}>
                    <div className="text-xs text-slate-400">Avg Loss</div>
                    <div className="mt-1 text-sm font-semibold text-rose-500">-{formatMoney(stats.avgLoss)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={cls("rounded-3xl border shadow-lg", dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white")}>
              <CardHeader>
                <CardTitle className="text-base">Calendar Heatmap</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["bg-emerald-500/15 border-emerald-500/30", "Green day"],
                    ["bg-emerald-500/30 border-emerald-500/40", "Strong green"],
                    ["bg-rose-500/15 border-rose-500/30", "Red day"],
                    ["bg-rose-500/30 border-rose-500/40", "Strong red"],
                  ].map(([style, label]) => (
                    <div
                      key={label}
                      className={cls(
                        "flex items-center gap-2 rounded-2xl border p-2",
                        dark ? "border-white/10" : "border-slate-200"
                      )}
                    >
                      <div className={cls("h-4 w-4 rounded-md border", style)} />
                      <span className={cls("text-xs", dark ? "text-slate-300" : "text-slate-600")}>{label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className={cls("rounded-3xl border shadow-lg", dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white")}>
              <CardHeader>
                <CardTitle className="text-base">Strategy Edge</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {strategyStats.length === 0 ? (
                  <p className="text-xs text-slate-400">No strategy data yet.</p>
                ) : (
                  strategyStats.map((s) => {
                    const wr = s.count ? Math.round((s.wins / s.count) * 100) : 0;
                    return (
                      <div
                        key={s.name}
                        className={cls(
                          "flex items-center justify-between rounded-2xl border p-3 text-xs",
                          dark ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-slate-50"
                        )}
                      >
                        <div>
                          <div className="font-semibold">{s.name}</div>
                          <div className="text-slate-400">
                            {s.count} trades · {wr}% WR
                          </div>
                        </div>
                        <div className={cls("font-bold", s.pnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
                          {s.pnl >= 0 ? "+" : ""}
                          {formatMoney(s.pnl)}
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Main Area: Calendar + Selected Day Log + Equity Curve */}
          <div className="space-y-6">
            <Card className={cls("rounded-3xl border shadow-lg", dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white")}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-bold">
                  {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-2xl"
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-2xl"
                    onClick={() => {
                      const now = new Date();
                      setCurrentMonth(now);
                      setSelectedDate(toLocalIsoDate(now));
                    }}
                  >
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-2xl"
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent>
                <div className="mb-3 grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-400">
                  {DAYS.map((day) => (
                    <div key={day} className="py-2">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {monthCells.map(({ date, currentMonth: inMonth }) => {
                    const iso = toLocalIsoDate(date);
                    const dayTrades = byDate[iso] || [];
                    const dayPnl = dayTrades.reduce((sum, t) => sum + Number(t.pnl || 0), 0);
                    const isSelected = selectedDate === iso;
                    const isToday = iso === toLocalIsoDate();
                    const level = getHeatLevel(dayPnl);
                    const heatStyle = {
                      "strong-green": "bg-emerald-500/30 border-emerald-500/40",
                      green: "bg-emerald-500/15 border-emerald-500/30",
                      "strong-red": "bg-rose-500/30 border-rose-500/40",
                      red: "bg-rose-500/15 border-rose-500/30",
                      neutral: dark ? "bg-white/[0.03] border-white/10" : "bg-slate-50 border-slate-200",
                    }[level];

                    return (
                      <motion.button
                        whileHover={{ y: -2 }}
                        key={iso}
                        onClick={() => setSelectedDate(iso)}
                        className={cls(
                          "min-h-[104px] rounded-2xl border p-2.5 text-left transition",
                          heatStyle,
                          !inMonth && "opacity-40",
                          isSelected && "ring-2 ring-blue-500",
                          dark ? "hover:bg-white/[0.08]" : "hover:bg-slate-100"
                        )}
                      >
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className={cls("text-sm font-semibold", isToday && "text-blue-500")}>
                            {date.getDate()}
                          </span>
                          {dayTrades.length > 0 && (
                            <Badge variant="secondary" className="rounded-full text-[10px]">
                              {dayTrades.length}
                            </Badge>
                          )}
                        </div>
                        {dayTrades.length > 0 ? (
                          <div className="space-y-1.5">
                            <div
                              className={cls(
                                "rounded-xl px-2 py-0.5 text-xs font-semibold",
                                dayPnl >= 0
                                  ? dark
                                    ? "bg-emerald-500/20 text-emerald-300"
                                    : "bg-emerald-500/20 text-emerald-800"
                                  : dark
                                    ? "bg-rose-500/20 text-rose-300"
                                    : "bg-rose-500/20 text-rose-800"
                              )}
                            >
                              {dayPnl >= 0 ? "+" : ""}
                              {formatMoney(dayPnl)}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {dayTrades.slice(0, 2).map((trade) => (
                                <span
                                  key={trade.id}
                                  className={cls(
                                    "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                                    trade.direction === "buy"
                                      ? "bg-blue-500/15 text-blue-400"
                                      : "bg-amber-500/15 text-amber-500"
                                  )}
                                >
                                  {trade.pair}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="pt-3 text-[11px] text-slate-400">—</div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Selected Day Trade Breakdown */}
            <Card className={cls("rounded-3xl border shadow-lg", dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white")}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-blue-500" />
                  <CardTitle className="text-lg">Trades on {selectedDate}</CardTitle>
                </div>
                <Button
                  size="sm"
                  onClick={() => openNewTrade(selectedDate)}
                  className="rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Add on this day
                </Button>
              </CardHeader>
              <CardContent>
                {selectedTrades.length === 0 ? (
                  <div
                    className={cls(
                      "rounded-2xl border border-dashed p-6 text-center text-sm",
                      dark ? "border-white/10 text-slate-400" : "border-slate-300 text-slate-500"
                    )}
                  >
                    No trades logged for {selectedDate}. Click &ldquo;Add on this day&rdquo; to record one.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedTrades.map((trade) => {
                      const pnlNum = Number(trade.pnl || 0);
                      return (
                        <div
                          key={trade.id}
                          className={cls(
                            "flex flex-col justify-between gap-4 rounded-2xl border p-4 md:flex-row md:items-center",
                            dark ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-slate-50"
                          )}
                        >
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-base font-bold">{trade.pair}</span>
                              <Badge
                                className={cls(
                                  trade.direction === "buy"
                                    ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/20"
                                    : "bg-amber-500/20 text-amber-500 hover:bg-amber-500/20"
                                )}
                              >
                                {trade.direction.toUpperCase()}
                              </Badge>
                              {trade.strategy && <Badge variant="outline">{trade.strategy}</Badge>}
                              <Badge variant="secondary" className="uppercase">
                                {trade.session}
                              </Badge>
                              <Badge variant="outline">Grade {trade.grade}</Badge>
                            </div>

                            <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                              {trade.entry !== "" && <span>Entry: {trade.entry}</span>}
                              {trade.exit !== "" && <span>Exit: {trade.exit}</span>}
                              {trade.lotSize !== "" && <span>Lots: {trade.lotSize}</span>}
                              {trade.riskPercent !== "" && <span>Risk: {trade.riskPercent}%</span>}
                              <span>Confidence: {trade.confidence}/5</span>
                            </div>

                            {trade.note && (
                              <p className={cls("text-sm", dark ? "text-slate-300" : "text-slate-700")}>
                                {trade.note}
                              </p>
                            )}

                            {trade.screenshot && (
                              <a
                                href={trade.screenshot}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:underline"
                              >
                                <ImageIcon className="h-3.5 w-3.5" /> View chart screenshot
                              </a>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-3 md:justify-end">
                            <div
                              className={cls(
                                "text-lg font-bold",
                                pnlNum >= 0 ? "text-emerald-500" : "text-rose-500"
                              )}
                            >
                              {pnlNum >= 0 ? "+" : ""}
                              {formatMoney(pnlNum)}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8 rounded-xl"
                                onClick={() => editTrade(trade)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8 rounded-xl text-rose-500 hover:text-rose-400"
                                onClick={() => deleteTrade(trade.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Equity Curve */}
            <Card className={cls("rounded-3xl border shadow-lg", dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white")}>
              <CardHeader>
                <CardTitle className="text-lg">Equity Curve</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex items-end justify-between">
                  <div>
                    <div className="text-xs text-slate-400">Cumulative Running Equity</div>
                    <div className={cls("text-2xl font-bold", stats.pnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
                      {formatMoney(stats.pnl)}
                    </div>
                  </div>
                  <Badge variant="secondary">{equitySeries.length} trades</Badge>
                </div>
                <Sparkline points={equitySeries} positive={stats.pnl >= 0} dark={dark} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}