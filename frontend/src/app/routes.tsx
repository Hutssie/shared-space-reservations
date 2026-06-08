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
import { VerifyEmail } from "./components/VerifyEmail";
import { NewsletterSubscribe } from "./components/NewsletterSubscribe";
import { Onboarding } from "./components/Onboarding";
import { EarningEstimator } from "./components/EarningEstimator";
import { SpaceDetails } from "./components/SpaceDetails";
import { BookingCheckout } from "./components/BookingCheckout";
import { BookingConfirmation } from "./components/BookingConfirmation";
import { Dashboard } from "./components/Dashboard";
import { HostPortal } from "./components/HostPortal";
import { ManageListings } from "./components/ManageListings";
import { EditSpace } from "./components/EditSpace";
import { ListingBookings } from "./components/ListingBookings";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import { Admin } from "./components/Admin";
import { AISearchModal } from "./components/AISearchModal";
import { NavigationBridge } from "./components/NavigationBridge";
import { useUnreadBookings } from "./contexts/UnreadBookingsContext";

const MainLayout = () => {
  const [isAIModalOpen, setIsAIModalOpen] = React.useState(false);
  const location = useLocation();
  const isAuthPage = location.pathname.startsWith('/auth/');
  const { clearNewestBooking } = useUnreadBookings();
  const prevPathRef = useRef(location.pathname);

  // sterge badge-ul NEW cand utilizatorul pleaca din dashboard
  useEffect(() => {
    if (prevPathRef.current === '/dashboard' && location.pathname !== '/dashboard') {
      clearNewestBooking();
    }
    prevPathRef.current = location.pathname;
  }, [location.pathname, clearNewestBooking]);

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-brand-200 selection:text-brand-700">
      <NavigationBridge />
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
    <section className="py-20 bg-brand-100/30 overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-brand-500 rounded-[2.5rem] p-10 lg:p-16 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-1/2 h-full hidden lg:block overflow-hidden pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-brand-200/10 rounded-full blur-[120px] group-hover:bg-brand-200/20 transition-all duration-700" />
          </div>
          
          <div className="relative z-10 max-w-xl">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-6 tracking-tight leading-tight">
              Have an empty studio <br />
              <span className="text-brand-200 underline decoration-brand-200 underline-offset-6">earning nothing?</span>
            </h2>
            <p className="text-brand-100/80 text-base md:text-lg font-medium mb-10 leading-relaxed">
              Join thousands of hosts worldwide and start earning extra income by listing your creative space on SpaceBook. It's free to list and easy to manage.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link 
                to="/list-your-space"
                className="px-8 py-3.5 bg-brand-200 hover:bg-white text-brand-700 font-black text-base rounded-2xl transition-all shadow-xl shadow-black/10 active:scale-95 cursor-pointer text-center"
              >
                Start Listing Today
              </Link>
              <Link 
                to="/earnings-calculator"
                className="px-8 py-3.5 border-2 border-white/30 hover:border-white text-white font-black text-base rounded-2xl transition-all active:scale-95 cursor-pointer text-center"
              >
                See How Much You Can Earn
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
    <HowItWorks />
    <NewsletterSubscribe />
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
        path: "space/:id/checkout",
        element: (
          <ProtectedRoute>
            <BookingCheckout />
          </ProtectedRoute>
        ),
      },
      {
        path: "space/:id/confirmation",
        element: (
          <ProtectedRoute>
            <BookingConfirmation />
          </ProtectedRoute>
        ),
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
        path: "auth/verify-email",
        element: <VerifyEmail />,
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
