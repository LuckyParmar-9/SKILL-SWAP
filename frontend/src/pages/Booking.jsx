import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";

const Booking = () => {
  const { bookingId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [status, setStatus] = useState(""); // "", "processing", "success", "error"
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    api.get(`/bookings/${bookingId}`).then((res) => setBooking(res.data));
  }, [bookingId]);

  const payNow = async () => {
    setStatus("processing");
    setErrorMsg("");
    try {
      const { data: order } = await api.post("/payments/create-order", { bookingId }); // US-27 step 1

      if (typeof window.Razorpay === "undefined") {
        setErrorMsg("Razorpay checkout script did not load. Check your internet connection.");
        setStatus("error");
        return;
      }

      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "SkillSwap",
        description: booking?.listing?.skill || "Paid learning session",
        order_id: order.orderId,
        prefill: { name: user?.name, email: user?.email },
        theme: { color: "#6a9a52" },
        handler: async (response) => {
          try {
            const { data } = await api.post("/payments/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              bookingId,
            }); // US-27 step 2 / US-28
            if (data.verified) {
              setStatus("success");
              setTimeout(() => navigate("/my-learning"), 1500);
            } else {
              setStatus("error");
              setErrorMsg("Payment could not be verified.");
            }
          } catch (err) {
            setStatus("error");
            setErrorMsg(err.response?.data?.message || "Verification failed");
          }
        },
        modal: {
          ondismiss: () => setStatus(""),
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.response?.data?.message || "Could not start payment");
    }
  };

  if (!booking) return <div className="loading">Loading booking...</div>;

  return (
    <div className="page">
      <h1 className="page-title">Confirm & Pay</h1>
      <div className="card" style={{ maxWidth: 480 }}>
        <h3>{booking.listing?.skill}</h3>
        <p>With {booking.provider?.name}</p>
        <p>{booking.slot?.date} · {booking.slot?.startTime}-{booking.slot?.endTime}</p>
        <p style={{ fontSize: 24, fontWeight: 800, color: "var(--pista-darker)" }}>₹{booking.price}</p>
        <p>Booking status: <span className={`status-pill status-${booking.status}`}>{booking.status}</span></p>
        <p>Payment status: <span className={`status-pill status-${booking.payment?.status}`}>{booking.payment?.status}</span></p>

        {errorMsg && <div className="form-error">{errorMsg}</div>}
        {status === "success" ? (
          <p style={{ color: "var(--pista-darker)", fontWeight: 600 }}>Payment successful! Redirecting...</p>
        ) : booking.payment?.status === "paid" ? (
          <p style={{ color: "var(--pista-darker)" }}>This booking is already paid.</p>
        ) : booking.status !== "accepted" ? (
          <p className="empty-state">Waiting for the provider to accept your request before you can pay.</p>
        ) : (
          <button className="btn btn-primary" onClick={payNow} disabled={status === "processing"}>
            {status === "processing" ? "Processing..." : `Pay ₹${booking.price} with Razorpay`}
          </button>
        )}
      </div>
    </div>
  );
};

export default Booking;
