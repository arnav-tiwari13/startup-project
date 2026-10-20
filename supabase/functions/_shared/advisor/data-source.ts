import { DatasetRestaurantData } from "./dataset-data.ts";
import { MOCK_AS_OF, MOCK_DATASETS } from "./mock-data.ts";
import type { RestaurantData } from "./types.ts";

export type DataSourceFactory = (restaurantId: string) => RestaurantData;

/**
 * The one place that decides where a restaurant's numbers come from.
 * Today: sample data keyed by restaurant id. Later: load the real invoices, recipes, sales and counts
 * for `restaurantId` into a RestaurantDataset (or implement RestaurantData directly).
 * A restaurant with no data gets an empty dataset, so every tool answers "no data" rather than guessing.
 */
export const createRestaurantData: DataSourceFactory = (restaurantId) =>
  new DatasetRestaurantData(
    MOCK_DATASETS[restaurantId] ?? {
      restaurantId, name: "Unknown", asOf: MOCK_AS_OF, ingredients: [], prices: [], menu: [], sales: [], usage: [],
    },
  );
