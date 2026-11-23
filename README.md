# ChangeYourself.in — production site

Static website, no backend, no build step. Plain HTML/CSS/JS.

## Pages

- `/` — Home (Figma landing: hero, features, quotes, mock-tests section, Why Choose, CTA)
- `/about/` — About (mission, truthful stats, 2020–2025 timeline, team)
- `/pricing/` — Pricing (Free ₹0, Pro ₹499/mo, Premium ₹1,499/mo, Institutional Custom)
- `/mock-tests/` — 20 full UGC NET mock tests (Paper 1 + Paper 2 Psychology, 150 questions each)

## Files

- `styles.css` — shared design (black + dotted grid, white pills, CY purple/blue accent)
- `main.js` — rotating hero word, Login placeholder toast, coming-soon toasts
- `mock-tests/index.html` — self-contained mock-test app (all 3,000 questions inlined, no external fetches)

## Deploy (GitHub → Vercel)

1. Create a GitHub repo (e.g. `changeyourself`) and push this folder to it.
2. In Vercel: Add New → Project → import the repo. Framework preset: **Other** (static). No build command, no output directory change. Deploy.
3. In Vercel: Project → Settings → Domains → add `changeyourself.in` and `www.changeyourself.in`. Vercel shows the DNS records to add.
4. At your domain provider, set the DNS records Vercel gives you (A record + CNAME). Wait for propagation (minutes to a few hours). Do not remove the old site's DNS until the new site is verified live on its Vercel URL.

## Things the owner still needs to fill in

- **Payment links** — in `pricing/index.html`, the `PAYMENT_LINKS` config at the bottom (`pro` and `premium`). Paste your Razorpay / Instamojo payment URLs there. While empty, the Pro/Premium buttons link to the free mock tests with a "Payment link coming soon" note.
- **Team names** — `about/index.html` has 4 placeholder "Your Name" cards.
- **Login** — the Login button currently shows a "coming soon" toast; there is no auth yet.
- **Timeline/mission copy** — written from the Figma design summary; check it against the real history.
- **Dock links** — the bottom dock's feature buttons point to home sections and the mock tests until the real features (assessment, AI assistant, talks, community) exist.
