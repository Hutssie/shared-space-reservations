import { X, Star, Users, Bed, Bath } from 'lucide-react';
import type { Listing } from './MapSearch';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface ListingPopupProps {
  listing: Listing;
  onClose: () => void;
}

export function ListingPopup({ listing, onClose }: ListingPopupProps) {
  return (
    <>
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/20 z-[1000]"
        onClick={onClose}
      />
      
      {/* Popup Card */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1001] w-full max-w-md mx-4">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border-2 border-[#f2ddce]">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-md transition-all hover:scale-110"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-[#38291a]" />
          </button>

          {/* Image */}
          <div className="relative h-64 overflow-hidden">
            <ImageWithFallback
              src={listing.image}
              alt={listing.title}
              className="w-full h-full object-cover"
            />
            
            {/* Price Badge */}
            <div className="absolute bottom-4 left-4 bg-[#38291a] text-[#e6e2df] px-4 py-2 rounded-full shadow-lg">
              <span className="text-2xl font-semibold">${listing.price}</span>
              <span className="text-sm opacity-90 ml-1">/ night</span>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Location & Type */}
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-[#896849]">{listing.location}</p>
              <div className="flex items-center gap-1 bg-[#f2ddce] px-2 py-1 rounded-full">
                <Star className="w-4 h-4 fill-[#896849] text-[#896849]" />
                <span className="text-sm text-[#38291a]">{listing.rating}</span>
                <span className="text-xs text-[#896849]">({listing.reviews})</span>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-2xl text-[#38291a] mb-1">
              {listing.title}
            </h2>

            {/* Type */}
            <p className="text-sm text-[#896849] mb-4">{listing.type}</p>

            {/* Divider */}
            <div className="border-t border-[#f2ddce] my-4" />

            {/* Property Details */}
            <div className="flex items-center gap-6 mb-6">
              <div className="flex items-center gap-2 text-[#5f4731]">
                <Users className="w-5 h-5" />
                <span className="text-sm">{listing.guests} guests</span>
              </div>
              <div className="flex items-center gap-2 text-[#5f4731]">
                <Bed className="w-5 h-5" />
                <span className="text-sm">{listing.beds} beds</span>
              </div>
              <div className="flex items-center gap-2 text-[#5f4731]">
                <Bath className="w-5 h-5" />
                <span className="text-sm">{listing.baths} baths</span>
              </div>
            </div>

            {/* CTA Button */}
            <button className="w-full bg-[#896849] hover:bg-[#5f4731] text-[#e6e2df] py-3 rounded-xl transition-colors shadow-md hover:shadow-lg">
              Reserve
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
