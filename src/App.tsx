import Layout from "./components/Layout";
import { href, useRoute, type Route } from "./router";
import WeeklyReport from "./screens/WeeklyReport";
import MenuMargins from "./screens/MenuMargins";
import AuditResult from "./screens/AuditResult";
import PriceAlerts from "./screens/PriceAlerts";
import Placeholder from "./screens/Placeholder";
import restaurant from "./data/restaurant.json";

const SCREENS: Record<Exclude<Route, "home">, { title: string; element: () => React.ReactElement }> = {
  report: { title: "Weekly report", element: WeeklyReport },
  margins: { title: "Menu margins", element: MenuMargins },
  audit: { title: "Free audit result", element: AuditResult },
  alerts: { title: "Price alerts", element: PriceAlerts },
  invoice: { title: "Invoice capture", element: Placeholder },
};

export default function App() {
  const route = useRoute();

  if (route === "home") {
    return (
      <Layout route={route} title={restaurant.name}>
        <p className="text-muted mb-4">{restaurant.weekLabel}</p>
        <ul className="space-y-2">
          {(Object.keys(SCREENS) as (keyof typeof SCREENS)[]).map((key) => (
            <li key={key}>
              <a href={href(key)} className="block rounded-lg border border-line bg-surface px-4 py-3 font-medium">
                {SCREENS[key].title}
              </a>
            </li>
          ))}
        </ul>
      </Layout>
    );
  }

  const { title, element: Screen } = SCREENS[route];
  return (
    <Layout route={route} title={title}>
      <Screen />
    </Layout>
  );
}
