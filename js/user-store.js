/**
 * UserStore — централизованное хранилище профиля пользователя
 * 
 * Жизненный цикл:
 * 1. Регистрация → сервер возвращает UserResponse → сохраняем
 * 2. Логин → сервер возвращает только токен → используем кэш или ждём ручного ввода
 * 3. Обновление профиля → сервер возвращает UserResponse → обновляем
 * 4. Перезагрузка страницы → восстанавливаем из persistent storage
 */

const STORAGE_KEY = 'feedback_user_profile';

function loadFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function saveToStorage(profile) {
    if (!profile) {
        localStorage.removeItem(STORAGE_KEY);
        return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        id: profile.id,
        name: profile.name,
        surname: profile.surname,
        patronymic: profile.patronymic,
        email: profile.email,
        updatedAt: Date.now()
    }));
}

let _cache = loadFromStorage();

export const userStore = {
    // Получить текущий профиль (синхронно, для рендера)
    getProfile() {
        return _cache;
    },

    // Получить display name для хедера
    getDisplayName() {
        if (!_cache) return 'Пользователь';
        if (_cache.surname && _cache.name) {
            return `${_cache.surname} ${_cache.name}`;
        }
        return _cache.email || 'Пользователь';
    },

    // Получить полное ФИО
    getFullName() {
        if (!_cache) return '';
        const parts = [_cache.surname, _cache.name, _cache.patronymic].filter(Boolean);
        return parts.join(' ');
    },

    // Установить профиль (после регистрации или обновления)
    setProfile(profile) {
        _cache = {
            id: profile.id,
            name: profile.name || '',
            surname: profile.surname || '',
            patronymic: profile.patronymic || '',
            email: profile.email || ''
        };
        saveToStorage(_cache);
    },

    // Обновить частично (например, после PUT /users/me)
    patchProfile(updates) {
        if (!_cache) _cache = {};
        Object.assign(_cache, updates);
        saveToStorage(_cache);
    },

    // Очистить (при выходе)
    clear() {
        _cache = null;
        localStorage.removeItem(STORAGE_KEY);
    },

    // Получить ID пользователя из токена (единственное место с костылём)
    getUserIdFromToken() {
        const token = localStorage.getItem('access_token');
        if (!token) return null;
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.user_id || null;
        } catch {
            return null;
        }
    }
};