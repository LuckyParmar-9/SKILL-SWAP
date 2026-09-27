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
  const [plan, setPlan] = useState("full"); // "full" | "split" — only matters before the first payment
  const [firstAmount, setFirstAmount] = useState(""); // rupees, kept in sync with secondAmount
  const [secondAmount, setSecondAmount] = useState("");

  const load = () => api.get(`/bookings/${bookingId}`).then((res) => setBooking(res.data));
  useEffect(() => { load(); }, [bookingId]);

  if (!booking) return <div className="loading">Loading booking...</div>;

  const firstPaid = booking.payment.first.status === "paid";
  const isSplit = booking.payment.plan === "split";
  const secondDue = isSplit && booking.payment.second.status === "due";
  const secondNotDue = isSplit && booking.payment.second.status === "not_due";
  const fullyPaid = firstPaid && (!isSplit || booking.payment.second.status === "paid");

  // Editing either installment field recalculates the other, since together
  // they must always add up to the booking's total price.
  const onFirstAmountChange = (value) => {
    setFirstAmount(value);
    const n = Number(value);
    setSecondAmount(n > 0 && n < booking.price ? String(booking.price - n) : "");
  };
  const onSecondAmountChange = (value) => {
    setSecondAmount(value);
    const n = Number(value);
    setFirstAmount(n > 0 && n < booking.price ? String(booking.price - n) : "");
  };

  const parsedFirst = Number(firstAmount);
  const validSplit = plan === "split" && parsedFirst > 0 && parsedFirst < booking.price;

  const payNow = async () => {
    setErrorMsg("");
    if (!firstPaid && plan === "split" && !validSplit) {
      setErrorMsg(`Enter installment amounts that add up to ₹${booking.price}`);
      return;
    }
    setStatus("processing");
    try {
      const body = { bookingId };
      if (!firstPaid) {
        body.plan = plan;
        if (plan === "split") body.firstAmount = parsedFirst;
      }
      const { data: order } = await api.post("/payments/create-order", body); // US-27 step 1

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
              await load();
              if (data.leg === "first") {
                setTimeout(() => navigate("/my-learning"), 1500);
              }
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

  return (
    <div className="page">
      <h1 className="page-title">Confirm & Pay</h1>
      <div className="card" style={{ maxWidth: 480 }}>
        <h3>{booking.listing?.skill}</h3>
        <p>With {booking.provider?.name}</p>
        <p>
          {booking.slot?.date
            ? `${booking.slot.date} · ${booking.slot.startTime}-${booking.slot.endTime}`
            : "Time to be scheduled after payment"}
        </p>
        <p style={{ fontSize: 24, fontWeight: 800, color: "var(--pista-darker)" }}>₹{booking.price}</p>
        <p>Booking status: <span className={`status-pill status-${booking.status}`}>{booking.status}</span></p>
        <p>
          Payment status:{" "}
          <span className={`status-pill status-${firstPaid ? "paid" : "unpaid"}`}>
            {fullyPaid ? "fully paid" : firstPaid ? "first payment done" : "unpaid"}
          </span>
        </p>

        {errorMsg && <div className="form-error">{errorMsg}</div>}

        {status === "success" && !secondNotDue && !secondDue && (
          <p style={{ color: "var(--pista-darker)", fontWeight: 600 }}>Payment successful! Redirecting...</p>
        )}

        {fullyPaid ? (
          <p style={{ color: "var(--pista-darker)" }}>This booking is already fully paid.</p>
        ) : booking.status === "pending" ? (
          <p className="empty-state">Waiting for the provider to accept your request before you can pay.</p>
        ) : !firstPaid ? (
          <>
            <div className="form-group" style={{ marginTop: 10 }}>
              <label>
                <input type="radio" name="plan" checked={plan === "full"} onChange={() => setPlan("full")} />
                {" "}Pay in full — ₹{booking.price}
              </label>
            </div>
            <div className="form-group">
              <label>
                <input type="radio" name="plan" checked={plan === "split"} onChange={() => setPlan("split")} />
                {" "}Pay in two custom installments
              </label>
            </div>

            {plan === "split" && (
              <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>First installment (₹)</label>
                  <input
                    type="number"
                    min={1}
                    max={booking.price - 1}
                    value={firstAmount}
                    onChange={(e) => onFirstAmountChange(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Second installment (₹)</label>
                  <input
                    type="number"
                    min={1}
                    max={booking.price - 1}
                    value={secondAmount}
                    onChange={(e) => onSecondAmountChange(e.target.value)}
                  />
                </div>
              </div>
            )}

            <button
              className="btn btn-primary"
              onClick={payNow}
              disabled={status === "processing" || (plan === "split" && !validSplit)}
            >
              {status === "processing"
                ? "Processing..."
                : plan === "split" && validSplit
                ? `Pay ₹${parsedFirst} Now`
                : plan === "full"
                ? `Pay ₹${booking.price} with Razorpay`
                : "Enter installment amounts"}
            </button>
          </>
        ) : secondNotDue ? (
          <p className="empty-state">
            First payment complete — messaging and calling are unlocked. The final payment of{" "}
            ₹{booking.payment.second.amount} opens once the provider marks the session as completed.
          </p>
        ) : secondDue ? (
          <>
            <p>The provider marked this session as completed. Final amount due: ₹{booking.payment.second.amount}</p>
            <button className="btn btn-primary" onClick={payNow} disabled={status === "processing"}>
              {status === "processing" ? "Processing..." : `Pay Final ₹${booking.payment.second.amount} with Razorpay`}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default Booking;
