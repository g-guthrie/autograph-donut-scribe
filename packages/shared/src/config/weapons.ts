export interface WeaponConfig {
  id: string;
  displayName: string;
  adsFovOverride: number;
  damage: number;
  magazineSize: number;
}

export const DEFAULT_WEAPON_CONFIGS: WeaponConfig[] = [
  { id: "mg55", displayName: "MG-55 Grinder", adsFovOverride: 50, damage: 24, magazineSize: 42 },
  { id: "dmr7", displayName: "DMR-7 Pilgrim", adsFovOverride: 42, damage: 36, magazineSize: 20 },
  { id: "longshot-s9", displayName: "Longshot S9", adsFovOverride: 25, damage: 95, magazineSize: 5 },
  { id: "quarry-12", displayName: "Quarry 12", adsFovOverride: 55, damage: 15, magazineSize: 8 },
  { id: "mercy-hc-1", displayName: "Mercy HC-1", adsFovOverride: 48, damage: 44, magazineSize: 6 }
];

export function validateWeaponConfigs(configs: WeaponConfig[]): WeaponConfig[] {
  if (configs.length === 0) {
    throw new Error("Weapon registry must not be empty");
  }
  const ids = new Set<string>();
  for (const config of configs) {
    if (ids.has(config.id)) {
      throw new Error(`Duplicate weapon id: ${config.id}`);
    }
    ids.add(config.id);
  }
  return configs;
}
