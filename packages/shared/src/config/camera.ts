export interface CameraMode {
  dist: number;
  shoulder: number;
  height: number;
  fov: number;
  smooth: number;
}

export interface CameraConfig {
  hipfire: CameraMode;
  ads: CameraMode;
  sensitivityBase: number;
  sensitivityAdsMult: number;
  pitchMin: number;
  pitchMax: number;
  adsTransitionMs: number;
}

export const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  hipfire: {
    dist: 3.74,
    shoulder: 1.755,
    height: 0.7,
    fov: 75,
    smooth: 12
  },
  ads: {
    dist: 1.72,
    shoulder: 2,
    height: 0.46,
    fov: 56,
    smooth: 12
  },
  sensitivityBase: 0.002,
  sensitivityAdsMult: 0.7,
  pitchMin: -1.3962634,
  pitchMax: 1.3962634,
  adsTransitionMs: 180
};

export function validateCameraConfig(config: CameraConfig): CameraConfig {
  if (config.pitchMin >= config.pitchMax) {
    throw new Error("Camera pitch range is invalid");
  }
  if (config.adsTransitionMs <= 0) {
    throw new Error("ADS transition must be positive");
  }
  return config;
}
