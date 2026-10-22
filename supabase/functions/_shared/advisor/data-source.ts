import type { SupabaseClient } from "@supabase/supabase-js";
import { DatasetRestaurantData } from "./dataset-data.ts";
import { MOCK_AS_OF, MOCK_DATASETS } from "./mock-data.ts";
import { liveBundleLoader, TableRestaurantData } from "./table-data.ts";
import type { RestaurantData } from "./types.ts";

export type DataSourceFactory = (restaurantId: string) => RestaurantData;

/**
 * The one place that decides where a restaurant's numbers come from.
 * Real data: the same tables and metric formulas as the dashboard, read as the signed-in user so row-level
 * security applies. `restaurantId` must come from the user's membership, never from the request.
 */
export const createRestaurantData = (db: SupabaseClient, userId: string): DataSourceFactory => (restaurantId) =>
  new TableRestaurantData(restaurantId, liveBundleLoader(db, userId));

/**
 * In-memory sample data keyed by restaurant id, for tests and offline evals only (it has its own formulas and is not
 * wired into the Edge Function). A restaurant with no data gets an empty dataset, so every tool answers "no data".
 */
export const createMockRestaurantData = (restaurantId: string): DatasetRestaurantData =>
  new DatasetRestaurantData(
    MOCK_DATASETS[restaurantId] ?? {
      restaurantId, name: "Unknown", asOf: MOCK_AS_OF, ingredients: [], prices: [], menu: [], sales: [], usage: [],
    },
  );
