import { useEffect, useState } from "react";
import Layout from "./components/Layout";
import SignInGate from "./components/SignInGate";
import AuthModal from "./components/AuthModal";
import { usePasswordRecovery, useSession } from "./auth";
import config from "./data/config.json";
import restaurant from "./data/restaurant.json";
import { ProfileContext, useProfileLoader } from "./profileStore";
import Onboarding from "./screens/Onboarding";
import { href, useRoute, type Route } from "./router";
import Advisor from "./screens/Advisor";
import AuditResult from "./screens/AuditResult";
import Home from "./screens/Home";
import Landing from "./screens/Landing";
import InvoiceCapture from "./screens/InvoiceCapture";
import MenuMargins from "./screens/MenuMargins";
import PriceAlerts from "./screens/PriceAlerts";
import Settings from "./screens/Settings";
import WeeklyReport from "./screens/WeeklyReport";

const SCREENS: Record<Exclude<Route, "home" | "overview">, () => React.ReactElement> = {
  advisor: Advisor,
  report: WeeklyReport,
  margins: MenuMargins,
  audit: AuditResult,
  alerts: PriceAlerts,
  invoice: InvoiceCapture,
  settings: Settings,
};

const titleFor = (route: Exclude<Route, "home" | "overview">) => route === "settings" ? "Settings" : (config.screens.find((s) => s.route === route)?.title ?? "");

function AppRoutes() {
  const route = useRoute();
  const { session, loading } = useSession();

  const signedIn = Boolean(session);
  const { state: profileState, reload } = useProfileLoader(session?.user.id);
  const [skippedProfile, setSkippedProfile] = useState(false);

  // Signed-in users stay in the dashboard; the website is only for signed-out visitors.
  useEffect(() => {
    if (signedIn && route === "home") window.location.replace(href("overview"));
  }, [signedIn, route]);

  if (loading) return null;
  if (route === "home") return signedIn ? null : <Landing />;
  if (!session) return <SignInGate />;
  if (profileState.status === "loading") return null;
  if (profileState.status === "none") return <Onboarding onSaved={reload} />;
  if (profileState.status === "error" && !skippedProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div role="alert" className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8 text-center shadow-card">
          <h1 className="text-xl font-bold">Couldn't load your profile</h1>
          <p className="mt-2 text-sm text-muted">{profileState.message}</p>
          <button type="button" onClick={reload} className="mt-6 w-full rounded-lg bg-accent px-5 py-3 font-semibold text-bg hover:opacity-90">
            Try again
          </button>
          <button type="button" onClick={() => setSkippedProfile(true)} className="mt-3 text-sm font-medium text-accent">
            Continue to the dashboard
          </button>
        </div>
      </div>
    );
  }
  const profile = profileState.status === "ready" ? profileState.profile : null;

  if (route === "overview") {
    return (
      <ProfileContext.Provider value={{ profile, reload }}>
        <Layout route={route} title="Overview">
          <Home />
        </Layout>
      </ProfileContext.Provider>
    );
  }

  const Screen = SCREENS[route];
  return (
    <ProfileContext.Provider value={{ profile, reload }}>
      <Layout route={route} title={titleFor(route)} fullBleed={route === "advisor"}>
        <Screen />
      </Layout>
    </ProfileContext.Provider>
  );
}

export default function App() {
  const [recovering, doneRecovering] = usePasswordRecovery();
  return (
    <>
      <AppRoutes />
      {recovering && <AuthModal initialMode="newpassword" onClose={doneRecovering} />}
    </>
  );
}
