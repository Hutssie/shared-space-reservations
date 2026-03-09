import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ListingPopup } from './ListingPopup';

export interface Listing {
  id: number;
  price: number;
  title: string;
  type: string;
  rating: number;
  reviews: number;
  image: string;
  location: string;
  position: [number, number];
  beds: number;
  baths: number;
  guests: number;
}

const mockListings: Listing[] = [
  {
    id: 1,
    price: 189,
    title: 'Modern Downtown Apartment',
    type: 'Entire apartment',
    rating: 4.9,
    reviews: 124,
    image: 'https://images.unsplash.com/photo-1594873604892-b599f847e859?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBhcGFydG1lbnQlMjBpbnRlcmlvcnxlbnwxfHx8fDE3NzE5MTEyODF8MA&ixlib=rb-4.1.0&q=80&w=1080',
    location: 'Downtown',
    position: [40.7589, -73.9851],
    beds: 2,
    baths: 1,
    guests: 4,
  },
  {
    id: 2,
    price: 235,
    title: 'Cozy Rustic Bedroom Retreat',
    type: 'Private room',
    rating: 4.8,
    reviews: 89,
    image: 'https://images.unsplash.com/photo-1617527042202-e588d3decc60?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb3p5JTIwYmVkcm9vbSUyMHJ1c3RpY3xlbnwxfHx8fDE3NzE5MTgzNzh8MA&ixlib=rb-4.1.0&q=80&w=1080',
    location: 'Midtown West',
    position: [40.7614, -73.9776],
    beds: 1,
    baths: 1,
    guests: 2,
  },
  {
    id: 3,
    price: 450,
    title: 'Luxury Villa with Pool',
    type: 'Entire villa',
    rating: 5.0,
    reviews: 203,
    image: 'https://images.unsplash.com/photo-1694967832949-09984640b143?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjB2aWxsYSUyMHBvb2x8ZW58MXx8fHwxNzcxOTEyNTQ3fDA&ixlib=rb-4.1.0&q=80&w=1080',
    location: 'Upper East Side',
    position: [40.7736, -73.9566],
    beds: 4,
    baths: 3,
    guests: 8,
  },
  {
    id: 4,
    price: 165,
    title: 'Minimalist Studio',
    type: 'Entire studio',
    rating: 4.7,
    reviews: 67,
    image: 'https://images.unsplash.com/photo-1769733336073-7ddbeb680a60?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtaW5pbWFsaXN0JTIwc3R1ZGlvJTIwYXBhcnRtZW50fGVufDF8fHx8MTc3MTg0MTYyN3ww&ixlib=rb-4.1.0&q=80&w=1080',
    location: 'Chelsea',
    position: [40.7465, -74.0014],
    beds: 1,
    baths: 1,
    guests: 2,
  },
  {
    id: 5,
    price: 320,
    title: 'Urban Loft with City Views',
    type: 'Entire loft',
    rating: 4.9,
    reviews: 156,
    image: 'https://images.unsplash.com/photo-1662379940109-1026a0dcfe95?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx1cmJhbiUyMGxvZnQlMjBsaXZpbmclMjByb29tfGVufDF8fHx8MTc3MTkxODM3OXww&ixlib=rb-4.1.0&q=80&w=1080',
    location: 'SoHo',
    position: [40.7233, -74.0030],
    beds: 3,
    baths: 2,
    guests: 6,
  },
  {
    id: 6,
    price: 199,
    title: 'Charming East Village Flat',
    type: 'Entire apartment',
    rating: 4.8,
    reviews: 98,
    image: 'https://images.unsplash.com/photo-1594873604892-b599f847e859?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBhcGFydG1lbnQlMjBpbnRlcmlvcnxlbnwxfHx8fDE3NzE5MTEyODF8MA&ixlib=rb-4.1.0&q=80&w=1080',
    location: 'East Village',
    position: [40.7264, -73.9818],
    beds: 2,
    baths: 1,
    guests: 4,
  },
];

export function MapSearch() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<number, L.Marker>>(new Map());
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [hoveredListingId, setHoveredListingId] = useState<number | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Create map
    const map = L.map(mapRef.current).setView([40.7589, -73.9851], 13);

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    mapInstanceRef.current = map;

    // Fit bounds to show all markers
    const bounds = mockListings.map(listing => listing.position) as L.LatLngExpression[];
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Create marker icon
  const createMarkerIcon = (listing: Listing, isHovered: boolean, isSelected: boolean) => {
    const className = isSelected
      ? 'bg-[#38291a] border-[#38291a] text-[#e6e2df] shadow-lg'
      : isHovered
      ? 'bg-[#5f4731] border-[#5f4731] text-[#e6e2df] shadow-md'
      : 'bg-white border-[#b58b62] text-[#38291a] shadow-sm';

    return L.divIcon({
      html: `
        <div class="px-3 py-1.5 rounded-full transition-all duration-200 cursor-pointer border-2 ${className}"
             style="font-family: Inter, sans-serif; font-size: 14px; font-weight: 600; white-space: nowrap;">
          $${listing.price}
        </div>
      `,
      className: 'price-marker-container',
      iconSize: undefined,
      iconAnchor: [0, 0],
    });
  };

  // Add/update markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    mockListings.forEach((listing) => {
      const isHovered = hoveredListingId === listing.id;
      const isSelected = selectedListing?.id === listing.id;

      let marker = markersRef.current.get(listing.id);

      if (!marker) {
        // Create new marker
        marker = L.marker(listing.position, {
          icon: createMarkerIcon(listing, isHovered, isSelected),
        });

        marker.on('click', () => {
          setSelectedListing(listing);
        });

        marker.on('mouseover', () => {
          setHoveredListingId(listing.id);
        });

        marker.on('mouseout', () => {
          setHoveredListingId(null);
        });

        marker.addTo(map);
        markersRef.current.set(listing.id, marker);
      } else {
        // Update existing marker icon
        marker.setIcon(createMarkerIcon(listing, isHovered, isSelected));
      }
    });
  }, [hoveredListingId, selectedListing]);

  const handleClosePopup = () => {
    setSelectedListing(null);
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />

      {selectedListing && (
        <ListingPopup listing={selectedListing} onClose={handleClosePopup} />
      )}
    </div>
  );
}
