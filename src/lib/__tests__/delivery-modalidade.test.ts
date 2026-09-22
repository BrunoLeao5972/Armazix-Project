import { describe, it, expect } from "vitest";
import { deriveDeliveryPickupFlags } from "@/lib/store/delivery-modalidade";

describe("deriveDeliveryPickupFlags", () => {
  it('"todas" habilita delivery e retirada', () => {
    expect(deriveDeliveryPickupFlags("todas")).toEqual({ deliveryEnabled: true, pickupEnabled: true });
  });

  it('"delivery" desliga a retirada (bug original: pickupEnabled ficava sempre true)', () => {
    expect(deriveDeliveryPickupFlags("delivery")).toEqual({ deliveryEnabled: true, pickupEnabled: false });
  });

  it('"retirada" desliga o delivery (bug original: deliveryEnabled ficava sempre true)', () => {
    expect(deriveDeliveryPickupFlags("retirada")).toEqual({ deliveryEnabled: false, pickupEnabled: true });
  });

  it("modalidade desconhecida, vazia ou ausente não mexe no que já estava salvo", () => {
    expect(deriveDeliveryPickupFlags(undefined)).toBeNull();
    expect(deriveDeliveryPickupFlags(null)).toBeNull();
    expect(deriveDeliveryPickupFlags("")).toBeNull();
    expect(deriveDeliveryPickupFlags("outra-coisa")).toBeNull();
    expect(deriveDeliveryPickupFlags(123)).toBeNull();
  });
});
