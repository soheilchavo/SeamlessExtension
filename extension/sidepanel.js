import { RealtimeVision } from '@overshoot/sdk';

const API_KEY = 'ovs_148da6c73eff6fdde6431e7bc82e0dd8';
const RAILWAY_URL = 'https://web-production-a1e61a.up.railway.app/get-product';

console.log('Seamless extension loaded');

let latestClothingData = null;
let vision = null;

// ===== PERSISTENCE LAYER =====
// Cache for API responses to avoid duplicate requests
const productCache = new Map();  // itemName -> API response

// Accumulated found products (persisted across detections)
const foundProducts = new Map();  // normalized key -> product data

// Track pending searches to avoid duplicate concurrent requests
const pendingSearches = new Set();

// ===== PROMPT-BASED DEDUPLICATION =====
// List of previously detected items to exclude from future detections
const detectedItems = [];

// Base prompt template
const BASE_PROMPT = 'List all clothing items you see. For each item, describe it with as many parameters as it would take to recreate it with an image search, for example "stripped black and yellow short sleeve t-shirt for men" or "levis low taper navy blue jeans for women". Separate items with commas.';

// Build the prompt with exclusions
function buildPrompt() {
    if (detectedItems.length === 0) {
        return BASE_PROMPT;
    }

    const exclusions = detectedItems.map(item => `"${item}"`).join(', ');
    return `${BASE_PROMPT} Do NOT list any items similar to these already detected items: [${exclusions}]`;
}

// Update the running vision with new prompt
function updateVisionPrompt() {
    if (!vision) return;

    const newPrompt = buildPrompt();
    console.log('Updating prompt with exclusions:', detectedItems.length);
    console.log('New prompt:', newPrompt);

    try {
        vision.updatePrompt(newPrompt);
    } catch (e) {
        console.error('Failed to update prompt:', e);
    }
}

// Add a detected item to the exclusion list and update prompt
function addDetectedItem(description) {
    // Normalize the description
    const normalized = description.toLowerCase().trim();

    // Check if we already have a very similar item
    const isDuplicate = detectedItems.some(item => {
        const itemNorm = item.toLowerCase();
        // Simple similarity check: if 70% of words match
        const words1 = new Set(normalized.split(/\s+/));
        const words2 = new Set(itemNorm.split(/\s+/));
        const intersection = [...words1].filter(w => words2.has(w));
        const similarity = intersection.length / Math.max(words1.size, words2.size);
        return similarity > 0.7;
    });

    if (!isDuplicate) {
        console.log('Adding new detected item:', description);
        detectedItems.push(description);
        updateVisionPrompt();
        return true;
    } else {
        console.log('Item already detected (similar):', description);
        return false;
    }
}

// Clear all detected items (for fresh start)
function clearDetectedItems() {
    detectedItems.length = 0;
    console.log('Cleared all detected items');
    updateVisionPrompt();
}

// Normalize item description to create a stable key
function normalizeItemKey(item) {
    // Create a stable key from the clothing type and color
    // This helps group similar items like "black t-shirt" and "Black T-Shirt"
    const type = (item.type || '').toLowerCase().trim();
    const color = (item.color || '').toLowerCase().trim();
    return `${color}-${type}`;
}

// Check if two descriptions are similar enough to be considered the same item
function isSimilarItem(desc1, desc2) {
    const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const n1 = normalize(desc1);
    const n2 = normalize(desc2);

    // If one contains the other, or they're very similar
    if (n1.includes(n2) || n2.includes(n1)) return true;

    // Calculate simple word overlap
    const words1 = new Set(desc1.toLowerCase().split(/\s+/));
    const words2 = new Set(desc2.toLowerCase().split(/\s+/));
    const intersection = [...words1].filter(w => words2.has(w));
    const union = new Set([...words1, ...words2]);
    const similarity = intersection.length / union.size;

    return similarity > 0.6;  // 60% word overlap
}

// Check if we already have a similar item cached
function findSimilarCachedItem(itemName) {
    for (const [cachedName, cachedResult] of productCache.entries()) {
        if (isSimilarItem(itemName, cachedName)) {
            console.log(`Found similar cached item: "${cachedName}" for "${itemName}"`);
            return cachedResult;
        }
    }
    return null;
}

// Function to search for a product using the Railway backend
async function searchProduct(itemName) {
    console.log('=== SEARCH PRODUCT START ===');
    console.log('Item name:', itemName);
    console.log('Railway URL:', RAILWAY_URL);

    try {
        const requestBody = JSON.stringify({ item_name: itemName });
        console.log('Request body:', requestBody);

        console.log('Sending fetch request...');
        const response = await fetch(RAILWAY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: requestBody
        });

        console.log('Response received!');
        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);
        console.log('Response headers:', [...response.headers.entries()]);

        const responseText = await response.text();
        console.log('Response text:', responseText);

        let data;
        try {
            data = JSON.parse(responseText);
            console.log('Parsed response data:', data);
        } catch (parseError) {
            console.error('Failed to parse response as JSON:', parseError);
            return { error: 'Invalid JSON response: ' + responseText.substring(0, 100) };
        }

        console.log('=== SEARCH PRODUCT SUCCESS ===');
        return data;
    } catch (error) {
        console.error('=== SEARCH PRODUCT ERROR ===');
        console.error('Error type:', error.name);
        console.error('Error message:', error.message);
        console.error('Full error:', error);
        return { error: error.message };
    }
}

// Function to display product results
function displayProducts(products) {
    console.log('=== DISPLAY PRODUCTS ===');
    console.log('Products to display:', products);
    console.log('Products count:', products?.length);

    const productsContainer = document.getElementById('products');
    console.log('Products container found:', !!productsContainer);
    console.log('Products container element:', productsContainer);

    if (!productsContainer) {
        console.error('ERROR: Products container not found in DOM!');
        return;
    }

    productsContainer.innerHTML = '';

    if (!products || products.length === 0) {
        console.log('No products to display');
        productsContainer.innerHTML = '<div class="no-products">No products found</div>';
        return;
    }

    // Filter out error results, only keep successful products and loading states
    const validProducts = products.filter(p => !p.error && (p.url || p.loading));

    if (validProducts.length === 0) {
        console.log('No valid products to display (all errors filtered)');
        productsContainer.innerHTML = '<div class="no-products">No products found</div>';
        return;
    }

    console.log('Creating product cards for', validProducts.length, 'valid products');

    validProducts.forEach((product, index) => {
        console.log(`Processing product ${index}:`, product);

        const productCard = document.createElement('div');
        productCard.className = 'product-card';

        if (product.loading) {
            // Show loading spinner for this product
            productCard.innerHTML = `
                <div class="product-loading">
                    <span class="loading-icon">⏳</span>
                    <span>Searching for ${product.itemName}...</span>
                </div>
            `;
        } else if (product.url) {
            productCard.innerHTML = `
                ${product.image_url ? `<img class="product-image" src="${product.image_url}" alt="${product.itemName}" />` : ''}
                <div class="product-info">
                    <div class="product-name">${product.itemName || 'Product'}</div>
                    ${product.name ? `<div class="product-title">${product.name}</div>` : ''}
                    ${product.price ? `<div class="product-price">${product.price}</div>` : ''}
                    ${product.fromCache ? '<div class="from-cache">📦 Cached</div>' : ''}
                </div>
                <button class="shop-btn" data-url="${product.url}">Shop Now →</button>
            `;
        }

        productsContainer.appendChild(productCard);
    });

    console.log('Final container innerHTML length:', productsContainer.innerHTML.length);
    console.log('Final container children count:', productsContainer.children.length);

    // Add click handlers for shop buttons
    productsContainer.querySelectorAll('.shop-btn').forEach(btn => {
        btn.onclick = () => {
            const url = btn.getAttribute('data-url');
            if (url) {
                window.open(url, '_blank');
            }
        };
    });
}

// Function to process NLP text items with prompt-based deduplication
async function processNLPItems(itemDescriptions) {
    console.log('=== PROCESS NLP ITEMS START ===');
    console.log('Item descriptions:', itemDescriptions);
    console.log('Current detected items:', detectedItems.length);
    console.log('Current found products:', foundProducts.size);

    const productsContainer = document.getElementById('products');
    const newItems = [];

    // Check each item - add to detected list and collect new ones
    for (const itemDesc of itemDescriptions) {
        const description = itemDesc.trim();
        if (!description || description.toLowerCase() === 'none') continue;

        // Try to add to detected items (returns true if it's new)
        if (addDetectedItem(description)) {
            newItems.push(description);
        }
    }

    console.log('New items to search:', newItems);

    // Search for new items only
    for (const itemName of newItems) {
        const normalizedKey = itemName.toLowerCase().replace(/[^a-z0-9]/g, '-');

        // Skip if already found or pending
        if (foundProducts.has(normalizedKey) || pendingSearches.has(normalizedKey)) {
            console.log(`Skipping already processed: ${normalizedKey}`);
            continue;
        }

        // Check cache for similar items
        const cachedResult = findSimilarCachedItem(itemName);
        if (cachedResult) {
            console.log('Using cached result for:', itemName);
            foundProducts.set(normalizedKey, {
                itemName,
                normalizedKey,
                ...cachedResult,
                fromCache: true
            });
            displayProducts([...foundProducts.values()]);
            continue;
        }

        // Mark as pending and search
        pendingSearches.add(normalizedKey);

        // Show loading state
        if (foundProducts.size > 0) {
            const currentProducts = [...foundProducts.values()];
            currentProducts.push({ itemName, loading: true });
            displayProducts(currentProducts);
        } else {
            productsContainer.innerHTML = '<div class="loading">🔍 Searching for products...</div>';
        }

        try {
            const result = await searchProduct(itemName);
            console.log('Search result for', itemName, ':', result);

            // Cache the result
            productCache.set(itemName, result);

            // Store in found products
            foundProducts.set(normalizedKey, {
                itemName,
                normalizedKey,
                ...result
            });
        } catch (error) {
            console.error('Error searching for', itemName, ':', error);
            foundProducts.set(normalizedKey, {
                itemName,
                normalizedKey,
                error: error.message
            });
        } finally {
            pendingSearches.delete(normalizedKey);
        }
    }

    // Display all found products
    if (foundProducts.size > 0) {
        console.log('Displaying all found products:', foundProducts.size);
        displayProducts([...foundProducts.values()]);
    }

    console.log('=== PROCESS NLP ITEMS END ===');
}

// Function to process detected clothing items and search for products
async function processClothingItems(clothingData) {
    console.log('=== PROCESS CLOTHING ITEMS START ===');
    console.log('Clothing data received:', clothingData);
    console.log('Current cached items:', productCache.size);
    console.log('Current found products:', foundProducts.size);

    const productsContainer = document.getElementById('products');

    let items = [];

    // Handle different data structures
    if (clothingData.items && Array.isArray(clothingData.items)) {
        items = clothingData.items;
    } else if (Array.isArray(clothingData)) {
        items = clothingData;
    }

    console.log('Items to process:', items.length);

    if (items.length === 0) {
        // Still show existing found products if we have any
        if (foundProducts.size > 0) {
            displayProducts([...foundProducts.values()]);
        } else {
            productsContainer.innerHTML = '<div class="no-products">No clothing items detected</div>';
        }
        return;
    }

    let hasNewSearches = false;

    for (const item of items) {
        // Create a normalized key for this item
        const normalizedKey = normalizeItemKey(item);
        console.log('Normalized key:', normalizedKey);

        // Skip if we already have this item type
        if (foundProducts.has(normalizedKey)) {
            console.log(`Skipping already found item: ${normalizedKey}`);
            continue;
        }

        // Build item name from properties
        const itemName = [item.color, item.pattern, item.style, item.type]
            .filter(Boolean)
            .join(' ') || 'Unknown item';

        console.log('Built item name:', itemName);

        // Check if we're already searching for this
        if (pendingSearches.has(normalizedKey)) {
            console.log(`Already searching for: ${normalizedKey}`);
            continue;
        }

        // Check cache for similar items first
        const cachedResult = findSimilarCachedItem(itemName);
        if (cachedResult) {
            console.log('Using cached result for:', itemName);
            foundProducts.set(normalizedKey, {
                itemName,
                normalizedKey,
                ...cachedResult,
                fromCache: true
            });
            hasNewSearches = true;
            continue;
        }

        // Mark as pending and search
        pendingSearches.add(normalizedKey);
        hasNewSearches = true;

        // Show loading state with existing products
        if (foundProducts.size > 0) {
            const currentProducts = [...foundProducts.values()];
            currentProducts.push({ itemName, loading: true });
            displayProducts(currentProducts);
        } else {
            productsContainer.innerHTML = '<div class="loading">🔍 Searching for products...</div>';
        }

        try {
            const result = await searchProduct(itemName);
            console.log('Search result for', itemName, ':', result);

            // Cache the result
            productCache.set(itemName, result);

            // Store in found products
            foundProducts.set(normalizedKey, {
                itemName,
                normalizedKey,
                ...result
            });
        } catch (error) {
            console.error('Error searching for', itemName, ':', error);
            foundProducts.set(normalizedKey, {
                itemName,
                normalizedKey,
                error: error.message
            });
        } finally {
            pendingSearches.delete(normalizedKey);
        }
    }

    // Display all found products
    if (foundProducts.size > 0 || hasNewSearches) {
        console.log('Displaying all found products:', foundProducts.size);
        displayProducts([...foundProducts.values()]);
    }

    console.log('=== PROCESS CLOTHING ITEMS END ===');
}

document.addEventListener('DOMContentLoaded', async () => {
    // Populate camera dropdown
    async function loadCameras() {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(d => d.kind === 'videoinput');
        const select = document.getElementById('camera-select');

        select.innerHTML = cameras.map((cam, i) =>
            `<option value="${cam.deviceId}">${cam.label || 'Camera ' + (i + 1)}</option>`
        ).join('');
    }

    // Load cameras on page load
    await loadCameras();

    async function startVisionWithCamera() {
        const select = document.getElementById('camera-select');
        const deviceId = select.value;

        if (!deviceId) {
            document.getElementById('results').innerText = 'Please select a camera first!';
            return;
        }

        if (vision) {
            await vision.stop();
        }

        vision = new RealtimeVision({
            apiUrl: 'https://cluster1.overshoot.ai/api/v0.2',
            apiKey: API_KEY,
            prompt: buildPrompt(),  // Uses dynamic prompt with exclusions
            source: { type: 'camera', cameraFacing: 'user' },
            processing: {
                clip_length_seconds: 10,
                delay_seconds: 5,
                fps: 10,
                sampling_ratio: 0.1
            },
            onResult: (result) => {
                console.log('Got NLP result:', result);

                // Extract the text response
                let textResult = '';
                if (typeof result === 'string') {
                    textResult = result;
                } else if (result.result) {
                    textResult = typeof result.result === 'string' ? result.result : JSON.stringify(result.result);
                } else {
                    textResult = JSON.stringify(result);
                }

                console.log('Text result:', textResult);
                document.getElementById('results').innerText = textResult;

                // Skip if no clothing detected
                if (textResult.toLowerCase().includes('none') ||
                    textResult.toLowerCase().includes('no clothing')) {
                    console.log('No clothing detected');
                    return;
                }

                // Parse comma-separated items and search for each
                const items = textResult
                    .split(/[,\n]/)
                    .map(s => s.trim())
                    .filter(s => s.length > 0 && s.toLowerCase() !== 'none');

                console.log('Parsed items:', items);

                if (items.length > 0) {
                    processNLPItems(items);
                }
            },
            onMessage: (message) => {
                console.log('Got message:', message);
            },
            onStatusChange: (status) => {
                console.log('Status changed:', status);
                document.getElementById('results').innerText = 'Status: ' + status;
            },
            onError: (err) => {
                console.error('Vision error:', err);
                document.getElementById('results').innerText = 'An error occurred: ' + (err.message || JSON.stringify(err));
            }
        });

        await vision.start();
        console.log('Vision started with camera.');
    }

    document.getElementById('find-btn').onclick = () => {
        document.getElementById('results').innerText = 'Detecting clothing...';
        startVisionWithCamera();
    };

    // Clear all cached results
    document.getElementById('clear-btn').onclick = () => {
        console.log('Clearing all cached products and detected items...');
        productCache.clear();
        foundProducts.clear();
        pendingSearches.clear();
        clearDetectedItems();  // Clear detected items and update prompt
        document.getElementById('products').innerHTML = '';
        document.getElementById('results').innerText = '';
        console.log('All caches cleared!');
    };

    // Stop Overshoot detection
    document.getElementById('stop-btn').onclick = async () => {
        if (vision) {
            console.log('Stopping Overshoot vision...');
            await vision.stop();
            vision = null;
            document.getElementById('results').innerText = 'Detection stopped.';
            console.log('Vision stopped.');
        }
    };

    // Start camera stream when Start button is clicked
    document.getElementById('start-btn').onclick = async () => {
        const select = document.getElementById('camera-select');
        const deviceId = select.value;
        const video = document.getElementById('preview');

        console.log('Starting camera with device:', deviceId);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: deviceId ? { exact: deviceId } : undefined }
            });
            video.srcObject = stream;
            console.log('Camera started successfully');

            // Reload cameras to get proper labels after permission granted
            await loadCameras();
        } catch (err) {
            console.error('Error starting camera:', err);
            document.getElementById('results').innerText = 'Error starting camera: ' + err.message;
        }
    };
});
