import "server-only";

// The renderer owns the cache. Route handlers can reuse a verified session explicitly.
export { cache as cacheForServerRender } from "react";
