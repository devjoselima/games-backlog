import { createServerFn } from "@tanstack/react-start";
import { buscarCapa, type CapaJogo } from "./game-covers.server";

export type { CapaJogo };

export const buscarCapas = createServerFn({ method: "GET" })
  .inputValidator((input: { nomes: string[] }) => ({
    nomes: (input?.nomes ?? []).slice(0, 100).map((n) => String(n).slice(0, 80)),
  }))
  .handler(async ({ data }): Promise<CapaJogo[]> => {
    if (!data.nomes.length) return [];
    return Promise.all(data.nomes.map(buscarCapa));
  });
