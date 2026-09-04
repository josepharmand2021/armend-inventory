import './style.css'
import { supabase, configOk } from './supabaseClient.js'

const root = document.getElementById('app')

/* ARMEND mark — geometric "A": upward peak, split lime / ink. Non-lime half uses currentColor. */
const BRAND_MARK = '<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M50 15 L87 85 L54 85 L50 61 Z" fill="currentColor"/><path d="M50 15 L13 85 L46 85 L50 61 Z" fill="#B9D78B"/></svg>'

/* ============================== CONFIG-MISSING GUARD ============================== */
if (!configOk) {
  root.innerHTML = `
    <div class="login-shell"><div class="login-card">
      <div class="login-brand"><div class="brand-mark">${BRAND_MARK}</div><div><h2 style="margin:0">ARMEND</h2></div></div>
      <div class="login-error">Konfigurasi Supabase belum diisi. Salin <code>.env.example</code> ke <code>.env.local</code>,
      isi <code>VITE_SUPABASE_URL</code> dan <code>VITE_SUPABASE_ANON_KEY</code> dari project Supabase kamu (lihat SETUP.md), lalu jalankan ulang.</div>
    </div></div>`
  throw new Error('Supabase env vars missing')
}

/* ============================== CONSTANTS ============================== */
// preferred ordering for known categories; anything else is appended alphabetically
const ITEM_CAT_SEED = ["BEVERAGE","BUAH-BUAHAN & SAYURAN","GROCERIES","DAIRY PRODUCT","SYRUP PRODUCT","TEA PRODUCT","PACKAGING","OTHERS","PREP"]
const MENU_CAT_SEED = ["Tea","Artisan Tea","Juices","Mocktails","Classic Coffee","Signature Coffee","Cold Brew","Non-Coffee"]
function orderedCats(present, seed) {
  const set = new Set(present.filter(Boolean))
  return [...seed.filter(c => set.has(c)), ...[...set].filter(c => !seed.includes(c)).sort((a, b) => a.localeCompare(b))]
}
function itemCats() { return orderedCats(Object.values(itemsById).map(i => i.category), ITEM_CAT_SEED) }
function menuCats() { return orderedCats(Object.values(menusById).map(m => m.category), MENU_CAT_SEED) }
function itemCatIdx(c) { const i = itemCats().indexOf(c); return i < 0 ? 999 : i }
function menuCatIdx(c) { const i = menuCats().indexOf(c); return i < 0 ? 999 : i }
const WASTE_REASONS = ["Tumpah", "Rusak / Pecah", "Kadaluarsa", "Test Food / R&D", "Staff / Internal", "Komplain / Ganti", "Lain-lain"]
const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", sub: "Ringkasan operasi hari ini", icon: "grid", minRole: "supervisor" },
  { id: "stokharian", label: "Stok Harian", sub: "Stok awal, masuk, keluar, dan sisa per tanggal", icon: "calendar" },
  { id: "menucount", label: "Hitung Menu Terjual", sub: "Input qty menu terjual — stok bahan otomatis terpotong", icon: "cup" },
  { id: "opname", label: "Stock Opname", sub: "Bandingkan stok sistem dengan hasil hitung fisik", icon: "clipboard" },
  { id: "history", label: "Riwayat", sub: "Log transaksi & hitungan menu per tanggal", icon: "clock", minRole: "supervisor" },
  { id: "master", label: "Master Data", sub: "Kelola item, menu, dan resep", icon: "database", minRole: "admin" },
  { id: "users", label: "Pengguna", sub: "Kelola akses & peran", icon: "users", minRole: "admin" },
]
const ICONS = {
  grid: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  swap: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 3v14M7 17l-4-4M7 17l4-4M17 21V7M17 7l4 4M17 7l-4 4"/></svg>',
  cup: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z"/><path d="M17 9h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 2c0 1-1 1-1 2s1 1 1 2M13 2c0 1-1 1-1 2s1 1 1 2"/></svg>',
  clipboard: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/><path d="M9 12h6M9 16h6M9 8h6"/></svg>',
  clock: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
  users: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17.5" cy="8.5" r="2.4"/><path d="M15.5 14.2c2.6.4 4.5 2.4 4.5 5.3"/></svg>',
  alert: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3 2 21h20L12 3Z"/><path d="M12 9.5v5M12 17.5v.4"/></svg>',
  box: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 8 12 3l9 5v8l-9 5-9-5V8Z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>',
  scale: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18M7 21h10M6 7h12M6 7 3 13h6L6 7ZM18 7l-3 6h6l-3-6Z"/></svg>',
  database: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/></svg>',
  calendar: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  sun: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19"/></svg>',
  moon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 14a8 8 0 1 1-10-10 6.5 6.5 0 0 0 10 10Z"/></svg>',
}
function currentTheme() {
  const t = document.documentElement.dataset.theme
  if (t === "light" || t === "dark") return t
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}
function themeBtnInner() {
  return currentTheme() === "dark" ? ICONS.sun + "<span>Terang</span>" : ICONS.moon + "<span>Gelap</span>"
}
function toggleTheme() {
  const next = currentTheme() === "dark" ? "light" : "dark"
  document.documentElement.dataset.theme = next
  try { localStorage.setItem("armend_theme", next) } catch (_) {}
  const b = document.getElementById("theme-btn")
  if (b) b.innerHTML = themeBtnInner()
}

/* ============================== STATE ============================== */
let session = null
let profile = null // {id, name, role, email}  — role 'admin' = global owner
let outletGroups = []     // [{id,name}] kind='group' — for switcher headers / rollup
let outlets = []          // [{id,name,parent_id,area_type,_role}] kind='area' — selectable
let currentOutlet = null  // selected AREA id
let itemsById = {}
let menusById = {}
let recipesByMenu = {}
let prepByItem = {}
let ledgerCache = {}      // date -> {date, entries:[]}
let menuCountsCache = {}  // date -> {date, status, quantities, submittedQuantities, submittedBy, updatedBy}
let monthEndCache = {}    // date -> {date, status, appliedToStock, submittedBy, items:[{id,itemId,itemName,category,unit,systemEnding,physicalEnding}]}
let refDataLoaded = false
let outletDataLoaded = false
let currentView = "dashboard"
let realtimeChannels = []

/* ============================== HELPERS ============================== */
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])) }
function num(v) { const n = Number(v); return isNaN(n) ? 0 : n }
function fmtNum(n) { if (n == null || isNaN(n)) return "–"; const r = Math.round(Number(n) * 100) / 100; return r.toLocaleString("en-US", { maximumFractionDigits: 2 }) }
function round2(n) { return Math.round(n * 100) / 100 }
function todayStr() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") }
function fmtDateLabel(dstr) {
  if (!dstr) return ""
  const [y, m, d] = dstr.split("-").map(Number)
  if (!y) return dstr
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
}
function toast(msg, kind) {
  let elRoot = document.getElementById("toast-root")
  if (!elRoot) { elRoot = document.createElement("div"); elRoot.id = "toast-root"; document.body.appendChild(elRoot) }
  const el = document.createElement("div")
  el.className = "toast" + (kind ? (" " + kind) : "")
  el.textContent = msg
  elRoot.appendChild(el)
  setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .25s"; setTimeout(() => el.remove(), 250) }, 3400)
}
function byName() { return (profile && profile.name) || "Staff" }
function firstName() { return byName().trim().split(/\s+/)[0] }
function isOwner() { return profile && profile.role === "admin" }
function isManager() { return profile && (profile.role === "admin" || profile.role === "manager") }
function currentOutletRole() {
  if (isManager()) return "admin"
  const o = outlets.find(x => x.id === currentOutlet)
  return o ? o._role : null   // 'admin' | 'supervisor' | 'staff' | null
}
function isAdmin() { return currentOutletRole() === "admin" }        // admin of current area/outlet
function isSupervisor() { return ["admin", "supervisor"].includes(currentOutletRole()) }
function roleRank(r) { return { staff: 1, supervisor: 2, admin: 3 }[r] || 0 }
function roleAllows(min) { return !min || roleRank(currentOutletRole()) >= roleRank(min) }
const ROLE_LABEL = { owner: "Owner", manager: "Manajer", admin: "Admin Outlet", supervisor: "Supervisor", staff: "Staff" }
function currentArea() { return outlets.find(x => x.id === currentOutlet) || null }
function outletName() {
  const o = currentArea(); if (!o) return ""
  const g = outletGroups.find(x => x.id === o.parent_id)
  return (g ? g.name + " · " : "") + o.name
}
function currentGroup() { const o = currentArea(); return o ? (outletGroups.find(x => x.id === o.parent_id) || null) : null }
function outletSwitcherHtml(id) {
  const byGroup = {}
  outlets.forEach(o => { (byGroup[o.parent_id] = byGroup[o.parent_id] || []).push(o) })
  const groups = outletGroups.filter(g => byGroup[g.id])
  const opt = o => `<option value="${o.id}" ${o.id === currentOutlet ? "selected" : ""}>${esc(o.name)}</option>`
  return `<select class="outlet-select" id="${id}">${
    groups.length
      ? groups.map(g => `<optgroup label="${esc(g.name)}">${byGroup[g.id].map(opt).join("")}</optgroup>`).join("")
      : outlets.map(opt).join("")
  }</select>`
}
function fmtRp(n) { return "Rp " + Math.round(num(n)).toLocaleString("id-ID") }
function greeting() { const h = new Date().getHours(); return h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 18 ? "Selamat sore" : "Selamat malam" }
function slug(s) { return String(s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "item" }
function uniqueId(base, existing) { let id = base, n = 2; while (existing[id]) { id = base + "-" + n; n++ } return id }
function sortItems(a, b) { return a.category === b.category ? (a.order - b.order) : itemCatIdx(a.category) - itemCatIdx(b.category) }

/* ============================== AUTH ============================== */
async function boot() {
  const { data } = await supabase.auth.getSession()
  session = data.session
  supabase.auth.onAuthStateChange((_event, sess) => {
    const wasLoggedIn = !!session
    session = sess
    if (!!sess !== wasLoggedIn) { teardownRealtime(); render() }
  })
  render()
}

async function loadProfile() {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", session.user.id).single()
  if (error) { console.error(error); return null }
  return { id: data.id, name: data.name, role: data.role, email: data.email }
}

function renderLogin(errorMsg) {
  root.innerHTML = `
    <div class="login-shell"><div class="login-card">
      <div class="login-brand"><div class="brand-mark">${BRAND_MARK}</div><div><h2 style="margin:0">ARMEND</h2><div class="sub" style="margin:0">Operations, under control.</div></div></div>
      <h2>Masuk</h2>
      <div class="sub">Gunakan akun yang sudah dibuat admin.</div>
      ${errorMsg ? `<div class="login-error">${esc(errorMsg)}</div>` : ""}
      <form id="login-form">
        <div class="login-field"><label class="field-label">Email</label><input class="input" type="email" id="login-email" required autocomplete="username"></div>
        <div class="login-field"><label class="field-label">Password</label><input class="input" type="password" id="login-password" required autocomplete="current-password"></div>
        <button class="btn primary login-submit" type="submit">Masuk</button>
      </form>
      <div class="login-foot">Belum punya akun? Minta admin untuk mengundang email kamu lewat dashboard Supabase (Authentication → Users → Invite).</div>
    </div></div>`
  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault()
    const email = document.getElementById("login-email").value.trim()
    const password = document.getElementById("login-password").value
    const btn = e.target.querySelector("button")
    btn.disabled = true
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    btn.disabled = false
    if (error) { renderLogin(error.message === "Invalid login credentials" ? "Email atau password salah." : error.message); return }
    const s = await supabase.auth.getSession()
    session = s.data.session
    render()
  })
}

/* ============================== DATA LAYER (Supabase) ============================== */
function teardownRealtime() {
  realtimeChannels.forEach(ch => supabase.removeChannel(ch))
  realtimeChannels = []
}

function mapItemRow(r) {
  return { id: r.id, name: r.name, category: r.category, unit: r.unit, itemType: r.item_type, stockTracking: r.stock_tracking, stock: num(r.stock), needsOrder: r.needs_order, order: r.order_idx, minStock: num(r.min_stock), cost: num(r.cost_per_unit), controlTight: r.control_tight !== false, purchaseUnit: r.purchase_unit || "", packSize: num(r.pack_size), purchaseCost: num(r.purchase_cost), lossPct: num(r.loss_pct), hppOnly: r.hpp_only === true }
}
function mapMenuRow(r) { return { id: r.id, name: r.name, category: r.category, price: num(r.price), hppManual: r.hpp_manual == null ? null : num(r.hpp_manual), active: r.active, order: r.order_idx } }
// computed recipe cost for a menu (explodes PREP into raw items × cost_per_unit)
function menuHppCalc(menuId) {
  const direct = {}
  ;(recipesByMenu[menuId] || []).forEach(ing => { direct[ing.itemId] = (direct[ing.itemId] || 0) + ing.qty })
  const final = {}
  Object.keys(direct).forEach(id => explodeItem(id, direct[id], final))
  let cost = 0
  Object.keys(final).forEach(id => { const it = itemsById[id]; if (it) cost += final[id] * (1 + it.lossPct / 100) * it.cost })
  return round2(cost)
}
// effective HPP = manual override if set, else computed
function menuHpp(menuId) {
  const m = menusById[menuId]
  return m && m.hppManual != null ? round2(m.hppManual) : menuHppCalc(menuId)
}

function oid() { return currentOutlet }

async function fetchItems() {
  const { data, error } = await supabase.from("items").select("*").eq("outlet_id", oid()).order("order_idx")
  if (error) { console.error(error); return }
  itemsById = {}
  data.forEach(r => { itemsById[r.id] = mapItemRow(r) })
}
async function fetchMenu() {
  const { data, error } = await supabase.from("menu").select("*").eq("outlet_id", oid()).order("order_idx")
  if (error) { console.error(error); return }
  menusById = {}
  data.forEach(r => { menusById[r.id] = mapMenuRow(r) })
}
async function fetchRecipesOnce() {
  const [{ data: ri, error: e1 }, { data: pr, error: e2 }, { data: pc, error: e3 }] = await Promise.all([
    supabase.from("recipe_ingredients").select("menu_id,item_id,qty,unit").eq("outlet_id", oid()),
    supabase.from("prep_recipes").select("item_id,yield_qty,yield_unit").eq("outlet_id", oid()),
    supabase.from("prep_components").select("prep_item_id,item_id,qty,unit").eq("outlet_id", oid()),
  ])
  if (e1 || e2 || e3) { console.error(e1 || e2 || e3); return }
  recipesByMenu = {}
  ri.forEach(row => {
    const item = itemsById[row.item_id]
    ;(recipesByMenu[row.menu_id] = recipesByMenu[row.menu_id] || []).push({ itemId: row.item_id, itemName: item ? item.name : row.item_id, qty: num(row.qty), unit: row.unit })
  })
  const yieldByPrep = {}
  pr.forEach(row => { yieldByPrep[row.item_id] = { yieldQty: num(row.yield_qty), yieldUnit: row.yield_unit, components: [] } })
  pc.forEach(row => {
    const item = itemsById[row.item_id]
    if (yieldByPrep[row.prep_item_id]) yieldByPrep[row.prep_item_id].components.push({ itemId: row.item_id, itemName: item ? item.name : row.item_id, qty: num(row.qty), unit: row.unit })
  })
  prepByItem = yieldByPrep
  refDataLoaded = true
}

function recentDateFrom(daysBack) {
  const d = new Date(); d.setDate(d.getDate() - daysBack)
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0")
}

async function fetchLedgerRecent() {
  const since = recentDateFrom(31)
  const { data, error } = await supabase.from("ledger_entries").select("*").eq("outlet_id", oid()).gte("entry_date", since).order("entry_date", { ascending: false }).order("id", { ascending: false })
  if (error) { console.error(error); return }
  rebuildLedgerCache(data)
}
function rebuildLedgerCache(rows) {
  ledgerCache = {}
  rows.forEach(r => {
    const d = r.entry_date
    if (!ledgerCache[d]) ledgerCache[d] = { date: d, entries: [] }
    ledgerCache[d].entries.push({ time: r.entry_time, type: r.type, itemId: r.item_id, itemName: r.item_name, qty: num(r.qty), unit: r.unit, note: r.note, reason: r.reason, by: r.by_name })
  })
}
async function fetchLedgerForDate(date) {
  if (ledgerCache[date]) return
  const { data, error } = await supabase.from("ledger_entries").select("*").eq("outlet_id", oid()).eq("entry_date", date).order("id")
  if (error) { console.error(error); return }
  ledgerCache[date] = { date, entries: data.map(r => ({ time: r.entry_time, type: r.type, itemId: r.item_id, itemName: r.item_name, qty: num(r.qty), unit: r.unit, note: r.note, reason: r.reason, by: r.by_name })) }
}

async function fetchMenuCountsRecent() {
  const since = recentDateFrom(31)
  const [{ data: days, error: e1 }, { data: lines, error: e2 }] = await Promise.all([
    supabase.from("menu_count_days").select("*").eq("outlet_id", oid()).gte("entry_date", since).order("entry_date", { ascending: false }),
    supabase.from("menu_count_lines").select("*").eq("outlet_id", oid()).gte("entry_date", since),
  ])
  if (e1 || e2) { console.error(e1 || e2); return }
  rebuildMenuCountsCache(days, lines)
}
function rebuildMenuCountsCache(days, lines) {
  menuCountsCache = {}
  days.forEach(d => {
    menuCountsCache[d.entry_date] = { date: d.entry_date, status: d.status, updatedBy: d.updated_by, submittedBy: d.submitted_by, quantities: {}, submittedQuantities: {} }
  })
  lines.forEach(l => {
    if (!menuCountsCache[l.entry_date]) menuCountsCache[l.entry_date] = { date: l.entry_date, status: "DRAFT", quantities: {}, submittedQuantities: {} }
    menuCountsCache[l.entry_date].quantities[l.menu_id] = num(l.qty)
    menuCountsCache[l.entry_date].submittedQuantities[l.menu_id] = num(l.submitted_qty)
  })
}
async function fetchMenuCountForDate(date) {
  const [{ data: d1 }, { data: l1 }] = await Promise.all([
    supabase.from("menu_count_days").select("*").eq("outlet_id", oid()).eq("entry_date", date).maybeSingle(),
    supabase.from("menu_count_lines").select("*").eq("outlet_id", oid()).eq("entry_date", date),
  ])
  if (d1) {
    menuCountsCache[date] = { date, status: d1.status, quantities: {}, submittedQuantities: {} }
    ;(l1 || []).forEach(l => { menuCountsCache[date].quantities[l.menu_id] = num(l.qty); menuCountsCache[date].submittedQuantities[l.menu_id] = num(l.submitted_qty) })
  } else {
    delete menuCountsCache[date]
  }
}

async function fetchMonthEndRecent() {
  const since = recentDateFrom(365)
  const [{ data: sess, error: e1 }, { data: items, error: e2 }] = await Promise.all([
    supabase.from("month_end_sessions").select("*").eq("outlet_id", oid()).gte("entry_date", since).order("entry_date", { ascending: false }),
    supabase.from("month_end_items").select("*").eq("outlet_id", oid()).gte("entry_date", since),
  ])
  if (e1 || e2) { console.error(e1 || e2); return }
  rebuildMonthEndCache(sess, items)
}
function rebuildMonthEndCache(sess, items) {
  monthEndCache = {}
  sess.forEach(s => { monthEndCache[s.entry_date] = { date: s.entry_date, status: s.status, appliedToStock: s.applied_to_stock, createdBy: s.created_by, submittedBy: s.submitted_by, items: [] } })
  items.forEach(it => {
    if (!monthEndCache[it.entry_date]) return
    monthEndCache[it.entry_date].items.push({ id: it.id, itemId: it.item_id, itemName: it.item_name, category: it.category, unit: it.unit, systemEnding: num(it.system_ending), physicalEnding: it.physical_ending == null ? null : num(it.physical_ending) })
  })
}

async function fetchAllProfiles() {
  const { data, error } = await supabase.from("profiles").select("*").order("created_at")
  if (error) { console.error(error); return [] }
  return data
}

/* after a local write we already reflected in the UI, ignore the realtime echo
   for a moment so we don't rebuild the view under the user's hands */
let suppressRenderUntil = 0
function afterLocalWrite() { suppressRenderUntil = Date.now() + 1500 }
function debounced(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms) } }

function setupRealtime() {
  teardownRealtime()
  const mk = (table, cb) => {
    const ch = supabase.channel(table + "-rt").on("postgres_changes", { event: "*", schema: "public", table }, debounced(cb, 350)).subscribe()
    realtimeChannels.push(ch)
  }
  const dailyBusy = () => document.querySelector(".daily-input:focus, .daily-input:disabled")
  mk("items", async () => {
    await fetchItems()
    if (currentView === "stokharian" && dailyBusy()) return
    rerenderIf(["dashboard", "stokharian", "opname", "menucount", "master"])
  })
  mk("menu", async () => { await fetchMenu(); rerenderIf(["menucount", "master"]) })
  mk("ledger_entries", async () => {
    await fetchLedgerRecent()
    wasteRows = null
    if (currentView === "stokharian") {
      await fetchDailyLedger(dailyFetchedFrom || dailyDate)
      if (dailyBusy()) return
    }
    rerenderIf(["dashboard", "stokharian", "history"])
  })
  mk("menu_count_days", async () => { await fetchMenuCountsRecent(); rerenderIf(["menucount", "history"]) })
  mk("menu_count_lines", async () => { await fetchMenuCountsRecent(); rerenderIf(["menucount", "history"]) })
  mk("month_end_sessions", async () => { await fetchMonthEndRecent(); rerenderIf(["opname"]) })
  mk("month_end_items", async () => { await fetchMonthEndRecent(); rerenderIf(["opname"]) })
  mk("profiles", async () => { rerenderIf(["users"]) })
}
function rerenderIf(views) {
  if (Date.now() < suppressRenderUntil) return
  if (views.includes(currentView)) renderCurrentView()
}

/* ============================== EXPLOSION (client-side PREVIEW only — the
   authoritative deduction runs atomically in the submit_menu_count RPC) ============================== */
function explodeItem(itemId, amount, sink, depth) {
  depth = depth || 0
  const item = itemsById[itemId]
  if (item && item.itemType === "PREP" && prepByItem[itemId] && depth < 6) {
    const prep = prepByItem[itemId]
    const ratio = amount / (prep.yieldQty || 1)
    ;(prep.components || []).forEach(c => explodeItem(c.itemId, c.qty * ratio, sink, depth + 1))
  } else {
    sink[itemId] = (sink[itemId] || 0) + amount
  }
}
function computeConsumption(qtyMap, baseMap) {
  const direct = {}
  Object.keys(qtyMap).forEach(menuId => {
    const qty = Number(qtyMap[menuId]) || 0
    const base = baseMap ? (Number(baseMap[menuId]) || 0) : 0
    const effective = baseMap ? (qty - base) : qty
    if (!effective) return
    ;(recipesByMenu[menuId] || []).forEach(ing => { direct[ing.itemId] = (direct[ing.itemId] || 0) + ing.qty * effective })
  })
  const final = {}
  Object.keys(direct).forEach(itemId => explodeItem(itemId, direct[itemId], final))
  Object.keys(final).forEach(id => {
    const it = itemsById[id]
    if (it && it.hppOnly) { delete final[id]; return }   // dihitung ke HPP, tapi stok tak dipotong otomatis
    if (it && it.lossPct) final[id] = round2(final[id] * (1 + it.lossPct / 100))
  })
  return final
}

/* ============================== SHELL / NAV ============================== */
function shellHtml() {
  return `
  <div class="app">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">${BRAND_MARK}</div>
        <div class="brand-text"><h1>ARMEND</h1><span>F&amp;B Operations</span></div>
      </div>
      ${outlets.length > 1 ? outletSwitcherHtml("outlet-select") : `<div class="outlet-static">${esc(outletName())}</div>`}
      <nav class="nav" id="nav"></nav>
      <div class="nav-foot">
        <div class="userbox" style="margin-bottom:8px">
          <span class="uname">${esc(byName())}</span>
          <span class="role-badge ${roleRank(currentOutletRole()) >= 3 ? "admin" : "staff"}">${
            isOwner() ? "Owner" : profile.role === "manager" ? "Manajer"
              : currentOutletRole() === "admin" ? "Admin" : currentOutletRole() === "supervisor" ? "Supervisor" : "Staff"
          }</span>
        </div>
        <div class="foot-actions">
          <button class="theme-btn" id="theme-btn" type="button">${themeBtnInner()}</button>
          <button class="linklike" id="btn-logout" type="button">Keluar</button>
        </div>
      </div>
    </aside>
    <div class="main">
      <div class="mobile-nav" id="mobile-nav"></div>
      <header class="topbar">
        <div><h2 id="view-title">Dashboard</h2><div class="sub" id="view-sub"></div></div>
        <div class="topbar-right">
          ${outlets.length > 1 ? outletSwitcherHtml("outlet-select-m").replace('class="outlet-select"', 'class="outlet-select topbar-outlet"') : ""}
        </div>
      </header>
      <section class="view" id="view-body"></section>
    </div>
  </div>
  <div id="toast-root"></div>`
}

function defaultView() { return roleAllows("supervisor") ? "dashboard" : "stokharian" }
function renderNav() {
  const items = NAV_ITEMS.filter(n => roleAllows(n.minRole))
  const nav = document.getElementById("nav")
  nav.innerHTML = items.map(n => `<button class="nav-btn ${n.id === currentView ? "active" : ""}" data-nav="${n.id}">${ICONS[n.icon]}<span>${n.label}</span></button>`).join("")
  nav.querySelectorAll("[data-nav]").forEach(b => b.addEventListener("click", () => switchView(b.dataset.nav)))
  const mnav = document.getElementById("mobile-nav")
  mnav.innerHTML = items.map(n => `<button class="${n.id === currentView ? "active" : ""}" data-nav="${n.id}">${n.label}</button>`).join("")
  mnav.querySelectorAll("[data-nav]").forEach(b => b.addEventListener("click", () => switchView(b.dataset.nav)))
}
function switchView(id) {
  let meta = NAV_ITEMS.find(n => n.id === id)
  if (!meta || !roleAllows(meta.minRole)) { id = defaultView(); meta = NAV_ITEMS.find(n => n.id === id) }
  currentView = id
  document.getElementById("view-title").textContent = meta.label
  document.getElementById("view-sub").textContent = meta.sub
  renderNav()
  renderCurrentView()
}
function renderCurrentView() {
  const body = document.getElementById("view-body")
  if (!body) return
  if (currentView === "dashboard") return renderDashboard(body)
  if (currentView === "stokharian") return renderDaily(body)
  if (currentView === "menucount") return renderMenuCount(body)
  if (currentView === "opname") return renderOpname(body)
  if (currentView === "history") return renderHistory(body)
  if (currentView === "master") return renderMaster(body)
  if (currentView === "users") return renderUsers(body)
}

/* ============================== DASHBOARD (Overview cockpit) ============================== */
function renderDashboard(el) {
  const items = Object.values(itemsById)
  if (!items.length) { el.innerHTML = emptyOrLoading(`Area "${outletName()}" belum punya item. Buka Master Data untuk menambahkan.`); return }
  const today = todayStr()
  const ym = today.slice(0, 7)
  const since7 = recentDateFrom(6)
  const hasCost = items.some(i => i.cost > 0)
  const hasPar = items.some(i => i.minStock > 0)
  const costById = {}; items.forEach(i => { costById[i.id] = i.cost })

  const valueNow = items.reduce((s, i) => s + i.stock * i.cost, 0)
  let netValDelta = 0
  let recV = 0, useV = 0, wasteV = 0, recN = 0, useN = 0, wasteN = 0
  const d7 = {}
  Object.values(ledgerCache).forEach(day => {
    (day.entries || []).forEach(e => {
      const c = costById[e.itemId] || 0, q = num(e.qty)
      netValDelta += (e.type === "IN" || e.type === "ADJUSTMENT" ? q : -q) * c
      if (day.date >= since7) {
        const b = d7[day.date] || (d7[day.date] = { inV: 0, outV: 0, inN: 0, outN: 0 })
        if (e.type === "IN") { b.inV += q * c; b.inN++; recV += q * c; recN++ }
        else if (e.type === "AUTO_OUT") { b.outV += q * c; b.outN++; useV += q * c; useN++ }
        else if (e.type === "MANUAL_OUT") { b.outV += q * c; b.outN++; wasteV += q * c; wasteN++ }
      }
    })
  })
  const valuePrev = valueNow - netValDelta
  const valPct = valuePrev > 0 ? ((valueNow - valuePrev) / valuePrev * 100) : null

  const belowPar = items.filter(i => i.stockTracking && i.controlTight && ((i.minStock > 0 && i.stock < i.minStock) || i.stock <= 0))

  let varRp = 0, varSessions = 0
  Object.values(monthEndCache).forEach(s => {
    if (s.status !== "SUBMITTED" || String(s.date).slice(0, 7) !== ym) return
    varSessions++
    ;(s.items || []).forEach(it => { if (it.physicalEnding != null) varRp += Math.abs(it.physicalEnding - it.systemEnding) * (costById[it.itemId] || 0) })
  })
  const varPct = valueNow > 0 ? (varRp / valueNow * 100) : null

  const attn = []
  items.filter(i => i.stockTracking && i.controlTight && i.stock <= 0).sort((a, b) => a.name.localeCompare(b.name))
    .forEach(i => attn.push({ kind: "crit", icon: "box", name: i.name, sub: "Stok habis", meta: `0 ${i.unit}`, id: i.id, act: "Order" }))
  belowPar.filter(i => i.stock > 0).sort((a, b) => (a.stock / a.minStock) - (b.stock / b.minStock))
    .forEach(i => attn.push({ kind: "warn", icon: "alert", name: i.name, sub: `Di bawah par (${fmtNum(i.minStock)} ${i.unit})`, meta: `${fmtNum(i.stock)} ${i.unit} tersisa`, id: i.id, act: "Order" }))
  const latestOpname = Object.values(monthEndCache).filter(s => s.status === "SUBMITTED").sort((a, b) => b.date.localeCompare(a.date))[0]
  if (latestOpname) (latestOpname.items || []).forEach(it => {
    if (it.physicalEnding == null || !it.systemEnding) return
    const pct = (it.physicalEnding - it.systemEnding) / it.systemEnding * 100
    if (Math.abs(pct) >= 10) attn.push({ kind: "info", icon: "scale", name: it.itemName, sub: `Selisih ${pct > 0 ? "+" : ""}${fmtNum(round2(pct))}% pada opname ${fmtDateLabel(latestOpname.date)}`, meta: "", go: "opname", act: "Cek" })
  })
  const attnTop = attn.slice(0, 6)

  el.innerHTML = `
    <div class="page-head">
      <div class="greeting">
        <h2>${greeting()}, ${esc(firstName())}</h2>
        <div class="sub">Ini yang terjadi di operasi kamu.</div>
      </div>
      <div class="date-chip">${fmtDateLabel(today)}</div>
    </div>

    <div class="kpi-row">
      <div class="kpi">
        <div class="label">Nilai Inventory</div>
        <div class="value">${hasCost ? fmtRp(valueNow) : "—"}</div>
        <div class="foot">${hasCost
          ? (valPct == null ? "belum ada pembanding" : `<span class="delta ${valPct < 0 ? "down" : "up"}">${valPct < 0 ? "↓" : "↑"} ${fmtNum(Math.abs(round2(valPct)))}% vs ~30 hari lalu</span>`)
          : (isAdmin() ? `<button class="link-btn" data-go="master">Isi harga/unit item →</button>` : "harga/unit belum diisi")}</div>
      </div>
      <div class="kpi">
        <div class="label">Total Item</div>
        <div class="value">${items.length}</div>
        <div class="foot">item aktif</div>
      </div>
      <div class="kpi">
        <div class="label">Di Bawah Par</div>
        <div class="value ${belowPar.length ? "warn" : "good"}">${belowPar.length}</div>
        <div class="foot">${hasPar || belowPar.length ? "perlu restock" : (isAdmin() ? `<button class="link-btn" data-go="master">Set par level →</button>` : "par level belum diset")}</div>
      </div>
      <div class="kpi">
        <div class="label">Selisih Bulan Ini</div>
        <div class="value ${varRp > 0 ? "critical" : ""}">${varSessions && hasCost ? fmtRp(varRp) : "—"}</div>
        <div class="foot">${!varSessions ? "belum ada opname bulan ini" : !hasCost ? "isi harga/unit dulu" : varPct != null ? `${fmtNum(round2(varPct))}% dari nilai inventory` : ""}</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-head">
          <div><h3>Perlu Perhatian</h3><div class="desc">${attn.length ? attn.length + " hal butuh tindakan" : "tidak ada"}</div></div>
          <button class="link-btn" data-go="stokharian">Lihat stok</button>
        </div>
        ${attnTop.length ? `<div class="attn-list">${attnTop.map(a => `
          <div class="attn-row">
            <div class="attn-ic ${a.kind}">${ICONS[a.icon]}</div>
            <div class="attn-main"><div class="t">${esc(a.name)}</div><div class="s">${esc(a.sub)}</div></div>
            ${a.meta ? `<div class="attn-meta">${esc(a.meta)}</div>` : ""}
            <button class="btn sm ${a.act === "Cek" ? "ghost" : ""}" ${a.id ? `data-attn-order="${a.id}"` : `data-attn-go="${a.go}"`}>${a.act}</button>
          </div>`).join("")}</div>
          ${attn.length > attnTop.length ? `<div class="card-body" style="border-top:1px solid var(--border);padding-top:12px;padding-bottom:12px"><button class="link-btn" data-go="stokharian">+ ${attn.length - attnTop.length} lainnya</button></div>` : ""}`
        : `<div class="empty-state">Semua terkendali. Tidak ada yang butuh perhatian.</div>`}
      </div>

      <div class="card">
        <div class="card-head">
          <div><h3>Ringkasan Pergerakan</h3><div class="desc">7 hari terakhir</div></div>
          <button class="link-btn" data-go="history">Lihat riwayat</button>
        </div>
        <div class="card-body">
          <div class="move-row">
            <div class="m"><div class="lbl">Masuk</div><div class="v tag-in">${hasCost ? fmtRp(recV) : recN + "×"}</div></div>
            <div class="m"><div class="lbl">Pemakaian</div><div class="v">${hasCost ? fmtRp(useV) : useN + "×"}</div></div>
            <div class="m"><div class="lbl">Waste</div><div class="v tag-out">${hasCost ? fmtRp(wasteV) : wasteN + "×"}</div></div>
          </div>
          ${sparklineHtml(d7, since7, hasCost)}
        </div>
      </div>
    </div>`

  el.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => switchView(b.dataset.go)))
  el.querySelectorAll("[data-attn-go]").forEach(b => b.addEventListener("click", () => switchView(b.dataset.attnGo)))
  el.querySelectorAll("[data-attn-order]").forEach(b => b.addEventListener("click", async () => {
    b.disabled = true
    const { error } = await supabase.from("items").update({ needs_order: true }).eq("id", b.dataset.attnOrder)
    if (error) { b.disabled = false; toast("Gagal: " + error.message, "err"); return }
    toast("Ditandai perlu order", "ok")
    await fetchItems(); renderCurrentView()
  }))
}

function sparklineHtml(d7, since7, hasCost) {
  const days = []
  const base = new Date(since7 + "T00:00:00")
  for (let k = 0; k < 7; k++) {
    const dt = new Date(base); dt.setDate(dt.getDate() + k)
    const key = dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0")
    const b = d7[key] || { inV: 0, outV: 0, inN: 0, outN: 0 }
    days.push({ label: dt.toLocaleDateString("id-ID", { weekday: "short" }), inn: hasCost ? b.inV : b.inN, out: hasCost ? b.outV : b.outN })
  }
  const max = Math.max(1, ...days.map(d => Math.max(d.inn, d.out)))
  const W = 320, H = 58, gw = W / 7, bw = gw * 0.32
  const bars = days.map((d, idx) => {
    const gx = idx * gw + gw * 0.14
    const hIn = d.inn > 0 ? Math.max(2, d.inn / max * H) : 0
    const hOut = d.out > 0 ? Math.max(2, d.out / max * H) : 0
    return `<rect x="${gx.toFixed(1)}" y="${(H - hIn).toFixed(1)}" width="${bw.toFixed(1)}" height="${hIn.toFixed(1)}" rx="1.5" fill="var(--lime)"/>`
      + `<rect x="${(gx + bw + 2).toFixed(1)}" y="${(H - hOut).toFixed(1)}" width="${bw.toFixed(1)}" height="${hOut.toFixed(1)}" rx="1.5" fill="var(--ink-faint)"/>`
  }).join("")
  const labels = days.map((d, idx) => `<text x="${(idx * gw + gw / 2).toFixed(1)}" y="${H + 11}" font-size="8" fill="var(--ink-faint)" text-anchor="middle">${d.label}</text>`).join("")
  return `<svg class="spark" viewBox="0 0 ${W} ${H + 14}" xmlns="http://www.w3.org/2000/svg">${bars}${labels}</svg>
  <div style="display:flex;gap:14px;font-size:11px;color:var(--ink-faint);margin-top:6px">
    <span><i style="display:inline-block;width:8px;height:8px;background:var(--lime);border-radius:2px;margin-right:5px"></i>Masuk</span>
    <span><i style="display:inline-block;width:8px;height:8px;background:var(--ink-faint);border-radius:2px;margin-right:5px"></i>Keluar</span>
  </div>`
}

/* ============================== MENU COUNT ============================== */
let menuCountDate = todayStr()
let menuCountDraft = null

function renderMenuCount(el) {
  if (!outletDataLoaded || !refDataLoaded) { el.innerHTML = `<div class="card"><div class="empty-state">Memuat data menu &amp; resep…</div></div>`; return }
  if (!Object.keys(menusById).length) { el.innerHTML = emptyOrLoading(`Area "${outletName()}" belum punya menu. Tambahkan di Master Data → Menu.`); return }
  const doc = menuCountsCache[menuCountDate]
  if (!menuCountDraft || menuCountDraft._date !== menuCountDate) {
    menuCountDraft = { _date: menuCountDate }
    Object.values(menusById).forEach(m => { menuCountDraft[m.id] = (doc && doc.quantities && doc.quantities[m.id]) || 0 })
  }
  const status = (doc && doc.status) || "BELUM ADA"
  const menus = Object.values(menusById).sort((a, b) => a.order - b.order)
  const submitted = doc && doc.status === "SUBMITTED" ? doc.submittedQuantities : null
  const previewRowsFor = (draft) => {
    const total = computeConsumption(draft, null)
    const diff = submitted ? computeConsumption(draft, submitted) : null
    return Object.keys(total).map(id => ({ id, amt: total[id], diff: diff ? (diff[id] || 0) : null, item: itemsById[id] }))
      .filter(r => r.item && Math.abs(r.amt) > 1e-6)
      .sort((a, b) => Math.abs(b.amt) - Math.abs(a.amt))
  }
  const previewRows = previewRowsFor(menuCountDraft)

  el.innerHTML = `
    <div class="grid-2">
      <div class="card">
        <div class="card-head">
          <div><h3>Form Hitung Menu</h3><div class="desc">Isi qty menu terjual, lalu submit untuk potong stok bahan otomatis</div></div>
          <div class="toolbar"><input type="date" id="mc-date" class="input" value="${menuCountDate}">
          <span class="pill ${status === "SUBMITTED" ? "good" : status === "DRAFT" ? "warn" : "neutral"}">${status === "SUBMITTED" ? "Sudah Submit" : status === "DRAFT" ? "Draft" : "Belum Ada"}</span></div>
        </div>
        <div class="card-body flush">
          ${menuCats().map(cat => {
            const catMenus = menus.filter(m => m.category === cat)
            if (!catMenus.length) return ""
            return `<div class="menu-cat"><div class="menu-cat-head">${esc(cat)}</div>
              ${catMenus.map(m => `<div class="menu-item-row"><span class="name">${esc(m.name)}</span><input type="number" min="0" step="1" class="input qty-input" data-menu-qty="${m.id}" value="${menuCountDraft[m.id] || 0}"></div>`).join("")}
            </div>`
          }).join("")}
        </div>
        <div class="card-body" style="display:flex;gap:10px;border-top:1px solid var(--border)">
          <button class="btn ghost" id="mc-save-draft">Simpan Draft</button>
          <button class="btn primary" id="mc-submit">Submit &amp; Potong Stok</button>
        </div>
      </div>
      <div class="card mc-preview-card">
        <div class="card-head"><div><h3>Perkiraan Pemakaian Bahan</h3><div class="desc">Total dari qty di form${submitted ? " — angka dalam (…) = selisih yang dipotong kalau submit ulang" : ""}</div></div></div>
        <div class="card-body" id="mc-preview">${previewHtml(previewRows)}</div>
      </div>
    </div>`

  function previewHtml(rows) {
    if (!rows.length) return `<div class="empty-state">Isi qty menu untuk melihat perkiraan pemakaian bahan.</div>`
    return `<div class="preview-list">${rows.map(r => `<div class="preview-row"><span>${esc(r.item.name)}</span><span class="neg">−${fmtNum(r.amt)} ${esc(r.item.unit)}${r.diff != null && Math.abs(r.diff) > 1e-6 ? ` <span style="color:var(--ink-faint)">(${r.diff > 0 ? "−" : "+"}${fmtNum(Math.abs(r.diff))})</span>` : ""}</span></div>`).join("")}</div>`
  }

  document.getElementById("mc-date").addEventListener("change", async e => { menuCountDate = e.target.value; menuCountDraft = null; await fetchMenuCountForDate(menuCountDate); renderMenuCount(el) })
  el.querySelectorAll("[data-menu-qty]").forEach(inp => {
    inp.addEventListener("input", () => {
      menuCountDraft[inp.dataset.menuQty] = parseFloat(inp.value) || 0
      document.getElementById("mc-preview").innerHTML = previewHtml(previewRowsFor(menuCountDraft))
    })
  })

  document.getElementById("mc-save-draft").addEventListener("click", async () => {
    const qtyMap = {}; Object.keys(menusById).forEach(id => { qtyMap[id] = menuCountDraft[id] || 0 })
    const { error: e1 } = await supabase.from("menu_count_days").upsert({ outlet_id: oid(), entry_date: menuCountDate, updated_by: session.user.id, updated_at: new Date().toISOString() }, { onConflict: "outlet_id,entry_date", ignoreDuplicates: false })
    if (e1) { toast("Gagal simpan draft: " + e1.message, "err"); return }
    const rows = Object.keys(qtyMap).map(menuId => ({ outlet_id: oid(), entry_date: menuCountDate, menu_id: menuId, qty: qtyMap[menuId] }))
    const { error: e2 } = await supabase.from("menu_count_lines").upsert(rows, { onConflict: "outlet_id,entry_date,menu_id" })
    if (e2) { toast("Gagal simpan draft: " + e2.message, "err"); return }
    toast("Draft hitungan menu disimpan", "ok")
    await fetchMenuCountForDate(menuCountDate)
  })

  document.getElementById("mc-submit").addEventListener("click", async () => {
    const btn = document.getElementById("mc-submit")
    const qtyMap = {}; Object.keys(menusById).forEach(id => { qtyMap[id] = menuCountDraft[id] || 0 })
    if (!Object.values(qtyMap).some(v => v > 0)) { toast("Isi minimal satu qty menu", "err"); return }
    btn.disabled = true
    const { error } = await supabase.rpc("submit_menu_count", { p_outlet: oid(), p_date: menuCountDate, p_quantities: qtyMap, p_by_name: byName() })
    btn.disabled = false
    if (error) { toast("Gagal submit: " + error.message, "err"); return }
    toast("Hitungan menu disubmit — stok bahan otomatis terpotong", "ok")
    await Promise.all([fetchItems(), fetchLedgerRecent(), fetchMenuCountForDate(menuCountDate)])
    menuCountDraft = null
    renderMenuCount(el)
  })
}

/* ============================== STOCK OPNAME ============================== */
let opnameDate = todayStr()
let opnameDraft = null

function renderOpname(el) {
  const items = Object.values(itemsById).sort(sortItems)
  if (!items.length) { el.innerHTML = emptyOrLoading(`Area "${outletName()}" belum punya item. Buka Master Data untuk menambahkan.`); return }
  const history = Object.values(monthEndCache).sort((a, b) => b.date.localeCompare(a.date))
  const existing = monthEndCache[opnameDate]

  if (!existing) {
    el.innerHTML = `
      <div class="card">
        <div class="card-head"><div><h3>Stock Opname</h3><div class="desc">Bandingkan stok sistem dengan hasil hitung fisik</div></div><input type="date" id="opname-date" class="input" value="${opnameDate}"></div>
        <div class="card-body" style="text-align:center;padding:34px 18px">
          <p style="color:var(--ink-dim);margin:0 0 14px">Belum ada sesi opname untuk <strong>${fmtDateLabel(opnameDate)}</strong>.</p>
          <button class="btn primary" id="opname-create">Buat Sesi Opname — Ambil Snapshot Stok Sekarang</button>
        </div>
      </div>${renderOpnameHistoryCard(history)}`
    document.getElementById("opname-date").addEventListener("change", async e => { opnameDate = e.target.value; await fetchMonthEndRecent(); renderOpname(el) })
    document.getElementById("opname-create").addEventListener("click", async () => {
      const { error: e1 } = await supabase.from("month_end_sessions").insert({ outlet_id: oid(), entry_date: opnameDate, status: "DRAFT", created_by: session.user.id })
      if (e1) { toast("Gagal membuat sesi: " + e1.message, "err"); return }
      const rows = items.map(i => ({ outlet_id: oid(), entry_date: opnameDate, item_id: i.id, item_name: i.name, category: i.category, unit: i.unit, system_ending: i.stock || 0 }))
      const { error: e2 } = await supabase.from("month_end_items").insert(rows)
      if (e2) { toast("Gagal membuat sesi: " + e2.message, "err"); return }
      toast("Sesi opname dibuat", "ok")
      await fetchMonthEndRecent()
      renderOpname(el)
    })
    return
  }

  const rows = existing.items || []
  const locked = existing.status === "SUBMITTED"
  let totalVar = 0, filledCount = 0
  rows.forEach(r => { if (r.physicalEnding != null) { filledCount++; totalVar += (r.physicalEnding - r.systemEnding) } })
  const grouped = {}
  rows.forEach(r => { (grouped[r.category] = grouped[r.category] || []).push(r) })

  el.innerHTML = `
    <div class="kpi-row">
      <div class="kpi"><div class="label">Tanggal Opname</div><div class="value" style="font-size:20px">${fmtDateLabel(opnameDate)}</div><div class="foot">${locked ? "Sudah disubmit" : "Draft — belum final"}</div></div>
      <div class="kpi"><div class="label">Item Terisi</div><div class="value" id="opn-filled">${filledCount}/${rows.length}</div><div class="foot">hitung fisik</div></div>
      <div class="kpi"><div class="label">Total Selisih</div><div class="value ${totalVar < 0 ? "critical" : totalVar > 0 ? "warn" : "good"}" id="opn-totalvar">${totalVar > 0 ? "+" : ""}${fmtNum(round2(totalVar))}</div><div class="foot">gabungan semua unit (indikatif)</div></div>
    </div>
    <div class="card">
      <div class="card-head"><div><h3>Input Hitung Fisik</h3><div class="desc">Sistem ending diambil otomatis saat sesi dibuat</div></div><input type="date" id="opname-date" class="input" value="${opnameDate}"></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Item</th><th>Unit</th><th class="num">System Ending</th><th class="num">Physical Ending</th><th class="num">Variance</th><th class="num">Var %</th></tr></thead>
        <tbody>${itemCats().filter(c => grouped[c]).map(cat => `
          <tr class="cat-row"><td colspan="6">${esc(cat)}</td></tr>
          ${grouped[cat].map(r => {
            const variance = r.physicalEnding != null ? round2(r.physicalEnding - r.systemEnding) : null
            const pct = (variance != null && r.systemEnding) ? round2(variance / r.systemEnding * 100) : (variance != null && r.physicalEnding ? 100 : null)
            const vClass = variance == null ? "" : variance < 0 ? "variance-neg" : variance > 0 ? "variance-pos" : "variance-zero"
            return `<tr><td>${esc(r.itemName)}</td><td>${esc(r.unit)}</td><td class="num">${fmtNum(r.systemEnding)}</td>
              <td class="num"><input type="number" step="any" class="input phys" data-opname-id="${r.id}" value="${r.physicalEnding == null ? "" : r.physicalEnding}" ${locked ? "disabled" : ""}></td>
              <td class="num ${vClass}" data-vc>${variance == null ? "–" : (variance > 0 ? "+" : "") + fmtNum(variance)}</td>
              <td class="num ${vClass}" data-vp>${pct == null ? "–" : (pct > 0 ? "+" : "") + fmtNum(pct) + "%"}</td></tr>`
          }).join("")}`).join("")}
        </tbody>
      </table></div>
      <div class="card-body" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;border-top:1px solid var(--border)">
        ${locked ? `<button class="btn ghost" id="opname-reopen">Buka Kembali untuk Edit</button>` : `
          <button class="btn ghost" id="opname-save">Simpan Draft</button>
          <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--ink-dim)"><input type="checkbox" id="opname-apply" style="width:16px;height:16px"> Sesuaikan stok sistem ke hasil fisik saat submit</label>
          <button class="btn primary" id="opname-submit">Submit Opname</button>`}
      </div>
    </div>${renderOpnameHistoryCard(history)}`

  document.getElementById("opname-date").addEventListener("change", async e => { opnameDate = e.target.value; await fetchMonthEndRecent(); renderOpname(el) })

  const pendingEdits = {}
  const rowById = {}; rows.forEach(r => { rowById[r.id] = r })
  function patchOpnameRow(inp) {
    const r = rowById[inp.dataset.opnameId]; if (!r) return
    const raw = parseFloat(inp.value)
    const phys = inp.value === "" || isNaN(raw) ? null : raw
    const variance = phys != null ? round2(phys - r.systemEnding) : null
    const pct = (variance != null && r.systemEnding) ? round2(variance / r.systemEnding * 100) : (variance != null && phys ? 100 : null)
    const vClass = variance == null ? "" : variance < 0 ? "variance-neg" : variance > 0 ? "variance-pos" : "variance-zero"
    const tr = inp.closest("tr")
    const vc = tr.querySelector("[data-vc]"), vp = tr.querySelector("[data-vp]")
    if (vc) { vc.className = "num " + vClass; vc.textContent = variance == null ? "–" : (variance > 0 ? "+" : "") + fmtNum(variance) }
    if (vp) { vp.className = "num " + vClass; vp.textContent = pct == null ? "–" : (pct > 0 ? "+" : "") + fmtNum(pct) + "%" }
    let filled = 0, tv = 0
    el.querySelectorAll("[data-opname-id]").forEach(i => {
      const rr = rowById[i.dataset.opnameId]; if (!rr) return
      const v = parseFloat(i.value)
      if (i.value !== "" && !isNaN(v)) { filled++; tv += (v - rr.systemEnding) }
    })
    const fEl = document.getElementById("opn-filled"); if (fEl) fEl.textContent = `${filled}/${rows.length}`
    const tEl = document.getElementById("opn-totalvar")
    if (tEl) { tv = round2(tv); tEl.textContent = (tv > 0 ? "+" : "") + fmtNum(tv); tEl.className = "value " + (tv < 0 ? "critical" : tv > 0 ? "warn" : "good") }
  }
  el.querySelectorAll("[data-opname-id]").forEach(inp => {
    inp.addEventListener("input", () => {
      pendingEdits[inp.dataset.opnameId] = inp.value === "" ? null : parseFloat(inp.value)
      patchOpnameRow(inp)
    })
  })

  const saveBtn = document.getElementById("opname-save")
  if (saveBtn) saveBtn.addEventListener("click", async () => {
    const updates = Object.keys(pendingEdits).map(id => supabase.from("month_end_items").update({ physical_ending: pendingEdits[id] }).eq("id", id))
    await Promise.all(updates)
    toast("Draft opname disimpan", "ok")
    await fetchMonthEndRecent()
    renderOpname(el)
  })

  const submitBtn = document.getElementById("opname-submit")
  if (submitBtn) submitBtn.addEventListener("click", async () => {
    submitBtn.disabled = true
    const updates = Object.keys(pendingEdits).map(id => supabase.from("month_end_items").update({ physical_ending: pendingEdits[id] }).eq("id", id))
    await Promise.all(updates)
    const applyToStock = document.getElementById("opname-apply").checked
    const { error } = await supabase.rpc("submit_month_end", { p_outlet: oid(), p_date: opnameDate, p_apply_to_stock: applyToStock, p_by_name: byName() })
    submitBtn.disabled = false
    if (error) { toast("Gagal submit: " + error.message, "err"); return }
    toast("Opname disubmit" + (applyToStock ? " & stok sistem disesuaikan" : ""), "ok")
    await Promise.all([fetchItems(), fetchLedgerRecent(), fetchMonthEndRecent()])
    renderOpname(el)
  })

  const reopenBtn = document.getElementById("opname-reopen")
  if (reopenBtn) reopenBtn.addEventListener("click", async () => {
    const { error } = await supabase.from("month_end_sessions").update({ status: "DRAFT" }).eq("outlet_id", oid()).eq("entry_date", opnameDate)
    if (error) { toast("Gagal: " + error.message, "err"); return }
    toast("Sesi dibuka kembali", "ok")
    await fetchMonthEndRecent()
    renderOpname(el)
  })
}
function renderOpnameHistoryCard(history) {
  if (!history.length) return ""
  return `<div class="card"><div class="card-head"><div><h3>Riwayat Sesi Opname</h3></div></div>
    <div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Status</th><th class="num">Item Terisi</th><th></th></tr></thead>
    <tbody>${history.map(h => { const filled = (h.items || []).filter(i => i.physicalEnding != null).length
      return `<tr><td>${fmtDateLabel(h.date)}</td><td><span class="pill ${h.status === "SUBMITTED" ? "good" : "warn"}">${h.status === "SUBMITTED" ? "Submitted" : "Draft"}</span></td>
      <td class="num">${filled}/${(h.items || []).length}</td><td><button class="btn sm ghost" data-open-opname="${h.date}">Buka</button></td></tr>` }).join("")}</tbody>
    </table></div></div>`
}

/* ============================== HISTORY ============================== */
let historyTab = "ledger"
let historyDate = todayStr()
let wasteDays = 30
let wasteRows = null
let wasteFetchedFor = null

async function fetchWasteRecent(days) {
  const since = recentDateFrom(days)
  const { data, error } = await supabase.from("ledger_entries")
    .select("entry_date,entry_time,item_id,item_name,qty,unit,reason,note,by_name")
    .eq("outlet_id", oid()).eq("type", "MANUAL_OUT").gte("entry_date", since)
    .order("entry_date", { ascending: false }).order("id", { ascending: false })
  if (error) { toast("Gagal memuat data waste: " + error.message, "err"); return }
  wasteRows = data; wasteFetchedFor = days
}

async function renderHistory(el) {
  await Promise.all([fetchLedgerForDate(historyDate), fetchMenuCountForDate(historyDate)])
  const ledgerDoc = ledgerCache[historyDate]
  const countDoc = menuCountsCache[historyDate]
  const recentDays = Object.keys(ledgerCache).sort().reverse().slice(0, 14).map(date => {
    const entries = ledgerCache[date].entries || []
    return { date, in: entries.filter(e => e.type === "IN").length, out: entries.filter(e => e.type === "MANUAL_OUT").length, auto: entries.filter(e => e.type === "AUTO_OUT").length, adj: entries.filter(e => e.type === "ADJUSTMENT").length }
  })
  if (historyTab === "waste" && (wasteRows === null || wasteFetchedFor !== wasteDays)) await fetchWasteRecent(wasteDays)

  el.innerHTML = `
    <div class="card">
      <div class="history-tabs no-print">
        <button class="history-tab ${historyTab === "ledger" ? "active" : ""}" data-htab="ledger">Log Transaksi</button>
        <button class="history-tab ${historyTab === "menu" ? "active" : ""}" data-htab="menu">Hitungan Menu</button>
        <button class="history-tab ${historyTab === "waste" ? "active" : ""}" data-htab="waste">Waste</button>
        <button class="history-tab ${historyTab === "overview" ? "active" : ""}" data-htab="overview">14 Hari Terakhir</button>
      </div>
      <div class="card-body">
        ${historyTab === "ledger" || historyTab === "menu" ? `<div class="toolbar no-print" style="margin-bottom:14px"><input type="date" id="hist-date" class="input" value="${historyDate}"></div>` : ""}
        ${historyTab === "ledger" ? renderLedgerPanel(ledgerDoc) : ""}
        ${historyTab === "menu" ? renderMenuCountPanel(countDoc) : ""}
        ${historyTab === "waste" ? renderWastePanel() : ""}
        ${historyTab === "overview" ? renderOverviewPanel(recentDays) : ""}
      </div>
    </div>`
  el.querySelectorAll("[data-htab]").forEach(b => b.addEventListener("click", () => { historyTab = b.dataset.htab; renderHistory(el) }))
  el.querySelectorAll("[data-waste-days]").forEach(b => b.addEventListener("click", () => { wasteDays = +b.dataset.wasteDays; renderHistory(el) }))
  const wp = document.getElementById("waste-print")
  if (wp) wp.addEventListener("click", () => window.print())
  const dateInp = document.getElementById("hist-date")
  if (dateInp) dateInp.addEventListener("change", async e => { historyDate = e.target.value; await renderHistory(el) })
}
function renderLedgerPanel(doc) {
  const entries = (doc && doc.entries || []).slice().reverse()
  if (!entries.length) return `<div class="empty-state">Tidak ada transaksi pada ${fmtDateLabel(historyDate)}.</div>`
  return `<div class="table-wrap"><table><thead><tr><th>Jam</th><th>Item</th><th>Tipe</th><th class="num">Qty</th><th>Alasan / Catatan</th><th>Oleh</th></tr></thead>
    <tbody>${entries.map(e => `<tr><td class="mono">${esc(e.time)}</td><td>${esc(e.itemName)}</td>
      <td class="${e.type === "IN" ? "tag-in" : e.type === "MANUAL_OUT" ? "tag-out" : e.type === "ADJUSTMENT" ? "tag-adj" : "tag-auto"}">${e.type === "IN" ? "MASUK" : e.type === "MANUAL_OUT" ? "KELUAR" : e.type === "ADJUSTMENT" ? "PENYESUAIAN" : "AUTO"}</td>
      <td class="num">${e.type === "MANUAL_OUT" ? "−" : e.type === "IN" ? "+" : (e.qty < 0 ? "+" : "−")}${fmtNum(Math.abs(e.qty))} ${esc(e.unit)}</td>
      <td style="color:var(--ink-faint)">${e.reason ? `<span class="pill neutral" style="margin-right:6px">${esc(e.reason)}</span>` : ""}${esc(e.note || "")}</td><td style="color:var(--ink-faint)">${esc(e.by || "")}</td></tr>`).join("")}</tbody></table></div>`
}
function renderMenuCountPanel(doc) {
  if (!doc || !doc.quantities) return `<div class="empty-state">Belum ada hitungan menu pada ${fmtDateLabel(historyDate)}.</div>`
  const rows = Object.keys(doc.quantities).map(id => ({ id, qty: doc.quantities[id], menu: menusById[id] })).filter(r => r.menu && r.qty > 0)
  rows.sort((a, b) => b.qty - a.qty)
  const total = rows.reduce((s, r) => s + r.qty, 0)
  return `<div style="margin-bottom:10px"><span class="pill ${doc.status === "SUBMITTED" ? "good" : "warn"}">${doc.status === "SUBMITTED" ? "Submitted" : "Draft"}</span> <span style="color:var(--ink-faint);font-size:12.5px;margin-left:8px">Total ${total} cup/porsi</span></div>
    ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Menu</th><th>Kategori</th><th class="num">Qty</th></tr></thead>
      <tbody>${rows.map(r => `<tr><td>${esc(r.menu.name)}</td><td style="color:var(--ink-faint);font-size:12.5px">${esc(r.menu.category)}</td><td class="num">${fmtNum(r.qty)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state">Semua qty 0.</div>`}`
}
function renderWastePanel() {
  const rows = wasteRows || []
  const items = itemsById
  const costOf = (id) => (items[id] && items[id].cost) || 0
  const rp = (r) => num(r.qty) * costOf(r.item_id)
  const hasCost = rows.some(r => costOf(r.item_id) > 0)

  const totalRp = rows.reduce((s, r) => s + rp(r), 0)
  const invValue = Object.values(items).reduce((s, i) => s + i.stock * i.cost, 0)
  const pctInv = invValue > 0 ? totalRp / invValue * 100 : null

  const byReason = {}
  rows.forEach(r => { const k = r.reason || "Tanpa alasan"; const b = byReason[k] || (byReason[k] = { n: 0, rp: 0 }); b.n++; b.rp += rp(r) })
  const reasonList = Object.entries(byReason).map(([k, v]) => ({ k, ...v })).sort((a, b) => hasCost ? b.rp - a.rp : b.n - a.n)
  const reasonMax = Math.max(1, ...reasonList.map(r => hasCost ? r.rp : r.n))

  const byItem = {}
  rows.forEach(r => { const b = byItem[r.item_id] || (byItem[r.item_id] = { name: r.item_name, unit: r.unit, n: 0, qty: 0, rp: 0 }); b.n++; b.qty += num(r.qty); b.rp += rp(r) })
  const itemList = Object.values(byItem).sort((a, b) => hasCost ? b.rp - a.rp : b.qty - a.qty).slice(0, 10)

  const daysBtn = (d, lbl) => `<button class="btn sm ${wasteDays === d ? "primary" : "ghost"}" data-waste-days="${d}" type="button">${lbl}</button>`

  return `
    <div class="print-head"><h2>${esc(outletName())}</h2><div class="sub">Laporan Waste — ${wasteDays} hari terakhir · dicetak ${fmtDateLabel(todayStr())} · ARMEND</div></div>
    <div class="toolbar no-print" style="margin-bottom:16px">
      ${daysBtn(7, "7 hari")}${daysBtn(30, "30 hari")}${daysBtn(90, "90 hari")}
      <button class="btn ghost sm" id="waste-print" type="button" style="margin-left:auto">Ekspor PDF</button>
    </div>
    <div class="move-row" style="margin-bottom:20px">
      <div class="m"><div class="lbl">Total waste</div><div class="v tag-out">${hasCost ? fmtRp(totalRp) : rows.length + " kejadian"}</div></div>
      <div class="m"><div class="lbl">Kejadian</div><div class="v">${rows.length}</div></div>
      ${hasCost && pctInv != null ? `<div class="m"><div class="lbl">% nilai inventory</div><div class="v">${fmtNum(round2(pctInv))}%</div></div>` : ""}
    </div>
    ${rows.length ? `
    <h3 style="font-size:14px;margin-bottom:8px">Per Alasan</h3>
    <div class="table-wrap" style="margin-bottom:22px"><table>
      <thead><tr><th>Alasan</th><th class="num">Kejadian</th><th class="num">${hasCost ? "Nilai" : ""}</th><th></th></tr></thead>
      <tbody>${reasonList.map(r => `<tr>
        <td>${esc(r.k)}</td><td class="num">${r.n}</td><td class="num">${hasCost ? fmtRp(r.rp) : "–"}</td>
        <td style="width:36%"><div style="height:8px;border-radius:4px;background:var(--surface-2)"><div style="height:8px;border-radius:4px;background:var(--critical);width:${((hasCost ? r.rp : r.n) / reasonMax * 100).toFixed(0)}%"></div></div></td>
      </tr>`).join("")}</tbody>
    </table></div>
    <h3 style="font-size:14px;margin-bottom:8px">Item Paling Boros</h3>
    <div class="table-wrap" style="margin-bottom:22px"><table>
      <thead><tr><th>Item</th><th class="num">Kejadian</th><th class="num">Total qty</th><th class="num">${hasCost ? "Nilai" : ""}</th></tr></thead>
      <tbody>${itemList.map(i => `<tr><td>${esc(i.name)}</td><td class="num">${i.n}</td><td class="num">${fmtNum(round2(i.qty))} ${esc(i.unit)}</td><td class="num">${hasCost ? fmtRp(i.rp) : "–"}</td></tr>`).join("")}</tbody>
    </table></div>
    <h3 style="font-size:14px;margin-bottom:8px">Semua Kejadian</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>Tanggal</th><th>Item</th><th class="num">Qty</th><th>Alasan</th><th>Catatan</th><th>Oleh</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td style="white-space:nowrap;color:var(--ink-faint);font-size:12px">${fmtDateLabel(r.entry_date)} · ${esc(r.entry_time)}</td>
        <td>${esc(r.item_name)}</td>
        <td class="num tag-out">−${fmtNum(num(r.qty))} ${esc(r.unit)}</td>
        <td>${r.reason ? `<span class="pill neutral">${esc(r.reason)}</span>` : "–"}</td>
        <td style="color:var(--ink-faint)">${esc(r.note || "")}</td>
        <td style="color:var(--ink-faint)">${esc(r.by_name || "")}</td>
      </tr>`).join("")}</tbody>
    </table></div>`
    : `<div class="empty-state">Belum ada waste tercatat dalam ${wasteDays} hari terakhir.</div>`}`
}
function renderOverviewPanel(recentDays) {
  if (!recentDays.length) return `<div class="empty-state">Belum ada data.</div>`
  return `<div class="table-wrap"><table><thead><tr><th>Tanggal</th><th class="num">Masuk</th><th class="num">Keluar</th><th class="num">Auto</th><th class="num">Penyesuaian</th></tr></thead>
    <tbody>${recentDays.map(d => `<tr><td>${fmtDateLabel(d.date)}</td><td class="num tag-in">${d.in}</td><td class="num tag-out">${d.out}</td><td class="num tag-auto">${d.auto}</td><td class="num tag-adj">${d.adj}</td></tr>`).join("")}</tbody></table></div>`
}

/* ============================== DAILY STOCK ============================== */
let dailyDate = todayStr()
let dailySearch = ""
let dailyCat = "ALL"
let dailyLedgerRows = null
let dailyFetchedFrom = null

async function fetchDailyLedger(fromDate) {
  const { data, error } = await supabase.from("ledger_entries")
    .select("entry_date,type,item_id,qty,reason").eq("outlet_id", oid()).gte("entry_date", fromDate)
  if (error) { console.error(error); toast("Gagal memuat data harian: " + error.message, "err"); return }
  dailyLedgerRows = data
  dailyFetchedFrom = fromDate
}

async function renderDaily(el) {
  if (dailyLedgerRows === null || dailyDate < dailyFetchedFrom) {
    el.innerHTML = `<div class="card"><div class="empty-state">Memuat data stok harian…</div></div>`
    await fetchDailyLedger(dailyDate)
  }
  const items = Object.values(itemsById)
  if (!items.length) { el.innerHTML = emptyOrLoading(`Area "${outletName()}" belum punya item. Buka Master Data untuk menambahkan.`); return }
  const D = dailyDate

  const after = {}, dIn = {}, dAuto = {}, dMan = {}, dWaste = {}, dAdj = {}
  for (const r of (dailyLedgerRows || [])) {
    const q = num(r.qty)
    if (r.entry_date > D) {
      const delta = r.type === "IN" || r.type === "ADJUSTMENT" ? q : -q
      after[r.item_id] = (after[r.item_id] || 0) + delta
      continue
    }
    if (r.entry_date !== D) continue
    if (r.type === "IN") dIn[r.item_id] = (dIn[r.item_id] || 0) + q
    else if (r.type === "AUTO_OUT") dAuto[r.item_id] = (dAuto[r.item_id] || 0) + q
    else if (r.type === "MANUAL_OUT") { if (r.reason) dWaste[r.item_id] = (dWaste[r.item_id] || 0) + q; else dMan[r.item_id] = (dMan[r.item_id] || 0) + q }
    else if (r.type === "ADJUSTMENT") dAdj[r.item_id] = (dAdj[r.item_id] || 0) + q
  }

  const rowFor = (i) => {
    const closing = round2(i.stock - (after[i.id] || 0))
    const inn = round2(dIn[i.id] || 0)
    const ao = round2(dAuto[i.id] || 0)
    const mo = round2(dMan[i.id] || 0)
    const ws = round2(dWaste[i.id] || 0)
    const adj = round2(dAdj[i.id] || 0)
    const opening = round2(closing - inn + ao + mo + ws - adj)
    return { opening, inn, ao, mo, ws, adj, totalOut: round2(ao + mo + ws), closing }
  }

  const q = dailySearch.trim().toLowerCase()
  const list = items.filter(i => {
    if (dailyCat !== "ALL" && i.category !== dailyCat) return false
    if (q && !i.name.toLowerCase().includes(q)) return false
    return true
  }).sort(sortItems)
  const grouped = {}
  list.forEach(i => { (grouped[i.category] = grouped[i.category] || []).push(i) })
  const cats = itemCats().filter(c => grouped[c])

  // items whose usage comes from menu counts (recipe-linked, minus "HPP saja")
  const autoItems = new Set()
  Object.values(recipesByMenu).forEach(rl => (rl || []).forEach(ing => {
    const it = itemsById[ing.itemId]
    if (it && it.itemType === "PREP") {
      const sink = {}; explodeItem(ing.itemId, 1, sink)
      Object.keys(sink).forEach(id => { const c = itemsById[id]; if (!c || !c.hppOnly) autoItems.add(id) })
    } else if (it && !it.hppOnly) autoItems.add(ing.itemId)
  }))

  let sumIn = 0, sumOut = 0, movedItems = 0
  list.forEach(i => {
    const mv = (dIn[i.id] || 0) + (dAuto[i.id] || 0) + (dMan[i.id] || 0) + (dWaste[i.id] || 0) + Math.abs(dAdj[i.id] || 0)
    if (mv > 0) movedItems++
    sumIn += (dIn[i.id] || 0); sumOut += (dAuto[i.id] || 0) + (dMan[i.id] || 0) + (dWaste[i.id] || 0)
  })

  el.innerHTML = `
    <div class="print-head">
      <h2>${esc(outletName())}</h2>
      <div class="sub">Stok Harian — ${fmtDateLabel(D)} · dicetak ${fmtDateLabel(todayStr())} · ARMEND</div>
    </div>
    <div class="card">
      <div class="card-head">
        <div><h3>Stok Harian</h3><div class="desc">Ketik langsung di kolom <b>Masuk</b> / <b>Manual Out</b> — angkanya jadi total hari itu. <b>Auto Out</b> otomatis dari hitung menu.</div></div>
        <div class="toolbar no-print">
          <button class="btn" id="daily-receive" type="button">+ Terima Kiriman</button>
          <button class="btn" id="daily-waste" type="button">+ Catat Waste</button>
          <button class="btn ghost" id="daily-print" type="button">Ekspor PDF</button>
        </div>
      </div>
      <div class="card-body no-print" style="display:flex;gap:12px 22px;flex-wrap:wrap;align-items:center;border-bottom:1px solid var(--border)">
        <input type="date" id="daily-date" class="input" value="${D}" max="${todayStr()}">
        <input class="input search" id="daily-search" placeholder="Cari item…" value="${esc(dailySearch)}">
        <select class="select" id="daily-cat"><option value="ALL">Semua Kategori</option>${itemCats().map(c => `<option value="${esc(c)}" ${dailyCat === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>
        <span id="daily-summary" style="font-size:12.5px;color:var(--ink-dim);margin-left:auto">Item bergerak <strong>${movedItems}</strong> · masuk <strong class="tag-in">+${fmtNum(round2(sumIn))}</strong> · keluar <strong class="tag-out">−${fmtNum(round2(sumOut))}</strong></span>
      </div>
      <div class="table-wrap sticky-head"><table>
        <thead><tr>
          <th>Item</th><th>Unit</th>
          <th class="num">Stok Awal</th><th class="num">Masuk</th>
          <th class="num">Auto Out</th><th class="num">Manual Out</th><th class="num">Waste</th>
          <th class="num">Total Keluar</th><th class="num">Penyesuaian</th>
          <th class="num">Sisa</th>
        </tr></thead>
        <tbody>${cats.map(cat => `
          <tr class="cat-row"><td colspan="10">${esc(cat)}</td></tr>
          ${grouped[cat].map(i => { const r = rowFor(i); const habis = i.stockTracking && r.closing <= 0
            return `<tr data-drow="${i.id}"${autoItems.has(i.id) ? ' class="drow-auto"' : ""}>
              <td>${esc(i.name)}${autoItems.has(i.id) ? ' <span class="pill auto" title="Pemakaian otomatis dari hitung menu terjual">auto</span>' : ""}${i.hppOnly ? ' <span class="pill neutral">HPP saja</span>' : ""}</td><td>${esc(i.unit)}</td>
              <td class="num" data-c="open">${fmtNum(r.opening)}</td>
              <td class="num"><input class="daily-input" type="number" step="any" inputmode="decimal" data-move="IN" data-item="${i.id}" value="${r.inn || ""}" placeholder="0"></td>
              <td class="num ${r.ao ? "tag-auto" : ""}">${r.ao ? "−" + fmtNum(r.ao) : "–"}</td>
              <td class="num"><input class="daily-input" type="number" step="any" inputmode="decimal" data-move="MANUAL_OUT" data-item="${i.id}" value="${r.mo || ""}" placeholder="0"></td>
              <td class="num ${r.ws ? "tag-out" : ""}" data-c="waste">${r.ws ? "−" + fmtNum(r.ws) : "–"}</td>
              <td class="num" data-c="tot">${r.totalOut ? "−" + fmtNum(r.totalOut) : "–"}</td>
              <td class="num ${r.adj ? (r.adj < 0 ? "tag-out" : "tag-in") : ""}">${r.adj ? (r.adj > 0 ? "+" : "−") + fmtNum(Math.abs(r.adj)) : "–"}</td>
              <td class="num ${habis ? "variance-neg" : ""}" data-c="sisa">${fmtNum(r.closing)}</td>
            </tr>` }).join("")}`).join("") || `<tr><td colspan="10" class="empty-state">Tidak ada item cocok.</td></tr>`}
        </tbody>
      </table></div>
    </div>`

  document.getElementById("daily-date").addEventListener("change", e => { dailyDate = e.target.value; renderDaily(el) })
  document.getElementById("daily-cat").addEventListener("change", e => { dailyCat = e.target.value; renderDaily(el) })
  document.getElementById("daily-print").addEventListener("click", () => window.print())
  document.getElementById("daily-receive").addEventListener("click", () => bulkReceiveModal(D))
  document.getElementById("daily-waste").addEventListener("click", () => wasteModal(D))
  const s = document.getElementById("daily-search")
  s.addEventListener("input", e => {
    dailySearch = e.target.value
    renderDaily(el).then(() => { const n = document.getElementById("daily-search"); if (n) { n.focus(); n.selectionStart = n.value.length } })
  })
  el.querySelectorAll(".daily-input").forEach(inp => {
    inp.addEventListener("focus", () => inp.select())
    inp.addEventListener("change", () => commitDailyInput(inp, el, D))
  })
}

async function commitDailyInput(inp, el, D) {
  const itemId = inp.dataset.item, type = inp.dataset.move
  const raw = inp.value.trim()
  const val = raw === "" ? 0 : parseFloat(inp.value)
  if (raw !== "" && (isNaN(val) || val < 0)) { toast("Angka tidak valid", "err"); return }

  inp.disabled = true
  const { error } = await supabase.rpc("set_daily_move", {
    p_outlet: oid(), p_date: D, p_item_id: itemId, p_type: type,
    p_qty: val, p_note: "input harian", p_by_name: byName(),
  })
  inp.disabled = false
  if (error) {
    toast(/set_daily_move|does not exist|schema cache/i.test(error.message)
      ? "Fungsi set_daily_move belum ada — jalankan migrasi SQL dulu"
      : "Gagal: " + error.message, "err")
    return
  }
  afterLocalWrite()

  // patch local state so we don't rebuild the whole table
  // (for MANUAL_OUT the cell only owns non-waste entries; waste rows have a reason)
  const it = itemsById[itemId]
  const owns = (r) => r.entry_date === D && r.item_id === itemId && r.type === type && (type !== "MANUAL_OUT" || !r.reason)
  const oldSum = (dailyLedgerRows || []).filter(owns).reduce((s, r) => s + num(r.qty), 0)
  const deltaStock = type === "IN" ? (val - oldSum) : (oldSum - val)
  if (it) it.stock = round2(it.stock + deltaStock)
  dailyLedgerRows = (dailyLedgerRows || []).filter(r => !owns(r))
  if (val > 0) dailyLedgerRows.push({ entry_date: D, item_id: itemId, type, qty: val, reason: null })

  patchDailyRow(el, itemId, D)
  inp.classList.add("saved"); setTimeout(() => inp.classList.remove("saved"), 900)
}

function patchDailyRow(el, itemId, D) {
  const it = itemsById[itemId]; if (!it) return
  let after = 0, inn = 0, ao = 0, mo = 0, ws = 0, adj = 0
  for (const r of (dailyLedgerRows || [])) {
    if (r.item_id !== itemId) continue
    const q = num(r.qty)
    if (r.entry_date > D) { after += (r.type === "IN" || r.type === "ADJUSTMENT" ? q : -q); continue }
    if (r.entry_date !== D) continue
    if (r.type === "IN") inn += q
    else if (r.type === "AUTO_OUT") ao += q
    else if (r.type === "MANUAL_OUT") { if (r.reason) ws += q; else mo += q }
    else if (r.type === "ADJUSTMENT") adj += q
  }
  const closing = round2(it.stock - after)
  const opening = round2(closing - inn + ao + mo + ws - adj)
  const totalOut = round2(ao + mo + ws)
  const tr = el.querySelector(`tr[data-drow="${itemId}"]`)
  if (tr) {
    const open = tr.querySelector('[data-c="open"]'); if (open) open.textContent = fmtNum(opening)
    const wst = tr.querySelector('[data-c="waste"]'); if (wst) { wst.textContent = ws ? "−" + fmtNum(ws) : "–"; wst.className = "num" + (ws ? " tag-out" : "") }
    const tot = tr.querySelector('[data-c="tot"]'); if (tot) tot.textContent = totalOut ? "−" + fmtNum(totalOut) : "–"
    const sisa = tr.querySelector('[data-c="sisa"]')
    if (sisa) { sisa.textContent = fmtNum(closing); sisa.className = "num" + (it.stockTracking && closing <= 0 ? " variance-neg" : "") }
  }
  let sumIn = 0, sumOut = 0; const moved = new Set()
  for (const r of (dailyLedgerRows || [])) {
    if (r.entry_date !== D) continue
    const q = num(r.qty)
    if (r.type === "IN") { sumIn += q; if (q) moved.add(r.item_id) }
    else if (r.type === "AUTO_OUT" || r.type === "MANUAL_OUT") { sumOut += q; if (q) moved.add(r.item_id) }
    else if (r.type === "ADJUSTMENT" && q) moved.add(r.item_id)
  }
  const span = el.querySelector("#daily-summary")
  if (span) span.innerHTML = `Item bergerak <strong>${moved.size}</strong> · masuk <strong class="tag-in">+${fmtNum(round2(sumIn))}</strong> · keluar <strong class="tag-out">−${fmtNum(round2(sumOut))}</strong>`
}

/* ============================== USERS (outlet admin) ============================== */
async function fetchOutletMembers() {
  const g = currentGroup()
  const ids = [oid(), g && g.id].filter(Boolean)
  const { data, error } = await supabase.from("outlet_members")
    .select("role, user_id, outlet_id, profiles(id,name,email,role)").in("outlet_id", ids)
  if (error) { console.error(error); return [] }
  const byUser = {}
  ;(data || []).forEach(m => {
    const scope = g && m.outlet_id === g.id ? "group" : "area"
    const row = {
      id: m.user_id, role: m.role, scope,
      name: (m.profiles && m.profiles.name) || "?", email: (m.profiles && m.profiles.email) || "",
      globalRole: (m.profiles && m.profiles.role) || "staff",
    }
    if (!byUser[m.user_id] || scope === "group") byUser[m.user_id] = row  // grup mengalahkan area
  })
  return Object.values(byUser).sort((a, b) => a.name.localeCompare(b.name))
}

async function renderUsers(el) {
  if (!isAdmin()) { el.innerHTML = `<div class="card"><div class="empty-state">Halaman ini khusus admin outlet ke atas.</div></div>`; return }
  el.innerHTML = `<div class="card"><div class="card-body"><div class="empty-state">Memuat anggota…</div></div></div>`
  const members = await fetchOutletMembers()
  const g = currentGroup()
  const oRoles = [["staff", "Staff"], ["supervisor", "Supervisor"], ["admin", "Admin"]]
  el.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div><h3>Pengguna — ${esc(outletName())}</h3><div class="desc">Anggota & peran di outlet ini</div></div>
        <div class="toolbar"><button class="btn ghost" id="usr-existing" type="button">+ Tambah Anggota</button><button class="btn primary" id="usr-add" type="button">+ Undang Staff</button></div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Nama</th><th>Email</th><th>Peran</th><th>Akses</th>${isOwner() ? "<th>Global</th>" : ""}<th></th></tr></thead>
        <tbody>${members.map(p => { const isSelf = p.id === session.user.id; const mgr = p.globalRole !== "staff"
          return `<tr>
          <td>${esc(p.name)}${isSelf ? ' <span class="pill neutral">Kamu</span>' : ""}</td>
          <td style="color:var(--ink-faint)">${esc(p.email)}</td>
          <td>${mgr ? `<span class="pill gold">${p.globalRole === "admin" ? "Owner" : "Manajer"}</span>` : `<div class="role-toggle">${oRoles.map(([v, l]) => `<button data-role-btn="${p.id}" data-role="${v}" class="${p.role === v ? "active" : ""}">${l}</button>`).join("")}</div>`}</td>
          <td>${mgr || !g ? '<span style="color:var(--ink-faint)">semua outlet</span>' : `<div class="role-toggle">
            <button data-scope-btn="${p.id}" data-scope="area" class="${p.scope === "area" ? "active" : ""}">Area ini</button>
            <button data-scope-btn="${p.id}" data-scope="group" class="${p.scope === "group" ? "active" : ""}"${isManager() ? "" : " disabled"}>Semua ${esc(g.name)}</button>
          </div>`}</td>
          ${isOwner() ? `<td><div class="role-toggle">
            <button data-grole-btn="${p.id}" data-grole="staff" class="${p.globalRole === "staff" ? "active" : ""}">—</button>
            <button data-grole-btn="${p.id}" data-grole="manager" class="${p.globalRole === "manager" ? "active" : ""}">Manajer</button>
            ${isSelf ? "" : `<button data-grole-btn="${p.id}" data-grole="admin" class="${p.globalRole === "admin" ? "active" : ""}">Owner</button>`}
          </div></td>` : ""}
          <td style="text-align:right;white-space:nowrap">
            <button class="btn sm ghost" data-usr-pw="${p.id}" data-usr-name="${esc(p.name)}" type="button">Reset Password</button>
            ${isSelf ? "" : `<button class="btn sm ghost" data-usr-remove="${p.id}" data-usr-name="${esc(p.name)}" type="button">Keluarkan</button>`}
            ${isSelf || !isOwner() ? "" : `<button class="btn sm danger" data-usr-del="${p.id}" data-usr-name="${esc(p.name)}" type="button">Hapus akun</button>`}
          </td>
        </tr>` }).join("") || `<tr><td colspan="7" class="empty-state">Belum ada anggota.</td></tr>`}</tbody>
      </table></div>
      <div class="card-body" style="border-top:1px solid var(--border);font-size:12px;color:var(--ink-faint);line-height:1.7">
        <b>Staff</b> input harian · <b>Supervisor</b> + opname, riwayat, dashboard · <b>Admin</b> + master data & anggota${isOwner() ? " · <b>Manajer</b> = admin semua outlet · <b>Owner</b> = + bikin/hapus outlet" : ""}${g ? `<br><b>Akses “Semua ${esc(g.name)}”</b> = anggota ini bisa buka semua area di bawah ${esc(g.name)} (Bar, Kitchen, Service, …) dengan peran yang sama.` : ""}
      </div>
    </div>`
  el.querySelectorAll("[data-role-btn]").forEach(btn => btn.addEventListener("click", async () => {
    const m = members.find(x => x.id === btn.dataset.roleBtn)
    const target = m && m.scope === "group" && g ? g.id : oid()
    const { error } = await supabase.from("outlet_members").update({ role: btn.dataset.role }).eq("outlet_id", target).eq("user_id", btn.dataset.roleBtn)
    if (error) { toast("Gagal: " + error.message, "err"); return }
    toast("Peran diperbarui", "ok"); renderUsers(el)
  }))
  el.querySelectorAll("[data-scope-btn]").forEach(btn => btn.addEventListener("click", async () => {
    if (btn.hasAttribute("disabled")) return
    const uid = btn.dataset.scopeBtn, target = btn.dataset.scope
    const m = members.find(x => x.id === uid); if (!m || m.scope === target || !g) return
    if (target === "area" && !confirm(`Batasi "${m.name}" ke ${currentArea().name} saja?\nDia akan kehilangan akses ke area lain di ${g.name}.`)) return
    const fromId = m.scope === "group" ? g.id : oid()
    const toId = target === "group" ? g.id : oid()
    const up = await supabase.from("outlet_members").upsert({ outlet_id: toId, user_id: uid, role: m.role }, { onConflict: "outlet_id,user_id" })
    if (up.error) { toast("Gagal: " + up.error.message, "err"); return }
    const { error } = await supabase.from("outlet_members").delete().eq("outlet_id", fromId).eq("user_id", uid)
    if (error) { toast("Gagal: " + error.message, "err"); return }
    toast("Akses diperbarui", "ok"); renderUsers(el)
  }))
  el.querySelectorAll("[data-usr-remove]").forEach(b => b.addEventListener("click", async () => {
    const m = members.find(x => x.id === b.dataset.usrRemove)
    const grp = !!(m && m.scope === "group" && g)
    if (!confirm(`Keluarkan "${b.dataset.usrName}" dari ${grp ? "semua area " + g.name : outletName()}?\nAkunnya tidak dihapus — cuma kehilangan akses.`)) return
    const { error } = await supabase.from("outlet_members").delete().eq("outlet_id", grp ? g.id : oid()).eq("user_id", b.dataset.usrRemove)
    if (error) { toast("Gagal: " + error.message, "err"); return }
    toast("Dikeluarkan", "ok"); renderUsers(el)
  }))
  el.querySelectorAll("[data-grole-btn]").forEach(btn => btn.addEventListener("click", async () => {
    const gr = btn.dataset.grole
    if (gr === "admin" && !confirm("Jadikan Owner? Owner bisa hapus outlet & akun. Tidak bisa dibatalkan sendiri.")) return
    const { error } = await supabase.from("profiles").update({ role: gr }).eq("id", btn.dataset.groleBtn)
    if (error) { toast("Gagal: " + error.message, "err"); return }
    toast("Peran global diperbarui", "ok"); renderUsers(el)
  }))
  document.getElementById("usr-add").addEventListener("click", () => staffModal(el))
  document.getElementById("usr-existing").addEventListener("click", () => addMemberModal(el))
  el.querySelectorAll("[data-usr-pw]").forEach(b => b.addEventListener("click", () => staffPasswordModal(el, b.dataset.usrPw, b.dataset.usrName)))
  el.querySelectorAll("[data-usr-del]").forEach(b => b.addEventListener("click", () => staffDelete(el, b.dataset.usrDel, b.dataset.usrName)))
}

function addMemberModal(el) {
  const g = currentGroup()
  openModal({
    title: "Tambah Anggota",
    saveLabel: "Tambah",
    bodyHtml: `
      <div class="field"><label class="field-label">Email pengguna (yang sudah punya akun ARMEND)</label><input class="input" type="email" id="am-email" placeholder="orang@contoh.com"></div>
      <div class="field" style="margin-top:12px"><label class="field-label">Peran</label><select class="select" id="am-role"><option value="staff">Staff</option><option value="supervisor">Supervisor</option><option value="admin">Admin</option></select></div>
      ${g && isManager() ? `<div class="field" style="margin-top:12px"><label class="field-label">Akses</label><select class="select" id="am-scope"><option value="area">Hanya ${esc(currentArea().name)}</option><option value="group">Semua area ${esc(g.name)}</option></select></div>` : ""}`,
    onSave: async () => {
      const email = document.getElementById("am-email").value.trim().toLowerCase()
      const role = document.getElementById("am-role").value
      const scopeEl = document.getElementById("am-scope")
      const target = scopeEl && scopeEl.value === "group" && g ? g.id : oid()
      if (!email) { toast("Email wajib diisi", "err"); return false }
      // no edge function needed — the caller is an outlet admin, RLS allows the insert
      const { data: p } = await supabase.from("profiles").select("id, name").eq("email", email).maybeSingle()
      if (!p) { toast("Belum ada akun dengan email itu. Pakai Undang Staff untuk buat baru.", "err"); return false }
      const { error } = await supabase.from("outlet_members").upsert({ outlet_id: target, user_id: p.id, role }, { onConflict: "outlet_id,user_id" })
      if (error) { toast("Gagal: " + error.message, "err"); return false }
      toast(`${p.name || email} ditambahkan`, "ok"); renderUsers(el)
    },
  })
}

async function callManageStaff(payload) {
  const { data, error } = await supabase.functions.invoke("manage-staff", { body: payload })
  if (error) {
    let msg = error.message || "gagal"
    try { const b = await error.context.json(); if (b && b.error) msg = b.error } catch (_) {}
    if (/not found|404|Failed to send/i.test(msg)) msg = "Edge function 'manage-staff' belum di-deploy (lihat supabase/functions/README.md)"
    return { error: msg }
  }
  if (data && data.error) return { error: data.error }
  return { data }
}

function staffModal(el) {
  openModal({
    title: "Undang Staff",
    saveLabel: "Buat Akun",
    bodyHtml: `
      <div class="modal-grid">
        <div class="field span2"><label class="field-label">Nama</label><input class="input" id="s-name" placeholder="Nama staff"></div>
        <div class="field span2"><label class="field-label">Email</label><input class="input" type="email" id="s-email" placeholder="staff@contoh.com"></div>
        <div class="field"><label class="field-label">Password awal</label><input class="input" id="s-pass" placeholder="min. 6 karakter"></div>
        <div class="field"><label class="field-label">Peran</label><select class="select" id="s-role"><option value="staff">Staff</option><option value="supervisor">Supervisor</option><option value="admin">Admin</option></select></div>
        ${currentGroup() && isManager() ? `<div class="field span2"><label class="field-label">Akses</label><select class="select" id="s-scope"><option value="area">Hanya ${esc(currentArea().name)}</option><option value="group">Semua area ${esc(currentGroup().name)}</option></select></div>` : ""}
      </div>
      <div class="modal-note">Staff login pakai email + password ini. Sampaikan langsung ke orangnya — password tidak ditampilkan lagi.</div>`,
    onSave: async () => {
      const name = document.getElementById("s-name").value.trim()
      const email = document.getElementById("s-email").value.trim()
      const password = document.getElementById("s-pass").value
      const role = document.getElementById("s-role").value
      const sScope = document.getElementById("s-scope")
      const target = sScope && sScope.value === "group" && currentGroup() ? currentGroup().id : oid()
      if (!email || !password) { toast("Email & password wajib diisi", "err"); return false }
      if (password.length < 6) { toast("Password minimal 6 karakter", "err"); return false }
      const { error } = await callManageStaff({ action: "create", name, email, password, role, outlet_id: target })
      if (error) {
        toast("Undang otomatis gagal: " + error, "err")
        openModal({
          title: "Buat akun manual",
          saveLabel: "Sudah",
          bodyHtml: `<div class="modal-note" style="margin-top:0">Fitur otomatis butuh edge function <code>manage-staff</code> yang jalan. Sementara, buat akun lewat Supabase:</div>
            <ol style="font-size:13px;line-height:1.7;padding-left:18px;margin:12px 0">
              <li>Supabase → <b>Authentication → Users → Add user</b><br>email <code>${esc(email)}</code>, password, centang <b>Auto Confirm</b></li>
              <li>Balik ke sini → <b>+ Tambah Anggota</b> → masukkan <code>${esc(email)}</code> → pilih peran</li>
            </ol>`,
          onSave: async () => { renderUsers(el) },
        })
        return false
      }
      toast(`Akun dibuat & ditambahkan ke ${outletName()}`, "ok")
      renderUsers(el)
    },
  })
}

function staffPasswordModal(el, id, name) {
  openModal({
    title: "Reset Password",
    saveLabel: "Simpan Password",
    bodyHtml: `
      <div class="modal-note" style="margin-top:0">Password baru untuk <b>${esc(name)}</b>.</div>
      <div class="field" style="margin-top:12px"><label class="field-label">Password baru</label><input class="input" id="s-newpass" placeholder="min. 6 karakter"></div>`,
    onSave: async () => {
      const password = document.getElementById("s-newpass").value
      if (password.length < 6) { toast("Password minimal 6 karakter", "err"); return false }
      const { error } = await callManageStaff({ action: "set_password", id, password, outlet_id: oid() })
      if (error) { toast("Gagal: " + error, "err"); return false }
      toast("Password diperbarui", "ok")
    },
  })
}

async function staffDelete(el, id, name) {
  if (!confirm(`Hapus akun "${name}"?\nAkun & login-nya hilang permanen. Data transaksi yang sudah dicatat tetap ada.`)) return
  const { error } = await callManageStaff({ action: "delete", id, outlet_id: oid() })
  if (error) { toast("Gagal: " + error, "err"); return }
  toast("Akun dihapus", "ok")
  renderUsers(el)
}

/* ============================== MODAL ============================== */
function closeModal() { const e = document.getElementById("modal-overlay"); if (e) { e.remove(); document.removeEventListener("keydown", e._esc) } }
function openModal({ title, bodyHtml, saveLabel, onSave }) {
  closeModal()
  const ov = document.createElement("div")
  ov.className = "modal-overlay"
  ov.id = "modal-overlay"
  ov.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-head"><h3>${esc(title)}</h3><button class="modal-x" id="modal-x" aria-label="Tutup">&times;</button></div>
      <div class="modal-body">${bodyHtml}</div>
      <div class="modal-foot">
        <button class="btn ghost" id="modal-cancel" type="button">Batal</button>
        <button class="btn primary" id="modal-save" type="button">${esc(saveLabel || "Simpan")}</button>
      </div>
    </div>`
  document.body.appendChild(ov)
  ov._esc = (e) => { if (e.key === "Escape") closeModal() }
  document.addEventListener("keydown", ov._esc)
  ov.addEventListener("mousedown", (e) => { if (e.target === ov) closeModal() })
  document.getElementById("modal-x").onclick = closeModal
  document.getElementById("modal-cancel").onclick = closeModal
  document.getElementById("modal-save").onclick = async () => {
    const btn = document.getElementById("modal-save")
    btn.disabled = true
    try { const res = await onSave(); if (res !== false) closeModal() }
    catch (err) { toast("Gagal: " + (err.message || err), "err") }
    finally { const b = document.getElementById("modal-save"); if (b) b.disabled = false }
  }
  const first = ov.querySelector("input,select,textarea")
  if (first) first.focus()
}

/* ============================== TERIMA KIRIMAN (bulk stock-in) ============================== */
function bulkReceiveModal(defaultDate) { stockBatchModal("receive", defaultDate) }
function wasteModal(defaultDate) { stockBatchModal("waste", defaultDate) }

/* Shared multi-row stock form. mode = "receive" (Stok Masuk) | "waste" (Manual Out + alasan). */
function stockBatchModal(mode, defaultDate) {
  const waste = mode === "waste"
  let rows = [{ itemId: null, qty: 0, _raw: "" }]
  const dflt = esc(defaultDate || todayStr())

  const paint = () => {
    const wrap = document.getElementById("bulk-wrap")
    if (!wrap) return
    wrap.innerHTML = `
      <div class="modal-grid" style="margin-bottom:12px">
        <div class="field"><label class="field-label">Tanggal</label><input type="date" id="bulk-date" class="input" value="${dflt}" max="${todayStr()}"></div>
        ${waste
          ? `<div class="field"><label class="field-label">Alasan</label><select class="select" id="bulk-reason">${WASTE_REASONS.map(r => `<option>${r}</option>`).join("")}</select></div>`
          : `<div class="field"><label class="field-label">Catatan (semua baris)</label><input id="bulk-note" class="input" placeholder="mis. dari Supplier X"></div>`}
        ${waste ? `<div class="field span2"><label class="field-label">Catatan (opsional)</label><input id="bulk-note" class="input" placeholder="mis. gelas jatuh saat closing"></div>` : ""}
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Item</th><th class="num">Qty</th><th>Unit</th><th></th></tr></thead>
        <tbody>${rows.map((r, idx) => {
          const it = itemsById[r.itemId]
          const canBuy = !waste && it && it.purchaseUnit && it.packSize > 0
          const unitCell = canBuy
            ? `<select class="input" data-b-usebuy="${idx}" style="padding:5px 7px"><option value="0">${esc(it.unit)}</option><option value="1" ${r.useBuy ? "selected" : ""}>${esc(it.purchaseUnit)} (×${fmtNum(it.packSize)})</option></select>`
            : `<span style="color:var(--ink-faint)" data-b-unit="${idx}">${it ? esc(it.unit) : "–"}</span>`
          return `<tr>
            <td><input class="input" list="recipe-item-list" data-b-name="${idx}" value="${esc(it ? it.name : (r._raw || ""))}" placeholder="Ketik nama item…" style="min-width:200px"></td>
            <td class="num"><input class="input" type="number" step="any" data-b-qty="${idx}" value="${r.qty || ""}" style="width:88px;text-align:right"></td>
            <td>${unitCell}</td>
            <td><button class="btn sm danger" data-b-del="${idx}" type="button">✕</button></td>
          </tr>`
        }).join("")}</tbody>
      </table></div>
      ${itemDatalistHtml()}
      <button class="btn ghost" id="bulk-add" type="button" style="margin-top:10px">+ Tambah baris</button>
      <div class="modal-note">${waste
        ? "Tiap baris dicatat sebagai stok keluar (waste) dengan alasan di atas."
        : 'Tiap baris dicatat sebagai satu transaksi "Stok Masuk".'} Kalau ada yang gagal, baris yang berhasil tetap tersimpan.</div>`
    wrap.querySelectorAll("[data-b-name]").forEach(inp => {
      inp.addEventListener("input", () => {
        const i = +inp.dataset.bName, it = findItemByExactName(inp.value)
        rows[i]._raw = inp.value; rows[i].itemId = it ? it.id : null
        const u = wrap.querySelector(`[data-b-unit="${i}"]`); if (u) u.textContent = it ? it.unit : "–"
      })
      inp.addEventListener("change", () => { if (!waste) repaint() })  // rebuild so the unit cell can become a buy/base dropdown
    })
    wrap.querySelectorAll("[data-b-qty]").forEach(inp => inp.addEventListener("input", () => { rows[+inp.dataset.bQty].qty = parseFloat(inp.value) || 0 }))
    wrap.querySelectorAll("[data-b-usebuy]").forEach(sel => sel.addEventListener("change", () => { rows[+sel.dataset.bUsebuy].useBuy = sel.value === "1" }))
    wrap.querySelectorAll("[data-b-del]").forEach(b => b.onclick = () => { rows.splice(+b.dataset.bDel, 1); if (!rows.length) rows.push({ itemId: null, qty: 0, _raw: "" }); repaint() })
    document.getElementById("bulk-add").onclick = () => { rows.push({ itemId: null, qty: 0, _raw: "" }); repaint() }
  }
  const repaint = () => {
    const d = document.getElementById("bulk-date") && document.getElementById("bulk-date").value
    const n = document.getElementById("bulk-note") && document.getElementById("bulk-note").value
    const rs = document.getElementById("bulk-reason") && document.getElementById("bulk-reason").value
    paint()
    if (d) document.getElementById("bulk-date").value = d
    if (n) document.getElementById("bulk-note").value = n
    if (rs) document.getElementById("bulk-reason").value = rs
  }

  openModal({
    title: waste ? "Catat Waste" : "Terima Kiriman",
    saveLabel: waste ? "Catat Waste" : "Simpan Semua",
    bodyHtml: `<div id="bulk-wrap"></div>`,
    onSave: async () => {
      const valid = rows.filter(r => r.itemId && r.qty > 0)
      if (!valid.length) { toast("Isi minimal satu item dengan qty lebih dari 0", "err"); return false }
      const date = document.getElementById("bulk-date").value || todayStr()
      const note = (document.getElementById("bulk-note") && document.getElementById("bulk-note").value.trim()) || ""
      const reason = document.getElementById("bulk-reason") && document.getElementById("bulk-reason").value
      const failed = []
      for (const r of valid) {
        const it = itemsById[r.itemId]
        const buy = !waste && r.useBuy && it && it.packSize > 0
        const qty = buy ? round2(r.qty * it.packSize) : r.qty
        const rowNote = buy ? [note, `${fmtNum(r.qty)} ${it.purchaseUnit}`].filter(Boolean).join(" · ") : note
        const { error } = waste
          ? await supabase.rpc("record_waste", { p_outlet: oid(), p_date: date, p_item_id: r.itemId, p_qty: qty, p_reason: reason, p_note: note, p_by_name: byName() })
          : await supabase.rpc("apply_stock_move", { p_outlet: oid(), p_date: date, p_item_id: r.itemId, p_type: "IN", p_qty: qty, p_note: rowNote, p_by_name: byName() })
        if (error) failed.push(r)
      }
      await Promise.all([fetchItems(), fetchLedgerRecent()])
      if (currentView === "stokharian") await fetchDailyLedger(dailyFetchedFrom || dailyDate)
      if (failed.length) {
        rows = failed
        toast(`${valid.length - failed.length} tersimpan, ${failed.length} gagal — cek baris tersisa`, "err")
        repaint()
        return false
      }
      toast(waste ? `${valid.length} item dicatat sebagai waste` : `${valid.length} item diterima & stok ditambahkan`, "ok")
      renderCurrentView()
    },
  })
  paint()
}

/* ============================== MASTER DATA (admin only) ============================== */
let masterTab = "items"
let masterItemSearch = ""
let masterRecipeMenuId = ""
let masterPrepItemId = ""
let recipeDraftKey = null
let recipeDraft = []

function renderMaster(el) {
  if (!isAdmin()) { el.innerHTML = `<div class="card"><div class="empty-state">Halaman ini khusus admin.</div></div>`; return }
  if (!outletDataLoaded) { el.innerHTML = `<div class="card"><div class="empty-state">Memuat data…</div></div>`; return }
  el.innerHTML = `
    <div class="card">
      <div class="history-tabs">
        <button class="history-tab ${masterTab === "items" ? "active" : ""}" data-mtab="items">Item</button>
        <button class="history-tab ${masterTab === "menu" ? "active" : ""}" data-mtab="menu">Menu</button>
        <button class="history-tab ${masterTab === "recipe" ? "active" : ""}" data-mtab="recipe">Resep Menu</button>
        <button class="history-tab ${masterTab === "prep" ? "active" : ""}" data-mtab="prep">Resep Prep</button>
      </div>
      <div class="card-body" id="master-body"></div>
    </div>`
  el.querySelectorAll("[data-mtab]").forEach(b => b.addEventListener("click", () => { masterTab = b.dataset.mtab; renderMaster(el) }))
  const body = document.getElementById("master-body")
  if (masterTab === "items") renderMasterItems(body)
  else if (masterTab === "menu") renderMasterMenu(body)
  else if (masterTab === "recipe") renderMasterRecipe(body)
  else if (masterTab === "prep") renderMasterPrep(body)
}

/* ---------- Item ---------- */
function renderMasterItems(body) {
  const q = masterItemSearch.trim().toLowerCase()
  const list = Object.values(itemsById).sort(sortItems)
    .filter(i => !q || i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q))
  body.innerHTML = `
    <div class="toolbar" style="margin-bottom:14px">
      <input class="input search" id="mi-search" placeholder="Cari item…" value="${esc(masterItemSearch)}">
      <button class="btn primary" id="mi-add" type="button">+ Tambah Item</button>
      <span style="color:var(--ink-faint);font-size:12px">${list.length} item</span>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Nama</th><th>Kategori</th><th>Unit</th><th>Tipe</th><th class="num">Stok</th><th class="num">Par</th><th>Beli</th><th class="num">Harga/unit</th><th class="num">Loss</th><th></th></tr></thead>
      <tbody>${list.map(i => `<tr>
        <td>${esc(i.name)}</td>
        <td style="color:var(--ink-faint);font-size:12px">${esc(i.category)}</td>
        <td>${esc(i.unit)}</td>
        <td>${i.itemType === "PREP" ? '<span class="pill gold">PREP</span>' : '<span class="pill neutral">RAW</span>'}${i.controlTight === false ? ' <span class="pill neutral">Longgar</span>' : ""}${i.hppOnly ? ' <span class="pill neutral">HPP saja</span>' : ""}</td>
        <td class="num">${fmtNum(i.stock)}</td>
        <td class="num">${i.minStock ? fmtNum(i.minStock) : "–"}</td>
        <td style="color:var(--ink-faint);font-size:12px">${i.purchaseUnit && i.packSize ? `${fmtRp(i.purchaseCost)}/${esc(i.purchaseUnit)} · ${fmtNum(i.packSize)}${esc(i.unit)}` : "–"}</td>
        <td class="num">${i.cost ? fmtRp(i.cost) : "–"}</td>
        <td class="num">${i.lossPct ? fmtNum(i.lossPct) + "%" : "–"}</td>
        <td style="text-align:right;white-space:nowrap"><button class="btn sm ghost" data-edit-item="${i.id}" type="button">Edit</button> <button class="btn sm danger" data-del-item="${i.id}" type="button">Hapus</button></td>
      </tr>`).join("") || `<tr><td colspan="10" class="empty-state">Tidak ada item cocok.</td></tr>`}</tbody>
    </table></div>`
  const si = document.getElementById("mi-search")
  si.addEventListener("input", e => { masterItemSearch = e.target.value; renderMasterItems(body); const n = document.getElementById("mi-search"); n.focus(); n.selectionStart = n.value.length })
  document.getElementById("mi-add").onclick = () => itemModal(null)
  body.querySelectorAll("[data-edit-item]").forEach(b => b.onclick = () => itemModal(itemsById[b.dataset.editItem]))
  body.querySelectorAll("[data-del-item]").forEach(b => b.onclick = () => deleteItem(itemsById[b.dataset.delItem]))
}

function itemModal(item) {
  const isNew = !item
  const it = item || { id: "", name: "", category: itemCats()[0] || "OTHERS", unit: "", itemType: "RAW", stockTracking: true, order: 0 }
  openModal({
    title: isNew ? "Tambah Item" : "Edit Item",
    bodyHtml: `
      <div class="modal-grid">
        <div class="field span2"><label class="field-label">Nama</label><input class="input" id="f-name" value="${esc(it.name)}" placeholder="mis. Gula Pasir 1kg/pack"></div>
        <div class="field"><label class="field-label">Kategori</label><input class="input" id="f-cat" list="item-cat-list" value="${esc(it.category)}" placeholder="ketik / pilih"><datalist id="item-cat-list">${itemCats().map(c => `<option value="${esc(c)}"></option>`).join("")}</datalist></div>
        <div class="field"><label class="field-label">Unit</label><input class="input" id="f-unit" value="${esc(it.unit)}" placeholder="gr / ml / pcs"></div>
        <div class="field"><label class="field-label">Tipe</label><select class="select" id="f-type"><option value="RAW" ${it.itemType === "RAW" ? "selected" : ""}>RAW — bahan langsung</option><option value="PREP" ${it.itemType === "PREP" ? "selected" : ""}>PREP — hasil olahan</option></select></div>
        <div class="field"><label class="field-label">Urutan tampil</label><input class="input" type="number" id="f-order" value="${it.order || 0}"></div>
        <div class="field"><label class="field-label">Par level (min. stok)</label><input class="input" type="number" step="any" id="f-par" value="${it.minStock || 0}"></div>
        <div class="field"><label class="field-label">Faktor kehilangan (%)</label><input class="input" type="number" step="any" id="f-loss" value="${it.lossPct || 0}" placeholder="0"></div>
        <div class="field"><label class="field-label">Unit beli</label><input class="input" id="f-punit" value="${esc(it.purchaseUnit || "")}" placeholder="ctn / botol / pack"></div>
        <div class="field"><label class="field-label">Isi per unit beli (dalam ${esc(it.unit || "unit")})</label><input class="input" type="number" step="any" id="f-psize" value="${it.packSize || ""}" placeholder="mis. 12000"></div>
        <div class="field"><label class="field-label">Harga per unit beli (Rp)</label><input class="input" type="number" step="any" id="f-pcost" value="${it.purchaseCost || ""}" placeholder="mis. 116000"></div>
        <div class="field"><label class="field-label">Harga / unit base (Rp)</label><input class="input" type="number" step="any" id="f-cost" value="${it.cost || 0}"><span id="f-cost-hint" style="font-size:11px;color:var(--ink-faint);margin-top:3px"></span></div>
        <div class="field span2"><label style="display:flex;gap:8px;align-items:center;font-size:13px;font-weight:600"><input type="checkbox" id="f-track" ${it.stockTracking ? "checked" : ""} style="width:16px;height:16px"> Lacak stok (tampilkan status "Habis")</label></div>
        <div class="field span2"><label style="display:flex;gap:8px;align-items:center;font-size:13px;font-weight:600"><input type="checkbox" id="f-loose" ${it.controlTight === false ? "checked" : ""} style="width:16px;height:16px"> Kontrol longgar (bahan susah ditakar — mint, garnish, es)</label><span style="font-size:11.5px;color:var(--ink-faint);margin-top:4px">Item longgar tidak muncul di "Perlu Perhatian" — kontrol lewat hitung fisik berkala.</span></div>
        <div class="field span2"><label style="display:flex;gap:8px;align-items:center;font-size:13px;font-weight:600"><input type="checkbox" id="f-hpponly" ${it.hppOnly ? "checked" : ""} style="width:16px;height:16px"> HPP saja — stok tidak dipotong otomatis dari hitung menu</label><span style="font-size:11.5px;color:var(--ink-faint);margin-top:4px">Bahan tetap masuk HPP menu lewat resep, tapi tidak ada Auto Out. Stok dikelola manual / lewat opname. Cocok untuk es batu, gula.</span></div>
        ${isNew ? `<div class="field span2"><label class="field-label">Stok awal</label><input class="input" type="number" step="any" id="f-stock" value="0"></div>` : ""}
      </div>
      <div class="modal-note">${isNew ? "ID dibuat otomatis dari nama." : `ID: <code>${esc(it.id)}</code> — tidak bisa diubah`}</div>`,
    onSave: async () => {
      const name = document.getElementById("f-name").value.trim()
      const unit = document.getElementById("f-unit").value.trim()
      if (!name) { toast("Nama wajib diisi", "err"); return false }
      if (!unit) { toast("Unit wajib diisi", "err"); return false }
      const payload = {
        name, unit,
        category: document.getElementById("f-cat").value.trim() || "OTHERS",
        item_type: document.getElementById("f-type").value,
        stock_tracking: document.getElementById("f-track").checked,
        order_idx: parseInt(document.getElementById("f-order").value) || 0,
        min_stock: parseFloat(document.getElementById("f-par").value) || 0,
        loss_pct: parseFloat(document.getElementById("f-loss").value) || 0,
        purchase_unit: document.getElementById("f-punit").value.trim() || null,
        pack_size: parseFloat(document.getElementById("f-psize").value) || 0,
        purchase_cost: parseFloat(document.getElementById("f-pcost").value) || 0,
        cost_per_unit: parseFloat(document.getElementById("f-cost").value) || 0,
        control_tight: !document.getElementById("f-loose").checked,
        hpp_only: document.getElementById("f-hpponly").checked,
      }
      // trigger derives cost when both purchase fields set; mirror it client-side
      if (payload.pack_size > 0 && payload.purchase_cost > 0) payload.cost_per_unit = round2(payload.purchase_cost / payload.pack_size)
      if (isNew) {
        payload.id = uniqueId(oid() + "-" + slug(name), itemsById)
        payload.outlet_id = oid()
        payload.stock = parseFloat(document.getElementById("f-stock").value) || 0
        const { error } = await supabase.from("items").insert(payload)
        if (error) { toast("Gagal: " + error.message, "err"); return false }
      } else {
        const { error } = await supabase.from("items").update(payload).eq("id", it.id)
        if (error) { toast("Gagal: " + error.message, "err"); return false }
      }
      toast(isNew ? "Item ditambahkan" : "Item disimpan", "ok")
      await fetchItems()
      renderCurrentView()
    },
  })
  // live-derive base cost from purchase price / pack size
  const syncCost = () => {
    const ps = parseFloat(document.getElementById("f-psize").value) || 0
    const pc = parseFloat(document.getElementById("f-pcost").value) || 0
    const cost = document.getElementById("f-cost"), hint = document.getElementById("f-cost-hint")
    if (ps > 0 && pc > 0) {
      cost.value = round2(pc / ps); cost.readOnly = true; cost.style.opacity = ".6"
      hint.textContent = `otomatis: ${fmtRp(pc)} ÷ ${fmtNum(ps)}`
    } else {
      cost.readOnly = false; cost.style.opacity = "1"; hint.textContent = "isi manual, atau isi unit beli di atas"
    }
  }
  ;["f-psize", "f-pcost"].forEach(id => document.getElementById(id).addEventListener("input", syncCost))
  syncCost()
}

async function deleteItem(it) {
  if (!it || !confirm(`Hapus item "${it.name}"?\nTidak bisa dibatalkan.`)) return
  const { error } = await supabase.from("items").delete().eq("id", it.id)
  if (error) {
    toast(/foreign key|violates|referenced/i.test(error.message) ? "Item masih dipakai di resep atau riwayat transaksi — hapus dari sana dulu." : "Gagal: " + error.message, "err")
    return
  }
  toast("Item dihapus", "ok")
  await fetchItems()
  renderCurrentView()
}

/* ---------- Menu ---------- */
function renderMasterMenu(body) {
  const menus = Object.values(menusById).sort((a, b) => a.order - b.order)
  body.innerHTML = `
    <div class="toolbar" style="margin-bottom:14px">
      <button class="btn primary" id="mm-add" type="button">+ Tambah Menu</button>
      <span style="color:var(--ink-faint);font-size:12px">${menus.length} menu</span>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Nama</th><th>Kategori</th><th class="num">Harga</th><th class="num">HPP</th><th class="num">Food Cost</th><th>Aktif</th><th></th></tr></thead>
      <tbody>${menus.map(m => { const hpp = menuHpp(m.id); const fc = m.price > 0 ? hpp / m.price * 100 : null
        return `<tr>
        <td>${esc(m.name)}</td>
        <td style="color:var(--ink-faint);font-size:12px">${esc(m.category)}</td>
        <td class="num">${m.price ? fmtRp(m.price) : "–"}</td>
        <td class="num">${hpp ? fmtRp(hpp) : "–"}${m.hppManual != null ? ' <span class="pill neutral">manual</span>' : ""}</td>
        <td class="num ${fc != null && fc > 35 ? "variance-neg" : fc != null ? "variance-pos" : ""}">${fc != null ? fmtNum(round2(fc)) + "%" : "–"}</td>
        <td>${m.active ? "Ya" : "–"}</td>
        <td style="text-align:right;white-space:nowrap"><button class="btn sm ghost" data-edit-menu="${m.id}" type="button">Edit</button> <button class="btn sm danger" data-del-menu="${m.id}" type="button">Hapus</button></td>
      </tr>` }).join("") || `<tr><td colspan="7" class="empty-state">Belum ada menu.</td></tr>`}</tbody>
    </table></div>
    <div class="modal-note">HPP = total biaya resep (bahan × harga/unit, PREP dijabarkan) — atau nilai <b>manual</b> kalau diisi di modal Edit. Food cost merah kalau &gt; 35%.</div>`
  document.getElementById("mm-add").onclick = () => menuModal(null)
  body.querySelectorAll("[data-edit-menu]").forEach(b => b.onclick = () => menuModal(menusById[b.dataset.editMenu]))
  body.querySelectorAll("[data-del-menu]").forEach(b => b.onclick = () => deleteMenu(menusById[b.dataset.delMenu]))
}

function menuModal(menu) {
  const isNew = !menu
  const m = menu || { id: "", name: "", category: menuCats()[0] || "Umum", price: 0, hppManual: null, active: true, order: 0 }
  const calcHpp = m.id ? menuHppCalc(m.id) : 0
  openModal({
    title: isNew ? "Tambah Menu" : "Edit Menu",
    bodyHtml: `
      <div class="modal-grid">
        <div class="field span2"><label class="field-label">Nama menu</label><input class="input" id="f-name" value="${esc(m.name)}" placeholder="mis. Es Kopi Susu"></div>
        <div class="field"><label class="field-label">Kategori</label><input class="input" id="f-cat" list="menu-cat-list" value="${esc(m.category)}" placeholder="ketik / pilih"><datalist id="menu-cat-list">${menuCats().map(c => `<option value="${esc(c)}"></option>`).join("")}</datalist></div>
        <div class="field"><label class="field-label">Harga jual (Rp)</label><input class="input" type="number" step="any" id="f-price" value="${m.price || 0}"></div>
        <div class="field"><label class="field-label">Urutan tampil</label><input class="input" type="number" id="f-order" value="${m.order || 0}"></div>
        <div class="field span2"><label class="field-label">HPP manual (Rp) — kosongkan untuk otomatis dari resep${m.id ? ` (hitung: ${fmtRp(calcHpp)})` : ""}</label><input class="input" type="number" step="any" id="f-hpp" value="${m.hppManual == null ? "" : m.hppManual}" placeholder="otomatis"></div>
        <div class="field span2"><label style="display:flex;gap:8px;align-items:center;font-size:13px;font-weight:600"><input type="checkbox" id="f-active" ${m.active ? "checked" : ""} style="width:16px;height:16px"> Aktif (tampil di form hitung menu)</label></div>
      </div>
      <div class="modal-note">Kategori bebas — ketik baru atau pilih dari yang ada.${isNew ? "" : ` ID: <code>${esc(m.id)}</code>`}</div>`,
    onSave: async () => {
      const name = document.getElementById("f-name").value.trim()
      if (!name) { toast("Nama wajib diisi", "err"); return false }
      const hppRaw = document.getElementById("f-hpp").value.trim()
      const payload = {
        name,
        category: document.getElementById("f-cat").value.trim() || "Umum",
        price: parseFloat(document.getElementById("f-price").value) || 0,
        hpp_manual: hppRaw === "" ? null : (parseFloat(hppRaw) || 0),
        active: document.getElementById("f-active").checked,
        order_idx: parseInt(document.getElementById("f-order").value) || 0,
      }
      if (isNew) {
        payload.id = uniqueId(oid() + "-" + slug(name), menusById)
        payload.outlet_id = oid()
        const { error } = await supabase.from("menu").insert(payload)
        if (error) { toast("Gagal: " + error.message, "err"); return false }
      } else {
        const { error } = await supabase.from("menu").update(payload).eq("id", m.id)
        if (error) { toast("Gagal: " + error.message, "err"); return false }
      }
      toast(isNew ? "Menu ditambahkan" : "Menu disimpan", "ok")
      await fetchMenu()
      renderCurrentView()
    },
  })
}

async function deleteMenu(m) {
  if (!m || !confirm(`Hapus menu "${m.name}"?\nResepnya ikut terhapus. Tidak bisa dibatalkan.`)) return
  const { error } = await supabase.from("menu").delete().eq("id", m.id)
  if (error) {
    toast(/foreign key|violates|referenced/i.test(error.message) ? "Menu ini sudah punya riwayat hitungan — tidak bisa dihapus. Nonaktifkan saja (hilangkan centang Aktif)." : "Gagal: " + error.message, "err")
    return
  }
  toast("Menu dihapus", "ok")
  await Promise.all([fetchMenu(), fetchRecipesOnce()])
  renderCurrentView()
}

/* ---------- shared recipe-row editor ---------- */
function recipeRowsHtml(rows) {
  return rows.map((r, idx) => {
    const it = itemsById[r.itemId]
    return `<tr data-row="${idx}">
      <td><input class="input" list="recipe-item-list" data-r-name="${idx}" value="${esc(it ? it.name : (r._raw || ""))}" placeholder="Ketik nama bahan…" style="min-width:210px"></td>
      <td class="num"><input class="input" type="number" step="any" data-r-qty="${idx}" value="${r.qty}" style="width:88px;text-align:right"></td>
      <td><input class="input" data-r-unit="${idx}" value="${esc(r.unit || "")}" style="width:66px"></td>
      <td><button class="btn sm danger" data-r-del="${idx}" type="button">✕</button></td>
    </tr>`
  }).join("")
}
function itemDatalistHtml() {
  return `<datalist id="recipe-item-list">${Object.values(itemsById).sort(sortItems).map(i => `<option value="${esc(i.name)}">${esc(i.category)} · ${esc(i.unit)}${i.itemType === "PREP" ? " · PREP" : ""}</option>`).join("")}</datalist>`
}
function findItemByExactName(name) {
  const n = String(name || "").trim().toLowerCase()
  return Object.values(itemsById).find(i => i.name.toLowerCase() === n) || null
}
function wireRecipeRows(container, rows, rerender) {
  container.querySelectorAll("[data-r-name]").forEach(inp => inp.addEventListener("input", () => {
    const i = +inp.dataset.rName, it = findItemByExactName(inp.value)
    rows[i]._raw = inp.value
    rows[i].itemId = it ? it.id : null
    if (it && !rows[i].unit) { rows[i].unit = it.unit; const u = container.querySelector(`[data-r-unit="${i}"]`); if (u) u.value = it.unit }
  }))
  container.querySelectorAll("[data-r-qty]").forEach(inp => inp.addEventListener("input", () => { rows[+inp.dataset.rQty].qty = parseFloat(inp.value) || 0 }))
  container.querySelectorAll("[data-r-unit]").forEach(inp => inp.addEventListener("input", () => { rows[+inp.dataset.rUnit].unit = inp.value.trim() }))
  container.querySelectorAll("[data-r-del]").forEach(b => b.onclick = () => { rows.splice(+b.dataset.rDel, 1); rerender() })
}

/* ---------- Resep Menu ---------- */
function renderMasterRecipe(body) {
  const menus = Object.values(menusById).sort((a, b) => a.category === b.category ? a.order - b.order : menuCatIdx(a.category) - menuCatIdx(b.category))
  if (!menus.length) { body.innerHTML = `<div class="empty-state">Belum ada menu. Tambahkan di tab Menu dulu.</div>`; return }
  if (!masterRecipeMenuId || !menusById[masterRecipeMenuId]) masterRecipeMenuId = menus[0].id
  const key = "menu:" + masterRecipeMenuId
  if (recipeDraftKey !== key) {
    recipeDraftKey = key
    recipeDraft = (recipesByMenu[masterRecipeMenuId] || []).map(r => ({ itemId: r.itemId, qty: r.qty, unit: r.unit }))
  }
  const rerender = () => renderMasterRecipe(body)
  const curMenu = menusById[masterRecipeMenuId] || {}
  const hpp = menuHpp(masterRecipeMenuId)
  const fc = curMenu.price > 0 ? hpp / curMenu.price * 100 : null
  body.innerHTML = `
    <div class="toolbar" style="margin-bottom:14px;align-items:center">
      <select class="select" id="mr-menu">${menus.map(m => `<option value="${m.id}" ${m.id === masterRecipeMenuId ? "selected" : ""}>${esc(m.category)} — ${esc(m.name)}</option>`).join("")}</select>
      <span style="font-size:12.5px;color:var(--ink-dim);margin-left:auto">HPP <strong>${hpp ? fmtRp(hpp) : "–"}</strong>${curMenu.hppManual != null ? " (manual)" : ""}${curMenu.price ? ` · Harga ${fmtRp(curMenu.price)} · Food cost <strong class="${fc > 35 ? "variance-neg" : "variance-pos"}">${fmtNum(round2(fc))}%</strong>` : ""}</span>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Bahan</th><th class="num">Qty</th><th>Unit</th><th></th></tr></thead>
      <tbody id="mr-rows">${recipeRowsHtml(recipeDraft) || `<tr><td colspan="4" class="empty-state">Belum ada bahan. Klik "Tambah bahan".</td></tr>`}</tbody>
    </table></div>
    ${itemDatalistHtml()}
    <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
      <button class="btn ghost" id="mr-add-row" type="button">+ Tambah bahan</button>
      <button class="btn primary" id="mr-save" type="button">Simpan Resep</button>
    </div>
    <div class="modal-note">Bahan bertipe PREP otomatis dijabarkan ke komponennya saat hitung menu terjual.</div>`
  document.getElementById("mr-menu").onchange = e => { masterRecipeMenuId = e.target.value; recipeDraftKey = null; rerender() }
  document.getElementById("mr-add-row").onclick = () => { recipeDraft.push({ itemId: null, qty: 0, unit: "", _raw: "" }); rerender() }
  wireRecipeRows(document.getElementById("mr-rows"), recipeDraft, rerender)
  document.getElementById("mr-save").onclick = async () => {
    const btn = document.getElementById("mr-save")
    for (const r of recipeDraft) {
      if (!r.itemId) { toast("Ada baris bahan yang belum cocok dengan item terdaftar", "err"); return }
      if (!(r.qty > 0)) { toast("Qty tiap bahan harus lebih dari 0", "err"); return }
      if (!r.unit) { toast("Unit tiap bahan wajib diisi", "err"); return }
    }
    btn.disabled = true
    const del = await supabase.from("recipe_ingredients").delete().eq("outlet_id", oid()).eq("menu_id", masterRecipeMenuId)
    if (del.error) { btn.disabled = false; toast("Gagal: " + del.error.message, "err"); return }
    if (recipeDraft.length) {
      const ins = await supabase.from("recipe_ingredients").insert(recipeDraft.map(r => ({ outlet_id: oid(), menu_id: masterRecipeMenuId, item_id: r.itemId, qty: r.qty, unit: r.unit })))
      if (ins.error) { btn.disabled = false; toast("Gagal menyimpan bahan baru: " + ins.error.message, "err"); return }
    }
    toast("Resep disimpan", "ok")
    await fetchRecipesOnce()
    recipeDraftKey = null
    renderCurrentView()
  }
}

/* ---------- Resep Prep ---------- */
function renderMasterPrep(body) {
  const preps = Object.values(itemsById).filter(i => i.itemType === "PREP").sort(sortItems)
  if (!preps.length) { body.innerHTML = `<div class="empty-state">Belum ada item bertipe PREP. Buat item dengan tipe PREP di tab Item dulu.</div>`; return }
  if (!masterPrepItemId || !itemsById[masterPrepItemId] || itemsById[masterPrepItemId].itemType !== "PREP") masterPrepItemId = preps[0].id
  const prep = prepByItem[masterPrepItemId]
  const key = "prep:" + masterPrepItemId
  if (recipeDraftKey !== key) {
    recipeDraftKey = key
    recipeDraft = ((prep && prep.components) || []).map(c => ({ itemId: c.itemId, qty: c.qty, unit: c.unit }))
  }
  const rerender = () => renderMasterPrep(body)
  const yq = prep ? prep.yieldQty : ""
  const yu = prep ? prep.yieldUnit : itemsById[masterPrepItemId].unit
  body.innerHTML = `
    <div class="toolbar" style="margin-bottom:14px">
      <select class="select" id="mp-item">${preps.map(p => `<option value="${p.id}" ${p.id === masterPrepItemId ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select>
    </div>
    <div class="modal-grid" style="max-width:320px;margin-bottom:16px">
      <div class="field"><label class="field-label">Hasil (yield) qty</label><input class="input" type="number" step="any" id="mp-yq" value="${yq}"></div>
      <div class="field"><label class="field-label">Yield unit</label><input class="input" id="mp-yu" value="${esc(yu || "")}"></div>
    </div>
    <div style="font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.4px;color:var(--ink-dim);margin-bottom:8px">Komponen (bahan penyusun)</div>
    <div class="table-wrap"><table>
      <thead><tr><th>Bahan</th><th class="num">Qty</th><th>Unit</th><th></th></tr></thead>
      <tbody id="mp-rows">${recipeRowsHtml(recipeDraft) || `<tr><td colspan="4" class="empty-state">Belum ada komponen.</td></tr>`}</tbody>
    </table></div>
    ${itemDatalistHtml()}
    <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
      <button class="btn ghost" id="mp-add-row" type="button">+ Tambah komponen</button>
      <button class="btn primary" id="mp-save" type="button">Simpan Resep Prep</button>
    </div>
    <div class="modal-note">Contoh: "Base Cream" yield 40 ml, komponen = susu 10 ml + whipping cream 30 ml. Saat menu pakai 40 ml base cream, stok ketiga bahan itu yang terpotong sesuai rasio.</div>`
  document.getElementById("mp-item").onchange = e => { masterPrepItemId = e.target.value; recipeDraftKey = null; rerender() }
  document.getElementById("mp-add-row").onclick = () => { recipeDraft.push({ itemId: null, qty: 0, unit: "", _raw: "" }); rerender() }
  wireRecipeRows(document.getElementById("mp-rows"), recipeDraft, rerender)
  document.getElementById("mp-save").onclick = async () => {
    const btn = document.getElementById("mp-save")
    const yieldQty = parseFloat(document.getElementById("mp-yq").value)
    const yieldUnit = document.getElementById("mp-yu").value.trim()
    if (!(yieldQty > 0)) { toast("Yield qty harus lebih dari 0", "err"); return }
    if (!yieldUnit) { toast("Yield unit wajib diisi", "err"); return }
    for (const r of recipeDraft) {
      if (!r.itemId) { toast("Ada baris komponen yang belum cocok dengan item terdaftar", "err"); return }
      if (!(r.qty > 0)) { toast("Qty tiap komponen harus lebih dari 0", "err"); return }
      if (!r.unit) { toast("Unit tiap komponen wajib diisi", "err"); return }
    }
    btn.disabled = true
    const up = await supabase.from("prep_recipes").upsert({ outlet_id: oid(), item_id: masterPrepItemId, yield_qty: yieldQty, yield_unit: yieldUnit }, { onConflict: "item_id" })
    if (up.error) { btn.disabled = false; toast("Gagal: " + up.error.message, "err"); return }
    const del = await supabase.from("prep_components").delete().eq("outlet_id", oid()).eq("prep_item_id", masterPrepItemId)
    if (del.error) { btn.disabled = false; toast("Gagal: " + del.error.message, "err"); return }
    if (recipeDraft.length) {
      const ins = await supabase.from("prep_components").insert(recipeDraft.map(r => ({ outlet_id: oid(), prep_item_id: masterPrepItemId, item_id: r.itemId, qty: r.qty, unit: r.unit })))
      if (ins.error) { btn.disabled = false; toast("Gagal menyimpan komponen: " + ins.error.message, "err"); return }
    }
    toast("Resep prep disimpan", "ok")
    await fetchRecipesOnce()
    recipeDraftKey = null
    renderCurrentView()
  }
}

/* ============================== RENDER ROOT / INIT ============================== */
async function loadOutlets() {
  // RLS returns only rows the user can reach (owner: all)
  const { data } = await supabase.from("outlets").select("*").eq("active", true).order("order_idx")
  const rows = data || []
  outletGroups = rows.filter(o => o.kind === "group")
  let mem = []
  if (!isManager()) {
    const r = await supabase.from("outlet_members").select("outlet_id, role").eq("user_id", session.user.id)
    mem = r.data || []
  }
  const roleFor = (o) => {
    if (isManager()) return "admin"
    const grants = [mem.find(m => m.outlet_id === o.id), mem.find(m => m.outlet_id === o.parent_id)]
      .filter(Boolean).map(m => m.role)
    if (grants.includes("admin")) return "admin"
    if (grants.includes("supervisor")) return "supervisor"
    if (grants.includes("staff")) return "staff"
    return null
  }
  outlets = rows.filter(o => o.kind === "area").map(o => ({ ...o, _role: roleFor(o) })).filter(o => o._role)
  let saved = null
  try { saved = localStorage.getItem("armend_outlet") } catch (_) {}
  if (saved && outlets.some(o => o.id === saved)) currentOutlet = saved
  else currentOutlet = outlets.length ? outlets[0].id : null
}

function resetOutletCaches() {
  itemsById = {}; menusById = {}; recipesByMenu = {}; prepByItem = {}
  ledgerCache = {}; menuCountsCache = {}; monthEndCache = {}
  refDataLoaded = false; outletDataLoaded = false
  dailyLedgerRows = null; dailyFetchedFrom = null
  wasteRows = null; wasteFetchedFor = null
  recipeDraftKey = null; menuCountDraft = null; opnameDraft = null
}

async function loadOutletData() {
  outletDataLoaded = false
  // essential for first paint (Dashboard + Stok Harian)
  await Promise.all([fetchItems(), fetchMenu(), fetchLedgerRecent()])
  outletDataLoaded = true
  // the rest loads in the background so it doesn't block the screen
  Promise.all([fetchRecipesOnce(), fetchMenuCountsRecent(), fetchMonthEndRecent()])
    .then(() => rerenderIf(["dashboard", "menucount", "opname", "history"]))
}
function emptyOrLoading(msg) {
  return `<div class="card"><div class="empty-state">${outletDataLoaded ? esc(msg) : "Memuat data…"}</div></div>`
}

async function switchOutlet(id) {
  if (id === currentOutlet) return
  currentOutlet = id
  try { localStorage.setItem("armend_outlet", id) } catch (_) {}
  teardownRealtime()
  resetOutletCaches()
  root.innerHTML = shellHtml()
  wireShell()
  switchView(currentView || defaultView())
  await loadOutletData()
  setupRealtime()
  renderCurrentView()
}

function wireShell() {
  document.getElementById("btn-logout").addEventListener("click", async () => { await supabase.auth.signOut() })
  const tb = document.getElementById("theme-btn")
  if (tb) tb.addEventListener("click", toggleTheme)
  ;["outlet-select", "outlet-select-m"].forEach(id => {
    const sel = document.getElementById(id)
    if (sel) sel.addEventListener("change", e => switchOutlet(e.target.value))
  })
  renderNav()
}

async function render() {
  if (!session) { renderLogin(); return }
  root.innerHTML = `<div class="center-msg">Memuat…</div>`
  if (!profile || profile.id !== session.user.id) profile = await loadProfile()
  if (!profile) { root.innerHTML = `<div class="center-msg">Gagal memuat profil. <button class="btn" id="retry">Coba lagi</button></div>`; document.getElementById("retry").onclick = () => render(); return }

  await loadOutlets()
  if (!currentOutlet) {
    root.innerHTML = `<div class="center-msg" style="flex-direction:column;gap:10px;text-align:center;padding:0 24px">
      <div>Akun kamu belum ditugaskan ke outlet / area manapun.<br>Hubungi admin untuk ditambahkan.</div>
      <button class="btn" id="retry">Coba lagi</button>
      <button class="linklike" id="lo">Keluar</button></div>`
    document.getElementById("retry").onclick = () => render()
    document.getElementById("lo").onclick = () => supabase.auth.signOut()
    return
  }

  root.innerHTML = shellHtml()
  wireShell()
  switchView(currentView || defaultView())

  await loadOutletData()
  setupRealtime()
  renderCurrentView()
}

boot()
