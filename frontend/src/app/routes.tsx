import { createBrowserRouter, Outlet, Link, useLocation } from "react-router";
import React, { useEffect, useRef } from 'react';
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { Hero } from "./components/Hero";
import { ScrollToTop } from "./components/ScrollToTop";
import { Categories } from "./components/Categories";
import { FeaturedSpaces } from "./components/FeaturedSpaces";
import { HowItWorks } from "./components/HowItWorks";
import { FindSpace } from "./components/FindSpace";
import { ListSpace } from "./components/ListSpace";
import { Auth } from "./components/Auth";
import { ResetPassword } from "./components/ResetPassword";
import { Onboarding } from "./components/Onboarding";
import { EarningEstimator } from "./components/EarningEstimator";
import { SpaceDetails } from "./components/SpaceDetails";
import { Dashboard } from "./components/Dashboard";
import { HostPortal } from "./components/HostPortal";
import { ManageListings } from "./components/ManageListings";
import { EditSpace } from "./components/EditSpace";
import { ListingBookings } from "./components/ListingBookings";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import { Admin } from "./components/Admin";
import { AISearchModal } from "./components/AISearchModal";
import { useUnreadBookings } from "./contexts/UnreadBookingsContext";

const MainLayout = () => {
  const [isAIModalOpen, setIsAIModalOpen] = React.useState(false);
  const location = useLocation();
  const isAuthPage = location.pathname.startsWith('/auth/');
  const { clearNewestBooking } = useUnreadBookings();
  const prevPathRef = useRef(location.pathname);

  // Clear NEW booking badge when user navigates away from /dashboard (e.g. to Find a space)
  useEffect(() => {
    if (prevPathRef.current === '/dashboard' && location.pathname !== '/dashboard') {
      clearNewestBooking();
    }
    prevPathRef.current = location.pathname;
  }, [location.pathname, clearNewestBooking]);

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-brand-200 selection:text-brand-700">
      <ScrollToTop />
      {!isAuthPage && <Navbar onOpenAI={() => setIsAIModalOpen(true)} />}
      <main>
        <Outlet />
      </main>
      {!isAuthPage && <Footer />}
      {!isAuthPage && <AISearchModal isOpen={isAIModalOpen} onClose={() => setIsAIModalOpen(false)} />}
    </div>
  );
};

const HomePage = () => (
  <>
    <Hero />
    <Categories />
    <FeaturedSpaces />
    <section className="py-24 bg-brand-100/30 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-brand-500 rounded-[3rem] p-12 lg:p-24 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-1/2 h-full hidden lg:block overflow-hidden pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-200/10 rounded-full blur-[120px] group-hover:bg-brand-200/20 transition-all duration-700" />
          </div>
          
          <div className="relative z-10 max-w-2xl">
            <h2 className="text-3xl md:text-5xl font-black text-white mb-8 tracking-tight leading-tight">
              Have an empty studio <br />
              <span className="text-brand-200 underline decoration-brand-200 underline-offset-8">earning nothing?</span>
            </h2>
            <p className="text-brand-100/80 text-lg md:text-xl font-medium mb-12 leading-relaxed">
              Join thousands of hosts worldwide and start earning extra income by listing your creative space on SpaceBook. It's free to list and easy to manage.
            </p>
            <div className="flex flex-col sm:flex-row gap-6">
              <Link 
                to="/list-your-space"
                className="px-10 py-4.5 bg-brand-200 hover:bg-white text-brand-700 font-black text-lg rounded-2xl transition-all shadow-xl shadow-black/10 active:scale-95 cursor-pointer text-center"
              >
                Start Listing Today
              </Link>
              <Link 
                to="/earnings-calculator"
                className="px-10 py-4.5 border-2 border-white/30 hover:border-white text-white font-black text-lg rounded-2xl transition-all active:scale-95 cursor-pointer text-center"
              >
                See How Much You Can Earn
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
    <HowItWorks />
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-12 border-2 border-brand-100 rounded-[3rem] p-12 hover:border-brand-300 transition-all duration-500 shadow-sm hover:shadow-2xl">
          <div className="text-center md:text-left">
            <h3 className="text-3xl font-black text-brand-700 mb-4">Stay in the loop</h3>
            <p className="text-brand-500 font-medium text-lg">Subscribe to get notified about new unique spaces and exclusive offers.</p>
          </div>
          <div className="w-full md:max-w-md flex flex-col sm:flex-row gap-4">
            <input 
              type="email" 
              placeholder="Enter your email" 
              className="flex-1 px-6 py-4 bg-brand-100 border-none rounded-2xl focus:ring-2 focus:ring-brand-400 focus:outline-none text-brand-700 font-medium text-lg placeholder:text-brand-400/70"
            />
            <button className="px-8 py-4 bg-brand-700 hover:bg-brand-600 text-white font-black text-lg rounded-2xl transition-all active:scale-95 shadow-lg shadow-brand-700/20 cursor-pointer">
              Subscribe
            </button>
          </div>
        </div>
      </div>
    </section>
  </>
);

export const router = createBrowserRouter([
  {
    path: "/",
    Component: MainLayout,
    children: [
      {
        index: true,
        Component: HomePage,
      },
      {
        path: "find",
        Component: FindSpace,
      },
      {
        path: "space/:id",
        Component: SpaceDetails,
      },
      {
        path: "list-your-space",
        element: (
          <ProtectedRoute>
            <ListSpace />
          </ProtectedRoute>
        ),
      },
      {
        path: "earnings-calculator",
        Component: EarningEstimator,
      },
      {
        path: "dashboard",
        element: (
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "host",
        element: (
          <ProtectedRoute>
            <HostPortal />
          </ProtectedRoute>
        ),
      },
      {
        path: "host/manage-listings",
        element: (
          <ProtectedRoute>
            <ManageListings />
          </ProtectedRoute>
        ),
      },
      {
        path: "host/manage-listings/edit/:id",
        element: (
          <ProtectedRoute>
            <EditSpace />
          </ProtectedRoute>
        ),
      },
      {
        path: "host/manage-listings/:id/bookings",
        element: (
          <ProtectedRoute>
            <ListingBookings />
          </ProtectedRoute>
        ),
      },
      {
        path: "auth/login",
        element: <Auth initialMode="login" />,
      },
      {
        path: "auth/register",
        element: <Auth initialMode="register" />,
      },
      {
        path: "auth/reset-password",
        element: <ResetPassword />,
      },
      {
        path: "auth/onboarding",
        element: (
          <ProtectedRoute>
            <Onboarding />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin",
        element: (
          <AdminRoute>
            <Admin />
          </AdminRoute>
        ),
      },
    ],
  },
]);
