import { ref } from 'vue';
import axios from 'axios';
import type { Contact } from '@/types/index';

const contacts = ref<Contact[]>([]);

export function useContacts() {

    const loadContacts = async () => {
        try {
            if (contacts.value.length === 0) {
                const response = await axios.get('/chat/contacts');
                contacts.value = response.data;
            }
        } catch (e) {
            console.error("Gagal memuat kontak terpusat:", e);
        }
    };

    const updateUserInContacts = (updatedUser: any) => {
        const userToUpdate = contacts.value.find(u => u.id === updatedUser.id);
        if (userToUpdate) {
            userToUpdate.name = updatedUser.name;
            userToUpdate.profile_photo_url = updatedUser.profile_photo_url;
        }
    };

    return {
        contacts,
        loadContacts,
        updateUserInContacts
    };
}