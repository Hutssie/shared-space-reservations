import React, { useEffect, useState, useCallback } from 'react';
import { SpaceCard } from './SpaceCard';
import { fetchRecommendedSpaces, fetchFeaturedSpacesThisMonth } from '../api/spaces';
import { fetchFavorites, addFavorite, removeFavorite } from '../api/favorites';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router';
import type { Space } from '../api/spaces';

export const FeaturedSpaces = () => {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const { token } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    const fetcher = token ? fetchRecommendedSpaces : fetchFeaturedSpacesThisMonth;
    fetcher()
      .then((res) => setSpaces(res.spaces))
      .catch(() => setSpaces([]))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token) {
      setFavoriteIds(new Set());
      return;
    }
    fetchFavorites()
      .then((list) => setFavoriteIds(new Set(list.map((f) => f.spaceId ?? f.id))))
      .catch(() => setFavoriteIds(new Set()));
  }, [token]);

  const handleFavoriteClick = useCallback((spaceId: string) => {
    if (!token) {
      navigate('/auth/login');
      return;
    }
    const isFav = favoriteIds.has(spaceId);
    if (isFav) {
      removeFavorite(spaceId).then(() =>
        fetchFavorites().then((list) => setFavoriteIds(new Set(list.map((f) => f.spaceId ?? f.id))))
      );
    } else {
      addFavorite(spaceId).then(() =>
        fetchFavorites().then((list) => setFavoriteIds(new Set(list.map((f) => f.spaceId ?? f.id))))
      );
    }
  }, [token, favoriteIds]);

  const title = token ? 'Recommended for you' : 'Trending this month';
  const subtitle = token
    ? 'Spaces we think you would love.'
    : 'Discover what the community is booking right now.';

  return (
    <section className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-5">
          <div className="max-w-xl">
            <h2 className="text-2xl md:text-3xl font-extrabold text-brand-700 mb-3 tracking-tight">{title}</h2>
            <p className="text-brand-500 font-medium text-base leading-relaxed">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/find')}
            className="px-6 py-3 border-2 border-brand-200 hover:border-brand-500 hover:bg-brand-500 hover:text-white text-brand-500 text-sm font-bold rounded-xl transition-all active:scale-95"
          >
            View All Spaces
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {loading ? (
            <div className="col-span-full text-center py-12 text-brand-500 font-medium">Loading...</div>
          ) : (
            spaces.map((space) => (
              <SpaceCard
                key={space.id}
                id={space.id}
                image={space.image ?? ''}
                category={space.category}
                title={space.title}
                location={space.location}
                capacity={space.capacity}
                rating={space.rating ?? 0}
                reviews={space.reviews}
                price={space.price}
                isInstantBookable={space.isInstantBookable}
                isFavorite={favoriteIds.has(space.id)}
                onFavoriteClick={handleFavoriteClick}
                compact
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
};
