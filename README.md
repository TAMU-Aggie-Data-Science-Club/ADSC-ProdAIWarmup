# Who’s in the Room?

A projector-friendly, interactive 3D warmup for the Aggie Data Science Club’s **AI in Production** workshop. Includes 24 synthetic attendees, orbit/zoom, name search, seven color modes, answer cards, cosine nearest neighbors, animated updates, and a short explanation of the math. No framework, API keys, or server database.

## Run locally

From this folder:

```sh
python3 -m http.server 5173
```

Open **http://localhost:5173**. Three.js is included in `vendor/`, so there is no install or build required for local use. Serve through HTTP; opening `index.html` as a file will block ES modules. Fonts fall back to system fonts if offline. Use a modern browser with WebGL2. When graphics are unavailable, search and neighbor cards still work.

For development checks and a clean static hosting folder (Node.js 22 recommended):

```sh
npm ci
npm test
npm run build
```

The build copies public app files and the pinned Three.js distribution into `dist/`. It excludes tests, setup scripts, and repository metadata. No runtime CDN is used for Three.js; Google Fonts is optional.

## Connect Google Form

**Google Form → Google Sheet → Apps Script → Web App URL → `DATA_ENDPOINT`**

1. In the form’s **Responses** tab, link a Google Sheet. Use the eight questions in the workshop brief. Do not publish the raw spreadsheet.
2. In that sheet, open **Extensions → Apps Script**. Paste `google-apps-script.gs`.
3. Set `SHEET_NAME` to the exact tab name (default `Form Responses 1`). Leave `SPREADSHEET_ID` empty for a script bound to that sheet; otherwise supply its ID.
4. Choose **Deploy → New deployment → Web app**. Set **Execute as: Me** and **Who has access: Anyone**. Authorize and deploy. If your institution disables anonymous web apps, use an approved account that permits this deployment.
5. Copy the deployed **`/exec` URL**, not `/dev`. Paste it into `const DATA_ENDPOINT = "";` at the top of `app.js`. Restart/reload the page, or rebuild and redeploy the static files.
6. Submit a test response. Within about five seconds after the previous request finishes, the badge should show **Live data** and your person should appear. A valid empty live sheet displays an empty room, not demo people.

After changing the Apps Script, use **Deploy → Manage deployments → Edit → New version → Deploy**. A Google sign-in/HTML response usually means the deployment is not accessible to Anyone. The browser follows Google’s content-service redirect; do not add `no-cors` (it would hide the JSON).

The endpoint returns `{ headers: [...], rows: [{ "What's your full name?": "Maya", ... }], generatedAt: "ISO date" }`. Headers and row properties are restricted to the eight questions. `generatedAt` is response freshness metadata, never a form submission timestamp. The frontend also accepts header/array rows and object arrays, using exact headers and common shortened aliases. It never retains email, submission timestamps, student IDs, or unrecognized columns. A custom endpoint must also apply the allowlist before returning data.

Polling times out after 10 seconds. Failure, invalid JSON, or stale response metadata keeps the last successful live snapshot; before the first success, it keeps demo data. It retries automatically without reloading. Unchanged valid datasets are normal and do not count as stale. No attendee data is saved to browser storage.

The app cannot connect your actual form until you configure the URL. The supplied Apps Script has a mocked contract test; deploy and submit one real response to verify your Google account’s permissions and end-to-end connection.

## Deploy

Upload the contents of **`dist/`** to any static host. For GitHub Pages, publish the repository root (the vendored library is included), or publish `dist/` through your usual Pages workflow. A folder upload to a static hosting provider is also sufficient. No server-side configuration is required.

A Sites deployment, if created during setup, is private to the owner by default. Use the local URL for projection, or explicitly share/publish through your host if attendees should open the app themselves. The Apps Script endpoint is anonymous by design and exposes only the eight intended answers; use responses attendees are comfortable showing in the workshop.

## Customize

- **Colors:** `PALETTE` near the top of `app.js`. Categories use the order in `OPTIONS` in `data.js`; majors sort alphabetically, with extra colors generated if needed. The legend shows only categories present.
- **Weights:** `WEIGHTS` in `data.js`: classification 0.5, major 1.0, work style 1.2, comfort 0.8, activity 1.0, career fair 0.5, goal 1.4.
- **Polling:** `POLL_INTERVAL` in `app.js` (5,000 ms after the preceding request completes). Requests never overlap.
- **Demo:** edit `seeds` at the bottom of `data.js`. Each numeric category entry indexes its exact `OPTIONS` list.
- **Title/subtitle:** `index.html`. Theme, layout, and projector/mobile sizing: `styles.css`.
- **Motion:** auto-rotation can be paused. Reduced-motion browser settings disable automatic rotation and position tweening.

## How the numbers work

Categorical answers use one-hot encoding. Majors are trimmed and uppercased; new majors become new slots. Classification, comfort, and fair use normalized ordinal values and the normalized pair `[1 − value, value]`. This preserves agreement at the low end (e.g. two “No” responses), which a scalar zero alone cannot capture with cosine. Missing answers add zeros, not an invented category match. Entirely missing feature vectors have similarity zero.

Each group is multiplied by the square root of its weight, then the complete vector is L2-normalized. The square root makes a group’s dot-product contribution equal its configured weight. Neighbors are the highest three cosine scores in this original space, excluding the selected response. Scores are answer similarity, not a probability of friendship; incomplete answers have less evidence.

PCA uses a deterministic symmetric Jacobi eigensolver on centered vectors. Features are not independently standardized because that would undo the chosen weights and amplify rare categories. Three principal components set visual position. Axis sign/permutation alignment reduces map flips between updates; genuine structural changes can still move the room. Tiny deterministic jitter separates overlapping nodes and never affects similarity. The 3D map loses information, so apparent distance and similarity can disagree.

People are identified by normalized name plus occurrence in response order. Duplicate names have separate nodes and search labels. Normal append-only Form submissions preserve selection, even when new majors appear. Renaming/reordering/removing earlier duplicate-name rows can change identity; the source provides no private stable identifier. This keeps timestamps and student IDs out of the app.

## Files and validation

- `index.html`, `styles.css`, `app.js`: interface, configuration, polling, and interactions.
- `feed.js`: validated, timed network snapshots.
- `scene.js`: Three.js rendering, orbit controls, animation, and neighbor lines.
- `data.js`: parser, demo, encoding, cosine similarity, PCA.
- `google-apps-script.gs`: complete Google backend with an output allowlist.
- `tests/data.test.mjs`: math, parser, privacy, and small-dataset regression checks.

Three.js is pinned to 0.180.0; its license is in `vendor/THREE-LICENSE.txt`. Orbit behavior uses the official [Three.js controls](https://threejs.org/docs/#OrbitControls).

The optional `document.modelContext` selection tool is feature-detected. Browsers without WebMCP support use the regular interface. No supported live WebMCP validation context was available during initial setup; this optional enhancement is not required for workshop use.
