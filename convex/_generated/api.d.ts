/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agent from "../agent.js";
import type * as agentChat from "../agentChat.js";
import type * as agentChatQueries from "../agentChatQueries.js";
import type * as aiFilters from "../aiFilters.js";
import type * as auditLog from "../auditLog.js";
import type * as balanceSnapshots from "../balanceSnapshots.js";
import type * as batchOperations from "../batchOperations.js";
import type * as billing from "../billing.js";
import type * as categories from "../categories.js";
import type * as crons from "../crons.js";
import type * as email from "../email.js";
import type * as encryptionKeys from "../encryptionKeys.js";
import type * as filterViewFavorites from "../filterViewFavorites.js";
import type * as filterViews from "../filterViews.js";
import type * as http from "../http.js";
import type * as investments from "../investments.js";
import type * as lib_accountCategories from "../lib/accountCategories.js";
import type * as lib_aiModels from "../lib/aiModels.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_billing from "../lib/billing.js";
import type * as lib_serverCrypto from "../lib/serverCrypto.js";
import type * as members from "../members.js";
import type * as migrations from "../migrations.js";
import type * as onboarding from "../onboarding.js";
import type * as portfolios from "../portfolios.js";
import type * as powens from "../powens.js";
import type * as seed from "../seed.js";
import type * as stripe from "../stripe.js";
import type * as team from "../team.js";
import type * as transactionLabels from "../transactionLabels.js";
import type * as transactionRules from "../transactionRules.js";
import type * as transactions from "../transactions.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agent: typeof agent;
  agentChat: typeof agentChat;
  agentChatQueries: typeof agentChatQueries;
  aiFilters: typeof aiFilters;
  auditLog: typeof auditLog;
  balanceSnapshots: typeof balanceSnapshots;
  batchOperations: typeof batchOperations;
  billing: typeof billing;
  categories: typeof categories;
  crons: typeof crons;
  email: typeof email;
  encryptionKeys: typeof encryptionKeys;
  filterViewFavorites: typeof filterViewFavorites;
  filterViews: typeof filterViews;
  http: typeof http;
  investments: typeof investments;
  "lib/accountCategories": typeof lib_accountCategories;
  "lib/aiModels": typeof lib_aiModels;
  "lib/auth": typeof lib_auth;
  "lib/billing": typeof lib_billing;
  "lib/serverCrypto": typeof lib_serverCrypto;
  members: typeof members;
  migrations: typeof migrations;
  onboarding: typeof onboarding;
  portfolios: typeof portfolios;
  powens: typeof powens;
  seed: typeof seed;
  stripe: typeof stripe;
  team: typeof team;
  transactionLabels: typeof transactionLabels;
  transactionRules: typeof transactionRules;
  transactions: typeof transactions;
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

export declare const components: {
  agent: {
    apiKeys: {
      destroy: FunctionReference<
        "mutation",
        "internal",
        { apiKey?: string; name?: string },
        | "missing"
        | "deleted"
        | "name mismatch"
        | "must provide either apiKey or name"
      >;
      issue: FunctionReference<
        "mutation",
        "internal",
        { name?: string },
        string
      >;
      validate: FunctionReference<
        "query",
        "internal",
        { apiKey: string },
        boolean
      >;
    };
    files: {
      addFile: FunctionReference<
        "mutation",
        "internal",
        {
          filename?: string;
          hash: string;
          mediaType?: string;
          mimeType?: string;
          storageId: string;
        },
        { fileId: string; storageId: string }
      >;
      copyFile: FunctionReference<
        "mutation",
        "internal",
        { fileId: string },
        null
      >;
      deleteFiles: FunctionReference<
        "mutation",
        "internal",
        { fileIds: Array<string>; force?: boolean },
        Array<string>
      >;
      get: FunctionReference<
        "query",
        "internal",
        { fileId: string },
        null | {
          _creationTime: number;
          _id: string;
          filename?: string;
          hash: string;
          lastTouchedAt: number;
          mediaType?: string;
          mimeType?: string;
          refcount: number;
          storageId: string;
        }
      >;
      getFilesToDelete: FunctionReference<
        "query",
        "internal",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            _creationTime: number;
            _id: string;
            filename?: string;
            hash: string;
            lastTouchedAt: number;
            mediaType?: string;
            mimeType?: string;
            refcount: number;
            storageId: string;
          }>;
        }
      >;
      useExistingFile: FunctionReference<
        "mutation",
        "internal",
        { filename?: string; hash: string },
        null | { fileId: string; storageId: string }
      >;
    };
    messages: {
      addMessages: FunctionReference<
        "mutation",
        "internal",
        {
          agentName?: string;
          embeddings?: {
            dimension:
              | 128
              | 256
              | 512
              | 768
              | 1024
              | 1408
              | 1536
              | 2048
              | 3072
              | 4096;
            model: string;
            vectors: Array<Array<number> | null>;
          };
          failPendingSteps?: boolean;
          finishStreamId?: string;
          hideFromUserIdSearch?: boolean;
          messages: Array<{
            error?: string;
            fileIds?: Array<string>;
            finishReason?:
              | "stop"
              | "length"
              | "content-filter"
              | "tool-calls"
              | "error"
              | "other"
              | "unknown";
            message:
              | {
                  content:
                    | string
                    | Array<
                        | {
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            text: string;
                            type: "text";
                          }
                        | {
                            image: string | ArrayBuffer;
                            mediaType?: string;
                            mimeType?: string;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "image";
                          }
                        | {
                            data: string | ArrayBuffer;
                            filename?: string;
                            mediaType?: string;
                            mimeType?: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "file";
                          }
                      >;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "user";
                }
              | {
                  content:
                    | string
                    | Array<
                        | {
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            text: string;
                            type: "text";
                          }
                        | {
                            data: string | ArrayBuffer;
                            filename?: string;
                            mediaType?: string;
                            mimeType?: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "file";
                          }
                        | {
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            signature?: string;
                            text: string;
                            type: "reasoning";
                          }
                        | {
                            data: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "redacted-reasoning";
                          }
                        | {
                            args?: any;
                            input: any;
                            providerExecuted?: boolean;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            toolCallId: string;
                            toolName: string;
                            type: "tool-call";
                          }
                        | {
                            args: any;
                            input?: any;
                            providerExecuted?: boolean;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            toolCallId: string;
                            toolName: string;
                            type: "tool-call";
                          }
                        | {
                            args?: any;
                            experimental_content?: Array<
                              | { text: string; type: "text" }
                              | {
                                  data: string;
                                  mimeType?: string;
                                  type: "image";
                                }
                            >;
                            isError?: boolean;
                            output?:
                              | {
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "text";
                                  value: string;
                                }
                              | {
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "json";
                                  value: any;
                                }
                              | {
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "error-text";
                                  value: string;
                                }
                              | {
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "error-json";
                                  value: any;
                                }
                              | {
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  reason?: string;
                                  type: "execution-denied";
                                }
                              | {
                                  type: "content";
                                  value: Array<
                                    | {
                                        providerOptions?: Record<
                                          string,
                                          Record<string, any>
                                        >;
                                        text: string;
                                        type: "text";
                                      }
                                    | {
                                        data: string;
                                        mediaType: string;
                                        type: "media";
                                      }
                                    | {
                                        data: string;
                                        filename?: string;
                                        mediaType: string;
                                        providerOptions?: Record<
                                          string,
                                          Record<string, any>
                                        >;
                                        type: "file-data";
                                      }
                                    | {
                                        providerOptions?: Record<
                                          string,
                                          Record<string, any>
                                        >;
                                        type: "file-url";
                                        url: string;
                                      }
                                    | {
                                        fileId: string | Record<string, string>;
                                        providerOptions?: Record<
                                          string,
                                          Record<string, any>
                                        >;
                                        type: "file-id";
                                      }
                                    | {
                                        data: string;
                                        mediaType: string;
                                        providerOptions?: Record<
                                          string,
                                          Record<string, any>
                                        >;
                                        type: "image-data";
                                      }
                                    | {
                                        providerOptions?: Record<
                                          string,
                                          Record<string, any>
                                        >;
                                        type: "image-url";
                                        url: string;
                                      }
                                    | {
                                        fileId: string | Record<string, string>;
                                        providerOptions?: Record<
                                          string,
                                          Record<string, any>
                                        >;
                                        type: "image-file-id";
                                      }
                                    | {
                                        providerOptions?: Record<
                                          string,
                                          Record<string, any>
                                        >;
                                        type: "custom";
                                      }
                                  >;
                                };
                            providerExecuted?: boolean;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            result?: any;
                            toolCallId: string;
                            toolName: string;
                            type: "tool-result";
                          }
                        | {
                            id: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            sourceType: "url";
                            title?: string;
                            type: "source";
                            url: string;
                          }
                        | {
                            filename?: string;
                            id: string;
                            mediaType: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            sourceType: "document";
                            title: string;
                            type: "source";
                          }
                        | {
                            approvalId: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            toolCallId: string;
                            type: "tool-approval-request";
                          }
                      >;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "assistant";
                }
              | {
                  content: Array<
                    | {
                        args?: any;
                        experimental_content?: Array<
                          | { text: string; type: "text" }
                          | { data: string; mimeType?: string; type: "image" }
                        >;
                        isError?: boolean;
                        output?:
                          | {
                              providerOptions?: Record<
                                string,
                                Record<string, any>
                              >;
                              type: "text";
                              value: string;
                            }
                          | {
                              providerOptions?: Record<
                                string,
                                Record<string, any>
                              >;
                              type: "json";
                              value: any;
                            }
                          | {
                              providerOptions?: Record<
                                string,
                                Record<string, any>
                              >;
                              type: "error-text";
                              value: string;
                            }
                          | {
                              providerOptions?: Record<
                                string,
                                Record<string, any>
                              >;
                              type: "error-json";
                              value: any;
                            }
                          | {
                              providerOptions?: Record<
                                string,
                                Record<string, any>
                              >;
                              reason?: string;
                              type: "execution-denied";
                            }
                          | {
                              type: "content";
                              value: Array<
                                | {
                                    providerOptions?: Record<
                                      string,
                                      Record<string, any>
                                    >;
                                    text: string;
                                    type: "text";
                                  }
                                | {
                                    data: string;
                                    mediaType: string;
                                    type: "media";
                                  }
                                | {
                                    data: string;
                                    filename?: string;
                                    mediaType: string;
                                    providerOptions?: Record<
                                      string,
                                      Record<string, any>
                                    >;
                                    type: "file-data";
                                  }
                                | {
                                    providerOptions?: Record<
                                      string,
                                      Record<string, any>
                                    >;
                                    type: "file-url";
                                    url: string;
                                  }
                                | {
                                    fileId: string | Record<string, string>;
                                    providerOptions?: Record<
                                      string,
                                      Record<string, any>
                                    >;
                                    type: "file-id";
                                  }
                                | {
                                    data: string;
                                    mediaType: string;
                                    providerOptions?: Record<
                                      string,
                                      Record<string, any>
                                    >;
                                    type: "image-data";
                                  }
                                | {
                                    providerOptions?: Record<
                                      string,
                                      Record<string, any>
                                    >;
                                    type: "image-url";
                                    url: string;
                                  }
                                | {
                                    fileId: string | Record<string, string>;
                                    providerOptions?: Record<
                                      string,
                                      Record<string, any>
                                    >;
                                    type: "image-file-id";
                                  }
                                | {
                                    providerOptions?: Record<
                                      string,
                                      Record<string, any>
                                    >;
                                    type: "custom";
                                  }
                              >;
                            };
                        providerExecuted?: boolean;
                        providerMetadata?: Record<string, Record<string, any>>;
                        providerOptions?: Record<string, Record<string, any>>;
                        result?: any;
                        toolCallId: string;
                        toolName: string;
                        type: "tool-result";
                      }
                    | {
                        approvalId: string;
                        approved: boolean;
                        providerExecuted?: boolean;
                        providerMetadata?: Record<string, Record<string, any>>;
                        providerOptions?: Record<string, Record<string, any>>;
                        reason?: string;
                        type: "tool-approval-response";
                      }
                  >;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "tool";
                }
              | {
                  content: string;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "system";
                };
            model?: string;
            provider?: string;
            providerMetadata?: Record<string, Record<string, any>>;
            reasoning?: string;
            reasoningDetails?: Array<
              | {
                  providerMetadata?: Record<string, Record<string, any>>;
                  providerOptions?: Record<string, Record<string, any>>;
                  signature?: string;
                  text: string;
                  type: "reasoning";
                }
              | { signature?: string; text: string; type: "text" }
              | { data: string; type: "redacted" }
            >;
            sources?: Array<
              | {
                  id: string;
                  providerMetadata?: Record<string, Record<string, any>>;
                  providerOptions?: Record<string, Record<string, any>>;
                  sourceType: "url";
                  title?: string;
                  type?: "source";
                  url: string;
                }
              | {
                  filename?: string;
                  id: string;
                  mediaType: string;
                  providerMetadata?: Record<string, Record<string, any>>;
                  providerOptions?: Record<string, Record<string, any>>;
                  sourceType: "document";
                  title: string;
                  type: "source";
                }
            >;
            status?: "pending" | "success" | "failed";
            text?: string;
            usage?: {
              cachedInputTokens?: number;
              completionTokens: number;
              promptTokens: number;
              reasoningTokens?: number;
              totalTokens: number;
            };
            warnings?: Array<
              | {
                  details?: string;
                  setting: string;
                  type: "unsupported-setting";
                }
              | { details?: string; tool: any; type: "unsupported-tool" }
              | { message: string; type: "other" }
            >;
          }>;
          pendingMessageId?: string;
          promptMessageId?: string;
          threadId: string;
          userId?: string;
        },
        {
          messages: Array<{
            _creationTime: number;
            _id: string;
            agentName?: string;
            embeddingId?: string;
            error?: string;
            fileIds?: Array<string>;
            finishReason?:
              | "stop"
              | "length"
              | "content-filter"
              | "tool-calls"
              | "error"
              | "other"
              | "unknown";
            id?: string;
            message?:
              | {
                  content:
                    | string
                    | Array<
                        | {
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            text: string;
                            type: "text";
                          }
                        | {
                            image: string | ArrayBuffer;
                            mediaType?: string;
                            mimeType?: string;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "image";
                          }
                        | {
                            data: string | ArrayBuffer;
                            filename?: string;
                            mediaType?: string;
                            mimeType?: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "file";
                          }
                      >;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "user";
                }
              | {
                  content:
                    | string
                    | Array<
                        | {
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            text: string;
                            type: "text";
                          }
                        | {
                            data: string | ArrayBuffer;
                            filename?: string;
                            mediaType?: string;
                            mimeType?: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "file";
                          }
                        | {
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            signature?: string;
                            text: string;
                            type: "reasoning";
                          }
                        | {
                            data: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "redacted-reasoning";
                          }
                        | {
                            args?: any;
                            input: any;
                            providerExecuted?: boolean;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            toolCallId: string;
                            toolName: string;
                            type: "tool-call";
                          }
                        | {
                            args: any;
                            input?: any;
                            providerExecuted?: boolean;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            toolCallId: string;
                            toolName: string;
                            type: "tool-call";
                          }
                        | {
                            args?: any;
                            experimental_content?: Array<
                              | { text: string; type: "text" }
                              | {
                                  data: string;
                                  mimeType?: string;
                                  type: "image";
                                }
                            >;
                            isError?: boolean;
                            output?:
                              | {
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "text";
                                  value: string;
                                }
                              | {
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "json";
                                  value: any;
                                }
                              | {
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "error-text";
                                  value: string;
                                }
                              | {
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "error-json";
                                  value: any;
                                }
                              | {
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  reason?: string;
                                  type: "execution-denied";
                                }
                              | {
                                  type: "content";
                                  value: Array<
                                    | {
                                        providerOptions?: Record<
                                          string,
                                          Record<string, any>
                                        >;
                                        text: string;
                                        type: "text";
                                      }
                                    | {
                                        data: string;
                                        mediaType: string;
                                        type: "media";
                                      }
                                    | {
                                        data: string;
                                        filename?: string;
                                        mediaType: string;
                                        providerOptions?: Record<
                                          string,
                                          Record<string, any>
                                        >;
                                        type: "file-data";
                                      }
                                    | {
                                        providerOptions?: Record<
                                          string,
                                          Record<string, any>
                                        >;
                                        type: "file-url";
                                        url: string;
                                      }
                                    | {
                                        fileId: string | Record<string, string>;
                                        providerOptions?: Record<
                                          string,
                                          Record<string, any>
                                        >;
                                        type: "file-id";
                                      }
                                    | {
                                        data: string;
                                        mediaType: string;
                                        providerOptions?: Record<
                                          string,
                                          Record<string, any>
                                        >;
                                        type: "image-data";
                                      }
                                    | {
                                        providerOptions?: Record<
                                          string,
                                          Record<string, any>
                                        >;
                                        type: "image-url";
                                        url: string;
                                      }
                                    | {
                                        fileId: string | Record<string, string>;
                                        providerOptions?: Record<
                                          string,
                                          Record<string, any>
                                        >;
                                        type: "image-file-id";
                                      }
                                    | {
                                        providerOptions?: Record<
                                          string,
                                          Record<string, any>
                                        >;
                                        type: "custom";
                                      }
                                  >;
                                };
                            providerExecuted?: boolean;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            result?: any;
                            toolCallId: string;
                            toolName: string;
                            type: "tool-result";
                          }
                        | {
                            id: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            sourceType: "url";
                            title?: string;
                            type: "source";
                            url: string;
                          }
                        | {
                            filename?: string;
                            id: string;
                            mediaType: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            sourceType: "document";
                            title: string;
                            type: "source";
                          }
                        | {
                            approvalId: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            toolCallId: string;
                            type: "tool-approval-request";
                          }
                      >;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "assistant";
                }
              | {
                  content: Array<
                    | {
                        args?: any;
                        experimental_content?: Array<
                          | { text: string; type: "text" }
                          | { data: string; mimeType?: string; type: "image" }
                        >;
                        isError?: boolean;
                        output?:
                          | {
                              providerOptions?: Record<
                                string,
                                Record<string, any>
                              >;
                              type: "text";
                              value: string;
                            }
                          | {
                              providerOptions?: Record<
                                string,
                                Record<string, any>
                              >;
                              type: "json";
                              value: any;
                            }
                          | {
                              providerOptions?: Record<
                                string,
                                Record<string, any>
                              >;
                              type: "error-text";
                              value: string;
                            }
                          | {
                              providerOptions?: Record<
                                string,
                                Record<string, any>
                              >;
                              type: "error-json";
                              value: any;
                            }
                          | {
                              providerOptions?: Record<
                                string,
                                Record<string, any>
                              >;
                              reason?: string;
                              type: "execution-denied";
                            }
                          | {
                              type: "content";
                              value: Array<
                                | {
                                    providerOptions?: Record<
                                      string,
                                      Record<string, any>
                                    >;
                                    text: string;
                                    type: "text";
                                  }
                                | {
                                    data: string;
                                    mediaType: string;
                                    type: "media";
                                  }
                                | {
                                    data: string;
                                    filename?: string;
                                    mediaType: string;
                                    providerOptions?: Record<
                                      string,
                                      Record<string, any>
                                    >;
                                    type: "file-data";
                                  }
                                | {
                                    providerOptions?: Record<
                                      string,
                                      Record<string, any>
                                    >;
                                    type: "file-url";
                                    url: string;
                                  }
                                | {
                                    fileId: string | Record<string, string>;
                                    providerOptions?: Record<
                                      string,
                                      Record<string, any>
                                    >;
                                    type: "file-id";
                                  }
                                | {
                                    data: string;
                                    mediaType: string;
                                    providerOptions?: Record<
                                      string,
                                      Record<string, any>
                                    >;
                                    type: "image-data";
                                  }
                                | {
                                    providerOptions?: Record<
                                      string,
                                      Record<string, any>
                                    >;
                                    type: "image-url";
                                    url: string;
                                  }
                                | {
                                    fileId: string | Record<string, string>;
                                    providerOptions?: Record<
                                      string,
                                      Record<string, any>
                                    >;
                                    type: "image-file-id";
                                  }
                                | {
                                    providerOptions?: Record<
                                      string,
                                      Record<string, any>
                                    >;
                                    type: "custom";
                                  }
                              >;
                            };
                        providerExecuted?: boolean;
                        providerMetadata?: Record<string, Record<string, any>>;
                        providerOptions?: Record<string, Record<string, any>>;
                        result?: any;
                        toolCallId: string;
                        toolName: string;
                        type: "tool-result";
                      }
                    | {
                        approvalId: string;
                        approved: boolean;
                        providerExecuted?: boolean;
                        providerMetadata?: Record<string, Record<string, any>>;
                        providerOptions?: Record<string, Record<string, any>>;
                        reason?: string;
                        type: "tool-approval-response";
                      }
                  >;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "tool";
                }
              | {
                  content: string;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "system";
                };
            model?: string;
            order: number;
            provider?: string;
            providerMetadata?: Record<string, Record<string, any>>;
            providerOptions?: Record<string, Record<string, any>>;
            reasoning?: string;
            reasoningDetails?: Array<
              | {
                  providerMetadata?: Record<string, Record<string, any>>;
                  providerOptions?: Record<string, Record<string, any>>;
                  signature?: string;
                  text: string;
                  type: "reasoning";
                }
              | { signature?: string; text: string; type: "text" }
              | { data: string; type: "redacted" }
            >;
            sources?: Array<
              | {
                  id: string;
                  providerMetadata?: Record<string, Record<string, any>>;
                  providerOptions?: Record<string, Record<string, any>>;
                  sourceType: "url";
                  title?: string;
                  type?: "source";
                  url: string;
                }
              | {
                  filename?: string;
                  id: string;
                  mediaType: string;
                  providerMetadata?: Record<string, Record<string, any>>;
                  providerOptions?: Record<string, Record<string, any>>;
                  sourceType: "document";
                  title: string;
                  type: "source";
                }
            >;
            status: "pending" | "success" | "failed";
            stepOrder: number;
            text?: string;
            threadId: string;
            tool: boolean;
            usage?: {
              cachedInputTokens?: number;
              completionTokens: number;
              promptTokens: number;
              reasoningTokens?: number;
              totalTokens: number;
            };
            userId?: string;
            warnings?: Array<
              | {
                  details?: string;
                  setting: string;
                  type: "unsupported-setting";
                }
              | { details?: string; tool: any; type: "unsupported-tool" }
              | { message: string; type: "other" }
            >;
          }>;
        }
      >;
      cloneThread: FunctionReference<
        "action",
        "internal",
        {
          batchSize?: number;
          copyUserIdForVectorSearch?: boolean;
          excludeToolMessages?: boolean;
          insertAtOrder?: number;
          limit?: number;
          sourceThreadId: string;
          statuses?: Array<"pending" | "success" | "failed">;
          targetThreadId: string;
          upToAndIncludingMessageId?: string;
        },
        number
      >;
      deleteByIds: FunctionReference<
        "mutation",
        "internal",
        { messageIds: Array<string> },
        Array<string>
      >;
      deleteByOrder: FunctionReference<
        "mutation",
        "internal",
        {
          endOrder: number;
          endStepOrder?: number;
          startOrder: number;
          startStepOrder?: number;
          threadId: string;
        },
        { isDone: boolean; lastOrder?: number; lastStepOrder?: number }
      >;
      finalizeMessage: FunctionReference<
        "mutation",
        "internal",
        {
          messageId: string;
          result: { status: "success" } | { error: string; status: "failed" };
        },
        null
      >;
      getMessagesByIds: FunctionReference<
        "query",
        "internal",
        { messageIds: Array<string> },
        Array<null | {
          _creationTime: number;
          _id: string;
          agentName?: string;
          embeddingId?: string;
          error?: string;
          fileIds?: Array<string>;
          finishReason?:
            | "stop"
            | "length"
            | "content-filter"
            | "tool-calls"
            | "error"
            | "other"
            | "unknown";
          id?: string;
          message?:
            | {
                content:
                  | string
                  | Array<
                      | {
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          text: string;
                          type: "text";
                        }
                      | {
                          image: string | ArrayBuffer;
                          mediaType?: string;
                          mimeType?: string;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "image";
                        }
                      | {
                          data: string | ArrayBuffer;
                          filename?: string;
                          mediaType?: string;
                          mimeType?: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "file";
                        }
                    >;
                providerOptions?: Record<string, Record<string, any>>;
                role: "user";
              }
            | {
                content:
                  | string
                  | Array<
                      | {
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          text: string;
                          type: "text";
                        }
                      | {
                          data: string | ArrayBuffer;
                          filename?: string;
                          mediaType?: string;
                          mimeType?: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "file";
                        }
                      | {
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          signature?: string;
                          text: string;
                          type: "reasoning";
                        }
                      | {
                          data: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "redacted-reasoning";
                        }
                      | {
                          args?: any;
                          input: any;
                          providerExecuted?: boolean;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          toolCallId: string;
                          toolName: string;
                          type: "tool-call";
                        }
                      | {
                          args: any;
                          input?: any;
                          providerExecuted?: boolean;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          toolCallId: string;
                          toolName: string;
                          type: "tool-call";
                        }
                      | {
                          args?: any;
                          experimental_content?: Array<
                            | { text: string; type: "text" }
                            | { data: string; mimeType?: string; type: "image" }
                          >;
                          isError?: boolean;
                          output?:
                            | {
                                providerOptions?: Record<
                                  string,
                                  Record<string, any>
                                >;
                                type: "text";
                                value: string;
                              }
                            | {
                                providerOptions?: Record<
                                  string,
                                  Record<string, any>
                                >;
                                type: "json";
                                value: any;
                              }
                            | {
                                providerOptions?: Record<
                                  string,
                                  Record<string, any>
                                >;
                                type: "error-text";
                                value: string;
                              }
                            | {
                                providerOptions?: Record<
                                  string,
                                  Record<string, any>
                                >;
                                type: "error-json";
                                value: any;
                              }
                            | {
                                providerOptions?: Record<
                                  string,
                                  Record<string, any>
                                >;
                                reason?: string;
                                type: "execution-denied";
                              }
                            | {
                                type: "content";
                                value: Array<
                                  | {
                                      providerOptions?: Record<
                                        string,
                                        Record<string, any>
                                      >;
                                      text: string;
                                      type: "text";
                                    }
                                  | {
                                      data: string;
                                      mediaType: string;
                                      type: "media";
                                    }
                                  | {
                                      data: string;
                                      filename?: string;
                                      mediaType: string;
                                      providerOptions?: Record<
                                        string,
                                        Record<string, any>
                                      >;
                                      type: "file-data";
                                    }
                                  | {
                                      providerOptions?: Record<
                                        string,
                                        Record<string, any>
                                      >;
                                      type: "file-url";
                                      url: string;
                                    }
                                  | {
                                      fileId: string | Record<string, string>;
                                      providerOptions?: Record<
                                        string,
                                        Record<string, any>
                                      >;
                                      type: "file-id";
                                    }
                                  | {
                                      data: string;
                                      mediaType: string;
                                      providerOptions?: Record<
                                        string,
                                        Record<string, any>
                                      >;
                                      type: "image-data";
                                    }
                                  | {
                                      providerOptions?: Record<
                                        string,
                                        Record<string, any>
                                      >;
                                      type: "image-url";
                                      url: string;
                                    }
                                  | {
                                      fileId: string | Record<string, string>;
                                      providerOptions?: Record<
                                        string,
                                        Record<string, any>
                                      >;
                                      type: "image-file-id";
                                    }
                                  | {
                                      providerOptions?: Record<
                                        string,
                                        Record<string, any>
                                      >;
                                      type: "custom";
                                    }
                                >;
                              };
                          providerExecuted?: boolean;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          result?: any;
                          toolCallId: string;
                          toolName: string;
                          type: "tool-result";
                        }
                      | {
                          id: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          sourceType: "url";
                          title?: string;
                          type: "source";
                          url: string;
                        }
                      | {
                          filename?: string;
                          id: string;
                          mediaType: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          sourceType: "document";
                          title: string;
                          type: "source";
                        }
                      | {
                          approvalId: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          toolCallId: string;
                          type: "tool-approval-request";
                        }
                    >;
                providerOptions?: Record<string, Record<string, any>>;
                role: "assistant";
              }
            | {
                content: Array<
                  | {
                      args?: any;
                      experimental_content?: Array<
                        | { text: string; type: "text" }
                        | { data: string; mimeType?: string; type: "image" }
                      >;
                      isError?: boolean;
                      output?:
                        | {
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "text";
                            value: string;
                          }
                        | {
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "json";
                            value: any;
                          }
                        | {
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "error-text";
                            value: string;
                          }
                        | {
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "error-json";
                            value: any;
                          }
                        | {
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            reason?: string;
                            type: "execution-denied";
                          }
                        | {
                            type: "content";
                            value: Array<
                              | {
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  text: string;
                                  type: "text";
                                }
                              | {
                                  data: string;
                                  mediaType: string;
                                  type: "media";
                                }
                              | {
                                  data: string;
                                  filename?: string;
                                  mediaType: string;
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "file-data";
                                }
                              | {
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "file-url";
                                  url: string;
                                }
                              | {
                                  fileId: string | Record<string, string>;
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "file-id";
                                }
                              | {
                                  data: string;
                                  mediaType: string;
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "image-data";
                                }
                              | {
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "image-url";
                                  url: string;
                                }
                              | {
                                  fileId: string | Record<string, string>;
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "image-file-id";
                                }
                              | {
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "custom";
                                }
                            >;
                          };
                      providerExecuted?: boolean;
                      providerMetadata?: Record<string, Record<string, any>>;
                      providerOptions?: Record<string, Record<string, any>>;
                      result?: any;
                      toolCallId: string;
                      toolName: string;
                      type: "tool-result";
                    }
                  | {
                      approvalId: string;
                      approved: boolean;
                      providerExecuted?: boolean;
                      providerMetadata?: Record<string, Record<string, any>>;
                      providerOptions?: Record<string, Record<string, any>>;
                      reason?: string;
                      type: "tool-approval-response";
                    }
                >;
                providerOptions?: Record<string, Record<string, any>>;
                role: "tool";
              }
            | {
                content: string;
                providerOptions?: Record<string, Record<string, any>>;
                role: "system";
              };
          model?: string;
          order: number;
          provider?: string;
          providerMetadata?: Record<string, Record<string, any>>;
          providerOptions?: Record<string, Record<string, any>>;
          reasoning?: string;
          reasoningDetails?: Array<
            | {
                providerMetadata?: Record<string, Record<string, any>>;
                providerOptions?: Record<string, Record<string, any>>;
                signature?: string;
                text: string;
                type: "reasoning";
              }
            | { signature?: string; text: string; type: "text" }
            | { data: string; type: "redacted" }
          >;
          sources?: Array<
            | {
                id: string;
                providerMetadata?: Record<string, Record<string, any>>;
                providerOptions?: Record<string, Record<string, any>>;
                sourceType: "url";
                title?: string;
                type?: "source";
                url: string;
              }
            | {
                filename?: string;
                id: string;
                mediaType: string;
                providerMetadata?: Record<string, Record<string, any>>;
                providerOptions?: Record<string, Record<string, any>>;
                sourceType: "document";
                title: string;
                type: "source";
              }
          >;
          status: "pending" | "success" | "failed";
          stepOrder: number;
          text?: string;
          threadId: string;
          tool: boolean;
          usage?: {
            cachedInputTokens?: number;
            completionTokens: number;
            promptTokens: number;
            reasoningTokens?: number;
            totalTokens: number;
          };
          userId?: string;
          warnings?: Array<
            | { details?: string; setting: string; type: "unsupported-setting" }
            | { details?: string; tool: any; type: "unsupported-tool" }
            | { message: string; type: "other" }
          >;
        }>
      >;
      getMessageSearchFields: FunctionReference<
        "query",
        "internal",
        { messageId: string },
        { embedding?: Array<number>; embeddingModel?: string; text?: string }
      >;
      listMessagesByThreadId: FunctionReference<
        "query",
        "internal",
        {
          excludeToolMessages?: boolean;
          order: "asc" | "desc";
          paginationOpts?: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          statuses?: Array<"pending" | "success" | "failed">;
          threadId: string;
          upToAndIncludingMessageId?: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            _creationTime: number;
            _id: string;
            agentName?: string;
            embeddingId?: string;
            error?: string;
            fileIds?: Array<string>;
            finishReason?:
              | "stop"
              | "length"
              | "content-filter"
              | "tool-calls"
              | "error"
              | "other"
              | "unknown";
            id?: string;
            message?:
              | {
                  content:
                    | string
                    | Array<
                        | {
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            text: string;
                            type: "text";
                          }
                        | {
                            image: string | ArrayBuffer;
                            mediaType?: string;
                            mimeType?: string;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "image";
                          }
                        | {
                            data: string | ArrayBuffer;
                            filename?: string;
                            mediaType?: string;
                            mimeType?: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "file";
                          }
                      >;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "user";
                }
              | {
                  content:
                    | string
                    | Array<
                        | {
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            text: string;
                            type: "text";
                          }
                        | {
                            data: string | ArrayBuffer;
                            filename?: string;
                            mediaType?: string;
                            mimeType?: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "file";
                          }
                        | {
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            signature?: string;
                            text: string;
                            type: "reasoning";
                          }
                        | {
                            data: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "redacted-reasoning";
                          }
                        | {
                            args?: any;
                            input: any;
                            providerExecuted?: boolean;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            toolCallId: string;
                            toolName: string;
                            type: "tool-call";
                          }
                        | {
                            args: any;
                            input?: any;
                            providerExecuted?: boolean;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            toolCallId: string;
                            toolName: string;
                            type: "tool-call";
                          }
                        | {
                            args?: any;
                            experimental_content?: Array<
                              | { text: string; type: "text" }
                              | {
                                  data: string;
                                  mimeType?: string;
                                  type: "image";
                                }
                            >;
                            isError?: boolean;
                            output?:
                              | {
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "text";
                                  value: string;
                                }
                              | {
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "json";
                                  value: any;
                                }
                              | {
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "error-text";
                                  value: string;
                                }
                              | {
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "error-json";
                                  value: any;
                                }
                              | {
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  reason?: string;
                                  type: "execution-denied";
                                }
                              | {
                                  type: "content";
                                  value: Array<
                                    | {
                                        providerOptions?: Record<
                                          string,
                                          Record<string, any>
                                        >;
                                        text: string;
                                        type: "text";
                                      }
                                    | {
                                        data: string;
                                        mediaType: string;
                                        type: "media";
                                      }
                                    | {
                                        data: string;
                                        filename?: string;
                                        mediaType: string;
                                        providerOptions?: Record<
                                          string,
                                          Record<string, any>
                                        >;
                                        type: "file-data";
                                      }
                                    | {
                                        providerOptions?: Record<
                                          string,
                                          Record<string, any>
                                        >;
                                        type: "file-url";
                                        url: string;
                                      }
                                    | {
                                        fileId: string | Record<string, string>;
                                        providerOptions?: Record<
                                          string,
                                          Record<string, any>
                                        >;
                                        type: "file-id";
                                      }
                                    | {
                                        data: string;
                                        mediaType: string;
                                        providerOptions?: Record<
                                          string,
                                          Record<string, any>
                                        >;
                                        type: "image-data";
                                      }
                                    | {
                                        providerOptions?: Record<
                                          string,
                                          Record<string, any>
                                        >;
                                        type: "image-url";
                                        url: string;
                                      }
                                    | {
                                        fileId: string | Record<string, string>;
                                        providerOptions?: Record<
                                          string,
                                          Record<string, any>
                                        >;
                                        type: "image-file-id";
                                      }
                                    | {
                                        providerOptions?: Record<
                                          string,
                                          Record<string, any>
                                        >;
                                        type: "custom";
                                      }
                                  >;
                                };
                            providerExecuted?: boolean;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            result?: any;
                            toolCallId: string;
                            toolName: string;
                            type: "tool-result";
                          }
                        | {
                            id: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            sourceType: "url";
                            title?: string;
                            type: "source";
                            url: string;
                          }
                        | {
                            filename?: string;
                            id: string;
                            mediaType: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            sourceType: "document";
                            title: string;
                            type: "source";
                          }
                        | {
                            approvalId: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            toolCallId: string;
                            type: "tool-approval-request";
                          }
                      >;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "assistant";
                }
              | {
                  content: Array<
                    | {
                        args?: any;
                        experimental_content?: Array<
                          | { text: string; type: "text" }
                          | { data: string; mimeType?: string; type: "image" }
                        >;
                        isError?: boolean;
                        output?:
                          | {
                              providerOptions?: Record<
                                string,
                                Record<string, any>
                              >;
                              type: "text";
                              value: string;
                            }
                          | {
                              providerOptions?: Record<
                                string,
                                Record<string, any>
                              >;
                              type: "json";
                              value: any;
                            }
                          | {
                              providerOptions?: Record<
                                string,
                                Record<string, any>
                              >;
                              type: "error-text";
                              value: string;
                            }
                          | {
                              providerOptions?: Record<
                                string,
                                Record<string, any>
                              >;
                              type: "error-json";
                              value: any;
                            }
                          | {
                              providerOptions?: Record<
                                string,
                                Record<string, any>
                              >;
                              reason?: string;
                              type: "execution-denied";
                            }
                          | {
                              type: "content";
                              value: Array<
                                | {
                                    providerOptions?: Record<
                                      string,
                                      Record<string, any>
                                    >;
                                    text: string;
                                    type: "text";
                                  }
                                | {
                                    data: string;
                                    mediaType: string;
                                    type: "media";
                                  }
                                | {
                                    data: string;
                                    filename?: string;
                                    mediaType: string;
                                    providerOptions?: Record<
                                      string,
                                      Record<string, any>
                                    >;
                                    type: "file-data";
                                  }
                                | {
                                    providerOptions?: Record<
                                      string,
                                      Record<string, any>
                                    >;
                                    type: "file-url";
                                    url: string;
                                  }
                                | {
                                    fileId: string | Record<string, string>;
                                    providerOptions?: Record<
                                      string,
                                      Record<string, any>
                                    >;
                                    type: "file-id";
                                  }
                                | {
                                    data: string;
                                    mediaType: string;
                                    providerOptions?: Record<
                                      string,
                                      Record<string, any>
                                    >;
                                    type: "image-data";
                                  }
                                | {
                                    providerOptions?: Record<
                                      string,
                                      Record<string, any>
                                    >;
                                    type: "image-url";
                                    url: string;
                                  }
                                | {
                                    fileId: string | Record<string, string>;
                                    providerOptions?: Record<
                                      string,
                                      Record<string, any>
                                    >;
                                    type: "image-file-id";
                                  }
                                | {
                                    providerOptions?: Record<
                                      string,
                                      Record<string, any>
                                    >;
                                    type: "custom";
                                  }
                              >;
                            };
                        providerExecuted?: boolean;
                        providerMetadata?: Record<string, Record<string, any>>;
                        providerOptions?: Record<string, Record<string, any>>;
                        result?: any;
                        toolCallId: string;
                        toolName: string;
                        type: "tool-result";
                      }
                    | {
                        approvalId: string;
                        approved: boolean;
                        providerExecuted?: boolean;
                        providerMetadata?: Record<string, Record<string, any>>;
                        providerOptions?: Record<string, Record<string, any>>;
                        reason?: string;
                        type: "tool-approval-response";
                      }
                  >;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "tool";
                }
              | {
                  content: string;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "system";
                };
            model?: string;
            order: number;
            provider?: string;
            providerMetadata?: Record<string, Record<string, any>>;
            providerOptions?: Record<string, Record<string, any>>;
            reasoning?: string;
            reasoningDetails?: Array<
              | {
                  providerMetadata?: Record<string, Record<string, any>>;
                  providerOptions?: Record<string, Record<string, any>>;
                  signature?: string;
                  text: string;
                  type: "reasoning";
                }
              | { signature?: string; text: string; type: "text" }
              | { data: string; type: "redacted" }
            >;
            sources?: Array<
              | {
                  id: string;
                  providerMetadata?: Record<string, Record<string, any>>;
                  providerOptions?: Record<string, Record<string, any>>;
                  sourceType: "url";
                  title?: string;
                  type?: "source";
                  url: string;
                }
              | {
                  filename?: string;
                  id: string;
                  mediaType: string;
                  providerMetadata?: Record<string, Record<string, any>>;
                  providerOptions?: Record<string, Record<string, any>>;
                  sourceType: "document";
                  title: string;
                  type: "source";
                }
            >;
            status: "pending" | "success" | "failed";
            stepOrder: number;
            text?: string;
            threadId: string;
            tool: boolean;
            usage?: {
              cachedInputTokens?: number;
              completionTokens: number;
              promptTokens: number;
              reasoningTokens?: number;
              totalTokens: number;
            };
            userId?: string;
            warnings?: Array<
              | {
                  details?: string;
                  setting: string;
                  type: "unsupported-setting";
                }
              | { details?: string; tool: any; type: "unsupported-tool" }
              | { message: string; type: "other" }
            >;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      searchMessages: FunctionReference<
        "action",
        "internal",
        {
          embedding?: Array<number>;
          embeddingModel?: string;
          limit: number;
          messageRange?: { after: number; before: number };
          searchAllMessagesForUserId?: string;
          targetMessageId?: string;
          text?: string;
          textSearch?: boolean;
          threadId?: string;
          vectorScoreThreshold?: number;
          vectorSearch?: boolean;
        },
        Array<{
          _creationTime: number;
          _id: string;
          agentName?: string;
          embeddingId?: string;
          error?: string;
          fileIds?: Array<string>;
          finishReason?:
            | "stop"
            | "length"
            | "content-filter"
            | "tool-calls"
            | "error"
            | "other"
            | "unknown";
          id?: string;
          message?:
            | {
                content:
                  | string
                  | Array<
                      | {
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          text: string;
                          type: "text";
                        }
                      | {
                          image: string | ArrayBuffer;
                          mediaType?: string;
                          mimeType?: string;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "image";
                        }
                      | {
                          data: string | ArrayBuffer;
                          filename?: string;
                          mediaType?: string;
                          mimeType?: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "file";
                        }
                    >;
                providerOptions?: Record<string, Record<string, any>>;
                role: "user";
              }
            | {
                content:
                  | string
                  | Array<
                      | {
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          text: string;
                          type: "text";
                        }
                      | {
                          data: string | ArrayBuffer;
                          filename?: string;
                          mediaType?: string;
                          mimeType?: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "file";
                        }
                      | {
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          signature?: string;
                          text: string;
                          type: "reasoning";
                        }
                      | {
                          data: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "redacted-reasoning";
                        }
                      | {
                          args?: any;
                          input: any;
                          providerExecuted?: boolean;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          toolCallId: string;
                          toolName: string;
                          type: "tool-call";
                        }
                      | {
                          args: any;
                          input?: any;
                          providerExecuted?: boolean;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          toolCallId: string;
                          toolName: string;
                          type: "tool-call";
                        }
                      | {
                          args?: any;
                          experimental_content?: Array<
                            | { text: string; type: "text" }
                            | { data: string; mimeType?: string; type: "image" }
                          >;
                          isError?: boolean;
                          output?:
                            | {
                                providerOptions?: Record<
                                  string,
                                  Record<string, any>
                                >;
                                type: "text";
                                value: string;
                              }
                            | {
                                providerOptions?: Record<
                                  string,
                                  Record<string, any>
                                >;
                                type: "json";
                                value: any;
                              }
                            | {
                                providerOptions?: Record<
                                  string,
                                  Record<string, any>
                                >;
                                type: "error-text";
                                value: string;
                              }
                            | {
                                providerOptions?: Record<
                                  string,
                                  Record<string, any>
                                >;
                                type: "error-json";
                                value: any;
                              }
                            | {
                                providerOptions?: Record<
                                  string,
                                  Record<string, any>
                                >;
                                reason?: string;
                                type: "execution-denied";
                              }
                            | {
                                type: "content";
                                value: Array<
                                  | {
                                      providerOptions?: Record<
                                        string,
                                        Record<string, any>
                                      >;
                                      text: string;
                                      type: "text";
                                    }
                                  | {
                                      data: string;
                                      mediaType: string;
                                      type: "media";
                                    }
                                  | {
                                      data: string;
                                      filename?: string;
                                      mediaType: string;
                                      providerOptions?: Record<
                                        string,
                                        Record<string, any>
                                      >;
                                      type: "file-data";
                                    }
                                  | {
                                      providerOptions?: Record<
                                        string,
                                        Record<string, any>
                                      >;
                                      type: "file-url";
                                      url: string;
                                    }
                                  | {
                                      fileId: string | Record<string, string>;
                                      providerOptions?: Record<
                                        string,
                                        Record<string, any>
                                      >;
                                      type: "file-id";
                                    }
                                  | {
                                      data: string;
                                      mediaType: string;
                                      providerOptions?: Record<
                                        string,
                                        Record<string, any>
                                      >;
                                      type: "image-data";
                                    }
                                  | {
                                      providerOptions?: Record<
                                        string,
                                        Record<string, any>
                                      >;
                                      type: "image-url";
                                      url: string;
                                    }
                                  | {
                                      fileId: string | Record<string, string>;
                                      providerOptions?: Record<
                                        string,
                                        Record<string, any>
                                      >;
                                      type: "image-file-id";
                                    }
                                  | {
                                      providerOptions?: Record<
                                        string,
                                        Record<string, any>
                                      >;
                                      type: "custom";
                                    }
                                >;
                              };
                          providerExecuted?: boolean;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          result?: any;
                          toolCallId: string;
                          toolName: string;
                          type: "tool-result";
                        }
                      | {
                          id: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          sourceType: "url";
                          title?: string;
                          type: "source";
                          url: string;
                        }
                      | {
                          filename?: string;
                          id: string;
                          mediaType: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          sourceType: "document";
                          title: string;
                          type: "source";
                        }
                      | {
                          approvalId: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          toolCallId: string;
                          type: "tool-approval-request";
                        }
                    >;
                providerOptions?: Record<string, Record<string, any>>;
                role: "assistant";
              }
            | {
                content: Array<
                  | {
                      args?: any;
                      experimental_content?: Array<
                        | { text: string; type: "text" }
                        | { data: string; mimeType?: string; type: "image" }
                      >;
                      isError?: boolean;
                      output?:
                        | {
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "text";
                            value: string;
                          }
                        | {
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "json";
                            value: any;
                          }
                        | {
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "error-text";
                            value: string;
                          }
                        | {
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "error-json";
                            value: any;
                          }
                        | {
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            reason?: string;
                            type: "execution-denied";
                          }
                        | {
                            type: "content";
                            value: Array<
                              | {
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  text: string;
                                  type: "text";
                                }
                              | {
                                  data: string;
                                  mediaType: string;
                                  type: "media";
                                }
                              | {
                                  data: string;
                                  filename?: string;
                                  mediaType: string;
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "file-data";
                                }
                              | {
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "file-url";
                                  url: string;
                                }
                              | {
                                  fileId: string | Record<string, string>;
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "file-id";
                                }
                              | {
                                  data: string;
                                  mediaType: string;
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "image-data";
                                }
                              | {
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "image-url";
                                  url: string;
                                }
                              | {
                                  fileId: string | Record<string, string>;
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "image-file-id";
                                }
                              | {
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "custom";
                                }
                            >;
                          };
                      providerExecuted?: boolean;
                      providerMetadata?: Record<string, Record<string, any>>;
                      providerOptions?: Record<string, Record<string, any>>;
                      result?: any;
                      toolCallId: string;
                      toolName: string;
                      type: "tool-result";
                    }
                  | {
                      approvalId: string;
                      approved: boolean;
                      providerExecuted?: boolean;
                      providerMetadata?: Record<string, Record<string, any>>;
                      providerOptions?: Record<string, Record<string, any>>;
                      reason?: string;
                      type: "tool-approval-response";
                    }
                >;
                providerOptions?: Record<string, Record<string, any>>;
                role: "tool";
              }
            | {
                content: string;
                providerOptions?: Record<string, Record<string, any>>;
                role: "system";
              };
          model?: string;
          order: number;
          provider?: string;
          providerMetadata?: Record<string, Record<string, any>>;
          providerOptions?: Record<string, Record<string, any>>;
          reasoning?: string;
          reasoningDetails?: Array<
            | {
                providerMetadata?: Record<string, Record<string, any>>;
                providerOptions?: Record<string, Record<string, any>>;
                signature?: string;
                text: string;
                type: "reasoning";
              }
            | { signature?: string; text: string; type: "text" }
            | { data: string; type: "redacted" }
          >;
          sources?: Array<
            | {
                id: string;
                providerMetadata?: Record<string, Record<string, any>>;
                providerOptions?: Record<string, Record<string, any>>;
                sourceType: "url";
                title?: string;
                type?: "source";
                url: string;
              }
            | {
                filename?: string;
                id: string;
                mediaType: string;
                providerMetadata?: Record<string, Record<string, any>>;
                providerOptions?: Record<string, Record<string, any>>;
                sourceType: "document";
                title: string;
                type: "source";
              }
          >;
          status: "pending" | "success" | "failed";
          stepOrder: number;
          text?: string;
          threadId: string;
          tool: boolean;
          usage?: {
            cachedInputTokens?: number;
            completionTokens: number;
            promptTokens: number;
            reasoningTokens?: number;
            totalTokens: number;
          };
          userId?: string;
          warnings?: Array<
            | { details?: string; setting: string; type: "unsupported-setting" }
            | { details?: string; tool: any; type: "unsupported-tool" }
            | { message: string; type: "other" }
          >;
        }>
      >;
      textSearch: FunctionReference<
        "query",
        "internal",
        {
          limit: number;
          searchAllMessagesForUserId?: string;
          targetMessageId?: string;
          text?: string;
          threadId?: string;
        },
        Array<{
          _creationTime: number;
          _id: string;
          agentName?: string;
          embeddingId?: string;
          error?: string;
          fileIds?: Array<string>;
          finishReason?:
            | "stop"
            | "length"
            | "content-filter"
            | "tool-calls"
            | "error"
            | "other"
            | "unknown";
          id?: string;
          message?:
            | {
                content:
                  | string
                  | Array<
                      | {
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          text: string;
                          type: "text";
                        }
                      | {
                          image: string | ArrayBuffer;
                          mediaType?: string;
                          mimeType?: string;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "image";
                        }
                      | {
                          data: string | ArrayBuffer;
                          filename?: string;
                          mediaType?: string;
                          mimeType?: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "file";
                        }
                    >;
                providerOptions?: Record<string, Record<string, any>>;
                role: "user";
              }
            | {
                content:
                  | string
                  | Array<
                      | {
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          text: string;
                          type: "text";
                        }
                      | {
                          data: string | ArrayBuffer;
                          filename?: string;
                          mediaType?: string;
                          mimeType?: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "file";
                        }
                      | {
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          signature?: string;
                          text: string;
                          type: "reasoning";
                        }
                      | {
                          data: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "redacted-reasoning";
                        }
                      | {
                          args?: any;
                          input: any;
                          providerExecuted?: boolean;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          toolCallId: string;
                          toolName: string;
                          type: "tool-call";
                        }
                      | {
                          args: any;
                          input?: any;
                          providerExecuted?: boolean;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          toolCallId: string;
                          toolName: string;
                          type: "tool-call";
                        }
                      | {
                          args?: any;
                          experimental_content?: Array<
                            | { text: string; type: "text" }
                            | { data: string; mimeType?: string; type: "image" }
                          >;
                          isError?: boolean;
                          output?:
                            | {
                                providerOptions?: Record<
                                  string,
                                  Record<string, any>
                                >;
                                type: "text";
                                value: string;
                              }
                            | {
                                providerOptions?: Record<
                                  string,
                                  Record<string, any>
                                >;
                                type: "json";
                                value: any;
                              }
                            | {
                                providerOptions?: Record<
                                  string,
                                  Record<string, any>
                                >;
                                type: "error-text";
                                value: string;
                              }
                            | {
                                providerOptions?: Record<
                                  string,
                                  Record<string, any>
                                >;
                                type: "error-json";
                                value: any;
                              }
                            | {
                                providerOptions?: Record<
                                  string,
                                  Record<string, any>
                                >;
                                reason?: string;
                                type: "execution-denied";
                              }
                            | {
                                type: "content";
                                value: Array<
                                  | {
                                      providerOptions?: Record<
                                        string,
                                        Record<string, any>
                                      >;
                                      text: string;
                                      type: "text";
                                    }
                                  | {
                                      data: string;
                                      mediaType: string;
                                      type: "media";
                                    }
                                  | {
                                      data: string;
                                      filename?: string;
                                      mediaType: string;
                                      providerOptions?: Record<
                                        string,
                                        Record<string, any>
                                      >;
                                      type: "file-data";
                                    }
                                  | {
                                      providerOptions?: Record<
                                        string,
                                        Record<string, any>
                                      >;
                                      type: "file-url";
                                      url: string;
                                    }
                                  | {
                                      fileId: string | Record<string, string>;
                                      providerOptions?: Record<
                                        string,
                                        Record<string, any>
                                      >;
                                      type: "file-id";
                                    }
                                  | {
                                      data: string;
                                      mediaType: string;
                                      providerOptions?: Record<
                                        string,
                                        Record<string, any>
                                      >;
                                      type: "image-data";
                                    }
                                  | {
                                      providerOptions?: Record<
                                        string,
                                        Record<string, any>
                                      >;
                                      type: "image-url";
                                      url: string;
                                    }
                                  | {
                                      fileId: string | Record<string, string>;
                                      providerOptions?: Record<
                                        string,
                                        Record<string, any>
                                      >;
                                      type: "image-file-id";
                                    }
                                  | {
                                      providerOptions?: Record<
                                        string,
                                        Record<string, any>
                                      >;
                                      type: "custom";
                                    }
                                >;
                              };
                          providerExecuted?: boolean;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          result?: any;
                          toolCallId: string;
                          toolName: string;
                          type: "tool-result";
                        }
                      | {
                          id: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          sourceType: "url";
                          title?: string;
                          type: "source";
                          url: string;
                        }
                      | {
                          filename?: string;
                          id: string;
                          mediaType: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          sourceType: "document";
                          title: string;
                          type: "source";
                        }
                      | {
                          approvalId: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          toolCallId: string;
                          type: "tool-approval-request";
                        }
                    >;
                providerOptions?: Record<string, Record<string, any>>;
                role: "assistant";
              }
            | {
                content: Array<
                  | {
                      args?: any;
                      experimental_content?: Array<
                        | { text: string; type: "text" }
                        | { data: string; mimeType?: string; type: "image" }
                      >;
                      isError?: boolean;
                      output?:
                        | {
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "text";
                            value: string;
                          }
                        | {
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "json";
                            value: any;
                          }
                        | {
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "error-text";
                            value: string;
                          }
                        | {
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "error-json";
                            value: any;
                          }
                        | {
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            reason?: string;
                            type: "execution-denied";
                          }
                        | {
                            type: "content";
                            value: Array<
                              | {
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  text: string;
                                  type: "text";
                                }
                              | {
                                  data: string;
                                  mediaType: string;
                                  type: "media";
                                }
                              | {
                                  data: string;
                                  filename?: string;
                                  mediaType: string;
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "file-data";
                                }
                              | {
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "file-url";
                                  url: string;
                                }
                              | {
                                  fileId: string | Record<string, string>;
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "file-id";
                                }
                              | {
                                  data: string;
                                  mediaType: string;
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "image-data";
                                }
                              | {
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "image-url";
                                  url: string;
                                }
                              | {
                                  fileId: string | Record<string, string>;
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "image-file-id";
                                }
                              | {
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "custom";
                                }
                            >;
                          };
                      providerExecuted?: boolean;
                      providerMetadata?: Record<string, Record<string, any>>;
                      providerOptions?: Record<string, Record<string, any>>;
                      result?: any;
                      toolCallId: string;
                      toolName: string;
                      type: "tool-result";
                    }
                  | {
                      approvalId: string;
                      approved: boolean;
                      providerExecuted?: boolean;
                      providerMetadata?: Record<string, Record<string, any>>;
                      providerOptions?: Record<string, Record<string, any>>;
                      reason?: string;
                      type: "tool-approval-response";
                    }
                >;
                providerOptions?: Record<string, Record<string, any>>;
                role: "tool";
              }
            | {
                content: string;
                providerOptions?: Record<string, Record<string, any>>;
                role: "system";
              };
          model?: string;
          order: number;
          provider?: string;
          providerMetadata?: Record<string, Record<string, any>>;
          providerOptions?: Record<string, Record<string, any>>;
          reasoning?: string;
          reasoningDetails?: Array<
            | {
                providerMetadata?: Record<string, Record<string, any>>;
                providerOptions?: Record<string, Record<string, any>>;
                signature?: string;
                text: string;
                type: "reasoning";
              }
            | { signature?: string; text: string; type: "text" }
            | { data: string; type: "redacted" }
          >;
          sources?: Array<
            | {
                id: string;
                providerMetadata?: Record<string, Record<string, any>>;
                providerOptions?: Record<string, Record<string, any>>;
                sourceType: "url";
                title?: string;
                type?: "source";
                url: string;
              }
            | {
                filename?: string;
                id: string;
                mediaType: string;
                providerMetadata?: Record<string, Record<string, any>>;
                providerOptions?: Record<string, Record<string, any>>;
                sourceType: "document";
                title: string;
                type: "source";
              }
          >;
          status: "pending" | "success" | "failed";
          stepOrder: number;
          text?: string;
          threadId: string;
          tool: boolean;
          usage?: {
            cachedInputTokens?: number;
            completionTokens: number;
            promptTokens: number;
            reasoningTokens?: number;
            totalTokens: number;
          };
          userId?: string;
          warnings?: Array<
            | { details?: string; setting: string; type: "unsupported-setting" }
            | { details?: string; tool: any; type: "unsupported-tool" }
            | { message: string; type: "other" }
          >;
        }>
      >;
      updateMessage: FunctionReference<
        "mutation",
        "internal",
        {
          messageId: string;
          patch: {
            error?: string;
            fileIds?: Array<string>;
            finishReason?:
              | "stop"
              | "length"
              | "content-filter"
              | "tool-calls"
              | "error"
              | "other"
              | "unknown";
            message?:
              | {
                  content:
                    | string
                    | Array<
                        | {
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            text: string;
                            type: "text";
                          }
                        | {
                            image: string | ArrayBuffer;
                            mediaType?: string;
                            mimeType?: string;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "image";
                          }
                        | {
                            data: string | ArrayBuffer;
                            filename?: string;
                            mediaType?: string;
                            mimeType?: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "file";
                          }
                      >;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "user";
                }
              | {
                  content:
                    | string
                    | Array<
                        | {
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            text: string;
                            type: "text";
                          }
                        | {
                            data: string | ArrayBuffer;
                            filename?: string;
                            mediaType?: string;
                            mimeType?: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "file";
                          }
                        | {
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            signature?: string;
                            text: string;
                            type: "reasoning";
                          }
                        | {
                            data: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "redacted-reasoning";
                          }
                        | {
                            args?: any;
                            input: any;
                            providerExecuted?: boolean;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            toolCallId: string;
                            toolName: string;
                            type: "tool-call";
                          }
                        | {
                            args: any;
                            input?: any;
                            providerExecuted?: boolean;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            toolCallId: string;
                            toolName: string;
                            type: "tool-call";
                          }
                        | {
                            args?: any;
                            experimental_content?: Array<
                              | { text: string; type: "text" }
                              | {
                                  data: string;
                                  mimeType?: string;
                                  type: "image";
                                }
                            >;
                            isError?: boolean;
                            output?:
                              | {
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "text";
                                  value: string;
                                }
                              | {
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "json";
                                  value: any;
                                }
                              | {
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "error-text";
                                  value: string;
                                }
                              | {
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "error-json";
                                  value: any;
                                }
                              | {
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  reason?: string;
                                  type: "execution-denied";
                                }
                              | {
                                  type: "content";
                                  value: Array<
                                    | {
                                        providerOptions?: Record<
                                          string,
                                          Record<string, any>
                                        >;
                                        text: string;
                                        type: "text";
                                      }
                                    | {
                                        data: string;
                                        mediaType: string;
                                        type: "media";
                                      }
                                    | {
                                        data: string;
                                        filename?: string;
                                        mediaType: string;
                                        providerOptions?: Record<
                                          string,
                                          Record<string, any>
                                        >;
                                        type: "file-data";
                                      }
                                    | {
                                        providerOptions?: Record<
                                          string,
                                          Record<string, any>
                                        >;
                                        type: "file-url";
                                        url: string;
                                      }
                                    | {
                                        fileId: string | Record<string, string>;
                                        providerOptions?: Record<
                                          string,
                                          Record<string, any>
                                        >;
                                        type: "file-id";
                                      }
                                    | {
                                        data: string;
                                        mediaType: string;
                                        providerOptions?: Record<
                                          string,
                                          Record<string, any>
                                        >;
                                        type: "image-data";
                                      }
                                    | {
                                        providerOptions?: Record<
                                          string,
                                          Record<string, any>
                                        >;
                                        type: "image-url";
                                        url: string;
                                      }
                                    | {
                                        fileId: string | Record<string, string>;
                                        providerOptions?: Record<
                                          string,
                                          Record<string, any>
                                        >;
                                        type: "image-file-id";
                                      }
                                    | {
                                        providerOptions?: Record<
                                          string,
                                          Record<string, any>
                                        >;
                                        type: "custom";
                                      }
                                  >;
                                };
                            providerExecuted?: boolean;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            result?: any;
                            toolCallId: string;
                            toolName: string;
                            type: "tool-result";
                          }
                        | {
                            id: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            sourceType: "url";
                            title?: string;
                            type: "source";
                            url: string;
                          }
                        | {
                            filename?: string;
                            id: string;
                            mediaType: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            sourceType: "document";
                            title: string;
                            type: "source";
                          }
                        | {
                            approvalId: string;
                            providerMetadata?: Record<
                              string,
                              Record<string, any>
                            >;
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            toolCallId: string;
                            type: "tool-approval-request";
                          }
                      >;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "assistant";
                }
              | {
                  content: Array<
                    | {
                        args?: any;
                        experimental_content?: Array<
                          | { text: string; type: "text" }
                          | { data: string; mimeType?: string; type: "image" }
                        >;
                        isError?: boolean;
                        output?:
                          | {
                              providerOptions?: Record<
                                string,
                                Record<string, any>
                              >;
                              type: "text";
                              value: string;
                            }
                          | {
                              providerOptions?: Record<
                                string,
                                Record<string, any>
                              >;
                              type: "json";
                              value: any;
                            }
                          | {
                              providerOptions?: Record<
                                string,
                                Record<string, any>
                              >;
                              type: "error-text";
                              value: string;
                            }
                          | {
                              providerOptions?: Record<
                                string,
                                Record<string, any>
                              >;
                              type: "error-json";
                              value: any;
                            }
                          | {
                              providerOptions?: Record<
                                string,
                                Record<string, any>
                              >;
                              reason?: string;
                              type: "execution-denied";
                            }
                          | {
                              type: "content";
                              value: Array<
                                | {
                                    providerOptions?: Record<
                                      string,
                                      Record<string, any>
                                    >;
                                    text: string;
                                    type: "text";
                                  }
                                | {
                                    data: string;
                                    mediaType: string;
                                    type: "media";
                                  }
                                | {
                                    data: string;
                                    filename?: string;
                                    mediaType: string;
                                    providerOptions?: Record<
                                      string,
                                      Record<string, any>
                                    >;
                                    type: "file-data";
                                  }
                                | {
                                    providerOptions?: Record<
                                      string,
                                      Record<string, any>
                                    >;
                                    type: "file-url";
                                    url: string;
                                  }
                                | {
                                    fileId: string | Record<string, string>;
                                    providerOptions?: Record<
                                      string,
                                      Record<string, any>
                                    >;
                                    type: "file-id";
                                  }
                                | {
                                    data: string;
                                    mediaType: string;
                                    providerOptions?: Record<
                                      string,
                                      Record<string, any>
                                    >;
                                    type: "image-data";
                                  }
                                | {
                                    providerOptions?: Record<
                                      string,
                                      Record<string, any>
                                    >;
                                    type: "image-url";
                                    url: string;
                                  }
                                | {
                                    fileId: string | Record<string, string>;
                                    providerOptions?: Record<
                                      string,
                                      Record<string, any>
                                    >;
                                    type: "image-file-id";
                                  }
                                | {
                                    providerOptions?: Record<
                                      string,
                                      Record<string, any>
                                    >;
                                    type: "custom";
                                  }
                              >;
                            };
                        providerExecuted?: boolean;
                        providerMetadata?: Record<string, Record<string, any>>;
                        providerOptions?: Record<string, Record<string, any>>;
                        result?: any;
                        toolCallId: string;
                        toolName: string;
                        type: "tool-result";
                      }
                    | {
                        approvalId: string;
                        approved: boolean;
                        providerExecuted?: boolean;
                        providerMetadata?: Record<string, Record<string, any>>;
                        providerOptions?: Record<string, Record<string, any>>;
                        reason?: string;
                        type: "tool-approval-response";
                      }
                  >;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "tool";
                }
              | {
                  content: string;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "system";
                };
            model?: string;
            provider?: string;
            providerOptions?: Record<string, Record<string, any>>;
            status?: "pending" | "success" | "failed";
          };
        },
        {
          _creationTime: number;
          _id: string;
          agentName?: string;
          embeddingId?: string;
          error?: string;
          fileIds?: Array<string>;
          finishReason?:
            | "stop"
            | "length"
            | "content-filter"
            | "tool-calls"
            | "error"
            | "other"
            | "unknown";
          id?: string;
          message?:
            | {
                content:
                  | string
                  | Array<
                      | {
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          text: string;
                          type: "text";
                        }
                      | {
                          image: string | ArrayBuffer;
                          mediaType?: string;
                          mimeType?: string;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "image";
                        }
                      | {
                          data: string | ArrayBuffer;
                          filename?: string;
                          mediaType?: string;
                          mimeType?: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "file";
                        }
                    >;
                providerOptions?: Record<string, Record<string, any>>;
                role: "user";
              }
            | {
                content:
                  | string
                  | Array<
                      | {
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          text: string;
                          type: "text";
                        }
                      | {
                          data: string | ArrayBuffer;
                          filename?: string;
                          mediaType?: string;
                          mimeType?: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "file";
                        }
                      | {
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          signature?: string;
                          text: string;
                          type: "reasoning";
                        }
                      | {
                          data: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "redacted-reasoning";
                        }
                      | {
                          args?: any;
                          input: any;
                          providerExecuted?: boolean;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          toolCallId: string;
                          toolName: string;
                          type: "tool-call";
                        }
                      | {
                          args: any;
                          input?: any;
                          providerExecuted?: boolean;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          toolCallId: string;
                          toolName: string;
                          type: "tool-call";
                        }
                      | {
                          args?: any;
                          experimental_content?: Array<
                            | { text: string; type: "text" }
                            | { data: string; mimeType?: string; type: "image" }
                          >;
                          isError?: boolean;
                          output?:
                            | {
                                providerOptions?: Record<
                                  string,
                                  Record<string, any>
                                >;
                                type: "text";
                                value: string;
                              }
                            | {
                                providerOptions?: Record<
                                  string,
                                  Record<string, any>
                                >;
                                type: "json";
                                value: any;
                              }
                            | {
                                providerOptions?: Record<
                                  string,
                                  Record<string, any>
                                >;
                                type: "error-text";
                                value: string;
                              }
                            | {
                                providerOptions?: Record<
                                  string,
                                  Record<string, any>
                                >;
                                type: "error-json";
                                value: any;
                              }
                            | {
                                providerOptions?: Record<
                                  string,
                                  Record<string, any>
                                >;
                                reason?: string;
                                type: "execution-denied";
                              }
                            | {
                                type: "content";
                                value: Array<
                                  | {
                                      providerOptions?: Record<
                                        string,
                                        Record<string, any>
                                      >;
                                      text: string;
                                      type: "text";
                                    }
                                  | {
                                      data: string;
                                      mediaType: string;
                                      type: "media";
                                    }
                                  | {
                                      data: string;
                                      filename?: string;
                                      mediaType: string;
                                      providerOptions?: Record<
                                        string,
                                        Record<string, any>
                                      >;
                                      type: "file-data";
                                    }
                                  | {
                                      providerOptions?: Record<
                                        string,
                                        Record<string, any>
                                      >;
                                      type: "file-url";
                                      url: string;
                                    }
                                  | {
                                      fileId: string | Record<string, string>;
                                      providerOptions?: Record<
                                        string,
                                        Record<string, any>
                                      >;
                                      type: "file-id";
                                    }
                                  | {
                                      data: string;
                                      mediaType: string;
                                      providerOptions?: Record<
                                        string,
                                        Record<string, any>
                                      >;
                                      type: "image-data";
                                    }
                                  | {
                                      providerOptions?: Record<
                                        string,
                                        Record<string, any>
                                      >;
                                      type: "image-url";
                                      url: string;
                                    }
                                  | {
                                      fileId: string | Record<string, string>;
                                      providerOptions?: Record<
                                        string,
                                        Record<string, any>
                                      >;
                                      type: "image-file-id";
                                    }
                                  | {
                                      providerOptions?: Record<
                                        string,
                                        Record<string, any>
                                      >;
                                      type: "custom";
                                    }
                                >;
                              };
                          providerExecuted?: boolean;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          result?: any;
                          toolCallId: string;
                          toolName: string;
                          type: "tool-result";
                        }
                      | {
                          id: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          sourceType: "url";
                          title?: string;
                          type: "source";
                          url: string;
                        }
                      | {
                          filename?: string;
                          id: string;
                          mediaType: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          sourceType: "document";
                          title: string;
                          type: "source";
                        }
                      | {
                          approvalId: string;
                          providerMetadata?: Record<
                            string,
                            Record<string, any>
                          >;
                          providerOptions?: Record<string, Record<string, any>>;
                          toolCallId: string;
                          type: "tool-approval-request";
                        }
                    >;
                providerOptions?: Record<string, Record<string, any>>;
                role: "assistant";
              }
            | {
                content: Array<
                  | {
                      args?: any;
                      experimental_content?: Array<
                        | { text: string; type: "text" }
                        | { data: string; mimeType?: string; type: "image" }
                      >;
                      isError?: boolean;
                      output?:
                        | {
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "text";
                            value: string;
                          }
                        | {
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "json";
                            value: any;
                          }
                        | {
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "error-text";
                            value: string;
                          }
                        | {
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            type: "error-json";
                            value: any;
                          }
                        | {
                            providerOptions?: Record<
                              string,
                              Record<string, any>
                            >;
                            reason?: string;
                            type: "execution-denied";
                          }
                        | {
                            type: "content";
                            value: Array<
                              | {
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  text: string;
                                  type: "text";
                                }
                              | {
                                  data: string;
                                  mediaType: string;
                                  type: "media";
                                }
                              | {
                                  data: string;
                                  filename?: string;
                                  mediaType: string;
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "file-data";
                                }
                              | {
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "file-url";
                                  url: string;
                                }
                              | {
                                  fileId: string | Record<string, string>;
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "file-id";
                                }
                              | {
                                  data: string;
                                  mediaType: string;
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "image-data";
                                }
                              | {
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "image-url";
                                  url: string;
                                }
                              | {
                                  fileId: string | Record<string, string>;
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "image-file-id";
                                }
                              | {
                                  providerOptions?: Record<
                                    string,
                                    Record<string, any>
                                  >;
                                  type: "custom";
                                }
                            >;
                          };
                      providerExecuted?: boolean;
                      providerMetadata?: Record<string, Record<string, any>>;
                      providerOptions?: Record<string, Record<string, any>>;
                      result?: any;
                      toolCallId: string;
                      toolName: string;
                      type: "tool-result";
                    }
                  | {
                      approvalId: string;
                      approved: boolean;
                      providerExecuted?: boolean;
                      providerMetadata?: Record<string, Record<string, any>>;
                      providerOptions?: Record<string, Record<string, any>>;
                      reason?: string;
                      type: "tool-approval-response";
                    }
                >;
                providerOptions?: Record<string, Record<string, any>>;
                role: "tool";
              }
            | {
                content: string;
                providerOptions?: Record<string, Record<string, any>>;
                role: "system";
              };
          model?: string;
          order: number;
          provider?: string;
          providerMetadata?: Record<string, Record<string, any>>;
          providerOptions?: Record<string, Record<string, any>>;
          reasoning?: string;
          reasoningDetails?: Array<
            | {
                providerMetadata?: Record<string, Record<string, any>>;
                providerOptions?: Record<string, Record<string, any>>;
                signature?: string;
                text: string;
                type: "reasoning";
              }
            | { signature?: string; text: string; type: "text" }
            | { data: string; type: "redacted" }
          >;
          sources?: Array<
            | {
                id: string;
                providerMetadata?: Record<string, Record<string, any>>;
                providerOptions?: Record<string, Record<string, any>>;
                sourceType: "url";
                title?: string;
                type?: "source";
                url: string;
              }
            | {
                filename?: string;
                id: string;
                mediaType: string;
                providerMetadata?: Record<string, Record<string, any>>;
                providerOptions?: Record<string, Record<string, any>>;
                sourceType: "document";
                title: string;
                type: "source";
              }
          >;
          status: "pending" | "success" | "failed";
          stepOrder: number;
          text?: string;
          threadId: string;
          tool: boolean;
          usage?: {
            cachedInputTokens?: number;
            completionTokens: number;
            promptTokens: number;
            reasoningTokens?: number;
            totalTokens: number;
          };
          userId?: string;
          warnings?: Array<
            | { details?: string; setting: string; type: "unsupported-setting" }
            | { details?: string; tool: any; type: "unsupported-tool" }
            | { message: string; type: "other" }
          >;
        }
      >;
    };
    streams: {
      abort: FunctionReference<
        "mutation",
        "internal",
        {
          finalDelta?: {
            end: number;
            parts: Array<any>;
            start: number;
            streamId: string;
          };
          reason: string;
          streamId: string;
        },
        boolean
      >;
      abortByOrder: FunctionReference<
        "mutation",
        "internal",
        { order: number; reason: string; threadId: string },
        boolean
      >;
      addDelta: FunctionReference<
        "mutation",
        "internal",
        { end: number; parts: Array<any>; start: number; streamId: string },
        boolean
      >;
      create: FunctionReference<
        "mutation",
        "internal",
        {
          agentName?: string;
          format?: "UIMessageChunk" | "TextStreamPart";
          model?: string;
          order: number;
          provider?: string;
          providerOptions?: Record<string, Record<string, any>>;
          stepOrder: number;
          threadId: string;
          userId?: string;
        },
        string
      >;
      deleteAllStreamsForThreadIdAsync: FunctionReference<
        "mutation",
        "internal",
        { deltaCursor?: string; streamOrder?: number; threadId: string },
        { deltaCursor?: string; isDone: boolean; streamOrder?: number }
      >;
      deleteAllStreamsForThreadIdSync: FunctionReference<
        "action",
        "internal",
        { threadId: string },
        null
      >;
      deleteStreamAsync: FunctionReference<
        "mutation",
        "internal",
        { cursor?: string; streamId: string },
        null
      >;
      deleteStreamSync: FunctionReference<
        "mutation",
        "internal",
        { streamId: string },
        null
      >;
      finish: FunctionReference<
        "mutation",
        "internal",
        {
          finalDelta?: {
            end: number;
            parts: Array<any>;
            start: number;
            streamId: string;
          };
          streamId: string;
        },
        null
      >;
      heartbeat: FunctionReference<
        "mutation",
        "internal",
        { streamId: string },
        null
      >;
      list: FunctionReference<
        "query",
        "internal",
        {
          startOrder?: number;
          statuses?: Array<"streaming" | "finished" | "aborted">;
          threadId: string;
        },
        Array<{
          agentName?: string;
          format?: "UIMessageChunk" | "TextStreamPart";
          model?: string;
          order: number;
          provider?: string;
          providerOptions?: Record<string, Record<string, any>>;
          status: "streaming" | "finished" | "aborted";
          stepOrder: number;
          streamId: string;
          userId?: string;
        }>
      >;
      listDeltas: FunctionReference<
        "query",
        "internal",
        {
          cursors: Array<{ cursor: number; streamId: string }>;
          threadId: string;
        },
        Array<{
          end: number;
          parts: Array<any>;
          start: number;
          streamId: string;
        }>
      >;
    };
    threads: {
      createThread: FunctionReference<
        "mutation",
        "internal",
        {
          defaultSystemPrompt?: string;
          parentThreadIds?: Array<string>;
          summary?: string;
          title?: string;
          userId?: string;
        },
        {
          _creationTime: number;
          _id: string;
          status: "active" | "archived";
          summary?: string;
          title?: string;
          userId?: string;
        }
      >;
      deleteAllForThreadIdAsync: FunctionReference<
        "mutation",
        "internal",
        {
          cursor?: string;
          deltaCursor?: string;
          limit?: number;
          messagesDone?: boolean;
          streamOrder?: number;
          streamsDone?: boolean;
          threadId: string;
        },
        { isDone: boolean }
      >;
      deleteAllForThreadIdSync: FunctionReference<
        "action",
        "internal",
        { limit?: number; threadId: string },
        null
      >;
      getThread: FunctionReference<
        "query",
        "internal",
        { threadId: string },
        {
          _creationTime: number;
          _id: string;
          status: "active" | "archived";
          summary?: string;
          title?: string;
          userId?: string;
        } | null
      >;
      listThreadsByUserId: FunctionReference<
        "query",
        "internal",
        {
          order?: "asc" | "desc";
          paginationOpts?: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          userId?: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            _creationTime: number;
            _id: string;
            status: "active" | "archived";
            summary?: string;
            title?: string;
            userId?: string;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      searchThreadTitles: FunctionReference<
        "query",
        "internal",
        { limit: number; query: string; userId?: string | null },
        Array<{
          _creationTime: number;
          _id: string;
          status: "active" | "archived";
          summary?: string;
          title?: string;
          userId?: string;
        }>
      >;
      updateThread: FunctionReference<
        "mutation",
        "internal",
        {
          patch: {
            status?: "active" | "archived";
            summary?: string;
            title?: string;
            userId?: string;
          };
          threadId: string;
        },
        {
          _creationTime: number;
          _id: string;
          status: "active" | "archived";
          summary?: string;
          title?: string;
          userId?: string;
        }
      >;
    };
    users: {
      deleteAllForUserId: FunctionReference<
        "action",
        "internal",
        { userId: string },
        null
      >;
      deleteAllForUserIdAsync: FunctionReference<
        "mutation",
        "internal",
        { userId: string },
        boolean
      >;
      listUsersWithThreads: FunctionReference<
        "query",
        "internal",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<string>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
    };
    vector: {
      index: {
        deleteBatch: FunctionReference<
          "mutation",
          "internal",
          {
            ids: Array<
              | string
              | string
              | string
              | string
              | string
              | string
              | string
              | string
              | string
              | string
            >;
          },
          null
        >;
        deleteBatchForThread: FunctionReference<
          "mutation",
          "internal",
          {
            cursor?: string;
            limit: number;
            model: string;
            threadId: string;
            vectorDimension:
              | 128
              | 256
              | 512
              | 768
              | 1024
              | 1408
              | 1536
              | 2048
              | 3072
              | 4096;
          },
          { continueCursor: string; isDone: boolean }
        >;
        insertBatch: FunctionReference<
          "mutation",
          "internal",
          {
            vectorDimension:
              | 128
              | 256
              | 512
              | 768
              | 1024
              | 1408
              | 1536
              | 2048
              | 3072
              | 4096;
            vectors: Array<{
              messageId?: string;
              model: string;
              table: string;
              threadId?: string;
              userId?: string;
              vector: Array<number>;
            }>;
          },
          Array<
            | string
            | string
            | string
            | string
            | string
            | string
            | string
            | string
            | string
            | string
          >
        >;
        paginate: FunctionReference<
          "query",
          "internal",
          {
            cursor?: string;
            limit: number;
            table?: string;
            targetModel: string;
            vectorDimension:
              | 128
              | 256
              | 512
              | 768
              | 1024
              | 1408
              | 1536
              | 2048
              | 3072
              | 4096;
          },
          {
            continueCursor: string;
            ids: Array<
              | string
              | string
              | string
              | string
              | string
              | string
              | string
              | string
              | string
              | string
            >;
            isDone: boolean;
          }
        >;
        updateBatch: FunctionReference<
          "mutation",
          "internal",
          {
            vectors: Array<{
              id:
                | string
                | string
                | string
                | string
                | string
                | string
                | string
                | string
                | string
                | string;
              model: string;
              vector: Array<number>;
            }>;
          },
          null
        >;
      };
    };
  };
  resend: {
    lib: {
      cancelEmail: FunctionReference<
        "mutation",
        "internal",
        { emailId: string },
        null
      >;
      cleanupAbandonedEmails: FunctionReference<
        "mutation",
        "internal",
        { olderThan?: number },
        null
      >;
      cleanupOldEmails: FunctionReference<
        "mutation",
        "internal",
        { olderThan?: number },
        null
      >;
      createManualEmail: FunctionReference<
        "mutation",
        "internal",
        {
          from: string;
          headers?: Array<{ name: string; value: string }>;
          replyTo?: Array<string>;
          subject: string;
          to: Array<string> | string;
        },
        string
      >;
      get: FunctionReference<
        "query",
        "internal",
        { emailId: string },
        {
          bcc?: Array<string>;
          bounced?: boolean;
          cc?: Array<string>;
          clicked?: boolean;
          complained: boolean;
          createdAt: number;
          deliveryDelayed?: boolean;
          errorMessage?: string;
          failed?: boolean;
          finalizedAt: number;
          from: string;
          headers?: Array<{ name: string; value: string }>;
          html?: string;
          opened: boolean;
          replyTo: Array<string>;
          resendId?: string;
          segment: number;
          status:
            | "waiting"
            | "queued"
            | "cancelled"
            | "sent"
            | "delivered"
            | "delivery_delayed"
            | "bounced"
            | "failed";
          subject?: string;
          template?: {
            id: string;
            variables?: Record<string, string | number>;
          };
          text?: string;
          to: Array<string>;
        } | null
      >;
      getStatus: FunctionReference<
        "query",
        "internal",
        { emailId: string },
        {
          bounced: boolean;
          clicked: boolean;
          complained: boolean;
          deliveryDelayed: boolean;
          errorMessage: string | null;
          failed: boolean;
          opened: boolean;
          status:
            | "waiting"
            | "queued"
            | "cancelled"
            | "sent"
            | "delivered"
            | "delivery_delayed"
            | "bounced"
            | "failed";
        } | null
      >;
      handleEmailEvent: FunctionReference<
        "mutation",
        "internal",
        { event: any },
        null
      >;
      sendEmail: FunctionReference<
        "mutation",
        "internal",
        {
          bcc?: Array<string>;
          cc?: Array<string>;
          from: string;
          headers?: Array<{ name: string; value: string }>;
          html?: string;
          options: {
            apiKey: string;
            initialBackoffMs: number;
            onEmailEvent?: { fnHandle: string };
            retryAttempts: number;
            testMode: boolean;
          };
          replyTo?: Array<string>;
          subject?: string;
          template?: {
            id: string;
            variables?: Record<string, string | number>;
          };
          text?: string;
          to: Array<string>;
        },
        string
      >;
      updateManualEmail: FunctionReference<
        "mutation",
        "internal",
        {
          emailId: string;
          errorMessage?: string;
          resendId?: string;
          status:
            | "waiting"
            | "queued"
            | "cancelled"
            | "sent"
            | "delivered"
            | "delivery_delayed"
            | "bounced"
            | "failed";
        },
        null
      >;
    };
  };
  stripe: {
    private: {
      handleCheckoutSessionCompleted: FunctionReference<
        "mutation",
        "internal",
        {
          metadata?: any;
          mode: string;
          stripeCheckoutSessionId: string;
          stripeCustomerId?: string;
        },
        null
      >;
      handleCustomerCreated: FunctionReference<
        "mutation",
        "internal",
        {
          email?: string;
          metadata?: any;
          name?: string;
          stripeCustomerId: string;
        },
        null
      >;
      handleCustomerUpdated: FunctionReference<
        "mutation",
        "internal",
        {
          email?: string;
          metadata?: any;
          name?: string;
          stripeCustomerId: string;
        },
        null
      >;
      handleInvoiceCreated: FunctionReference<
        "mutation",
        "internal",
        {
          amountDue: number;
          amountPaid: number;
          created: number;
          status: string;
          stripeCustomerId: string;
          stripeInvoiceId: string;
          stripeSubscriptionId?: string;
        },
        null
      >;
      handleInvoicePaid: FunctionReference<
        "mutation",
        "internal",
        { amountPaid: number; stripeInvoiceId: string },
        null
      >;
      handleInvoicePaymentFailed: FunctionReference<
        "mutation",
        "internal",
        { stripeInvoiceId: string },
        null
      >;
      handlePaymentIntentSucceeded: FunctionReference<
        "mutation",
        "internal",
        {
          amount: number;
          created: number;
          currency: string;
          metadata?: any;
          status: string;
          stripeCustomerId?: string;
          stripePaymentIntentId: string;
        },
        null
      >;
      handleSubscriptionCreated: FunctionReference<
        "mutation",
        "internal",
        {
          cancelAt?: number;
          cancelAtPeriodEnd: boolean;
          currentPeriodEnd: number;
          metadata?: any;
          priceId: string;
          quantity?: number;
          status: string;
          stripeCustomerId: string;
          stripeSubscriptionId: string;
        },
        null
      >;
      handleSubscriptionDeleted: FunctionReference<
        "mutation",
        "internal",
        {
          cancelAt?: number;
          cancelAtPeriodEnd?: boolean;
          currentPeriodEnd?: number;
          stripeSubscriptionId: string;
        },
        null
      >;
      handleSubscriptionUpdated: FunctionReference<
        "mutation",
        "internal",
        {
          cancelAt?: number;
          cancelAtPeriodEnd: boolean;
          currentPeriodEnd: number;
          metadata?: any;
          priceId?: string;
          quantity?: number;
          status: string;
          stripeSubscriptionId: string;
        },
        null
      >;
      listSubscriptionsWithCreationTime: FunctionReference<
        "query",
        "internal",
        { stripeCustomerId: string },
        Array<{
          _creationTime: number;
          status: string;
          stripeCustomerId: string;
          stripeSubscriptionId: string;
        }>
      >;
      updatePaymentCustomer: FunctionReference<
        "mutation",
        "internal",
        { stripeCustomerId: string; stripePaymentIntentId: string },
        null
      >;
      updateSubscriptionQuantityInternal: FunctionReference<
        "mutation",
        "internal",
        { quantity: number; stripeSubscriptionId: string },
        null
      >;
    };
    public: {
      createOrUpdateCustomer: FunctionReference<
        "mutation",
        "internal",
        {
          email?: string;
          metadata?: any;
          name?: string;
          stripeCustomerId: string;
        },
        string
      >;
      getCheckoutSession: FunctionReference<
        "query",
        "internal",
        { stripeCheckoutSessionId: string },
        {
          metadata?: any;
          mode: string;
          status: string;
          stripeCheckoutSessionId: string;
          stripeCustomerId?: string;
        } | null
      >;
      getCustomer: FunctionReference<
        "query",
        "internal",
        { stripeCustomerId: string },
        {
          email?: string;
          metadata?: any;
          name?: string;
          stripeCustomerId: string;
          userId?: string;
        } | null
      >;
      getCustomerByEmail: FunctionReference<
        "query",
        "internal",
        { email: string },
        {
          email?: string;
          metadata?: any;
          name?: string;
          stripeCustomerId: string;
          userId?: string;
        } | null
      >;
      getCustomerByUserId: FunctionReference<
        "query",
        "internal",
        { userId: string },
        {
          email?: string;
          metadata?: any;
          name?: string;
          stripeCustomerId: string;
          userId?: string;
        } | null
      >;
      getPayment: FunctionReference<
        "query",
        "internal",
        { stripePaymentIntentId: string },
        {
          amount: number;
          created: number;
          currency: string;
          metadata?: any;
          orgId?: string;
          status: string;
          stripeCustomerId?: string;
          stripePaymentIntentId: string;
          userId?: string;
        } | null
      >;
      getSubscription: FunctionReference<
        "query",
        "internal",
        { stripeSubscriptionId: string },
        {
          cancelAt?: number;
          cancelAtPeriodEnd: boolean;
          currentPeriodEnd: number;
          metadata?: any;
          orgId?: string;
          priceId: string;
          quantity?: number;
          status: string;
          stripeCustomerId: string;
          stripeSubscriptionId: string;
          userId?: string;
        } | null
      >;
      getSubscriptionByOrgId: FunctionReference<
        "query",
        "internal",
        { orgId: string },
        {
          cancelAt?: number;
          cancelAtPeriodEnd: boolean;
          currentPeriodEnd: number;
          metadata?: any;
          orgId?: string;
          priceId: string;
          quantity?: number;
          status: string;
          stripeCustomerId: string;
          stripeSubscriptionId: string;
          userId?: string;
        } | null
      >;
      listCheckoutSessions: FunctionReference<
        "query",
        "internal",
        { stripeCustomerId: string },
        Array<{
          metadata?: any;
          mode: string;
          status: string;
          stripeCheckoutSessionId: string;
          stripeCustomerId?: string;
        }>
      >;
      listInvoices: FunctionReference<
        "query",
        "internal",
        { stripeCustomerId: string },
        Array<{
          amountDue: number;
          amountPaid: number;
          created: number;
          orgId?: string;
          status: string;
          stripeCustomerId: string;
          stripeInvoiceId: string;
          stripeSubscriptionId?: string;
          userId?: string;
        }>
      >;
      listInvoicesByOrgId: FunctionReference<
        "query",
        "internal",
        { orgId: string },
        Array<{
          amountDue: number;
          amountPaid: number;
          created: number;
          orgId?: string;
          status: string;
          stripeCustomerId: string;
          stripeInvoiceId: string;
          stripeSubscriptionId?: string;
          userId?: string;
        }>
      >;
      listInvoicesByUserId: FunctionReference<
        "query",
        "internal",
        { userId: string },
        Array<{
          amountDue: number;
          amountPaid: number;
          created: number;
          orgId?: string;
          status: string;
          stripeCustomerId: string;
          stripeInvoiceId: string;
          stripeSubscriptionId?: string;
          userId?: string;
        }>
      >;
      listPayments: FunctionReference<
        "query",
        "internal",
        { stripeCustomerId: string },
        Array<{
          amount: number;
          created: number;
          currency: string;
          metadata?: any;
          orgId?: string;
          status: string;
          stripeCustomerId?: string;
          stripePaymentIntentId: string;
          userId?: string;
        }>
      >;
      listPaymentsByOrgId: FunctionReference<
        "query",
        "internal",
        { orgId: string },
        Array<{
          amount: number;
          created: number;
          currency: string;
          metadata?: any;
          orgId?: string;
          status: string;
          stripeCustomerId?: string;
          stripePaymentIntentId: string;
          userId?: string;
        }>
      >;
      listPaymentsByUserId: FunctionReference<
        "query",
        "internal",
        { userId: string },
        Array<{
          amount: number;
          created: number;
          currency: string;
          metadata?: any;
          orgId?: string;
          status: string;
          stripeCustomerId?: string;
          stripePaymentIntentId: string;
          userId?: string;
        }>
      >;
      listSubscriptions: FunctionReference<
        "query",
        "internal",
        { stripeCustomerId: string },
        Array<{
          cancelAt?: number;
          cancelAtPeriodEnd: boolean;
          currentPeriodEnd: number;
          metadata?: any;
          orgId?: string;
          priceId: string;
          quantity?: number;
          status: string;
          stripeCustomerId: string;
          stripeSubscriptionId: string;
          userId?: string;
        }>
      >;
      listSubscriptionsByOrgId: FunctionReference<
        "query",
        "internal",
        { orgId: string },
        Array<{
          cancelAt?: number;
          cancelAtPeriodEnd: boolean;
          currentPeriodEnd: number;
          metadata?: any;
          orgId?: string;
          priceId: string;
          quantity?: number;
          status: string;
          stripeCustomerId: string;
          stripeSubscriptionId: string;
          userId?: string;
        }>
      >;
      listSubscriptionsByUserId: FunctionReference<
        "query",
        "internal",
        { userId: string },
        Array<{
          cancelAt?: number;
          cancelAtPeriodEnd: boolean;
          currentPeriodEnd: number;
          metadata?: any;
          orgId?: string;
          priceId: string;
          quantity?: number;
          status: string;
          stripeCustomerId: string;
          stripeSubscriptionId: string;
          userId?: string;
        }>
      >;
      updateSubscriptionMetadata: FunctionReference<
        "mutation",
        "internal",
        {
          metadata: any;
          orgId?: string;
          stripeSubscriptionId: string;
          userId?: string;
        },
        null
      >;
      updateSubscriptionQuantity: FunctionReference<
        "action",
        "internal",
        { quantity: number; stripeSubscriptionId: string },
        null
      >;
    };
  };
};
