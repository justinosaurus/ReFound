import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes } from "react-router-dom";

import "./features.css";

const apiUrl = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/$/, "");
const managedItemsKey = "refound-managed-items";
const categories = ["Accessories", "Bags", "Clothing", "Electronics", "Keys", "Other"];

function todayDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("The server returned an unreadable response.");
  }
  if (!response.ok) throw new Error(payload.error || "The request could not be completed.");
  return payload;
}

function ArrowIcon() {
  return <span aria-hidden="true" className="arrow">→</span>;
}

function Header() {
  return (
    <header className="site-header">
      <div className="nav-wrap">
        <Link className="brand" to="/" aria-label="ReFound home">
          <span className="brand-mark">r<span>.</span></span>
          <span>ReFound</span>
        </Link>
        <nav className="main-nav" aria-label="Main navigation">
          <NavLink to="/browse">Browse</NavLink>
          <NavLink to="/report">Report</NavLink>
          <NavLink to="/manage">My reports</NavLink>
        </nav>
        <Link className="nav-cta" to="/report">Report an item <ArrowIcon /></Link>
      </div>
    </header>
  );
}

function ApiStatus() {
  const [status, setStatus] = useState("checking");
  useEffect(() => {
    let active = true;
    apiRequest("/health")
      .then(() => active && setStatus("online"))
      .catch(() => active && setStatus("offline"));
    return () => { active = false; };
  }, []);
  return <span className={`api-status ${status}`}><i /> API {status}</span>;
}

function HomePage() {
  return (
    <main className="home-page page-width">
      <section className="home-heading">
        <span className="eyebrow">LOST AND FOUND</span>
        <h1>Lost or found<br />an item?</h1>
        <p>Search current reports or post an item to the community board.</p>
      </section>
      <section className="home-actions" aria-label="Get started">
        <Link className="action-card" to="/browse">
          <span className="action-card-icon" aria-hidden="true">⌕</span>
          <span className="action-card-copy"><b>Browse reports</b><span>Search lost and found items</span></span>
          <ArrowIcon />
        </Link>
        <Link className="action-card action-card-primary" to="/report">
          <span className="action-card-icon" aria-hidden="true">＋</span>
          <span className="action-card-copy"><b>Report an item</b><span>Post a lost or found item</span></span>
          <ArrowIcon />
        </Link>
        <Link className="action-card" to="/manage">
          <span className="action-card-icon" aria-hidden="true">▤</span>
          <span className="action-card-copy"><b>Manage reports</b><span>Review claims for your reports</span></span>
          <ArrowIcon />
        </Link>
      </section>
      <section className="home-status-card">
        <div><b>How it works</b><p>Browse reports, submit a claim with identifying details, or post an item and review responses.</p></div>
        <ApiStatus />
      </section>
    </main>
  );
}

function PageIntro({ label, description, children }) {
  return (
    <div className="feature-intro">
      <span className="eyebrow">{label}</span>
      <h1>{children}</h1>
      <p>{description}</p>
    </div>
  );
}

function ErrorMessage({ children }) {
  return children ? <p className="form-message error-message" role="alert">{children}</p> : null;
}

function SuccessMessage({ children }) {
  return children ? <p className="form-message success-message" role="status">{children}</p> : null;
}

function ItemCard({ item, onClaim }) {
  return (
    <article className="item-card">
      <div className="item-card-top">
        <span className={`item-type ${item.type}`}>{item.type}</span>
        <span className="item-category">{item.category}</span>
      </div>
      <h2>{item.title}</h2>
      <p className="item-description">{item.description}</p>
      <div className="item-meta">
        <span>⌖ {item.location}</span>
        <span>{new Date(item.event_date).toLocaleDateString()}</span>
      </div>
      <button className="button button-dark item-action" type="button" onClick={() => onClaim(item)}>
        {item.type === "found" ? "This could be mine" : "I may have found this"}
      </button>
    </article>
  );
}

function ClaimForm({ item, onClose }) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  async function submitClaim(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await apiRequest(`/items/${item.id}/claims`, {
        method: "POST",
        body: JSON.stringify({
          claimantName: form.get("claimantName"),
          claimantEmail: form.get("claimantEmail"),
          message: form.get("message"),
        }),
      });
      setSuccess("Your claim was sent privately to the reporter.");
      formElement.reset();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="claim-form" onSubmit={submitClaim}>
      <div className="form-section-heading">
        <div><b>Send a claim for {item.title}</b><span>Your email is shared only with the reporter.</span></div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close claim form">×</button>
      </div>
      <label>Your name<input name="claimantName" required maxLength="100" /></label>
      <label>Email address<input name="claimantEmail" type="email" required maxLength="254" /></label>
      <label>How can you identify this item?<textarea name="message" rows="3" required maxLength="2000" /></label>
      <ErrorMessage>{error}</ErrorMessage>
      <SuccessMessage>{success}</SuccessMessage>
      <button className="button button-dark" type="submit" disabled={saving}>{saving ? "Sending…" : "Send claim"}</button>
    </form>
  );
}

function BrowsePage() {
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [claimingItem, setClaimingItem] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (type !== "all") params.set("type", type);
    if (submittedSearch.trim()) params.set("q", submittedSearch.trim());
    apiRequest(`/items?${params}`)
      .then(({ items: results }) => active && setItems(results))
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [type, submittedSearch]);

  function submitSearch(event) {
    event.preventDefault();
    setSubmittedSearch(search);
  }

  return (
    <main className="feature-page page-width">
      <PageIntro label="Browse reports" description="Search open lost and found reports. Reporter contact details are private.">
        Browse lost<br />and found items
      </PageIntro>
      <form className="browse-toolbar" onSubmit={submitSearch}>
        <label className="search-field">
          <span className="sr-only">Search reports</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by item or place" maxLength="100" />
        </label>
        <label>
          <span className="sr-only">Report type</span>
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="all">Lost &amp; found</option>
            <option value="found">Found items</option>
            <option value="lost">Lost items</option>
          </select>
        </label>
        <button className="button button-dark" type="submit">Search</button>
      </form>
      <ErrorMessage>{error}</ErrorMessage>
      {loading ? <p className="empty-state">Loading reports…</p> : null}
      {!loading && !error && !items.length ? (
        <div className="empty-state">
          <b>No open reports found.</b><span>Try another search or post an item.</span>
          <Link className="text-link" to="/report">Report an item <ArrowIcon /></Link>
        </div>
      ) : null}
      <div className="item-grid">
        {items.map((item) => <ItemCard key={item.id} item={item} onClaim={setClaimingItem} />)}
      </div>
      {claimingItem ? <ClaimForm item={claimingItem} onClose={() => setClaimingItem(null)} /> : null}
    </main>
  );
}

function MatchResults({ matches, error }) {
  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (!matches.length) return <p className="empty-state compact">No likely matches yet.</p>;
  return (
    <div className="match-list">
      {matches.map((item) => (
        <article className="match-card" key={item.id}>
          <span className={`item-type ${item.type}`}>{item.type}</span>
          <div><b>{item.title}</b><span>{item.category} · {item.location}</span></div>
          <span className="match-score">{item.matchScore}% match</span>
        </article>
      ))}
    </div>
  );
}

function ReportPage() {
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);
  const [backupToken, setBackupToken] = useState("");
  const [matches, setMatches] = useState([]);
  const [matchError, setMatchError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submitReport(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setError("");
    setCreated(null);
    setBackupToken("");
    setMatches([]);
    setMatchError("");
    setSaving(true);
    try {
      const { item, managementToken } = await apiRequest("/items", {
        method: "POST",
        body: JSON.stringify({
          type: form.get("type"),
          title: form.get("title"),
          description: form.get("description"),
          category: form.get("category"),
          location: form.get("location"),
          eventDate: form.get("eventDate"),
          contactName: form.get("contactName"),
          contactEmail: form.get("contactEmail"),
        }),
      });
      setCreated(item);
      formElement.reset();
      try {
        const managed = JSON.parse(localStorage.getItem(managedItemsKey) || "{}");
        managed[item.id] = managementToken;
        localStorage.setItem(managedItemsKey, JSON.stringify(managed));
      } catch {
        setBackupToken(managementToken);
      }
      try {
        const result = await apiRequest(`/items/${item.id}/matches`);
        setMatches(result.matches);
      } catch (requestError) {
        setMatchError(`Report saved, but match suggestions failed: ${requestError.message}`);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="feature-page page-width">
      <PageIntro label="Create a report" description="Add item details and private contact information.">
        Report a lost<br />or found item
      </PageIntro>
      <form className="feature-form report-form" onSubmit={submitReport}>
        <div className="form-grid">
          <label>Report type
            <select name="type" required defaultValue="lost">
              <option value="lost">I lost an item</option><option value="found">I found an item</option>
            </select>
          </label>
          <label>Category
            <select name="category" required defaultValue="">
              <option value="" disabled>Choose a category</option>
              {categories.map((category) => <option key={category}>{category}</option>)}
            </select>
          </label>
          <label className="form-wide">Item name<input name="title" required maxLength="120" placeholder="e.g. Blue water bottle" /></label>
          <label className="form-wide">Description<textarea name="description" rows="4" required maxLength="2000" placeholder="Details that could identify the item" /></label>
          <label>Location<input name="location" required maxLength="160" placeholder="Place or nearby landmark" /></label>
          <label>Date<input name="eventDate" type="date" required max={todayDate()} defaultValue={todayDate()} /></label>
          <label>Your name<input name="contactName" required maxLength="100" /></label>
          <label>Your email<input name="contactEmail" type="email" required maxLength="254" /></label>
        </div>
        <p className="privacy-note">Contact details are private and shared only with people who send a claim.</p>
        <ErrorMessage>{error}</ErrorMessage>
        <button className="button button-dark" type="submit" disabled={saving}>{saving ? "Publishing…" : "Publish report"} <ArrowIcon /></button>
      </form>
      {created ? (
        <section className="result-panel" aria-live="polite">
          <SuccessMessage>{backupToken ? "Report published. Save the private management key below." : "Report published. Management access is saved in this browser."}</SuccessMessage>
          {backupToken ? <div className="token-warning"><p>Save this key privately to manage your report:</p><code>{backupToken}</code></div> : null}
          <h2>Possible matches</h2>
          <MatchResults matches={matches} error={matchError} />
          <Link className="text-link" to="/manage">Manage your reports <ArrowIcon /></Link>
        </section>
      ) : null}
    </main>
  );
}

function ManagedReport({ report, onChange }) {
  const { item, claims } = report;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function updateStatus(status) {
    setBusy(true);
    setError("");
    try {
      const result = await apiRequest(`/manage/${item.id}/status`, {
        method: "PATCH",
        headers: { "X-Management-Token": report.managementToken },
        body: JSON.stringify({ status }),
      });
      onChange({ ...report, item: result.item });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function updateClaim(claimId, status) {
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/manage/${item.id}/claims/${claimId}`, {
        method: "PATCH",
        headers: { "X-Management-Token": report.managementToken },
        body: JSON.stringify({ status }),
      });
      onChange({ ...report, claims: claims.map((claim) => claim.id === claimId ? { ...claim, status } : claim) });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="managed-card">
      <div className="managed-heading">
        <div>
          <span className={`item-type ${item.type}`}>{item.type}</span>
          <h2>{item.title}</h2><p>{item.category} · {item.location} · {item.status}</p>
        </div>
        <button className="button button-light" type="button" disabled={busy} onClick={() => updateStatus(item.status === "open" ? "resolved" : "open")}>
          Mark {item.status === "open" ? "resolved" : "open"}
        </button>
      </div>
      <p className="private-contact">Your contact: <a href={`mailto:${item.contact_email}`}>{item.contact_email}</a></p>
      <h3>Claims ({claims.length})</h3>
      {!claims.length ? <p className="empty-inline">No claims yet.</p> : null}
      <div className="claim-list">
        {claims.map((claim) => (
          <div className="claim-card" key={claim.id}>
            <div className="claim-details">
              <b>{claim.claimant_name}<span className={`claim-status ${claim.status}`}>{claim.status}</span></b>
              <a href={`mailto:${claim.claimant_email}`}>{claim.claimant_email}</a>
              <p>{claim.message}</p>
            </div>
            {claim.status === "pending" ? (
              <div className="claim-actions">
                <button className="button button-light" type="button" disabled={busy} onClick={() => updateClaim(claim.id, "declined")}>Decline</button>
                <button className="button button-dark" type="button" disabled={busy} onClick={() => updateClaim(claim.id, "accepted")}>Accept</button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <ErrorMessage>{error}</ErrorMessage>
    </article>
  );
}

function ManagePage() {
  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadReports() {
      try {
        const saved = JSON.parse(localStorage.getItem(managedItemsKey) || "{}");
        const results = await Promise.all(Object.entries(saved).map(async ([id, managementToken]) => {
          try {
            const result = await apiRequest(`/manage/${id}`, { headers: { "X-Management-Token": managementToken } });
            return { ...result, managementToken };
          } catch (requestError) {
            return { id, error: requestError.message };
          }
        }));
        if (active) {
          setReports(results.filter((report) => report.item));
          if (results.some((report) => report.error)) setError("Some saved reports could not be loaded.");
        }
      } catch (requestError) {
        if (active) setError(`Could not read saved report access: ${requestError.message}`);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadReports();
    return () => { active = false; };
  }, []);

  function updateReport(updated) {
    setReports((current) => current.map((report) => report.item.id === updated.item.id ? updated : report));
  }

  return (
    <main className="feature-page page-width">
      <PageIntro label="Manage reports" description="Review claims, contact claimants, and update report status.">Your reports</PageIntro>
      <p className="privacy-note">Reports are available in the browser where they were created. Keep this device secure.</p>
      <ErrorMessage>{error}</ErrorMessage>
      {loading ? <p className="empty-state">Loading your reports…</p> : null}
      {!loading && !reports.length ? (
        <div className="empty-state">
          <b>No saved reports in this browser.</b><span>Publish a report here to manage claims and status.</span>
          <Link className="text-link" to="/report">Report an item <ArrowIcon /></Link>
        </div>
      ) : null}
      <div className="managed-list">
        {reports.map((report) => <ManagedReport key={report.item.id} report={report} onChange={updateReport} />)}
      </div>
    </main>
  );
}

function Footer() {
  return <footer className="site-footer"><div className="page-width footer-inner"><Link className="brand" to="/"><span className="brand-mark">r<span>.</span></span><span>ReFound</span></Link><span>Lost and found reports</span></div></footer>;
}

function NotFoundPage() {
  return (
    <main className="feature-page page-width">
      <PageIntro label="Page not found" description="The requested page does not exist.">Page not found</PageIntro>
      <Link className="button button-dark" to="/browse">Browse reports <ArrowIcon /></Link>
    </main>
  );
}

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/browse" element={<BrowsePage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/manage" element={<ManagePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Footer />
    </>
  );
}
