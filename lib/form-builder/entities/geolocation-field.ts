/**
 * geolocationFieldEntity
 *
 * Value shape: { lat: number; lng: number; accuracy: number; capturedAt: string }
 *   - lat: decimal degrees, range [-90, 90]
 *   - lng: decimal degrees, range [-180, 180]
 *   - accuracy: metres (non-negative), from Geolocation API coords.accuracy
 *   - capturedAt: ISO 8601 timestamp string
 *
 * Security note (T-14-02-05): validate() enforces numeric ranges for lat/lng to prevent
 * corrupted values from breaking the Leaflet map render in the renderer.
 *
 * Map library: Leaflet (OSS, no API key — D-13). Location capture via navigator.geolocation.getCurrentPosition().
 */
import { createEntity } from "@coltorapps/builder";
import { labelAttribute } from "../attributes/label";
import { requiredAttribute } from "../attributes/required";
import { helpTextAttribute } from "../attributes/help-text";
import { attachPhotosAttribute } from "../attributes/attach-photos";

export const geolocationFieldEntity = createEntity({
  name: "geolocationField",
  attributes: [
    labelAttribute,
    requiredAttribute,
    helpTextAttribute,
    attachPhotosAttribute,
  ],
  validate(value, context) {
    const isRequired = context.entity.attributes.required ?? false;
    const label = context.entity.attributes.label ?? "Location";

    if (isRequired && (value === undefined || value === null)) {
      throw new Error(`${label} is required.`);
    }
    if (value !== undefined && value !== null) {
      if (typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`${label} must be a geolocation object {lat, lng, accuracy, capturedAt}.`);
      }
      const v = value as Record<string, unknown>;
      if (typeof v.lat !== "number" || v.lat < -90 || v.lat > 90) {
        throw new Error(`${label}: lat must be a number in [-90, 90].`);
      }
      if (typeof v.lng !== "number" || v.lng < -180 || v.lng > 180) {
        throw new Error(`${label}: lng must be a number in [-180, 180].`);
      }
      if (typeof v.accuracy !== "number" || v.accuracy < 0) {
        throw new Error(`${label}: accuracy must be a non-negative number.`);
      }
      if (typeof v.capturedAt !== "string" || v.capturedAt.trim().length === 0) {
        throw new Error(`${label}: capturedAt must be a non-empty ISO timestamp string.`);
      }
    }
    return value;
  },
});
