var m = class extends Error {
  constructor(e, t, n, o) {
    super(e), this.name = "ApiError", this.statusCode = t, this.requestId = n, this.details = o;
  }
}, L = class extends m {
  constructor(e, t) {
    super(e, 401, t), this.name = "UnauthorizedError";
  }
}, _ = class extends m {
  constructor(e, t, n) {
    super(e, 422, t, n), this.name = "ValidationError";
  }
}, N = class extends m {
  constructor(e, t) {
    super(e, 404, t), this.name = "NotFoundError";
  }
}, E = class extends m {
  constructor(e, t) {
    super(e), this.name = "NetworkError", this.cause = t;
  }
}, P = class extends m {
  constructor(e, t, n) {
    super(e, 500, t, n), this.name = "ServerError";
  }
}, T = class {
  constructor(e) {
    if (!e.apiKey || typeof e.apiKey != "string")
      throw new Error("apiKey is required and must be a string");
    this.baseUrl = e.baseUrl, this.apiKey = e.apiKey;
  }
  async request(e, t = {}) {
    const n = `${this.baseUrl}${e}`, o = new AbortController();
    try {
      const r = await fetch(n, {
        ...t,
        signal: o.signal,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          ...t.headers
        }
      });
      if (!r.ok) {
        const s = await r.json().catch(() => ({
          error: "unknown_error",
          message: r.statusText
        })), i = s.message || s.error;
        throw r.status === 401 ? new L(
          i || "Invalid or revoked API key",
          s.request_id
        ) : r.status === 422 || r.status === 400 ? new _(
          i,
          s.request_id,
          s.details
        ) : r.status === 404 ? new N(i, s.request_id) : r.status >= 500 ? new P(
          i,
          s.request_id,
          s.details
        ) : new m(
          i,
          r.status,
          s.request_id,
          s.details
        );
      }
      return await r.json();
    } catch (r) {
      throw r instanceof m ? r : r instanceof Error ? new E(`Network error: ${r.message}`, r) : new E("Unknown network error");
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
}, R = class {
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
}, A = class {
  constructor(e) {
    this.mediaStream = null, this.peerConnection = null, this.webSocket = null, this.streamId = null, this.keepaliveInterval = null, this.videoElement = null, this.isRunning = !1, this.validateConfig(e), this.config = e, this.logger = new R(e.debug ?? !1), this.client = new T({
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
        t.src = URL.createObjectURL(e.file), t.muted = !0, t.loop = !0, t.playsInline = !0, this.logger.debug("Loading video file:", e.file.name), await new Promise((r, s) => {
          const i = setTimeout(() => {
            s(new Error("Video loading timeout after 10 seconds"));
          }, 1e4);
          t.onloadedmetadata = () => {
            clearTimeout(i), this.logger.debug("Video metadata loaded"), r();
          }, t.onerror = (u) => {
            clearTimeout(i), this.logger.error("Video loading error:", u), s(new Error("Failed to load video file"));
          }, t.readyState >= 1 && (clearTimeout(i), r());
        }), await t.play(), this.logger.debug("Video playback started");
        const n = t.captureStream();
        if (!n)
          throw new Error("Failed to capture video stream");
        if (n.getVideoTracks().length === 0)
          throw new Error("Video stream has no video tracks");
        return this.videoElement = t, n;
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
    const n = e.getVideoTracks();
    if (!n || n.length === 0)
      return this.logger.warn("No video tracks found, using fallback FPS"), c.FALLBACK_FPS;
    const o = n[0];
    if (!o)
      return this.logger.warn("First video track is null, using fallback FPS"), c.FALLBACK_FPS;
    if (t.type === "camera") {
      const s = o.getSettings().frameRate ?? c.FALLBACK_FPS;
      return this.logger.debug("Detected camera FPS:", s), s;
    }
    return t.type === "video" && this.videoElement && (await new Promise((r, s) => {
      this.videoElement.readyState >= 1 ? r() : (this.videoElement.onloadedmetadata = () => r(), this.videoElement.onerror = () => s(new Error("Failed to load video metadata")));
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
      const n = await this.getStreamFps(this.mediaStream, e), o = this.config.iceServers ?? c.ICE_SERVERS;
      this.logger.debug("Creating peer connection with ICE servers"), this.peerConnection = new RTCPeerConnection({ iceServers: o }), this.peerConnection.onicecandidate = (i) => {
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
      const r = await this.peerConnection.createOffer();
      if (await this.peerConnection.setLocalDescription(r), !this.peerConnection.localDescription)
        throw new Error("Failed to create local description");
      this.logger.debug("Creating stream on server");
      const s = await this.client.createStream({
        webrtc: {
          type: "offer",
          sdp: this.peerConnection.localDescription.sdp
        },
        processing: this.getProcessingConfig(n),
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
      } catch (n) {
        this.logger.error("Keepalive failed:", n);
        const o = new Error(
          `Keepalive failed: ${n instanceof Error ? n.message : String(n)}`
        );
        await this.handleFatalError(o);
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
        const n = JSON.parse(t.data);
        this.config.onResult(n);
      } catch (n) {
        const o = new Error(
          `Failed to parse WebSocket message: ${n instanceof Error ? n.message : String(n)}`
        );
        this.handleNonFatalError(o);
      }
    }, this.webSocket.onerror = () => {
      this.logger.error("WebSocket error occurred");
      const t = new Error("WebSocket error occurred");
      this.handleFatalError(t);
    }, this.webSocket.onclose = (t) => {
      if (this.isRunning)
        if (t.code === 1008) {
          this.logger.error("WebSocket authentication failed");
          const n = new Error(
            "WebSocket authentication failed: Invalid or revoked API key"
          );
          this.handleFatalError(n);
        } else {
          this.logger.warn("WebSocket closed unexpectedly:", t.code);
          const n = new Error("WebSocket closed unexpectedly");
          this.handleFatalError(n);
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
const F = "ovs_148da6c73eff6fdde6431e7bc82e0dd8", v = "https://web-production-a1e61a.up.railway.app/get-product";
console.log("Seamless extension loaded");
let g = null, h = !1;
const f = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map(), p = /* @__PURE__ */ new Set(), w = [], b = 'Identify and list ONLY clothing items visible in the image. For each item, provide a specific product description optimized for shopping searches. Include: color(s), pattern/style (striped, solid, graphic, etc.), fit/type (slim, oversized, crop, etc.), sleeve length, visible material hints, and target gender/fit if obvious. Be concise but specific. Examples: "navy blue slim fit t-shirt", "black high-waisted skinny jeans", "white oversized linen button-up shirt", "burgundy wool cardigan with buttons". Ignore accessories, background, and non-clothing items. Separate items with commas only.';
function I() {
  if (w.length === 0)
    return b;
  const e = w.map((t) => `"${t}"`).join(", ");
  return `${b} Do NOT list any items similar to these already detected items: [${e}]`;
}
function O() {
  if (!g) return;
  const e = I();
  console.log("Updating prompt with exclusions:", w.length), console.log("New prompt:", e);
  try {
    g.updatePrompt(e);
  } catch (t) {
    console.error("Failed to update prompt:", t);
  }
}
function C() {
  w.length = 0, console.log("Cleared all detected items"), O();
}
function D(e, t) {
  const n = (S) => S.toLowerCase().replace(/[^a-z0-9]/g, ""), o = n(e), r = n(t);
  if (o.includes(r) || r.includes(o)) return !0;
  const s = new Set(e.toLowerCase().split(/\s+/)), i = new Set(t.toLowerCase().split(/\s+/)), u = [...s].filter((S) => i.has(S)), k = /* @__PURE__ */ new Set([...s, ...i]);
  return u.length / k.size > 0.6;
}
function x(e) {
  for (const [t, n] of f.entries())
    if (D(e, t))
      return console.log(`Found similar cached item: "${t}" for "${e}"`), n;
  return null;
}
async function $(e) {
  console.log("=== SEARCH PRODUCT START ==="), console.log("Item name:", e), console.log("Railway URL:", v);
  try {
    const t = JSON.stringify({ item_name: e });
    console.log("Request body:", t), console.log("Sending fetch request...");
    const n = await fetch(v, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: t
    });
    console.log("Response received!"), console.log("Response status:", n.status), console.log("Response ok:", n.ok);
    const o = await n.text();
    console.log("Response text:", o);
    let r;
    try {
      r = JSON.parse(o), console.log("Parsed response data:", r);
    } catch (s) {
      return console.error("Failed to parse response as JSON:", s), { error: "Invalid JSON response: " + o.substring(0, 100) };
    }
    return console.log("=== SEARCH PRODUCT SUCCESS ==="), r;
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
  const n = e.filter((o) => !o.error && (o.url || o.loading));
  if (n.length === 0) {
    console.log("No valid products to display (all errors filtered)"), t.innerHTML = '<div class="no-products">No products found</div>';
    return;
  }
  console.log("Creating product cards for", n.length, "valid products"), n.forEach((o, r) => {
    console.log(`Processing product ${r}:`, o);
    const s = document.createElement("div");
    s.className = "product-card", o.loading ? s.innerHTML = `
                <div class="product-loading">
                    <span class="loading-icon">⏳</span>
                    <span>Searching for ${o.itemName}...</span>
                </div>
            ` : o.url && (s.innerHTML = `
                ${o.image_url ? `<img class="product-image" src="${o.image_url}" alt="${o.itemName}" />` : ""}
                <div class="product-info">
                    <div class="product-name">${o.itemName || "Product"}</div>
                    ${o.name ? `<div class="product-title">${o.name}</div>` : ""}
                    ${o.price ? `<div class="product-price">${o.price}</div>` : ""}
                    ${o.fromCache ? '<div class="from-cache">📦 Cached</div>' : ""}
                </div>
                <button class="shop-btn" data-url="${o.url}">Shop Now →</button>
            `), t.appendChild(s);
  }), console.log("Final container innerHTML length:", t.innerHTML.length), console.log("Final container children count:", t.children.length), t.querySelectorAll(".shop-btn").forEach((o) => {
    o.onclick = () => {
      const r = o.getAttribute("data-url");
      r && window.open(r, "_blank");
    };
  });
}
async function B(e) {
  console.log("=== PROCESS NLP ITEMS START ==="), console.log("Item descriptions:", e), console.log("Current found products:", d.size);
  const t = document.getElementById("products");
  for (const n of e) {
    const o = n.trim();
    if (!o || o.toLowerCase() === "none") continue;
    const r = o.toLowerCase().replace(/[^a-z0-9]/g, "-");
    if (d.has(r) || p.has(r)) {
      console.log(`Skipping already processed: ${r}`);
      continue;
    }
    const s = x(o);
    if (s) {
      console.log("Using cached result for:", o), d.set(r, {
        itemName: o,
        normalizedKey: r,
        ...s,
        fromCache: !0
      }), y([...d.values()]);
      continue;
    }
    if (p.add(r), d.size > 0) {
      const i = [...d.values()];
      i.push({ itemName: o, loading: !0 }), y(i);
    } else
      t.innerHTML = '<div class="loading">🔍 Searching for products...</div>';
    try {
      const i = await $(o);
      console.log("Search result for", o, ":", i), f.set(o, i), d.set(r, {
        itemName: o,
        normalizedKey: r,
        ...i
      });
    } catch (i) {
      console.error("Error searching for", o, ":", i), d.set(r, {
        itemName: o,
        normalizedKey: r,
        error: i.message
      });
    } finally {
      p.delete(r);
    }
  }
  d.size > 0 && (console.log("Displaying all found products:", d.size), y([...d.values()])), console.log("=== PROCESS NLP ITEMS END ===");
}
document.addEventListener("DOMContentLoaded", async () => {
  async function e() {
    const o = (await navigator.mediaDevices.enumerateDevices()).filter((s) => s.kind === "videoinput"), r = document.getElementById("camera-select");
    r.innerHTML = o.map(
      (s, i) => `<option value="${s.deviceId}">${s.label || "Camera " + (i + 1)}</option>`
    ).join("");
  }
  await e();
  async function t() {
    if (!document.getElementById("camera-select").value) {
      document.getElementById("results").innerText = "Please select a camera first!";
      return;
    }
    g && await g.stop(), g = new A({
      apiUrl: "https://cluster1.overshoot.ai/api/v0.2",
      apiKey: F,
      prompt: I(),
      // Uses dynamic prompt with exclusions
      source: { type: "camera", cameraFacing: "user" },
      processing: {
        clip_length_seconds: 10,
        delay_seconds: 5,
        fps: 10,
        sampling_ratio: 0.1
      },
      onResult: async (r) => {
        if (h) return;
        h = !0, console.log("Got NLP result:", r);
        let s = "";
        if (typeof r == "string" ? s = r : r.result ? s = typeof r.result == "string" ? r.result : JSON.stringify(r.result) : s = JSON.stringify(r), console.log("Text result:", s), document.getElementById("results").innerText = s, s.toLowerCase().includes("none") || s.toLowerCase().includes("no clothing"))
          console.log("No clothing detected"), document.getElementById("results").innerText = "No clothing detected. Click Find Clothes to try again.";
        else {
          const i = s.split(/[,\n]/).map((u) => u.trim()).filter((u) => u.length > 0 && u.toLowerCase() !== "none");
          if (console.log("Parsed items:", i), i.length > 0)
            try {
              await B(i);
            } catch (u) {
              console.error("Error processing NLP items:", u), document.getElementById("results").innerText = "Error processing items: " + u.message;
            }
          document.getElementById("results").innerText = s + `

Detection complete.`;
        }
        try {
          console.log("Stopping Overshoot after first result..."), await g.stop(), console.log("Vision stopped successfully");
        } catch (i) {
          console.warn("Stop failed:", i);
        }
      },
      onMessage: (r) => {
        console.log("Got message:", r);
      },
      onStatusChange: (r) => {
        console.log("Status changed:", r), document.getElementById("results").innerText = "Status: " + r;
      },
      onError: (r) => {
        console.error("Vision error:", r), document.getElementById("results").innerText = "An error occurred: " + (r.message || JSON.stringify(r));
      }
    }), await g.start(), console.log("Vision started with camera.");
  }
  document.getElementById("find-btn").onclick = () => {
    console.log("Find Clothes clicked - starting detection..."), document.getElementById("results").innerText = "Detecting clothing...", document.getElementById("products").innerHTML = "", d.clear(), f.clear(), C(), h = !1, t();
  }, document.getElementById("clear-btn").onclick = () => {
    console.log("Clearing all cached products and detected items..."), f.clear(), d.clear(), p.clear(), C(), document.getElementById("products").innerHTML = "", document.getElementById("results").innerText = "", console.log("All caches cleared!");
  }, document.getElementById("stop-btn").onclick = async () => {
    g && (console.log("Stopping Overshoot vision..."), h = !0, await g.stop(), g = null, document.getElementById("results").innerText = "Detection stopped.", console.log("Vision stopped."));
  }, document.getElementById("start-btn").onclick = async () => {
    const o = document.getElementById("camera-select").value, r = document.getElementById("preview");
    console.log("Starting camera with device:", o);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: o ? { exact: o } : void 0 }
      });
      r.srcObject = s, console.log("Camera started successfully"), await e();
    } catch (s) {
      console.error("Error starting camera:", s), document.getElementById("results").innerText = "Error starting camera: " + s.message;
    }
  };
});
