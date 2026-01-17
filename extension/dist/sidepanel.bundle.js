var d = class extends Error {
  constructor(e, t, s, n) {
    super(e), this.name = "ApiError", this.statusCode = t, this.requestId = s, this.details = n;
  }
}, p = class extends d {
  constructor(e, t) {
    super(e, 401, t), this.name = "UnauthorizedError";
  }
}, w = class extends d {
  constructor(e, t, s) {
    super(e, 422, t, s), this.name = "ValidationError";
  }
}, f = class extends d {
  constructor(e, t) {
    super(e, 404, t), this.name = "NotFoundError";
  }
}, m = class extends d {
  constructor(e, t) {
    super(e), this.name = "NetworkError", this.cause = t;
  }
}, S = class extends d {
  constructor(e, t, s) {
    super(e, 500, t, s), this.name = "ServerError";
  }
}, E = class {
  constructor(e) {
    if (!e.apiKey || typeof e.apiKey != "string")
      throw new Error("apiKey is required and must be a string");
    this.baseUrl = e.baseUrl, this.apiKey = e.apiKey;
  }
  async request(e, t = {}) {
    const s = `${this.baseUrl}${e}`, n = new AbortController();
    try {
      const r = await fetch(s, {
        ...t,
        signal: n.signal,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          ...t.headers
        }
      });
      if (!r.ok) {
        const i = await r.json().catch(() => ({
          error: "unknown_error",
          message: r.statusText
        })), a = i.message || i.error;
        throw r.status === 401 ? new p(
          a || "Invalid or revoked API key",
          i.request_id
        ) : r.status === 422 || r.status === 400 ? new w(
          a,
          i.request_id,
          i.details
        ) : r.status === 404 ? new f(a, i.request_id) : r.status >= 500 ? new S(
          a,
          i.request_id,
          i.details
        ) : new d(
          a,
          r.status,
          i.request_id,
          i.details
        );
      }
      return await r.json();
    } catch (r) {
      throw r instanceof d ? r : r instanceof Error ? new m(`Network error: ${r.message}`, r) : new m("Unknown network error");
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
}, o = {
  SAMPLING_RATIO: { min: 0, max: 1 },
  FPS: { min: 1, max: 120 },
  CLIP_LENGTH_SECONDS: { min: 0.1, max: 60 },
  DELAY_SECONDS: { min: 0, max: 60 },
  RATING: { min: 1, max: 5 }
}, y = class {
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
}, v = class {
  constructor(e) {
    this.mediaStream = null, this.peerConnection = null, this.webSocket = null, this.streamId = null, this.keepaliveInterval = null, this.videoElement = null, this.isRunning = !1, this.validateConfig(e), this.config = e, this.logger = new y(e.debug ?? !1), this.client = new E({
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
      if (t < o.SAMPLING_RATIO.min || t > o.SAMPLING_RATIO.max)
        throw new l(
          `sampling_ratio must be between ${o.SAMPLING_RATIO.min} and ${o.SAMPLING_RATIO.max}`
        );
    }
    if (e.processing?.fps !== void 0) {
      const t = e.processing.fps;
      if (t < o.FPS.min || t > o.FPS.max)
        throw new l(
          `fps must be between ${o.FPS.min} and ${o.FPS.max}`
        );
    }
    if (e.processing?.clip_length_seconds !== void 0) {
      const t = e.processing.clip_length_seconds;
      if (t < o.CLIP_LENGTH_SECONDS.min || t > o.CLIP_LENGTH_SECONDS.max)
        throw new l(
          `clip_length_seconds must be between ${o.CLIP_LENGTH_SECONDS.min} and ${o.CLIP_LENGTH_SECONDS.max}`
        );
    }
    if (e.processing?.delay_seconds !== void 0) {
      const t = e.processing.delay_seconds;
      if (t < o.DELAY_SECONDS.min || t > o.DELAY_SECONDS.max)
        throw new l(
          `delay_seconds must be between ${o.DELAY_SECONDS.min} and ${o.DELAY_SECONDS.max}`
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
        t.src = URL.createObjectURL(e.file), t.muted = !0, t.loop = !0, t.playsInline = !0, this.logger.debug("Loading video file:", e.file.name), await new Promise((r, i) => {
          const a = setTimeout(() => {
            i(new Error("Video loading timeout after 10 seconds"));
          }, 1e4);
          t.onloadedmetadata = () => {
            clearTimeout(a), this.logger.debug("Video metadata loaded"), r();
          }, t.onerror = (u) => {
            clearTimeout(a), this.logger.error("Video loading error:", u), i(new Error("Failed to load video file"));
          }, t.readyState >= 1 && (clearTimeout(a), r());
        }), await t.play(), this.logger.debug("Video playback started");
        const s = t.captureStream();
        if (!s)
          throw new Error("Failed to capture video stream");
        if (s.getVideoTracks().length === 0)
          throw new Error("Video stream has no video tracks");
        return this.videoElement = t, s;
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
    const s = e.getVideoTracks();
    if (!s || s.length === 0)
      return this.logger.warn("No video tracks found, using fallback FPS"), c.FALLBACK_FPS;
    const n = s[0];
    if (!n)
      return this.logger.warn("First video track is null, using fallback FPS"), c.FALLBACK_FPS;
    if (t.type === "camera") {
      const i = n.getSettings().frameRate ?? c.FALLBACK_FPS;
      return this.logger.debug("Detected camera FPS:", i), i;
    }
    return t.type === "video" && this.videoElement && (await new Promise((r, i) => {
      this.videoElement.readyState >= 1 ? r() : (this.videoElement.onloadedmetadata = () => r(), this.videoElement.onerror = () => i(new Error("Failed to load video metadata")));
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
      const s = await this.getStreamFps(this.mediaStream, e), n = this.config.iceServers ?? c.ICE_SERVERS;
      this.logger.debug("Creating peer connection with ICE servers"), this.peerConnection = new RTCPeerConnection({ iceServers: n }), this.peerConnection.onicecandidate = (a) => {
        a.candidate ? this.logger.debug("ICE candidate:", {
          type: a.candidate.type,
          protocol: a.candidate.protocol
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
      const i = await this.client.createStream({
        webrtc: {
          type: "offer",
          sdp: this.peerConnection.localDescription.sdp
        },
        processing: this.getProcessingConfig(s),
        inference: {
          prompt: this.config.prompt,
          backend: this.config.backend ?? c.BACKEND,
          model: this.config.model ?? c.MODEL,
          output_schema_json: this.config.outputSchema
        }
      });
      this.logger.debug("Backend response received:", {
        stream_id: i.stream_id,
        has_turn_servers: !!i.turn_servers
      }), await this.peerConnection.setRemoteDescription(i.webrtc), this.streamId = i.stream_id, this.logger.info("Stream started:", this.streamId), this.setupKeepalive(i.lease?.ttl_seconds), this.setupWebSocket(i.stream_id), this.isRunning = !0;
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
      } catch (s) {
        this.logger.error("Keepalive failed:", s);
        const n = new Error(
          `Keepalive failed: ${s instanceof Error ? s.message : String(s)}`
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
        const s = JSON.parse(t.data);
        this.config.onResult(s);
      } catch (s) {
        const n = new Error(
          `Failed to parse WebSocket message: ${s instanceof Error ? s.message : String(s)}`
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
          const s = new Error(
            "WebSocket authentication failed: Invalid or revoked API key"
          );
          this.handleFatalError(s);
        } else {
          this.logger.warn("WebSocket closed unexpectedly:", t.code);
          const s = new Error("WebSocket closed unexpectedly");
          this.handleFatalError(s);
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
    if (e.rating < o.RATING.min || e.rating > o.RATING.max)
      throw new l(
        `rating must be between ${o.RATING.min} and ${o.RATING.max}`
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
const b = "ovs_148da6c73eff6fdde6431e7bc82e0dd8";
console.log("Seamless extension loaded");
let h = null, g = null;
document.addEventListener("DOMContentLoaded", async () => {
  async function e() {
    const n = (await navigator.mediaDevices.enumerateDevices()).filter((i) => i.kind === "videoinput"), r = document.getElementById("camera-select");
    r.innerHTML = n.map(
      (i, a) => `<option value="${i.deviceId}">${i.label || "Camera " + (a + 1)}</option>`
    ).join("");
  }
  await e();
  async function t() {
    if (!document.getElementById("camera-select").value) {
      document.getElementById("results").innerText = "Please select a camera first!";
      return;
    }
    g && await g.stop(), g = new v({
      apiUrl: "https://cluster1.overshoot.ai/api/v0.2",
      apiKey: b,
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
                style: { type: "string" }
              }
            }
          }
        }
      },
      onResult: (r) => {
        console.log("Got result:", r);
        try {
          h = typeof r == "string" ? JSON.parse(r) : r.result ? typeof r.result == "string" ? JSON.parse(r.result) : r.result : r, console.log("Parsed clothing data:", h), document.getElementById("results").innerText = JSON.stringify(h, null, 2);
        } catch (i) {
          console.log("Parse error:", i), console.log("Raw result:", r), document.getElementById("results").innerText = typeof r == "string" ? r : JSON.stringify(r, null, 2);
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
    document.getElementById("results").innerText = "Detecting clothing...", t();
  }, document.getElementById("start-btn").onclick = async () => {
    const n = document.getElementById("camera-select").value, r = document.getElementById("preview");
    console.log("Starting camera with device:", n);
    try {
      const i = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: n ? { exact: n } : void 0 }
      });
      r.srcObject = i, console.log("Camera started successfully"), await e();
    } catch (i) {
      console.error("Error starting camera:", i), document.getElementById("results").innerText = "Error starting camera: " + i.message;
    }
  };
});
