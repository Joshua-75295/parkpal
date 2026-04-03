import { useEffect, useMemo, useRef, useState } from "react";
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
  formatTravelSummary,
  getLocationText,
  getSlotCoordinates,
  hasSlotCoordinates,
} from "../services/parkingService.js";
import {
  getGoogleMapsMapId,
  loadGoogleMapsApi,
} from "../services/routingService.js";
import "leaflet/dist/leaflet.css";

const wrapperStyle = {
  background: "#ffffff",
  borderRadius: "24px",
  padding: "16px",
  border: "1px solid rgba(16, 42, 67, 0.08)",
  boxShadow: "0 18px 40px rgba(16, 42, 67, 0.08)",
};

const mapStyle = {
  width: "100%",
  height: "clamp(260px, 42vw, 420px)",
  borderRadius: "18px",
};

const routeChipsStyle = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
  marginBottom: "14px",
};

const routeChipStyle = (isActive) => ({
  border: `1px solid ${
    isActive ? "rgba(29, 78, 216, 0.34)" : "rgba(148, 163, 184, 0.28)"
  }`,
  borderRadius: "16px",
  padding: "10px 12px",
  background: isActive ? "rgba(29, 78, 216, 0.08)" : "#ffffff",
  color: "#102a43",
  cursor: "pointer",
  display: "grid",
  gap: "4px",
  minWidth: "110px",
  textAlign: "left",
});

const routeChipMetaStyle = {
  color: "#486581",
  fontSize: "0.82rem",
  lineHeight: 1.4,
};

const formatRouteChipDuration = (durationMinutes) => {
  const normalizedDuration = Number(durationMinutes);

  if (!Number.isFinite(normalizedDuration) || normalizedDuration <= 0) {
    return "";
  }

  if (normalizedDuration < 60) {
    return `${Math.round(normalizedDuration)} min`;
  }

  const hours = Math.floor(normalizedDuration / 60);
  const minutes = Math.round(normalizedDuration % 60);

  if (minutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${minutes} min`;
};

const formatRouteChipDistance = (distanceKm) => {
  const normalizedDistance = Number(distanceKm);

  if (!Number.isFinite(normalizedDistance)) {
    return "";
  }

  if (normalizedDistance < 1) {
    return `${Math.round(normalizedDistance * 1000)} m`;
  }

  return `${normalizedDistance.toFixed(normalizedDistance < 10 ? 1 : 0)} km`;
};

const googleMapErrorStyle = {
  borderRadius: "18px",
  background: "rgba(239, 68, 68, 0.08)",
  border: "1px solid rgba(239, 68, 68, 0.18)",
  color: "#991b1b",
  padding: "14px",
};

function SyncMapView({ points, routeCoordinates, selectedSlotId, userLocation }) {
  const map = useMap();

  useEffect(() => {
    if (routeCoordinates.length) {
      const bounds = latLngBounds(routeCoordinates.map((point) => [point.lat, point.lng]));

      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 14 });
      return;
    }

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
  }, [map, points, routeCoordinates, selectedSlotId, userLocation]);

  return null;
}

function LeafletParkingMap({
  onSelect,
  points,
  routeDetails,
  selectedSlotId,
  userLocation,
}) {
  const routeCoordinates = Array.isArray(routeDetails?.coordinates)
    ? routeDetails.coordinates
    : [];

  return (
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
        routeCoordinates={routeCoordinates}
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

      {routeCoordinates.length ? (
        <Polyline
          pathOptions={{
            color: "#1d4ed8",
            dashArray: "8 10",
            opacity: 0.8,
            weight: 3,
          }}
          positions={routeCoordinates.map((point) => [point.lat, point.lng])}
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
                  {formatTravelSummary(
                    slot.distanceFromUserKm,
                    slot.travelDurationMinutes,
                    slot.distanceMethod
                  )}
                </>
              ) : null}
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}

function GoogleParkingMap({
  activeRouteId,
  onSelect,
  points,
  routeOptions,
  selectedSlotId,
  userLocation,
}) {
  const containerRef = useRef(null);
  const infoWindowRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const polylinesRef = useRef([]);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let isCancelled = false;

    loadGoogleMapsApi()
      .then((google) => {
        if (isCancelled || !containerRef.current) {
          return;
        }

        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(containerRef.current, {
            center: {
              lat: DEFAULT_MAP_CENTER[0],
              lng: DEFAULT_MAP_CENTER[1],
            },
            fullscreenControl: true,
            mapId: getGoogleMapsMapId() || undefined,
            mapTypeControl: false,
            streetViewControl: false,
            zoom: DEFAULT_MAP_ZOOM,
          });
          infoWindowRef.current = new google.maps.InfoWindow();
        }

        setLoadError("");
      })
      .catch((error) => {
        if (!isCancelled) {
          setLoadError(error.message || "Could not load Google Maps.");
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const google = window.google;
    const map = mapRef.current;

    if (!google?.maps || !map) {
      return;
    }

    markersRef.current.forEach((marker) => marker.setMap(null));
    polylinesRef.current.forEach((polyline) => polyline.setMap(null));
    markersRef.current = [];
    polylinesRef.current = [];

    const bounds = new google.maps.LatLngBounds();
    const activeRoute =
      routeOptions.find((route) => route.id === activeRouteId) ?? routeOptions[0] ?? null;

    if (userLocation) {
      const userPosition = {
        lat: Number(userLocation.lat),
        lng: Number(userLocation.lng),
      };

      bounds.extend(userPosition);
      markersRef.current.push(
        new google.maps.Marker({
          icon: {
            fillColor: "#2563eb",
            fillOpacity: 1,
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            strokeColor: "#bfdbfe",
            strokeWeight: 3,
          },
          map,
          position: userPosition,
          title: "Your location",
        })
      );
    }

    points.forEach((slot) => {
      const position = {
        lat: slot.lat,
        lng: slot.lng,
      };
      const marker = new google.maps.Marker({
        map,
        position,
        title: slot.title,
      });

      if (slot._id === selectedSlotId) {
        marker.setIcon("https://maps.google.com/mapfiles/ms/icons/red-dot.png");
      } else {
        marker.setIcon("https://maps.google.com/mapfiles/ms/icons/green-dot.png");
      }

      marker.addListener("click", () => {
        const popupContent = document.createElement("div");
        const titleNode = document.createElement("strong");
        const locationNode = document.createElement("div");
        const priceNode = document.createElement("div");

        titleNode.textContent = slot.title;
        locationNode.textContent = getLocationText(slot);
        priceNode.textContent = `Rs. ${slot.pricePerHour}/hour`;
        popupContent.appendChild(titleNode);
        popupContent.appendChild(locationNode);
        popupContent.appendChild(priceNode);

        onSelect?.(slot._id);
        infoWindowRef.current?.setContent(popupContent);
        infoWindowRef.current?.open({
          anchor: marker,
          map,
        });
      });

      markersRef.current.push(marker);
      bounds.extend(position);
    });

    routeOptions.forEach((route, index) => {
      if (!Array.isArray(route.coordinates) || !route.coordinates.length) {
        return;
      }

      const isActive = route.id === activeRoute?.id;
      const polyline = new google.maps.Polyline({
        geodesic: true,
        map,
        path: route.coordinates,
        strokeColor: isActive ? "#1d4ed8" : "#94a3b8",
        strokeOpacity: isActive ? 0.94 : 0.7,
        strokeWeight: isActive ? 6 : 4,
        zIndex: isActive ? 3 : index + 1,
      });

      polylinesRef.current.push(polyline);
      route.coordinates.forEach((point) => bounds.extend(point));
    });

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, 48);
      return;
    }

    map.setCenter({
      lat: DEFAULT_MAP_CENTER[0],
      lng: DEFAULT_MAP_CENTER[1],
    });
    map.setZoom(DEFAULT_MAP_ZOOM);
  }, [activeRouteId, onSelect, points, routeOptions, selectedSlotId, userLocation]);

  if (loadError) {
    return <div style={googleMapErrorStyle}>{loadError}</div>;
  }

  return <div ref={containerRef} style={mapStyle} />;
}

function ParkingMap({
  activeRouteId = "",
  emptyLabel = "Parking locations with map coordinates will appear here.",
  isRouting = false,
  onRouteSelect,
  onSelect,
  routeOptions = [],
  routingProvider = "leaflet",
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
  const activeRoute =
    routeOptions.find((route) => route.id === activeRouteId) ?? routeOptions[0] ?? null;

  return (
    <section style={wrapperStyle}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: routeOptions.length ? "12px" : "14px",
        }}
      >
        <div>
          <h2 style={{ margin: "0 0 6px", color: "#102a43" }}>{title}</h2>
          <p style={{ margin: 0, color: "#486581", lineHeight: 1.6 }}>
            {subtitle}
          </p>
          {userLocation && points.length ? (
            <p style={{ margin: "8px 0 0", color: "#0f766e", lineHeight: 1.6 }}>
              {isRouting
                ? "Calculating best routes..."
                : activeRoute?.distanceKm != null
                  ? `Route: ${formatTravelSummary(
                      activeRoute.distanceKm,
                      activeRoute.durationMinutes,
                      "road"
                    )}`
                  : "Route details are not available for the selected slot right now."}
            </p>
          ) : null}
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

      {routeOptions.length ? (
        <div style={routeChipsStyle}>
          {routeOptions.map((route) => {
            const isActive = route.id === activeRoute?.id;

            return (
              <button
                key={route.id}
                onClick={() => onRouteSelect?.(route.id)}
                style={routeChipStyle(isActive)}
                type="button"
              >
                <strong style={{ fontSize: "1rem" }}>
                  {formatRouteChipDuration(route.durationMinutes) || route.label}
                </strong>
                <span style={routeChipMetaStyle}>
                  {formatRouteChipDistance(route.distanceKm) || route.label}
                </span>
                <span style={routeChipMetaStyle}>{route.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {points.length === 0 && !userLocation ? (
        <div style={{ display: "grid", gap: "10px" }}>
          <p style={{ margin: 0, color: "#486581" }}>{emptyLabel}</p>
          <p style={{ margin: 0, color: "#829ab1" }}>
            Add coordinates to a parking slot or turn on location from the
            search page to wake the map up.
          </p>
        </div>
      ) : routingProvider === "google" ? (
        <GoogleParkingMap
          activeRouteId={activeRouteId}
          onSelect={onSelect}
          points={points}
          routeOptions={routeOptions}
          selectedSlotId={selectedSlotId}
          userLocation={userLocation}
        />
      ) : (
        <LeafletParkingMap
          onSelect={onSelect}
          points={points}
          routeDetails={activeRoute}
          selectedSlotId={selectedSlotId}
          userLocation={userLocation}
        />
      )}
    </section>
  );
}

export default ParkingMap;
