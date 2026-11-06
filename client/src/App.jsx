import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes } from "react-router-dom";

const apiUrl = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/$/, "");

function ArrowIcon({ diagonal = false }) {
  return <span aria-hidden="true" className="arrow">{diagonal ? "↗" : "→"}</span>;
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
          <NavLink to="/browse">Browse items</NavLink>
          <NavLink to="/report">Report an item</NavLink>
        </nav>
        <Link className="nav-cta" to="/report">I found something <ArrowIcon diagonal /></Link>
      </div>
    </header>
  );
}

function ApiStatus() {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let active = true;
    fetch(`${apiUrl}/health`)
      .then((response) => {
        if (!response.ok) throw new Error("API unavailable");
        return response.json();
      })
      .then(() => active && setStatus("online"))
      .catch(() => active && setStatus("offline"));
    return () => { active = false; };
  }, []);

  return <span className={`api-status ${status}`}><i /> API {status}</span>;
}

function HomePage() {
  return (
    <main>
      <section className="hero page-width">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> GOOD THINGS FIND THEIR WAY BACK</div>
          <h1>Lost something?<br /><em>Let’s find</em> its way home.</h1>
          <p className="hero-description">A kind community helping lost belongings find their people. Every little lead brings something — or someone — a little closer.</p>
          <div className="hero-actions">
            <Link className="button button-dark" to="/browse">Explore found items <ArrowIcon /></Link>
            <Link className="button button-light" to="/report">I lost something <ArrowIcon diagonal /></Link>
          </div>
          <div className="community-note"><div className="avatar-stack"><span>J</span><span>M</span><span>A</span><span>+</span></div><span>A little community with a lot of heart</span></div>
        </div>
        <div className="hero-art" aria-label="Illustration of belongings waiting to be reunited" role="img">
          <div className="art-sun" />
          <span className="spark spark-one">✳</span><span className="spark spark-two">✦</span><span className="spark spark-three">✳</span>
          <div className="art-note"><span className="note-pin">✳</span><span>Somewhere out there,<br />your things are waiting.</span></div>
          <div className="art-ground" />
          <div className="plant plant-left"><i /><i /><b /></div>
          <div className="plant plant-right"><i /><i /><b /></div>
          <div className="bag"><div className="bag-handle"/><div className="bag-pocket"><span>✦</span></div></div>
          <div className="scarf"><span /><span /><span /><span /></div>
          <div className="tag">found<br /><b>with care</b></div>
          <div className="art-caption"><span>1,248</span><span>little reunions<br />and counting</span></div>
        </div>
      </section>

      <section className="how-section">
        <div className="page-width how-inner">
          <div className="section-heading"><span className="eyebrow">A SIMPLE WAY TO HELP</span><h2>It starts with a little <em>kindness.</em></h2></div>
          <div className="steps">
            <article className="step"><span className="step-number">01</span><div className="step-icon mint">⌕</div><h3>Look around</h3><p>Browse the things people have found. Your missing thing might already be here.</p></article>
            <article className="step"><span className="step-number">02</span><div className="step-icon peach">♡</div><h3>Share a little detail</h3><p>Tell us what you lost or found. Even the smallest detail can make a connection.</p></article>
            <article className="step"><span className="step-number">03</span><div className="step-icon yellow">↗</div><h3>Find your way back</h3><p>We’ll help bring the right people together, one happy reunion at a time.</p></article>
          </div>
          <div className="api-line"><span>A small start, a big-hearted community.</span><ApiStatus /></div>
        </div>
      </section>
    </main>
  );
}

function PlaceholderPage({ type }) {
  const isBrowse = type === "browse";
  return (
    <main className="placeholder page-width">
      <span className="eyebrow"><span className="eyebrow-dot" /> THE COMMUNITY BOARD</span>
      <h1>{isBrowse ? <>A few things<br /><em>looking for home.</em></> : <>Every little detail<br /><em>can help.</em></>}</h1>
      <p>{isBrowse ? "Found items will live here soon. Check back as our community starts sharing." : "The item reporting form is coming soon. We’re making a thoughtful place to share what you lost or found."}</p>
      <div className="coming-card"><span className="coming-icon">{isBrowse ? "⌕" : "♡"}</span><div><b>{isBrowse ? "The board is getting ready" : "Your report starts here"}</b><span>This is a foundation release. Item reports and browsing are not connected yet.</span></div></div>
      <Link className="text-link" to="/"><span aria-hidden="true">←</span> Back to the home page</Link>
    </main>
  );
}

function Footer() {
  return <footer className="site-footer"><div className="page-width footer-inner"><Link className="brand" to="/"><span className="brand-mark">r<span>.</span></span><span>ReFound</span></Link><span>A little help finding your way back.</span><span>Made with care <b>♥</b></span></div></footer>;
}

export default function App() {
  return <><Header /><Routes><Route path="/" element={<HomePage />} /><Route path="/browse" element={<PlaceholderPage type="browse" />} /><Route path="/report" element={<PlaceholderPage type="report" />} /><Route path="*" element={<PlaceholderPage type="browse" />} /></Routes><Footer /></>;
}
