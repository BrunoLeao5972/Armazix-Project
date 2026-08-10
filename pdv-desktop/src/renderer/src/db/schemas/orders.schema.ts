import type { RxJsonSchema } from "rxdb";
import type { OrderDoc } from "../types";

export const orderSchema: RxJsonSchema<OrderDoc> = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id:            { type: "string", maxLength: 36 },
    storeId:       { type: "string", maxLength: 36 },
    sessaoId:      { type: "string", maxLength: 36 },
    mesaLabel:     { type: ["string", "null"] },
    paymentMethod: { type: "string", maxLength: 40 },
    installments:  { type: ["number", "null"] },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          productId:     { type: ["string", "null"] },
          productName:   { type: "string" },
          productEmoji:  { type: ["string", "null"] },
          quantity:      { type: "number" },
          unitPrice:     { type: "string" },
          total:         { type: "string" },
        },
      },
    },
    subtotal:      { type: "string" },
    discount:      { type: ["string", "null"] },
    total:         { type: "string" },
    createdAt:     { type: "string", maxLength: 40 },
    synced:        { type: "boolean" },
    serverOrderId: { type: ["string", "null"] },
    serverNumber:  { type: ["number", "null"] },
    syncError:     { type: ["string", "null"] },
    syncAttempts:  { type: "number", minimum: 0, maximum: 1000, multipleOf: 1 },
  },
  required: ["id", "storeId", "sessaoId", "paymentMethod", "items", "subtotal", "total", "createdAt", "synced"],
  indexes: ["storeId", "synced", "createdAt"],
};
