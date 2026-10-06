# Virtual Office

An interactive 2D portfolio. Instead of a plain page, visitors walk through a pixel-art office, talk to characters, and step up to icons to read about the owner's profile, projects, skills, and contact details. The theme is Death Note: the visitor plays **Light**, and **L**, **Misa**, and **Ryuk** wander around the office.

Live site: https://0xbabyalien.github.io/virtual-office/

## Features

- **2D office map** drawn entirely with HTML Canvas: workstations, a meeting room with glass walls, a pantry, a lounge, a bookshelf, a printer, and plants. There are no image assets.
- **Walking and collisions** with WASD or arrow keys, or the on-screen D-pad on mobile.
- **Portfolio hotspots**: floating icons placed around the office. Step close and press **E** (or the action button) to open a dialog.
- **Dialog system** with a typewriter effect, branching choices, number-key shortcuts, links, and technology icons.
- **NPC characters** (L, Misa, Ryuk) that roam on their own and stop to face you when you talk to them.
- **Chat bubbles**: type in the box under the canvas and the message appears above your character.
- **Sign-in with Google or a crypto wallet**, started from Ryuk's dialog.
- **X quests** (follow, like, retweet, reply) unlocked after signing in.
- **Static export** deployed to GitHub Pages by GitHub Actions.

## Tech stack

| Area | Tools |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4, plus a few global styles |
| Graphics | HTML Canvas 2D |
| Icons | `simple-icons` |
| Sign-in | Google Identity Services (token client), EIP-1193 wallets (`window.ethereum`) |
| Hosting | GitHub Pages via GitHub Actions |

## Project structure

```
virtual-office/
├── .github/workflows/deploy.yml   # Build and deploy to GitHub Pages on every push
├── app/
│   ├── favicon.ico
│   ├── globals.css                # Tailwind import and base colors
│   ├── layout.tsx                 # Root layout, fonts (Geist), page metadata
│   └── page.tsx                   # Renders <VirtualOffice />
├── components/
│   ├── VirtualOffice.tsx          # The whole game: map, characters, dialogs, UI
│   ├── auth.ts                    # Google and wallet sign-in helpers
│   └── quests.ts                  # X quest settings and link validators
├── public/                        # Static SVG files from the Next.js template
├── eslint.config.mjs
├── next.config.ts                 # Static export and GitHub Pages base path
├── next-env.d.ts
├── package.json
├── postcss.config.mjs
├── tsconfig.json
└── .env.local                     # Local only, git-ignored (see "Configuration")
```

`out/` is created by `npm run build` and is git-ignored.

## How the code is organized

### `components/VirtualOffice.tsx`

The file reads top to bottom in these parts:

1. **Floor plan**: tile constants and rectangles (`DESK`, `BANK1`, `MEET`, `COUNTER`, ...). Everything in `SOLIDS` blocks movement.
2. **`drawOffice`**: paints the background once onto a hidden canvas (floors, walls, windows, furniture), so each frame only draws moving things.
3. **Portfolio content**: the `PROFILE` object and the `HOTSPOTS` list. **This is the section to edit** to change your name, role, texts, links, and icon positions.
4. **Characters**: `PAL` (colors), `TAG` (name tags), and `drawChar`, which draws each sprite with animated steps, blinking, and Ryuk's wings.
5. **`DIALOGS`**: all conversations as a tree of nodes (`text`, `choices`, optional `link`, `icons`, `input`). Hotspot dialogs are generated from `HOTSPOTS` automatically.
6. **`Portrait` and `DialogBox`**: the dialog UI, the typewriter effect, and keyboard handling.
7. **`VirtualOffice`**: the main component. It holds the game loop (movement, collisions, NPC wandering, nearest-target detection, rendering), the sign-in and quest logic, and the page layout with controls.

### Hotspots

| Hotspot | Where | Content |
|---|---|---|
| About Me | Top wall | Profile and what you are looking for |
| Projects | Top wall | Featured projects with technology icons |
| Skills | Top wall | Front-end, back-end, design, workflow tools |
| Experience | Top wall | Career timeline |
| Education | Bookshelf | Education, certificates, current learning |
| Services | Meeting room | What you offer to clients |
| Download CV | Printer | CV summary and PDF link |
| Fun Facts | Pantry | Hobbies and personal facts |
| Contact | Near the exit | Email, LinkedIn, GitHub, X |
| Mystery Desk | Manager's desk | Easter egg |

### Controls

| Input | Action |
|---|---|
| `W A S D` or arrow keys | Move |
| `E` or the red button | Interact with the nearest icon, character, or desk |
| `1`, `2`, `3`... | Pick a dialog choice |
| `Esc` | Close the dialog |
| Chat box + `Enter` | Show a bubble above your character |

## Sign-in and quests

Talk to **Ryuk** and choose **Can I sign in?**.

- **Google**: opens the Google popup and reads only your name (`openid profile`).
- **Wallet**: connects an EVM wallet (for example MetaMask) and asks you to sign a short message. The shortened address becomes your display name.

After signing in, your name appears above your character and in the page header. The session is stored in the browser (`localStorage`, key `vo-user`) and contains only a name and provider, with no tokens. Sign out from the header or from Ryuk's menu.

Once signed in, Ryuk offers four **X quests**: follow, like, retweet, and reply. Progress is stored under `vo-quests` and cleared on sign-out.

| Quest | What the visitor does | What the app checks |
|---|---|---|
| Follow | Pastes their own X profile link | The link format, and that it is not the owner's profile |
| Like | Confirms with a button | Nothing (self-reported) |
| Retweet | Confirms with a button | Nothing (self-reported) |
| Reply | Pastes the link to their reply | The link format, that its handle matches the Follow quest, and that it is not the original post |

> **Important:** this is a static site with no server, so sign-in and quests are **not verified**. Wallet signatures are not checked, and X actions cannot be confirmed without the X API. Use them for personalization and for collecting submissions to review manually, never to protect anything valuable.

## Getting started

Requirements: Node.js 20 or newer (the deploy workflow uses Node 22).

```bash
git clone https://github.com/0xbabyalien/virtual-office.git
cd virtual-office
npm install
```

### Configuration

Create `.env.local` in the project root (the folder that contains `package.json`):

```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Use the **Client ID** only. Never put a Client Secret in this project; every `NEXT_PUBLIC_` variable is visible to visitors.

Create the Client ID in Google Cloud Console: **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**. Under **Authorized JavaScript origins** add:

- `http://localhost:3000` for local development
- `https://0xbabyalien.github.io` for the live site (origin only, without `/virtual-office`)

For the X quests, edit `components/quests.ts`:

```ts
export const X_HANDLE = "0xbabyalien";
export const QUEST_POST = `https://x.com/${X_HANDLE}/status/<POST_ID>`;
```

`<POST_ID>` is the number at the end of the URL of the post people should like, retweet, and reply to.

### Run locally

```bash
npm run dev
```

Open http://localhost:3000. Restart the server after changing `.env.local`.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Create the static site in `out/` |
| `npm run lint` | Run ESLint |

`npm start` is not used, because the site is a static export. To preview a build, serve the `out/` folder with any static file server.

## Deployment

Every push triggers `.github/workflows/deploy.yml`, which installs dependencies, runs `npm run build`, and publishes `out/` to GitHub Pages.

One-time setup in the GitHub repository:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. **Settings → Secrets and variables → Actions → Variables → New repository variable**: name `GOOGLE_CLIENT_ID`, value is your Client ID. A Client ID is public, so a variable is fine; a secret is not needed.

`next.config.ts` sets `output: "export"` and uses `/virtual-office` as the base path in production, so the site works under `https://<user>.github.io/virtual-office/`. If you rename the repository, update `basePath` and `assetPrefix` there.

## Customizing

- **Your name, role, and tagline**: `PROFILE` in `VirtualOffice.tsx`.
- **Portfolio texts, links, and technology icons**: `HOTSPOTS` in `VirtualOffice.tsx`.
- **Character conversations**: `DIALOGS` in `VirtualOffice.tsx`.
- **Office layout**: the rectangles at the top of `VirtualOffice.tsx`, and `drawOffice`.
- **Page title and description**: `metadata` in `app/layout.tsx`.

## Known issues and to-do

- The CV link is `/cv.pdf`, but the site is served under `/virtual-office`. Put `cv.pdf` in `public/` and change the link to `/virtual-office/cv.pdf`.
- `app/layout.tsx` still has the default title ("Create Next App").
- Much of the portfolio text is placeholder content marked "(replace)".
- Phones need a wallet browser to use wallet sign-in; WalletConnect is not included.
- Wallet detection uses `window.ethereum`. When several wallet extensions are installed they can conflict; EIP-6963 support would fix this.
