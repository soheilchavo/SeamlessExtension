(() => {
  // node_modules/@overshoot/sdk/dist/index.mjs
  var ApiError = class extends Error {
    constructor(message, statusCode, requestId, details) {
      super(message);
      this.name = "ApiError";
      this.statusCode = statusCode;
      this.requestId = requestId;
      this.details = details;
    }
  };
  var UnauthorizedError = class extends ApiError {
    constructor(message, requestId) {
      super(message, 401, requestId);
      this.name = "UnauthorizedError";
    }
  };
  var ValidationError = class extends ApiError {
    constructor(message, requestId, details) {
      super(message, 422, requestId, details);
      this.name = "ValidationError";
    }
  };
  var NotFoundError = class extends ApiError {
    constructor(message, requestId) {
      super(message, 404, requestId);
      this.name = "NotFoundError";
    }
  };
  var NetworkError = class extends ApiError {
    constructor(message, cause) {
      super(message);
      this.name = "NetworkError";
      this.cause = cause;
    }
  };
  var ServerError = class extends ApiError {
    constructor(message, requestId, details) {
      super(message, 500, requestId, details);
      this.name = "ServerError";
    }
  };
  var StreamClient = class {
    constructor(config) {
      if (!config.apiKey || typeof config.apiKey !== "string") {
        throw new Error("apiKey is required and must be a string");
      }
      this.baseUrl = config.baseUrl;
      this.apiKey = config.apiKey;
    }
    async request(path, options = {}) {
      const url = `${this.baseUrl}${path}`;
      const controller = new AbortController();
      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
            ...options.headers
          }
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({
            error: "unknown_error",
            message: response.statusText
          }));
          const message = errorData.message || errorData.error;
          if (response.status === 401) {
            throw new UnauthorizedError(
              message || "Invalid or revoked API key",
              errorData.request_id
            );
          }
          if (response.status === 422 || response.status === 400) {
            throw new ValidationError(
              message,
              errorData.request_id,
              errorData.details
            );
          }
          if (response.status === 404) {
            throw new NotFoundError(message, errorData.request_id);
          }
          if (response.status >= 500) {
            throw new ServerError(
              message,
              errorData.request_id,
              errorData.details
            );
          }
          throw new ApiError(
            message,
            response.status,
            errorData.request_id,
            errorData.details
          );
        }
        return await response.json();
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }
        if (error instanceof Error) {
          throw new NetworkError(`Network error: ${error.message}`, error);
        }
        throw new NetworkError("Unknown network error");
      }
    }
    async createStream(request) {
      return this.request("/streams", {
        method: "POST",
        body: JSON.stringify(request)
      });
    }
    async renewLease(streamId) {
      return this.request(`/streams/${streamId}/keepalive`, {
        method: "POST"
      });
    }
    async updatePrompt(streamId, prompt) {
      return this.request(
        `/streams/${streamId}/config/prompt`,
        {
          method: "PATCH",
          body: JSON.stringify({ prompt })
        }
      );
    }
    async submitFeedback(streamId, feedback) {
      return this.request(`/streams/${streamId}/feedback`, {
        method: "POST",
        body: JSON.stringify(feedback)
      });
    }
    async getAllFeedback() {
      return this.request("/streams/feedback", {
        method: "GET"
      });
    }
    connectWebSocket(streamId) {
      const wsUrl = this.baseUrl.replace("http://", "ws://").replace("https://", "wss://");
      return new WebSocket(`${wsUrl}/ws/streams/${streamId}`);
    }
    /**
     * Health check endpoint (for testing, uses internal port if available)
     * Note: This endpoint may not be available via the main API
     */
    async healthCheck() {
      const url = `${this.baseUrl}/healthz`;
      const response = await fetch(url, {
        credentials: "include"
      });
      return response.text();
    }
  };
  var DEFAULTS = {
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
  };
  var CONSTRAINTS = {
    SAMPLING_RATIO: { min: 0, max: 1 },
    FPS: { min: 1, max: 120 },
    CLIP_LENGTH_SECONDS: { min: 0.1, max: 60 },
    DELAY_SECONDS: { min: 0, max: 60 },
    RATING: { min: 1, max: 5 }
  };
  var Logger = class {
    constructor(debugEnabled = false) {
      this.debugEnabled = debugEnabled;
    }
    debug(...args) {
      if (this.debugEnabled) {
        console.log("[RealtimeVision Debug]", ...args);
      }
    }
    info(...args) {
      console.log("[RealtimeVision]", ...args);
    }
    warn(...args) {
      console.warn("[RealtimeVision]", ...args);
    }
    error(...args) {
      console.error("[RealtimeVision]", ...args);
    }
  };
  var ValidationError2 = class extends Error {
    constructor(message) {
      super(message);
      this.name = "ValidationError";
    }
  };
  var RealtimeVision = class {
    constructor(config) {
      this.mediaStream = null;
      this.peerConnection = null;
      this.webSocket = null;
      this.streamId = null;
      this.keepaliveInterval = null;
      this.videoElement = null;
      this.isRunning = false;
      this.validateConfig(config);
      this.config = config;
      this.logger = new Logger(config.debug ?? false);
      this.client = new StreamClient({
        baseUrl: config.apiUrl,
        apiKey: config.apiKey
      });
    }
    /**
     * Validate configuration values
     */
    validateConfig(config) {
      if (!config.apiUrl || typeof config.apiUrl !== "string") {
        throw new ValidationError2("apiUrl is required and must be a string");
      }
      if (!config.apiKey || typeof config.apiKey !== "string") {
        throw new ValidationError2("apiKey is required and must be a string");
      }
      if (!config.prompt || typeof config.prompt !== "string") {
        throw new ValidationError2("prompt is required and must be a string");
      }
      if (config.source) {
        if (config.source.type === "camera") {
          if (config.source.cameraFacing !== "user" && config.source.cameraFacing !== "environment") {
            throw new ValidationError2(
              'cameraFacing must be "user" or "environment"'
            );
          }
        } else if (config.source.type === "video") {
          if (!(config.source.file instanceof File)) {
            throw new ValidationError2("video source must provide a File object");
          }
        } else {
          throw new ValidationError2('source.type must be "camera" or "video"');
        }
      }
      if (config.processing?.sampling_ratio !== void 0) {
        const ratio = config.processing.sampling_ratio;
        if (ratio < CONSTRAINTS.SAMPLING_RATIO.min || ratio > CONSTRAINTS.SAMPLING_RATIO.max) {
          throw new ValidationError2(
            `sampling_ratio must be between ${CONSTRAINTS.SAMPLING_RATIO.min} and ${CONSTRAINTS.SAMPLING_RATIO.max}`
          );
        }
      }
      if (config.processing?.fps !== void 0) {
        const fps = config.processing.fps;
        if (fps < CONSTRAINTS.FPS.min || fps > CONSTRAINTS.FPS.max) {
          throw new ValidationError2(
            `fps must be between ${CONSTRAINTS.FPS.min} and ${CONSTRAINTS.FPS.max}`
          );
        }
      }
      if (config.processing?.clip_length_seconds !== void 0) {
        const clip = config.processing.clip_length_seconds;
        if (clip < CONSTRAINTS.CLIP_LENGTH_SECONDS.min || clip > CONSTRAINTS.CLIP_LENGTH_SECONDS.max) {
          throw new ValidationError2(
            `clip_length_seconds must be between ${CONSTRAINTS.CLIP_LENGTH_SECONDS.min} and ${CONSTRAINTS.CLIP_LENGTH_SECONDS.max}`
          );
        }
      }
      if (config.processing?.delay_seconds !== void 0) {
        const delay = config.processing.delay_seconds;
        if (delay < CONSTRAINTS.DELAY_SECONDS.min || delay > CONSTRAINTS.DELAY_SECONDS.max) {
          throw new ValidationError2(
            `delay_seconds must be between ${CONSTRAINTS.DELAY_SECONDS.min} and ${CONSTRAINTS.DELAY_SECONDS.max}`
          );
        }
      }
    }
    /**
     * Create media stream from the configured source
     */
    async createMediaStream(source) {
      this.logger.debug("Creating media stream from source:", source.type);
      switch (source.type) {
        case "camera":
          return await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: source.cameraFacing } },
            audio: false
          });
        case "video":
          const video = document.createElement("video");
          video.src = URL.createObjectURL(source.file);
          video.muted = true;
          video.loop = true;
          video.playsInline = true;
          this.logger.debug("Loading video file:", source.file.name);
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error("Video loading timeout after 10 seconds"));
            }, 1e4);
            video.onloadedmetadata = () => {
              clearTimeout(timeout);
              this.logger.debug("Video metadata loaded");
              resolve();
            };
            video.onerror = (e) => {
              clearTimeout(timeout);
              this.logger.error("Video loading error:", e);
              reject(new Error("Failed to load video file"));
            };
            if (video.readyState >= 1) {
              clearTimeout(timeout);
              resolve();
            }
          });
          await video.play();
          this.logger.debug("Video playback started");
          const stream = video.captureStream();
          if (!stream) {
            throw new Error("Failed to capture video stream");
          }
          const videoTracks = stream.getVideoTracks();
          if (videoTracks.length === 0) {
            throw new Error("Video stream has no video tracks");
          }
          this.videoElement = video;
          return stream;
        default:
          throw new Error(`Unknown source type: ${source.type}`);
      }
    }
    /**
     * Get FPS from media stream
     */
    async getStreamFps(stream, source) {
      if (!stream) {
        this.logger.warn("Stream is null, using fallback FPS");
        return DEFAULTS.FALLBACK_FPS;
      }
      const videoTracks = stream.getVideoTracks();
      if (!videoTracks || videoTracks.length === 0) {
        this.logger.warn("No video tracks found, using fallback FPS");
        return DEFAULTS.FALLBACK_FPS;
      }
      const videoTrack = videoTracks[0];
      if (!videoTrack) {
        this.logger.warn("First video track is null, using fallback FPS");
        return DEFAULTS.FALLBACK_FPS;
      }
      if (source.type === "camera") {
        const settings = videoTrack.getSettings();
        const fps = settings.frameRate ?? DEFAULTS.FALLBACK_FPS;
        this.logger.debug("Detected camera FPS:", fps);
        return fps;
      }
      if (source.type === "video" && this.videoElement) {
        await new Promise((resolve, reject) => {
          if (this.videoElement.readyState >= 1) {
            resolve();
          } else {
            this.videoElement.onloadedmetadata = () => resolve();
            this.videoElement.onerror = () => reject(new Error("Failed to load video metadata"));
          }
        });
        this.logger.debug("Using fallback FPS for video file");
        return DEFAULTS.FALLBACK_FPS;
      }
      return DEFAULTS.FALLBACK_FPS;
    }
    /**
     * Get processing configuration with defaults applied
     */
    getProcessingConfig(detectedFps) {
      const userProcessing = this.config.processing || {};
      return {
        sampling_ratio: userProcessing.sampling_ratio ?? DEFAULTS.SAMPLING_RATIO,
        fps: userProcessing.fps ?? detectedFps,
        clip_length_seconds: userProcessing.clip_length_seconds ?? DEFAULTS.CLIP_LENGTH_SECONDS,
        delay_seconds: userProcessing.delay_seconds ?? DEFAULTS.DELAY_SECONDS
      };
    }
    /**
     * Get the effective source configuration
     */
    getSource() {
      return this.config.source ?? DEFAULTS.SOURCE;
    }
    /**
     * Start the vision stream
     */
    async start() {
      if (this.isRunning) {
        throw new Error("Vision stream already running");
      }
      try {
        const source = this.getSource();
        this.logger.debug("Starting stream with source type:", source.type);
        if (source.type === "video") {
          this.logger.debug("Video file:", {
            name: source.file.name,
            size: source.file.size,
            type: source.file.type
          });
          if (!source.file || !(source.file instanceof File)) {
            throw new Error("Invalid video file");
          }
        }
        this.mediaStream = await this.createMediaStream(source);
        const videoTrack = this.mediaStream.getVideoTracks()[0];
        if (!videoTrack) {
          throw new Error("No video track available");
        }
        const detectedFps = await this.getStreamFps(this.mediaStream, source);
        const iceServers = this.config.iceServers ?? DEFAULTS.ICE_SERVERS;
        this.logger.debug("Creating peer connection with ICE servers");
        this.peerConnection = new RTCPeerConnection({ iceServers });
        this.peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            this.logger.debug("ICE candidate:", {
              type: event.candidate.type,
              protocol: event.candidate.protocol
            });
          } else {
            this.logger.debug("ICE gathering complete");
          }
        };
        this.peerConnection.oniceconnectionstatechange = () => {
          this.logger.debug(
            "ICE connection state:",
            this.peerConnection?.iceConnectionState
          );
        };
        this.peerConnection.addTrack(videoTrack, this.mediaStream);
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);
        if (!this.peerConnection.localDescription) {
          throw new Error("Failed to create local description");
        }
        this.logger.debug("Creating stream on server");
        const response = await this.client.createStream({
          webrtc: {
            type: "offer",
            sdp: this.peerConnection.localDescription.sdp
          },
          processing: this.getProcessingConfig(detectedFps),
          inference: {
            prompt: this.config.prompt,
            backend: this.config.backend ?? DEFAULTS.BACKEND,
            model: this.config.model ?? DEFAULTS.MODEL,
            output_schema_json: this.config.outputSchema
          }
        });
        this.logger.debug("Backend response received:", {
          stream_id: response.stream_id,
          has_turn_servers: !!response.turn_servers
        });
        await this.peerConnection.setRemoteDescription(response.webrtc);
        this.streamId = response.stream_id;
        this.logger.info("Stream started:", this.streamId);
        this.setupKeepalive(response.lease?.ttl_seconds);
        this.setupWebSocket(response.stream_id);
        this.isRunning = true;
      } catch (error) {
        await this.handleFatalError(error);
        throw error;
      }
    }
    /**
     * Set up keepalive interval with error handling
     */
    setupKeepalive(ttlSeconds) {
      if (!ttlSeconds) {
        return;
      }
      const intervalMs = ttlSeconds / 2 * 1e3;
      this.logger.debug("Setting up keepalive with interval:", intervalMs, "ms");
      this.keepaliveInterval = window.setInterval(async () => {
        try {
          if (this.streamId) {
            await this.client.renewLease(this.streamId);
            this.logger.debug("Lease renewed");
          }
        } catch (error) {
          this.logger.error("Keepalive failed:", error);
          const keepaliveError = new Error(
            `Keepalive failed: ${error instanceof Error ? error.message : String(error)}`
          );
          await this.handleFatalError(keepaliveError);
        }
      }, intervalMs);
    }
    /**
     * Set up WebSocket connection with error handling
     */
    setupWebSocket(streamId) {
      this.logger.debug("Connecting WebSocket for stream:", streamId);
      this.webSocket = this.client.connectWebSocket(streamId);
      this.webSocket.onopen = () => {
        this.logger.debug("WebSocket connected");
        if (this.webSocket) {
          this.webSocket.send(JSON.stringify({ api_key: this.config.apiKey }));
        }
      };
      this.webSocket.onmessage = (event) => {
        try {
          const result = JSON.parse(event.data);
          this.config.onResult(result);
        } catch (error) {
          const parseError = new Error(
            `Failed to parse WebSocket message: ${error instanceof Error ? error.message : String(error)}`
          );
          this.handleNonFatalError(parseError);
        }
      };
      this.webSocket.onerror = () => {
        this.logger.error("WebSocket error occurred");
        const error = new Error("WebSocket error occurred");
        this.handleFatalError(error);
      };
      this.webSocket.onclose = (event) => {
        if (this.isRunning) {
          if (event.code === 1008) {
            this.logger.error("WebSocket authentication failed");
            const error = new Error(
              "WebSocket authentication failed: Invalid or revoked API key"
            );
            this.handleFatalError(error);
          } else {
            this.logger.warn("WebSocket closed unexpectedly:", event.code);
            const error = new Error("WebSocket closed unexpectedly");
            this.handleFatalError(error);
          }
        } else {
          this.logger.debug("WebSocket closed");
        }
      };
    }
    /**
     * Handle non-fatal errors (report but don't stop stream)
     */
    handleNonFatalError(error) {
      this.logger.warn("Non-fatal error:", error.message);
      if (this.config.onError) {
        this.config.onError(error);
      }
    }
    /**
     * Handle fatal errors (stop stream and report)
     */
    async handleFatalError(error) {
      this.logger.error("Fatal error:", error);
      await this.cleanup();
      this.isRunning = false;
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      if (this.config.onError) {
        this.config.onError(normalizedError);
      }
    }
    /**
     * Update the prompt/task while stream is running
     */
    async updatePrompt(prompt) {
      if (!this.isRunning || !this.streamId) {
        throw new Error("Vision stream not running");
      }
      if (!prompt || typeof prompt !== "string") {
        throw new ValidationError2("prompt must be a non-empty string");
      }
      this.logger.debug("Updating prompt");
      await this.client.updatePrompt(this.streamId, prompt);
      this.logger.info("Prompt updated");
    }
    /**
     * Stop the vision stream and clean up resources
     */
    async stop() {
      this.logger.info("Stopping stream");
      await this.cleanup();
      this.isRunning = false;
    }
    /**
     * Submit feedback for the stream
     */
    async submitFeedback(feedback) {
      if (!this.streamId) {
        throw new Error("No active stream");
      }
      if (feedback.rating < CONSTRAINTS.RATING.min || feedback.rating > CONSTRAINTS.RATING.max) {
        throw new ValidationError2(
          `rating must be between ${CONSTRAINTS.RATING.min} and ${CONSTRAINTS.RATING.max}`
        );
      }
      if (!feedback.category || typeof feedback.category !== "string") {
        throw new ValidationError2("category must be a non-empty string");
      }
      this.logger.debug("Submitting feedback");
      await this.client.submitFeedback(this.streamId, {
        rating: feedback.rating,
        category: feedback.category,
        feedback: feedback.feedback ?? ""
      });
      this.logger.info("Feedback submitted");
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
      this.logger.debug("Cleaning up resources");
      if (this.keepaliveInterval) {
        window.clearInterval(this.keepaliveInterval);
        this.keepaliveInterval = null;
      }
      if (this.webSocket) {
        this.webSocket.close();
        this.webSocket = null;
      }
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach((track) => track.stop());
        this.mediaStream = null;
      }
      if (this.videoElement) {
        this.videoElement.pause();
        URL.revokeObjectURL(this.videoElement.src);
        this.videoElement.remove();
        this.videoElement = null;
      }
      this.streamId = null;
      this.logger.debug("Cleanup complete");
    }
  };

  // extension/sidepanel.js
  var API_KEY = "ovs_148da6c73eff6fdde6431e7bc82e0dd8";
  var RAILWAY_URL = "https://web-production-a1e61a.up.railway.app/get-product";
  console.log("Seamless extension loaded");
  var vision = null;
  var findClothesClickCount = 0;
  var hasStopped = false;
  var productCache = /* @__PURE__ */ new Map();
  var foundProducts = /* @__PURE__ */ new Map();
  var pendingSearches = /* @__PURE__ */ new Set();
  var detectedItems = [];
  var BASE_PROMPT = `Identify and list ONLY clothing items visible in the image. For each item, provide a specific product description optimized for shopping searches. Include: color(s), pattern/style (striped, solid, graphic, etc.), fit/type (slim, oversized, crop, etc.), sleeve length, visible material hints, and target gender/fit if obvious. Be concise but specific. Examples: "navy blue slim fit t-shirt", "black high-waisted skinny jeans", "white oversized linen button-up shirt", "burgundy wool cardigan with buttons". Ignore accessories, background, and non-clothing items. Separate items with commas only.`;
  function buildPrompt() {
    if (detectedItems.length === 0) {
      return BASE_PROMPT;
    }
    const exclusions = detectedItems.map((item) => `"${item}"`).join(", ");
    return `${BASE_PROMPT} Do NOT list any items similar to these already detected items: [${exclusions}]`;
  }
  function updateVisionPrompt() {
    if (!vision) return;
    const newPrompt = buildPrompt();
    console.log("Updating prompt with exclusions:", detectedItems.length);
    console.log("New prompt:", newPrompt);
    try {
      vision.updatePrompt(newPrompt);
    } catch (e) {
      console.error("Failed to update prompt:", e);
    }
  }
  function clearDetectedItems() {
    detectedItems.length = 0;
    console.log("Cleared all detected items");
    updateVisionPrompt();
  }
  function getSavedProducts() {
    try {
      const saved = localStorage.getItem("savedProducts");
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error("Error loading saved products:", error);
      return [];
    }
  }
  function saveProduct(product) {
    const saved = getSavedProducts();
    const exists = saved.find((p) => p.normalizedKey === product.normalizedKey);
    if (!exists) {
      saved.push(product);
      localStorage.setItem("savedProducts", JSON.stringify(saved));
      console.log("Product saved:", product.itemName);
    }
  }
  function unsaveProduct(normalizedKey) {
    const saved = getSavedProducts();
    const filtered = saved.filter((p) => p.normalizedKey !== normalizedKey);
    localStorage.setItem("savedProducts", JSON.stringify(filtered));
    console.log("Product unsaved:", normalizedKey);
  }
  function isProductSaved(normalizedKey) {
    const saved = getSavedProducts();
    return saved.some((p) => p.normalizedKey === normalizedKey);
  }
  function isSimilarItem(desc1, desc2) {
    const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const n1 = normalize(desc1);
    const n2 = normalize(desc2);
    if (n1.includes(n2) || n2.includes(n1)) return true;
    const words1 = new Set(desc1.toLowerCase().split(/\s+/));
    const words2 = new Set(desc2.toLowerCase().split(/\s+/));
    const intersection = [...words1].filter((w) => words2.has(w));
    const union = /* @__PURE__ */ new Set([...words1, ...words2]);
    const similarity = intersection.length / union.size;
    return similarity > 0.6;
  }
  function findSimilarCachedItem(itemName) {
    for (const [cachedName, cachedResult] of productCache.entries()) {
      if (isSimilarItem(itemName, cachedName)) {
        console.log(`Found similar cached item: "${cachedName}" for "${itemName}"`);
        return cachedResult;
      }
    }
    return null;
  }
  async function searchProduct(itemName) {
    console.log("=== SEARCH PRODUCT START ===");
    console.log("Item name:", itemName);
    console.log("Railway URL:", RAILWAY_URL);
    try {
      const requestBody = JSON.stringify({ item_name: itemName });
      console.log("Request body:", requestBody);
      console.log("Sending fetch request...");
      const response = await fetch(RAILWAY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody
      });
      console.log("Response received!");
      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);
      const responseText = await response.text();
      console.log("Response text:", responseText);
      let data;
      try {
        data = JSON.parse(responseText);
        console.log("Parsed response data:", data);
      } catch (parseError) {
        console.error("Failed to parse response as JSON:", parseError);
        return { error: "Invalid JSON response: " + responseText.substring(0, 100) };
      }
      console.log("=== SEARCH PRODUCT SUCCESS ===");
      return data;
    } catch (error) {
      console.error("=== SEARCH PRODUCT ERROR ===");
      console.error("Error type:", error.name);
      console.error("Error message:", error.message);
      console.error("Full error:", error);
      return { error: error.message };
    }
  }
  function displayProducts(products) {
    console.log("=== DISPLAY PRODUCTS ===");
    console.log("Products to display:", products);
    console.log("Products count:", products?.length);
    const productsContainer = document.getElementById("products");
    console.log("Products container found:", !!productsContainer);
    console.log("Products container element:", productsContainer);
    if (!productsContainer) {
      console.error("ERROR: Products container not found in DOM!");
      return;
    }
    productsContainer.innerHTML = "";
    if (!products || products.length === 0) {
      console.log("No products to display");
      productsContainer.innerHTML = '<div class="no-products">No products found</div>';
      return;
    }
    const validProducts = products.filter((p) => !p.error && (p.url || p.loading));
    if (validProducts.length === 0) {
      console.log("No valid products to display (all errors filtered)");
      productsContainer.innerHTML = '<div class="no-products">No products found</div>';
      return;
    }
    console.log("Creating product cards for", validProducts.length, "valid products");
    validProducts.forEach((product, index) => {
      console.log(`Processing product ${index}:`, product);
      const productCard = document.createElement("div");
      productCard.className = "product-card";
      if (product.loading) {
        productCard.innerHTML = `
                <div class="product-loading">
                    <span class="loading-icon">\u23F3</span>
                    <span>Searching for ${product.itemName}...</span>
                </div>
            `;
      } else if (product.url) {
        console.log("Product data:", product);
        console.log("Image URL:", product.image_url);
        const imageHtml = product.image_url ? `<img class="product-image" src="${product.image_url}" alt="${product.itemName}" onerror="this.style.display='none'" />` : `<div class="product-image product-placeholder">
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="2">
                       <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                       <circle cx="8.5" cy="8.5" r="1.5"/>
                       <polyline points="21 15 16 10 5 21"/>
                     </svg>
                   </div>`;
        const isSaved = isProductSaved(product.normalizedKey);
        const saveIconClass = isSaved ? "saved" : "";
        productCard.innerHTML = `
                <button class="save-btn ${saveIconClass}" data-key="${product.normalizedKey}">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${isSaved ? "#ff3b5c" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                </button>
                ${imageHtml}
                <div class="product-info">
                    <div class="product-name">${product.itemName || "Product"}</div>
                    ${product.name ? `<div class="product-title">${product.name}</div>` : ""}
                    ${product.price ? `<div class="product-price">${product.price}</div>` : ""}
                    ${product.fromCache ? '<div class="from-cache">\u{1F4E6} Cached</div>' : ""}
                </div>
                <button class="shop-btn" data-url="${product.url}">Shop Now \u2192</button>
            `;
      }
      productsContainer.appendChild(productCard);
    });
    console.log("Final container innerHTML length:", productsContainer.innerHTML.length);
    console.log("Final container children count:", productsContainer.children.length);
    productsContainer.querySelectorAll(".shop-btn").forEach((btn) => {
      btn.onclick = () => {
        const url = btn.getAttribute("data-url");
        if (url) {
          window.open(url, "_blank");
        }
      };
    });
    productsContainer.querySelectorAll(".save-btn").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const normalizedKey = btn.getAttribute("data-key");
        const product = products.find((p) => p.normalizedKey === normalizedKey);
        if (btn.classList.contains("saved")) {
          btn.classList.remove("saved");
          btn.querySelector("svg").setAttribute("fill", "none");
          unsaveProduct(normalizedKey);
        } else {
          btn.classList.add("saved");
          btn.querySelector("svg").setAttribute("fill", "#ff3b5c");
          if (product) {
            saveProduct(product);
          }
        }
        if (!document.getElementById("saved-page").style.display || document.getElementById("saved-page").style.display !== "none") {
          displaySavedProducts();
        }
      };
    });
  }
  function displaySavedProducts() {
    console.log("=== DISPLAY SAVED PRODUCTS ===");
    const savedProductsContainer = document.getElementById("saved-products");
    if (!savedProductsContainer) {
      console.error("ERROR: Saved products container not found in DOM!");
      return;
    }
    const savedProducts = getSavedProducts();
    console.log("Saved products count:", savedProducts.length);
    savedProductsContainer.innerHTML = "";
    if (savedProducts.length === 0) {
      savedProductsContainer.innerHTML = `
            <div class="no-saved-products">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
                <h3>No saved products yet</h3>
                <p>Products you save will appear here</p>
            </div>
        `;
      return;
    }
    savedProducts.forEach((product, index) => {
      console.log(`Processing saved product ${index}:`, product);
      const productCard = document.createElement("div");
      productCard.className = "product-card";
      if (product.url) {
        const imageHtml = product.image_url ? `<img class="product-image" src="${product.image_url}" alt="${product.itemName}" onerror="this.style.display='none'" />` : `<div class="product-image product-placeholder">
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="2">
                       <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                       <circle cx="8.5" cy="8.5" r="1.5"/>
                       <polyline points="21 15 16 10 5 21"/>
                     </svg>
                   </div>`;
        productCard.innerHTML = `
                <button class="save-btn saved" data-key="${product.normalizedKey}">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ff3b5c" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                </button>
                ${imageHtml}
                <div class="product-info">
                    <div class="product-name">${product.itemName || "Product"}</div>
                    ${product.name ? `<div class="product-title">${product.name}</div>` : ""}
                    ${product.price ? `<div class="product-price">${product.price}</div>` : ""}
                </div>
                <button class="shop-btn" data-url="${product.url}">Shop Now \u2192</button>
            `;
      }
      savedProductsContainer.appendChild(productCard);
    });
    savedProductsContainer.querySelectorAll(".shop-btn").forEach((btn) => {
      btn.onclick = () => {
        const url = btn.getAttribute("data-url");
        if (url) {
          window.open(url, "_blank");
        }
      };
    });
    savedProductsContainer.querySelectorAll(".save-btn").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const normalizedKey = btn.getAttribute("data-key");
        unsaveProduct(normalizedKey);
        displaySavedProducts();
        const visionProducts = document.getElementById("products");
        if (visionProducts) {
          const visionSaveBtn = visionProducts.querySelector(`[data-key="${normalizedKey}"]`);
          if (visionSaveBtn) {
            visionSaveBtn.classList.remove("saved");
            visionSaveBtn.querySelector("svg").setAttribute("fill", "none");
          }
        }
      };
    });
  }
  async function processNLPItems(itemDescriptions) {
    console.log("=== PROCESS NLP ITEMS START ===");
    console.log("Item descriptions:", itemDescriptions);
    console.log("Current found products:", foundProducts.size);
    const productsContainer = document.getElementById("products");
    for (const itemName of itemDescriptions) {
      const description = itemName.trim();
      if (!description || description.toLowerCase() === "none") continue;
      const normalizedKey = description.toLowerCase().replace(/[^a-z0-9]/g, "-");
      if (foundProducts.has(normalizedKey) || pendingSearches.has(normalizedKey)) {
        console.log(`Skipping already processed: ${normalizedKey}`);
        continue;
      }
      const cachedResult = findSimilarCachedItem(description);
      if (cachedResult) {
        console.log("Using cached result for:", description);
        foundProducts.set(normalizedKey, {
          itemName: description,
          normalizedKey,
          ...cachedResult,
          fromCache: true
        });
        displayProducts([...foundProducts.values()]);
        continue;
      }
      pendingSearches.add(normalizedKey);
      if (foundProducts.size > 0) {
        const currentProducts = [...foundProducts.values()];
        currentProducts.push({ itemName: description, loading: true });
        displayProducts(currentProducts);
      } else {
        productsContainer.innerHTML = '<div class="loading">\u{1F50D} Searching for products...</div>';
      }
      try {
        const result = await searchProduct(description);
        console.log("Search result for", description, ":", result);
        productCache.set(description, result);
        foundProducts.set(normalizedKey, {
          itemName: description,
          normalizedKey,
          ...result
        });
      } catch (error) {
        console.error("Error searching for", description, ":", error);
        foundProducts.set(normalizedKey, {
          itemName: description,
          normalizedKey,
          error: error.message
        });
      } finally {
        pendingSearches.delete(normalizedKey);
      }
    }
    if (foundProducts.size > 0) {
      console.log("Displaying all found products:", foundProducts.size);
      displayProducts([...foundProducts.values()]);
    }
    console.log("=== PROCESS NLP ITEMS END ===");
  }
  document.addEventListener("DOMContentLoaded", async () => {
    async function loadCameras() {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((d) => d.kind === "videoinput");
      const select = document.getElementById("camera-select");
      select.innerHTML = cameras.map(
        (cam, i) => `<option value="${cam.deviceId}">${cam.label || "Camera " + (i + 1)}</option>`
      ).join("");
    }
    await loadCameras();
    const cameraSelect = document.getElementById("camera-select");
    const selectWrapper = cameraSelect.parentElement;
    let isOpen = false;
    cameraSelect.addEventListener("focus", () => {
      isOpen = true;
      selectWrapper.classList.add("open");
    });
    cameraSelect.addEventListener("blur", () => {
      isOpen = false;
      setTimeout(() => {
        if (!isOpen) {
          selectWrapper.classList.remove("open");
        }
      }, 100);
    });
    cameraSelect.addEventListener("click", () => {
      if (selectWrapper.classList.contains("open")) {
        selectWrapper.classList.remove("open");
      } else {
        selectWrapper.classList.add("open");
      }
    });
    async function startVisionWithCamera() {
      const select = document.getElementById("camera-select");
      const deviceId = select.value;
      if (!deviceId) {
        document.getElementById("results").innerText = "Please select a camera first!";
        return;
      }
      if (vision) {
        await vision.stop();
      }
      vision = new RealtimeVision({
        apiUrl: "https://cluster1.overshoot.ai/api/v0.2",
        apiKey: API_KEY,
        prompt: buildPrompt(),
        // Uses dynamic prompt with exclusions
        source: { type: "camera", cameraFacing: "user" },
        processing: {
          clip_length_seconds: 10,
          delay_seconds: 5,
          fps: 10,
          sampling_ratio: 0.1
        },
        onResult: async (result) => {
          if (hasStopped) return;
          hasStopped = true;
          console.log("Got NLP result:", result);
          let textResult = "";
          if (typeof result === "string") {
            textResult = result;
          } else if (result.result) {
            textResult = typeof result.result === "string" ? result.result : JSON.stringify(result.result);
          } else {
            textResult = JSON.stringify(result);
          }
          console.log("Text result:", textResult);
          document.getElementById("results").innerText = textResult;
          if (textResult.toLowerCase().includes("none") || textResult.toLowerCase().includes("no clothing")) {
            console.log("No clothing detected");
            document.getElementById("results").innerText = "No clothing detected. Click Find Clothes to try again.";
          } else {
            const items = textResult.split(/[,\n]/).map((s) => s.trim()).filter((s) => s.length > 0 && s.toLowerCase() !== "none");
            console.log("Parsed items:", items);
            if (items.length > 0) {
              try {
                await processNLPItems(items);
              } catch (error) {
                console.error("Error processing NLP items:", error);
                document.getElementById("results").innerText = "Error processing items: " + error.message;
              }
            }
            document.getElementById("results").innerText = textResult + "\n\nDetection complete.";
          }
          try {
            console.log("Stopping Overshoot after first result...");
            await vision.stop();
            console.log("Vision stopped successfully");
          } catch (e) {
            console.warn("Stop failed:", e);
          }
        },
        onMessage: (message) => {
          console.log("Got message:", message);
        },
        onStatusChange: (status) => {
          console.log("Status changed:", status);
          document.getElementById("results").innerText = "Status: " + status;
        },
        onError: (err) => {
          console.error("Vision error:", err);
          document.getElementById("results").innerText = "An error occurred: " + (err.message || JSON.stringify(err));
        }
      });
      await vision.start();
      console.log("Vision started with camera.");
    }
    document.getElementById("find-btn").onclick = () => {
      console.log("Find Clothes clicked - starting detection...");
      document.getElementById("results").innerText = "Detecting clothing...";
      document.getElementById("products").innerHTML = "";
      foundProducts.clear();
      productCache.clear();
      clearDetectedItems();
      hasStopped = false;
      findClothesClickCount = 0;
      startVisionWithCamera();
    };
    document.getElementById("clear-btn").onclick = () => {
      console.log("Clearing all cached products and detected items...");
      productCache.clear();
      foundProducts.clear();
      pendingSearches.clear();
      clearDetectedItems();
      document.getElementById("products").innerHTML = "";
      document.getElementById("results").innerText = "";
      console.log("All caches cleared!");
    };
    document.getElementById("stop-btn").onclick = async () => {
      if (vision) {
        console.log("Stopping Overshoot vision...");
        hasStopped = true;
        await vision.stop();
        vision = null;
        findClothesClickCount = 0;
        document.getElementById("results").innerText = "Detection stopped.";
        console.log("Vision stopped.");
      }
    };
    document.getElementById("start-btn").onclick = async () => {
      const select = document.getElementById("camera-select");
      const deviceId = select.value;
      const video = document.getElementById("preview");
      console.log("Starting camera with device:", deviceId);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: deviceId ? { exact: deviceId } : void 0 }
        });
        video.srcObject = stream;
        console.log("Camera started successfully");
        await loadCameras();
      } catch (err) {
        console.error("Error starting camera:", err);
        document.getElementById("results").innerText = "Error starting camera: " + err.message;
      }
    };
    const navItems = document.querySelectorAll(".nav-item");
    navItems.forEach((navItem) => {
      navItem.addEventListener("click", () => {
        const targetPage = navItem.getAttribute("data-page");
        if (targetPage && targetPage !== "sidepanel.html") {
          window.location.href = targetPage;
        }
      });
    });
  });
})();
