// Content script to replace buying options on Google Shopping with custom checkout

(function() {
    'use strict';

    // Function to find buying options - target specific <a> elements with merchant links
    function findBuyingOptions() {
        const buyingOptions = [];

        // Target the specific <a> elements that are buying option links
        // These have jsname="wN9W3" and contain merchant info, prices, etc.
        const buyingOptionLinks = Array.from(document.querySelectorAll('a[jsname="wN9W3"]'));

        buyingOptionLinks.forEach(link => {
            // Verify this is a buying option link by checking for characteristic elements
            const hasPrice = link.querySelector('[aria-label*="Current price"], [aria-label*="$"], .Pgbknd');
            const hasMerchant = link.querySelector('.gUf0b, .uWvFpd, .hP4iBf') || 
                               link.querySelector('img[src*="faviconV2"]'); // Merchant favicon
            
            // Also check for "Best price" label which appears on buying options
            const hasBestPriceLabel = link.querySelector('.shi3lc, .Y7glZ, .VYi4ab');

            if (hasPrice || hasMerchant || hasBestPriceLabel) {
                buyingOptions.push({ container: link });
            }
        });

        // Fallback: Look for <a> elements with similar structure if jsname changes
        if (buyingOptions.length === 0) {
            const allLinks = Array.from(document.querySelectorAll('a[href*="http"]'));
            allLinks.forEach(link => {
                // Check if this link looks like a buying option:
                // - Has price inside
                // - Has merchant name/favicon
                // - Has "Best price" or similar label
                // - Is inside a container that has "Buying options" text nearby
                const hasPrice = link.querySelector('[aria-label*="Current price"], [aria-label*="$"]');
                const hasMerchant = link.querySelector('img[src*="faviconV2"]') || 
                                   link.querySelector('.gUf0b, [class*="merchant"]');
                const hasStockInfo = link.querySelector('[class*="stock"], [class*="In stock"]');
                const hasRating = link.querySelector('[aria-label*="Rated"]');
                
                // Check if parent contains "Buying options" or if we're in a buying options context
                const parentText = link.closest('div')?.textContent?.toLowerCase() || '';
                const isInBuyingOptions = parentText.includes('buying options') || 
                                         parentText.includes('best price');

                if ((hasPrice && hasMerchant) || (hasPrice && (hasStockInfo || hasRating) && isInBuyingOptions)) {
                    // Avoid duplicates
                    if (!buyingOptions.find(opt => opt.container === link)) {
                        buyingOptions.push({ container: link });
                    }
                }
            });
        }

        return buyingOptions;
    }

    // Function to extract product information from the buying option link
    function extractProductInfo(container) {
        const info = {
            title: '',
            price: '',
            image: '',
            merchant: ''
        };

        // Extract price from the link (should be inside)
        const priceEl = container.querySelector('[aria-label*="Current price"], .Pgbknd, [aria-label*="$"]');
        if (priceEl) {
            const priceText = priceEl.getAttribute('aria-label') || priceEl.textContent?.trim();
            if (priceText) {
                // Extract just the price part
                const priceMatch = priceText.match(/\$[\d,]+\.?\d*/);
                info.price = priceMatch ? priceMatch[0] : priceText;
            }
        }

        // Extract merchant name
        const merchantEl = container.querySelector('.gUf0b, .uWvFpd, .hP4iBf');
        if (merchantEl) {
            info.merchant = merchantEl.textContent?.trim() || '';
        }

        // Extract product title from within the link or nearby
        const titleEl = container.querySelector('.Rp8BL, .CpcIhb, [class*="product"]');
        if (titleEl) {
            info.title = titleEl.textContent?.trim() || '';
        }

        // Extract product image from parent product card (not from the buying option link itself)
        let parentCard = container;
        for (let i = 0; i < 5 && parentCard; i++) {
            parentCard = parentCard.parentElement;
            const productImg = parentCard?.querySelector('img[src*="googleusercontent"]:not([src*="favicon"])');
            if (productImg && productImg.width > 50) {
                info.image = productImg.src || productImg.getAttribute('src') || '';
                break;
            }
        }

        // If no title found, try looking in parent containers
        if (!info.title) {
            let searchContainer = container.parentElement;
            for (let i = 0; i < 3 && searchContainer; i++) {
                const titleEl = searchContainer.querySelector('h3, h2, [class*="title"]');
                if (titleEl) {
                    info.title = titleEl.textContent?.trim() || '';
                    break;
                }
                searchContainer = searchContainer.parentElement;
            }
        }

        return info;
    }

    // Function to parse price string and extract numeric value
    function parsePrice(priceString) {
        if (!priceString) return 0;
        // Remove $, commas, and extract number
        const match = priceString.match(/[\d,]+\.?\d*/);
        if (match) {
            return parseFloat(match[0].replace(/,/g, ''));
        }
        return 0;
    }

    // Function to format price as currency
    function formatPrice(amount) {
        return '$' + amount.toFixed(2);
    }

    // Function to create checkout UI - with price calculation at top and Accept Smart Contract at bottom
    function createCheckoutUI(productInfo) {
        // Calculate prices
        const subtotal = parsePrice(productInfo.price);
        const shipping = 0; // Could be calculated or estimated
        const tax = subtotal * 0.08; // Example: 8% tax (adjust as needed)
        const total = subtotal + shipping + tax;

        const checkoutContainer = document.createElement('div');
        checkoutContainer.className = 'seamless-checkout-container';
        checkoutContainer.innerHTML = `
            <div class="seamless-checkout-wrapper">
                <h2 class="seamless-checkout-title-main">SEAMLESS SMART CHECKOUT</h2>
                <div class="seamless-price-calculation">
                    <div class="seamless-price-row">
                        <span class="seamless-price-label">Subtotal:</span>
                        <span class="seamless-price-value">${formatPrice(subtotal)}</span>
                    </div>
                    <div class="seamless-price-row">
                        <span class="seamless-price-label">Shipping:</span>
                        <span class="seamless-price-value">${shipping > 0 ? formatPrice(shipping) : 'Free'}</span>
                    </div>
                    <div class="seamless-price-row">
                        <span class="seamless-price-label">Tax:</span>
                        <span class="seamless-price-value">${formatPrice(tax)}</span>
                    </div>
                    <div class="seamless-price-row seamless-price-total">
                        <span class="seamless-price-label">Total:</span>
                        <span class="seamless-price-value">${formatPrice(total)}</span>
                    </div>
                </div>
                <div class="seamless-crypto-payment">
                    <div class="seamless-crypto-label">Pay with:</div>
                    <select class="seamless-crypto-select" id="seamless-crypto-select">
                        <option value="eth" selected>Ξ Ethereum</option>
                        <option value="btc">₿ Bitcoin</option>
                        <option value="usdc">$ USDC</option>
                        <option value="sol">◎ Solana</option>
                    </select>
                </div>
                <div class="seamless-checkout-button-wrapper">
                    <button class="seamless-checkout-btn seamless-primary-btn" id="seamless-checkout-btn">
                        <span class="seamless-info-icon">ℹ</span>
                        <span>Accept Smart Contract</span>
                    </button>
                </div>
            </div>
        `;

        // Add styles - compact version to match buying options section size
        const style = document.createElement('style');
        style.textContent = `
            .seamless-checkout-container {
                padding: 20px 24px;
                background: #ffffff;
                border: 2px solid #e8eaed;
                border-radius: 12px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                min-height: fit-content;
                display: block;
                width: 100%;
                box-sizing: border-box;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1);
                transform: translateY(-2px);
                margin: 8px 0;
                position: relative;
                z-index: 10;
            }
            /* Ensure the <a> element maintains its display */
            a.seamless-replaced {
                display: block;
                text-decoration: none;
                pointer-events: none;
            }
            /* Re-enable pointer events on interactive elements */
            a.seamless-replaced .seamless-crypto-select,
            a.seamless-replaced .seamless-checkout-btn {
                pointer-events: auto;
            }
            .seamless-checkout-wrapper {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }
            .seamless-checkout-title-main {
                font-size: 20px;
                font-weight: 700;
                letter-spacing: 2px;
                color: #1a1a1a;
                margin: 0 0 8px 0;
                line-height: 1;
                font-style: italic;
                text-align: center;
                padding-bottom: 12px;
                border-bottom: 2px solid #e8eaed;
            }
            .seamless-price-calculation {
                display: flex;
                flex-direction: column;
                gap: 10px;
                padding: 12px 0;
            }
            .seamless-price-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 14px;
            }
            .seamless-price-label {
                color: #5f6368;
                font-size: 14px;
            }
            .seamless-price-value {
                color: #1a1a1a;
                font-weight: 500;
                font-size: 14px;
            }
            .seamless-price-total {
                margin-top: 4px;
                padding-top: 8px;
                border-top: 1px solid #e8eaed;
            }
            .seamless-price-total {
                border-top: 2px solid #e8eaed;
                padding-top: 12px;
                margin-top: 8px;
            }
            .seamless-price-total .seamless-price-label {
                font-weight: 600;
                color: #1a1a1a;
                font-size: 16px;
            }
            .seamless-price-total .seamless-price-value {
                font-weight: 700;
                color: #34a853;
                font-size: 20px;
            }
            .seamless-checkout-button-wrapper {
                width: 100%;
            }
            .seamless-checkout-btn {
                width: 100%;
                padding: 14px 24px;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
            }
            .seamless-info-icon {
                font-size: 18px;
                font-weight: 600;
                opacity: 0.9;
            }
            .seamless-primary-btn {
                background: #1a1a1a;
                color: white;
            }
            .seamless-primary-btn:hover {
                background: #000000;
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            }
            .seamless-checkout-btn:active {
                transform: translateY(0);
            }
            .seamless-checkout-btn:disabled {
                background: #9aa0a6 !important;
                color: #ffffff;
                cursor: not-allowed;
                opacity: 0.7;
                transform: translateY(0) !important;
                box-shadow: none !important;
            }
            .seamless-checkout-btn:disabled:hover {
                transform: translateY(0) !important;
                box-shadow: none !important;
            }
            .seamless-crypto-payment {
                padding: 12px 0;
                border-top: 1px solid #e8eaed;
            }
            .seamless-crypto-label {
                font-size: 13px;
                font-weight: 600;
                color: #5f6368;
                margin-bottom: 10px;
            }
            .seamless-crypto-select {
                width: 100%;
                padding: 12px 40px 12px 16px;
                background: #ffffff;
                color: #1a1a1a;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                appearance: none;
                -webkit-appearance: none;
                -moz-appearance: none;
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%231a1a1a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
                background-repeat: no-repeat;
                background-position: right 12px center;
                background-size: 16px;
            }
            .seamless-crypto-select:hover {
                border-color: #1a1a1a;
            }
            .seamless-crypto-select:focus {
                outline: none;
                border-color: #1a1a1a;
                box-shadow: 0 0 0 3px rgba(26, 26, 26, 0.1);
            }
            /* Crypto-specific colors */
            .seamless-crypto-select option[value="eth"] {
                background: #627EEA;
                color: white;
            }
            .seamless-crypto-select option[value="btc"] {
                background: #F7931A;
                color: white;
            }
            .seamless-crypto-select option[value="usdc"] {
                background: #2775CA;
                color: white;
            }
            .seamless-crypto-select option[value="sol"] {
                background: #9945FF;
                color: white;
            }
            /* Ensure the replacement div maintains the same display as the original <a> */
            .seamless-replaced {
                display: inline-block;
                text-decoration: none;
            }
        `;

        if (!document.head.querySelector('style[data-seamless-checkout]')) {
            style.setAttribute('data-seamless-checkout', 'true');
            document.head.appendChild(style);
        }

        // Add event listeners
        const checkoutBtn = checkoutContainer.querySelector('#seamless-checkout-btn');
        const cryptoSelect = checkoutContainer.querySelector('#seamless-crypto-select');
        
        // Update dropdown styling based on selected crypto
        function updateCryptoSelectStyle() {
            const selectedValue = cryptoSelect.value;
            const colors = {
                'eth': '#627EEA',
                'btc': '#F7931A',
                'usdc': '#2775CA',
                'sol': '#9945FF'
            };
            cryptoSelect.style.borderColor = colors[selectedValue] || '#e0e0e0';
        }
        
        // Set initial style (Ethereum is default)
        updateCryptoSelectStyle();
        
        // Update style when selection changes
        cryptoSelect.addEventListener('change', updateCryptoSelectStyle);
        
        // Simple confetti effect function
        function triggerConfetti(element) {
            const colors = ['#34a853', '#ea4335', '#4285f4', '#fbbc04', '#1a1a1a'];
            const rect = element.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            for (let i = 0; i < 50; i++) {
                const confetti = document.createElement('div');
                confetti.style.position = 'fixed';
                confetti.style.left = centerX + 'px';
                confetti.style.top = centerY + 'px';
                confetti.style.width = '8px';
                confetti.style.height = '8px';
                confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                confetti.style.borderRadius = '50%';
                confetti.style.pointerEvents = 'none';
                confetti.style.zIndex = '10000';
                
                const angle = (Math.PI * 2 * i) / 50;
                const velocity = 2 + Math.random() * 3;
                const vx = Math.cos(angle) * velocity;
                const vy = Math.sin(angle) * velocity;
                const gravity = 0.3;
                let x = centerX;
                let y = centerY;
                let vyCurrent = vy;
                
                document.body.appendChild(confetti);
                
                let frame = 0;
                const animate = () => {
                    frame++;
                    x += vx;
                    y += vyCurrent;
                    vyCurrent += gravity;
                    
                    confetti.style.left = x + 'px';
                    confetti.style.top = y + 'px';
                    confetti.style.opacity = 1 - (frame / 60);
                    
                    if (frame < 60 && y < window.innerHeight + 100) {
                        requestAnimationFrame(animate);
                    } else {
                        confetti.remove();
                    }
                };
                
                requestAnimationFrame(animate);
            }
        }
        
        // Function to convert price to smallest unit (6 decimals for USDC)
        function convertPriceToSmallestUnit(priceInDollars) {
            return Math.floor(priceInDollars * 1000000).toString();
        }
        
        checkoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Prevent multiple clicks
            if (checkoutBtn.disabled) return;
            
            // Get selected crypto payment method from dropdown
            const cryptoMethod = cryptoSelect.value;
            
            // Trigger confetti effect
            triggerConfetti(checkoutBtn);
            
            // Update button state - grey out and show "Accepted!"
            checkoutBtn.disabled = true;
            checkoutBtn.innerHTML = 'Accepted!';
            checkoutBtn.classList.add('seamless-btn-accepted');
            
            try {
                // Convert price and commission to smallest unit (6 decimals for USDC)
                const priceInSmallestUnit = convertPriceToSmallestUnit(total);
                const commission = Math.floor(total * 0.10 * 1000000).toString(); // 10% commission
                
                // Hardcoded wallet addresses
                const consumerWallet = "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
                const storeWallet = "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
                const influencerWallet = "0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
                
                const requestBody = {
                    price: priceInSmallestUnit,
                    commission: commission,
                    consumer_wallet: consumerWallet,
                    store_wallet: storeWallet,
                    influencer_wallet: influencerWallet
                };
                
                console.log('Creating escrow deal...', requestBody);
                
                // Step 1: Create escrow deal using XMLHttpRequest
                const createData = await new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', 'https://seamlesscontract.onrender.com/api/create-escrow', true);
                    xhr.setRequestHeader('Content-Type', 'application/json');
                    
                    xhr.onload = function() {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            try {
                                const data = JSON.parse(xhr.responseText);
                                console.log('Escrow created:', data);
                                resolve(data);
                            } catch (e) {
                                reject(new Error('Failed to parse response: ' + e.message));
                            }
                        } else {
                            reject(new Error(`Failed to create escrow: ${xhr.status} - ${xhr.responseText}`));
                        }
                    };
                    
                    xhr.onerror = function() {
                        reject(new Error('Network error creating escrow'));
                    };
                    
                    xhr.send(JSON.stringify(requestBody));
                });
                
                // Extract dealId from response
                let dealId = null;
                if (createData.contract && createData.contract.dealId) {
                    dealId = createData.contract.dealId;
                } else if (createData.dealId) {
                    dealId = createData.dealId;
                }
                
                if (!dealId) {
                    throw new Error('No dealId received from create-escrow response');
                }
                
                console.log('Deal ID:', dealId);
                
                // Step 2: Wait 13 seconds, then fund consumer (call endpoint regardless of blockchain/simulation mode)
                setTimeout(() => {
                    console.log('Funding consumer...');
                    checkoutBtn.innerHTML = 'Contract at 50%'; // Update button immediately
                    
                    const xhrConsumer = new XMLHttpRequest();
                    xhrConsumer.open('POST', 'https://seamlesscontract.onrender.com/api/fund-consumer', true);
                    xhrConsumer.setRequestHeader('Content-Type', 'application/json');
                    
                    xhrConsumer.onload = function() {
                        try {
                            const data = JSON.parse(xhrConsumer.responseText);
                            if (xhrConsumer.status >= 200 && xhrConsumer.status < 300) {
                                console.log('Consumer funded:', data);
                            } else {
                                console.log('Consumer funding response (may be blockchain mode error):', data);
                            }
                        } catch (e) {
                            console.error('Error parsing consumer response:', e);
                        }
                        
                        // Step 3: Wait 13 more seconds, then fund store (call endpoint regardless of mode)
                        setTimeout(() => {
                            console.log('Funding store...');
                            checkoutBtn.innerHTML = 'Contract Fulfilled ->'; // Update button immediately
                            
                            // Re-enable button and make it clickable to open Etherscan
                            checkoutBtn.disabled = false;
                            checkoutBtn.style.cursor = 'pointer';
                            checkoutBtn.onclick = function(e) {
                                e.preventDefault();
                                e.stopPropagation();
                                window.open('https://sepolia.etherscan.io/address/0xC71ADfbDEA3a7BB990BB1841bec4Bb3706786009', '_blank');
                            };
                            
                            const xhrStore = new XMLHttpRequest();
                            xhrStore.open('POST', 'https://seamlesscontract.onrender.com/api/fund-store', true);
                            xhrStore.setRequestHeader('Content-Type', 'application/json');
                            
                            xhrStore.onload = function() {
                                try {
                                    const data = JSON.parse(xhrStore.responseText);
                                    if (xhrStore.status >= 200 && xhrStore.status < 300) {
                                        console.log('Store funded:', data);
                                    } else {
                                        console.log('Store funding response (may be blockchain mode error):', data);
                                    }
                                } catch (e) {
                                    console.error('Error parsing store response:', e);
                                }
                            };
                            
                            xhrStore.onerror = function() {
                                console.error('Network error funding store');
                            };
                            
                            xhrStore.send(JSON.stringify({
                                dealId: dealId,
                                store_wallet: storeWallet
                            }));
                        }, 13000);
                    };
                    
                    xhrConsumer.onerror = function() {
                        console.error('Network error funding consumer');
                    };
                    
                    xhrConsumer.send(JSON.stringify({
                        dealId: dealId,
                        consumer_wallet: consumerWallet
                    }));
                }, 13000);
                
            } catch (error) {
                console.error('Error creating escrow:', error);
                // Keep button as "Accepted!" on error
            }
        });

        return checkoutContainer;
    }

    // Function to detect and remove duplicate buying option sections
    function removeDuplicateBuyingOptions(replacedElement) {
        if (!replacedElement || !replacedElement.parentElement) return;

        // Look for sibling elements that might be duplicate buying option sections
        const parent = replacedElement.parentElement;
        const siblings = Array.from(parent.children);
        const replacedIndex = siblings.indexOf(replacedElement);

        // Check siblings after the replaced element
        for (let i = replacedIndex + 1; i < siblings.length; i++) {
            const sibling = siblings[i];
            if (!sibling || sibling.classList.contains('seamless-replaced')) continue;

            const text = sibling.textContent?.toLowerCase() || '';
            
            // Check for patterns that indicate duplicate buying option sections
            const hasDuplicatePatterns = 
                (text.includes('base price') || text.includes('was') || text.includes('delivery fee')) &&
                (text.includes('visit site') || text.includes('view details') || text.includes('total')) &&
                sibling.querySelector('[class*="price"], [aria-label*="$"]');

            // Also check for specific class patterns that indicate duplicate sections
            const hasDuplicateClasses = 
                sibling.classList.contains('mVhlhf') ||
                sibling.querySelector('.VhS4Dc, .DY4Ebb, .uItbPc') ||
                sibling.querySelector('.SYULCe, .qEITGe') || // "Visit site", "View details" buttons
                sibling.querySelector('.ab3nF, .GACihf'); // Action button containers

            if (hasDuplicatePatterns || hasDuplicateClasses) {
                console.log('Seamless: Removing duplicate buying option section', sibling);
                sibling.remove();
            }
        }

        // Also check parent's siblings (in case duplicates are at a different level)
        if (parent && parent.parentElement) {
            const grandParent = parent.parentElement;
            const parentSiblings = Array.from(grandParent.children);
            const parentIndex = parentSiblings.indexOf(parent);

            for (let i = parentIndex + 1; i < parentSiblings.length; i++) {
                const parentSibling = parentSiblings[i];
                if (!parentSibling) continue;

                const text = parentSibling.textContent?.toLowerCase() || '';
                
                // Check if this sibling contains duplicate buying option patterns
                const hasDuplicateContent = 
                    (text.includes('base price') || text.includes('was') || text.includes('delivery fee')) &&
                    (text.includes('visit site') || text.includes('view details')) &&
                    parentSibling.querySelector('[class*="price"], [aria-label*="$"]');

                if (hasDuplicateContent) {
                    // Check if this is a duplicate section (not the main product card)
                    const hasBuyingOptionLink = parentSibling.querySelector('a[jsname="wN9W3"]:not(.seamless-replaced)');
                    if (hasBuyingOptionLink) {
                        // This might be another buying option, check if it's a duplicate
                        const priceMatches = parentSibling.querySelectorAll('[class*="price"], [aria-label*="$"]');
                        if (priceMatches.length >= 2) {
                            console.log('Seamless: Removing duplicate buying option section at parent level', parentSibling);
                            parentSibling.remove();
                        }
                    }
                }
            }
        }
    }

    // Function to replace "Buying Options" text with "Seamless Smart Checkout" - DISABLED
    function replaceBuyingOptionsText() {
        // This function is disabled - we're not replacing "Buying Options" text anymore
        return;
    }

    // Function to remove "typically $xx", "was $xx" type text from the page
    function removeTypicalPriceText() {
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
            const text = node.textContent?.trim();
            // Match patterns like "typically $xx", "was $xx", "Usually $xx", etc.
            if (text && /^(typically|usually|was|originally)\s+\$?\d+/.test(text.toLowerCase())) {
                textNodes.push(node);
            }
        }

        textNodes.forEach(textNode => {
            const parent = textNode.parentElement;
            // Only remove if it's not inside our checkout container
            if (parent && !parent.closest('.seamless-checkout-container')) {
                // Remove the entire element if it's a small text element, or just the text if it's part of a larger element
                if (parent.tagName === 'SPAN' || parent.tagName === 'DIV') {
                    const siblings = Array.from(parent.parentElement.children);
                    if (siblings.length === 1 || parent.textContent.trim() === textNode.textContent.trim()) {
                        parent.remove();
                    } else {
                        textNode.remove();
                    }
                } else {
                    textNode.remove();
                }
            }
        });
    }

    // Main function to replace buying options - replace only the inner content of the <a> element
    function replaceBuyingOptions() {
        const buyingOptions = findBuyingOptions();
        
        buyingOptions.forEach(({ container }) => {
            // Skip if already replaced
            if (container.classList.contains('seamless-replaced') || 
                container.querySelector('.seamless-checkout-container')) {
                return;
            }

            // Extract product info from this buying option link
            const productInfo = extractProductInfo(container);

            // Create checkout UI
            const checkoutUI = createCheckoutUI(productInfo);

            // Replace ONLY the inner content of the <a> element, keeping the <a> tag itself
            // This preserves the structure and positioning
            if (container) {
                // Remove href to prevent navigation
                container.removeAttribute('href');
                
                // Clear existing content and add checkout UI
                container.innerHTML = '';
                container.appendChild(checkoutUI);
                container.classList.add('seamless-replaced');

                // Remove duplicate buying option sections after replacement
                removeDuplicateBuyingOptions(container);
            }
        });

        if (buyingOptions.length > 0) {
            console.log(`Seamless: Found and replaced ${buyingOptions.length} buying option links`);
        }

        // Also replace "Buying Options" text and remove typical price text
        replaceBuyingOptionsText();
        removeTypicalPriceText();
    }

    // Run on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', replaceBuyingOptions);
    } else {
        replaceBuyingOptions();
    }

    // Also run after a delay to catch dynamically loaded content
    setTimeout(replaceBuyingOptions, 2000);
    setTimeout(replaceBuyingOptions, 5000);

    // Watch for dynamic content changes (for infinite scroll or lazy loading)
    const observer = new MutationObserver((mutations) => {
        let shouldReplace = false;
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1 && (node.querySelector?.('[class*="price"], [class*="sh-"]'))) {
                        shouldReplace = true;
                    }
                });
            }
        });
        if (shouldReplace) {
            setTimeout(replaceBuyingOptions, 500);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();