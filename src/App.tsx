import Layout from "./components/Layout";
import config from "./data/config.json";
import restaurant from "./data/restaurant.json";
import { useRoute, type Route } from "./router";
import AuditResult from "./screens/AuditResult";
import Home from "./screens/Home";
import Landing from "./screens/Landing";
import InvoiceCapture from "./screens/InvoiceCapture";
import MenuMargins from "./screens/MenuMargins";
import PriceAlerts from "./screens/PriceAlerts";
import WeeklyReport from "./screens/WeeklyReport";

const SCREENS: Record<Exclude<Route, "home" | "overview">, () => React.ReactElement> = {
  report: WeeklyReport,
  margins: MenuMargins,
  audit: AuditResult,
  alerts: PriceAlerts,
  invoice: InvoiceCapture,
};

const titleFor = (route: Exclude<Route, "home" | "overview">) => config.screens.find((s) => s.route === route)?.title ?? "";

export default function App() {
  const route = useRoute();

  if (route === "home") return <Landing />;

  if (route === "overview") {
    return (
      <Layout route={route} title="Overview">
        <Home />
      </Layout>
    );
  }

  const Screen = SCREENS[route];
  return (
    <Layout route={route} title={titleFor(route)}>
      <Screen />
    </Layout>
  );
}
