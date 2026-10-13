import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { apiRequest } from "./api";
import "./App.css";

type PageId = "dashboard" | "profile" | "social" | "apps" | "domains";
type HealthState = "checking" | "online" | "offline";
type ThemeMode = "light" | "dark" | "system";
type ApiBrandProfile = { id: number; name: string; official_handles: string[]; official_domains: string[] };
type BrandDraft = { name: string; official_handles: string; official_domains: string };
type ApiDetection = { id: number; kind: "social" | "apk" | "domain"; target: string; risk_score: number; risk_level: "low" | "medium" | "high"; findings: string[]; analysis_scope: string; created_at: string };
type ApiStats = { total_brands: number; total_detections: number; high_risk_detections: number; detections_by_type: Record<string, number> };
type ApiHistory = { items: ApiDetection[]; total: number; limit: number; offset: number };
type SubmitCheck = (path: string, payload: object) => Promise<void>;

const emptyBrandDraft: BrandDraft = {
  name: "",
  official_handles: "",
  official_domains: "",
};

async function loadWorkspace(signal?: AbortSignal) {
  const [brands, stats, history] = await Promise.all([
    apiRequest<ApiBrandProfile[]>("/api/brands", { signal }),
    apiRequest<ApiStats>("/api/dashboard/stats", { signal }),
    apiRequest<ApiHistory>("/api/history?limit=50", { signal }),
  ]);
  return { brands, stats, history };
}

function toBrandDraft(brand: ApiBrandProfile): BrandDraft {
  return {
    name: brand.name,
    official_handles: brand.official_handles.join("\n"),
    official_domains: brand.official_domains.join("\n"),
  };
}

const navigation: { id: PageId; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "grid" },
  { id: "profile", label: "Brand profile", icon: "shield" },
  { id: "social", label: "Social monitor", icon: "users" },
  { id: "apps", label: "App monitor", icon: "apps" },
  { id: "domains", label: "Lookalike domains", icon: "globe" },
];

function Icon({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
    className,
  };

  switch (name) {
    case "grid":
      return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>;
    case "shield":
      return <svg {...common}><path d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-3Z" /><path d="m9 12 2 2 4-4" /></svg>;
    case "users":
      return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></svg>;
    case "apps":
      return <svg {...common}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h8M8 15h4" /></svg>;
    case "globe":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></svg>;
    case "search":
      return <svg {...common}><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>;
    case "bell":
      return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>;
    case "arrow":
      return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
    case "clock":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case "check":
      return <svg {...common}><path d="m5 12 4 4L19 6" /></svg>;
    case "alert":
      return <svg {...common}><path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4m0 4h.01" /></svg>;
    case "plus":
      return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case "chevron":
      return <svg {...common}><path d="m9 18 6-6-6-6" /></svg>;
    case "menu":
      return <svg {...common}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
    case "sun":
      return <svg {...common}><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>;
    case "moon":
      return <svg {...common}><path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" /></svg>;
    case "monitor":
      return <svg {...common}><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></svg>;
    default:
      return <svg {...common}><circle cx="12" cy="12" r="9" /></svg>;
  }
}

function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      const storedTheme = window.localStorage.getItem("drishti-theme");
      return storedTheme === "light" || storedTheme === "dark" || storedTheme === "system" ? storedTheme : "system";
    } catch {
      return "system";
    }
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem("drishti-sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [preferenceWarning, setPreferenceWarning] = useState("");
  const [page, setPage] = useState<PageId>("dashboard");
  const [health, setHealth] = useState<HealthState>("checking");
  const [healthMessage, setHealthMessage] = useState("");
  const [healthAttempt, setHealthAttempt] = useState(0);
  const [brandProfiles, setBrandProfiles] = useState<ApiBrandProfile[]>([]);
  const [apiStats, setApiStats] = useState<ApiStats>({ total_brands: 0, total_detections: 0, high_risk_detections: 0, detections_by_type: {} });
  const [apiHistory, setApiHistory] = useState<ApiHistory>({ items: [], total: 0, limit: 50, offset: 0 });
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState("");
  const [checkBusy, setCheckBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [brandProfile, setBrandProfile] = useState<ApiBrandProfile | null>(null);
  const [profileDraft, setProfileDraft] = useState<BrandDraft>(emptyBrandDraft);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [themeMenuIndex, setThemeMenuIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pointerTargetRef = useRef<HTMLElement | null>(null);
  const themePickerRef = useRef<HTMLDivElement>(null);
  const themeTriggerRef = useRef<HTMLButtonElement>(null);
  const themeOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const themeOptions: { value: ThemeMode; label: string; icon: string }[] = [
    { value: "light", label: "Light", icon: "sun" },
    { value: "dark", label: "Dark", icon: "moon" },
    { value: "system", label: "System", icon: "monitor" },
  ];

  useEffect(() => {
    const root = document.documentElement;
    const systemTheme = window.matchMedia("(prefers-color-scheme: light)");
    const applyTheme = () => {
      const resolvedTheme = themeMode === "system" ? (systemTheme.matches ? "light" : "dark") : themeMode;
      root.dataset.theme = resolvedTheme;
      document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", resolvedTheme === "light" ? "#f4f6f9" : "#0d111b");
    };

    applyTheme();
    systemTheme.addEventListener("change", applyTheme);
    return () => systemTheme.removeEventListener("change", applyTheme);
  }, [themeMode]);

  useEffect(() => {
    const controller = new AbortController();

    apiRequest<{ status?: string }>("/api/health", { signal: controller.signal })
      .then((data) => {
        if (data.status !== "ok") throw new Error("The API returned an unexpected health status.");
        setHealth("online");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setWorkspaceLoading(false);
        setHealth("offline");
        setHealthMessage(error instanceof Error ? error.message : "Could not reach the local API.");
      });

    return () => controller.abort();
  }, [healthAttempt]);

  useEffect(() => {
    if (health !== "online") return;
    const controller = new AbortController();
    loadWorkspace(controller.signal)
      .then(({ brands, stats, history }) => {
        setBrandProfiles(brands);
        setApiStats(stats);
        setApiHistory(history);
        const selectedBrand = brands[0] ?? null;
        setBrandProfile(selectedBrand);
        setProfileDraft(selectedBrand ? toBrandDraft(selectedBrand) : emptyBrandDraft);
        setWorkspaceError("");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setWorkspaceError(error instanceof Error ? error.message : "Could not load dashboard data.");
      })
      .finally(() => setWorkspaceLoading(false));
    return () => controller.abort();
  }, [health, healthAttempt]);

  // Smooth in-page navigation for same-document anchors ("#section-id"). Links that do not point at an element that
  // exists on the page (or that another handler already took over, like the brand link that switches views) are left alone.
  useEffect(() => {
    function handleAnchorClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
      const id = anchor?.getAttribute("href")?.slice(1);
      if (!anchor || !id) return;
      const target = document.getElementById(decodeURIComponent(id));
      if (!target) return;
      event.preventDefault();
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
      window.history.pushState(null, "", `#${id}`);
    }

    document.addEventListener("click", handleAnchorClick);
    return () => document.removeEventListener("click", handleAnchorClick);
  }, []);

  // When the view changes, bring the new view's heading back into sight with the same motion rules.
  const isFirstPageRender = useRef(true);
  useEffect(() => {
    if (isFirstPageRender.current) {
      isFirstPageRender.current = false;
      return;
    }
    if (window.scrollY === 0) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }, [page]);

  useEffect(() => {
    function handleSearchShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleSearchShortcut);
    return () => window.removeEventListener("keydown", handleSearchShortcut);
  }, []);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileNavOpen(false);
        setNotificationsOpen(false);
        if (themeMenuOpen) {
          setThemeMenuOpen(false);
          themeTriggerRef.current?.focus();
        }
      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [themeMenuOpen]);

  useEffect(() => {
    if (themeMenuOpen) themeOptionRefs.current[themeMenuIndex]?.focus();
  }, [themeMenuOpen, themeMenuIndex]);

  useEffect(() => {
    if (!themeMenuOpen) return;
    function handleOutsidePointer(event: PointerEvent) {
      if (event.target instanceof Node && !themePickerRef.current?.contains(event.target)) setThemeMenuOpen(false);
    }
    document.addEventListener("pointerdown", handleOutsidePointer);
    return () => document.removeEventListener("pointerdown", handleOutsidePointer);
  }, [themeMenuOpen]);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredFindings = useMemo(
    () => apiHistory.items.filter((item) => `${item.target} ${item.kind} ${item.risk_level} ${item.findings.join(" ")}`.toLowerCase().includes(normalizedSearch)),
    [apiHistory.items, normalizedSearch],
  );

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = profileDraft.name.trim();
    if (!name) return;
    const payload = {
      name,
      official_handles: profileDraft.official_handles.split(/[\n,]/).map((value) => value.trim()).filter(Boolean),
      official_domains: profileDraft.official_domains.split(/[\n,]/).map((value) => value.trim()).filter(Boolean),
    };
    setProfileSaving(true);
    setWorkspaceError("");
    try {
      const saved = await apiRequest<ApiBrandProfile>(brandProfile ? `/api/brands/${brandProfile.id}` : "/api/brands", {
        method: brandProfile ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      const workspace = await loadWorkspace();
      setBrandProfiles(workspace.brands);
      setApiStats(workspace.stats);
      setApiHistory(workspace.history);
      setBrandProfile(saved);
      setProfileDraft(toBrandDraft(saved));
      setProfileSaved(true);
      window.setTimeout(() => setProfileSaved(false), 3000);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Could not save brand profile.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function submitCheck(path: string, payload: object) {
    setCheckBusy(true);
    setWorkspaceError("");
    try {
      await apiRequest<unknown>(path, { method: "POST", body: JSON.stringify(payload) });
      const workspace = await loadWorkspace();
      setBrandProfiles(workspace.brands);
      setApiStats(workspace.stats);
      setApiHistory(workspace.history);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Analysis request failed.");
    } finally {
      setCheckBusy(false);
    }
  }

  function handleCardPointerMove(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType !== "mouse" || !window.matchMedia("(hover: hover)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const target = (event.target as HTMLElement).closest<HTMLElement>(".panel, .stat-card");
    if (pointerTargetRef.current !== target) {
      pointerTargetRef.current?.removeAttribute("data-pointer-active");
      pointerTargetRef.current = target;
    }
    if (!target) return;
    const bounds = target.getBoundingClientRect();
    target.style.setProperty("--pointer-x", `${event.clientX - bounds.left}px`);
    target.style.setProperty("--pointer-y", `${event.clientY - bounds.top}px`);
    target.setAttribute("data-pointer-active", "true");
  }

  function clearCardPointer() {
    pointerTargetRef.current?.removeAttribute("data-pointer-active");
    pointerTargetRef.current = null;
  }

  function changeTheme(mode: ThemeMode) {
    setThemeMode(mode);
    try {
      window.localStorage.setItem("drishti-theme", mode);
      setPreferenceWarning("");
    } catch {
      setPreferenceWarning("Theme preference could not be saved in this browser.");
    }
    setThemeMenuOpen(false);
    themeTriggerRef.current?.focus();
  }

  function openThemeMenu(index = themeOptions.findIndex((option) => option.value === themeMode)) {
    setThemeMenuIndex(index < 0 ? 0 : index);
    setThemeMenuOpen(true);
  }

  function handleThemeMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    let nextIndex = themeMenuIndex;
    if (event.key === "ArrowDown") nextIndex = (themeMenuIndex + 1) % themeOptions.length;
    else if (event.key === "ArrowUp") nextIndex = (themeMenuIndex - 1 + themeOptions.length) % themeOptions.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = themeOptions.length - 1;
    else return;
    event.preventDefault();
    setThemeMenuIndex(nextIndex);
  }

  function toggleSidebar() {
    const nextCollapsed = !sidebarCollapsed;
    setSidebarCollapsed(nextCollapsed);
    try {
      window.localStorage.setItem("drishti-sidebar-collapsed", String(nextCollapsed));
      setPreferenceWarning("");
    } catch {
      setPreferenceWarning("Sidebar preference could not be saved in this browser.");
    }
  }

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${mobileNavOpen ? "mobile-nav-open" : ""}`} onPointerMove={handleCardPointerMove} onPointerLeave={clearCardPointer}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <button className={`mobile-nav-backdrop ${mobileNavOpen ? "is-visible" : ""}`} aria-label="Close navigation" tabIndex={mobileNavOpen ? 0 : -1} aria-hidden={!mobileNavOpen} onClick={() => setMobileNavOpen(false)} />
      <aside className={`sidebar ${mobileNavOpen ? "is-mobile-open" : ""}`} aria-label="Primary navigation" id="primary-navigation">
        <div className={`sidebar-brand-row ${sidebarCollapsed ? "is-collapsed" : ""}`}>
          <a className="brand-lockup" href="#dashboard" title="Dashboard" onClick={(event) => { event.preventDefault(); setPage("dashboard"); setMobileNavOpen(false); }}>
          <span className="brand-mark"><Icon name="shield" size={18} /></span>
          <span className="brand-copy"><strong>Drishti DRP</strong><small>BRANDSHIELD SENTINEL</small></span>
          </a>
          <button className="sidebar-collapse-button" aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!sidebarCollapsed} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={toggleSidebar}><Icon name="chevron" size={16} /></button>
        </div>

        <div className="nav-caption">OPERATIONAL SURVEILLANCE</div>
        <nav className="primary-nav">
          {navigation.map((item) => (
            <button
              className={`nav-link ${page === item.id ? "is-active" : ""}`}
              key={item.id}
              onClick={() => { setPage(item.id); setMobileNavOpen(false); }}
              aria-current={page === item.id ? "page" : undefined}
              aria-label={item.label}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <Icon name={item.icon} size={17} />
              <span>{item.label}</span>
              {item.id === "social" && <span className="nav-count">{apiStats.detections_by_type.social ?? 0}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-status">
          <span className="feed-indicator"><span className="live-dot" /> Local API workspace</span>
          <span className="sidebar-note">Monitoring feeds are not connected</span>
        </div>
        <div className="sidebar-user">
          <span className="avatar">AM</span>
          <span><strong>Aryan Mehta</strong><small>Lead SOC Analyst</small></span>
          <span className="user-menu" aria-hidden="true">···</span>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <button className="mobile-menu-button icon-button" aria-label="Open navigation" aria-expanded={mobileNavOpen} aria-controls="primary-navigation" onClick={() => setMobileNavOpen((open) => !open)}><Icon name="menu" size={18} /></button>
          <div className="breadcrumbs"><span>DRP</span><span className="crumb-separator">/</span><strong>Console</strong></div>
          <label className="global-search">
            <Icon name="search" size={16} />
            <span className="sr-only">Search this view</span>
            <input ref={searchInputRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search domains, profiles, apps..." />
            <kbd>⌘ K</kbd>
          </label>
          <div className="topbar-actions">
            <div className="theme-picker" ref={themePickerRef}>
              <button
                className="theme-trigger"
                type="button"
                ref={themeTriggerRef}
                aria-label={`Color theme: ${themeMode}`}
                aria-haspopup="menu"
                aria-expanded={themeMenuOpen}
                aria-controls="theme-menu"
                onClick={() => themeMenuOpen ? setThemeMenuOpen(false) : openThemeMenu()}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    openThemeMenu(event.key === "ArrowDown" ? themeOptions.findIndex((option) => option.value === themeMode) : (themeOptions.findIndex((option) => option.value === themeMode) - 1 + themeOptions.length) % themeOptions.length);
                  }
                }}
              >
                <Icon name={themeOptions.find((option) => option.value === themeMode)?.icon ?? "monitor"} size={16} />
                <span>{themeOptions.find((option) => option.value === themeMode)?.label ?? "System"}</span>
                <Icon className="theme-chevron" name="chevron" size={14} />
              </button>
              <div className={`theme-menu ${themeMenuOpen ? "is-open" : ""}`} id="theme-menu" role="menu" aria-label="Color theme" aria-hidden={!themeMenuOpen} onKeyDown={handleThemeMenuKeyDown}>
                {themeOptions.map((option, index) => (
                  <button
                    className={`theme-option ${themeMode === option.value ? "is-selected" : ""}`}
                    key={option.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={themeMode === option.value}
                    tabIndex={themeMenuOpen && themeMenuIndex === index ? 0 : -1}
                    ref={(element) => { themeOptionRefs.current[index] = element; }}
                    onFocus={() => setThemeMenuIndex(index)}
                    onClick={() => changeTheme(option.value)}
                  >
                    <Icon name={option.icon} size={15} />
                    <span>{option.label}</span>
                    {themeMode === option.value && <Icon className="theme-option-check" name="check" size={15} />}
                  </button>
                ))}
              </div>
            </div>
            <div className="notification-wrap">
              <button className="icon-button" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}><Icon name="bell" size={17} /><span className="notification-dot" /></button>
              <div className={`notification-popover ${notificationsOpen ? "is-open" : ""}`} role="status" aria-hidden={!notificationsOpen}><strong>No live notifications</strong><span>Alerts are unavailable in this demo workspace.</span></div>
            </div>
            <span className="topbar-divider" />
            <span className={`api-indicator ${health}`} title={healthMessage || "Local API health"}><span className="live-dot" />API {health === "online" ? "connected" : health === "checking" ? "checking" : "offline"}</span>
          </div>
        </header>

        {preferenceWarning && <div className="preference-warning" role="status">{preferenceWarning}</div>}
        <main className="main-content" id="main-content" data-scroll-target tabIndex={-1}>
          {health === "offline" && (
            <div className="api-alert" role="status">
              <Icon name="alert" size={17} />
              <span><strong>API unavailable.</strong> {healthMessage} The screens below show demo data only.</span>
              <button onClick={() => { setWorkspaceLoading(true); setHealth("checking"); setHealthMessage(""); setHealthAttempt((attempt) => attempt + 1); }}>Retry</button>
            </div>
          )}
          <div className="view-transition" key={page}>
            {page === "dashboard" && <Dashboard onNavigate={setPage} searchResults={filteredFindings} stats={apiStats} brands={brandProfiles} historyTotal={apiHistory.total} error={workspaceError} loading={workspaceLoading} health={health} />}
            {page === "profile" && <BrandProfile profile={brandProfile} draft={profileDraft} onDraftChange={setProfileDraft} onSave={saveProfile} saved={profileSaved} saving={profileSaving} error={workspaceError} />}
            {page === "social" && <SocialMonitor search={normalizedSearch} brand={brandProfile} detections={apiHistory.items.filter((item) => item.kind === "social")} onSubmit={submitCheck} busy={checkBusy} error={workspaceError} />}
            {page === "apps" && <AppMonitor search={normalizedSearch} brand={brandProfile} detections={apiHistory.items.filter((item) => item.kind === "apk")} onSubmit={submitCheck} busy={checkBusy} error={workspaceError} />}
            {page === "domains" && <DomainMonitor search={normalizedSearch} brand={brandProfile} detections={apiHistory.items.filter((item) => item.kind === "domain")} onSubmit={submitCheck} busy={checkBusy} error={workspaceError} />}
          </div>
          <footer className="page-footer"><span>Drishti DRP</span><span>Submitted metadata analysis · External feeds are not connected</span></footer>
        </main>
      </div>
    </div>
  );
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="page-heading">
      <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div>
      {action && <div className="heading-actions">{action}</div>}
    </div>
  );
}

function StatCard({ label, value, note, icon, tone = "default" }: { label: string; value: string; note: string; icon: string; tone?: string }) {
  return <article className={`stat-card ${tone}`}><div className="stat-top"><span>{label}</span><span className="stat-icon"><Icon name={icon} size={17} /></span></div><strong className="stat-value">{value}</strong><p className="stat-note">{note}</p></article>;
}

function Dashboard({ onNavigate, searchResults, stats, brands, historyTotal, error, loading, health }: { onNavigate: (page: PageId) => void; searchResults: ApiDetection[]; stats: ApiStats; brands: ApiBrandProfile[]; historyTotal: number; error: string; loading: boolean; health: HealthState }) {
  return (
    <>
      <PageHeading eyebrow="BRAND RISK · OVERVIEW" title={brands[0]?.name || "Brand protection"} description={brands[0] ? `Saved metadata checks and verified identifiers for ${brands[0].name}.` : "Create a brand profile to start reviewing submitted metadata."} action={<span className="demo-pill"><span className="live-dot" />{health === "online" ? "API connected" : "API unavailable"}</span>} />
      <section className="stats-grid" id="monitoring-summary" data-scroll-target aria-label="Monitoring summary">
        <StatCard label="Monitored brands" value={String(stats.total_brands)} note="Saved brand profiles" icon="shield" />
        <StatCard label="Saved analyses" value={String(stats.total_detections)} note="Submitted metadata checks" icon="search" />
        <StatCard label="High risk" value={String(stats.high_risk_detections)} note="Review findings and evidence" icon="alert" tone="critical" />
      </section>

      <div className="dashboard-grid">
        <section className="panel findings-panel" id="priority-findings" data-scroll-target>
          <div className="section-heading"><div><p className="eyebrow">REVIEW QUEUE</p><h2>Priority findings</h2></div><button className="text-button" onClick={() => onNavigate("social")}>View monitors <Icon name="arrow" size={15} /></button></div>
          <div className="finding-list">
            {loading ? <div className="empty-state"><strong>Loading saved analyses</strong></div> : searchResults.length ? searchResults.slice(0, 5).map((item) => (
              <article className="finding-row" key={item.id}>
                <span className={`severity-marker ${item.risk_level}`} />
                <div className="finding-main"><strong>{item.target}</strong><span>{item.kind} · {item.findings[0] || "No findings recorded"}</span></div>
                <span className={`severity-pill ${item.risk_level}`}>{item.risk_level}</span>
                <span className="finding-age"><Icon name="clock" size={13} />{new Date(item.created_at).toLocaleDateString()}</span>
              </article>
            )) : <div className="empty-state"><Icon name="search" size={20} /><strong>No saved analyses</strong><span>Run a metadata check from one of the monitor pages.</span></div>}
          </div>
          <div className="list-footnote"><span>{historyTotal} saved analyses</span><button className="subtle-button" onClick={() => onNavigate("domains")}>Open domain monitor <Icon name="arrow" size={14} /></button></div>
        </section>

        <section className="panel coverage-panel" id="monitoring-areas" data-scroll-target>
          <div className="section-heading"><div><p className="eyebrow">COVERAGE</p><h2>Monitoring areas</h2></div></div>
          <button className="coverage-link" onClick={() => onNavigate("social")}><span className="coverage-icon"><Icon name="users" /></span><span className="coverage-copy"><strong>Social profiles</strong><small>{stats.detections_by_type.social ?? 0} saved checks</small></span><Icon name="arrow" size={16} /></button>
          <button className="coverage-link" onClick={() => onNavigate("apps")}><span className="coverage-icon"><Icon name="apps" /></span><span className="coverage-copy"><strong>Mobile apps</strong><small>{stats.detections_by_type.apk ?? 0} saved checks</small></span><Icon name="arrow" size={16} /></button>
          <button className="coverage-link" onClick={() => onNavigate("domains")}><span className="coverage-icon"><Icon name="globe" /></span><span className="coverage-copy"><strong>Lookalike domains</strong><small>{stats.detections_by_type.domain ?? 0} saved checks</small></span><Icon name="arrow" size={16} /></button>
          <div className="coverage-footer"><span className="status-check"><Icon name="check" size={13} /></span>{brands.length ? `Profile: ${brands[0].name}` : "No brand profile saved"}<button onClick={() => onNavigate("profile")}>{brands.length ? "Review" : "Create"}</button></div>
        </section>
      </div>

      <section className="panel assessment-panel" id="demo-assessment" data-scroll-target>
        <div className="assessment-intro"><span className="assessment-icon"><Icon name="plus" size={20} /></span><div><h2>Submit a metadata assessment</h2><p>Use the social, app, or domain monitor to review submitted data.</p></div></div>
        {error && <p className="inline-feedback" role="alert">{error}</p>}
      </section>
    </>
  );
}

function BrandProfile({ profile, draft, onDraftChange, onSave, saved, saving, error }: { profile: ApiBrandProfile | null; draft: BrandDraft; onDraftChange: (draft: BrandDraft) => void; onSave: (event: FormEvent<HTMLFormElement>) => Promise<void>; saved: boolean; saving: boolean; error: string }) {
  return (
    <>
      <PageHeading eyebrow="BRAND CONFIGURATION · PROFILE" title="Brand profile" description="Maintain the verified names and identifiers used by metadata checks." action={<span className="quiet-badge">{profile ? `Profile ${profile.id}` : "New profile"}</span>} />
      <form onSubmit={onSave} className="profile-layout">
        <section className="panel profile-panel">
          <div className="section-heading"><div><p className="eyebrow">VERIFIED IDENTIFIERS</p><h2>Brand details</h2></div></div>
          <label className="field-label" htmlFor="brand-name">Brand name</label>
          <input id="brand-name" className="form-control" value={draft.name} onChange={(event) => onDraftChange({ ...draft, name: event.target.value })} required maxLength={120} />
          <label className="field-label" htmlFor="official-handles">Official social handles</label>
          <textarea id="official-handles" className="form-control textarea" value={draft.official_handles} onChange={(event) => onDraftChange({ ...draft, official_handles: event.target.value })} placeholder="@brand_support&#10;@brand_official" rows={4} />
          <label className="field-label" htmlFor="official-domains">Official domains</label>
          <textarea id="official-domains" className="form-control textarea" value={draft.official_domains} onChange={(event) => onDraftChange({ ...draft, official_domains: event.target.value })} placeholder="example.com&#10;brand.example" rows={4} />
          {error && <p className="action-feedback" role="alert">{error}</p>}
        </section>
        <section className="profile-side">
          <div className="panel side-panel">
            <div className="section-heading"><div><p className="eyebrow">SAVED PROFILE</p><h2>{profile?.name || "Not saved yet"}</h2></div><Icon name="shield" size={20} /></div>
            <div className="domain-chip"><Icon name="users" size={16} /><span><strong>{profile?.official_handles.length ?? 0} official handles</strong><small>Used for submitted social profiles</small></span></div>
            <div className="domain-chip"><Icon name="globe" size={16} /><span><strong>{profile?.official_domains.length ?? 0} official domains</strong><small>Used for submitted domain checks</small></span></div>
          </div>
          <div className="save-bar"><span>{saved ? <><Icon name="check" size={15} /> Profile saved</> : profile ? `Editing ${profile.name}` : "Create your first brand profile"}</span><button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving..." : profile ? "Save profile" : "Create profile"} <Icon name="arrow" size={15} /></button></div>
        </section>
      </form>
    </>
  );
}

function SocialMonitor({ search, brand, detections, onSubmit, busy, error }: { search: string; brand: ApiBrandProfile | null; detections: ApiDetection[]; onSubmit: SubmitCheck; busy: boolean; error: string }) {
  const [handles, setHandles] = useState("");
  const [platform, setPlatform] = useState("unknown");
  return (
    <>
      <PageHeading eyebrow="SUBMITTED PROFILE CHECK" title="Social monitor" description={brand ? `Compare submitted handles with ${brand.name}'s verified identifiers.` : "Create a brand profile to compare submitted handles."} action={<span className="quiet-badge">{brand?.name ?? "No saved brand"}</span>} />
      <section className="panel assessment-panel">
        <form className="assessment-form" onSubmit={(event) => { event.preventDefault(); void onSubmit("/api/detections/social", { brand_profile_id: brand?.id, profiles: handles.split(/[\n,]/).map((handle) => handle.trim()).filter(Boolean).map((handle) => ({ handle, platform })) }); }}>
          <label className="field-label" htmlFor="social-handles">Handles to review{brand ? ` for ${brand.name}` : ""}, one per line</label>
          <textarea className="form-control textarea" id="social-handles" value={handles} onChange={(event) => setHandles(event.target.value)} placeholder="@example_support" rows={3} required />
          <label className="field-label" htmlFor="social-platform">Platform</label>
          <select className="form-control" id="social-platform" value={platform} onChange={(event) => setPlatform(event.target.value)}><option value="unknown">Unknown</option><option value="X">X</option><option value="Instagram">Instagram</option><option value="LinkedIn">LinkedIn</option><option value="TikTok">TikTok</option></select>
          <button className="primary-button" type="submit" disabled={busy || !brand || !brand.official_handles.length}>{busy ? "Checking..." : "Check handles"} <Icon name="arrow" size={15} /></button>
          {!brand && <span className="field-helper">Create a brand profile before submitting social handles.</span>}
          {brand && !brand.official_handles.length && <span className="field-helper">Add official handles to your profile before submitting a check.</span>}
        </form>
        {error && <p className="action-feedback" role="alert">{error}</p>}
      </section>
      <DetectionTable items={detections} search={search} title="Saved social checks" />
      <section className="panel note-panel"><Icon name="alert" size={18} /><p><strong>Submitted handles only.</strong> This check does not query social networks or verify account ownership.</p></section>
    </>
  );
}

function AppMonitor({ search, brand, detections, onSubmit, busy, error }: { search: string; brand: ApiBrandProfile | null; detections: ApiDetection[]; onSubmit: SubmitCheck; busy: boolean; error: string }) {
  const [appName, setAppName] = useState("");
  const [packageName, setPackageName] = useState("");
  const [permissions, setPermissions] = useState("");
  return (
    <>
      <PageHeading eyebrow="SUBMITTED APP METADATA" title="App monitor" description={brand ? `Current brand profile: ${brand.name}. Review submitted app names, package identifiers, and permission names.` : "Create a brand profile to add review context for submitted app metadata."} action={<span className="quiet-badge">{brand?.name ?? "No saved brand"}</span>} />
      <section className="panel assessment-panel">
        <form className="assessment-form" onSubmit={(event) => { event.preventDefault(); void onSubmit("/api/detections/apps", { app_name: appName, package_name: packageName || null, permissions: permissions.split(/[\n,]/).map((permission) => permission.trim()).filter(Boolean) }); }}>
          <label className="field-label" htmlFor="app-name">App name{brand ? ` for ${brand.name}` : ""}</label>
          <input className="form-control" id="app-name" value={appName} onChange={(event) => setAppName(event.target.value)} placeholder={brand ? `${brand.name} app listing` : "App listing name"} required maxLength={200} />
          <label className="field-label" htmlFor="package-name">Package name</label>
          <input className="form-control" id="package-name" value={packageName} onChange={(event) => setPackageName(event.target.value)} maxLength={256} />
          <label className="field-label" htmlFor="app-permissions">Permission names, one per line</label>
          <textarea className="form-control textarea" id="app-permissions" value={permissions} onChange={(event) => setPermissions(event.target.value)} placeholder="android.permission.SEND_SMS" rows={3} />
          <button className="primary-button" type="submit" disabled={busy}>{busy ? "Checking..." : "Assess metadata"} <Icon name="arrow" size={15} /></button>
        </form>
        {error && <p className="action-feedback" role="alert">{error}</p>}
      </section>
      <DetectionTable items={detections} search={search} title="Saved app checks" />
      <section className="panel note-panel"><Icon name="alert" size={18} /><p><strong>Permission heuristics only.</strong> The APK binary is not uploaded, inspected, or compared with a malware database.</p></section>
    </>
  );
}

function DomainMonitor({ search, brand, detections, onSubmit, busy, error }: { search: string; brand: ApiBrandProfile | null; detections: ApiDetection[]; onSubmit: SubmitCheck; busy: boolean; error: string }) {
  const [domain, setDomain] = useState("");
  return (
    <>
      <PageHeading eyebrow="SUBMITTED DOMAIN CHECK" title="Lookalike domains" description={brand ? `Compare submitted domains against ${brand.name}'s official domains.` : "Create a brand profile and add an official domain to begin."} action={<span className="quiet-badge">{brand?.name ?? "No saved brand"}</span>} />
      <section className="panel assessment-panel">
        <form className="assessment-form" onSubmit={(event) => { event.preventDefault(); if (brand) void onSubmit("/api/detections/domains", { brand_profile_id: brand.id, domain }); }}>
          <label className="field-label" htmlFor="domain-input">Domain or URL to compare with {brand?.name ?? "your brand"}</label>
          <input className="form-control" id="domain-input" value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="suspect-example.com" required maxLength={253} />
          <button className="primary-button" type="submit" disabled={busy || !brand || !brand.official_domains.length}>{busy ? "Checking..." : "Compare domain"} <Icon name="arrow" size={15} /></button>
          {!brand && <span className="field-helper">Create a brand profile before submitting a domain.</span>}
          {brand && !brand.official_domains.length && <span className="field-helper">Add an official domain to your profile before submitting a check.</span>}
        </form>
        {error && <p className="action-feedback" role="alert">{error}</p>}
      </section>
      <DetectionTable items={detections} search={search} title="Saved domain checks" />
      <section className="panel note-panel"><Icon name="alert" size={18} /><p><strong>String similarity only.</strong> This check does not query DNS, registrar data, or website content.</p></section>
    </>
  );
}

function DetectionTable({ items, search, title }: { items: ApiDetection[]; search: string; title: string }) {
  const visible = items.filter((item) => `${item.target} ${item.risk_level} ${item.findings.join(" ")}`.toLowerCase().includes(search));
  return (
    <section className="panel table-panel">
      <div className="section-heading table-heading"><div><p className="eyebrow">SAVED HISTORY</p><h2>{title}</h2></div><span className="quiet-badge">{visible.length} shown</span></div>
      {visible.length ? <div className="table-scroll"><table><thead><tr><th>Target</th><th>Risk</th><th>Findings</th><th>Created</th></tr></thead><tbody>{visible.map((item) => <tr key={item.id}><td><strong>{item.target}</strong><small>{item.analysis_scope.replaceAll("_", " ")}</small></td><td><span className={`severity-pill ${item.risk_level}`}>{item.risk_level} · {item.risk_score}</span></td><td>{item.findings.join(" ")}</td><td>{new Date(item.created_at).toLocaleString()}</td></tr>)}</tbody></table></div> : <div className="empty-state"><Icon name="search" size={20} /><strong>No saved checks</strong><span>Submit data above to run and save an analysis.</span></div>}
    </section>
  );
}

export default App;
