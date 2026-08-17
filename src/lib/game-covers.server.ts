import { igdbQuery, imagemIgdb } from "./igdb.server";

export type CapaJogo = {
  nome: string;
  imagem: string | null;
  retrato: string | null;
};

const normalizar = (s: string) =>
  s
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/[^a-z0-9]/g, "");

async function buscarNaSteam(
  termo: string,
): Promise<{ appid: string; logo: string | null } | null> {
  const res = await fetch(
    `https://steamcommunity.com/actions/SearchApps/${encodeURIComponent(termo)}`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as Array<{
    appid?: string;
    name?: string;
    logo?: string;
  }>;
  if (!Array.isArray(json) || !json.length) return null;

  // Prefere o resultado cujo título é exatamente igual ao nome buscado
  // (evita, por ex., "God of War" cair em "God of War Ragnarök").
  const alvo = normalizar(termo);
  const exato = json.find((j) => j.name && normalizar(j.name) === alvo);
  const escolhido = exato ?? json[0];
  if (!escolhido?.appid) return null;
  return { appid: String(escolhido.appid), logo: escolhido.logo ?? null };
}

async function existe(url: string) {
  try {
    const r = await fetch(url, { method: "HEAD" });
    return r.ok;
  } catch {
    return false;
  }
}

type JogoIgdb = {
  name?: string;
  cover?: { image_id?: string };
  artworks?: Array<{ image_id?: string }>;
  screenshots?: Array<{ image_id?: string }>;
};

async function buscarNaIgdb(termo: string): Promise<CapaJogo | null> {
  const seguro = termo.replace(/"/g, "");
  const lista = await igdbQuery<JogoIgdb>(
    "games",
    `search "${seguro}"; fields name, cover.image_id, artworks.image_id, screenshots.image_id; limit 10;`,
  );
  if (!lista?.length) return null;
  const alvo = normalizar(termo);
  const exato = lista.find((j) => j.name && normalizar(j.name) === alvo);
  const escolhido = exato ?? lista.find((j) => j.cover?.image_id) ?? lista[0];
  if (!escolhido) return null;

  const capaId = escolhido.cover?.image_id ?? null;
  const largaId =
    escolhido.artworks?.[0]?.image_id ??
    escolhido.screenshots?.[0]?.image_id ??
    null;

  const retrato = capaId ? imagemIgdb(capaId, "cover_big") : null;
  const imagem = largaId ? imagemIgdb(largaId, "720p") : retrato;
  if (!retrato && !imagem) return null;
  return { nome: termo, imagem, retrato: retrato ?? imagem };
}

const serverCoverCache = new Map<string, CapaJogo>();

export async function buscarCapa(nome: string): Promise<CapaJogo> {
  if (serverCoverCache.has(nome)) {
    return serverCoverCache.get(nome)!;
  }

  const tentativas = [
    ...new Set(
      [nome, nome.replace(/\s*\(.*?\)\s*/g, " ").trim()].filter(Boolean),
    ),
  ] as string[];

  try {
    for (const termo of tentativas) {
      const igdb = await buscarNaIgdb(termo);
      if (igdb) {
        const result = { ...igdb, nome };
        serverCoverCache.set(nome, result);
        return result;
      }
    }

    for (const termo of tentativas) {
      const achado = await buscarNaSteam(termo);
      if (!achado) continue;
      const base = `https://cdn.cloudflare.steamstatic.com/steam/apps/${achado.appid}`;
      const header = `${base}/header.jpg`;
      const vertical = `${base}/library_600x900.jpg`;
      const [temHeader, temVertical] = await Promise.all([
        existe(header),
        existe(vertical),
      ]);
      const imagem = temHeader ? header : achado.logo;
      const retrato = temVertical ? vertical : imagem;
      if (imagem || retrato) {
        const result = { nome, imagem: imagem ?? null, retrato: retrato ?? null };
        serverCoverCache.set(nome, result);
        return result;
      }
    }
  } catch {
    /* ignora e devolve sem capa */
  }
  
  const result = { nome, imagem: null, retrato: null };
  serverCoverCache.set(nome, result);
  return result;
}
