import { useLocation, useNavigate } from "react-router-dom";
import { useSession } from "../hooks/useSession";

export default function QuickGodAccess() {
  const { user, loading } = useSession();
  const location = useLocation();
  const navigate = useNavigate();

  const shouldShow =
    !loading && user?.role === "god" && location.pathname !== "/god";

  if (!shouldShow) return null;

  return (
    <button
      onClick={() => navigate("/god")}
      className="fixed bottom-24 right-4 z-[45] flex items-center gap-2 rounded-full border border-amber-400/50 bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-50 shadow-lg shadow-amber-900/40 backdrop-blur transition hover:border-amber-300 hover:bg-amber-500/30 active:scale-[0.98]"
    >
      <span className="inline-flex h-2 w-2 rounded-full bg-amber-300" />
      Panel GOD
    </button>
  );
}
