import { useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Gamepad2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-semibold">
          <Gamepad2 className="h-5 w-5 text-primary" />
          Backlog do José
        </Link>
        <nav className="flex items-center gap-1">
          {link("/", "Dashboard")}
          {logado ? (
            <>
              <Link
                to="/cadastro"
                className="ml-2 rounded-md bg-primary px-3.5 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Log Game
              </Link>
              <button
                type="button"
                onClick={sair}
                className="ml-1 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Sair
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              className="ml-2 rounded-md bg-primary px-3.5 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Entrar
            </Link>
          )}
        </nav>

      </div>
    </header>
  );
}
