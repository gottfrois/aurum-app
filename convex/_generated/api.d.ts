/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as balanceSnapshots from "../balanceSnapshots.js";
import type * as encryptionKeys from "../encryptionKeys.js";
import type * as http from "../http.js";
import type * as investments from "../investments.js";
import type * as lib_accountCategories from "../lib/accountCategories.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_serverCrypto from "../lib/serverCrypto.js";
import type * as members from "../members.js";
import type * as migrations from "../migrations.js";
import type * as powens from "../powens.js";
import type * as profiles from "../profiles.js";
import type * as seed from "../seed.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  balanceSnapshots: typeof balanceSnapshots;
  encryptionKeys: typeof encryptionKeys;
  http: typeof http;
  investments: typeof investments;
  "lib/accountCategories": typeof lib_accountCategories;
  "lib/auth": typeof lib_auth;
  "lib/serverCrypto": typeof lib_serverCrypto;
  members: typeof members;
  migrations: typeof migrations;
  powens: typeof powens;
  profiles: typeof profiles;
  seed: typeof seed;
  workspaces: typeof workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
