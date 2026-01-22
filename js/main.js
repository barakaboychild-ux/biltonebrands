/**
 * Biltone Supplies - Main Logic (Supabase Integrated)
 * Handles Cart, Auth, and UI interactions
 */

const App = {
    state: {
        cart: [],
        user: null,
        products: [] // Store products fetched from Supabase
    },

    init() {
        this.loadCart();
        this.checkAuth();
        this.updateCartUI();
        this.loadProducts(); // Load products from Supabase
    },

    // --- Cart System ---
    loadCart() {
        const saved = localStorage.getItem('biltone_cart');
        if (saved) this.state.cart = JSON.parse(saved);
    },

    saveCart() {
        localStorage.setItem('biltone_cart', JSON.stringify(this.state.cart));
        this.updateCartUI();
    },

    addToCart(product, quantity = 1) {
        const existing = this.state.cart.find(item => item.id === product.id);
        if (existing) {
            existing.quantity += quantity;
        } else {
            const price = product.offerPrice && new Date(product.offerExpires) > new Date() ? product.offerPrice : product.price;

            this.state.cart.push({
                id: product.id,
                title: product.title,
                price: price,
                image: product.image,
                quantity: quantity
            });
        }
        this.saveCart();
        this.showToast(`Added ${quantity} ${product.title} to cart`);
    },

    removeFromCart(id) {
        this.state.cart = this.state.cart.filter(item => item.id !== id);
        this.saveCart();
    },

    updateQuantity(id, quantity) {
        const item = this.state.cart.find(item => item.id === id);
        if (item) {
            item.quantity = parseInt(quantity);
            if (item.quantity <= 0) this.removeFromCart(id);
            else this.saveCart();
        }
    },

    getCartTotal() {
        return this.state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    },

    clearCart() {
        this.state.cart = [];
        this.saveCart();
    },

    updateCartUI() {
        const count = this.state.cart.reduce((sum, item) => sum + item.quantity, 0);
        const badge = document.getElementById('cart-count');
        if (badge) {
            badge.textContent = count;
            badge.classList.toggle('hidden', count === 0);
        }
    },

    // --- Auth System ---
    checkAuth() {
        const session = sessionStorage.getItem('biltone_session');
        if (session) {
            this.state.user = JSON.parse(session);
            this.updateAuthUI();
        }
    },

    login(email, password) {
        try {
            const user = DB.loginUser(email, password);
            if (user) {
                sessionStorage.setItem('biltone_session', JSON.stringify(user));
                this.state.user = user;
                return true;
            }
            return false;
        } catch (e) {
            alert(e.message);
            return false;
        }
    },

    logout() {
        sessionStorage.removeItem('biltone_session');
        this.state.user = null;
        const inAdmin = window.location.pathname.includes('/admin/');
        window.location.href = inAdmin ? '../index.html' : 'index.html';
    },

    updateAuthUI() {
        const adminLink = document.getElementById('admin-link');
        if (adminLink && this.state.user) {
            adminLink.href = '#';
            adminLink.textContent = 'Log Out';
            adminLink.onclick = (e) => {
                e.preventDefault();
                this.logout();
            };
        }
    },

    // --- Supabase Product Loader ---
    async loadProducts() {
        try {
            const { data: products, error } = await supabase
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Store products locally
            this.state.products = products.map(p => ({
                id: p.id,
                title: p.title,
                price: p.price,
                offerPrice: p.offer_price,
                offerExpires: p.offer_expires,
                image: p.image_url
            }));

            this.renderFeaturedProducts();
        } catch (err) {
            console.error('Error loading products:', err.message);
            const container = document.getElementById('featured-products');
            if (container) container.innerHTML = '<div class="col-span-full text-center py-8 text-red-500">Failed to load products.</div>';
        }
    },

    renderFeaturedProducts() {
        const container = document.getElementById('featured-products');
        container.innerHTML = '';

        const featured = this.state.products.slice(0, 4);
        featured.forEach(product => {
            const hasOffer = product.offerPrice && new Date(product.offerExpires) > new Date();
            const priceDisplay = hasOffer
                ? `<span class="text-red-500 font-bold">${this.formatMoney(product.offerPrice)}</span> <span class="text-gray-400 line-through text-sm">${this.formatMoney(product.price)}</span>`
                : `<span class="text-gray-900 font-bold">${this.formatMoney(product.price)}</span>`;

            const card = `
                <div class="bg-white p-4 rounded-xl shadow-sm hover:shadow-md transition group border border-gray-100">
                    <div class="relative mb-4 overflow-hidden rounded-lg bg-gray-100 h-48">
                        <img src="${product.image}" alt="${product.title}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500" onerror="this.src='https://placehold.co/400x400?text=No+Image'">
                        ${hasOffer ? '<span class="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded z-20">OFFER</span>' : ''}
                    </div>
                    <div class="p-4">
                        <h3 class="font-semibold text-gray-800 mb-2 truncate">${product.title}</h3>
                        <div class="flex justify-between items-center">
                            <div>${priceDisplay}</div>
                            <button onclick="App.addToCart(DB.getProduct('${product.id}'))" class="bg-primary-50 text-primary-600 p-2 rounded-full hover:bg-primary-100 transition">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML += card;
        });
    },

    // --- Utilities ---
    formatMoney(amount) {
        return 'KES ' + amount.toLocaleString();
    },

    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded shadow-lg z-50 animate-bounce';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

