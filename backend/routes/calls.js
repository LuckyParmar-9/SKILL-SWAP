const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");

// Creates a fresh, short-lived Daily.co room for a single 1:1 call.
// The Daily API key is a secret and must never reach the frontend, which is
// why room creation always goes through this backend endpoint. Ringing/accept/
// reject notifications still use our own Socket.io signaling (see sockets/index.js)
// — Daily only handles the actual audio/video connection once both sides join.
router.post("/create-room", protect, async (req, res) => {
  try {
    if (!process.env.DAILY_API_KEY) {
      return res.status(500).json({ message: "DAILY_API_KEY is not configured on the server" });
    }
    const { callType } = req.body; // "audio" | "video"

    const response = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          exp: Math.round(Date.now() / 1000) + 60 * 60 * 2, // room auto-expires after 2 hours, so unused rooms don't pile up
          enable_knocking: false, // our own accept/reject flow already gates who gets invited
          enable_screenshare: true,
          enable_chat: false,
          start_video_off: callType === "audio",
          start_audio_off: false,
          max_participants: 2,
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ message: data?.error || "Failed to create the call room" });
    }

    res.status(201).json({ url: data.url, name: data.name });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
