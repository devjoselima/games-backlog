// Cliente mínimo da IGDB (autenticação via Twitch Client Credentials).
import fs from "node:fs";
import path from "node:path";

type Token = { valor: string; expiraEm: number };
let tokenCache: Token | null = null;
let dotEnvCache: Record<string, string> | null = null;

export function getServerEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  if (!dotEnvCache) {
    dotEnvCache = {};
    try {
      const envPath = path.resolve(process.cwd(), ".env");
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf-8");
        for (const line of content.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eqIdx = trimmed.indexOf("=");
          if (eqIdx === -1) continue;
          const k = trimmed.slice(0, eqIdx).trim();
          const v = trimmed
            .slice(eqIdx + 1)
            .trim()
            .replace(/^["']|["']$/g, "");
          if (k) {
            dotEnvCache[k] = v;
            if (!process.env[k]) process.env[k] = v;
          }
        }
      }
    } catch {
      // ignore fs errors in serverless environments where process.env is already populated
    }
  }
  return process.env[key] ?? dotEnvCache[key];
}

async function obterToken(): Promise<string | null> {
  const id = getServerEnv("TWITCH_CLIENT_ID");
  const secret = getServerEnv("TWITCH_CLIENT_SECRET");
  if (!id || !secret) return null;

  if (tokenCache && tokenCache.expiraEm > Date.now() + 60_000) {
    return tokenCache.valor;
  }

  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(id)}&client_secret=${encodeURIComponent(secret)}&grant_type=client_credentials`,
    { method: "POST" },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!json.access_token) return null;
  tokenCache = {
    valor: json.access_token,
    expiraEm: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return tokenCache.valor;
}

let filaPromise: Promise<void> = Promise.resolve();

export async function igdbQuery<T>(
  endpoint: string,
  body: string,
): Promise<T[] | null> {
  const token = await obterToken();
  const id = getServerEnv("TWITCH_CLIENT_ID");
  if (!token || !id) return null;

  // Rate Limiting: garante espaçamento real de 260ms entre chamadas à IGDB
  const turnoAtual = filaPromise;
  let liberarProximo!: () => void;
  filaPromise = new Promise<void>((res) => {
    liberarProximo = res;
  });
  await turnoAtual;
  setTimeout(liberarProximo, 260);

  try {
    const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
      method: "POST",
      headers: {
        "Client-ID": id,
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      body,
    });
    if (!res.ok) return null;
    return (await res.json()) as T[];
  } catch {
    return null;
  }
}

export const imagemIgdb = (imageId: string, tamanho: string) =>
  `https://images.igdb.com/igdb/image/upload/t_${tamanho}/${imageId}.jpg`;
