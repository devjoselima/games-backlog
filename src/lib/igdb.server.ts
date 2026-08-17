// Cliente mínimo da IGDB (autenticação via Twitch Client Credentials).

type Token = { valor: string; expiraEm: number };
let tokenCache: Token | null = null;

async function obterToken(): Promise<string | null> {
  const id = process.env["TWITCH_CLIENT_ID"];
  const secret = process.env["TWITCH_CLIENT_SECRET"];
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

export async function igdbQuery<T>(
  endpoint: string,
  body: string,
): Promise<T[] | null> {
  const token = await obterToken();
  const id = process.env["TWITCH_CLIENT_ID"];
  if (!token || !id) return null;
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
}

export const imagemIgdb = (imageId: string, tamanho: string) =>
  `https://images.igdb.com/igdb/image/upload/t_${tamanho}/${imageId}.jpg`;
