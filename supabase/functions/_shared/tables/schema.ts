// Validation for everything that crosses the network: table requests now, saved layouts in the next step.
import { z } from "zod";
import { COMPARISONS, PERIOD_PRESETS, isIsoDate } from "../metrics/index.ts";
import { CATEGORIES, TABLE_IDS } from "./types.ts";

const isoDate = z.string().refine(isIsoDate, "must be a real YYYY-MM-DD date");

export const periodSchema = z
  .object({
    preset: z.enum(PERIOD_PRESETS),
    start: isoDate.optional(),
    end: isoDate.optional(),
  })
  .strict();

export const filtersSchema = z
  .object({
    vendor: z.string().min(1).max(80).optional(),
    category: z.enum(CATEGORIES).optional(),
    location: z.string().uuid().optional(),
    search: z.string().max(60).optional(),
    flag: z.enum(["plowhorse", "puzzle"]).optional(),
    only_increases: z.boolean().optional(),
  })
  .strict();

export const sortSchema = z.object({ column: z.string().min(1).max(40), dir: z.enum(["asc", "desc"]) }).strict();

export const tableRequestSchema = z
  .object({
    tableId: z.enum(TABLE_IDS),
    /** Subset of the caller's locations. Omitted means all of them. Ids the caller does not belong to are rejected. */
    restaurantIds: z.array(z.string().uuid()).min(1).max(5).optional(),
    period: periodSchema.default({ preset: "last_week" }),
    comparison: z.enum(COMPARISONS).default("previous_period"),
    sort: sortSchema.optional(),
    filters: filtersSchema.default({}),
    groupBy: z.string().min(1).max(20).nullable().optional(),
    limit: z.number().int().min(1).max(500).default(100),
    offset: z.number().int().min(0).max(100_000).default(0),
  })
  .strict();

export type TableRequest = z.infer<typeof tableRequestSchema>;
export type Filters = z.infer<typeof filtersSchema>;
