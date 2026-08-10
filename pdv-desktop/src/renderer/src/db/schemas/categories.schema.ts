import type { RxJsonSchema } from "rxdb";
import type { CategoryDoc } from "../types";

export const categorySchema: RxJsonSchema<CategoryDoc> = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id:        { type: "string", maxLength: 36 },
    storeId:   { type: "string", maxLength: 36 },
    parentId:  { type: ["string", "null"], maxLength: 36 },
    name:      { type: "string" },
    emoji:     { type: ["string", "null"] },
    icon:      { type: ["string", "null"] },
    color:     { type: ["string", "null"] },
    imageUrl:  { type: ["string", "null"] },
    position:  { type: "number", minimum: 0, maximum: 100_000, multipleOf: 1 },
    active:    { type: "boolean" },
  },
  required: ["id", "storeId", "name"],
  indexes: ["storeId", "position"],
};
