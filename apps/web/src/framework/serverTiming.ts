import { AsyncLocalStorage } from "node:async_hooks";
import { PgPreparedQuery } from "drizzle-orm/pg-core";
import type { Env, MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import { endTime, setMetric, startTime } from "hono/timing";

type Query = { summary: string; duration: number };

const requestQueries = new AsyncLocalStorage<Query[]>();

// Every entry adds to the response headers, which proxies cap at a few kilobytes.
const reportedQueryLimit = 10;

type QueryWithCache = (this: unknown, queryString: string, ...rest: unknown[]) => Promise<unknown>;
const prototype = PgPreparedQuery.prototype as unknown as { queryWithCache: QueryWithCache };
const queryWithCache = prototype.queryWithCache;

// Drizzle has no hook for when a query finishes, but every query, including those in
// transactions, reaches the driver through this internal method. Patched on import.
prototype.queryWithCache = async function (queryString, ...rest) {
  const queries = requestQueries.getStore();
  if (!queries) return queryWithCache.call(this, queryString, ...rest);
  const start = performance.now();
  try {
    return await queryWithCache.call(this, queryString, ...rest);
  } finally {
    queries.push({ summary: summarizeQuery(queryString), duration: performance.now() - start });
  }
};

/** The statement and first table, like `select time_entries`, without exposing the SQL. */
export function summarizeQuery(queryString: string) {
  const statement = queryString.match(/^\s*(\w+)/)?.[1]?.toLowerCase() ?? "query";
  const table = queryString.match(/\b(?:from|into|update)\s+"(\w+)"/i)?.[1];
  return table ? `${statement} ${table}` : statement;
}

/**
 * Adds the request's total query time and its slowest queries to Server-Timing.
 * Queries run in parallel add up, so the time can exceed the total.
 */
export const reportDatabaseTiming = createMiddleware(async (c, next) => {
  const queries: Query[] = [];
  await requestQueries.run(queries, next);
  const duration = queries.reduce((sum, query) => sum + query.duration, 0);
  setMetric(c, "db", duration, `${queries.length} queries`);
  const slowest = queries.toSorted((a, b) => b.duration - a.duration).slice(0, reportedQueryLimit);
  for (const [index, query] of slowest.entries()) {
    setMetric(c, `db-${index + 1}`, query.duration, query.summary);
  }
});

/** Times `middleware` until it hands over to the next handler, or until the response. */
export function timeMiddleware<E extends Env>(
  name: string,
  middleware: MiddlewareHandler<E>,
): MiddlewareHandler<E> {
  return (c, next) => {
    startTime(c, name);
    return middleware(c, async () => {
      endTime(c, name);
      await next();
    });
  };
}

/** Times `c.render`, which also waits for async components. Registered after the renderer. */
export const reportRenderTiming = createMiddleware(async (c, next) => {
  const render = c.render;
  c.render = async (...args) => {
    startTime(c, "render");
    try {
      return await render(...args);
    } finally {
      endTime(c, "render");
    }
  };
  await next();
});
