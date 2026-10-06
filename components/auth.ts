// Client-only sign-in helpers (Google + EVM wallet). No server, no tokens stored.
export type User = { provider: "google" | "wallet"; name: string };

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

type TokenResp = { access_token?: string; error?: string };
type GoogleApi = {
  accounts: { oauth2: { initTokenClient(cfg: {
    client_id: string; scope: string;
    callback: (r: TokenResp) => void;
    error_callback?: (e: { type: string }) => void;
  }): { requestAccessToken(): void } } };
};
type Eip1193 = { request(a: { method: string; params?: unknown[] }): Promise<unknown> };
declare global { interface Window { google?: GoogleApi; ethereum?: Eip1193 } }

// Preload Google's script on page load so the popup can open straight from a click.
export function loadGoogle(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Google sign-in."));
    document.head.appendChild(s);
  });
}

// Must be called synchronously from a click/keypress, or the browser blocks the popup.
export function googleLogin(): Promise<User> {
  return new Promise((resolve, reject) => {
    if (!GOOGLE_CLIENT_ID) return reject(new Error("Google Client ID is not configured."));
    if (!window.google) return reject(new Error("Google sign-in is still loading. Try again."));
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "openid profile",
      callback: async (r) => {
        if (!r.access_token) return reject(new Error("Sign-in was cancelled."));
        try {
          const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${r.access_token}` },
          });
          const p = (await res.json()) as { given_name?: string; name?: string };
          resolve({ provider: "google", name: p.given_name ?? p.name ?? "Visitor" });
        } catch { reject(new Error("Could not read your Google profile.")); }
      },
      error_callback: (e) => reject(new Error(e.type === "popup_closed" ? "The sign-in window was closed." : "Google sign-in failed.")),
    });
    client.requestAccessToken();
  });
}

export async function walletLogin(): Promise<User> {
  const eth = window.ethereum;
  if (!eth) throw new Error("No wallet found. Install MetaMask or open this page in a wallet browser.");
  try {
    const [address] = (await eth.request({ method: "eth_requestAccounts" })) as string[];
    const message = `Sign in to Virtual Office\n\nAddress: ${address}\nNonce: ${crypto.randomUUID()}\nTime: ${new Date().toISOString()}`;
    await eth.request({ method: "personal_sign", params: [message, address] });
    return { provider: "wallet", name: `${address.slice(0, 6)}…${address.slice(-4)}` };
  } catch { throw new Error("Wallet request was rejected."); }
}

