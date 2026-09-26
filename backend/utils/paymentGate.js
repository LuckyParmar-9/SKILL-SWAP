const Booking = require("../models/Booking");

// Answers one question: "have userA and userB cleared a first payment
// together?" Used to gate both messaging and calling.
//
// Rule: if these two users have no paid-listing relationship at all (no
// Booking connecting them), there's nothing to gate — that's the case for
// unrelated free skill-swap matches, general browsing, etc. If they DO have
// an active booking (pending/accepted/confirmed/completed — i.e. not
// rejected or cancelled) tied to a paid listing, messaging/calling only
// opens once at least one of those bookings shows its first payment as paid.
async function isPaymentGateOpen(userIdA, userIdB) {
  const bookings = await Booking.find({
    $or: [
      { learner: userIdA, provider: userIdB },
      { learner: userIdB, provider: userIdA },
    ],
    status: { $in: ["pending", "accepted", "confirmed", "completed"] },
  }).select("payment.first.status");

  if (bookings.length === 0) return true; // no paid-listing relationship to gate at all

  return bookings.some((b) => b.payment?.first?.status === "paid");
}

module.exports = isPaymentGateOpen;
