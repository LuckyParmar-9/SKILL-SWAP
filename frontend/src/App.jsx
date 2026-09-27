import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import CallModal from "./components/CallModal";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import RegisterExpert from "./pages/RegisterExpert";
import Profile from "./pages/Profile";
import Dashboard from "./pages/Dashboard";
import Search from "./pages/Search";
import ProviderProfile from "./pages/ProviderProfile";
import Matches from "./pages/Matches";
import Exchanges from "./pages/Exchanges";
import ExchangeDetail from "./pages/ExchangeDetail";
import PaidProviders from "./pages/PaidProviders";
import PaidListingDetail from "./pages/PaidListingDetail";
import MyPaidListings from "./pages/MyPaidListings";
import ProviderRequests from "./pages/ProviderRequests";
import MyLearning from "./pages/MyLearning";
import Booking from "./pages/Booking";
import Messages from "./pages/Messages";
import AdminDashboard from "./pages/AdminDashboard";
import BookingPay from "./pages/BookingPay";
import AdminUserProfile from "./pages/AdminUserProfile";

function App() {
  return (
    <>
      <Navbar />
      <CallModal />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/register-expert" element={<RegisterExpert />} />

        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
        <Route path="/provider/:id" element={<ProtectedRoute><ProviderProfile /></ProtectedRoute>} />
        <Route path="/matches" element={<ProtectedRoute><Matches /></ProtectedRoute>} />

        <Route path="/exchanges" element={<ProtectedRoute><Exchanges /></ProtectedRoute>} />
        <Route path="/exchanges/:id" element={<ProtectedRoute><ExchangeDetail /></ProtectedRoute>} />

        <Route path="/paid-providers" element={<ProtectedRoute><PaidProviders /></ProtectedRoute>} />
        <Route path="/paid-listings/:id" element={<ProtectedRoute><PaidListingDetail /></ProtectedRoute>} />
        <Route path="/my-paid-listings" element={<ProtectedRoute><MyPaidListings /></ProtectedRoute>} />
        <Route path="/provider/requests" element={<ProtectedRoute><ProviderRequests /></ProtectedRoute>} />
        <Route path="/my-learning" element={<ProtectedRoute><MyLearning /></ProtectedRoute>} />
        <Route path="/booking/:bookingId" element={<ProtectedRoute><Booking /></ProtectedRoute>} />

        <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
        <Route path="/messages/:userId" element={<ProtectedRoute><Messages /></ProtectedRoute>} />

        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/booking/:id" element={<BookingPay />} />
        <Route path="/admin/users/:id" element={<AdminUserProfile />} />

        <Route path="*" element={<div className="page"><h2>404 — Page not found</h2></div>} />
      </Routes>
      <Footer />
    </>
  );
}

export default App;
