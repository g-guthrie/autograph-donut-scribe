export interface MaterialDef {
  id: number;
  name: string;
  tileIndex: number;
  topColor: string;
  sideColor: string;
}

export const MATERIAL_AIR = 0;

export const MATERIALS: MaterialDef[] = [
  { id: 1, name: "volcanic_rock", tileIndex: 0, topColor: "#73474a", sideColor: "#4d3234" },
  { id: 2, name: "snow", tileIndex: 1, topColor: "#eef8ff", sideColor: "#d4ecf8" },
  { id: 3, name: "asphalt", tileIndex: 2, topColor: "#5c6676", sideColor: "#404852" },
  { id: 4, name: "sandstone", tileIndex: 3, topColor: "#d7b36e", sideColor: "#b78f4f" },
  { id: 5, name: "moss", tileIndex: 4, topColor: "#5f9b61", sideColor: "#426d46" },
  { id: 6, name: "steel", tileIndex: 5, topColor: "#7e97ad", sideColor: "#596c7d" },
  { id: 7, name: "ruins_stone", tileIndex: 6, topColor: "#9d9d8f", sideColor: "#7c7c72" },
  { id: 8, name: "moon_dust", tileIndex: 7, topColor: "#8f8ea3", sideColor: "#6a697a" },
  { id: 9, name: "sky_grass", tileIndex: 8, topColor: "#97d86f", sideColor: "#699948" },
  { id: 10, name: "bedrock", tileIndex: 9, topColor: "#1f2731", sideColor: "#161d24" }
];

export function materialById(id: number): MaterialDef | undefined {
  return MATERIALS.find((material) => material.id === id);
}

export const ZONE_SURFACE_MATERIALS: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
