/**
 * GeoMap — Leaflet MapContainer with click-to-pin support.
 *
 * IMPORTANT: This file MUST be dynamically imported with { ssr: false } by any
 * consumer. Leaflet calls `window` at module load time; importing it on the
 * server crashes the Next.js build.
 *   const GeoMap = dynamic(() => import("./geolocation-map"), { ssr: false })
 *
 * RESEARCH Pitfall 1: Webpack/Next.js breaks Leaflet's default marker icon
 * path resolution. Fix by deleting `_getIconUrl` and calling L.Icon.Default.mergeOptions
 * with the public/leaflet/*.png assets (copied by Plan 14-01).
 *
 * RESEARCH Pitfall 2: leaflet/dist/leaflet.css MUST be the first import in this
 * file so that map controls, zoom buttons, and tile rendering are styled correctly.
 */
"use client"

import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet"

// Fix default marker icon path — Webpack cannot resolve Leaflet's built-in CSS
// url() at bundle time. Use the assets copied to public/leaflet/ by Plan 14-01.
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: "/leaflet/marker-icon.png",
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  shadowUrl: "/leaflet/marker-shadow.png",
})

interface GeoMapProps {
  lat: number
  lng: number
  /**
   * Called when the user clicks the map (D-13 click-to-pin).
   * When present and readOnly is false, a ClickHandler is mounted.
   */
  onClickPin?: (lat: number, lng: number) => void
  /** When true, map click events are suppressed (read-only preview mode). */
  readOnly?: boolean
}

/**
 * Internal handler component — must be inside MapContainer to use useMapEvents.
 * Returns null; its only job is to wire map click → onClickPin prop.
 */
function ClickHandler({ onClickPin }: { onClickPin: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClickPin(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

/**
 * GeoMap renders an OSM-backed Leaflet map centred on [lat, lng] with a single
 * marker. When onClickPin is provided and readOnly is false, clicking the map
 * fires onClickPin(lat, lng) — the consumer updates the stored value accordingly.
 *
 * Map height is fixed at 200px per UI-SPEC §"Phase 14 layout-dimension exceptions".
 * The OSM tile layer attribution is mandatory per OpenStreetMap tile usage policy.
 *
 * Security note (T-14-05-02): the tile URL encodes the map centre as z/x/y tile
 * coordinates. This reveals the approximate captured location to the OSM tile
 * server. This is accepted per RESEARCH §Security Domain for the assessment context.
 */
export default function GeoMap({ lat, lng, onClickPin, readOnly = false }: GeoMapProps) {
  return (
    <div
      role="application"
      aria-label="Location map — click to adjust pin position"
      // isolation + z-0: Leaflet's internal panes/controls use z-index up to
      // ~1000, which would otherwise escape and paint over the sticky form
      // header (z-30). A dedicated stacking context keeps them contained.
      style={{ height: 200, width: "100%", position: "relative", zIndex: 0, isolation: "isolate" }}
    >
      <MapContainer
        center={[lat, lng]}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]} />
        {onClickPin && !readOnly && (
          <ClickHandler onClickPin={onClickPin} />
        )}
      </MapContainer>
    </div>
  )
}
