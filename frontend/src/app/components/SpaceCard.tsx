import React from 'react';
import { Star, MapPin, Users, Heart, Zap } from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';
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
  compact?: boolean;
}

export const SpaceCard = ({ id, image, category, title, location, capacity, rating, reviews, price, isPopular, isInstantBookable, isFavorite, onFavoriteClick, compact = false }: SpaceProps) => {
  const [searchParams] = useSearchParams();
  const dateParam = searchParams.get('date');
  
  const topUrl = `/space/${id}${dateParam ? `?date=${dateParam}` : ''}`;
  const bookingUrl = `${topUrl}#booking`;

  return (
    <div className={`group relative bg-white overflow-hidden border border-brand-200 hover:shadow-xl hover:border-brand-400 transition-all duration-300 flex flex-col h-full ${compact ? 'rounded-2xl' : 'rounded-3xl hover:shadow-2xl'}`}>
      <Link to={topUrl} className={`relative overflow-hidden block ${compact ? 'h-44 sm:h-48' : 'h-64'}`}>
        <ImageWithFallback 
          src={image} 
          alt={title} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className={`absolute z-10 flex gap-1.5 ${compact ? 'top-3 left-3' : 'top-4 left-4 gap-2'}`}>
          <span className={`bg-brand-700/80 backdrop-blur-md text-white font-bold uppercase tracking-widest rounded-md ${compact ? 'px-2 py-1 text-[9px]' : 'px-3 py-1.5 text-[10px] rounded-lg'}`}>
            {category}
          </span>
          {isPopular && (
            <span className={`bg-brand-200 text-brand-700 font-bold uppercase tracking-widest rounded-md ${compact ? 'px-2 py-1 text-[9px]' : 'px-3 py-1.5 text-[10px] rounded-lg'}`}>
              Popular
            </span>
          )}
          {isInstantBookable && (
            <span className={`bg-brand-500 text-white font-bold uppercase tracking-widest rounded-md flex items-center gap-1 ${compact ? 'px-2 py-1 text-[9px]' : 'px-3 py-1.5 text-[10px] rounded-lg'}`}>
              <Zap className={`fill-white ${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'}`} /> Instant
            </span>
          )}
        </div>
        <button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (onFavoriteClick) onFavoriteClick(id);
          }}
          className={`absolute z-10 rounded-full flex items-center justify-center transition-all active:scale-90 ${compact ? 'top-3 right-3 w-8 h-8' : 'top-4 right-4 w-10 h-10'} ${
            isFavorite 
              ? 'bg-red-500/90 text-white backdrop-blur-md shadow-lg' 
              : 'bg-white/20 hover:bg-white/40 backdrop-blur-md text-white hover:scale-110'
          }`}
        >
          <Heart className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} ${isFavorite ? 'fill-current' : 'fill-none'} hover:fill-red-500 hover:text-red-500 transition-colors`} />
        </button>
      </Link>

      <div className={`flex-1 flex flex-col ${compact ? 'p-4' : 'p-6'}`}>
        <div className="flex items-center justify-between mb-1.5 gap-2">
          <div className="flex items-center gap-1 min-w-0">
            <MapPin className={`text-brand-400 shrink-0 ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
            <span className={`font-medium text-brand-500 truncate ${compact ? 'text-xs' : 'text-sm'}`}>{location}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Star className={`text-brand-400 fill-brand-400 ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
            <span className={`font-bold text-brand-700 ${compact ? 'text-xs' : 'text-sm'}`}>{typeof rating === 'number' ? formatRatingScore(rating) : rating}</span>
            <span className={`text-brand-400 font-medium ${compact ? 'text-xs' : 'text-sm'}`}>({reviews})</span>
          </div>
        </div>

        <Link to={topUrl} className={`block ${compact ? 'mb-2.5' : 'mb-4'}`}>
          <h3 className={`font-bold text-brand-700 line-clamp-1 group-hover:text-brand-500 transition-colors ${compact ? 'text-base' : 'text-lg'}`}>{title}</h3>
        </Link>

        <div className={`flex items-center gap-4 ${compact ? 'mb-3' : 'mb-6'}`}>
          <div className={`flex items-center gap-1.5 bg-brand-100 rounded-lg ${compact ? 'px-2 py-1' : 'px-3 py-1.5'}`}>
            <Users className={`text-brand-500 ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
            <span className="text-xs font-bold text-brand-700">Up to {capacity} ppl</span>
          </div>
        </div>

        <div className={`mt-auto flex items-end justify-between border-t border-brand-100 ${compact ? 'pt-3' : 'pt-4'}`}>
          <div>
            <span className={`font-black text-brand-700 ${compact ? 'text-xl' : 'text-2xl'}`}>${price}</span>
            <span className={`font-medium text-brand-400 ${compact ? 'text-xs' : 'text-sm'}`}> / hr</span>
          </div>
          <Link to={bookingUrl} className={`bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-lg transition-all shadow-md shadow-brand-500/20 active:translate-y-0.5 ${compact ? 'px-3.5 py-2 text-xs' : 'px-5 py-2.5 text-sm rounded-xl shadow-lg'}`}>
            Book Now
          </Link>
        </div>
      </div>
    </div>
  );
};
