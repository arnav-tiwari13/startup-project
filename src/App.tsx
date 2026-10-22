import Layout from "./components/Layout";
import SignInGate from "./components/SignInGate";
import AuthModal from "./components/AuthModal";
import { usePasswordRecovery, useSession } from "./auth";
import config from "./data/config.json";
import restaurant from "./data/restaurant.json";
import { useRoute, type Route } from "./router";
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

  if (route === "home") return <Landing />;
  if (loading) return null;
  if (!session) return <SignInGate />;

  if (route === "overview") {
    return (
      <Layout route={route} title="Overview">
        <Home />
      </Layout>
    );
  }

  const Screen = SCREENS[route];
  return (
    <Layout route={route} title={titleFor(route)} fullBleed={route === "advisor"}>
      <Screen />
    </Layout>
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
