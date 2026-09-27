import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";

const RAZORPAY_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

let razorpayScriptPromise = null;
function loadRazorpayScript() {
  if (window.Razorpay) return Promise.resolve();
  if (razorpayScriptPromise) return razorpayScriptPromise;
  razorpayScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT_SRC;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Could not load the payment service"));
    document.body.appendChild(script);
  });
  return razorpayScriptPromise;
}

const BookingPay = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [plan, setPlan] = useState("full"); // "full" | "split" — only matters before first payment
  const [firstAmount, setFirstAmount] = useState(""); // learner-entered rupee amount for the first installment
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  const load = () => api.get(`/bookings/${id}`).then((res) => setBooking(res.data));
  useEffect(() => { load(); }, [id]);

  if (!booking) return <div className="loading">Loading booking...</div>;

  const firstPaid = booking.payment.first.status === "paid";
  const isSplit = booking.payment.plan === "split";
  const secondDue = isSplit && booking.payment.second.status === "due";
  const secondNotDue = isSplit && booking.payment.second.status === "not_due";
  const fullyPaid = firstPaid && (!isSplit || booking.payment.second.status === "paid");

  const parsedFirst = Number(firstAmount);
  const validSplitAmount = plan === "split" && parsedFirst > 0 && parsedFirst < booking.price;
  const secondPreviewAmount = plan === "split" && validSplitAmount ? booking.price - parsedFirst : null;

  const handlePay = async () => {
    setError("");
    if (!firstPaid && plan === "split" && !validSplitAmount) {
      setError(`Enter an amount between ₹1 and ₹${booking.price - 1} for the first installment`);
      return;
    }
    setPaying(true);
    try {
      const body = { bookingId: booking._id };
      if (!firstPaid) {
        body.plan = plan;
        if (plan === "split") body.firstAmount = parsedFirst;
      }
      const { data: order } = await api.post("/payments/create-order", body);

      await loadRazorpayScript();

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "SkillSwap",
        description: `${order.leg === "first" ? "Payment" : "Final payment"} for "${booking.listing?.skill}"`,
        handler: async (response) => {
          try {
            await api.post("/payments/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              bookingId: booking._id,
            });
            await load();
          } catch (err) {
            setError(err.response?.data?.message || "Payment verification failed");
          } finally {
            setPaying(false);
          }
        },
        modal: {
          ondismiss: () => setPaying(false), // learner closed the checkout popup without paying
        },
        theme: { color: "#4b7448" },
      });

      rzp.on("payment.failed", () => {
        setError("Payment failed. Please try again.");
        setPaying(false);
      });

      rzp.open();
    } catch (err) {
      setError(err.response?.data?.message || "Could not start payment");
      setPaying(false);
    }
  };

  return (
    <div className="page">
      <div className="card">
        <h2 style={{ margin: "0 0 6px" }}>{booking.listing?.skill}</h2>
        <p style={{ color: "var(--text-muted)" }}>
          With {booking.provider?.name} · {booking.slot?.date} {booking.slot?.startTime}-{booking.slot?.endTime}
        </p>
        <p style={{ fontSize: 22, fontWeight: 800, color: "var(--pista-darker)" }}>
          Total: ₹{booking.price}
        </p>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        {fullyPaid && (
          <>
            <h3>All paid up ✓</h3>
            <p>This session is fully paid. Messaging and calling are unlocked.</p>
            <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={() => navigate("/my-learning")}>
              Back to My Learning
            </button>
          </>
        )}

        {!fullyPaid && !firstPaid && (
          <>
            <h3>Choose how you'd like to pay</h3>
            <div className="form-group">
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
              <div style={{ marginLeft: 24, marginBottom: 14 }}>
                <div className="form-group">
                  <label>First installment amount (₹)</label>
                  <input
                    type="number"
                    min={1}
                    max={booking.price - 1}
                    placeholder={`e.g. ${Math.round(booking.price / 2)}`}
                    value={firstAmount}
                    onChange={(e) => setFirstAmount(e.target.value)}
                  />
                </div>
                <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
                  {validSplitAmount
                    ? `Pay ₹${parsedFirst} now · ₹${secondPreviewAmount} due once the session is marked completed`
                    : `Enter any amount between ₹1 and ₹${booking.price - 1}`}
                </p>
              </div>
            )}

            <button
              className="btn btn-primary"
              disabled={paying || (plan === "split" && !validSplitAmount)}
              onClick={handlePay}
            >
              {paying ? "Opening payment..." : plan === "split" && validSplitAmount ? `Pay ₹${parsedFirst} Now` : plan === "full" ? `Pay ₹${booking.price} Now` : "Enter an amount"}
            </button>
          </>
        )}

        {!fullyPaid && firstPaid && secondNotDue && (
          <>
            <h3>First payment complete ✓</h3>
            <p>
              Messaging and calling with {booking.provider?.name} are now unlocked. The final payment of{" "}
              ₹{booking.payment.second.amount} will open once the provider marks this session as completed.
            </p>
          </>
        )}

        {!fullyPaid && firstPaid && secondDue && (
          <>
            <h3>Final payment due</h3>
            <p>The provider marked this session as completed. Final amount: ₹{booking.payment.second.amount}</p>
            <button className="btn btn-primary" disabled={paying} onClick={handlePay}>
              {paying ? "Opening payment..." : `Pay Final ₹${booking.payment.second.amount}`}
            </button>
          </>
        )}

        {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}
      </div>
    </div>
  );
};

export default BookingPay;
