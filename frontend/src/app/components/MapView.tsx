import React, { useCallback, useMemo, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useJsApiLoader, GoogleMap, Marker, useGoogleMap } from '@react-google-maps/api';
import { Star, X, Users, Square } from 'lucide-react';
import type { Space } from '../api/spaces';
import { formatRatingScore } from '../utils/formatRating';
import { ImageWithFallback } from './ImageWithFallback';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const DEFAULT_CENTER = { lat: 40.7128, lng: -74.006 };
const DEFAULT_ZOOM = 12;

type LatLng = { lat: number; lng: number };

const BUBBLE_WIDTH = 72;
const BUBBLE_HEIGHT = 36;

/** Iconul pin pentru harta locatiei spatiului (picatura maro). */
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

/** Stil map dezaturat/„sters”, ca sa iasa in evidenta pin-urile de pret (gen Airbnb). */
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

/** Returneaza iconul pentru un bubble de pret; la hover foloseste umplutura maro mai inchis. */
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

  // If parent doesn't control `center` yet, keep the camera on the placed pin
  // instead of snapping back to the default location on re-render.
  const mapCenter = useMemo(() => center ?? pin ?? DEFAULT_CENTER, [center, pin]);
  const zoom = useMemo(() => zoomProp ?? (pin ? 15 : DEFAULT_ZOOM), [zoomProp, pin]);
  const onMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      const lat = e.latLng?.lat();
      const lng = e.latLng?.lng();
      if (lat != null && lng != null) onPositionChange(lat, lng);
    },
    [onPositionChange]
  );
  const onDragEnd = useCallback(
    (e: google.maps.MapMouseEvent) => {
      const lat = e.latLng?.lat();
      const lng = e.latLng?.lng();
      if (lat != null && lng != null) onPositionChange(lat, lng);
    },
    [onPositionChange]
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
    <div className={`rounded-[3rem] overflow-hidden border-2 border-brand-100 ${className}`}>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%', minHeight: '400px' }}
        center={mapCenter}
        zoom={zoom}
        onClick={onMapClick}
        options={{
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          clickableIcons: false,
          zoomControlOptions: {
            position: google.maps.ControlPosition.RIGHT_CENTER,
          },
          styles: MAP_STYLE_MUTED,
        }}
      >
        {pin && (
          <Marker
            position={pin}
            draggable
            onDragEnd={onDragEnd}
          />
        )}
      </GoogleMap>
    </div>
  );
}

/** Harta statica centrata pe un singur punct pentru sectiunea de detalii „Where you'll be”. */
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
      <div className={`h-[400px] bg-brand-50 rounded-[3rem] border border-brand-100 flex items-center justify-center ${className}`}>
        <p className="text-brand-500 font-medium text-center px-4">Map unavailable. Add <code className="bg-brand-100 px-1 rounded">VITE_GOOGLE_MAPS_API_KEY</code> to your .env.</p>
      </div>
    );
  }
  if (loadError) {
    return (
      <div className={`h-[400px] bg-brand-50 rounded-[3rem] border border-brand-100 flex items-center justify-center ${className}`}>
        <p className="text-brand-500 font-medium">Failed to load map.</p>
      </div>
    );
  }
  if (!isLoaded) {
    return (
      <div className={`h-[400px] bg-brand-50 rounded-[3rem] border border-brand-100 flex items-center justify-center ${className}`}>
        <p className="text-brand-500 font-medium">Loading map...</p>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-[3rem] border border-brand-100 ${className}`}>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%', minHeight: '400px' }}
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

/** Deseneaza un singur pin pe harta folosind API-ul imperativ, ca sa fie mereu afisat. */
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

/** Deseneaza markerii ca copii ai `GoogleMap`, ca sa primeasca harta din context. */
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

/** Pan map to selected marker and leave room for the bottom detail card. */
function PanToSelectedSpace({ space }: { space: Space | null }) {
  const map = useGoogleMap();
  useEffect(() => {
    if (!map || space?.latitude == null || space?.longitude == null) return;
    map.panTo({ lat: space.latitude, lng: space.longitude });
    window.requestAnimationFrame(() => {
      map.panBy(0, -100);
    });
  }, [map, space?.id, space?.latitude, space?.longitude]);
  return null;
}

function MapSpaceDetailCard({
  space,
  dateParam,
  onClose,
}: {
  space: Space;
  dateParam?: string;
  onClose: () => void;
}) {
  const handleClosePopup = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  }, [onClose]);

  return (
    <div
      className="absolute bottom-2.5 left-2.5 right-2.5 sm:bottom-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[min(360px,calc(100%-1.25rem))] z-10 max-h-[calc(100%-1rem)] overflow-y-auto pointer-events-auto"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-white rounded-2xl border border-[#f2ddce] shadow-xl overflow-hidden">
        <Link
          to={`/space/${space.id}${dateParam ? `?date=${dateParam}` : ''}`}
          className="block hover:opacity-95 transition-opacity"
        >
          <div className="relative aspect-[16/10] overflow-hidden bg-brand-100">
            <ImageWithFallback
              src={space.images?.[0] ?? space.image ?? ''}
              alt={space.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2.5 left-2.5 sm:bottom-3 sm:left-3 bg-[#38291a] text-[#e6e2df] px-3 py-1 rounded-full shadow-lg">
              <span className="text-lg font-semibold">${space.price}</span>
              <span className="text-xs opacity-90 ml-1">/ hr</span>
            </div>
            <button
              type="button"
              onClick={handleClosePopup}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 hover:bg-white border border-[#f2ddce] flex items-center justify-center text-[#38291a] shadow-md transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </Link>
        <div className="p-3.5 sm:p-4">
          <Link
            to={`/space/${space.id}${dateParam ? `?date=${dateParam}` : ''}`}
            className="block hover:opacity-90 transition-opacity"
          >
            <div className="flex items-center justify-between mb-2 gap-2">
              <p className="text-sm text-[#896849] line-clamp-1">{space.location}</p>
              <div className="flex items-center gap-1 bg-[#f2ddce] px-2 py-1 rounded-full shrink-0">
                <Star className="w-4 h-4 fill-[#896849] text-[#896849]" />
                <span className="text-sm text-[#38291a] font-medium">{formatRatingScore(space.rating)}</span>
                <span className="text-xs text-[#896849]">({space.reviews})</span>
              </div>
            </div>
            <h3 className="text-lg font-bold text-[#38291a] mb-1 line-clamp-1">{space.title}</h3>
            <p className="text-xs text-[#896849] mb-2.5 sm:mb-3">{space.category}</p>
          </Link>
          <div className="border-t border-[#f2ddce] my-2.5 sm:my-3" />
          <div className="flex items-center gap-4 mb-3 sm:mb-4 text-[#5f4731]">
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              <span className="text-xs">{space.capacity} guests</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Square className="w-4 h-4" />
              <span className="text-xs">{space.squareMeters != null ? `${space.squareMeters} m²` : '— m²'}</span>
            </div>
          </div>
          <Link
            to={`/space/${space.id}${dateParam ? `?date=${dateParam}` : ''}#booking`}
            className="inline-block w-full px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs rounded-lg transition-all shadow-md shadow-brand-500/20 active:translate-y-0.5 text-center"
          >
            Book Now
          </Link>
        </div>
      </div>
    </div>
  );
}

export function SpacesMap({
  spaces,
  center,
  dateParam,
  className = '',
}: {
  spaces: Space[];
  center?: LatLng | null;
  dateParam?: string;
  className?: string;
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: API_KEY,
  });

  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);

  const withCoords = useMemo(
    () => spaces.filter((s): s is Space & { latitude: number; longitude: number } =>
      s.latitude != null && s.longitude != null
    ),
    [spaces]
  );

  const mapCenter = useMemo((): LatLng => {
    if (center) return center;
    if (withCoords.length > 0)
      return { lat: withCoords[0].latitude, lng: withCoords[0].longitude };
    return DEFAULT_CENTER;
  }, [center, withCoords]);

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
    <div className={`relative rounded-2xl border border-brand-200 ${className}`}>
      <div className="absolute inset-0 overflow-hidden rounded-2xl">
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={mapCenter}
          zoom={withCoords.length ? 12 : 4}
          onClick={() => setSelectedSpace(null)}
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
          <SpacesMapMarkers spaces={withCoords} onMarkerClick={setSelectedSpace} />
          <PanToSelectedSpace space={selectedSpace} />
        </GoogleMap>
      </div>
      {selectedSpace != null && (
        <MapSpaceDetailCard
          space={selectedSpace}
          dateParam={dateParam}
          onClose={() => setSelectedSpace(null)}
        />
      )}
    </div>
  );
}
