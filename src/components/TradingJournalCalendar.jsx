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
  Copy,
  Moon,
  Sun,
  Target,
  Upload,
  Trophy,
  Activity,
  Download,
  LogOut,
  Scale,
  Calendar as CalendarIcon,
  Maximize2,
  X,
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

function formatCompactMoney(value) {
  const n = Number(value || 0);
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : n > 0 ? "+" : "";
  const formatted =
    abs >= 1000
      ? `${(abs / 1000).toFixed(1)}k`
      : Number.isInteger(abs)
        ? String(abs)
        : abs.toFixed(2).replace(/\.00$/, "");
  return `${sign}$${formatted}`;
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
        No equity points yet
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
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [sessionFilter, setSessionFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [inspectTrade, setInspectTrade] = useState(null);
  const [form, setForm] = useState(defaultForm());
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [trades, setTrades] = useState([]);
  const [loadingTrades, setLoadingTrades] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("tz-theme", dark ? "dark" : "light");
  }, [dark]);

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
    return trades.filter((t) => {
      const pnlNum = Number(t.pnl || 0);
      if (outcomeFilter === "win" && pnlNum <= 0) return false;
      if (outcomeFilter === "loss" && pnlNum >= 0) return false;
      if (sessionFilter !== "all" && t.session !== sessionFilter) return false;
      if (!q) return true;
      return [t.pair, t.strategy, t.session, t.direction, t.note, t.grade, t.date]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [trades, search, outcomeFilter, sessionFilter]);

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

  const sessionStats = useMemo(() => {
    const buckets = [
      { key: "asia", label: "Asia" },
      { key: "london", label: "London" },
      { key: "new-york", label: "New York" },
    ];
    return buckets.map((b) => {
      const items = filteredTrades.filter((t) => t.session === b.key);
      const wins = items.filter((t) => Number(t.pnl) > 0).length;
      const pnl = items.reduce((s, t) => s + Number(t.pnl || 0), 0);
      const wr = items.length ? Math.round((wins / items.length) * 100) : 0;
      return { ...b, count: items.length, pnl, wr };
    });
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

  function duplicateTrade(trade) {
    setSaveError("");
    setScreenshotFile(null);
    setForm({
      ...trade,
      id: "",
      pnl: "",
      note: "",
    });
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
      setSaveError("Date, Pair, and PnL ($) are required.");
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
      if (inspectTrade?.id === id) setInspectTrade(null);
    }
  }

  function exportCsv() {
    if (!filteredTrades.length) return;
    const headers = [
      "Date", "Pair", "Direction", "Session", "Entry", "Exit",
      "LotSize", "RiskPercent", "PnL", "Strategy", "Confidence", "Grade", "Note",
    ];
    const rows = filteredTrades.map((t) =>
      [
        t.date, t.pair, t.direction, t.session, t.entry, t.exit,
        t.lotSize, t.riskPercent, t.pnl, t.strategy, t.confidence, t.grade,
        `"${String(t.note || "").replace(/"/g, '""')}"`,
      ].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tradezellah-${toLocalIsoDate()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!authChecked) return null;
  if (!user) return <AuthGate />;

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
  const cardTone = dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white";

  return (
    <div className={cls("min-h-screen w-full transition-colors", dark ? "bg-[#070a12] text-white" : "bg-slate-100 text-slate-900")}>
      <div className="mx-auto max-w-7xl p-3 sm:p-4 md:p-6">
        <div
          className={cls(
            "mb-5 flex flex-col gap-4 rounded-3xl border p-4 shadow-lg md:flex-row md:items-center md:justify-between md:px-6",
            dark ? "border-white/10 bg-[#0d1220]" : "border-slate-200 bg-white"
          )}
        >
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight md:text-2xl">TradeZellah</h1>
            <Badge variant="secondary" className="hidden rounded-full sm:inline-flex">
              {user.email}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              className={cls(
                "flex items-center gap-2 rounded-2xl border px-3 py-1.5",
                dark ? "border-white/10 bg-white/5" : "border-slate-300 bg-slate-50"
              )}
            >
              <Search className="h-4 w-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pair, setup, note..."
                className="h-6 w-36 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0 sm:w-44"
              />
            </div>

            <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
              <SelectTrigger className={cls("h-9 w-28 rounded-2xl text-xs", fieldSurface)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={selectContentSurface}>
                <SelectItem value="all">All Trades</SelectItem>
                <SelectItem value="win">Winners</SelectItem>
                <SelectItem value="loss">Losers</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sessionFilter} onValueChange={setSessionFilter}>
              <SelectTrigger className={cls("h-9 w-32 rounded-2xl text-xs", fieldSurface)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={selectContentSurface}>
                <SelectItem value="all">All Sessions</SelectItem>
                <SelectItem value="asia">Asia</SelectItem>
                <SelectItem value="london">London</SelectItem>
                <SelectItem value="new-york">New York</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={exportCsv} variant="outline" size="sm" className={cls("h-9 rounded-2xl", fieldSurface)}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
            </Button>

            <Button
              onClick={() => setDark((v) => !v)}
              variant="outline"
              size="icon"
              className={cls("h-9 w-9 rounded-2xl", fieldSurface)}
              title="Toggle theme"
            >
              {dark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => openNewTrade()}
                  size="sm"
                  className="h-9 rounded-2xl bg-emerald-500 px-4 font-semibold text-slate-950 hover:bg-emerald-400"
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Add Trade
                </Button>
              </DialogTrigger>

              <DialogContent className={cls("max-h-[90vh] overflow-y-auto rounded-3xl border sm:max-w-3xl", dialogSurface)}>
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold">
                    {form.id ? "Edit Trade" : "New Trade"}
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
                    <Label className={labelTone}>Pair</Label>
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
                        <SelectItem value="buy">Buy</SelectItem>
                        <SelectItem value="sell">Sell</SelectItem>
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
                    <Label className={labelTone}>Entry</Label>
                    <Input
                      type="number"
                      step="any"
                      value={form.entry}
                      onChange={(e) => updateForm("entry", e.target.value)}
                      className={fieldSurface}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className={labelTone}>Exit</Label>
                    <Input
                      type="number"
                      step="any"
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
                      placeholder="1"
                      value={form.riskPercent}
                      onChange={(e) => updateForm("riskPercent", e.target.value)}
                      className={fieldSurface}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className={labelTone}>PnL ($)</Label>
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
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className={labelTone}>Grade</Label>
                    <Select value={form.grade} onValueChange={(v) => updateForm("grade", v)}>
                      <SelectTrigger className={fieldSurface}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={selectContentSurface}>
                        {["A", "B", "C", "D"].map((v) => (
                          <SelectItem key={v} value={v}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label className={labelTone}>Screenshot</Label>
                    <div className="flex items-center gap-3">
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
                        <Upload className="mr-2 h-4 w-4" /> Upload Image
                      </Button>
                      {form.screenshot && <Badge variant="secondary">Attached</Badge>}
                    </div>
                    {form.screenshot && (
                      <img
                        src={form.screenshot}
                        alt="Chart preview"
                        className="mt-2 h-44 w-full rounded-2xl border border-slate-700/40 object-cover"
                      />
                    )}
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label className={labelTone}>Notes</Label>
                    <Textarea
                      rows={3}
                      value={form.note}
                      onChange={(e) => updateForm("note", e.target.value)}
                      placeholder="Setup context, execution, lessons..."
                      className={fieldSurface}
                    />
                  </div>
                </div>

                <div className="mt-5 flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} className={cls("rounded-2xl", fieldSurface)}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={saving}
                    onClick={saveTrade}
                    className="rounded-2xl bg-emerald-500 font-semibold text-slate-950 hover:bg-emerald-400"
                  >
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Button
              onClick={() => supabase.auth.signOut()}
              variant="outline"
              size="icon"
              title="Sign out"
              className={cls("h-9 w-9 rounded-2xl", fieldSurface)}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
              title: "Trades",
              value: loadingTrades ? "…" : stats.total,
              icon: BarChart3,
              tone: "text-violet-500",
            },
            {
              title: "Streak",
              value: `${currentStreak.streak || 0} ${currentStreak.type || ""}`.trim(),
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
            <Card key={item.title} className={cls("rounded-3xl border shadow-sm", cardTone)}>
              <CardContent className="p-4">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className={cls("text-xs", dark ? "text-slate-400" : "text-slate-500")}>{item.title}</span>
                  <item.icon className={cls("h-4 w-4", item.tone)} />
                </div>
                <div className={cls("text-lg font-bold", item.tone)}>{item.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[310px_minmax(0,1fr)]">
          <div className="space-y-5">
            <Card className={cls("rounded-3xl border shadow-sm", cardTone)}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                  {MONTHS[currentMonth.getMonth()]}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div
                  className={cls(
                    "flex items-center justify-between rounded-2xl border p-3.5",
                    monthlyPnl >= 0 ? "border-emerald-500/25 bg-emerald-500/10" : "border-rose-500/25 bg-rose-500/10"
                  )}
                >
                  <div>
                    <div className="text-[11px] text-slate-400">Monthly PnL</div>
                    <div className={cls("text-xl font-bold", monthlyPnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
                      {formatMoney(monthlyPnl)}
                    </div>
                  </div>
                  {monthlyPnl >= 0 ? (
                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-rose-500" />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className={cls("rounded-2xl p-3", dark ? "bg-white/5" : "bg-slate-50")}>
                    <div className="text-slate-400">Avg Win</div>
                    <div className="mt-0.5 font-semibold text-emerald-500">+{formatMoney(stats.avgWin)}</div>
                  </div>
                  <div className={cls("rounded-2xl p-3", dark ? "bg-white/5" : "bg-slate-50")}>
                    <div className="text-slate-400">Avg Loss</div>
                    <div className="mt-0.5 font-semibold text-rose-500">-{formatMoney(stats.avgLoss)}</div>
                  </div>
                  <div className={cls("rounded-2xl p-3", dark ? "bg-white/5" : "bg-slate-50")}>
                    <div className="text-slate-400">W / L</div>
                    <div className="mt-0.5 font-semibold">
                      <span className="text-emerald-500">{stats.wins}</span> /{" "}
                      <span className="text-rose-500">{stats.losses}</span>
                    </div>
                  </div>
                  <div className={cls("rounded-2xl p-3", dark ? "bg-white/5" : "bg-slate-50")}>
                    <div className="text-slate-400">Avg / Trade</div>
                    <div className="mt-0.5 font-semibold">{formatMoney(stats.avg)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={cls("rounded-3xl border shadow-sm", cardTone)}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Sessions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {sessionStats.map((s) => (
                  <div
                    key={s.key}
                    className={cls(
                      "flex items-center justify-between rounded-2xl border px-3 py-2.5 text-xs",
                      dark ? "border-white/10 bg-white/[0.02]" : "border-slate-200 bg-slate-50"
                    )}
                  >
                    <div>
                      <span className="font-semibold">{s.label}</span>
                      <span className="ml-2 text-slate-400">
                        {s.count}t · {s.wr}%
                      </span>
                    </div>
                    <span className={cls("font-bold", s.pnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
                      {s.pnl >= 0 ? "+" : ""}
                      {formatMoney(s.pnl)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className={cls("rounded-3xl border shadow-sm", cardTone)}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Strategies
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {strategyStats.length === 0 ? (
                  <div className="text-xs text-slate-400">—</div>
                ) : (
                  strategyStats.map((s) => {
                    const wr = s.count ? Math.round((s.wins / s.count) * 100) : 0;
                    return (
                      <div
                        key={s.name}
                        className={cls(
                          "flex items-center justify-between rounded-2xl border px-3 py-2.5 text-xs",
                          dark ? "border-white/10 bg-white/[0.02]" : "border-slate-200 bg-slate-50"
                        )}
                      >
                        <div>
                          <div className="font-semibold">{s.name}</div>
                          <div className="text-slate-400">
                            {s.count}t · {wr}% WR
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

          <div className="space-y-5">
            <Card className={cls("rounded-3xl border shadow-sm", cardTone)}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-lg font-bold">
                  {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </CardTitle>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="icon"
                    className={cls("h-8 w-8 rounded-xl", fieldSurface)}
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cls("h-8 rounded-xl text-xs", fieldSurface)}
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
                    className={cls("h-8 w-8 rounded-xl", fieldSurface)}
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="px-2.5 sm:px-6">
                <div className="mb-2 grid grid-cols-7 gap-1 sm:gap-2 text-center text-[10px] sm:text-[11px] font-semibold uppercase text-slate-400">
                  {DAYS.map((day) => (
                    <div key={day} className="truncate py-1">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1 sm:gap-2">
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
                      neutral: dark ? "bg-white/[0.02] border-white/10" : "bg-slate-50 border-slate-200",
                    }[level];

                    return (
                      <motion.button
                        whileHover={{ y: -1 }}
                        key={iso}
                        type="button"
                        onClick={() => setSelectedDate(iso)}
                        className={cls(
                          "min-h-[82px] sm:min-h-[96px] min-w-0 overflow-hidden rounded-xl sm:rounded-2xl border p-1.5 sm:p-2 text-left transition",
                          heatStyle,
                          !inMonth && "opacity-35",
                          isSelected && "ring-2 ring-blue-500",
                          dark ? "hover:bg-white/[0.07]" : "hover:bg-slate-100"
                        )}
                      >
                        <div className="mb-1 flex items-center justify-between gap-1">
                          <span className={cls("text-xs font-bold leading-none", isToday && "text-blue-500")}>
                            {date.getDate()}
                          </span>
                          {dayTrades.length > 0 && (
                            <span className="shrink-0 rounded-full bg-black/15 px-1.5 py-0.5 text-[9px] font-semibold leading-none dark:bg-white/15">
                              {dayTrades.length}
                            </span>
                          )}
                        </div>

                        {dayTrades.length > 0 ? (
                          <div className="space-y-1">
                            <div
                              className={cls(
                                "truncate rounded-md px-1 py-0.5 text-[10px] sm:text-[11px] font-bold leading-tight",
                                dayPnl >= 0
                                  ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                  : "bg-rose-500/20 text-rose-600 dark:text-rose-400"
                              )}
                            >
                              <span className="sm:hidden">{formatCompactMoney(dayPnl)}</span>
                              <span className="hidden sm:inline">
                                {dayPnl >= 0 ? "+" : ""}
                                {formatMoney(dayPnl)}
                              </span>
                            </div>

                            <div className="hidden sm:flex flex-wrap gap-1">
                              {dayTrades.slice(0, 2).map((trade) => (
                                <span
                                  key={trade.id}
                                  className={cls(
                                    "max-w-full truncate rounded px-1 py-0.5 text-[9px] font-semibold",
                                    trade.direction === "buy"
                                      ? "bg-blue-500/15 text-blue-400"
                                      : "bg-amber-500/15 text-amber-500"
                                  )}
                                >
                                  {trade.pair}
                                </span>
                              ))}
                            </div>

                            <div className="truncate text-[9px] font-semibold text-slate-600 dark:text-slate-300 sm:hidden">
                              {dayTrades[0].pair}
                            </div>
                          </div>
                        ) : (
                          <div className="pt-3 text-[10px] text-slate-400">—</div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className={cls("rounded-3xl border shadow-sm", cardTone)}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-blue-500" />
                  <CardTitle className="text-base font-bold">{selectedDate}</CardTitle>
                </div>
                <Button
                  size="sm"
                  onClick={() => openNewTrade(selectedDate)}
                  className="h-8 rounded-xl bg-emerald-500 px-3 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Log Trade
                </Button>
              </CardHeader>

              <CardContent>
                {selectedTrades.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-700/40 py-6 text-center text-xs text-slate-400">
                    No trades on {selectedDate}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {selectedTrades.map((trade) => {
                      const pnlNum = Number(trade.pnl || 0);
                      return (
                        <div
                          key={trade.id}
                          className={cls(
                            "flex flex-col justify-between gap-3 rounded-2xl border p-3.5 md:flex-row md:items-center",
                            dark ? "border-white/10 bg-white/[0.02]" : "border-slate-200 bg-slate-50"
                          )}
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-bold">{trade.pair}</span>
                              <Badge
                                className={cls(
                                  "text-[10px]",
                                  trade.direction === "buy"
                                    ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/20"
                                    : "bg-amber-500/20 text-amber-500 hover:bg-amber-500/20"
                                )}
                              >
                                {trade.direction.toUpperCase()}
                              </Badge>
                              {trade.strategy && <Badge variant="outline" className="text-[10px]">{trade.strategy}</Badge>}
                              <Badge variant="secondary" className="text-[10px] uppercase">{trade.session}</Badge>
                              <Badge variant="outline" className="text-[10px]">{trade.grade}</Badge>
                            </div>

                            <div className="flex flex-wrap gap-3 text-[11px] text-slate-400">
                              {trade.entry !== "" && <span>In: {trade.entry}</span>}
                              {trade.exit !== "" && <span>Out: {trade.exit}</span>}
                              {trade.lotSize !== "" && <span>Lot: {trade.lotSize}</span>}
                              {trade.riskPercent !== "" && <span>Risk: {trade.riskPercent}%</span>}
                              <span>Conf: {trade.confidence}/5</span>
                            </div>

                            {trade.note && (
                              <p className={cls("text-xs", dark ? "text-slate-300" : "text-slate-700")}>{trade.note}</p>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-2 md:justify-end">
                            <div className={cls("text-base font-bold", pnlNum >= 0 ? "text-emerald-500" : "text-rose-500")}>
                              {pnlNum >= 0 ? "+" : ""}
                              {formatMoney(pnlNum)}
                            </div>

                            {trade.screenshot && (
                              <Button
                                size="icon"
                                variant="outline"
                                className={cls("h-8 w-8 rounded-xl", fieldSurface)}
                                title="Inspect screenshot"
                                onClick={() => setInspectTrade(trade)}
                              >
                                <Maximize2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="outline"
                              className={cls("h-8 w-8 rounded-xl", fieldSurface)}
                              title="Duplicate setup"
                              onClick={() => duplicateTrade(trade)}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className={cls("h-8 w-8 rounded-xl", fieldSurface)}
                              title="Edit"
                              onClick={() => editTrade(trade)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className={cls("h-8 w-8 rounded-xl text-rose-500", fieldSurface)}
                              title="Delete"
                              onClick={() => deleteTrade(trade.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className={cls("rounded-3xl border shadow-sm", cardTone)}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-bold">Equity</CardTitle>
                <Badge variant="secondary">{equitySeries.length}</Badge>
              </CardHeader>
              <CardContent>
                <div className={cls("mb-2 text-xl font-bold", stats.pnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
                  {formatMoney(stats.pnl)}
                </div>
                <Sparkline points={equitySeries} positive={stats.pnl >= 0} dark={dark} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={Boolean(inspectTrade)} onOpenChange={(v) => !v && setInspectTrade(null)}>
        <DialogContent className={cls("rounded-3xl border sm:max-w-3xl", dialogSurface)}>
          {inspectTrade && (
            <>
              <DialogHeader className="flex flex-row items-center justify-between">
                <DialogTitle className="text-lg font-bold">
                  {inspectTrade.pair} · {inspectTrade.date}
                </DialogTitle>
                <Button size="icon" variant="ghost" onClick={() => setInspectTrade(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </DialogHeader>
              {inspectTrade.screenshot && (
                <img
                  src={inspectTrade.screenshot}
                  alt={inspectTrade.pair}
                  className="max-h-[65vh] w-full rounded-2xl object-contain"
                />
              )}
              {inspectTrade.note && <p className="text-sm text-slate-300">{inspectTrade.note}</p>}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}