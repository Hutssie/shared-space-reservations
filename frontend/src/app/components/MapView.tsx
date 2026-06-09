import React, { useCallback, useMemo, useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import { useJsApiLoader, GoogleMap, Marker, useGoogleMap } from '@react-google-maps/api';
import { Star, X, Users, Square, Heart } from 'lucide-react';
import type { Space, MapBounds } from '../api/spaces';
export type { MapBounds };
import { formatRatingScore } from '../utils/formatRating';
import { ImageWithFallback } from './ImageWithFallback';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const DEFAULT_ZOOM = 12;
/** Default world-view camera for maps with no location selected yet. */
const WORLD_DEFAULT_CENTER = { lat: 15, lng: 0 };
const WORLD_DEFAULT_ZOOM = 2;

type LatLng = { lat: number; lng: number };

const BUBBLE_WIDTH = 72;
const BUBBLE_HEIGHT = 36;

/**
 * Airbnb-style map preview card at ~1080p: ~305px wide, ~410px tall, 3:2 image (~200px).
 * Layout is at 320px then scaled so styling stays identical.
 */
const MAP_POPUP_LAYOUT_WIDTH_PX = 320;
const MAP_POPUP_WIDTH_PX = 300;
const MAP_POPUP_ZOOM = MAP_POPUP_WIDTH_PX / MAP_POPUP_LAYOUT_WIDTH_PX;
const MAP_POPUP_GAP_PX = 8;
const MAP_POPUP_VIEWPORT_MARGIN_PX = 16;
/** Image (3:2) + info block + CTA; used for placement / pan before layout. */
const MAP_POPUP_ESTIMATED_HEIGHT_PX = Math.round(
  (Math.round(MAP_POPUP_LAYOUT_WIDTH_PX * (2 / 3)) + 185) * MAP_POPUP_ZOOM
);

type MapPopupPlacement = 'north' | 'south' | 'east' | 'west';

const MAP_POPUP_PLACEMENT_ORDER: MapPopupPlacement[] = ['south', 'east', 'west', 'north'];

const mapProjectionHelpers = new WeakMap<google.maps.Map, google.maps.OverlayView>();

function getMapProjection(map: google.maps.Map): google.maps.MapCanvasProjection | null {
  let helper = mapProjectionHelpers.get(map);
  if (!helper) {
    helper = new google.maps.OverlayView();
    helper.onAdd = () => {};
    helper.draw = () => {};
    helper.onRemove = () => {};
    mapProjectionHelpers.set(map, helper);
    helper.setMap(map);
  }
  return helper.getProjection() ?? null;
}

/**
 * Viewport pixel position for a lat/lng, relative to the popup host element.
 * Uses container pixels (visible map), not div pixels (draggable pane / world coords).
 */
function latLngToHostPoint(
  map: google.maps.Map,
  host: HTMLElement,
  latLng: LatLng
): { x: number; y: number } | null {
  const projection = getMapProjection(map);
  if (!projection) return null;

  const containerPixel = projection.fromLatLngToContainerPixel(
    new google.maps.LatLng(latLng.lat, latLng.lng)
  );

  const mapDiv = map.getDiv();
  const mapRect = mapDiv.getBoundingClientRect();
  const hostRect = host.getBoundingClientRect();

  return {
    x: containerPixel.x + (mapRect.left - hostRect.left),
    y: containerPixel.y + (mapRect.top - hostRect.top),
  };
}

function getHostMapBounds(host: HTMLElement): { width: number; height: number } {
  return { width: host.clientWidth, height: host.clientHeight };
}

function popupDirectionRoom(
  markerPoint: { x: number; y: number },
  mapSize: { width: number; height: number },
  placement: MapPopupPlacement
): number {
  const gap = MAP_POPUP_GAP_PX;
  const margin = MAP_POPUP_VIEWPORT_MARGIN_PX;
  switch (placement) {
    case 'south':
      return mapSize.height - markerPoint.y - gap - margin;
    case 'north':
      return markerPoint.y - BUBBLE_HEIGHT - gap - margin;
    case 'east':
      return mapSize.width - markerPoint.x - BUBBLE_WIDTH / 2 - gap - margin;
    case 'west':
      return markerPoint.x - BUBBLE_WIDTH / 2 - gap - margin;
  }
}

function popupRectOverflow(
  rect: { left: number; top: number; right: number; bottom: number },
  mapWidth: number,
  mapHeight: number
): number {
  const margin = MAP_POPUP_VIEWPORT_MARGIN_PX;
  return (
    Math.max(0, margin - rect.top) +
    Math.max(0, rect.bottom - (mapHeight - margin)) +
    Math.max(0, margin - rect.left) +
    Math.max(0, rect.right - (mapWidth - margin))
  );
}

function choosePopupPlacement(
  markerPoint: { x: number; y: number },
  mapSize: { width: number; height: number },
  popupWidth: number,
  popupHeight: number
): MapPopupPlacement {
  const options = MAP_POPUP_PLACEMENT_ORDER.map((placement) => {
    const rect = popupViewportRect(markerPoint, placement, popupWidth, popupHeight);
    const overflow = popupRectOverflow(rect, mapSize.width, mapSize.height);
    return {
      placement,
      room: popupDirectionRoom(markerPoint, mapSize, placement),
      overflow,
      fits: overflow === 0,
    };
  });

  const fitting = options.filter((o) => o.fits);
  const pool = fitting.length > 0 ? fitting : options;

  let best = pool[0];
  for (const option of pool.slice(1)) {
    if (fitting.length > 0) {
      if (option.room > best.room) {
        best = option;
      }
    } else if (
      option.overflow < best.overflow ||
      (option.overflow === best.overflow &&
        MAP_POPUP_PLACEMENT_ORDER.indexOf(option.placement) <
          MAP_POPUP_PLACEMENT_ORDER.indexOf(best.placement))
    ) {
      best = option;
    }
  }

  // Bubbles in the upper half open southward when there is room.
  const bubbleCenterY = markerPoint.y - BUBBLE_HEIGHT / 2;
  const south = options.find((o) => o.placement === 'south');
  if (
    south?.fits &&
    bubbleCenterY < mapSize.height / 2 &&
    best.placement === 'north'
  ) {
    return 'south';
  }

  return best.placement;
}

function measurePopupHeight(cardEl: HTMLDivElement | null): number {
  if (!cardEl) return MAP_POPUP_ESTIMATED_HEIGHT_PX;
  const height = cardEl.getBoundingClientRect().height;
  return height > 0 ? Math.round(height) : MAP_POPUP_ESTIMATED_HEIGHT_PX;
}

function popupViewportRect(
  markerPoint: { x: number; y: number },
  placement: MapPopupPlacement,
  popupWidth: number,
  popupHeight: number
): { left: number; top: number; right: number; bottom: number } {
  const gap = MAP_POPUP_GAP_PX;
  const bubbleCenterY = markerPoint.y - BUBBLE_HEIGHT / 2;

  switch (placement) {
    case 'south': {
      const left = markerPoint.x - popupWidth / 2;
      const top = markerPoint.y + gap;
      return { left, top, right: left + popupWidth, bottom: top + popupHeight };
    }
    case 'north': {
      const left = markerPoint.x - popupWidth / 2;
      const bottom = markerPoint.y - BUBBLE_HEIGHT - gap;
      return { left, top: bottom - popupHeight, right: left + popupWidth, bottom };
    }
    case 'east': {
      const left = markerPoint.x + BUBBLE_WIDTH / 2 + gap;
      const top = bubbleCenterY - popupHeight / 2;
      return { left, top, right: left + popupWidth, bottom: top + popupHeight };
    }
    case 'west': {
      const right = markerPoint.x - BUBBLE_WIDTH / 2 - gap;
      const left = right - popupWidth;
      const top = bubbleCenterY - popupHeight / 2;
      return { left, top, right, bottom: top + popupHeight };
    }
  }
}

function popupNeedsPan(
  rect: { left: number; top: number; right: number; bottom: number },
  mapWidth: number,
  mapHeight: number
) {
  const margin = MAP_POPUP_VIEWPORT_MARGIN_PX;
  return (
    rect.bottom > mapHeight - margin ||
    rect.top < margin ||
    rect.right > mapWidth - margin ||
    rect.left < margin
  );
}

function panByToFitPopup(
  map: google.maps.Map,
  rect: { left: number; top: number; right: number; bottom: number }
) {
  const el = map.getDiv();
  const margin = MAP_POPUP_VIEWPORT_MARGIN_PX;
  const popupHeight = rect.bottom - rect.top;
  const maxVisibleHeight = el.clientHeight - margin * 2;
  let dx = 0;
  let dy = 0;

  const overflowBottom = rect.bottom - (el.clientHeight - margin);
  const overflowTop = margin - rect.top;

  if (popupHeight > maxVisibleHeight) {
    dy = rect.top - margin;
  } else if (overflowBottom > 0 && overflowTop > 0) {
    dy = overflowBottom >= overflowTop ? overflowBottom : -overflowTop;
  } else if (overflowBottom > 0) {
    dy = overflowBottom;
  } else if (overflowTop > 0) {
    dy = -overflowTop;
  }

  const overflowRight = rect.right - (el.clientWidth - margin);
  const overflowLeft = margin - rect.left;
  if (overflowRight > 0 && overflowLeft > 0) {
    dx = overflowRight >= overflowLeft ? overflowRight : -overflowLeft;
  } else if (overflowRight > 0) {
    dx = overflowRight;
  } else if (overflowLeft > 0) {
    dx = -overflowLeft;
  }

  if (dx !== 0 || dy !== 0) {
    map.panBy(Math.round(dx), Math.round(dy));
  }
}

function waitForMapIdle(map: google.maps.Map): Promise<void> {
  return new Promise((resolve) => {
    const listener = map.addListener('idle', () => {
      google.maps.event.removeListener(listener);
      resolve();
    });
  });
}

/** Overlay projection is not ready until the map has drawn at least once. */
function waitForMapProjection(
  map: google.maps.Map,
  timeoutMs = 4000
): Promise<google.maps.MapCanvasProjection | null> {
  const existing = getMapProjection(map);
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (projection: google.maps.MapCanvasProjection | null) => {
      if (settled) return;
      settled = true;
      resolve(projection);
    };

    const tryResolve = () => {
      const projection = getMapProjection(map);
      if (projection) finish(projection);
    };

    tryResolve();
    if (settled) return;

    const idleListener = map.addListener('idle', tryResolve);
    window.setTimeout(() => {
      google.maps.event.removeListener(idleListener);
      finish(getMapProjection(map));
    }, timeoutMs);
  });
}

function computePopupScreenPosition(
  markerPoint: { x: number; y: number },
  placement: MapPopupPlacement,
  popupWidth: number,
  popupHeight: number
) {
  const rect = popupViewportRect(markerPoint, placement, popupWidth, popupHeight);
  return { left: rect.left, top: rect.top };
}

/** Pin icon for the space location map (brown teardrop). */
function getLocationPinIcon(): google.maps.Icon {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">
      <path fill="#38291a" stroke="#b58b62" stroke-width="2" d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 30 18 30s18-16.5 18-30C36 8.06 27.94 0 18 0zm0 24c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/>
    </svg>
  `.trim();
  return {
    url: 'data:image/svg+xml,' + encodeURIComponent(svg),
    scaledSize: { width: 36, height: 48 },
    anchor: { x: 18, y: 48 },
  };
}

/** Desaturated/"washed" map style so price pins stand out (Airbnb-style). */
const MAP_STYLE_MUTED: google.maps.MapTypeStyle[] = [
  { featureType: 'water', stylers: [{ color: '#c5d4e0' }, { saturation: 35 }] },
  { featureType: 'landscape.natural', stylers: [{ saturation: -15 }, { lightness: 5 }] },
  { featureType: 'landscape.man_made', stylers: [{ saturation: -20 }, { lightness: 2 }] },
  { featureType: 'road', stylers: [{ saturation: -25 }, { lightness: 12 }] },
  { featureType: 'road.highway', stylers: [{ saturation: -35 }, { lightness: 15 }] },
  { featureType: 'poi', stylers: [{ saturation: -40 }, { lightness: 10 }] },
  { featureType: 'poi.park', stylers: [{ saturation: -25 }, { lightness: 12 }] },
  { featureType: 'transit', stylers: [{ saturation: -35 }, { visibility: 'simplified' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ saturation: -30 }] },
  { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#7a7a7a' }, { lightness: 15 }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6a6a6a' }, { lightness: 10 }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#5a5a5a' }, { lightness: 8 }] },
];

/** Return the icon for a price bubble; on hover use a darker brown fill. */
function getPriceMarkerIcon(price: number, hovered = false): google.maps.Icon {
  const text = `$${Number.isInteger(price) ? price : Math.round(price)}`;
  const fill = hovered ? '#5f4731' : 'white';
  const stroke = hovered ? '#5f4731' : '#b58b62';
  const textFill = hovered ? '#e6e2df' : '#38291a';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="56" height="28" viewBox="0 0 56 28">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.25"/>
        </filter>
      </defs>
      <rect x="2" y="2" width="52" height="24" rx="12" ry="12" fill="${fill}" stroke="${stroke}" stroke-width="2" filter="url(#shadow)"/>
      <text x="28" y="18" text-anchor="middle" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="${textFill}">${text}</text>
    </svg>
  `.trim();
  return {
    url: 'data:image/svg+xml,' + encodeURIComponent(svg),
    scaledSize: { width: BUBBLE_WIDTH, height: BUBBLE_HEIGHT },
    anchor: { x: BUBBLE_WIDTH / 2, y: BUBBLE_HEIGHT },
  };
}

export function ListingMap({
  center,
  pin,
  onPositionChange,
  zoom: zoomProp,
  className = '',
}: {
  center: LatLng | null;
  pin: LatLng | null;
  onPositionChange: (lat: number, lng: number) => void;
  zoom?: number;
  className?: string;
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: API_KEY,
  });

  // Prefer the placed pin over the geocoded city/area center, so clicking the map
  // zooms to the pin instead of snapping back to the searched location.
  const mapCenter = useMemo(
    () => pin ?? center ?? WORLD_DEFAULT_CENTER,
    [center, pin]
  );
  const zoom = useMemo(() => {
    if (pin) return 15;
    if (center) return zoomProp ?? DEFAULT_ZOOM;
    return WORLD_DEFAULT_ZOOM;
  }, [zoomProp, pin, center]);
  const onMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (pin) return;
      const lat = e.latLng?.lat();
      const lng = e.latLng?.lng();
      if (lat != null && lng != null) onPositionChange(lat, lng);
    },
    [onPositionChange, pin]
  );

  if (!API_KEY) {
    return (
      <div className={`bg-brand-50 rounded-[3rem] border-2 border-brand-100 flex items-center justify-center ${className}`}>
        <p className="text-brand-500 font-medium text-center px-4">Map unavailable. Add <code className="bg-brand-100 px-1 rounded">VITE_GOOGLE_MAPS_API_KEY</code> to your .env to enable.</p>
      </div>
    );
  }
  if (loadError) {
    return (
      <div className={`bg-brand-50 rounded-[3rem] border-2 border-brand-100 flex items-center justify-center ${className}`}>
        <p className="text-brand-500 font-medium">Failed to load map.</p>
      </div>
    );
  }
  if (!isLoaded) {
    return (
      <div className={`bg-brand-50 rounded-[3rem] border-2 border-brand-100 flex items-center justify-center ${className}`}>
        <p className="text-brand-500 font-medium">Loading map...</p>
      </div>
    );
  }

  return (
    <div className={`rounded-[3rem] overflow-hidden border-2 border-brand-100 flex flex-col h-full min-h-0 ${className}`}>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%', minHeight: '280px' }}
        center={mapCenter}
        zoom={zoom}
        onClick={onMapClick}
        options={{
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          clickableIcons: false,
          gestureHandling: 'greedy',
          zoomControlOptions: {
            position: google.maps.ControlPosition.RIGHT_CENTER,
          },
          styles: MAP_STYLE_MUTED,
        }}
      >
        {pin && (
          <Marker
            position={pin}
            draggable={false}
          />
        )}
      </GoogleMap>
    </div>
  );
}

/** Static map centered on a single point for the "Where you'll be" details section. */
export function SpaceLocationMap({
  latitude,
  longitude,
  className = '',
}: {
  latitude: number;
  longitude: number;
  className?: string;
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: API_KEY,
  });
  const center = useMemo(() => ({ lat: latitude, lng: longitude }), [latitude, longitude]);

  if (!API_KEY) {
    return (
      <div className={`bg-brand-50 rounded-[1.5rem] md:rounded-[2rem] border border-brand-100 flex items-center justify-center ${className || 'h-[400px] w-full'}`}>
        <p className="text-brand-500 font-medium text-center px-4">Map unavailable. Add <code className="bg-brand-100 px-1 rounded">VITE_GOOGLE_MAPS_API_KEY</code> to your .env.</p>
      </div>
    );
  }
  if (loadError) {
    return (
      <div className={`bg-brand-50 rounded-[1.5rem] md:rounded-[2rem] border border-brand-100 flex items-center justify-center ${className || 'h-[400px] w-full'}`}>
        <p className="text-brand-500 font-medium">Failed to load map.</p>
      </div>
    );
  }
  if (!isLoaded) {
    return (
      <div className={`bg-brand-50 rounded-[1.5rem] md:rounded-[2rem] border border-brand-100 flex items-center justify-center ${className || 'h-[400px] w-full'}`}>
        <p className="text-brand-500 font-medium">Loading map...</p>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-[1.5rem] md:rounded-[2rem] border border-brand-100 ${className || 'h-[400px] w-full'}`}>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={center}
        zoom={16}
        options={{
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          clickableIcons: false,
          zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_CENTER },
          styles: MAP_STYLE_MUTED,
          gestureHandling: 'cooperative',
        }}
      >
        <SpaceLocationMapMarker position={center} />
      </GoogleMap>
    </div>
  );
}

/** Draw a single pin on the map using the imperative API so it is always visible. */
function SpaceLocationMapMarker({ position }: { position: LatLng }) {
  const map = useGoogleMap();
  useEffect(() => {
    if (!map) return;
    const marker = new google.maps.Marker({
      map,
      position,
      icon: getLocationPinIcon(),
    });
    return () => marker.setMap(null);
  }, [map, position.lat, position.lng]);
  return null;
}

/** Render markers as children of `GoogleMap` so they receive the map from context. */
function SpacesMapMarkers({
  spaces,
  onMarkerClick,
  onMarkerHover,
}: {
  spaces: Space[];
  onMarkerClick?: (space: Space) => void;
  onMarkerHover?: (space: Space | null) => void;
}) {
  const map = useGoogleMap();
  useEffect(() => {
    if (!map || spaces.length === 0) return;
    const markers: google.maps.Marker[] = [];
    for (const space of spaces) {
      const lat = space.latitude!;
      const lng = space.longitude!;
      const m = new google.maps.Marker({
        map,
        position: { lat, lng },
        icon: getPriceMarkerIcon(space.price),
        title: space.title ?? undefined,
        cursor: 'pointer',
      });
      m.addListener('click', () => onMarkerClick?.(space));
      m.addListener('mouseover', () => {
        m.setIcon(getPriceMarkerIcon(space.price, true));
        onMarkerHover?.(space);
      });
      m.addListener('mouseout', () => {
        m.setIcon(getPriceMarkerIcon(space.price, false));
        onMarkerHover?.(null);
      });
      markers.push(m);
    }
    return () => markers.forEach((m) => m.setMap(null));
  }, [map, spaces, onMarkerClick, onMarkerHover]);
  return null;
}

function boundsFromMap(map: google.maps.Map): MapBounds | null {
  const b = map.getBounds();
  if (!b) return null;
  const ne = b.getNorthEast();
  const sw = b.getSouthWest();
  return {
    north: ne.lat(),
    south: sw.lat(),
    east: ne.lng(),
    west: sw.lng(),
  };
}

/** Ensure MapCanvasProjection exists as soon as the map appears on screen. */
function MapProjectionWarmup() {
  const map = useGoogleMap();
  useEffect(() => {
    if (!map) return;
    const warm = () => {
      getMapProjection(map);
    };
    warm();
    const idleListener = map.addListener('idle', warm);
    return () => google.maps.event.removeListener(idleListener);
  }, [map]);
  return null;
}

/** Send viewport bounds once pan/zoom settles. */
function MapBoundsReporter({ onBoundsChange }: { onBoundsChange?: (bounds: MapBounds) => void }) {
  const map = useGoogleMap();
  const onBoundsChangeRef = React.useRef(onBoundsChange);
  onBoundsChangeRef.current = onBoundsChange;

  useEffect(() => {
    if (!map || !onBoundsChangeRef.current) return;
    const report = () => {
      const bounds = boundsFromMap(map);
      if (bounds) onBoundsChangeRef.current?.(bounds);
    };
    const idleListener = map.addListener('idle', report);
    report();
    return () => google.maps.event.removeListener(idleListener);
  }, [map]);

  return null;
}

function MapSpaceDetailCard({
  space,
  dateParam,
  onClose,
  isFavorite,
  onFavoriteClick,
}: {
  space: Space;
  dateParam?: string;
  onClose: () => void;
  isFavorite?: boolean;
  onFavoriteClick?: (spaceId: string) => void;
}) {
  const detailPath = `/space/${space.id}${dateParam ? `?date=${dateParam}` : ''}`;
  const bookingPath = `${detailPath}#booking`;
  const handleClosePopup = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  }, [onClose]);
  const handleFavoriteClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onFavoriteClick?.(space.id);
  }, [onFavoriteClick, space.id]);

  return (
    <div
      className="pointer-events-auto"
      style={{ width: MAP_POPUP_WIDTH_PX }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className="bg-white rounded-2xl border border-[#f2ddce] shadow-xl overflow-hidden"
        style={{ width: MAP_POPUP_LAYOUT_WIDTH_PX, zoom: MAP_POPUP_ZOOM }}
      >
        <div className="relative aspect-[3/2] overflow-hidden bg-brand-100">
          <Link to={detailPath} className="block absolute inset-0 hover:opacity-95 transition-opacity">
            <ImageWithFallback
              src={space.images?.[0] ?? space.image ?? ''}
              alt={space.title}
              className="w-full h-full object-cover"
            />
          </Link>
          <div className="absolute bottom-2 left-2 bg-[#38291a] text-[#e6e2df] px-2.5 py-0.5 rounded-full shadow-lg pointer-events-none">
            <span className="text-base font-semibold">${space.price}</span>
            <span className="text-[10px] opacity-90 ml-0.5">/ hr</span>
          </div>
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5">
            {onFavoriteClick && (
              <button
                type="button"
                onClick={handleFavoriteClick}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                  isFavorite
                    ? 'bg-red-500/90 text-white backdrop-blur-md shadow-lg'
                    : 'bg-white/20 hover:bg-white/40 backdrop-blur-md text-white hover:scale-110'
                }`}
                aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Heart
                  className={`w-4 h-4 ${isFavorite ? 'fill-current' : 'fill-none'} hover:fill-red-500 hover:text-red-500 transition-colors`}
                />
              </button>
            )}
            <button
              type="button"
              onClick={handleClosePopup}
              className="w-7 h-7 rounded-full bg-white/90 hover:bg-white border border-[#f2ddce] flex items-center justify-center text-[#38291a] shadow-md transition-colors"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="p-3">
          <Link to={detailPath} className="block hover:opacity-90 transition-opacity">
            <div className="flex items-center justify-between mb-1.5 gap-2">
              <p className="text-xs text-[#896849] line-clamp-1">{space.location}</p>
              <div className="flex items-center gap-1 bg-[#f2ddce] px-1.5 py-0.5 rounded-full shrink-0">
                <Star className="w-3.5 h-3.5 fill-[#896849] text-[#896849]" />
                <span className="text-xs text-[#38291a] font-medium">{formatRatingScore(space.rating)}</span>
                <span className="text-[10px] text-[#896849]">({space.reviews})</span>
              </div>
            </div>
            <h3 className="text-base font-bold text-[#38291a] mb-0.5 line-clamp-1">{space.title}</h3>
            <p className="text-[10px] text-[#896849] mb-2">{space.category}</p>
          </Link>
          <div className="border-t border-[#f2ddce] my-2" />
          <div className="flex items-center gap-3 mb-2.5 text-[#5f4731]">
            <div className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              <span className="text-[10px]">{space.capacity} guests</span>
            </div>
            <div className="flex items-center gap-1">
              <Square className="w-3.5 h-3.5" />
              <span className="text-[10px]">
                {space.squareMeters != null ? `${space.squareMeters} m²` : '— m²'}
              </span>
            </div>
          </div>
          <Link
            to={bookingPath}
            className="inline-block w-full px-3 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold text-[10px] rounded-lg transition-all shadow-md shadow-brand-500/20 active:translate-y-0.5 text-center"
          >
            Book Now
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Render the popup in the clipped map layer so it hides beyond the edges.
 * Pan once on open; then only reposition it with the marker.
 */
function SelectedMapPopup({
  space,
  dateParam,
  onClose,
  popupHostRef,
  isFavorite,
  onFavoriteClick,
}: {
  space: Space & { latitude: number; longitude: number };
  dateParam?: string;
  onClose: () => void;
  popupHostRef: React.RefObject<HTMLDivElement | null>;
  isFavorite?: boolean;
  onFavoriteClick?: (spaceId: string) => void;
}) {
  const map = useGoogleMap();
  const cardRef = useRef<HTMLDivElement>(null);
  const placementRef = useRef<MapPopupPlacement>('south');
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    setPosition(null);
  }, [space.id]);

  const applyPopupLayout = useCallback(
    (pickPlacement: boolean) => {
      const host = popupHostRef.current;
      if (!map || !host) return false;

      const point = latLngToHostPoint(map, host, {
        lat: space.latitude,
        lng: space.longitude,
      });
      if (!point) return false;

      const mapSize = getHostMapBounds(host);
      const height = measurePopupHeight(cardRef.current);
      const placement = pickPlacement
        ? choosePopupPlacement(point, mapSize, MAP_POPUP_WIDTH_PX, height)
        : placementRef.current;
      if (pickPlacement) {
        placementRef.current = placement;
      }

      setPosition(computePopupScreenPosition(point, placement, MAP_POPUP_WIDTH_PX, height));
      return true;
    },
    [map, popupHostRef, space.latitude, space.longitude]
  );

  /** Pan at most a few times on bubble click; never during user drag. */
  useEffect(() => {
    const host = popupHostRef.current;
    if (!map || !host) return;

    let cancelled = false;

    const fitPopupInView = async () => {
      await waitForMapProjection(map);

      for (let attempt = 0; attempt < 8; attempt += 1) {
        if (cancelled) return;
        await new Promise<void>((resolve) => {
          window.requestAnimationFrame(() => resolve());
        });

        if (!applyPopupLayout(true)) {
          await waitForMapIdle(map);
          continue;
        }

        const point = latLngToHostPoint(map, host, {
          lat: space.latitude,
          lng: space.longitude,
        });
        if (!point) {
          await waitForMapIdle(map);
          continue;
        }

        const mapSize = getHostMapBounds(host);
        const height = measurePopupHeight(cardRef.current);
        const placement = placementRef.current;
        const rect = popupViewportRect(point, placement, MAP_POPUP_WIDTH_PX, height);
        if (!popupNeedsPan(rect, mapSize.width, mapSize.height)) {
          return;
        }

        panByToFitPopup(map, rect);
        await waitForMapIdle(map);
      }
    };

    fitPopupInView();
    return () => {
      cancelled = true;
    };
  }, [map, popupHostRef, space.id, space.latitude, space.longitude, applyPopupLayout]);

  /** Keep the card anchored to the marker when the user pans/zooms. */
  useEffect(() => {
    if (!map || !popupHostRef.current || !position) return;

    const sync = () => applyPopupLayout(false);
    const idleListener = map.addListener('idle', sync);

    let resizeObserver: ResizeObserver | undefined;
    const attachResizeObserver = () => {
      const el = cardRef.current;
      if (!el || resizeObserver) return;
      resizeObserver = new ResizeObserver(sync);
      resizeObserver.observe(el);
    };
    attachResizeObserver();
    const resizeTimer = window.setTimeout(attachResizeObserver, 0);

    return () => {
      google.maps.event.removeListener(idleListener);
      window.clearTimeout(resizeTimer);
      resizeObserver?.disconnect();
    };
  }, [map, popupHostRef, space.id, position, applyPopupLayout]);

  /** Retry layout when projection becomes available after a failed first open. */
  useEffect(() => {
    if (!map || !popupHostRef.current || position) return;

    const listener = map.addListener('idle', () => {
      if (applyPopupLayout(true)) {
        google.maps.event.removeListener(listener);
      }
    });

    return () => google.maps.event.removeListener(listener);
  }, [map, popupHostRef, position, applyPopupLayout]);

  const host = popupHostRef.current;
  if (!host) return null;

  return createPortal(
    <div
      ref={cardRef}
      className="pointer-events-auto"
      style={{
        position: 'absolute',
        left: position?.left ?? 0,
        top: position?.top ?? 0,
        width: MAP_POPUP_WIDTH_PX,
        zIndex: 30,
        visibility: position ? 'visible' : 'hidden',
        pointerEvents: position ? 'auto' : 'none',
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <MapSpaceDetailCard
        space={space}
        dateParam={dateParam}
        onClose={onClose}
        isFavorite={isFavorite}
        onFavoriteClick={onFavoriteClick}
      />
    </div>,
    host
  );
}

export function SpacesMap({
  spaces,
  center,
  initialCenter,
  initialZoom,
  dateParam,
  className = '',
  onBoundsChange,
  favoriteIds,
  onFavoriteClick,
}: {
  spaces: Space[];
  center?: LatLng | null;
  initialCenter?: LatLng | null;
  initialZoom?: number;
  dateParam?: string;
  className?: string;
  onBoundsChange?: (bounds: MapBounds) => void;
  favoriteIds?: Set<string>;
  onFavoriteClick?: (spaceId: string) => void;
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: API_KEY,
  });

  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapClipRef = useRef<HTMLDivElement>(null);
  const lastMarkerClickAtRef = useRef(0);

  const handleMarkerClick = useCallback((space: Space) => {
    lastMarkerClickAtRef.current = Date.now();
    setSelectedSpace(space);
  }, []);

  const handleMapClick = useCallback(() => {
    if (Date.now() - lastMarkerClickAtRef.current < 400) return;
    setSelectedSpace(null);
  }, []);

  const withCoords = useMemo(
    () => spaces.filter((s): s is Space & { latitude: number; longitude: number } =>
      s.latitude != null && s.longitude != null
    ),
    [spaces]
  );

  useEffect(() => {
    if (selectedSpace && !withCoords.some((s) => s.id === selectedSpace.id)) {
      setSelectedSpace(null);
    }
  }, [withCoords, selectedSpace]);

  const mapCenter = useMemo((): LatLng => {
    if (initialCenter) return initialCenter;
    if (center) return center;
    return WORLD_DEFAULT_CENTER;
  }, [initialCenter, center]);

  const mapZoom = initialZoom ?? (initialCenter || center ? 12 : WORLD_DEFAULT_ZOOM);

  const cameraKey = initialCenter
    ? `${initialCenter.lat},${initialCenter.lng},${mapZoom}`
    : 'default';

  if (!API_KEY) {
    return (
      <div className={`bg-brand-100 rounded-[3rem] border-2 border-brand-200 flex items-center justify-center ${className}`}>
        <p className="text-brand-500 font-medium text-center px-4">Map unavailable. Add <code className="bg-brand-200 px-1 rounded">VITE_GOOGLE_MAPS_API_KEY</code> to your .env to enable.</p>
      </div>
    );
  }
  if (loadError) {
    return (
      <div className={`bg-brand-100 rounded-[3rem] border-2 border-brand-200 flex items-center justify-center ${className}`}>
        <p className="text-brand-500 font-medium">Failed to load map.</p>
      </div>
    );
  }
  if (!isLoaded) {
    return (
      <div className={`bg-brand-100 rounded-[3rem] border-2 border-brand-200 flex items-center justify-center ${className}`}>
        <p className="text-brand-500 font-medium">Loading map...</p>
      </div>
    );
  }

  return (
    <div ref={mapContainerRef} className={`relative rounded-2xl border border-brand-200 ${className}`}>
      <div ref={mapClipRef} className="absolute inset-0 overflow-hidden rounded-2xl isolate">
        <GoogleMap
          key={cameraKey}
          mapContainerStyle={{ width: '100%', height: '100%', position: 'relative' }}
          center={mapCenter}
          zoom={mapZoom}
          onClick={handleMapClick}
          options={{
            disableDefaultUI: false,
            zoomControl: true,
            streetViewControl: false,
            clickableIcons: false,
            zoomControlOptions: {
              position: google.maps.ControlPosition.RIGHT_CENTER,
            },
            styles: MAP_STYLE_MUTED,
            gestureHandling: 'greedy',
          }}
        >
          <MapProjectionWarmup />
          <MapBoundsReporter onBoundsChange={onBoundsChange} />
          <SpacesMapMarkers spaces={withCoords} onMarkerClick={handleMarkerClick} />
          {selectedSpace?.latitude != null && selectedSpace?.longitude != null && (
            <SelectedMapPopup
              space={selectedSpace as Space & { latitude: number; longitude: number }}
              dateParam={dateParam}
              onClose={() => setSelectedSpace(null)}
              popupHostRef={mapClipRef}
              isFavorite={favoriteIds?.has(selectedSpace.id)}
              onFavoriteClick={onFavoriteClick}
            />
          )}
        </GoogleMap>
      </div>
    </div>
  );
}
