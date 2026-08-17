import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Sessão do usuário atual: undefined enquanto carrega, null quando deslogado. */
export function useSessaoUsuario() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return userId;
}
