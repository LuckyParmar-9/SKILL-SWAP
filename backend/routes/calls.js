const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");

// Creates a fresh, short-lived, PRIVATE Daily.co room for a single 1:1 call,
// and hands the caller a personal meeting token for that room.
//
// Why private + tokens: a plain Daily room URL works for anyone who has it —
// it can leak via browser history, screenshots, or logs. Making the room
// `privacy: "private"` means the bare URL alone is no longer enough to join;
// each participant also needs a signed, short-lived meeting token issued to
// them specifically. The Daily API key stays server-side, same as before.
router.post("/create-room", protect, async (req, res) => {
  try {
    if (!process.env.DAILY_API_KEY) {
      return res.status(500).json({ message: "DAILY_API_KEY is not configured on the server" });
    }
    const { callType } = req.body; // "audio" | "video"

    const roomRes = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        privacy: "private", // <-- the key change: bare URL no longer grants access
        properties: {
          exp: Math.round(Date.now() / 1000) + 60 * 60 * 2, // room auto-expires after 2 hours
          enable_screenshare: true,
          enable_chat: false,
          start_video_off: callType === "audio",
          start_audio_off: false,
          max_participants: 2,
        },
      }),
    });

    const roomData = await roomRes.json();
    if (!roomRes.ok) {
      return res.status(roomRes.status).json({ message: String(roomData?.error || "Failed to create the call room") });
    }

    // Issue the caller's own token for this private room right away, so the
    // caller can join immediately without a second round trip.
    const token = await createMeetingToken(roomData.name, req.user.name);
    if (!token) {
      return res.status(500).json({ message: "Failed to create a meeting token for the call room" });
    }

    res.status(201).json({ url: roomData.url, name: roomData.name, token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Callee (or anyone re-joining) hits this once they've accepted the call, to
// get their OWN personal token for a room that already exists. Note this is
// requested using the callee's own login (the `protect` middleware), so a
// token can never be forwarded or reused by someone else.
router.post("/token", protect, async (req, res) => {
  try {
    if (!process.env.DAILY_API_KEY) {
      return res.status(500).json({ message: "DAILY_API_KEY is not configured on the server" });
    }
    const { roomName } = req.body;
    if (!roomName) {
      return res.status(400).json({ message: "roomName is required" });
    }

    const token = await createMeetingToken(roomName, req.user.name);
    if (!token) {
      return res.status(500).json({ message: "Failed to create a meeting token" });
    }

    res.status(201).json({ token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

async function createMeetingToken(roomName, userName) {
  const tokenRes = await fetch("https://api.daily.co/v1/meeting-tokens", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        exp: Math.round(Date.now() / 1000) + 60 * 60 * 2, // token expires with the room
        user_name: userName,
      },
    }),
  });
  const data = await tokenRes.json();
  if (!tokenRes.ok) return null;
  return data.token;
}

module.exports = router;
