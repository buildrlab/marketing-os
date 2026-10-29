const paths = {
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  flow: "M4 4h6v6H4z M14 14h6v6h-6z M7 10v7h7 M14 4h6v6h-6z M10 7h4",
  file: "M14 2H5v20h14V7z M14 2v6h5 M8 12h8 M8 16h6",
  check: "m5 12 4 4L19 6",
  shield: "M12 2 3 6v6c0 6 9 10 9 10s9-4 9-10V6z m-4 10 3 3 5-6",
  book: "M12 5v16 M3 3h5a4 4 0 0 1 4 2 4 4 0 0 1 4-2h5v16h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3z",
  spark: "m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z",
  globe:
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M3 12h18 M12 3c5 5 5 13 0 18-5-5-5-13 0-18",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 7v5l3 2",
  settings: "M4 7h16 M4 17h16 M8 4v6 M16 14v6",
  plus: "M12 5v14 M5 12h14",
  arrow: "M5 12h14 m-5-5 5 5-5 5",
  up: "M7 17 17 7 M7 7h10v10",
  search: "M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0 m-1 5 6 6",
  chevron: "m9 5 7 7-7 7",
  back: "M19 12H5 m5-5-5 5 5 5",
  close: "m6 6 12 12 M6 18 18 6",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  code: "m8 6-6 6 6 6 m8-12 6 6-6 6 m-3-15-2 18",
  refresh:
    "M20 7v5h-5 M4 17v-5h5 M5 7a8 8 0 0 1 14-2l1 7 M4 12l1 7a8 8 0 0 0 14-2",
  play: "m8 4 12 8-12 8z",
  download: "M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5",
  edit: "m15 3 6 6-12 12H3v-6z M12 6l6 6",
  mail: "M3 5h18v14H3z m0 0 9 7 9-7",
  layers: "m12 2 10 6-10 6L2 8z M2 12l10 6 10-6 M2 16l10 6 10-6",
  alert: "m12 3 10 18H2z M12 9v5 M12 17v1",
};
const icon = (name) =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.file}"/></svg>`;
const esc = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const labels = {
  in_review: "In review",
  approved: "Approved",
  blocked: "Needs attention",
  published: "Published",
  publish_failed: "Delivery pending",
  changes_requested: "Changes requested",
};
const eventNames = {
  draft_created: "Draft created",
  draft_edited: "New revision saved",
  approved: "Revision approved",
  publish_attempt: "Publication requested",
  publish_failed: "CMS acknowledgement missing",
  published: "Content published",
  changes_requested: "Changes requested",
  prompt_switched: "Prompt version switched",
};
let state,
  filter = "all",
  query = "",
  editing = false,
  toastTimer,
  previousFocus;
const $ = (s) => document.querySelector(s);
const route = () => location.hash.slice(1) || "overview";
const badge = (status, text) =>
  `<span class="badge ${esc(status)}"><i class="dot"></i>${esc(text || labels[status] || status)}</span>`;
const date = (x) =>
  new Date(x).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
function toast(message, error = false) {
  const el = $("#toast");
  el.textContent = message;
  el.className = "show" + (error ? " error" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = ""), 5000);
}
async function api(path, data) {
  const r = await fetch("/api/" + path, {
    method: data ? "POST" : "GET",
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
  });
  const value = await r.json();
  if (!r.ok)
    throw new Error(value.error || "The request could not be completed.");
  return value;
}
async function refresh() {
  state = await api("state");
  render();
}
const nav = [
  ["overview", "grid", "Overview"],
  ["content", "file", "Content library"],
  ["approvals", "shield", "Approval inbox"],
  ["knowledge", "book", "Brand knowledge"],
  ["skills", "flow", "Skills & workflows"],
  ["publishing", "globe", "Publishing"],
  ["activity", "clock", "Activity log"],
];
function layout(content) {
  const current = route().split("/")[0],
    pending = state.runs.filter((r) => r.status === "in_review").length;
  return `<div class="drawer-scrim" data-action="menu"></div><aside class="sidebar" aria-label="Primary navigation"><a class="brand" href="#overview" aria-label="BuildrLab MarketingOS home"><img src="/assets/logo.svg" alt="BuildrLab"><span class="brand-caption">MARKETING OS</span></a><div class="workspace"><span class="workspace-symbol">✳</span><div><strong>Northstar</strong><small>Demo workspace</small></div><span class="badge sample">LOCAL</span></div><div class="nav-label">WORKSPACE</div><nav>${nav.map(([id, i, label], n) => `${n === 3 ? '<div class="nav-separator"></div><div class="nav-label">OPERATIONS</div>' : ""}<a class="nav-link ${current === id ? "active" : ""}" ${current === id ? 'aria-current="page"' : ""} href="#${id}">${icon(i)}${label}${id === "approvals" && pending ? `<span class="count">${pending}</span>` : ""}</a>`).join("")}</nav><div class="sidebar-bottom"><div class="local-card"><strong>${icon("code")}Built to be inspected.</strong><p>A working local demo. Real approvals, real publishing, fictional business.</p><button data-action="about">Explore this demo ${icon("up")}</button></div><div class="profile"><span class="avatar">DG</span><div><strong>Damien Gallagher</strong><small>BuildrLab · Engineering</small></div></div></div></aside><div class="shell"><header class="topbar"><div class="crumb"><button class="icon-button mobile-menu" aria-label="Open navigation" data-action="menu">${icon("menu")}</button><span>Workspace</span>${icon("chevron")}<strong>${current === "review" ? "Content studio" : esc(nav.find((n) => n[0] === current)?.[2] || "Overview")}</strong></div><div class="top-actions"><label class="search">${icon("search")}<input id="global-search" aria-label="Search content" placeholder="Search content…" value="${esc(query)}"><span class="key">↵</span></label><span class="env"><i class="dot"></i>Local workspace</span><span class="divider"></span><button class="icon-button" data-action="about" aria-label="About this demo">${icon("code")}</button><span class="avatar">DG</span></div></header><main id="main" tabindex="-1">${content}<div class="footer-note"><span>${icon("shield")}Human approval before every publication.</span><span>BuildrLab MarketingOS · Independent portfolio demo</span></div></main></div>`;
}
function heading(title, sub, action = true) {
  return `<div class="page-heading"><div><div class="eyebrow">NORTHSTAR / MARKETING OPERATIONS</div><h1>${title}</h1><p class="subtitle">${sub}</p></div>${action ? `<button class="button" data-action="new">${icon("plus")}New workflow</button>` : ""}</div>`;
}
function flowArt() {
  return `<div class="flow-art" aria-label="Knowledge flows into a content draft, then through human approval"><svg class="flow-line" viewBox="0 0 450 250" preserveAspectRatio="none" aria-hidden="true"><path d="M125 65H205V125H330 M330 145V205H130 M125 205V100"/></svg><div class="flow-node n1"><span class="node-icon">${icon("book")}</span><div><strong>Brand knowledge</strong><small>Approved sources, in context</small></div></div><span class="flow-center">${icon("spark")}</span><div class="flow-node n2"><span class="node-icon">${icon("file")}</span><div><strong>A grounded draft</strong><small>Structured. Sourced. Reviewed.</small></div></div><div class="flow-node n3"><span class="node-icon">${icon("shield")}</span><div><strong>A human says yes.</strong><small>Then, and only then, publish.</small></div></div><span class="flow-label">KNOWLEDGE → CONTENT → CONFIDENCE</span></div>`;
}
function metric(label, value, note, i, positive = false) {
  return `<div class="metric"><div class="metric-top">${label}${icon(i)}</div><div class="metric-value">${value}</div><div class="metric-note ${positive ? "green" : ""}">${note}</div></div>`;
}
function table(runs, compact = false) {
  if (!runs.length)
    return empty(
      "No content here yet",
      "Start a workflow to turn approved knowledge into a reviewable draft.",
      "new",
      "Start a workflow",
    );
  return `<div class="table-wrap"><table><thead><tr><th>Content</th><th>Status</th>${compact ? "" : "<th>Audience</th>"}<th>Revision</th><th><span class="sr-only">Open</span></th></tr></thead><tbody>${runs.map((r) => `<tr><td><div class="row-title"><span class="type-icon">${icon("file")}</span><div><a class="content-title" href="#review/${r.id}">${esc(r.content.title)}</a><div class="content-meta">Article · ${r.mode === "sample" ? "Sample composition" : "Local AI"}${r.seeded ? " · Seeded example" : ""}</div></div></div></td><td>${badge(r.status)}</td>${compact ? "" : `<td>${esc(r.audience)}</td>`}<td>v${r.revision}</td><td><a class="arrow-link" href="#review/${r.id}" aria-label="Review ${esc(r.content.title)}">${icon("arrow")}</a></td></tr>`).join("")}</tbody></table></div>`;
}
function empty(title, message, action, label) {
  return `<div class="empty">${icon("layers")}<h3>${title}</h3><p>${message}</p>${action ? `<button class="button small secondary" data-action="${action}">${label}</button>` : ""}</div>`;
}
function eventText(e) {
  const run = state.runs.find((r) => r.id === e.run_id);
  return {
    title: eventNames[e.kind] || e.kind,
    sub: run?.content.title || "Workspace configuration",
  };
}
function activities(limit = 4) {
  return state.events
    .slice(0, limit)
    .map((e) => {
      const t = eventText(e);
      return `<div class="activity-row"><span class="activity-icon">${icon(e.kind === "approved" ? "shield" : e.kind === "published" ? "globe" : "file")}</span><div><p>${esc(t.title)} · ${esc(t.sub)}</p><small>${date(e.created)}${e.data.seeded ? " · Seeded example" : ""}</small></div></div>`;
    })
    .join("");
}
function overview() {
  const pending = state.runs.filter((r) => r.status === "in_review"),
    blocked = state.runs.filter((r) =>
      ["blocked", "publish_failed", "changes_requested"].includes(r.status),
    );
  return `${heading("Your content, in motion.", "From shared knowledge to published stories. One accountable workflow.")}<section class="hero"><div class="hero-copy"><div class="eyebrow">THE CONTENT OPERATING SYSTEM</div><h2>Good content starts<br>with <em>shared knowledge.</em></h2><p>Give your team a clear path from a useful idea to a reviewed, published article. Keep the evidence at every step.</p><div class="actions"><button class="button" data-action="new">Create your next story ${icon("arrow")}</button><span class="hero-foot">${icon("check")}No API key needed</span></div></div>${flowArt()}</section><section class="metrics" aria-label="Workspace statistics">${metric("Content workflows", state.runs.length, "Persisted in this workspace", "flow")}${metric("Awaiting review", pending.length, "Your judgment makes the difference", "shield")}${metric("Published articles", state.cms.pages.length, "Live in your local CMS", "globe", true)}${metric("Approved sources", state.sources.length, "Versioned brand knowledge", "book")}</section><div class="dashboard-grid"><section class="panel"><div class="panel-head"><div><h2>Content pipeline <span class="content-count">${state.runs.length}</span></h2><p>Every story has a source. Every release has an owner.</p></div><a href="#content">View all ${icon("arrow")}</a></div><div class="filter-tabs"><button class="filter-tab active" data-action="all-content">Recent workflows</button><a class="filter-tab" href="#approvals">Needs review <span>${pending.length}</span></a><a class="filter-tab" href="#publishing">Published <span>${state.cms.pages.length}</span></a></div>${table(state.runs.slice(0, 5), true)}<div class="table-foot"><span>Sample content for a fictional business</span><span>Updated from live workspace data</span></div></section><section class="panel"><div class="panel-head"><h2>Make the next move</h2>${icon("shield")}</div>${
    pending
      .slice(0, 2)
      .map(
        (r) =>
          `<div class="queue-card">${badge("in_review", "Ready for your review")}<h3>${esc(r.content.title)}</h3><p>${r.checks.filter((c) => c.status === "pass").length} checks passed · ${r.sources.length} source documents</p><div class="actions"><div class="mini-stack"><span>PR</span><span>BR</span><span>OP</span></div><a class="button small secondary" href="#review/${r.id}">Review draft ${icon("arrow")}</a></div></div>`,
      )
      .join("") ||
    empty(
      "All caught up",
      "Create a new draft or publish an approved revision.",
      "new",
      "New workflow",
    )
  }${blocked.length ? `<div class="queue-card"><span class="badge blocked">${blocked.length} workflow${blocked.length === 1 ? " needs" : "s need"} attention</span><p  class="layout-util-5">Inspect the flagged claim or delivery issue before moving forward.</p><a class="button quiet small" href="#review/${blocked[0].id}">Inspect workflow ${icon("arrow")}</a></div>` : ""}</section></div><div class="bottom-row"><section class="panel"><div class="panel-head"><h2>Workspace activity</h2><a href="#activity">View audit trail ${icon("arrow")}</a></div><div class="activity-list">${activities()}</div></section><section class="panel"><div class="panel-head"><h2>Built on a reliable foundation</h2>${icon("layers")}</div><div class="healthy"><div class="healthy-row"><span>Knowledge repository</span><strong><i class="dot"></i>${state.sources.length} sources available</strong></div><div class="healthy-row"><span>Editorial approval</span><strong><i class="dot"></i>Required for every revision</strong></div><div class="healthy-row"><span>Local CMS</span><strong><i class="dot"></i>${state.cms.connected ? "Connected" : "Unavailable"}</strong></div><div class="healthy-row"><span>Default generation</span><span class="badge sample">Sample mode · no model calls</span></div></div></section></div>`;
}
function contentPage(approvals = false) {
  const relevant = state.runs.filter(
    (r) =>
      (!approvals ||
        [
          "in_review",
          "blocked",
          "changes_requested",
          "approved",
          "publish_failed",
        ].includes(r.status)) &&
      (filter === "all" || r.status === filter) &&
      r.content.title.toLowerCase().includes(query.toLowerCase()),
  );
  return `${heading(approvals ? "Your judgment. Their next step." : "A home for every story.", approvals ? "Inspect the evidence, resolve issues and approve the exact revision that will be published." : "Manage drafts, revisions and published content without losing the thread.")}<section class="panel"><div class="list-toolbar"><div class="filter-tabs">${[
    ["all", "All content"],
    ["in_review", "In review"],
    ["blocked", "Needs attention"],
    ["approved", "Approved"],
    ["published", "Published"],
  ]
    .filter((x) => !approvals || x[0] !== "published")
    .map(
      ([v, t]) =>
        `<button class="filter-tab ${filter === v ? "active" : ""}" data-filter="${v}">${t}</button>`,
    )
    .join(
      "",
    )}</div><label class="search">${icon("search")}<input id="content-search" aria-label="Filter content" placeholder="Filter by title…" value="${esc(query)}"></label></div>${table(relevant)}<div class="pagination-note">${relevant.length} workflow${relevant.length === 1 ? "" : "s"} · Each row opens its complete editorial and delivery history.</div></section>`;
}
function review(id) {
  const r = state.runs.find((r) => r.id === id);
  if (!r)
    return empty("Content not found", "Choose an item from your library.");
  const done =
    r.status === "blocked"
      ? 3
      : r.status === "published"
        ? 6
        : ["approved", "publish_failed"].includes(r.status)
          ? 5
          : 4;
  const current = ["blocked", "changes_requested"].includes(r.status)
    ? 3
    : done;
  return `<a class="page-back" href="#content">${icon("back")}Back to content library</a><div class="page-heading"><div><div class="eyebrow">CONTENT STUDIO · ${r.id.slice(0, 6)} · REVISION ${r.revision}</div><h1>${editing ? "Make it your own." : "A story worth getting right."}</h1><p class="subtitle">${esc(r.audience)} · ${r.mode === "sample" ? "Sample composition — no LLM calls" : "Generated with local Ollama"}${r.seeded ? " · Seeded example" : ""}</p></div><div class="actions">${badge(r.status)}<button class="button secondary" data-action="edit" data-id="${id}">${icon(editing ? "close" : "edit")}${editing ? "Cancel edit" : "Edit draft"}</button></div></div><div class="stepper" aria-label="Workflow progress">${["Knowledge", "Brief", "Draft", "Validation", "Approval", "Published"].map((name, i) => `<div class="step ${i < done ? "done" : ""} ${i === current ? "current" : ""}"><span class="step-number">${i < done ? "✓" : i + 1}</span>${name}</div>`).join("")}</div>${r.last_error ? `<div class="notice warning">${icon("alert")}<div>${esc(r.last_error)} ${r.scenario === "cms_timeout" ? "This scenario deliberately loses the first acknowledgement after the CMS commits. Retrying demonstrates duplicate protection." : ""}</div></div>` : ""}${r.review_note ? `<div class="notice warning">${icon("edit")}<div><strong>Editorial note:</strong> ${esc(r.review_note)}</div></div>` : ""}<div class="studio-grid"><div><section class="panel"><div class="panel-head"><h2>${editing ? "Edit revision " + r.revision : "Article preview"}</h2><span class="banner-label">${icon("file")}RESOURCE ARTICLE</span></div>${editing ? editor(r) : `<article class="article-preview"><div class="eyebrow">NORTHSTAR / FIELD NOTES</div><h2>${esc(r.content.title)}</h2><p class="lead">${esc(r.content.description)}</p>${r.content.sections.map((s) => `<section><h3>${esc(s.heading)}</h3><p>${esc(s.text)}</p><span class="citation">${icon("book")}${esc(r.sources.find((x) => x.id === s.source_id)?.title || s.source_id)}</span></section>`).join("")}</article>`}</section><section class="panel section-spacer"><div class="panel-head"><h2>Inside this workflow</h2><span class="sublabel">Actual execution timings</span></div><div class="run-summary"><div><strong>${r.duration_ms.toFixed(0)} ms</strong><span>Creation time · excludes review</span></div><div><strong>${r.usage.input_tokens + r.usage.output_tokens}</strong><span>Model tokens reported</span></div><div><strong>${r.mode === "sample" ? "$0" : "Not measured"}</strong><span>${r.mode === "sample" ? "Model API cost" : "Local compute cost"}</span></div></div><div class="trace">${r.trace.map((t) => `<div class="trace-row"><div><strong>${esc(t.step)}</strong><small>${t.ms} ms</small></div><p>${esc(t.detail)}</p></div>`).join("")}<p class="summary-note">Prompt ${r.prompt_version} · Skill ${r.skill_version} · ${esc(r.usage.cost_note)}</p></div></section></div><aside class="studio-right"><section class="panel"><div class="review-box">${approvalBox(r)}</div></section><section class="panel"><div class="panel-head"><h2>Quality checks</h2><span class="sublabel">${r.checks.filter((c) => c.status === "pass").length}/${r.checks.length} passed</span></div><div class="checks">${r.checks.map((c) => `<div class="check-item"><span class="check-symbol ${c.status}">${c.status === "pass" ? "✓" : c.status === "fail" ? "!" : "·"}</span><div><strong>${esc(c.label)}</strong><p>${esc(c.detail)}</p></div></div>`).join("")}</div></section><section class="panel"><div class="panel-head"><h2>Evidence drawer</h2><span class="sublabel">${r.sources.length} sources</span></div>${r.sources.map((s) => `<details class="source-mini"><summary>${esc(s.title)} · v${s.version}</summary><p>${esc(s.content)}</p></details>`).join("")}</section></aside></div>`;
}
function approvalBox(r) {
  if (editing)
    return `<h3>Finish your edit first.</h3><p>Save the new revision or cancel your changes before reviewing or publishing. Unsaved edits are not part of an approval.</p>`;
  if (r.status === "published")
    return `${badge("published")}<h3  class="layout-util-2">Your story is live.</h3><p>Revision ${r.revision} is published to the local CMS. Further edits require a new approval.</p><div class="approval-person">Approved by ${esc(r.approval.reviewer)}<br><small>${date(r.approval.at)}</small></div><a class="button wide" href="${esc(state.cms.public_url)}/articles/${encodeURIComponent(r.publication.slug)}" target="_blank" rel="noopener">View published article ${icon("up")}</a>`;
  if (["approved", "publish_failed"].includes(r.status))
    return `${badge("approved", "Revision approved")}<h3  class="layout-util-2">Ready for the world.<br>Starting locally.</h3><p>Only the approved content snapshot can be published. Your approval stays bound to revision ${r.revision}.</p><div class="approval-person">${esc(r.approval.reviewer)} · revision ${r.approval.revision}<br><small>${date(r.approval.at)}</small></div><button class="button wide" data-action="publish" data-id="${r.id}">${icon(r.status === "publish_failed" ? "refresh" : "globe")}${r.status === "publish_failed" ? "Retry publication" : "Publish to local CMS"}</button><p class="summary-note">${r.status === "publish_failed" ? "Same publication key. Safe to retry." : "This creates a real page in the separate local CMS."}</p>`;
  return `<span class="source-icon">${icon("shield")}</span><h3  class="layout-util-3">A human makes the call.</h3><p>Check the facts, wording and sources before approving this revision.</p>${r.status === "blocked" ? '<div class="layout-util-2 notice warning" >Resolve the failing checks by editing the draft. Approval is blocked on the server.</div>' : r.status === "changes_requested" ? '<p class="summary-note">Save an updated draft to return it to review.</p>' : `<button class="button wide" data-action="approve" data-id="${r.id}">${icon("check")}Review & approve v${r.revision}</button>`}<button class="button secondary wide" data-action="reject" data-id="${r.id}">Request changes</button><p class="summary-note">Local demo: reviewer names are audit labels, not verified accounts.</p>`;
}
function editor(r) {
  return `<form id="edit-form" class="edit-form" data-id="${r.id}"><div class="notice">${icon("shield")}Saving creates a new revision and invalidates any existing approval. The current published page stays live until you publish again.</div><div class="field"><label for="edit-title">Article title</label><input id="edit-title" name="title" maxlength="140" required value="${esc(r.content.title)}"></div><div class="field"><label for="edit-description">Search description</label><textarea id="edit-description" name="description" maxlength="300" required>${esc(r.content.description)}</textarea></div><div class="field"><label for="edit-slug">URL slug</label><input id="edit-slug" name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" maxlength="100" required value="${esc(r.content.slug)}"></div>${r.content.sections.map((s, i) => `<div class="edit-section"><div class="eyebrow">SECTION ${i + 1} · SOURCE ${esc(s.source_id)}</div><div class="field"><label for="heading-${i}">Heading</label><input id="heading-${i}" name="heading-${i}" maxlength="160" required value="${esc(s.heading)}"></div><div class="field"><label for="text-${i}">Content</label><textarea id="text-${i}" name="text-${i}" rows="5" maxlength="5000" required>${esc(s.text)}</textarea></div></div>`).join("")}<div class="form-error" role="alert"></div><div class="actions"><button class="button" type="submit">Save revision ${r.revision + 1} ${icon("arrow")}</button><button class="button secondary" type="button" data-action="edit" data-id="${r.id}">Cancel</button></div></form>`;
}
function knowledge() {
  return `${heading("One shared source of truth.", "Approved product facts, editorial principles and operational guidance. Available to every workflow.", false)}<div class="notice">${icon("book")}This workspace uses a versioned, fictional Northstar knowledge repository. Every run retains a snapshot of the sources used to create its draft.</div><div class="cards">${state.sources.map((s, i) => `<article class="panel source-card"><div class="layout-util-0 actions" ><span class="source-icon">${icon(["layers", "spark", "flow"][i])}</span><span class="badge pass">Approved source</span></div><div class="layout-util-4 eyebrow" >${esc(s.category)}</div><h3>${esc(s.title)}</h3><p>${esc(s.content)}</p><details><summary>Inspect reusable facts (${s.facts.length})</summary><ul>${s.facts.map((f) => `<li>${esc(f)}</li>`).join("")}</ul></details><div class="source-foot"><span>Version ${s.version} · ${s.updated}</span><code>${s.id}</code></div></article>`).join("")}</div><section class="panel section-spacer"><div class="panel-head"><h2>Knowledge with a paper trail</h2></div><div class="settings-body"><p>The canon is stored in <strong>data/canon.json</strong>. To change it, edit the repository, increment its version and rebuild. Existing drafts retain their original evidence so reviewers can see exactly what informed them. This demo uses lexical source ranking, not a vector database or a production ingestion service.</p></div></section>`;
}
function skills() {
  return `${heading("Reusable skills. Visible decisions.", "A small, versioned workflow with clear boundaries between generation, review and publication.", false)}<div class="skill-grid"><section class="panel"><div class="panel-head"><div><h2>Knowledge to article</h2><p>Skill ${state.skill.version} · Six deliberate steps</p></div><span class="badge pass">Operational</span></div><div class="skill-steps">${state.skill.steps.map((s, i) => `<div class="skill-step"><span>${i + 1}</span><div><h3>${s}</h3><p>${["Rank the approved repository and pin source versions.", "Record the topic, audience and intended article format.", "Compose sample content or call your local Ollama model.", "Inspect sources, numeric claims, metadata and basic PII patterns.", "Require a reviewer and bind approval to a content fingerprint.", "Send the approved snapshot with a stable publication key."][i]}</p></div>`).join("")}<button class="button" data-action="new">Run this workflow ${icon("play")}</button></div></section><section class="panel"><div class="panel-head"><h2>Prompt versions</h2><span class="badge sample">${state.prompt_version} active</span></div><div class="settings-body"><p>Switch the prompt used by new runs. Existing drafts keep their pinned version. Switching back demonstrates a recorded configuration rollback.</p>${Object.keys(
    state.skill.prompt_versions,
  )
    .map(
      (v) =>
        `<div class="prompt-choice"><div><h3>${v === "v1" ? "v1 · Clear and practical" : "v2 · Concise and action-oriented"}</h3><p>${v === state.prompt_version ? "Active for new workflows" : "Available to activate"}</p></div><button class="button small secondary" data-action="prompt" data-version="${v}" ${v === state.prompt_version ? "disabled" : ""}>${v === state.prompt_version ? "Active" : "Activate"}</button></div>`,
    )
    .join(
      "",
    )}<pre class="prompt-text">${esc(state.skill.prompt_versions[state.prompt_version])}</pre><p>Sample mode changes the section headings between versions. Real prompt-based drafting requires the optional local model.</p></div></section></div><div class="notice section-spacer">${icon("shield")}The generation step cannot approve content or call the CMS. Approval and publishing are separate server-side operations, regardless of what a source document says.</div>`;
}
function publishing() {
  return `${heading("From approved to published.", "A separate, persistent local CMS. Real pages, explicit approvals and safe delivery retries.", false)}<div class="page-heading"><span class="layout-util-6 notice" >${icon("globe")}${state.cms.connected ? "CMS connected · published pages are served from a separate container." : "CMS unavailable. Start both services to publish."}</span><a class="button secondary" href="${esc(state.cms.public_url)}" target="_blank" rel="noopener">Open resource hub ${icon("up")}</a></div>${state.cms.pages.length ? `<div class="published-grid">${state.cms.pages.map((p) => `<article class="panel published-card"><div class="published-cover">✳</div><div class="published-body">${badge("published")}<h3>${esc(p.title)}</h3><p>${esc(p.description)}</p><div class="actions"><a class="button small" href="${esc(state.cms.public_url)}/articles/${encodeURIComponent(p.slug)}" target="_blank" rel="noopener">View article ${icon("up")}</a><a class="button small secondary" href="#review/${p.id}">Open workflow</a></div><div class="published-version">Revision ${p.revision} · ${date(p.published_at)}</div></div></article>`).join("")}</div>` : `<section class="panel">${empty("Your first publication is one approval away.", "Open a draft, inspect its sources, approve the revision, then publish to the local CMS.", "review-first", "Review a draft")}</section>`}<section class="panel section-spacer"><div class="panel-head"><h2>Publishing that survives a retry</h2></div><div class="settings-body"><p>The CMS stores each publication under a unique content-and-revision key. If the acknowledgement is lost after a successful write, replaying the same request returns the existing publication. A changed payload cannot reuse that key. Try the <strong>CMS timeout</strong> scenario to inspect this behaviour.</p><button class="layout-util-3 button small secondary" data-action="new" >Create a delivery test ${icon("arrow")}</button></div></section>`;
}
function activity() {
  return `${heading("Every decision has a history.", "Inspect revisions, approvals, delivery attempts and prompt changes in one persistent audit trail.", false)}<div class="layout-util-1 actions" ><a class="button secondary" href="/api/export" download="marketingos-workspace.json">${icon("download")}Export workspace evidence</a><span class="sublabel">Most recent 200 events · Recorded locally</span></div><section class="panel">${state.events
    .map((e) => {
      const t = eventText(e);
      return `<div class="audit-row"><span class="activity-icon">${icon(e.kind === "approved" ? "shield" : e.kind === "published" ? "globe" : "clock")}</span><div><h3>${esc(t.title)}</h3><p>${esc(t.sub)}${e.data.seeded ? " · Seeded demonstration" : ""}</p><details><summary class="sublabel">Inspect event</summary><pre class="prompt-text">${esc(JSON.stringify(e.data, null, 2))}</pre></details></div><small>${date(e.created)}</small></div>`;
    })
    .join("")}</section>`;
}
function render() {
  const path = route(),
    view = path.split("/")[0];
  let content;
  if (view === "review") content = review(path.split("/")[1]);
  else
    content = (
      {
        overview,
        content: () => contentPage(),
        approvals: () => contentPage(true),
        knowledge,
        skills,
        publishing,
        activity,
      }[view] || overview
    )();
  $("#app").innerHTML = layout(content);
  bind();
}
function showDialog(title, subtitle, body) {
  previousFocus = document.activeElement;
  const d = $("#dialog");
  d.innerHTML = `<div class="dialog-head"><div><h2>${title}</h2><p>${subtitle}</p></div><button class="icon-button" data-close aria-label="Close dialog">${icon("close")}</button></div><div class="dialog-body">${body}</div>`;
  d.querySelector("[data-close]").onclick = () => d.close();
  d.showModal();
  d.addEventListener("close", () => previousFocus?.focus(), { once: true });
  return d;
}
function newWorkflow() {
  const d = showDialog(
    "Start with a useful idea.",
    "One topic. Approved knowledge. A clear path to publication.",
    `<form id="new-form"><div class="field"><label for="topic">What would you like to write about?</label><input id="topic" name="topic" required minlength="8" maxlength="100" value="A better way to review and publish content"></div><div class="field"><label for="audience">Who is it for?</label><select id="audience" name="audience"><option>Customer operations leaders</option><option>Marketing operations teams</option><option>Growing support teams</option></select></div><div class="field"><label for="mode">Drafting mode</label><select id="mode" name="mode"><option value="sample">Sample composition · no model or API key</option><option value="ollama">Local AI · Ollama required</option></select><small>Sample mode assembles approved passages. It does not simulate an LLM.</small></div><span class="field-label">Choose a demonstration</span><div class="scenario-options">${[
      ["standard", "Happy path", "Create, review and publish."],
      ["unsupported", "Unsupported claim", "A fabricated metric gets blocked."],
      ["cms_timeout", "CMS timeout", "Retry after a lost acknowledgement."],
      ["injection", "Source injection", "A malicious fixture is quarantined."],
    ]
      .map(
        ([v, t, s], i) =>
          `<label class="scenario-choice"><input type="radio" name="scenario" value="${v}" ${i === 0 ? "checked" : ""}><span><strong>${t}</strong><small>${s}</small></span></label>`,
      )
      .join(
        "",
      )}</div><div class="form-error" role="alert"></div><div class="dialog-foot"><button type="button" class="button secondary" data-cancel>Cancel</button><button class="button" type="submit">Create workflow ${icon("arrow")}</button></div></form>`,
  );
  d.querySelector("[data-cancel]").onclick = () => d.close();
  d.querySelector("form").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.currentTarget,
      b = f.querySelector("[type=submit]");
    b.disabled = true;
    b.textContent = "Creating draft…";
    try {
      const data = Object.fromEntries(new FormData(f));
      const r = await api("runs", data);
      d.close();
      editing = false;
      await refresh();
      location.hash = "review/" + r.id;
      toast("Workflow created. Review the evidence before approving.");
    } catch (err) {
      f.querySelector(".form-error").textContent = err.message;
    } finally {
      b.disabled = false;
      b.innerHTML = "Create workflow " + icon("arrow");
    }
  };
}
function approveDialog(id) {
  const r = state.runs.find((x) => x.id === id);
  const d = showDialog(
    "Your approval is specific.",
    "Approve revision " + r.revision + " of “" + esc(r.content.title) + "”.",
    `<form><div class="notice">${icon("shield")}Approval is tied to this content fingerprint. Any edit requires a new review. Publication remains a separate action.</div><div class="field"><label for="reviewer">Reviewer name</label><input id="reviewer" name="reviewer" required minlength="2" maxlength="80" placeholder="Your name"><small>A local audit label; no identity verification in this demo.</small></div><label class="check-label"><input type="checkbox" name="attested" required><span>I checked the claims against their sources and reviewed the wording, metadata and any warnings.</span></label><div class="form-error" role="alert"></div><div class="dialog-foot"><button type="submit" class="button">${icon("check")}Approve revision ${r.revision}</button></div></form>`,
  );
  d.querySelector("form").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.currentTarget,
      b = f.querySelector("button");
    b.disabled = true;
    try {
      await api(`runs/${id}/approve`, {
        revision: r.revision,
        reviewer: new FormData(f).get("reviewer"),
        attested: true,
      });
      d.close();
      await refresh();
      toast("Revision approved. You can now publish to the local CMS.");
    } catch (err) {
      f.querySelector(".form-error").textContent = err.message;
      b.disabled = false;
    }
  };
}
function rejectDialog(id) {
  const r = state.runs.find((x) => x.id === id);
  const d = showDialog(
    "Make the feedback useful.",
    "Leave a specific note for the next revision.",
    `<form><div class="field"><label for="review-note">What needs to change?</label><textarea id="review-note" name="comment" required minlength="3" maxlength="1000" placeholder="For example: remove the unsupported cost-saving claim."></textarea></div><div class="form-error" role="alert"></div><div class="dialog-foot"><button class="button" type="submit">Request changes</button></div></form>`,
  );
  d.querySelector("form").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    try {
      await api(`runs/${id}/reject`, {
        revision: r.revision,
        comment: new FormData(f).get("comment"),
      });
      d.close();
      await refresh();
      toast("Review note recorded. Approval has been cleared.");
    } catch (err) {
      f.querySelector(".form-error").textContent = err.message;
    }
  };
}
function about() {
  showDialog(
    "A portfolio you can put to work.",
    "BuildrLab MarketingOS · Local demonstration",
    `<div class="field"><p class="muted">This demo connects versioned brand knowledge, content composition, validation, editorial approval and a separate headless CMS. It persists drafts and real published pages across restarts.</p></div><div class="notice">${icon("code")}Sample mode uses deterministic source passages. Optional Ollama generation runs a real local model. No paid hosted model is called.</div><div class="field"><h3>Try a complete story</h3><ol class="muted"><li>Open a draft and inspect its evidence.</li><li>Edit a paragraph or fix the flagged claim.</li><li>Approve the exact revision with a reviewer name.</li><li>Publish and open the local resource hub.</li><li>Inspect the audit trail or try a failure scenario.</li></ol></div><div class="notice warning">${icon("shield")}Local-only demo: no authenticated users, production authorization or enterprise security claims. Keep the services bound to your own machine. The injection and PII checks are intentionally limited.</div>`,
  );
}
function bind() {
  document.querySelectorAll("[data-action]").forEach(
    (b) =>
      (b.onclick = async () => {
        const action = b.dataset.action,
          id = b.dataset.id;
        try {
          if (action === "new") return newWorkflow();
          if (action === "about") return about();
          if (action === "menu") {
            $(".sidebar").classList.toggle("open");
            $(".drawer-scrim").classList.toggle("open");
            return;
          }
          if (action === "all-content") {
            filter = "all";
            location.hash = "content";
            return;
          }
          if (action === "review-first") {
            const r =
              state.runs.find((x) => x.status === "in_review") || state.runs[0];
            if (r) location.hash = "review/" + r.id;
            else newWorkflow();
            return;
          }
          if (action === "edit") {
            editing = !editing;
            render();
            return;
          }
          if (action === "approve") return approveDialog(id);
          if (action === "reject") return rejectDialog(id);
          if (action === "publish") {
            b.disabled = true;
            b.textContent = "Publishing…";
            const r = state.runs.find((x) => x.id === id);
            const result = await api(`runs/${id}/publish`, {
              revision: r.revision,
            });
            await refresh();
            toast(
              result.status === "published"
                ? "Published. Your article is live in the local CMS."
                : "Acknowledgement missing. The revision is safe to retry.",
              result.status !== "published",
            );
            return;
          }
          if (action === "prompt") {
            b.disabled = true;
            await api("settings/prompt", { version: b.dataset.version });
            await refresh();
            toast("Prompt version changed for new workflows.");
            return;
          }
        } catch (err) {
          toast(err.message, true);
          b.disabled = false;
        }
      }),
  );
  document.querySelectorAll("[data-filter]").forEach(
    (b) =>
      (b.onclick = () => {
        filter = b.dataset.filter;
        render();
      }),
  );
  const search = $("#global-search");
  search?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      query = e.target.value;
      filter = "all";
      if (route() === "content") render();
      else location.hash = "content";
    }
  });
  const filterInput = $("#content-search");
  filterInput?.addEventListener("input", (e) => {
    const pos = e.target.selectionStart;
    query = e.target.value;
    render();
    const input = $("#content-search");
    input.focus();
    input.setSelectionRange(pos, pos);
  });
  const edit = $("#edit-form");
  if (edit)
    edit.onsubmit = async (e) => {
      e.preventDefault();
      const b = edit.querySelector("[type=submit]");
      b.disabled = true;
      try {
        const r = state.runs.find((x) => x.id === edit.dataset.id),
          f = new FormData(edit);
        const content = {
          title: f.get("title"),
          description: f.get("description"),
          slug: f.get("slug"),
          sections: r.content.sections.map((s, i) => ({
            ...s,
            heading: f.get("heading-" + i),
            text: f.get("text-" + i),
          })),
        };
        await api(`runs/${r.id}/edit`, { revision: r.revision, content });
        editing = false;
        await refresh();
        toast("New revision saved. Previous approval is no longer valid.");
      } catch (err) {
        edit.querySelector(".form-error").textContent = err.message;
        b.disabled = false;
      }
    };
}
document.querySelector(".skip").addEventListener("click", (e) => {
  e.preventDefault();
  document.querySelector("#main")?.focus();
});
window.addEventListener("hashchange", () => {
  editing = false;
  filter = "all";
  render();
  window.scrollTo(0, 0);
});
window.addEventListener("focus", () => {
  if (state && !editing && !$("#dialog").open) refresh().catch(() => {});
});
refresh().catch((err) => {
  $("#app").innerHTML =
    `<div class="loading"><img src="/assets/logo.svg" alt="BuildrLab"><h1>Workspace unavailable</h1><p>${esc(err.message)}</p><p>Start the app and CMS with Docker Compose, then refresh this page.</p></div>`;
});
