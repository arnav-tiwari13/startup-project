import Layout from "./components/Layout";
import config from "./data/config.json";
import restaurant from "./data/restaurant.json";
import { useRoute, type Route } from "./router";
import AuditResult from "./screens/AuditResult";
import Home from "./screens/Home";
import InvoiceCapture from "./screens/InvoiceCapture";
import MenuMargins from "./screens/MenuMargins";
import PriceAlerts from "./screens/PriceAlerts";
import WeeklyReport from "./screens/WeeklyReport";

const SCREENS: Record<Exclude<Route, "home">, () => React.ReactElement> = {
  report: WeeklyReport,
  margins: MenuMargins,
  audit: AuditResult,
  alerts: PriceAlerts,
  invoice: InvoiceCapture,
};

const titleFor = (route: Exclude<Route, "home">) => config.screens.find((s) => s.route === route)?.title ?? "";

export default function App() {
  const route = useRoute();

  if (route === "home") {
    return (
      <Layout route={route} title={restaurant.name}>
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
