import type { RxJsonSchema } from "rxdb";
import type { SyncQueueDoc } from "../types";

export const syncQueueSchema: RxJsonSchema<SyncQueueDoc> = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id:        { type: "string", maxLength: 36 },
    type:      { type: "string", maxLength: 40 },
    refId:     { type: "string", maxLength: 36 },
    payload:   { type: "object" },
    status:    { type: "string", maxLength: 20 },
    attempts:  { type: "number", minimum: 0, maximum: 1000, multipleOf: 1 },
    lastError: { type: ["string", "null"] },
    createdAt: { type: "string", maxLength: 40 },
    updatedAt: { type: "string", maxLength: 40 },
  },
  required: ["id", "type", "refId", "payload", "status", "attempts", "createdAt", "updatedAt"],
  indexes: ["status", "createdAt"],
};
