import { useEffect, useMemo } from "react";
import { latLngBounds } from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
} from "../utils/constants.js";
import {
  formatDistanceAway,
  getLocationText,
  getSlotCoordinates,
  hasSlotCoordinates,
} from "../services/parkingService.js";
import "leaflet/dist/leaflet.css";

const wrapperStyle = {
  background: "#ffffff",
  borderRadius: "24px",
  padding: "18px",
  border: "1px solid rgba(16, 42, 67, 0.08)",
  boxShadow: "0 18px 40px rgba(16, 42, 67, 0.08)",
};

const mapStyle = {
  width: "100%",
  height: "420px",
  borderRadius: "18px",
};

function SyncMapView({ points, selectedSlotId, userLocation }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length && !userLocation) {
      map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
      return;
    }

    const selectedPoint = points.find((point) => point._id === selectedSlotId);
    const userPoint =
      userLocation &&
      Number.isFinite(Number(userLocation.lat)) &&
      Number.isFinite(Number(userLocation.lng))
        ? [Number(userLocation.lat), Number(userLocation.lng)]
        : null;

    if (selectedPoint && userPoint) {
      const bounds = latLngBounds([
        userPoint,
        [selectedPoint.lat, selectedPoint.lng],
      ]);
      map.fitBounds(bounds, { padding: [44, 44], maxZoom: 14 });
      return;
    }

    if (selectedPoint) {
      map.flyTo([selectedPoint.lat, selectedPoint.lng], 15, {
        duration: 0.9,
      });
      return;
    }

    if (userPoint) {
      map.flyTo(userPoint, 14, {
        duration: 0.9,
      });
      return;
    }

    const bounds = latLngBounds(points.map((point) => [point.lat, point.lng]));
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 13 });
  }, [map, points, selectedSlotId, userLocation]);

  return null;
}

function ParkingMap({
  emptyLabel = "Parking locations with map coordinates will appear here.",
  onSelect,
  selectedSlotId,
  slots,
  subtitle = "Tap a marker to inspect a slot and line it up with the list.",
  title = "Map View",
  userLocation = null,
}) {
  const points = useMemo(
    () =>
      slots
        .filter(hasSlotCoordinates)
        .map((slot) => {
          const coordinates = getSlotCoordinates(slot);

          return {
            ...slot,
            lat: coordinates[0],
            lng: coordinates[1],
          };
        }),
    [slots]
  );
  const selectedPoint = points.find((point) => point._id === selectedSlotId) ?? null;
  const routeLine =
    userLocation && selectedPoint
      ? [
          [Number(userLocation.lat), Number(userLocation.lng)],
          [selectedPoint.lat, selectedPoint.lng],
        ]
      : null;

  return (
    <section style={wrapperStyle}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "14px",
        }}
      >
        <div>
          <h2 style={{ margin: "0 0 6px", color: "#102a43" }}>{title}</h2>
          <p style={{ margin: 0, color: "#486581", lineHeight: 1.6 }}>
            {subtitle}
          </p>
        </div>

        <span
          style={{
            borderRadius: "999px",
            padding: "8px 12px",
            background: "rgba(15, 118, 110, 0.12)",
            color: "#0f766e",
            fontWeight: 700,
            fontSize: "0.9rem",
          }}
        >
          {points.length} mapped
        </span>
      </div>

      {points.length === 0 && !userLocation ? (
        <div style={{ display: "grid", gap: "10px" }}>
          <p style={{ margin: 0, color: "#486581" }}>{emptyLabel}</p>
          <p style={{ margin: 0, color: "#829ab1" }}>
            Add coordinates to a parking slot or turn on location from the
            search page to wake the map up.
          </p>
        </div>
      ) : (
        <MapContainer
          center={DEFAULT_MAP_CENTER}
          scrollWheelZoom={false}
          style={mapStyle}
          zoom={DEFAULT_MAP_ZOOM}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <SyncMapView
            points={points}
            selectedSlotId={selectedSlotId}
            userLocation={userLocation}
          />

          {userLocation ? (
            <CircleMarker
              center={[Number(userLocation.lat), Number(userLocation.lng)]}
              pathOptions={{
                color: "#1d4ed8",
                fillColor: "#60a5fa",
                fillOpacity: 0.92,
                weight: 2,
              }}
              radius={10}
            >
              <Tooltip direction="top" offset={[0, -6]}>
                Your location
              </Tooltip>
              <Popup>
                <strong>You are here</strong>
              </Popup>
            </CircleMarker>
          ) : null}

          {routeLine ? (
            <Polyline
              pathOptions={{
                color: "#1d4ed8",
                dashArray: "8 10",
                opacity: 0.8,
                weight: 3,
              }}
              positions={routeLine}
            />
          ) : null}

          {points.map((slot) => {
            const isSelected = slot._id === selectedSlotId;

            return (
              <CircleMarker
                center={[slot.lat, slot.lng]}
                eventHandlers={{
                  click: () => onSelect?.(slot._id),
                }}
                key={slot._id}
                pathOptions={{
                  color: isSelected ? "#b91c1c" : "#0f766e",
                  fillColor: isSelected ? "#ef4444" : "#14b8a6",
                  fillOpacity: 0.9,
                  weight: 2,
                }}
                radius={isSelected ? 12 : 9}
              >
                <Tooltip direction="top" offset={[0, -6]}>
                  {slot.title}
                </Tooltip>
                <Popup>
                  <strong>{slot.title}</strong>
                  <br />
                  {getLocationText(slot)}
                  <br />
                  Rs. {slot.pricePerHour}/hour
                  {slot.distanceFromUserKm != null ? (
                    <>
                      <br />
                      {formatDistanceAway(slot.distanceFromUserKm)}
                    </>
                  ) : null}
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      )}
    </section>
  );
}

export default ParkingMap;
