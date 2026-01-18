import { RealtimeVision } from '@overshoot/sdk';

const API_KEY = 'ovs_148da6c73eff6fdde6431e7bc82e0dd8';
const RAILWAY_URL = 'https://web-production-a1e61a.up.railway.app/get-product';

console.log('Seamless extension loaded');

let latestClothingData = null;
let vision = null;
let findClothesClickCount = 0;  // Track clicks to toggle behavior
let hasStopped = false;  // Simple flag: has the current session already stopped?

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
const BASE_PROMPT = `Identify and list ONLY clothing items visible in the image. For each item, provide a specific product description optimized for shopping searches. Include: color(s), pattern/style (striped, solid, graphic, etc.), fit/type (slim, oversized, crop, etc.), sleeve length, visible material hints, and target gender/fit if obvious. Be concise but specific. Examples: "navy blue slim fit t-shirt", "black high-waisted skinny jeans", "white oversized linen button-up shirt", "burgundy wool cardigan with buttons". Ignore accessories, background, and non-clothing items. Separate items with commas only.`;
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

// ===== SAVED PRODUCTS (localStorage) =====
function getSavedProducts() {
    try {
        const saved = localStorage.getItem('savedProducts');
        return saved ? JSON.parse(saved) : [];
    } catch (error) {
        console.error('Error loading saved products:', error);
        return [];
    }
}

function saveProduct(product) {
    const saved = getSavedProducts();
    // Check if already saved using normalizedKey
    const exists = saved.find(p => p.normalizedKey === product.normalizedKey);
    if (!exists) {
        saved.push(product);
        localStorage.setItem('savedProducts', JSON.stringify(saved));
        console.log('Product saved:', product.itemName);
    }
}

function unsaveProduct(normalizedKey) {
    const saved = getSavedProducts();
    const filtered = saved.filter(p => p.normalizedKey !== normalizedKey);
    localStorage.setItem('savedProducts', JSON.stringify(filtered));
    console.log('Product unsaved:', normalizedKey);
}

function isProductSaved(normalizedKey) {
    const saved = getSavedProducts();
    return saved.some(p => p.normalizedKey === normalizedKey);
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
            // Debug: Check if image_url exists
            console.log('Product data:', product);
            console.log('Image URL:', product.image_url);

            const imageHtml = product.image_url
                ? `<img class="product-image" src="${product.image_url}" alt="${product.itemName}" onerror="this.style.display='none'" />`
                : `<div class="product-image product-placeholder">
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="2">
                       <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                       <circle cx="8.5" cy="8.5" r="1.5"/>
                       <polyline points="21 15 16 10 5 21"/>
                     </svg>
                   </div>`;

            const isSaved = isProductSaved(product.normalizedKey);
            const saveIconClass = isSaved ? 'saved' : '';

            productCard.innerHTML = `
                <button class="save-btn ${saveIconClass}" data-key="${product.normalizedKey}">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${isSaved ? '#ff3b5c' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                </button>
                ${imageHtml}
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

    // Add click handlers for save buttons
    productsContainer.querySelectorAll('.save-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const normalizedKey = btn.getAttribute('data-key');
            const product = products.find(p => p.normalizedKey === normalizedKey);

            if (btn.classList.contains('saved')) {
                // Unsave
                btn.classList.remove('saved');
                btn.querySelector('svg').setAttribute('fill', 'none');
                unsaveProduct(normalizedKey);
            } else {
                // Save
                btn.classList.add('saved');
                btn.querySelector('svg').setAttribute('fill', '#ff3b5c');
                if (product) {
                    saveProduct(product);
                }
            }

            // Refresh saved page if it's visible
            if (!document.getElementById('saved-page').style.display ||
                document.getElementById('saved-page').style.display !== 'none') {
                displaySavedProducts();
            }
        };
    });
}

// Function to display saved products on the Saved page
function displaySavedProducts() {
    console.log('=== DISPLAY SAVED PRODUCTS ===');
    const savedProductsContainer = document.getElementById('saved-products');

    if (!savedProductsContainer) {
        console.error('ERROR: Saved products container not found in DOM!');
        return;
    }

    const savedProducts = getSavedProducts();
    console.log('Saved products count:', savedProducts.length);

    savedProductsContainer.innerHTML = '';

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

        const productCard = document.createElement('div');
        productCard.className = 'product-card';

        if (product.url) {
            const imageHtml = product.image_url
                ? `<img class="product-image" src="${product.image_url}" alt="${product.itemName}" onerror="this.style.display='none'" />`
                : `<div class="product-image product-placeholder">
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
                    <div class="product-name">${product.itemName || 'Product'}</div>
                    ${product.name ? `<div class="product-title">${product.name}</div>` : ''}
                    ${product.price ? `<div class="product-price">${product.price}</div>` : ''}
                </div>
                <button class="shop-btn" data-url="${product.url}">Shop Now →</button>
            `;
        }

        savedProductsContainer.appendChild(productCard);
    });

    // Add click handlers for shop buttons
    savedProductsContainer.querySelectorAll('.shop-btn').forEach(btn => {
        btn.onclick = () => {
            const url = btn.getAttribute('data-url');
            if (url) {
                window.open(url, '_blank');
            }
        };
    });

    // Add click handlers for save buttons (unsave)
    savedProductsContainer.querySelectorAll('.save-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const normalizedKey = btn.getAttribute('data-key');

            // Unsave
            unsaveProduct(normalizedKey);

            // Refresh the saved products page
            displaySavedProducts();

            // Update the vision page if needed
            const visionProducts = document.getElementById('products');
            if (visionProducts) {
                const visionSaveBtn = visionProducts.querySelector(`[data-key="${normalizedKey}"]`);
                if (visionSaveBtn) {
                    visionSaveBtn.classList.remove('saved');
                    visionSaveBtn.querySelector('svg').setAttribute('fill', 'none');
                }
            }
        };
    });
}

// Function to process NLP text items
async function processNLPItems(itemDescriptions) {
    console.log('=== PROCESS NLP ITEMS START ===');
    console.log('Item descriptions:', itemDescriptions);
    console.log('Current found products:', foundProducts.size);

    const productsContainer = document.getElementById('products');

    // Search for all items directly (no deduplication needed during first detection)
    for (const itemName of itemDescriptions) {
        const description = itemName.trim();
        if (!description || description.toLowerCase() === 'none') continue;

        const normalizedKey = description.toLowerCase().replace(/[^a-z0-9]/g, '-');

        // Skip if already found or pending
        if (foundProducts.has(normalizedKey) || pendingSearches.has(normalizedKey)) {
            console.log(`Skipping already processed: ${normalizedKey}`);
            continue;
        }

        // Check cache for similar items
        const cachedResult = findSimilarCachedItem(description);
        if (cachedResult) {
            console.log('Using cached result for:', description);
            foundProducts.set(normalizedKey, {
                itemName: description,
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
            currentProducts.push({ itemName: description, loading: true });
            displayProducts(currentProducts);
        } else {
            productsContainer.innerHTML = '<div class="loading">🔍 Searching for products...</div>';
        }

        try {
            const result = await searchProduct(description);
            console.log('Search result for', description, ':', result);

            // Cache the result
            productCache.set(description, result);

            // Store in found products
            foundProducts.set(normalizedKey, {
                itemName: description,
                normalizedKey,
                ...result
            });
        } catch (error) {
            console.error('Error searching for', description, ':', error);
            foundProducts.set(normalizedKey, {
                itemName: description,
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

    // Add dropdown arrow rotation functionality
    const cameraSelect = document.getElementById('camera-select');
    const selectWrapper = cameraSelect.parentElement;

    let isOpen = false;

    cameraSelect.addEventListener('focus', () => {
        isOpen = true;
        selectWrapper.classList.add('open');
    });

    cameraSelect.addEventListener('blur', () => {
        isOpen = false;
        setTimeout(() => {
            if (!isOpen) {
                selectWrapper.classList.remove('open');
            }
        }, 100);
    });

    cameraSelect.addEventListener('click', () => {
        if (selectWrapper.classList.contains('open')) {
            selectWrapper.classList.remove('open');
        } else {
            selectWrapper.classList.add('open');
        }
    });

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
            onResult: async (result) => {
                // Prevent multiple UI updates and multiple stop calls
                if (hasStopped) return;
                hasStopped = true;

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
                    document.getElementById('results').innerText = 'No clothing detected. Click Find Clothes to try again.';
                } else {
                    // Parse comma-separated items and search for each
                    const items = textResult
                        .split(/[,\n]/)
                        .map(s => s.trim())
                        .filter(s => s.length > 0 && s.toLowerCase() !== 'none');

                    console.log('Parsed items:', items);

                    if (items.length > 0) {
                        try {
                            await processNLPItems(items);
                        } catch (error) {
                            console.error('Error processing NLP items:', error);
                            document.getElementById('results').innerText = 'Error processing items: ' + error.message;
                        }
                    }

                    document.getElementById('results').innerText = textResult + '\n\nDetection complete.';
                }

                // Stop immediately so it does not keep fluctuating
                try {
                    console.log('Stopping Overshoot after first result...');
                    await vision.stop();
                    console.log('Vision stopped successfully');
                } catch (e) {
                    console.warn('Stop failed:', e);
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
        console.log('Find Clothes clicked - starting detection...');

        // Reset state for fresh detection
        document.getElementById('results').innerText = 'Detecting clothing...';
        document.getElementById('products').innerHTML = '';
        foundProducts.clear();
        productCache.clear();
        clearDetectedItems();
        hasStopped = false;
        findClothesClickCount = 0;

        // Start detection immediately
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
            hasStopped = true;
            await vision.stop();
            vision = null;
            findClothesClickCount = 0;  // Reset click count
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

    // ===== PAGE NAVIGATION LOGIC =====
    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach(navItem => {
        navItem.addEventListener('click', () => {
            const targetPage = navItem.getAttribute('data-page');

            // Navigate to the target page if it's different from current
            if (targetPage && targetPage !== 'sidepanel.html') {
                window.location.href = targetPage;
            }
        });
    });
});

