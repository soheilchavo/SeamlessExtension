var m = class extends Error {
  constructor(e, t, r, n) {
    super(e), this.name = "ApiError", this.statusCode = t, this.requestId = r, this.details = n;
  }
}, b = class extends m {
  constructor(e, t) {
    super(e, 401, t), this.name = "UnauthorizedError";
  }
}, C = class extends m {
  constructor(e, t, r) {
    super(e, 422, t, r), this.name = "ValidationError";
  }
}, I = class extends m {
  constructor(e, t) {
    super(e, 404, t), this.name = "NotFoundError";
  }
}, E = class extends m {
  constructor(e, t) {
    super(e), this.name = "NetworkError", this.cause = t;
  }
}, k = class extends m {
  constructor(e, t, r) {
    super(e, 500, t, r), this.name = "ServerError";
  }
}, L = class {
  constructor(e) {
    if (!e.apiKey || typeof e.apiKey != "string")
      throw new Error("apiKey is required and must be a string");
    this.baseUrl = e.baseUrl, this.apiKey = e.apiKey;
  }
  async request(e, t = {}) {
    const r = `${this.baseUrl}${e}`, n = new AbortController();
    try {
      const o = await fetch(r, {
        ...t,
        signal: n.signal,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          ...t.headers
        }
      });
      if (!o.ok) {
        const s = await o.json().catch(() => ({
          error: "unknown_error",
          message: o.statusText
        })), i = s.message || s.error;
        throw o.status === 401 ? new b(
          i || "Invalid or revoked API key",
          s.request_id
        ) : o.status === 422 || o.status === 400 ? new C(
          i,
          s.request_id,
          s.details
        ) : o.status === 404 ? new I(i, s.request_id) : o.status >= 500 ? new k(
          i,
          s.request_id,
          s.details
        ) : new m(
          i,
          o.status,
          s.request_id,
          s.details
        );
      }
      return await o.json();
    } catch (o) {
      throw o instanceof m ? o : o instanceof Error ? new E(`Network error: ${o.message}`, o) : new E("Unknown network error");
    }
  }
  async createStream(e) {
    return this.request("/streams", {
      method: "POST",
      body: JSON.stringify(e)
    });
  }
  async renewLease(e) {
    return this.request(`/streams/${e}/keepalive`, {
      method: "POST"
    });
  }
  async updatePrompt(e, t) {
    return this.request(
      `/streams/${e}/config/prompt`,
      {
        method: "PATCH",
        body: JSON.stringify({ prompt: t })
      }
    );
  }
  async submitFeedback(e, t) {
    return this.request(`/streams/${e}/feedback`, {
      method: "POST",
      body: JSON.stringify(t)
    });
  }
  async getAllFeedback() {
    return this.request("/streams/feedback", {
      method: "GET"
    });
  }
  connectWebSocket(e) {
    const t = this.baseUrl.replace("http://", "ws://").replace("https://", "wss://");
    return new WebSocket(`${t}/ws/streams/${e}`);
  }
  /**
   * Health check endpoint (for testing, uses internal port if available)
   * Note: This endpoint may not be available via the main API
   */
  async healthCheck() {
    const e = `${this.baseUrl}/healthz`;
    return (await fetch(e, {
      credentials: "include"
    })).text();
  }
}, c = {
  BACKEND: "overshoot",
  MODEL: "Qwen/Qwen3-VL-30B-A3B-Instruct",
  SOURCE: { type: "camera", cameraFacing: "environment" },
  SAMPLING_RATIO: 0.1,
  CLIP_LENGTH_SECONDS: 1,
  DELAY_SECONDS: 1,
  FALLBACK_FPS: 30,
  ICE_SERVERS: [
    {
      urls: "turn:34.63.114.235:3478",
      username: "1769538895:c66a907c-61f4-4ec2-93a6-9d6b932776bb",
      credential: "Fu9L4CwyYZvsOLc+23psVAo3i/Y="
    }
  ]
}, a = {
  SAMPLING_RATIO: { min: 0, max: 1 },
  FPS: { min: 1, max: 120 },
  CLIP_LENGTH_SECONDS: { min: 0.1, max: 60 },
  DELAY_SECONDS: { min: 0, max: 60 },
  RATING: { min: 1, max: 5 }
}, T = class {
  constructor(e = !1) {
    this.debugEnabled = e;
  }
  debug(...e) {
    this.debugEnabled && console.log("[RealtimeVision Debug]", ...e);
  }
  info(...e) {
    console.log("[RealtimeVision]", ...e);
  }
  warn(...e) {
    console.warn("[RealtimeVision]", ...e);
  }
  error(...e) {
    console.error("[RealtimeVision]", ...e);
  }
}, l = class extends Error {
  constructor(e) {
    super(e), this.name = "ValidationError";
  }
}, N = class {
  constructor(e) {
    this.mediaStream = null, this.peerConnection = null, this.webSocket = null, this.streamId = null, this.keepaliveInterval = null, this.videoElement = null, this.isRunning = !1, this.validateConfig(e), this.config = e, this.logger = new T(e.debug ?? !1), this.client = new L({
      baseUrl: e.apiUrl,
      apiKey: e.apiKey
    });
  }
  /**
   * Validate configuration values
   */
  validateConfig(e) {
    if (!e.apiUrl || typeof e.apiUrl != "string")
      throw new l("apiUrl is required and must be a string");
    if (!e.apiKey || typeof e.apiKey != "string")
      throw new l("apiKey is required and must be a string");
    if (!e.prompt || typeof e.prompt != "string")
      throw new l("prompt is required and must be a string");
    if (e.source)
      if (e.source.type === "camera") {
        if (e.source.cameraFacing !== "user" && e.source.cameraFacing !== "environment")
          throw new l(
            'cameraFacing must be "user" or "environment"'
          );
      } else if (e.source.type === "video") {
        if (!(e.source.file instanceof File))
          throw new l("video source must provide a File object");
      } else
        throw new l('source.type must be "camera" or "video"');
    if (e.processing?.sampling_ratio !== void 0) {
      const t = e.processing.sampling_ratio;
      if (t < a.SAMPLING_RATIO.min || t > a.SAMPLING_RATIO.max)
        throw new l(
          `sampling_ratio must be between ${a.SAMPLING_RATIO.min} and ${a.SAMPLING_RATIO.max}`
        );
    }
    if (e.processing?.fps !== void 0) {
      const t = e.processing.fps;
      if (t < a.FPS.min || t > a.FPS.max)
        throw new l(
          `fps must be between ${a.FPS.min} and ${a.FPS.max}`
        );
    }
    if (e.processing?.clip_length_seconds !== void 0) {
      const t = e.processing.clip_length_seconds;
      if (t < a.CLIP_LENGTH_SECONDS.min || t > a.CLIP_LENGTH_SECONDS.max)
        throw new l(
          `clip_length_seconds must be between ${a.CLIP_LENGTH_SECONDS.min} and ${a.CLIP_LENGTH_SECONDS.max}`
        );
    }
    if (e.processing?.delay_seconds !== void 0) {
      const t = e.processing.delay_seconds;
      if (t < a.DELAY_SECONDS.min || t > a.DELAY_SECONDS.max)
        throw new l(
          `delay_seconds must be between ${a.DELAY_SECONDS.min} and ${a.DELAY_SECONDS.max}`
        );
    }
  }
  /**
   * Create media stream from the configured source
   */
  async createMediaStream(e) {
    switch (this.logger.debug("Creating media stream from source:", e.type), e.type) {
      case "camera":
        return await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: e.cameraFacing } },
          audio: !1
        });
      case "video":
        const t = document.createElement("video");
        t.src = URL.createObjectURL(e.file), t.muted = !0, t.loop = !0, t.playsInline = !0, this.logger.debug("Loading video file:", e.file.name), await new Promise((o, s) => {
          const i = setTimeout(() => {
            s(new Error("Video loading timeout after 10 seconds"));
          }, 1e4);
          t.onloadedmetadata = () => {
            clearTimeout(i), this.logger.debug("Video metadata loaded"), o();
          }, t.onerror = (h) => {
            clearTimeout(i), this.logger.error("Video loading error:", h), s(new Error("Failed to load video file"));
          }, t.readyState >= 1 && (clearTimeout(i), o());
        }), await t.play(), this.logger.debug("Video playback started");
        const r = t.captureStream();
        if (!r)
          throw new Error("Failed to capture video stream");
        if (r.getVideoTracks().length === 0)
          throw new Error("Video stream has no video tracks");
        return this.videoElement = t, r;
      default:
        throw new Error(`Unknown source type: ${e.type}`);
    }
  }
  /**
   * Get FPS from media stream
   */
  async getStreamFps(e, t) {
    if (!e)
      return this.logger.warn("Stream is null, using fallback FPS"), c.FALLBACK_FPS;
    const r = e.getVideoTracks();
    if (!r || r.length === 0)
      return this.logger.warn("No video tracks found, using fallback FPS"), c.FALLBACK_FPS;
    const n = r[0];
    if (!n)
      return this.logger.warn("First video track is null, using fallback FPS"), c.FALLBACK_FPS;
    if (t.type === "camera") {
      const s = n.getSettings().frameRate ?? c.FALLBACK_FPS;
      return this.logger.debug("Detected camera FPS:", s), s;
    }
    return t.type === "video" && this.videoElement && (await new Promise((o, s) => {
      this.videoElement.readyState >= 1 ? o() : (this.videoElement.onloadedmetadata = () => o(), this.videoElement.onerror = () => s(new Error("Failed to load video metadata")));
    }), this.logger.debug("Using fallback FPS for video file")), c.FALLBACK_FPS;
  }
  /**
   * Get processing configuration with defaults applied
   */
  getProcessingConfig(e) {
    const t = this.config.processing || {};
    return {
      sampling_ratio: t.sampling_ratio ?? c.SAMPLING_RATIO,
      fps: t.fps ?? e,
      clip_length_seconds: t.clip_length_seconds ?? c.CLIP_LENGTH_SECONDS,
      delay_seconds: t.delay_seconds ?? c.DELAY_SECONDS
    };
  }
  /**
   * Get the effective source configuration
   */
  getSource() {
    return this.config.source ?? c.SOURCE;
  }
  /**
   * Start the vision stream
   */
  async start() {
    if (this.isRunning)
      throw new Error("Vision stream already running");
    try {
      const e = this.getSource();
      if (this.logger.debug("Starting stream with source type:", e.type), e.type === "video" && (this.logger.debug("Video file:", {
        name: e.file.name,
        size: e.file.size,
        type: e.file.type
      }), !e.file || !(e.file instanceof File)))
        throw new Error("Invalid video file");
      this.mediaStream = await this.createMediaStream(e);
      const t = this.mediaStream.getVideoTracks()[0];
      if (!t)
        throw new Error("No video track available");
      const r = await this.getStreamFps(this.mediaStream, e), n = this.config.iceServers ?? c.ICE_SERVERS;
      this.logger.debug("Creating peer connection with ICE servers"), this.peerConnection = new RTCPeerConnection({ iceServers: n }), this.peerConnection.onicecandidate = (i) => {
        i.candidate ? this.logger.debug("ICE candidate:", {
          type: i.candidate.type,
          protocol: i.candidate.protocol
        }) : this.logger.debug("ICE gathering complete");
      }, this.peerConnection.oniceconnectionstatechange = () => {
        this.logger.debug(
          "ICE connection state:",
          this.peerConnection?.iceConnectionState
        );
      }, this.peerConnection.addTrack(t, this.mediaStream);
      const o = await this.peerConnection.createOffer();
      if (await this.peerConnection.setLocalDescription(o), !this.peerConnection.localDescription)
        throw new Error("Failed to create local description");
      this.logger.debug("Creating stream on server");
      const s = await this.client.createStream({
        webrtc: {
          type: "offer",
          sdp: this.peerConnection.localDescription.sdp
        },
        processing: this.getProcessingConfig(r),
        inference: {
          prompt: this.config.prompt,
          backend: this.config.backend ?? c.BACKEND,
          model: this.config.model ?? c.MODEL,
          output_schema_json: this.config.outputSchema
        }
      });
      this.logger.debug("Backend response received:", {
        stream_id: s.stream_id,
        has_turn_servers: !!s.turn_servers
      }), await this.peerConnection.setRemoteDescription(s.webrtc), this.streamId = s.stream_id, this.logger.info("Stream started:", this.streamId), this.setupKeepalive(s.lease?.ttl_seconds), this.setupWebSocket(s.stream_id), this.isRunning = !0;
    } catch (e) {
      throw await this.handleFatalError(e), e;
    }
  }
  /**
   * Set up keepalive interval with error handling
   */
  setupKeepalive(e) {
    if (!e)
      return;
    const t = e / 2 * 1e3;
    this.logger.debug("Setting up keepalive with interval:", t, "ms"), this.keepaliveInterval = window.setInterval(async () => {
      try {
        this.streamId && (await this.client.renewLease(this.streamId), this.logger.debug("Lease renewed"));
      } catch (r) {
        this.logger.error("Keepalive failed:", r);
        const n = new Error(
          `Keepalive failed: ${r instanceof Error ? r.message : String(r)}`
        );
        await this.handleFatalError(n);
      }
    }, t);
  }
  /**
   * Set up WebSocket connection with error handling
   */
  setupWebSocket(e) {
    this.logger.debug("Connecting WebSocket for stream:", e), this.webSocket = this.client.connectWebSocket(e), this.webSocket.onopen = () => {
      this.logger.debug("WebSocket connected"), this.webSocket && this.webSocket.send(JSON.stringify({ api_key: this.config.apiKey }));
    }, this.webSocket.onmessage = (t) => {
      try {
        const r = JSON.parse(t.data);
        this.config.onResult(r);
      } catch (r) {
        const n = new Error(
          `Failed to parse WebSocket message: ${r instanceof Error ? r.message : String(r)}`
        );
        this.handleNonFatalError(n);
      }
    }, this.webSocket.onerror = () => {
      this.logger.error("WebSocket error occurred");
      const t = new Error("WebSocket error occurred");
      this.handleFatalError(t);
    }, this.webSocket.onclose = (t) => {
      if (this.isRunning)
        if (t.code === 1008) {
          this.logger.error("WebSocket authentication failed");
          const r = new Error(
            "WebSocket authentication failed: Invalid or revoked API key"
          );
          this.handleFatalError(r);
        } else {
          this.logger.warn("WebSocket closed unexpectedly:", t.code);
          const r = new Error("WebSocket closed unexpectedly");
          this.handleFatalError(r);
        }
      else
        this.logger.debug("WebSocket closed");
    };
  }
  /**
   * Handle non-fatal errors (report but don't stop stream)
   */
  handleNonFatalError(e) {
    this.logger.warn("Non-fatal error:", e.message), this.config.onError && this.config.onError(e);
  }
  /**
   * Handle fatal errors (stop stream and report)
   */
  async handleFatalError(e) {
    this.logger.error("Fatal error:", e), await this.cleanup(), this.isRunning = !1;
    const t = e instanceof Error ? e : new Error(String(e));
    this.config.onError && this.config.onError(t);
  }
  /**
   * Update the prompt/task while stream is running
   */
  async updatePrompt(e) {
    if (!this.isRunning || !this.streamId)
      throw new Error("Vision stream not running");
    if (!e || typeof e != "string")
      throw new l("prompt must be a non-empty string");
    this.logger.debug("Updating prompt"), await this.client.updatePrompt(this.streamId, e), this.logger.info("Prompt updated");
  }
  /**
   * Stop the vision stream and clean up resources
   */
  async stop() {
    this.logger.info("Stopping stream"), await this.cleanup(), this.isRunning = !1;
  }
  /**
   * Submit feedback for the stream
   */
  async submitFeedback(e) {
    if (!this.streamId)
      throw new Error("No active stream");
    if (e.rating < a.RATING.min || e.rating > a.RATING.max)
      throw new l(
        `rating must be between ${a.RATING.min} and ${a.RATING.max}`
      );
    if (!e.category || typeof e.category != "string")
      throw new l("category must be a non-empty string");
    this.logger.debug("Submitting feedback"), await this.client.submitFeedback(this.streamId, {
      rating: e.rating,
      category: e.category,
      feedback: e.feedback ?? ""
    }), this.logger.info("Feedback submitted");
  }
  /**
   * Get the current stream ID
   */
  getStreamId() {
    return this.streamId;
  }
  /**
   * Get the media stream (for displaying video preview)
   */
  getMediaStream() {
    return this.mediaStream;
  }
  /**
   * Check if the stream is running
   */
  isActive() {
    return this.isRunning;
  }
  async cleanup() {
    this.logger.debug("Cleaning up resources"), this.keepaliveInterval && (window.clearInterval(this.keepaliveInterval), this.keepaliveInterval = null), this.webSocket && (this.webSocket.close(), this.webSocket = null), this.peerConnection && (this.peerConnection.close(), this.peerConnection = null), this.mediaStream && (this.mediaStream.getTracks().forEach((e) => e.stop()), this.mediaStream = null), this.videoElement && (this.videoElement.pause(), URL.revokeObjectURL(this.videoElement.src), this.videoElement.remove(), this.videoElement = null), this.streamId = null, this.logger.debug("Cleanup complete");
  }
};
const _ = "ovs_148da6c73eff6fdde6431e7bc82e0dd8", v = "https://web-production-a1e61a.up.railway.app/get-product";
console.log("Seamless extension loaded");
let u = null, p = null;
const w = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map(), f = /* @__PURE__ */ new Set();
function A(e) {
  const t = (e.type || "").toLowerCase().trim();
  return `${(e.color || "").toLowerCase().trim()}-${t}`;
}
function P(e, t) {
  const r = (S) => S.toLowerCase().replace(/[^a-z0-9]/g, ""), n = r(e), o = r(t);
  if (n.includes(o) || o.includes(n)) return !0;
  const s = new Set(e.toLowerCase().split(/\s+/)), i = new Set(t.toLowerCase().split(/\s+/)), h = [...s].filter((S) => i.has(S)), g = /* @__PURE__ */ new Set([...s, ...i]);
  return h.length / g.size > 0.6;
}
function R(e) {
  for (const [t, r] of w.entries())
    if (P(e, t))
      return console.log(`Found similar cached item: "${t}" for "${e}"`), r;
  return null;
}
async function F(e) {
  console.log("=== SEARCH PRODUCT START ==="), console.log("Item name:", e), console.log("Railway URL:", v);
  try {
    const t = JSON.stringify({ item_name: e });
    console.log("Request body:", t), console.log("Sending fetch request...");
    const r = await fetch(v, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: t
    });
    console.log("Response received!"), console.log("Response status:", r.status), console.log("Response ok:", r.ok), console.log("Response headers:", [...r.headers.entries()]);
    const n = await r.text();
    console.log("Response text:", n);
    let o;
    try {
      o = JSON.parse(n), console.log("Parsed response data:", o);
    } catch (s) {
      return console.error("Failed to parse response as JSON:", s), { error: "Invalid JSON response: " + n.substring(0, 100) };
    }
    return console.log("=== SEARCH PRODUCT SUCCESS ==="), o;
  } catch (t) {
    return console.error("=== SEARCH PRODUCT ERROR ==="), console.error("Error type:", t.name), console.error("Error message:", t.message), console.error("Full error:", t), { error: t.message };
  }
}
function y(e) {
  console.log("=== DISPLAY PRODUCTS ==="), console.log("Products to display:", e), console.log("Products count:", e?.length);
  const t = document.getElementById("products");
  if (console.log("Products container found:", !!t), console.log("Products container element:", t), !t) {
    console.error("ERROR: Products container not found in DOM!");
    return;
  }
  if (t.innerHTML = "", !e || e.length === 0) {
    console.log("No products to display"), t.innerHTML = '<div class="no-products">No products found</div>';
    return;
  }
  console.log("Creating product cards..."), e.forEach((r, n) => {
    console.log(`Processing product ${n}:`, r);
    const o = document.createElement("div");
    o.className = "product-card", r.loading ? o.innerHTML = `
                <div class="product-loading">
                    <span class="loading-icon">⏳</span>
                    <span>Searching for ${r.itemName}...</span>
                </div>
            ` : r.error ? o.innerHTML = `
                <div class="product-error">
                    <span class="error-icon">⚠️</span>
                    <span>${r.itemName}: ${r.error}</span>
                </div>
            ` : r.url ? o.innerHTML = `
                <div class="product-info">
                    <div class="product-name">${r.itemName || "Product"}</div>
                    ${r.name ? `<div class="product-title">${r.name}</div>` : ""}
                    ${r.price ? `<div class="product-price">${r.price}</div>` : ""}
                    ${r.fromCache ? '<div class="from-cache">📦 Cached</div>' : ""}
                </div>
                <button class="shop-btn" data-url="${r.url}">Shop Now →</button>
            ` : o.innerHTML = `
                <div class="product-not-found">
                    <span class="not-found-icon">🔍</span>
                    <span>${r.itemName}: No product found</span>
                </div>
            `, t.appendChild(o);
  }), console.log("Final container innerHTML length:", t.innerHTML.length), console.log("Final container children count:", t.children.length), t.querySelectorAll(".shop-btn").forEach((r) => {
    r.onclick = () => {
      const n = r.getAttribute("data-url");
      n && window.open(n, "_blank");
    };
  });
}
async function O(e) {
  console.log("=== PROCESS CLOTHING ITEMS START ==="), console.log("Clothing data received:", e), console.log("Current cached items:", w.size), console.log("Current found products:", d.size);
  const t = document.getElementById("products");
  let r = [];
  if (e.items && Array.isArray(e.items) ? r = e.items : Array.isArray(e) && (r = e), console.log("Items to process:", r.length), r.length === 0) {
    d.size > 0 ? y([...d.values()]) : t.innerHTML = '<div class="no-products">No clothing items detected</div>';
    return;
  }
  let n = !1;
  for (const o of r) {
    const s = A(o);
    if (console.log("Normalized key:", s), d.has(s)) {
      console.log(`Skipping already found item: ${s}`);
      continue;
    }
    const i = [o.color, o.pattern, o.style, o.type].filter(Boolean).join(" ") || "Unknown item";
    if (console.log("Built item name:", i), f.has(s)) {
      console.log(`Already searching for: ${s}`);
      continue;
    }
    const h = R(i);
    if (h) {
      console.log("Using cached result for:", i), d.set(s, {
        itemName: i,
        normalizedKey: s,
        ...h,
        fromCache: !0
      }), n = !0;
      continue;
    }
    if (f.add(s), n = !0, d.size > 0) {
      const g = [...d.values()];
      g.push({ itemName: i, loading: !0 }), y(g);
    } else
      t.innerHTML = '<div class="loading">🔍 Searching for products...</div>';
    try {
      const g = await F(i);
      console.log("Search result for", i, ":", g), w.set(i, g), d.set(s, {
        itemName: i,
        normalizedKey: s,
        ...g
      });
    } catch (g) {
      console.error("Error searching for", i, ":", g), d.set(s, {
        itemName: i,
        normalizedKey: s,
        error: g.message
      });
    } finally {
      f.delete(s);
    }
  }
  (d.size > 0 || n) && (console.log("Displaying all found products:", d.size), y([...d.values()])), console.log("=== PROCESS CLOTHING ITEMS END ===");
}
document.addEventListener("DOMContentLoaded", async () => {
  async function e() {
    const n = (await navigator.mediaDevices.enumerateDevices()).filter((s) => s.kind === "videoinput"), o = document.getElementById("camera-select");
    o.innerHTML = n.map(
      (s, i) => `<option value="${s.deviceId}">${s.label || "Camera " + (i + 1)}</option>`
    ).join("");
  }
  await e();
  async function t() {
    if (!document.getElementById("camera-select").value) {
      document.getElementById("results").innerText = "Please select a camera first!";
      return;
    }
    p && await p.stop(), p = new N({
      apiUrl: "https://cluster1.overshoot.ai/api/v0.2",
      apiKey: _,
      prompt: 'Identify all clothing items visible in the image. For each item, describe: type, color, pattern, and style. If no clothing is found, say "No clothing found".',
      source: { type: "camera", cameraFacing: "user" },
      outputSchema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string" },
                color: { type: "string" },
                pattern: { type: "string" },
                style: { type: "string" },
                gender: { type: "string" }
              }
            }
          }
        }
      },
      onResult: (o) => {
        console.log("Got result:", o);
        try {
          u = typeof o == "string" ? JSON.parse(o) : o.result ? typeof o.result == "string" ? JSON.parse(o.result) : o.result : o, console.log("Parsed clothing data:", u), document.getElementById("results").innerText = JSON.stringify(u, null, 2), console.log("Checking if should process clothing items..."), console.log("latestClothingData:", u), console.log("Has items?", !!u?.items), console.log("Is array?", Array.isArray(u)), u && (u.items || Array.isArray(u)) ? (console.log(">>> Triggering processClothingItems!"), O(u)) : console.log(">>> NOT triggering processClothingItems - conditions not met");
        } catch (s) {
          console.log("Parse error:", s), console.log("Raw result:", o), document.getElementById("results").innerText = typeof o == "string" ? o : JSON.stringify(o, null, 2);
        }
      },
      onMessage: (o) => {
        console.log("Got message:", o);
      },
      onStatusChange: (o) => {
        console.log("Status changed:", o), document.getElementById("results").innerText = "Status: " + o;
      },
      onError: (o) => {
        console.error("Vision error:", o), document.getElementById("results").innerText = "An error occurred: " + (o.message || JSON.stringify(o));
      }
    }), await p.start(), console.log("Vision started with camera.");
  }
  document.getElementById("find-btn").onclick = () => {
    document.getElementById("results").innerText = "Detecting clothing...", t();
  }, document.getElementById("clear-btn").onclick = () => {
    console.log("Clearing all cached products..."), w.clear(), d.clear(), f.clear(), document.getElementById("products").innerHTML = "", document.getElementById("results").innerText = "", console.log("Cache cleared!");
  }, document.getElementById("start-btn").onclick = async () => {
    const n = document.getElementById("camera-select").value, o = document.getElementById("preview");
    console.log("Starting camera with device:", n);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: n ? { exact: n } : void 0 }
      });
      o.srcObject = s, console.log("Camera started successfully"), await e();
    } catch (s) {
      console.error("Error starting camera:", s), document.getElementById("results").innerText = "Error starting camera: " + s.message;
    }
  };
});
