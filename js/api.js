const API_BASE = 'http://localhost:8000';

let authToken = localStorage.getItem('access_token') || '';

export function setAuthToken(token) {
    authToken = token;
    if (token) {
        localStorage.setItem('access_token', token);
    } else {
        localStorage.removeItem('access_token');
    }
}

// === НОРМАЛИЗАЦИЯ ОТВЕТОВ БЭКЕНДА ===
// Бэкенд возвращает поля с опечатками и UPPERCASE enum'ами — нормализуем рекурсивно

function deepNormalize(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(deepNormalize);

    // Опечатка: reviewrs → reviews
    if ('reviewrs' in obj && !('reviews' in obj)) {
        obj.reviews = obj.reviewrs;
        delete obj.reviewrs;
    }

    // Опечатка: type_massege → type_message
    if ('type_massege' in obj && !('type_message' in obj)) {
        obj.type_message = obj.type_massege;
        delete obj.type_massege;
    }

    // UPPERCASE group_mode → lowercase
    if (typeof obj.group_mode === 'string') {
        obj.group_mode = obj.group_mode.toLowerCase();
    }

    // UPPERCASE role → lowercase
    if (typeof obj.role === 'string') {
        obj.role = obj.role.toLowerCase();
    }

    // UPPERCASE status → lowercase
    if (typeof obj.status === 'string') {
        obj.status = obj.status.toLowerCase();
    }

    // UPPERCASE type_message → lowercase
    if (typeof obj.type_message === 'string') {
        obj.type_message = obj.type_message.toLowerCase();
    }

    // Нормализуем вложенные объекты
    Object.keys(obj).forEach(key => {
        if (obj[key] && typeof obj[key] === 'object') {
            obj[key] = deepNormalize(obj[key]);
        }
    });

    return obj;
}

function normalizeResponse(data) {
    return deepNormalize(data);
}
// === /НОРМАЛИЗАЦИЯ ===

async function request(endpoint, method = 'GET', body = null, needsAuth = true) {
    const headers = {
        'Content-Type': 'application/json',
    };
    if (needsAuth && authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    const options = {
        method,
        headers,
    };
    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, options);

        if (response.status === 401) {
            setAuthToken('');
            if (typeof window !== 'undefined' && !window.location.pathname.includes('/index.html')) {
                window.location.href = '/index.html';
            }
            throw new Error('Сессия истекла. Пожалуйста, войдите снова.');
        }

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || `Ошибка ${response.status}`);
        }

        // Нормализуем ответ перед возвратом
        return normalizeResponse(data);
    } catch (error) {
        console.error(`API request failed: ${endpoint}`, error);
        throw error;
    }
}

export const authAPI = {
    async login(email, password) {
        const data = await request('/auth/login', 'POST', { email, password }, false);
        if (data.access_token) {
            setAuthToken(data.access_token);
        }
        return data;
    },

    async register(userData) {
        return await request('/users/register', 'POST', userData, false);
    },

    logout() {
        setAuthToken('');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userName');
        localStorage.removeItem('feedback_user_profile');
        localStorage.removeItem('my_submissions');
    },

    getToken() {
        return authToken;
    },

    isAuthenticated() {
        return !!authToken;
    }
};

export const usersAPI = {
    async getMe() {
        const stored = loadFromStorage();
        if (stored) return stored;

        try {
            const user = await request('/users/me', 'GET');
            saveProfileToStorage(user);
            return user;
        } catch (error) {
            console.warn('Не удалось загрузить профиль с сервера:', error.message);
            try {
                const token = authToken.split('.')[1];
                const payload = JSON.parse(atob(token));
                return {
                    id: payload.user_id,
                    email: payload.sub || 'user@example.com',
                    name: 'Пользователь',
                    surname: ''
                };
            } catch {
                throw new Error('Не удалось получить данные пользователя');
            }
        }
    },

    async updateProfile(data) {
        const result = await request('/users/me', 'PUT', data);
        saveProfileToStorage(result);
        return result;
    },

    async changePassword(current_password, new_password) {
        throw new Error('Смена пароля временно недоступна');
    }
};

function loadFromStorage() {
    try {
        const raw = localStorage.getItem('feedback_user_profile');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function saveProfileToStorage(profile) {
    if (!profile) {
        localStorage.removeItem('feedback_user_profile');
        return;
    }
    localStorage.setItem('feedback_user_profile', JSON.stringify({
        id: profile.id,
        name: profile.name,
        surname: profile.surname,
        patronymic: profile.patronymic,
        email: profile.email,
        updatedAt: Date.now()
    }));
}

export const groupsAPI = {
    async getMyGroups() {
        return await request('/groups/my', 'GET');
    },

    async createGroup(name, groupMode = 'classic', countOfInspectors = 1, countOfStudentInspectors = null) {
        let count_of_inspectors_expert = 0;
        let count_of_inspectors_student = 0;

        if (groupMode === 'classic') {
            count_of_inspectors_expert = countOfInspectors;
            count_of_inspectors_student = 0;
        } else if (groupMode === 'p2p') {
            count_of_inspectors_expert = 0;
            count_of_inspectors_student = countOfInspectors;
        } else if (groupMode === 'contest') {
            count_of_inspectors_expert = countOfInspectors;
            count_of_inspectors_student = countOfStudentInspectors !== null ? countOfStudentInspectors : countOfInspectors;
        }

        const body = {
            name,
            group_mode: groupMode,
            count_of_inspectors_expert,
            count_of_inspectors_student
        };
        return await request('/groups', 'POST', body);
    },

    async joinGroupByToken(token) {
        return await request(`/groups/join/${token}`, 'GET');
    },

    async getMembers(groupId) {
        return await request(`/groups/${groupId}/members`, 'GET');
    },

    async removeMember(groupId, userId) {
        return await request(`/groups/${groupId}/members/${userId}`, 'DELETE');
    },

    async getCriteria(groupId) {
        return await request(`/groups/${groupId}/criteria`, 'GET');
    },

    async createCriterion(groupId, data) {
        return await request(`/groups/${groupId}/criteria`, 'POST', data);
    },

    async updateCriterion(groupId, criterionId, data) {
        return await request(`/groups/${groupId}/criteria/${criterionId}`, 'PUT', data);
    },

    async deleteCriterion(groupId, criterionId) {
        return await request(`/groups/${groupId}/criteria/${criterionId}`, 'DELETE');
    },

    async getMyReviews() {
        return await request('/groups/my-reviews', 'GET');
    },

    async getReviewerSubmissionsByGroup(groupId) {
        const allReviews = await request('/groups/my-reviews', 'GET');
        return Array.isArray(allReviews) ? allReviews.filter(r => r.group_id == groupId) : [];
    },

    async submitWork(link, groupId) {
        const result = await request('/groups/submit', 'POST', { link, group_id: groupId });
        return result;
    },

    async getSubmission(submissionId) {
        return await request(`/groups/submissions/${submissionId}`, 'GET');
    },

    async reviewWork(submissionId, comment, grades) {
        return await request(`/groups/submissions/${submissionId}/review`, 'POST', {
            comment,
            grades
        });
    },

    async updateSubmissionLink(submissionId, link) {
        return await request(`/groups/submissions/${submissionId}/link`, 'PUT', { link });
    },

    async updateSubmissionComment(submissionId, comment) {
        return await request(`/groups/submissions/${submissionId}/comment`, 'PUT', { comment });
    },

    async getRating(groupId) {
        try {
            return await request(`/rating?group_id=${groupId}`, 'GET');
        } catch (error) {
            if (error.message && (error.message.includes('400') || error.message.includes('не может быть рейтинга'))) {
                return null;
            }
            throw error;
        }
    }
};