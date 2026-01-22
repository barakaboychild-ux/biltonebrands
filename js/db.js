/**
 * Biltone Supplies - Supabase Database
 * Handles data persistence using Supabase
 */

const DB = {
    // --- Products ---
    async getProducts() {
        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching products:", error);
            return [];
        }

        return products.map(p => ({
            id: p.id,
            title: p.title,
            price: p.price,
            offerPrice: p.offer_price,
            offerExpires: p.offer_expires,
            image: p.image_url,
            stock: p.stock || 0,
            category: p.category || ''
        }));
    },

    async getProduct(id) {
        const { data: product, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error("Error fetching product:", error);
            return null;
        }

        return {
            id: product.id,
            title: product.title,
            price: product.price,
            offerPrice: product.offer_price,
            offerExpires: product.offer_expires,
            image: product.image_url,
            stock: product.stock || 0,
            category: product.category || ''
        };
    },

    async saveProduct(product) {
        if (product.id) {
            const { error } = await supabase
                .from('products')
                .update({
                    title: product.title,
                    price: product.price,
                    offer_price: product.offerPrice || null,
                    offer_expires: product.offerExpires || null,
                    image_url: product.image,
                    stock: product.stock || 0,
                    category: product.category || ''
                })
                .eq('id', product.id);

            if (error) console.error("Error updating product:", error);
        } else {
            const { data, error } = await supabase
                .from('products')
                .insert([{
                    title: product.title,
                    price: product.price,
                    offer_price: product.offerPrice || null,
                    offer_expires: product.offerExpires || null,
                    image_url: product.image,
                    stock: product.stock || 0,
                    category: product.category || ''
                }]);

            if (error) console.error("Error inserting product:", error);
            else product.id = data[0].id;
        }

        return product;
    },

    async deleteProduct(id) {
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);

        if (error) console.error("Error deleting product:", error);
    },

    // --- Users (Auth) ---
    async getUsers() {
        const { data: users, error } = await supabase.from('users').select('*');
        if (error) return [];
        return users;
    },

    async loginUser(email, password) {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .eq('password', password) // In real app, store hashed passwords!
            .single();

        if (error) return null;
        return user;
    },

    async registerUser(email, password, name) {
        const { error } = await supabase.from('users').insert([{ email, password, name, role: 'admin', approved: false }]);
        if (error) throw new Error(error.message);
    },

    // --- Orders ---
    async getOrders() {
        const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
        if (error) return [];
        return data;
    },

    async createOrder(orderData) {
        const { data, error } = await supabase.from('orders').insert([{
            ...orderData,
            status: 'Pending',
            date: new Date().toISOString()
        }]);
        if (error) return null;
        return data[0];
    },

    async updateOrderStatus(id, status) {
        const { error } = await supabase.from('orders').update({ status }).eq('id', id);
        if (error) console.error(error);
    },

    // --- Messages ---
    async getMessages() {
        const { data, error } = await supabase.from('messages').select('*').order('date', { ascending: false });
        if (error) return [];
        return data;
    },

    async saveMessage(msg) {
        const { error } = await supabase.from('messages').insert([{ ...msg, date: new Date().toISOString(), status: 'New' }]);
        if (error) console.error(error);
    },

    async markMessageRead(id) {
        const { error } = await supabase.from('messages').update({ status: 'Read' }).eq('id', id);
        if (error) console.error(error);
    },

    // --- Content ---
    async getContent() {
        const { data, error } = await supabase.from('content').select('*').single();
        if (error) return {};
        return data;
    },

    async saveContent(content) {
        const { error } = await supabase.from('content').update(content).eq('id', 1);
        if (error) console.error(error);
    }
};
