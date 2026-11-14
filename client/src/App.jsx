import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Route, Routes, useNavigate, useSearchParams } from "react-router-dom";

import "./features.css";

const apiUrl = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/$/, "");
const managedItemsKey = "refound-managed-items";
const staffTokenKey = "refound-staff-token";
const categories = ["Accessories", "Bags", "Clothing", "Electronics", "Keys", "Other"];
const maxPhotoSize = 5 * 1024 * 1024;
const photoTypes = ["image/jpeg", "image/png", "image/webp"];
const itemStatusLabels = {
  lost_reported: "Lost report",
  with_finder: "With finder",
  received_by_staff: "Received by staff",
  verified: "Verified",
  awaiting_claim_review: "Awaiting claim review",
  approved_for_pickup: "Approved for pickup",
  resolved: "Resolved",
};

function todayDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
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

function itemPhotoUrl(photoUrl) {
  if (!photoUrl) return "";
  const apiRoot = apiUrl.replace(/\/api\/?$/, "") || window.location.origin;
  return new URL(photoUrl, apiRoot).href;
}

function ItemPhoto({ item }) {
  if (!item.photo_url) return null;
  return <img className="item-photo" src={itemPhotoUrl(item.photo_url)} alt={`Photo of ${item.title}`} loading="lazy" />;
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
        <Link className="nav-cta" to="/report?type=lost">Report an item <ArrowIcon /></Link>
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
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [claimingItem, setClaimingItem] = useState(null);

  useEffect(() => {
    let active = true;
    apiRequest("/items")
      .then(({ items: recentItems }) => active && setItems(recentItems.slice(0, 6)))
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  return (
    <main className="home-page page-width">
      <section className="home-actions" aria-label="Get started">
        <Link className="home-report-button" to="/report?type=lost">
          <span className="home-report-icon" aria-hidden="true">−</span>
          <span>Report lost item</span>
        </Link>
        <Link className="home-report-button found" to="/report?type=found">
          <span className="home-report-icon" aria-hidden="true">＋</span>
          <span>Report found item</span>
        </Link>
      </section>

      <section className="home-feed" aria-labelledby="feed-title">
        <div className="feed-heading">
          <div>
            <span className="eyebrow">Community board</span>
            <h1 id="feed-title">Recent reports</h1>
          </div>
          <Link className="feed-view-all" to="/browse">View all <ArrowIcon /></Link>
        </div>
        {loading ? <p className="feed-state">Loading recent reports…</p> : null}
        <ErrorMessage>{error}</ErrorMessage>
        {!loading && !error && !items.length ? (
          <div className="feed-empty">
            <span className="feed-empty-icon" aria-hidden="true">⌕</span>
            <b>No reports yet</b>
            <span>New lost and found reports will appear here.</span>
            <ApiStatus />
          </div>
        ) : null}
        <div className="home-feed-list">
          {items.map((item) => <ItemCard key={item.id} item={item} onClaim={setClaimingItem} />)}
        </div>
      </section>
      {claimingItem ? <ClaimForm item={claimingItem} onClose={() => setClaimingItem(null)} /> : null}
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

function ErrorMessage({ children, className = "", id }) {
  return children ? <p id={id} className={`form-message error-message ${className}`} role="alert">{children}</p> : null;
}

function SuccessMessage({ children }) {
  return children ? <p className="form-message success-message" role="status">{children}</p> : null;
}

function SuccessToast({ message, onClose }) {
  useEffect(() => {
    if (!message) return undefined;
    const timeout = window.setTimeout(() => onClose(""), 6000);
    return () => window.clearTimeout(timeout);
  }, [message, onClose]);

  if (!message) return null;
  return (
    <div className="success-toast" role="status" aria-live="polite">
      <span className="success-toast-icon" aria-hidden="true">✓</span>
      <span>{message}</span>
      <button className="success-toast-close" type="button" onClick={() => onClose("")} aria-label="Dismiss notification">×</button>
    </div>
  );
}

function ItemCard({ item, onClaim }) {
  return (
    <article className="item-card">
      <div className="item-card-top">
        <span className={`item-type ${item.type}`}>{item.type}</span>
        <span className="item-category">{item.category}</span>
      </div>
      <span className={`status-badge ${item.status}`}>{itemStatusLabels[item.status] || item.status}</span>
      <ItemPhoto item={item} />
      <h2>{item.title}</h2>
      <p className="item-description">{item.description}</p>
      <div className="item-meta">
        <span>⌖ {item.location}</span>
        <span>{new Date(item.event_date).toLocaleDateString()}</span>
      </div>
      {item.type === "found" ? (
        <button className="button button-dark item-action" type="button" disabled={item.status === "approved_for_pickup"} onClick={() => onClaim(item)}>
          {item.status === "approved_for_pickup" ? "Pickup already approved" : "This could be mine"}
        </button>
      ) : (
        <Link className="button button-dark item-action" to="/report?type=found">I found this item</Link>
      )}
    </article>
  );
}

function ClaimForm({ item, onClose }) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [toastMessage, setToastMessage] = useState("");
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
      setSuccess("Your claim was sent privately to campus staff for review.");
      setToastMessage("Your claim was recorded successfully.");
      formElement.reset();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <form className="claim-form" onSubmit={submitClaim}>
        <div className="form-section-heading">
          <div><b>Send a claim for {item.title}</b><span>Your claim is reviewed privately by campus staff.</span></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close claim form">×</button>
        </div>
        <label>Your name<input name="claimantName" required maxLength="100" /></label>
        <label>Email address<input name="claimantEmail" type="email" required maxLength="254" /></label>
        <label>How can you identify this item?<textarea name="message" rows="3" required maxLength="2000" /></label>
        <ErrorMessage>{error}</ErrorMessage>
        <SuccessMessage>{success}</SuccessMessage>
        <button className="button button-dark" type="submit" disabled={saving}>{saving ? "Sending…" : "Send claim"}</button>
      </form>
      <SuccessToast message={toastMessage} onClose={setToastMessage} />
    </>
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
  const [searchParams] = useSearchParams();
  const [type, setType] = useState(() => searchParams.get("type") === "found" ? "found" : "lost");
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);
  const [toastMessage, setToastMessage] = useState("");
  const [backupToken, setBackupToken] = useState("");
  const [matches, setMatches] = useState([]);
  const [matchError, setMatchError] = useState("");
  const [saving, setSaving] = useState(false);
  const photoInput = useRef(null);

  useEffect(() => {
    if (!photo) {
      setPhotoPreview("");
      return undefined;
    }
    const previewUrl = URL.createObjectURL(photo);
    setPhotoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [photo]);

  function choosePhoto(event) {
    const selected = event.target.files?.[0];
    setPhotoError("");
    if (!selected) {
      setPhoto(null);
      return;
    }
    if (!photoTypes.includes(selected.type)) {
      setPhotoError("Choose a JPG, PNG, or WebP image.");
      event.target.value = "";
      setPhoto(null);
      return;
    }
    if (selected.size > maxPhotoSize) {
      setPhotoError("This photo is larger than 5 MB. Choose a smaller image.");
      event.target.value = "";
      setPhoto(null);
      return;
    }
    setPhoto(selected);
  }

  function removePhoto() {
    setPhoto(null);
    setPhotoError("");
    if (photoInput.current) photoInput.current.value = "";
  }

  async function submitReport(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    if (!photo) form.delete("photo");
    form.set("type", type);
    setError("");
    setCreated(null);
    setBackupToken("");
    setMatches([]);
    setMatchError("");
    setSaving(true);
    try {
      const { item, managementToken } = await apiRequest("/items", {
        method: "POST",
        body: form,
      });
      setCreated(item);
      setToastMessage("Your report was recorded successfully.");
      formElement.reset();
      setPhoto(null);
      setPhotoError("");
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
          <fieldset className="form-wide report-type-picker">
            <legend>What are you reporting?</legend>
            <div className="report-type-buttons">
              <button
                className={`report-type-button${type === "lost" ? " selected" : ""}`}
                type="button"
                aria-pressed={type === "lost"}
                onClick={() => setType("lost")}
              >
                <span aria-hidden="true">−</span>
                I lost an item
              </button>
              <button
                className={`report-type-button${type === "found" ? " selected" : ""}`}
                type="button"
                aria-pressed={type === "found"}
                onClick={() => setType("found")}
              >
                <span aria-hidden="true">＋</span>
                I found an item
              </button>
            </div>
          </fieldset>
          <label>Category
            <select name="category" required defaultValue="">
              <option value="" disabled>Choose a category</option>
              {categories.map((category) => <option key={category}>{category}</option>)}
            </select>
          </label>
          <label className="form-wide">Item name<input name="title" required maxLength="120" placeholder="e.g. Blue water bottle" /></label>
          <label className="form-wide">Description<textarea name="description" rows="4" required maxLength="2000" placeholder="Details that could identify the item" /></label>
          <label className="form-wide photo-upload">
            <span id="photo-upload-label">Add a photo <span className="optional-label">(optional)</span></span>
            <span className="photo-upload-help" id="photo-upload-help">A clear photo helps others recognize the item. JPG, PNG, or WebP · up to 5 MB.</span>
            <input ref={photoInput} name="photo" type="file" accept="image/jpeg,image/png,image/webp" aria-labelledby="photo-upload-label" aria-describedby={`photo-upload-help${photoError ? " photo-error" : ""}`} aria-invalid={Boolean(photoError)} onChange={choosePhoto} />
          </label>
          {photo ? (
            <div className="form-wide photo-preview">
              <img src={photoPreview} alt={`Preview of ${photo.name}`} />
              <div><b>{photo.name}</b><span>{(photo.size / 1024 / 1024).toFixed(1)} MB</span></div>
              <button className="button button-light" type="button" onClick={removePhoto}>Remove photo</button>
            </div>
          ) : null}
          <ErrorMessage id="photo-error" className="form-wide">{photoError}</ErrorMessage>
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
      <SuccessToast message={toastMessage} onClose={setToastMessage} />
    </main>
  );
}

function ManagedReport({ report, onChange }) {
  const { item, claims } = report;

  return (
    <article className="managed-card">
      <div className="managed-heading">
        <div>
          <span className={`item-type ${item.type}`}>{item.type}</span>
          <h2>{item.title}</h2><p>{item.category} · {item.location} · {itemStatusLabels[item.status] || item.status}</p>
        </div>
      </div>
      {item.storage_location ? <p className="private-contact">Stored at: {item.storage_location}</p> : null}
      <ItemPhoto item={item} />
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
          </div>
        ))}
      </div>
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

  return (
    <main className="feature-page page-width">
      <PageIntro label="Manage reports" description="View reports and claims. Campus staff handle verification, claim decisions, and item status.">Your reports</PageIntro>
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
        {reports.map((report) => <ManagedReport key={report.item.id} report={report} />)}
      </div>
    </main>
  );
}

function staffRequest(path, token, options = {}) {
  return apiRequest(path, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}` },
  });
}

function StaffLoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submitLogin(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    setSaving(true);
    try {
      const { token } = await apiRequest("/staff/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
      });
      sessionStorage.setItem(staffTokenKey, token);
      navigate("/staff", { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="feature-page page-width">
      <PageIntro label="Campus staff" description="Sign in to receive, verify, and manage found items and claims.">
        Staff login
      </PageIntro>
      <form className="feature-form staff-login-form" onSubmit={submitLogin}>
        <label>Username or email<input name="username" required autoComplete="username" maxLength="254" /></label>
        <label>Password<input name="password" type="password" required autoComplete="current-password" maxLength="256" /></label>
        <ErrorMessage>{error}</ErrorMessage>
        <button className="button button-dark" type="submit" disabled={saving}>{saving ? "Signing in…" : "Sign in"}</button>
      </form>
    </main>
  );
}

function StaffItemCard({ item, busy, onAction }) {
  const [storageLocation, setStorageLocation] = useState(item.storage_location || "");
  const pendingClaims = item.claims.filter((claim) => claim.status === "pending");

  return (
    <article className="managed-card staff-item-card">
      <div className="managed-heading">
        <div>
          <span className={`item-type ${item.type}`}>{item.type}</span>
          <span className={`status-badge ${item.status}`}>{itemStatusLabels[item.status] || item.status}</span>
          <h2>{item.title}</h2>
          <p>{item.category} · {item.location} · {new Date(item.event_date).toLocaleDateString()}</p>
        </div>
      </div>
      <p>{item.description}</p>
      <ItemPhoto item={item} />
      <p className="private-contact">Reporter: {item.contact_name} · <a href={`mailto:${item.contact_email}`}>{item.contact_email}</a></p>
      {item.storage_location ? <p className="private-contact">Storage: {item.storage_location}</p> : null}
      {item.status === "with_finder" && item.type === "found" ? (
        <form className="staff-action-row" onSubmit={(event) => {
          event.preventDefault();
          onAction(item.id, "receive", { storageLocation });
        }}>
          <label>Storage location<input value={storageLocation} onChange={(event) => setStorageLocation(event.target.value)} required maxLength="160" placeholder="Office, cabinet, or room" /></label>
          <button className="button button-dark" type="submit" disabled={busy}>Receive item</button>
        </form>
      ) : null}
      {item.status === "received_by_staff" ? (
        <button className="button button-dark" type="button" disabled={busy} onClick={() => onAction(item.id, "verify")}>Verify item details</button>
      ) : null}
      {(item.status === "verified" || item.status === "awaiting_claim_review") && pendingClaims.length ? (
        <div className="staff-action-row">
          <p>Verify claim details before approving. Approval enables pickup.</p>
        </div>
      ) : null}
      {item.status === "approved_for_pickup" ? (
        <button className="button button-dark" type="button" disabled={busy} onClick={() => onAction(item.id, "resolve")}>Mark returned / resolved</button>
      ) : null}
      {item.status === "resolved" ? (
        <button className="button button-light" type="button" disabled={busy} onClick={() => onAction(item.id, "reopen")}>Reopen case</button>
      ) : null}
      <h3>Claims ({item.claims.length})</h3>
      {!item.claims.length ? <p className="empty-inline">No claims yet.</p> : null}
      <div className="claim-list">
        {item.claims.map((claim) => (
          <div className="claim-card" key={claim.id}>
            <div className="claim-details">
              <b>{claim.claimant_name}<span className={`claim-status ${claim.status}`}>{claim.status}</span></b>
              <a href={`mailto:${claim.claimant_email}`}>{claim.claimant_email}</a>
              <p>{claim.message}</p>
            </div>
            {claim.status === "pending" && (
              ["verified", "awaiting_claim_review"].includes(item.status) ||
              (item.type === "lost" && item.status === "lost_reported")
            ) ? (
              <div className="claim-actions">
                <button className="button button-light" type="button" disabled={busy} onClick={() => onAction(item.id, "claim", { claimId: claim.id, status: "declined" })}>Reject</button>
                {item.type === "found" ? (
                  <button className="button button-dark" type="button" disabled={busy} onClick={() => onAction(item.id, "claim", { claimId: claim.id, status: "approved" })}>Approve for pickup</button>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </article>
  );
}

function StaffDashboardPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState(() => sessionStorage.getItem(staffTokenKey) || "");
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState("active");
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyItem, setBusyItem] = useState(null);

  useEffect(() => {
    let active = true;
    async function loadDashboard() {
      if (!token) {
        navigate("/staff/login", { replace: true });
        return;
      }
      try {
        const session = await staffRequest("/staff/auth/session", token);
        const result = await staffRequest(`/staff/items?status=${encodeURIComponent(status)}`, token);
        if (active) {
          setUsername(session.username);
          setItems(result.items);
          setError("");
        }
      } catch (requestError) {
        if (active) {
          setError(requestError.message);
          if (requestError.message === "Staff login required.") {
            sessionStorage.removeItem(staffTokenKey);
            navigate("/staff/login", { replace: true });
          }
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    setLoading(true);
    loadDashboard();
    return () => { active = false; };
  }, [token, status, navigate]);

  async function performAction(itemId, action, body = {}) {
    setBusyItem(itemId);
    setError("");
    const endpoint = action === "claim"
      ? `/staff/items/${itemId}/claims/${body.claimId}`
      : `/staff/items/${itemId}/${action}`;
    try {
      await staffRequest(endpoint, token, {
        method: "PATCH",
        ...(action === "receive" || action === "claim" ? { body: JSON.stringify(action === "receive" ? body : { status: body.status }) } : {}),
      });
      const result = await staffRequest(`/staff/items?status=${encodeURIComponent(status)}`, token);
      setItems(result.items);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyItem(null);
    }
  }

  async function logout() {
    try {
      await staffRequest("/staff/auth/logout", token, { method: "POST" });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      sessionStorage.removeItem(staffTokenKey);
      setToken("");
      navigate("/staff/login", { replace: true });
    }
  }

  return (
    <main className="feature-page page-width">
      <PageIntro label="Staff operations" description="Receive found items, verify details, and review claims before approving pickup.">
        Staff dashboard
      </PageIntro>
      <div className="staff-dashboard-toolbar">
        <span>Signed in as {username || "staff"}</span>
        <label>Filter by status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="active">All active</option>
            {Object.entries(itemStatusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            <option value="all">All reports</option>
          </select>
        </label>
        <button className="button button-light" type="button" onClick={logout}>Sign out</button>
      </div>
      <ErrorMessage>{error}</ErrorMessage>
      {loading ? <p className="empty-state">Loading reports…</p> : null}
      {!loading && !items.length ? <div className="empty-state"><b>No reports in this view.</b></div> : null}
      <div className="managed-list">
        {items.map((item) => (
          <StaffItemCard key={item.id} item={item} busy={busyItem === item.id} onAction={performAction} />
        ))}
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
        <Route path="/staff/login" element={<StaffLoginPage />} />
        <Route path="/staff" element={<StaffDashboardPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Footer />
    </>
  );
}
