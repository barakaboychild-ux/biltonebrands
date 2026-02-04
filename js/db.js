/**
 * Biltone Supplies - Supabase Database Layer
 * Replaces localStorage with Supabase Async Calls
 */

// Initialize Supabase
let supabase;
if (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE_URL && CONFIG.SUPABASE_KEY) {
    if (typeof createClient === 'undefined' && window.supabase && window.supabase.createClient) {
        supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
    } else if (typeof createClient !== 'undefined') {
        supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
    } else {
        console.warn("Supabase SDK not loaded or init failed.");
    }
} else {
    console.warn("Supabase Config missing.");
}

const DB = {
    async init() {
        console.log("DB Init: Supabase Connected");
        // No local storage seed needed
    },

    // --- Products ---
    async getProducts() {
        const { data, error } = await supabase.from('products').select('*').order('id', { ascending: false });
        if (error) { console.error("Error fetching products:", error); return []; }
        return data || [];
    },
    async getProduct(id) {
        const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
        if (error) { console.error("Error fetching product:", error); return null; }
        return data;
    },
    async saveProduct(product) {
        // Remove ID if it's a temp/timestamp ID for new items (Supabase handles auto-increment)
        // Or if we are using the same ID system.
        // If product.id is a large timestamp number, treat as new insert (omit ID)
        const isNew = product.id > 1000000; // Heuristic for timestamp ID

        let payload = { ...product };
        if (isNew) {
            delete payload.id;
        }

        const { data, error } = await supabase.from('products').upsert(payload).select();
        if (error) throw error;
        return data ? data[0] : null;
    },
    async deleteProduct(id) {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) throw error;
    },

    // --- Offers (Integrated in Products) ---
    // Function to filter products with offers
    async getOffers() {
        const { data, error } = await supabase.from('products').select('*').not('offer_price', 'is', null);
        if (error) return [];
        return data.filter(p => p.offer_expires && new Date(p.offer_expires) > new Date());
    },

    // --- Users (Auth) ---
    async getUsers() {
        // Only feasible if we have a 'profiles' table that syncs with Auth
        // Because client cannot list auth.users
        const { data, error } = await supabase.from('profiles').select('*');
        if (error) { console.error(error); return []; }
        return data;
    },

    async registerUser(email, password, name) {
        // 1. SignUp
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: name
                }
            }
        });
        if (error) throw error;
        // Profile creation handled by Trigger in SQL
        return data.user;
    },

    async loginUser(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;

        // Check Profile for Approval/Role
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

        if (profileError) throw profileError;

        if (!profile.approved && profile.role !== 'owner') {
            throw new Error("Account pending approval");
        }

        return {
            ...data.user,
            role: profile.role,
            name: profile.full_name,
            approved: profile.approved
        };
    },

    async approveUser(email) {
        // Find profile by email (Note: profiles table needs email column as per SQL plan)
        const { data, error } = await supabase.from('profiles').update({ approved: true }).eq('email', email);
        if (error) console.error(error);
    },

    // --- Messages ---
    async getMessages() {
        const { data, error } = await supabase.from('messages').select('*').order('created_at', { ascending: false });
        if (error) return [];
        return data;
    },
    async saveMessage(msg) {
        // Msg usually has name, email, message
        // Add id if needed, but table handles it
        // Supabase expects 'id' to be text? SQL said text primary key. 
        // Let's generate one or let DB handle it if it was uuid. 
        // My SQL said: id text primary key. So I must provide it.
        const payload = {
            id: 'MSG-' + Date.now(),
            ...msg,
            status: 'New'
        };
        const { error } = await supabase.from('messages').insert(payload);
        if (error) console.error(error);
    },
    async markMessageRead(id) {
        await supabase.from('messages').update({ status: 'Read' }).eq('id', id);
    },

    // --- Pending Updates ---
    async getPendingUpdates() {
        const { data, error } = await supabase.from('pending_updates').select('*');
        if (error) return [];
        return data;
    },
    async requestProfileUpdate(email, userData) {
        const payload = {
            id: 'UPD-' + Date.now(),
            email,
            userData: userData // Ensure columns match JSONB in SQL
        };
        await supabase.from('pending_updates').insert(payload);
    },
    async approveProfileUpdate(id) {
        // 1. Get update
        const { data: update } = await supabase.from('pending_updates').select('*').eq('id', id).single();
        if (!update) return false;

        // 2. Apply update (to Profile)
        const { error } = await supabase.from('profiles').update({ ...update.userData }).eq('email', update.email);
        if (error) throw error;

        // 3. Delete pending
        await supabase.from('pending_updates').delete().eq('id', id);
        return true;
    },
    async rejectProfileUpdate(id) {
        await supabase.from('pending_updates').delete().eq('id', id);
    },

    // --- Orders ---
    async getOrders() {
        const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
        if (error) return [];
        return data;
    },
    async createOrder(orderData) {
        const newOrder = {
            id: 'ORD-' + Date.now(),
            status: 'Pending',
            total: orderData.total,
            customer_details: orderData.customer,
            items: orderData.items
        };
        const { data, error } = await supabase.from('orders').insert(newOrder).select();
        if (error) throw error;
        return data[0];
    },
    async updateOrderStatus(id, status) {
        await supabase.from('orders').update({ status }).eq('id', id);
    },

    // --- Content ---
    async getContent() {
        // Assume key 'aboutUs'
        const { data, error } = await supabase.from('content').select('*').eq('key', 'site_content').single();
        if (error || !data) return {};
        return data.value || {};
    },
    async saveContent(content) {
        const { error } = await supabase.from('content').upsert({ key: 'site_content', value: content });
        if (error) console.error(error);
    }
};

// Auto-init?
// DB.init();
