import type { RxJsonSchema } from "rxdb";
import type { UserCacheDoc } from "../types";

export const userCacheSchema: RxJsonSchema<UserCacheDoc> = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id:                  { type: "string", maxLength: 36 },
    email:               { type: "string", maxLength: 200 },
    name:                { type: "string" },
    role:                { type: "string", maxLength: 30 },
    storeId:             { type: "string", maxLength: 36 },
    storeName:           { type: "string" },
    storeSlug:           { type: "string" },
    passwordHash:        { type: "string" },
    passwordSalt:        { type: "string" },
    passwordIterations:  { type: "number" },
    lastOnlineLoginAt:   { type: "string" },
  },
  required: ["id", "email", "name", "role", "storeId", "passwordHash", "passwordSalt", "passwordIterations"],
  indexes: ["email"],
};
