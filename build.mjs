// Builds the site into dist/. No dependencies: needs only Node 20 or later.
// Set GITHUB_TOKEN to avoid the API's low anonymous rate limit.
// A failed API call stops the build, so a GitHub outage can't publish an empty page.

import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { featured } from "./projects.mjs";

const ORG = "Acasa-Labs";
const SITE = "https://acasa-labs.github.io";
const MAIN = "https://acasalabs.com";
const CONTACT = `${MAIN}/contact?from=/open-source`;
const HIDDEN = new Set([".github", "acasa-labs.github.io"]);

const TITLE = "Acasa Labs Open Source";
const DESCRIPTION =
  "Open source projects from Acasa Labs, including Lectern, a native Mac editor for code and text.";

async function github(path) {
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "acasa-labs-site-build" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API ${path}: ${res.status}`);
  return res.json();
}

async function loadProjects() {
  const repos = [];
  for (let page = 1; ; page++) {
    const batch = await github(`/orgs/${ORG}/repos?type=public&per_page=100&page=${page}`);
    if (!batch) throw new Error(`Organization ${ORG} not found`);
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  const visible = repos.filter((r) => !r.fork && !r.archived && !r.private && !HIDDEN.has(r.name));
  const projects = await Promise.all(
    visible.map(async (repo) => {
      const release = await github(`/repos/${ORG}/${repo.name}/releases/latest`);
      return { repo, release, feature: featured[repo.name] };
    }),
  );
  if (projects.length === 0) throw new Error("No public projects found");
  // Featured projects first, then most recently pushed.
  return projects.sort(
    (a, b) =>
      Number(Boolean(b.feature)) - Number(Boolean(a.feature)) ||
      new Date(b.repo.pushed_at) - new Date(a.repo.pushed_at),
  );
}

const esc = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const day = (iso) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const licence = (repo) => {
  const id = repo.license?.spdx_id;
  return id && id !== "NOASSERTION" ? id : null;
};

function downloadUrl({ repo, release }) {
  const asset = release?.assets?.find((a) => /\.(dmg|pkg|zip|tar\.gz)$/i.test(a.name));
  return asset?.browser_download_url ?? release?.html_url ?? repo.html_url;
}

function factRows({ repo, release, feature }) {
  const rows = [...feature.facts];
  if (licence(repo)) rows.push(["Licence", licence(repo)]);
  if (release) rows.push(["Latest", `${release.tag_name}, ${day(release.published_at)}`]);
  return rows;
}

function renderFeature(project, index) {
  const { repo, feature } = project;
  return `
      <article class="project" id="${esc(repo.name)}">
        <div class="project-head">
          <p class="index">${String(index + 1).padStart(2, "0")}</p>
          <img class="project-icon" src="${esc(feature.icon)}" alt="" width="96" height="96">
          <h3>${esc(feature.name)}</h3>
        </div>
        <div class="project-body">
          <div class="project-words">
            <p class="summary">${esc(feature.summary)}</p>
            <p>${esc(feature.detail)}</p>
            <div class="actions">
              <a class="button" href="${esc(downloadUrl(project))}">${esc(feature.primaryAction)}</a>
              <a class="text-link" href="${esc(repo.html_url)}">Read the source <span aria-hidden="true">&rarr;</span></a>
            </div>
          </div>
          <dl class="facts">
            ${factRows(project)
              .map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`)
              .join("\n            ")}
          </dl>
        </div>
        <ul class="features">
          ${feature.features
            .map(([label, text]) => `<li><h4>${esc(label)}</h4><p>${esc(text)}</p></li>`)
            .join("\n          ")}
        </ul>
        <figure class="terminal">
          <figcaption>Build it from source. ${esc(feature.fromSourceNote)}</figcaption>
          <pre><code>${feature.fromSource.map(esc).join("\n")}</code></pre>
        </figure>
      </article>`;
}

function renderLedger(projects) {
  if (projects.length === 0) return "";
  return `
      <ul class="ledger">
        ${projects
          .map(({ repo }) => {
            const meta = [repo.language, licence(repo)].filter(Boolean).join(", ");
            return `<li><a href="${esc(repo.html_url)}"><span class="ledger-name">${esc(repo.name)}</span><span class="ledger-text">${esc(repo.description ?? "")}</span><span class="ledger-meta">${esc(meta)}</span></a></li>`;
          })
          .join("\n        ")}
      </ul>`;
}

function schema(projects) {
  const graph = [
    {
      "@type": "Organization",
      "@id": `${MAIN}/#organization`,
      name: "Acasa Labs",
      url: MAIN,
      sameAs: [`https://github.com/${ORG}`],
    },
    ...projects
      .filter((p) => p.feature)
      .map((p) => ({
        "@type": "SoftwareApplication",
        name: p.feature.name,
        description: p.feature.summary,
        applicationCategory: "DeveloperApplication",
        operatingSystem: p.feature.operatingSystem,
        url: `${SITE}/#${p.repo.name}`,
        downloadUrl: downloadUrl(p),
        ...(p.release ? { softwareVersion: p.release.tag_name.replace(/^v/, "") } : {}),
        ...(licence(p.repo) ? { license: `https://spdx.org/licenses/${licence(p.repo)}.html` } : {}),
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        author: { "@id": `${MAIN}/#organization` },
      })),
  ];
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c");
}

function layout({ title, description, base, canonical, body, jsonLd = "" }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  ${canonical ? `<link rel="canonical" href="${canonical}">` : `<meta name="robots" content="noindex">`}
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${SITE}/">
  <meta property="og:image" content="${SITE}/assets/og.png">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="${base}assets/mark.svg" type="image/svg+xml">
  <link rel="preload" href="${base}assets/fonts/CabinetGrotesk-Extrabold.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Source+Sans+3:wght@400;500;600&display=swap">
  <link rel="stylesheet" href="${base}assets/styles.css">
  ${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : ""}
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <header class="site-header">
    <a class="brand" href="${base}"><img src="${base}assets/mark.svg" alt="" width="32" height="32"><span>Acasa Labs</span><span class="brand-tag">Open source</span></a>
    <nav aria-label="Main">
      <a href="https://github.com/${ORG}">GitHub</a>
      <a href="${MAIN}">acasalabs.com</a>
    </nav>
  </header>
${body}
  <footer class="site-footer">
    <p>&copy; ${new Date().getUTCFullYear()} Acasa Labs (OPC) Private Limited</p>
    <p><a href="https://github.com/${ORG}/acasa-labs.github.io">Source of this page</a></p>
  </footer>
</body>
</html>
`;
}

export function renderIndex(projects) {
  const features = projects.filter((p) => p.feature);
  const others = projects.filter((p) => !p.feature);
  const count = `${projects.length} public ${projects.length === 1 ? "project" : "projects"}`;
  const body = `  <main id="main">
    <section class="poster">
      <h1>Code you can read, run and change.</h1>
      <div class="poster-rule" aria-hidden="true"></div>
      <div class="poster-foot">
        <p class="lede">Open source from Acasa Labs, a small team in Surat that builds web apps, mobile apps and AI for other companies.</p>
        <p class="facts-line">${esc(count)} <span aria-hidden="true">/</span> <a href="https://github.com/${ORG}">github.com/${ORG}</a></p>
      </div>
    </section>

    <section class="projects" aria-labelledby="projects-title">
      <h2 id="projects-title" class="section-title">Projects</h2>${features.map(renderFeature).join("")}${renderLedger(others)}
    </section>

    <section class="closing">
      <h2>One team. We build the app and the automation.</h2>
      <div>
        <p>This is the part of our work anyone can read. Most of it runs inside our clients' companies.</p>
        <div class="actions">
          <a class="button" href="${CONTACT}">Start a conversation</a>
          <a class="text-link" href="${MAIN}/work">See the work <span aria-hidden="true">&rarr;</span></a>
        </div>
      </div>
    </section>
  </main>`;
  return layout({ title: TITLE, description: DESCRIPTION, base: "", canonical: `${SITE}/`, body, jsonLd: schema(projects) });
}

function renderNotFound() {
  const body = `  <main id="main">
    <section class="poster">
      <h1>Nothing at this address.</h1>
      <div class="poster-rule" aria-hidden="true"></div>
      <div class="actions"><a class="button" href="/">See the projects</a></div>
    </section>
  </main>`;
  return layout({ title: `Page not found | ${TITLE}`, description: DESCRIPTION, base: "/", body });
}

async function main() {
  const projects = await loadProjects();
  await rm("dist", { recursive: true, force: true });
  await mkdir("dist", { recursive: true });
  await cp("src/assets", "dist/assets", { recursive: true });
  await writeFile("dist/assets/styles.css", await readFile("src/styles.css"));
  await writeFile("dist/index.html", renderIndex(projects));
  await writeFile("dist/404.html", renderNotFound());
  await writeFile("dist/robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
  await writeFile(
    "dist/sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${SITE}/</loc></url>\n</urlset>\n`,
  );
  console.log(`Built dist/ with ${projects.length} project(s): ${projects.map((p) => p.repo.name).join(", ")}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
