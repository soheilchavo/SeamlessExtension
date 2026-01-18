console.log("Saved products page loaded");function a(){try{const t=localStorage.getItem("savedProducts");return t?JSON.parse(t):[]}catch(t){return console.error("Error loading saved products:",t),[]}}function l(t){const e=a().filter(o=>o.normalizedKey!==t);localStorage.setItem("savedProducts",JSON.stringify(e)),console.log("Product unsaved:",t)}function n(){console.log("=== DISPLAY SAVED PRODUCTS ===");const t=document.getElementById("saved-products");if(!t){console.error("ERROR: Saved products container not found in DOM!");return}const r=a();if(console.log("Saved products count:",r.length),t.innerHTML="",r.length===0){t.innerHTML=`
            <div class="no-saved-products">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
                <h3>No saved products yet</h3>
                <p>Products you save will appear here</p>
            </div>
        `;return}r.forEach((e,o)=>{console.log(`Processing saved product ${o}:`,e);const s=document.createElement("div");if(s.className="product-card",e.url){const c=e.image_url?`<img class="product-image" src="${e.image_url}" alt="${e.itemName}" onerror="this.style.display='none'" />`:`<div class="product-image product-placeholder">
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="2">
                       <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                       <circle cx="8.5" cy="8.5" r="1.5"/>
                       <polyline points="21 15 16 10 5 21"/>
                     </svg>
                   </div>`;s.innerHTML=`
                <button class="save-btn saved" data-key="${e.normalizedKey}">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ff3b5c" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                </button>
                ${c}
                <div class="product-info">
                    <div class="product-name">${e.itemName||"Product"}</div>
                    ${e.name?`<div class="product-title">${e.name}</div>`:""}
                    ${e.price?`<div class="product-price">${e.price}</div>`:""}
                </div>
                <button class="shop-btn" data-url="${e.url}">Shop Now →</button>
            `}t.appendChild(s)}),t.querySelectorAll(".shop-btn").forEach(e=>{e.onclick=()=>{const o=e.getAttribute("data-url");o&&window.open(o,"_blank")}}),t.querySelectorAll(".save-btn").forEach(e=>{e.onclick=o=>{o.stopPropagation();const s=e.getAttribute("data-key");l(s),n()}})}document.addEventListener("DOMContentLoaded",()=>{n(),document.querySelectorAll(".nav-item").forEach(r=>{r.addEventListener("click",()=>{const e=r.getAttribute("data-page");e&&(window.location.href=e)})})});
