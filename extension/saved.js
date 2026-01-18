// Saved products page JavaScript

console.log('Saved products page loaded');

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

function unsaveProduct(normalizedKey) {
    const saved = getSavedProducts();
    const filtered = saved.filter(p => p.normalizedKey !== normalizedKey);
    localStorage.setItem('savedProducts', JSON.stringify(filtered));
    console.log('Product unsaved:', normalizedKey);
}

// Function to display saved products
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
        };
    });
}

// Navigation handler
document.addEventListener('DOMContentLoaded', () => {
    // Display saved products when page loads
    displaySavedProducts();

    // Handle navigation
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(navItem => {
        navItem.addEventListener('click', () => {
            const targetPage = navItem.getAttribute('data-page');
            if (targetPage) {
                window.location.href = targetPage;
            }
        });
    });
});
