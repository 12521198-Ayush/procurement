/**
 * Query string as plain strings, for server page wrappers that hand it to a
 * client view. Reading searchParams in the server page is what makes the route
 * render per request, so deep links like /rfq?stage=bid_pending work.
 */
export type QueryParams = Record<string, string | undefined>;

export function queryParams(sp: Record<string, string | string[] | undefined> | undefined): QueryParams {
    const out: QueryParams = {};
    Object.entries(sp || {}).forEach(([k, v]) => {
        out[k] = Array.isArray(v) ? v[0] : v;
    });
    return out;
}
