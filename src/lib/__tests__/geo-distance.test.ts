import { describe, it, expect } from "vitest";
import { distanceMeters, pointInPolygon } from "@/lib/geo-distance";

describe("distanceMeters", () => {
  it("retorna 0 para o mesmo ponto", () => {
    expect(distanceMeters({ lat: -3.7327, lng: -38.5267 }, { lat: -3.7327, lng: -38.5267 })).toBe(0);
  });

  it("distância aproximada entre dois pontos conhecidos (Fortaleza → Aquiraz, ~25km)", () => {
    // Coordenadas reais — tolerância generosa porque é reta (haversine), não rota.
    const fortaleza = { lat: -3.7327, lng: -38.5267 };
    const aquiraz    = { lat: -3.9014, lng: -38.3911 };
    const d = distanceMeters(fortaleza, aquiraz);
    expect(d).toBeGreaterThan(20_000);
    expect(d).toBeLessThan(30_000);
  });
});

describe("pointInPolygon", () => {
  const quadrado: Array<[number, number]> = [
    [0, 0], [0, 10], [10, 10], [10, 0],
  ];

  it("ponto dentro do polígono", () => {
    expect(pointInPolygon({ lat: 5, lng: 5 }, quadrado)).toBe(true);
  });

  it("ponto fora do polígono", () => {
    expect(pointInPolygon({ lat: 20, lng: 20 }, quadrado)).toBe(false);
  });

  it("polígono com menos de 3 pontos nunca contém nada", () => {
    expect(pointInPolygon({ lat: 1, lng: 1 }, [[0, 0], [1, 1]])).toBe(false);
  });
});
