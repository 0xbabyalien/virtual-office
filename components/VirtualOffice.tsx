"use client";
import { useEffect, useRef, useState } from "react";
import type { SimpleIcon } from "simple-icons";
import { X_HANDLE, QUEST_POST, X_PROFILE, parseProfile, parseStatus } from "./quests";
import { googleLogin, walletLogin, loadGoogle, type User } from "./auth";
import { siReact, siNextdotjs, siTypescript, siTailwindcss, siNodedotjs, siPostgresql, siFirebase, siFigma, siGit, siGithub, siGmail, siX } from "simple-icons";

const TILE = 32;
const SPEED = 2.2;
const S = 1.35; // Sprite scale (bigger = easier to read)
const INK = "#14141a"; // Outline color for every character part

type R = { x: number; y: number; w: number; h: number };
const rc = (c: number, r: number, w = 1, h = 1): R => ({ x: c * TILE, y: r * TILE, w: w * TILE, h: h * TILE });

// Office floor plan (in tiles). Anything "solid" cannot be walked through.
const DESK = rc(3, 11, 3, 1);                 // Manager's desk (Death Note)
const BANK1 = rc(2, 2, 8, 1);                 // Upper row of workstations (4 seats)
const BANK2 = rc(2, 6, 8, 1);                 // Lower row of workstations (4 seats)
const SHELF = rc(1, 10, 1, 3);                // Bookshelf
const SOFA = rc(6, 12, 3, 1);                 // Lounge sofa
const COFFEE: R = { x: 6.6 * TILE, y: 10.6 * TILE, w: 2 * TILE, h: 22 };
const MEET: R = { x: 14 * TILE, y: 2.2 * TILE, w: 4 * TILE, h: 1.4 * TILE }; // Meeting table
const GLASS: R[] = [                          // Glass walls of the meeting room (door at columns 15-16)
  { x: 12 * TILE + 13, y: TILE, w: 6, h: 4 * TILE + 19 },
  { x: 12 * TILE + 13, y: 5 * TILE + 13, w: 3 * TILE - 13, h: 6 },
  { x: 17 * TILE, y: 5 * TILE + 13, w: 2 * TILE, h: 6 },
];
const PRINT = rc(15, 7, 2, 1);
const CAB = rc(18, 7, 1, 2);
const COUNTER = rc(13, 13, 6, 1);             // Pantry
const FRIDGE = rc(18, 10, 1, 2);
const COOLER = rc(13, 10);
const PTABLE = rc(15, 10, 2, 2);
const PLANTS: [number, number][] = [[1, 1], [11, 1], [13, 7], [1, 13], [11, 13]];
const SOLIDS: R[] = [
  BANK1, BANK2, DESK, SHELF, SOFA, COFFEE, MEET, ...GLASS, PRINT, CAB, COUNTER, FRIDGE, COOLER, PTABLE,
  ...PLANTS.map(([c, r]) => ({ x: c * TILE + 6, y: r * TILE + 6, w: 20, h: 20 })),
];
const MAP = Array.from({ length: 15 }, (_, r) =>
  Array.from({ length: 20 }, (_, c) => (r === 0 || r === 14 || c === 0 || c === 19 ? 1 : 0))
);

// The office background is drawn once onto a hidden canvas (lighter on performance)
function drawOffice(g: CanvasRenderingContext2D) {
  const T = TILE;
  const fill = (c: string, x: number, y: number, w: number, h: number) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const box = (x: number, y: number, w: number, h: number, c: string) => {
    g.fillStyle = c; g.fillRect(x, y, w, h); g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  };
  const disc = (cx: number, cy: number, rx: number, ry: number, c: string) => {
    g.fillStyle = c; g.strokeStyle = INK; g.lineWidth = 1; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  };
  const label = (t: string, x: number, y: number, w: number) => {
    box(x, y, w, 13, "#2d3436"); g.fillStyle = "#fff"; g.font = "bold 7px monospace"; g.textAlign = "center"; g.fillText(t, x + w / 2, y + 9);
  };
  const chair = (cx: number, cy: number, col = "#2f3542") => {
    disc(cx, cy, 10, 8, col); fill("rgba(255,255,255,.14)", cx - 7, cy - 5, 14, 3); box(cx - 9, cy + 6, 18, 5, col);
  };

  // Floors: gray carpet, wood (meeting room), tile (pantry), lounge rug
  for (let r = 0; r < 15; r++) for (let c = 0; c < 20; c++) fill((r + c) % 2 ? "#c4c9d2" : "#bcc2cc", c * T, r * T, T, T);
  for (let i = 0; i < 4 * T; i += 8) fill((i / 8) % 2 ? "#b98a5a" : "#ae7f50", 13 * T, T + i, 6 * T, 8);
  for (let r = 9; r < 14; r++) for (let c = 13; c < 19; c++) fill((r + c) % 2 ? "#eef1f3" : "#dde3e8", c * T, r * T, T, T);
  box(5.6 * T, 9.7 * T, 3.6 * T, 3.3 * T, "#4d6a8a");
  g.strokeStyle = "#7f9bbd"; g.strokeRect(5.6 * T + 6, 9.7 * T + 6, 3.6 * T - 12, 3.3 * T - 12);

  // Walls: top (with windows), sides/bottom (dark)
  fill("#ece9e2", 0, 0, 20 * T, T); fill("#c9c5ba", 0, T - 5, 20 * T, 5);
  const sky = g.createLinearGradient(0, 4, 0, 28); sky.addColorStop(0, "#8ec9f0"); sky.addColorStop(1, "#d3ecfa");
  for (const c of [2, 5, 8, 11]) {
    const x = c * T + 2, w = 2 * T - 4;
    box(x, 4, w, 24, "#8d97a3"); g.fillStyle = sky; g.fillRect(x + 2, 6, w - 4, 20);
    fill("#8fb8d6", x + 4, 17, 9, 9); fill("#7ea8c8", x + 17, 13, 11, 13); fill("#8fb8d6", x + 31, 19, 9, 7); fill("#7ea8c8", x + 43, 15, 10, 11);
    fill("#8d97a3", x + w / 2 - 1, 4, 2, 24); fill("rgba(255,255,255,.3)", x + 6, 6, 5, 20);
  }
  disc(10.5 * T, 15, 9, 9, "#fff"); g.strokeStyle = INK; g.beginPath(); g.moveTo(10.5 * T, 15); g.lineTo(10.5 * T, 9); g.moveTo(10.5 * T, 15); g.lineTo(10.5 * T + 5, 17); g.stroke(); // Wall clock
  box(36, 5, 22, 22, "#ffeaa7"); fill("#d63031", 40, 9, 14, 3); fill("#636e72", 40, 15, 14, 2); fill("#636e72", 40, 20, 10, 2);              // Poster
  box(14 * T, 4, 4 * T, 22, "#fff"); fill("#e74c3c", 14 * T + 8, 10, 40, 2); fill("#3498db", 14 * T + 8, 15, 62, 2); fill("#2d3436", 14 * T + 8, 20, 30, 2); // Whiteboard
  fill("#3b4252", 0, 0, T, 15 * T); fill("#3b4252", 19 * T, 0, T, 15 * T); fill("#3b4252", 0, 14 * T, 20 * T, T);
  fill("#566074", T - 4, T, 4, 13 * T); fill("#566074", 19 * T, T, 4, 13 * T); fill("#566074", 0, 14 * T, 20 * T, 4);
  box(9 * T + 3, 14 * T + 2, 2 * T - 6, T - 4, "#8fd3ee"); fill("#2f3542", 10 * T - 1, 14 * T + 2, 2, T - 4); // Entrance door
  label("EXIT", 9 * T + 16, 14 * T - 12, 32);
  box(9 * T + 4, 13 * T + 8, 2 * T - 8, 18, "#34495e");                                                      // Doormat
  label("PANTRY", 14.5 * T, 14 * T + 9, 3 * T);

  // Chairs + workstations
  for (const R of [BANK1, BANK2]) {
    for (let i = 0; i < R.w / 64; i++) chair(R.x + i * 64 + 32 + ((i * 7) % 5) - 2, R.y + R.h + 11);
    box(R.x, R.y, R.w, R.h, "#cfae82"); fill("#a68257", R.x + 1, R.y + R.h - 6, R.w - 2, 5);
    for (let i = 0; i < R.w / 64; i++) {
      const sx = R.x + i * 64;
      if (i > 0) fill("#8395a7", sx - 1, R.y - 4, 3, R.h + 4);                                 // Divider between desks
      box(sx + 20, R.y + 3, 24, 15, "#2d3436"); fill("#4aa8e8", sx + 22, R.y + 5, 20, 10); fill("rgba(255,255,255,.35)", sx + 22, R.y + 5, 20, 3);
      fill("#636e72", sx + 30, R.y + 18, 4, 3);
      box(sx + 22, R.y + 21, 20, 5, "#ecf0f1"); fill("#2d3436", sx + 46, R.y + 22, 4, 5);
      box(sx + 6, R.y + 10, 7, 7, i % 2 ? "#e17055" : "#00b894"); fill("#fff", sx + 52, R.y + 8, 8, 10);
    }
  }

  // Manager's desk (Death Note) + leather chair
  chair(DESK.x + DESK.w / 2, DESK.y - 12, "#5d2e2e");
  box(DESK.x, DESK.y, DESK.w, DESK.h, "#6d4326"); fill("#4a2c17", DESK.x + 1, DESK.y + DESK.h - 6, DESK.w - 2, 5);
  box(DESK.x + 38, DESK.y + 7, 20, 16, "#0d0d0d"); fill("#c0392b", DESK.x + 38, DESK.y + 7, 3, 16);
  disc(DESK.x + 12, DESK.y + 12, 6, 6, "#f6e58d"); fill("#636e72", DESK.x + 11, DESK.y + 16, 2, 7);   // Desk lamp
  box(DESK.x + 68, DESK.y + 6, 20, 14, "#b2bec3"); fill("#dff9fb", DESK.x + 70, DESK.y + 8, 16, 8);  // Laptop

  // Bookshelf + lounge (sofa, coffee table)
  box(SHELF.x, SHELF.y, SHELF.w, SHELF.h, "#6d4c2a");
  const bk = ["#e74c3c", "#3498db", "#f1c40f", "#2ecc71", "#9b59b6"];
  for (let k = 0; k < 3; k++) for (let j = 0; j < 5; j++) fill(bk[(k + j) % 5], SHELF.x + 4, SHELF.y + 4 + k * 30 + j * 5, 24, 4);
  box(SOFA.x, SOFA.y, SOFA.w, SOFA.h, "#3d5a80"); fill("#2d4a6b", SOFA.x + 1, SOFA.y + 22, SOFA.w - 2, 9);
  for (let i = 0; i < 3; i++) box(SOFA.x + 8 + i * 27, SOFA.y + 3, 26, 19, "#4a6fa5");
  box(SOFA.x, SOFA.y + 3, 7, 26, "#2d4a6b"); box(SOFA.x + SOFA.w - 7, SOFA.y + 3, 7, 26, "#2d4a6b");
  box(COFFEE.x, COFFEE.y, COFFEE.w, COFFEE.h, "#a5d8ec"); fill("#fff", COFFEE.x + 8, COFFEE.y + 6, 10, 8); fill("#e17055", COFFEE.x + 40, COFFEE.y + 7, 6, 6);

  // Meeting room (glass walls, table, chairs, laptops)
  for (const q of GLASS) { fill("rgba(160,215,240,.4)", q.x, q.y, q.w, q.h); g.strokeStyle = "#6c7a89"; g.strokeRect(q.x + 0.5, q.y + 0.5, q.w - 1, q.h - 1); }
  label("MEETING ROOM", 15 * T - 2, 5 * T + 15, 2 * T + 4);
  for (let i = 0; i < 4; i++) { chair(MEET.x + 16 + i * 32, MEET.y - 10, "#2c3e50"); chair(MEET.x + 16 + i * 32, MEET.y + MEET.h + 10, "#2c3e50"); }
  box(MEET.x, MEET.y, MEET.w, MEET.h, "#8b6b4a"); fill("rgba(255,255,255,.15)", MEET.x + 2, MEET.y + 2, MEET.w - 4, 4);
  for (let i = 0; i < 3; i++) box(MEET.x + 14 + i * 40, MEET.y + 12, 18, 13, "#b2bec3");
  fill("#fff", MEET.x + 110, MEET.y + 14, 12, 9);

  // Printer area + filing cabinet
  box(PRINT.x, PRINT.y, PRINT.w, PRINT.h, "#dfe6e9"); box(PRINT.x + 8, PRINT.y + 5, 34, 22, "#b2bec3"); fill("#fff", PRINT.x + 14, PRINT.y + 2, 22, 5); fill("#2ecc71", PRINT.x + 36, PRINT.y + 12, 3, 3);
  box(PRINT.x + 48, PRINT.y + 8, 12, 16, "#636e72");
  box(CAB.x, CAB.y, CAB.w, CAB.h, "#95a5a6");
  for (let k = 0; k < 4; k++) { box(CAB.x + 3, CAB.y + 2 + k * 15, 26, 13, "#b2bec3"); fill("#636e72", CAB.x + 13, CAB.y + 7 + k * 15, 6, 2); }

  // Pantry
  box(COUNTER.x, COUNTER.y, COUNTER.w, COUNTER.h, "#ecf0f1"); fill("#b2bec3", COUNTER.x + 1, COUNTER.y + 24, COUNTER.w - 2, 7);
  box(COUNTER.x + 28, COUNTER.y + 6, 30, 16, "#b2bec3"); fill("#636e72", COUNTER.x + 42, COUNTER.y + 4, 2, 4);
  box(COUNTER.x + 100, COUNTER.y + 4, 22, 22, "#2d3436"); fill("#e17055", COUNTER.x + 104, COUNTER.y + 8, 4, 4);
  box(COUNTER.x + 140, COUNTER.y + 6, 30, 18, "#636e72"); fill("#2d3436", COUNTER.x + 143, COUNTER.y + 9, 18, 12);
  box(FRIDGE.x, FRIDGE.y, FRIDGE.w, FRIDGE.h, "#f5f6fa"); fill("#b2bec3", FRIDGE.x + 2, FRIDGE.y + 28, FRIDGE.w - 4, 1);
  fill("#636e72", FRIDGE.x + 24, FRIDGE.y + 8, 3, 10); fill("#636e72", FRIDGE.x + 24, FRIDGE.y + 34, 3, 16);
  box(COOLER.x + 6, COOLER.y + 12, 20, 18, "#ecf0f1"); box(COOLER.x + 8, COOLER.y + 1, 16, 13, "#74b9ff");
  for (const [cx, cy] of [[-8, 32], [72, 32], [32, -6], [32, 70]]) disc(PTABLE.x + cx, PTABLE.y + cy, 8, 8, "#e17055");
  disc(PTABLE.x + 32, PTABLE.y + 32, 28, 22, "#e0cda9"); fill("#fff", PTABLE.x + 22, PTABLE.y + 26, 7, 7); fill("#00b894", PTABLE.x + 36, PTABLE.y + 30, 7, 7);

  // Plants
  for (const [c, r] of PLANTS) {
    const x = c * T, y = r * T;
    box(x + 10, y + 18, 12, 10, "#b5651d");
    for (const [dx, dy, col] of [[16, 10, "#27ae60"], [10, 14, "#27ae60"], [22, 14, "#27ae60"], [16, 6, "#2ecc71"]] as [number, number, string][]) disc(x + dx, y + dy, 6, 6, col);
  }
}

const customLinkedin: SimpleIcon = {
  title: "LinkedIn",
  slug: "linkedin",
  hex: "0A66C2",
  source: "https://www.linkedin.com",
  svg: '<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>LinkedIn</title><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg>',
  path: "M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"
};

// ====== PORTFOLIO CONTENT (edit the text, links, and name in this section) ======
type Item = { title: string; text: string; link?: { label: string; url: string }; icons?: SimpleIcon[] };
type Hotspot = { id: string; label: string; emoji: string; color: string; at: [number, number]; pin: [number, number]; r: number; intro?: string; items?: Item[] };
const PROFILE = {
  name: "Death Note",
  role: "Web Developer & UI Designer",
  tagline: "Welcome to my virtual office. Walk around, step up to an icon, then press the action button (or E).",
};
const it = (title: string, text: string, link?: Item["link"], icons?: SimpleIcon[]): Item => ({ title, text, link, icons });
const HOTSPOTS: Hotspot[] = [
  { id: "about", label: "About Me", emoji: "👤", color: "#74b9ff", at: [96, 107], pin: [96, 50], r: 46,
    intro: "Hi! I'm 0xbabyalien, a web developer who loves building digital products that are clean and a pleasure to use.",
    items: [it("Who I am", "I'm a developer focused on front-end and user experience. Tell your story and share your working values here."),
            it("What I enjoy", "Building interactive interfaces, small games, and creative experiments, like the virtual office you're exploring right now."),
            it("What I'm looking for", "Job opportunities, freelance projects, or collaborations in web and digital products.")] },
  { id: "projects", label: "Projects", emoji: "💼", color: "#ff7675", at: [160, 107], pin: [160, 50], r: 46,
    intro: "Here are a few of my favorite projects. Pick one to see the details.",
    items: [it("2D Virtual Office", "This very portfolio. Built with React and Canvas: an office map, moving characters, and a dialog system.", undefined, [siReact, siNextdotjs, siTypescript]),
            it("Project 2 (replace)", "Short description: the problem solved, your role, and the technologies used.", { label: "View project", url: "https://github.com/" }),
            it("Project 3 (replace)", "Short description of the third project and its results or impact.", { label: "View project", url: "https://github.com/" })] },
  { id: "skills", label: "Skills", emoji: "🛠", color: "#55efc4", at: [224, 107], pin: [224, 50], r: 46,
    intro: "The tools I use every day:",
    items: [it("Front-end", "React, Next.js, TypeScript, Tailwind CSS, HTML Canvas.", undefined, [siReact, siNextdotjs, siTypescript, siTailwindcss]),
            it("Back-end & data", "Node.js, REST APIs, PostgreSQL, Firebase.", undefined, [siNodedotjs, siPostgresql, siFirebase]),
            it("Design", "Figma, design systems, prototyping, and basic user research.", undefined, [siFigma]),
            it("Ways of working", "Git, code review, and teamwork in agile environments.", undefined, [siGit, siGithub])] },
  { id: "exp", label: "Experience", emoji: "📈", color: "#fdcb6e", at: [288, 107], pin: [288, 50], r: 46,
    intro: "My career journey so far:",
    items: [it("2024 - present", "Job title and company (replace). Add 1-2 measurable achievements."),
            it("2022 - 2024", "Previous job title and company (replace)."),
            it("Freelance", "Independent projects for small clients and communities (replace).")] },
  { id: "edu", label: "Education", emoji: "🎓", color: "#a29bfe", at: [76, 368], pin: [48, 306], r: 46,
    intro: "This bookshelf holds everything I've learned along the way.",
    items: [it("Education", "Major, university, and graduation year (replace)."),
            it("Certificates", "List of important certificates or trainings (replace)."),
            it("Currently learning", "Topics you're studying right now (replace).")] },
  { id: "services", label: "Services", emoji: "📊", color: "#fab1a0", at: [512, 150], pin: [512, 44], r: 50,
    intro: "In this meeting room, I present solutions to clients.",
    items: [it("Website development", "Company profiles, landing pages, and online stores that are fast and responsive."),
            it("Interactive web apps", "Dashboards, games, and tools designed around your needs."),
            it("UI/UX consulting", "Reviews of your interface and user flow, with clear improvement suggestions.")] },
  { id: "cv", label: "Download CV", emoji: "🖨", color: "#81ecec", at: [512, 272], pin: [512, 212], r: 46,
    intro: "This printer just printed my latest CV.",
    items: [it("CV summary", "A 2-3 sentence summary of your profile, main experience, and standout skills."),
            it("Download PDF", "My full CV is available as a PDF.", { label: "Download CV (PDF)", url: "/cv.pdf" })] },
  { id: "fun", label: "Fun Facts", emoji: "☕", color: "#e1b12c", at: [527, 388], pin: [527, 402], r: 50,
    intro: "Coffee break! A few things about me outside of work:",
    items: [it("Hobbies", "Casual coding, gaming, and drawing (replace with your own hobbies)."),
            it("Favorite coffee", "Replace with your favorite drink."),
            it("Anime", "I'm an anime fan. That's why L, Misa, and Ryuk are wandering around this office.")] },
  { id: "contact", label: "Contact", emoji: "✉", color: "#fd79a8", at: [320, 408], pin: [320, 392], r: 48,
    intro: "My door is always open. Reach me through:",
    items: [
      it("Email", "I usually reply within 1-2 business days.", { label: "Send email", url: "mailto:nama@email.com" }, [siGmail]),
      it("LinkedIn", "Let's connect professionally.", { label: "Open LinkedIn", url: "https://www.linkedin.com/in/0xbabyalien" }, [customLinkedin]),
      it("GitHub", "My code and projects live here.", { label: "Open GitHub", url: "https://github.com/0xbabyalien" }, [siGithub]),
      it("X (Twitter)", "Follow my daily tech updates.", { label: "Open X", url: "https://x.com/0xbabyalien" }, [siX])
    ] 
  },
  { id: "desk", label: "Mystery Desk", emoji: "📓", color: "#e17055", at: [DESK.x + DESK.w / 2, DESK.y + DESK.h / 2], pin: [DESK.x + DESK.w / 2, DESK.y - 28], r: 80 },
];

type Char = "light" | "l" | "misa" | "ryuk";
type Dir = "up" | "down" | "left" | "right";

const PAL: Record<Char, { skin: string; hair: string; top: string; acc: string; pants: string; shoe: string }> = {
  light: { skin: "#ffe0bd", hair: "#9a6a35", top: "#f5f5f5", acc: "#8b5a2b", pants: "#3b3f4a", shoe: "#222" },
  l:     { skin: "#fbe3c8", hair: "#15151a", top: "#f4f4f4", acc: "#dcdde1", pants: "#3a6ea5", shoe: "#fbe3c8" },
  misa:  { skin: "#ffe0bd", hair: "#f6d365", top: "#15151a", acc: "#e63946", pants: "#15151a", shoe: "#e63946" },
  ryuk:  { skin: "#9aa5a8", hair: "#0d0d0d", top: "#1d1d22", acc: "#b0b7bb", pants: "#1d1d22", shoe: "#0d0d0d" },
};

const TAG: Record<Char, { name: string; color: string; role: string }> = {
  light: { name: "LIGHT (YOU)", color: "#ff7675", role: "You - brown jacket, brown hair" },
  l:     { name: "L", color: "#74b9ff", role: "Detective - white shirt, panda eyes" },
  misa:  { name: "MISA", color: "#fdcb6e", role: "Blonde pigtails, black dress" },
  ryuk:  { name: "RYUK", color: "#a29bfe", role: "Tall, gray skin, wings, carries an apple" },
};

function drawChar(
  ctx: CanvasRenderingContext2D,
  f: number,
  x: number,
  y: number,
  dir: Dir,
  moving: boolean,
  type: Char,
  tag = true,
  nameOverride?: string
) {
  const c = PAL[type];
  const bob = moving ? Math.abs(Math.sin(f * 0.3)) * 1.5 : Math.sin(f * 0.08) * 0.8;
  const step = moving ? Math.sin(f * 0.3) * 3 : 0;
  const blink = f % 200 > 190;
  const ox = dir === "left" ? -2 : dir === "right" ? 2 : 0;
  const back = dir === "up";

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath(); ctx.ellipse(x + 12, y + 28, 11, 4, 0, 0, Math.PI * 2); ctx.fill();

  ctx.save();
  ctx.translate(x + 12, y + 28);
  ctx.scale(S, S);
  ctx.translate(-12, -30);

  const r = (rx: number, ry: number, w: number, h: number, col: string, outline = true) => {
    ctx.fillStyle = col; ctx.fillRect(rx, ry, w, h);
    if (outline) { ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.strokeRect(rx + 0.5, ry + 0.5, w - 1, h - 1); }
  };

  if (type === "ryuk") {
    const flap = Math.sin(f * 0.12) * 3;
    for (const s of [1, -1]) {
      const px = (v: number) => (s === 1 ? v : 24 - v);
      ctx.fillStyle = "#17171c"; ctx.strokeStyle = INK;
      ctx.beginPath();
      ctx.moveTo(px(4), 10); ctx.lineTo(px(-11), 0 + flap); ctx.lineTo(px(-6), 10);
      ctx.lineTo(px(-12), 17 + flap); ctx.lineTo(px(4), 21);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }

  const liftL = step > 0 ? step : 0;
  const liftR = step < 0 ? -step : 0;
  r(5, 21 - liftL, 5, 9, c.pants);
  r(14, 21 - liftR, 5, 9, c.pants);
  r(4, 28 - liftL, 6, 3, c.shoe);
  r(14, 28 - liftR, 6, 3, c.shoe);

  ctx.translate(0, -bob);

  if (type === "light") {
    r(3, 10, 18, 11, c.acc);
    r(8, 10, 8, 11, c.top);
    r(11, 11, 2, 7, "#c0392b", false);
  } else if (type === "l") {
    r(2, 10, 20, 12, c.top);
    r(2, 19, 20, 2, c.acc, false);
  } else if (type === "misa") {
    r(5, 10, 14, 8, c.top);
    r(2, 17, 20, 6, c.top);
    r(2, 21, 20, 2, c.acc);
  } else {
    r(3, 10, 18, 12, c.top);
    r(8, 11, 8, 2, c.acc, false);
    ctx.fillStyle = c.top; ctx.strokeStyle = INK;
    for (const s of [1, -1]) {
      const px = (v: number) => (s === 1 ? v : 24 - v);
      ctx.beginPath(); ctx.moveTo(px(3), 10); ctx.lineTo(px(0), 5); ctx.lineTo(px(7), 9); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }

  const sw = -step * 0.5;
  const sleeve = type === "misa" ? c.skin : type === "light" ? c.acc : c.top;
  r(0, 11 + sw, 3, 8, sleeve);
  r(21, 11 - sw, 3, 8, sleeve);
  r(0, 18 + sw, 3, 3, c.skin);
  r(21, 18 - sw, 3, 3, c.skin);
  if (type === "ryuk") {
    ctx.fillStyle = "#d63031"; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.arc(22.5, 22 - sw, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  const hy = type === "ryuk" ? -5 : type === "l" ? 1 : -1;
  const hh = type === "ryuk" ? 14 : type === "l" ? 11 : 12;
  r(5, hy, 14, hh, c.skin);

  if (type === "light") {
    r(4, hy - 2, 16, 6, c.hair);
    r(4, hy + 3, 3, 4, c.hair); r(9, hy + 3, 3, 3, c.hair); r(17, hy + 3, 3, 3, c.hair);
  } else if (type === "l") {
    r(3, hy - 3, 18, 6, c.hair);
    r(3, hy - 6, 3, 3, c.hair); r(9, hy - 6, 4, 3, c.hair); r(16, hy - 6, 3, 3, c.hair);
    r(3, hy + 3, 3, 5, c.hair); r(18, hy + 3, 3, 5, c.hair);
    r(6, hy + 3, 12, 2, c.hair);
  } else if (type === "misa") {
    r(3, hy - 2, 18, 6, c.hair); r(5, hy + 3, 14, 2, c.hair);
    r(0, hy + 3, 4, 14, c.hair); r(20, hy + 3, 4, 14, c.hair);
    r(0, hy + 3, 4, 2, c.acc); r(20, hy + 3, 4, 2, c.acc);
  } else {
    r(4, hy - 3, 16, 5, c.hair);
    r(3, hy - 6, 3, 4, c.hair); r(8, hy - 9, 3, 7, c.hair); r(13, hy - 10, 3, 8, c.hair); r(18, hy - 6, 3, 4, c.hair);
    r(3, hy + 2, 3, 4, c.hair); r(18, hy + 2, 3, 4, c.hair);
  }

  if (back) {
    r(4, hy, 16, hh - 1, c.hair);
  } else {
    const ey = hy + (type === "l" ? 4 : 5);
    for (const ex of [7 + ox, 13 + ox]) {
      if (blink) { r(ex, ey + 2, 4, 1, INK, false); continue; }
      r(ex, ey, 4, 4, type === "ryuk" ? "#f7e7a0" : "#fff", false);
      if (type === "ryuk") { r(ex, ey, 4, 4, "#e63946", false); r(ex + 1, ey, 1, 4, "#000", false); }
      else if (type === "l") r(ex + 1, ey, 3, 4, "#000", false);
      else r(ex + 1, ey + 1, 2, 3, type === "light" ? "#d68910" : "#8e44ad", false);
      if (type !== "ryuk") r(ex + 1, ey + 1, 1, 1, "#fff", false);
      r(ex, ey - 2, 4, 1, type === "ryuk" ? "#000" : c.hair, false);
    }
    if (type === "l") { r(6 + ox, hy + 8, 6, 1, "rgba(70,50,80,.6)", false); r(12 + ox, hy + 8, 6, 1, "rgba(70,50,80,.6)", false); }
    if (type === "misa") { r(6 + ox, hy + 9, 2, 1, "#ff8fa3", false); r(16 + ox, hy + 9, 2, 1, "#ff8fa3", false); r(5, hy + hh - 1, 14, 1, c.acc, false); }

    if (type === "ryuk") {
      r(7 + ox, hy + 9, 10, 3, INK, false);
      for (let i = 0; i < 5; i++) r(8 + ox + i * 2, hy + 9, 1, 2, "#fff", false);
    } else if (type === "light") {
      r(11 + ox, hy + 9, 4, 1, "#7a3b3b", false); r(14 + ox, hy + 8, 1, 1, "#7a3b3b", false);
    } else {
      r(11 + ox, hy + 9, 3, 1, "#7a3b3b", false);
    }
  }

  ctx.restore();

  if (!tag) return;
  const t = TAG[type];
  const hairTop = type === "ryuk" ? -15 : -7;
  const ty = y + 28 + (hairTop - 30) * S - 6;
  ctx.font = "bold 9px monospace"; ctx.textAlign = "center";
  const nm = nameOverride ?? t.name;
  const w = ctx.measureText(nm).width + 10;
  ctx.fillStyle = "rgba(10,10,15,0.8)"; ctx.fillRect(x + 12 - w / 2, ty - 10, w, 13);
  ctx.fillStyle = t.color; ctx.fillRect(x + 12 - w / 2, ty + 3, w, 2);
  ctx.fillStyle = "#fff"; ctx.fillText(nm, x + 12, ty);
}

// ====== DIALOG ======
type Choice = { label: string; next: string | null; action?: "google" | "wallet" | "logout" | "claim" | "submit"; quest?: string };
type DNode = { text: string; choices: Choice[]; link?: { label: string; url: string }; icons?: SimpleIcon[]; input?: { placeholder: string; quest: string } };

const DIALOGS: Record<string, DNode> = {
  "l.start": { text: "Light-kun. Hm. You look awfully calm for someone who is being watched.", choices: [
    { label: "Watched? By whom?", next: "l.watch" },
    { label: "What are you eating?", next: "l.sweets" },
    { label: "I just work at this office.", next: "l.alibi" } ] },
  "l.watch": { text: "By me, of course. The chance that you're involved is small, but it isn't zero. For me, that's enough.", choices: [
    { label: "That sounds like an accusation.", next: "l.accuse" },
    { label: "Whatever you say.", next: null } ] },
  "l.accuse": { text: "Not an accusation, just an observation. If you're innocent, you have nothing to worry about. Are you worried?", choices: [] },
  "l.sweets": { text: "Strawberry cake. The brain needs sugar. Oh, and don't mind how I sit. With my knees up, my reasoning improves.", choices: [
    { label: "That's so weird.", next: "l.weird" },
    { label: "Can I have a slice?", next: "l.share" } ] },
  "l.weird": { text: "Many people say that. But my cases still get solved.", choices: [] },
  "l.share": { text: "Sure. One slice only. The rest is mine, and I will know if you take more.", choices: [] },
  "l.alibi": { text: "This office is a good place to think. There are walls, there is a floor, and there is a desk that keeps catching your attention.", choices: [
    { label: "Which desk?", next: "l.desk" },
    { label: "I'm not looking at anything.", next: "l.nolook" } ] },
  "l.desk": { text: "The manager's desk in the bottom-left corner, with the black book on top. You've glanced over there twice already.", choices: [] },
  "l.nolook": { text: "Then it's no problem. We'll see soon enough.", choices: [] },

  "misa.start": { text: "Light~! You finally came! Misa has been waiting for ages, you know!", choices: [
    { label: "What are you doing here?", next: "misa.doing" },
    { label: "I'm busy, Misa.", next: "misa.busy" },
    { label: "Your hair looks great today.", next: "misa.hair" } ] },
  "misa.doing": { text: "Practicing a new song! But my manager says Misa follows you around too much, hehe. Don't worry, Misa will always help Light, no matter what!", choices: [
    { label: "Keep your voice down.", next: "misa.quiet" },
    { label: "Sing something for me.", next: "misa.sing" } ] },
  "misa.quiet": { text: "Oops! Okay okay, Misa will be quiet. But I'm still your Misa, got it?", choices: [] },
  "misa.sing": { text: "No way, L would hear. He's always peeking from the corner while eating cake!", choices: [] },
  "misa.busy": { text: "Hmph, it's always like this... But that's okay! Misa will wait while eating candy.", choices: [
    { label: "Sorry, I'll take you out to eat soon.", next: "misa.promise" },
    { label: "Alright, see you later.", next: null } ] },
  "misa.promise": { text: "Promise?! Misa is writing it in her diary. No lying, or Misa will sulk for a whole week!", choices: [] },
  "misa.hair": { text: "Kyaa! Really?! Misa is wearing a new ribbon, you know! Light always notices the little things!", choices: [
    { label: "It suits you.", next: "misa.happy" },
    { label: "I have to get back to work.", next: null } ] },
  "misa.happy": { text: "Misa could faint from happiness... I'm going to sleep so well tonight!", choices: [] },

  "ryuk.start": { text: "Kukuku... humans are always so interesting. Did you bring an apple? No? How boring.", choices: [
    { label: "You can eat apples in this world?", next: "ryuk.apple" },
    { label: "Why are you following me?", next: "ryuk.why" },
    { label: "Can I sign in?", next: "ryuk.login" },
    { label: "I'm heading out.", next: "ryuk.bye" } ] },
  "ryuk.login": { text: "Kukuku... want your name written in my notebook? Choose how you'll sign in, human.", choices: [
    { label: "Sign in with Google", next: null, action: "google" },
    { label: "Connect crypto wallet", next: null, action: "wallet" },
    { label: "Maybe later", next: null } ] },
  "ryuk.welcome": { text: "Kukuku... {name}. Your name is written down now. I will remember you.", choices: [
    { label: "See Ryuk's quests", next: "ryuk.quests" },
    { label: "Later", next: null } ] },
  "ryuk.quests": { text: "Kukuku... finish my X quests, human. Progress: {progress}. Pick one.", choices: [
    { label: "Follow on X", next: "ryuk.q.follow", quest: "follow" },
    { label: "Like the post", next: "ryuk.q.like", quest: "like" },
    { label: "Retweet the post", next: "ryuk.q.retweet", quest: "retweet" },
    { label: "Reply to the post", next: "ryuk.q.reply", quest: "reply" },
    { label: "Not now", next: null } ] },
  "ryuk.q.follow": { text: `Follow @${X_HANDLE} on X, then paste your own profile link below so I know who you are.`, link: { label: "Open profile", url: X_PROFILE }, icons: [siX],
    input: { placeholder: "https://x.com/yourname", quest: "follow" }, choices: [{ label: "Back", next: "ryuk.quests" }] },
  "ryuk.q.like": { text: "Like the post. X leaves no link for a like, so I'll take your word for it.", link: { label: "Open post", url: QUEST_POST }, icons: [siX],
    choices: [{ label: "I've liked it", next: null, action: "claim", quest: "like" }, { label: "Back", next: "ryuk.quests" }] },
  "ryuk.q.retweet": { text: "Retweet the post. A plain retweet has no link either, so I'll take your word for it.", link: { label: "Open post", url: QUEST_POST }, icons: [siX],
    choices: [{ label: "I've retweeted it", next: null, action: "claim", quest: "retweet" }, { label: "Back", next: "ryuk.quests" }] },
  "ryuk.q.reply": { text: "Reply to the post, then paste the link to your reply (x.com/yourname/status/...).", link: { label: "Open post", url: QUEST_POST }, icons: [siX],
    input: { placeholder: "https://x.com/yourname/status/123...", quest: "reply" }, choices: [{ label: "Back", next: "ryuk.quests" }] },
  "ryuk.qfail": { text: "Hmm. {error}", choices: [{ label: "Back to quests", next: "ryuk.quests" }, { label: "Close", next: null }] },
  "ryuk.complete": { text: "Kukuku... all four quests done, {name}. You amuse me, human.", choices: [] },
  "ryuk.fail": { text: "Hmm, that didn't work. {error}", choices: [
    { label: "Try again", next: "ryuk.login" },
    { label: "Close", next: null } ] },
  "ryuk.account": { text: "Kukuku... {name}, you're already in my notebook. Shall I erase your name?", choices: [
    { label: "See Ryuk's quests", next: "ryuk.quests" },
    { label: "Erase my name (sign out)", next: null, action: "logout" },
    { label: "Leave it", next: null } ] },
  "ryuk.apple": { text: "Apples in your world taste amazing. Bring me one and I'll be very happy.", choices: [
    { label: "I'll find one for you.", next: "ryuk.promise" },
    { label: "It's just a fruit.", next: "ryuk.fruit" } ] },
  "ryuk.promise": { text: "Good. I like humans who keep their promises. Don't take too long.", choices: [] },
  "ryuk.fruit": { text: "Just a fruit? Kukuku... you've never lost it, have you.", choices: [] },
  "ryuk.why": { text: "My world is boring. Here there's you, there's L, there's Misa. The best entertainment in a very long time.", choices: [
    { label: "I'm not entertainment.", next: "ryuk.fun" },
    { label: "Just watch from a distance.", next: "ryuk.watch" } ] },
  "ryuk.fun": { text: "All humans are entertainment. But you are the funniest one.", choices: [] },
  "ryuk.watch": { text: "Relax, I'm only a spectator. Almost always.", choices: [] },
  "ryuk.bye": { text: "Go ahead. I'll float around here. There's no place more fun.", choices: [] },

  "desk.start": { text: "A black notebook lies on the desk. Its cover reads DEATH NOTE.", choices: [
    { label: "Open the first page", next: "desk.page" },
    { label: "Don't touch it", next: "desk.leave" } ] },
  "desk.page": { text: "The page is blank and a little dusty. But you feel like someone is watching from behind.", choices: [
    { label: "Look behind you", next: "desk.behind" },
    { label: "Close the book", next: null } ] },
  "desk.behind": { text: "Ryuk is already floating behind you, grinning wide. \"Kukuku... you finally turned around.\"", choices: [
    { label: "Talk to Ryuk", next: "ryuk.start" },
    { label: "Close", next: null } ] },
  "desk.leave": { text: "You step away from the desk. The notebook stays quietly where it was.", choices: [] },
};

for (const h of HOTSPOTS) {
  if (!h.items) continue;
  DIALOGS[`${h.id}.start`] = { text: h.intro ?? "", choices: h.items.map((q, i) => ({ label: q.title, next: `${h.id}.i${i}` })) };
  h.items.forEach((q, i) => {
    DIALOGS[`${h.id}.i${i}`] = { text: q.text, link: q.link, icons: q.icons, choices: [{ label: "Back to list", next: `${h.id}.start` }, { label: "Done", next: null }] };
  });
}

const DESK_COLOR = "#e17055";
const speakerName = (w: string) => HOTSPOTS.find((h) => h.id === w)?.label ?? TAG[w as Char].name.replace(" (YOU)", "");
const speakerColor = (w: string) => HOTSPOTS.find((h) => h.id === w)?.color ?? TAG[w as Char].color;

function Portrait({ who }: { who: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const hs = HOTSPOTS.find((h) => h.id === who);
  useEffect(() => {
    if (hs || !ref.current) return;
    const ctx = ref.current.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    let id = 0, f = 0;
    const tick = () => {
      f++;
      ctx.clearRect(0, 0, 96, 104);
      ctx.save(); ctx.scale(1.4, 1.4);
      drawChar(ctx, f, 22, 36, "down", false, who as Char, false);
      ctx.restore();
      id = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(id);
  }, [who]);
  if (hs) return <div className="w-20 h-[87px] flex items-center justify-center text-4xl">{hs.emoji}</div>;
  return <canvas ref={ref} width={96} height={104} className="w-20 h-auto block" style={{ imageRendering: "pixelated" }} />;
}

function DialogBox({ dkey, vars, onChoose, onClose }: { dkey: string; vars: { name: string; error: string; progress: string; done: string[] }; onChoose: (c: Choice, value?: string) => void; onClose: () => void }) {
  const node = DIALOGS[dkey];
  const text = node.text.replace("{name}", vars.name).replace("{error}", vars.error).replace("{progress}", vars.progress);
  const inp = node.input;
  const [val, setVal] = useState("");
  const who = dkey.split(".")[0];
  const color = speakerColor(who);
  const [n, setN] = useState(0);
  const done = n >= text.length;
  const choices: Choice[] = node.choices.length ? node.choices : [{ label: "Close", next: null }];

  useEffect(() => {
    if (done) return;
    const id = setInterval(() => setN((v) => v + 1), 22); // Typewriter effect
    return () => clearInterval(id);
  }, [done]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "escape") return onClose();
      if ((e.target as HTMLElement)?.tagName === "INPUT") return; // typing in the link box
      if (!done) { if (k === "e" || k === "enter" || k === " ") setN(text.length); return; }
      if ((k === "e" || k === "enter") && choices.length === 1) return onChoose(choices[0]);
      const i = parseInt(k, 10) - 1;
      if (choices[i]) onChoose(choices[i]);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-2 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-[720px] max-h-[65vh] overflow-y-auto rounded-xl border-2 bg-[#12121a] p-3 shadow-2xl" style={{ borderColor: color }}>
        <div className="flex gap-3">
          <div className="shrink-0 rounded-lg overflow-hidden self-start" style={{ background: color + "26" }}><Portrait who={who} /></div>
          <div className="flex-1 min-w-0">
            <div className="font-mono font-bold text-sm" style={{ color }}>{speakerName(who)}</div>
            <p onClick={() => setN(text.length)} className="text-sm leading-relaxed mt-1 min-h-[3.5rem] cursor-pointer">{text.slice(0, n)}</p>
          </div>
        </div>
        {done && node.icons && (
          <div className="mt-3 flex flex-wrap gap-2">
            {node.icons.map((ic) => {
              const content = (
                <span className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 text-black text-xs font-bold transition-transform active:scale-95 shadow-md">
                  <svg role="img" viewBox="0 0 24 24" width="18" height="18" aria-label={ic.title}>
                    <path d={ic.path} fill={"#" + ic.hex} />
                  </svg>
                  {ic.title}
                  {node.link && <span className="ml-1 text-sm font-normal">↗</span>}
                </span>
              );

              return node.link ? (
                <a key={ic.slug} href={node.link.url} target="_blank" rel="noopener noreferrer" className="inline-block no-underline">
                  {content}
                </a>
              ) : (
                <div key={ic.slug}>
                  {content}
                </div>
              );
            })}
          </div>
        )}
        {done && inp && (
          <div className="mt-3 flex gap-2">
            <input value={val} onChange={(e) => setVal(e.target.value)} placeholder={inp.placeholder} autoCapitalize="none" autoCorrect="off" spellCheck={false}
              onKeyDown={(e) => e.key === "Enter" && onChoose({ label: "Check", next: null, action: "submit", quest: inp.quest }, val)}
              className="flex-1 min-w-0 px-3 py-2 rounded-lg text-black text-sm" />
            <button onClick={() => onChoose({ label: "Check", next: null, action: "submit", quest: inp.quest }, val)} className="px-4 rounded-lg bg-red-600 text-sm font-bold">Check link</button>
          </div>
        )}
        {done ? (
          <div className="mt-3 flex flex-col gap-2">
            {choices.map((c, i) => (
              <button key={c.label} onClick={() => onChoose(c)} className="text-left px-3 py-3 rounded-lg bg-white/10 active:bg-white/25 text-sm">
                {choices.length > 1 ? `${i + 1}. ` : ""}{c.quest && vars.done.includes(c.quest) ? "✓ " : ""}{c.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[10px] opacity-50 mt-2">Tap the text to skip</p>
        )}
        <button onClick={onClose} className="mt-2 text-[11px] opacity-60 underline">End conversation (Esc)</button>
      </div>
    </div>
  );
}

export default function VirtualOffice() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const player = useRef({ x: 44, y: 138, dir: "down" as Dir });
  const keys = useRef<Record<string, boolean>>({});
  const bubbles = useRef<{ text: string; until: number }[]>([]);
  const targetRef = useRef<string | null>(null);   // Nearest character/desk/icon that can be interacted with
  const talkingRef = useRef<string | null>(null);  // Who is currently being talked to
  const [chat, setChat] = useState("");
  const [target, setTarget] = useState<string | null>(null);
  const [dlg, setDlg] = useState<string | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const [user, setUser] = useState<User | null>(null);
  const [err, setErr] = useState("");
  const userRef = useRef<User | null>(null);
  const busy = useRef(false);
  const USER_KEY = "vo-user";
  const QUEST_KEY = "vo-quests";
  const [quests, setQuests] = useState<Record<string, string>>({});
  const questsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    loadGoogle().catch(() => {});
    try {
      const s = localStorage.getItem(USER_KEY);
      if (s) { const u = JSON.parse(s) as User; const q = JSON.parse(localStorage.getItem(QUEST_KEY) ?? "{}") as Record<string, string>; userRef.current = u; questsRef.current = q; setUser(u); setQuests(q); } // eslint-disable-line react-hooks/set-state-in-effect
    } catch {}
  }, []);

  const saveUser = (u: User | null) => {
    userRef.current = u; setUser(u);
    try { if (u) localStorage.setItem(USER_KEY, JSON.stringify(u)); else localStorage.removeItem(USER_KEY); } catch {}
  };
  const saveQuest = (id: string, proof: string | null) => {
    const q = proof === null ? {} : { ...questsRef.current, [id]: proof };
    questsRef.current = q; setQuests(q);
    try { if (proof === null) localStorage.removeItem(QUEST_KEY); else localStorage.setItem(QUEST_KEY, JSON.stringify(q)); } catch {}
    return Object.keys(q).length;
  };
  const choose = (c: Choice, value?: string) => {
    if (!c.action) return openDialog(c.next);
    if ((c.action === "claim" || c.action === "submit") && !userRef.current) return openDialog("ryuk.login"); // quests need sign-in
    if (c.action === "logout") { saveUser(null); saveQuest("", null); return openDialog(c.next); }
    if (c.action === "claim" && c.quest) return openDialog(saveQuest(c.quest, "claimed") >= 4 ? "ryuk.complete" : "ryuk.quests");
    if (c.action === "submit" && c.quest) {
      const fail = (m: string) => { setErr(m); openDialog("ryuk.qfail"); };
      const v = value ?? "";
      const me = questsRef.current.follow;
      if (c.quest === "follow") {
        const h = parseProfile(v);
        if (!h) return fail("That isn't an X profile link. Use the form https://x.com/yourname.");
        if (h.toLowerCase() === X_HANDLE.toLowerCase()) return fail("That's my profile. Paste YOUR profile link.");
        return openDialog(saveQuest("follow", h) >= 4 ? "ryuk.complete" : "ryuk.quests");
      }
      if (!me) return fail("Finish the Follow quest first so I know your handle.");
      const st = parseStatus(v);
      if (!st) return fail("That isn't a post link. Use the form https://x.com/yourname/status/123...");
      if (st.handle.toLowerCase() !== me.toLowerCase()) return fail(`That reply belongs to @${st.handle}, not @${me}.`);
      if (QUEST_POST.endsWith("/" + st.id)) return fail("That's the original post. Paste the link to your reply.");
      return openDialog(saveQuest("reply", st.id) >= 4 ? "ryuk.complete" : "ryuk.quests");
    }
    if (busy.current) return;
    busy.current = true;
    (c.action === "google" ? googleLogin() : walletLogin())
      .then((u) => { saveUser(u); setErr(""); if (talkingRef.current === "ryuk") openDialog("ryuk.welcome"); })
      .catch((e) => { setErr(e instanceof Error ? e.message : "Sign-in failed."); if (talkingRef.current === "ryuk") openDialog("ryuk.fail"); })
      .finally(() => { busy.current = false; });
  };

  const openDialog = (key: string | null) => {
    if (key === "ryuk.login" && userRef.current) key = "ryuk.account";
    if (key?.startsWith("ryuk.q") && !userRef.current) key = "ryuk.login";
    talkingRef.current = key ? key.split(".")[0] : null;
    if (key) {
      keys.current = {};
      const id = key.split(".")[0];
      if (HOTSPOTS.some((h) => h.id === id) && !seenRef.current.has(id)) { seenRef.current.add(id); }
    }
    setDlg(key);
  };
  const interact = () => {
    if (talkingRef.current) return;
    if (targetRef.current) openDialog(`${targetRef.current}.start`);
  };

  useEffect(() => {
    // Ignore keys while typing in the chat box or while a dialog is open
    const blocked = (e: KeyboardEvent) => (e.target as HTMLElement)?.tagName === "INPUT" || !!talkingRef.current;
    const d = (e: KeyboardEvent) => {
      if (blocked(e)) return;
      const k = e.key.toLowerCase();
      if (k === "e") { if (!e.repeat) interact(); return; }
      keys.current[k] = true;
      if (e.key.startsWith("Arrow")) e.preventDefault();
    };
    const u = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; };
    const clear = () => { keys.current = {}; };
    window.addEventListener("keydown", d);
    window.addEventListener("keyup", u);
    window.addEventListener("blur", clear);
    return () => { window.removeEventListener("keydown", d); window.removeEventListener("keyup", u); window.removeEventListener("blur", clear); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    let animId = 0;
    let frame = 0;
    const office = document.createElement("canvas");
    office.width = 20 * TILE; office.height = 15 * TILE;
    drawOffice(office.getContext("2d")!);
    const vig = ctx.createRadialGradient(320, 200, 150, 320, 200, 420);
    vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, "rgba(0,0,0,.35)");

    const bots = [
      { x: 220, y: 140, vx: 0.7, vy: 0.3, type: "l" as Char, dir: "right" as Dir },
      { x: 380, y: 250, vx: -0.6, vy: 0.2, type: "misa" as Char, dir: "left" as Dir },
      { x: 300, y: 100, vx: 0.5, vy: -0.4, type: "ryuk" as Char, dir: "right" as Dir },
    ];

    const isWall = (px: number, py: number) => MAP[Math.floor(py / TILE)]?.[Math.floor(px / TILE)] === 1;
    const hits = (x: number, y: number) =>
      isWall(x + 2, y + 2) || isWall(x + 22, y + 2) || isWall(x + 2, y + 26) || isWall(x + 22, y + 26) ||
      SOLIDS.some((q) => x + 22 > q.x && x + 2 < q.x + q.w && y + 26 > q.y && y + 2 < q.y + q.h);

    const loop = () => {
      frame++;
      const p = player.current;
      const k = keys.current;
      const talking = talkingRef.current;

      let dx = 0, dy = 0;
      if (!talking) {
        if (k["w"] || k["arrowup"]) dy -= 1;
        if (k["s"] || k["arrowdown"]) dy += 1;
        if (k["a"] || k["arrowleft"]) dx -= 1;
        if (k["d"] || k["arrowright"]) dx += 1;
      }
      const moving = dx !== 0 || dy !== 0;
      if (moving) {
        if (dx && dy) { dx *= 0.707; dy *= 0.707; }
        if (dx) p.dir = dx < 0 ? "left" : "right"; else p.dir = dy < 0 ? "up" : "down";
        if (!hits(p.x + dx * SPEED, p.y)) p.x += dx * SPEED;
        if (!hits(p.x, p.y + dy * SPEED)) p.y += dy * SPEED;
      }

      // Find the nearest interaction target: characters, icons, and the desk
      const pcx = p.x + 12, pcy = p.y + 14;
      let best: string | null = null, bd = Infinity;
      for (const b of bots) {
        const d = Math.hypot(b.x + 12 - pcx, b.y + 14 - pcy);
        if (d < 60 && d < bd) { bd = d; best = b.type; }
      }
      for (const h of HOTSPOTS) {
        const d = Math.hypot(h.at[0] - pcx, h.at[1] - pcy) - 8;
        if (d < h.r && d < bd) { bd = d; best = h.id; }
      }
      if (talking) best = talking;
      if (best !== targetRef.current) { targetRef.current = best; setTarget(best); }

      for (const b of bots) {
        if (talking === b.type) { // Stop and face Light
          const ddx = p.x - b.x, ddy = p.y - b.y;
          b.dir = Math.abs(ddx) > Math.abs(ddy) ? (ddx > 0 ? "right" : "left") : (ddy > 0 ? "down" : "up");
          continue;
        }
        if (hits(b.x + b.vx, b.y)) b.vx *= -1; else b.x += b.vx;
        if (hits(b.x, b.y + b.vy)) b.vy *= -1; else b.y += b.vy;
        if (Math.random() < 0.015) { b.vx = (Math.random() - 0.5) * 1.4; b.vy = (Math.random() - 0.5) * 1.4; }
        b.dir = Math.abs(b.vx) > Math.abs(b.vy) ? (b.vx > 0 ? "right" : "left") : (b.vy > 0 ? "down" : "up");
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const camX = Math.max(0, Math.min(p.x - canvas.width / 2 + 12, 20 * TILE - canvas.width));
      const camY = Math.max(0, Math.min(p.y - canvas.height / 2 + 12, 15 * TILE - canvas.height));
      ctx.save(); ctx.translate(-camX, -camY);

      ctx.drawImage(office, 0, 0);
      if (best === "desk") {
        ctx.fillStyle = "rgba(225,112,85,.28)"; ctx.fillRect(DESK.x, DESK.y, DESK.w, DESK.h);
        ctx.strokeStyle = DESK_COLOR; ctx.lineWidth = 2; ctx.strokeRect(DESK.x + 1, DESK.y + 1, DESK.w - 2, DESK.h - 2);
      }
      ctx.fillStyle = "rgba(10,10,15,.8)"; ctx.fillRect(DESK.x + DESK.w / 2 - 36, DESK.y + DESK.h + 3, 72, 12);
      ctx.fillStyle = "#fff"; ctx.font = "bold 7px monospace"; ctx.textAlign = "center";
      ctx.fillText("DEATH NOTE DESK", DESK.x + DESK.w / 2, DESK.y + DESK.h + 12);

      const all = [
        ...bots.map((b) => ({ x: b.x, y: b.y, dir: b.dir, type: b.type, moving: talking !== b.type })),
        { x: p.x, y: p.y, dir: p.dir, type: "light" as Char, moving },
      ].sort((a, b) => a.y - b.y);
      all.forEach((e) => drawChar(ctx, frame, e.x, e.y, e.dir, e.moving, e.type, true, e.type === "light" ? userRef.current?.name.slice(0, 16) : undefined));

      // Floating portfolio icon at each spot (green check = already visited)
      for (const h of HOTSPOTS) {
        const act = best === h.id && !talking;
        const px = h.pin[0], py = h.pin[1] + Math.sin(frame * 0.08 + h.pin[0]) * 2;
        const rad = act ? 12 : 9;
        ctx.fillStyle = "#fff"; ctx.strokeStyle = h.color; ctx.lineWidth = act ? 3 : 2;
        ctx.beginPath(); ctx.arc(px, py, rad, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.font = (act ? "14px" : "11px") + " sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#111";
        ctx.fillText(h.emoji, px, py + (act ? 5 : 4));
        if (seenRef.current.has(h.id)) {
          ctx.fillStyle = "#27ae60"; ctx.beginPath(); ctx.arc(px + 9, py - 9, 5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#fff"; ctx.font = "bold 7px sans-serif"; ctx.fillText("✓", px + 9, py - 6.5);
        }
        if (act) {
          ctx.font = "bold 8px monospace";
          const w = ctx.measureText(h.label).width + 12;
          ctx.fillStyle = "rgba(10,10,15,.85)"; ctx.fillRect(px - w / 2, py + 15, w, 13);
          ctx.fillStyle = h.color; ctx.fillRect(px - w / 2, py + 28, w, 2);
          ctx.fillStyle = "#fff"; ctx.fillText(h.label, px, py + 24.5);
        }
      }
      const tb = best && !talking ? bots.find((q) => q.type === best) : undefined;
      if (tb) {
        const bob = Math.sin(frame * 0.15) * 2;
        ctx.strokeStyle = TAG[tb.type].color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(tb.x + 12, tb.y + 28, 16, 6, 0, 0, Math.PI * 2); ctx.stroke();
        const mx = tb.x + 12, my = tb.y + 28 + ((tb.type === "ryuk" ? -15 : -7) - 30) * S - 38;
        ctx.fillStyle = "#fff"; ctx.strokeStyle = INK; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(mx, my + bob, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.font = "11px sans-serif"; ctx.fillStyle = "#111"; ctx.fillText("💬", mx, my + bob + 4);
      }

      const now = performance.now();
      bubbles.current = bubbles.current.filter((b) => b.until > now);
      ctx.font = "10px monospace"; ctx.textAlign = "center";
      bubbles.current.forEach((b, i) => {
        const w = ctx.measureText(b.text).width + 12;
        const by = p.y - 58 - i * 18;
        ctx.fillStyle = "#fff"; ctx.fillRect(p.x + 12 - w / 2, by, w, 16);
        ctx.strokeStyle = INK; ctx.strokeRect(p.x + 12 - w / 2 + 0.5, by + 0.5, w - 1, 15);
        ctx.fillStyle = "#111"; ctx.fillText(b.text, p.x + 12, by + 11);
      });

      ctx.restore();
      ctx.fillStyle = vig; ctx.fillRect(0, 0, canvas.width, canvas.height); // Room lighting: brighter in the center
      animId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animId);
  }, []);

  const sendChat = () => {
    const text = chat.trim();
    if (!text) return;
    bubbles.current = [{ text, until: performance.now() + 3500 }, ...bubbles.current].slice(0, 3);
    setChat("");
  };

  const hold = (key: string) => ({
    onPointerDown: () => { keys.current[key] = true; },
    onPointerUp: () => { keys.current[key] = false; },
    onPointerLeave: () => { keys.current[key] = false; },
  });

  const hs = HOTSPOTS.find((h) => h.id === target);
  const actionLabel = !target ? "Approach an icon / character" : hs ? `${hs.emoji} ${hs.label}` : `Talk: ${speakerName(target)}`;

  return (
    <div className="flex flex-col items-center bg-[#0a0a0f] min-h-screen text-white p-2 gap-2">
      <header className="w-full max-w-[720px] text-center">
        <h1 className="font-mono font-black text-2xl">{PROFILE.name}</h1>
        <p className="text-sm text-red-400 font-semibold">{PROFILE.role}</p>
        <p className="text-[11px] opacity-70 mt-1">{PROFILE.tagline}</p>
        {user && (
          <p className="text-[11px] mt-1 text-emerald-400">
            Signed in as {user.name} ({user.provider === "google" ? "Google" : "wallet"}){" "}
            <button onClick={() => choose({ label: "", next: null, action: "logout" })} className="underline">Sign out</button>
          </p>
        )}
      </header>
      <div className="w-full max-w-[720px] aspect-[1.6/1] border-4 border-white rounded-xl overflow-hidden shadow-2xl bg-black">
        <canvas ref={canvasRef} width={640} height={400} className="w-full h-full block" style={{ imageRendering: "pixelated" }} />
      </div>

      {/* Controls: d-pad on the left, Action button on the right (same on mobile and desktop; WASD/arrows and E still work) */}
      <div className="flex items-end justify-between w-full max-w-[720px] gap-3">
        <div className="grid grid-cols-3 gap-2 select-none touch-none">
          <div></div><button {...hold("w")} className="bg-white/20 p-3 rounded-lg">▲</button><div></div>
          <button {...hold("a")} className="bg-white/20 p-3 rounded-lg">◀</button>
          <button {...hold("s")} className="bg-white/20 p-3 rounded-lg">▼</button>
          <button {...hold("d")} className="bg-white/20 p-3 rounded-lg">▶</button>
        </div>
        <button
          onClick={interact}
          disabled={!target || !!dlg}
          className="ml-auto min-w-[130px] min-h-[64px] px-4 rounded-2xl text-sm font-bold bg-red-600 disabled:bg-white/10 disabled:text-white/40 active:scale-95 transition-transform select-none"
        >
          {target && !hs ? "💬 " : ""}{actionLabel}
        </button>
      </div>

      <div className="flex gap-2 w-full max-w-[720px]">
        <input value={chat} onChange={(e) => setChat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChat()} placeholder="Type a message above your character..." className="flex-1 px-3 py-2 rounded-lg text-black text-sm" />
        <button onClick={sendChat} className="bg-red-600 px-5 rounded-lg text-sm font-bold">Send</button>
      </div>
      <p className="text-[10px] font-mono opacity-50 pb-24">WASD / arrow keys to move, E or the action button to interact.</p>

      {dlg && (
        <DialogBox
          key={dlg}
          dkey={dlg}
          vars={{ name: user?.name ?? "human", error: err, progress: `${Object.keys(quests).length}/4`, done: Object.keys(quests) }}
          onChoose={choose}
          onClose={() => openDialog(null)}
        />
      )}
    </div>
  );
          }
