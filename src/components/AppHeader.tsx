import { useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Gamepad2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LogGameModal } from "@/components/LogGameModal";

export function AppHeader() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [logado, setLogado] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLogado(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setLogado(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const link = (to: string, label: string) => {
    const active = path === to;
    return (
      <Link
        to={to}
        className={[
          "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          active
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground",
        ].join(" ")}
      >
        {label}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-sidebar/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-semibold text-ember">
          <Gamepad2 className="h-5 w-5" />
          Backlog do José
        </Link>
        <nav className="flex items-center gap-1">
          {logado && (
            <button
              type="button"
              onClick={sair}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Sair
            </button>
          )}
          {link("/", "Dashboard")}
          {logado ? (
            <>
              {link("/perfil", "Perfil")}
              <LogGameModal>
                <button className="ml-2 cursor-pointer rounded-md bg-ember px-3.5 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90">
                  Log Game
                </button>
              </LogGameModal>
            </>
          ) : (
            <Link
              to="/auth"
              className="ml-2 rounded-md bg-ember px-3.5 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Entrar
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
