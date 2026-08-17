import { createServerFn } from "@tanstack/react-start";

export type SugestaoJogo = {
  id: string;
  nome: string;
  imagem: string | null;
};

export const buscarJogos = createServerFn({ method: "GET" })
  .inputValidator((input: { termo: string }) => ({
    termo: String(input?.termo ?? "").slice(0, 80),
  }))
  .handler(async ({ data }): Promise<SugestaoJogo[]> => {
    const termo = data.termo.trim();
    if (termo.length < 2) return [];

    try {
      const res = await fetch(
        `https://steamcommunity.com/actions/SearchApps/${encodeURIComponent(termo)}`,
        { headers: { Accept: "application/json" } },
      );
      if (!res.ok) return [];
      const json = (await res.json()) as Array<{
        appid?: string;
        name?: string;
        logo?: string;
        icon?: string;
      }>;
      if (!Array.isArray(json)) return [];
      return json
        .filter((j) => j?.name)
        .slice(0, 8)
        .map((j) => ({
          id: String(j.appid ?? j.name),
          nome: j.name as string,
          imagem: j.logo || j.icon || null,
        }));
    } catch {
      return [];
    }
  });
