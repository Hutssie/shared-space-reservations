import React from 'react';
import { Star, MapPin, Users, Heart, Zap } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { formatRatingScore } from '../utils/formatRating';
import { Link, useSearchParams } from 'react-router';

interface SpaceProps {
  id: string;
  image: string;
  category: string;
  title: string;
  location: string;
  capacity: number;
  rating: number;
  reviews: number;
  price: number;
  isPopular?: boolean;
  isInstantBookable?: boolean;
  isFavorite?: boolean;
  onFavoriteClick?: (spaceId: string) => void;
}

export const SpaceCard = ({ id, image, category, title, location, capacity, rating, reviews, price, isPopular, isInstantBookable, isFavorite, onFavoriteClick }: SpaceProps) => {
  const [searchParams] = useSearchParams();
  const dateParam = searchParams.get('date');
  
  const topUrl = `/space/${id}${dateParam ? `?date=${dateParam}` : ''}`;
  const bookingUrl = `${topUrl}#booking`;

  return (
    <div className="group relative bg-white rounded-3xl overflow-hidden border border-brand-200 hover:shadow-2xl hover:border-brand-400 transition-all duration-300 flex flex-col h-full">
      <Link to={topUrl} className="relative h-64 overflow-hidden block">
        <ImageWithFallback 
          src={image} 
          alt={title} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          <span className="px-3 py-1.5 bg-brand-700/80 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-widest rounded-lg">
            {category}
          </span>
          {isPopular && (
            <span className="px-3 py-1.5 bg-brand-200 text-brand-700 text-[10px] font-bold uppercase tracking-widest rounded-lg">
              Popular
            </span>
          )}
          {isInstantBookable && (
            <span className="px-3 py-1.5 bg-brand-500 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg flex items-center gap-1">
              <Zap className="w-3 h-3 fill-white" /> Instant
            </span>
          )}
        </div>
        <button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (onFavoriteClick) onFavoriteClick(id);
          }}
          className={`absolute top-4 right-4 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 ${
            isFavorite 
              ? 'bg-red-500/90 text-white backdrop-blur-md shadow-lg' 
              : 'bg-white/20 hover:bg-white/40 backdrop-blur-md text-white hover:scale-110'
          }`}
        >
          <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : 'fill-none'} hover:fill-red-500 hover:text-red-500 transition-colors`} />
        </button>
      </Link>

      <div className="p-6 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1">
            <MapPin className="w-4 h-4 text-brand-400" />
            <span className="text-sm font-medium text-brand-500">{location}</span>
          </div>
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-brand-400 fill-brand-400" />
            <span className="text-sm font-bold text-brand-700">{typeof rating === 'number' ? formatRatingScore(rating) : rating}</span>
            <span className="text-sm text-brand-400 font-medium">({reviews})</span>
          </div>
        </div>

        <Link to={topUrl} className="block mb-4">
          <h3 className="text-lg font-bold text-brand-700 line-clamp-1 group-hover:text-brand-500 transition-colors">{title}</h3>
        </Link>

        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-100 rounded-lg">
            <Users className="w-4 h-4 text-brand-500" />
            <span className="text-xs font-bold text-brand-700">Up to {capacity} ppl</span>
          </div>
        </div>

        <div className="mt-auto flex items-end justify-between border-t border-brand-100 pt-4">
          <div>
            <span className="text-2xl font-black text-brand-700">${price}</span>
            <span className="text-sm font-medium text-brand-400"> / hr</span>
          </div>
          <Link to={bookingUrl} className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-brand-500/20 active:translate-y-0.5">
            Book Now
          </Link>
        </div>
      </div>
    </div>
  );
};
