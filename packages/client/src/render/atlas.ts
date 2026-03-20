import * as THREE from "three";

import { MATERIALS } from "@olympus/shared";

export function createAtlasTexture(): THREE.CanvasTexture {
  const size = 2048;
  const grid = 16;
  const tile = size / grid;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context == null) {
    throw new Error("Canvas 2D context unavailable");
  }

  context.fillStyle = "#08141d";
  context.fillRect(0, 0, size, size);

  for (const material of MATERIALS) {
    const tileX = material.tileIndex % grid;
    const tileY = Math.floor(material.tileIndex / grid);
    const x = tileX * tile;
    const y = tileY * tile;
    context.fillStyle = material.topColor;
    context.fillRect(x, y, tile, tile);
    context.fillStyle = material.sideColor;
    context.fillRect(x, y + (tile * 0.55), tile, tile * 0.45);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}
