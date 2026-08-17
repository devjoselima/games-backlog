import { createServerFn } from "@tanstack/react-start";
import { igdbQuery, imagemIgdb } from "./igdb.server";

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
      const termoEscapado = termo.replace(/"/g, '');
      const body = `search "${termoEscapado}"; fields name, cover.image_id; limit 8;`;
      
      const resultados = await igdbQuery<{ id: number; name: string; cover?: { id: number; image_id: string } }>(
        "games",
        body
      );

      if (!resultados) return [];

      return resultados.map((j) => ({
        id: String(j.id),
        nome: j.name,
        imagem: j.cover?.image_id ? imagemIgdb(j.cover.image_id, "cover_small") : null,
      }));
    } catch {
      return [];
    }
  });
