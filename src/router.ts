import { useEffect, useState } from "react";

export type Route = "home" | "overview" | "report" | "margins" | "audit" | "alerts" | "invoice";

const ROUTES: Route[] = ["home", "overview", "report", "margins", "audit", "alerts", "invoice"];

const read = (): Route => {
  const hash = window.location.hash.replace(/^#\/?/, "");
  return (ROUTES as string[]).includes(hash) ? (hash as Route) : "home";
};

export const href = (route: Route) => (route === "home" ? "#/" : `#/${route}`);

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(read);
  useEffect(() => {
    const onChange = () => {
      setRoute(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
