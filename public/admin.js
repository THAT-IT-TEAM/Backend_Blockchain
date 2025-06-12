document.addEventListener('DOMContentLoaded', () => {
    const authSection = document.getElementById('auth-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('logout-btn');
    const authMessage = document.getElementById('auth-message');
    const welcomeMessage = document.getElementById('welcome-message');

    const registerUserForm = document.getElementById('register-user-form');
    const registerUserMessage = document.getElementById('register-user-message');
    const usersListDiv = document.getElementById('users-list');

    const syncCheckBtn = document.getElementById('sync-check-btn');
    const syncCheckOutput = document.getElementById('sync-check-output');
    const runSyncBtn = document.getElementById('run-sync-btn');
    const runSyncOutput = document.getElementById('run-sync-output');

    const tablesListDiv = document.getElementById('tables-list');

    let jwtToken = localStorage.getItem('jwtToken') || null;

    // --- UI State Management ---
    function showAuth() {
        authSection.style.display = 'block';
        dashboardSection.style.display = 'none';
    }

    function showDashboard() {
        authSection.style.display = 'none';
        dashboardSection.style.display = 'block';
        fetchUsers();
        fetchTables();
    }

    function setAuthMessage(message, isError = true) {
        authMessage.textContent = message;
        authMessage.className = isError ? 'error' : 'success';
    }

    function setRegisterUserMessage(message, isError = true) {
        registerUserMessage.textContent = message;
        registerUserMessage.className = isError ? 'error' : 'success';
    }

    // --- API Calls ---
    async function callApi(endpoint, options = {}) {
        // Ensure endpoint starts with a forward slash
        if (!endpoint.startsWith('/')) {
            endpoint = `/${endpoint}`;
        }

        // Set up default headers
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        // Add JWT token if available
        if (jwtToken) {
            headers['Authorization'] = `Bearer ${jwtToken}`;
        }

        // Merge headers with any provided in options
        const requestHeaders = {
            ...headers,
            ...(options.headers || {})
        };

        // Prepare request options
        const requestOptions = {
            ...options,
            headers: requestHeaders,
            credentials: 'include', // Include cookies if needed
            mode: 'cors' // Enable CORS
        };

        // Only include body if it exists and is an object
        if (options.body) {
            requestOptions.body = typeof options.body === 'string' 
                ? options.body 
                : JSON.stringify(options.body);
        }

        try {
            const response = await fetch(endpoint, requestOptions);
            
            // Handle unauthorized/forbidden responses
            if (response.status === 401 || response.status === 403) {
                console.warn('Authentication required or access denied');
                logout();
                return { success: false, error: 'Session expired. Please log in again.' };
            }

            // Handle empty responses
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const errorText = await response.text();
                console.error('Non-JSON response:', errorText);
                return { 
                    success: false, 
                    error: 'Invalid response from server',
                    status: response.status,
                    statusText: response.statusText
                };
            }

            const data = await response.json();

            // If the response is not OK, handle the error
            if (!response.ok) {
                console.error('API error response:', {
                    status: response.status,
                    statusText: response.statusText,
                    data
                });
                
                // If the error has a message, show it to the user
                if (data && data.error) {
                    setAuthMessage(data.error, true);
                } else {
                    setAuthMessage(`Request failed with status ${response.status}`, true);
                }
                
                return { success: false, ...data };
            }

            // Successful response
            return { success: true, ...data };
            
        } catch (error) {
            console.error(`Error calling ${endpoint}:`, error);
            setAuthMessage(`Network error: ${error.message}`, true);
            return { 
                success: false, 
                error: error.message || 'Network request failed',
                isNetworkError: true
            };
        }
    }

    async function fetchUsers() {
        usersListDiv.textContent = 'Loading users...';
        const data = await callApi('/api/users');
        if (data && data.users) {
            let html = '<h4>Registered Users:</h4>';
            if (data.users.length === 0) {
                html += '<p>No users registered yet.</p>';
            } else {
                html += '<ul>';
                data.users.forEach(user => {
                    html += `<li><strong>Email:</strong> ${user.email}, <strong>Role:</strong> ${user.role}, <strong>Wallet ID:</strong> ${user.wallet_id || 'N/A'}</li>`;
                });
                html += '</ul>';
            }
            usersListDiv.innerHTML = html;
        } else if (data && data.error) {
            usersListDiv.textContent = `Error: ${data.error}`;
            usersListDiv.className = 'error';
        }
    }

    async function fetchTables() {
        tablesListDiv.textContent = 'Loading table names...';
        const data = await callApi('/admin/tables'); // New endpoint for tables
        if (data && data.tables) {
            let html = '<h4>Database Tables:</h4><ul>';
            data.tables.forEach(table => {
                html += `<li>${table.name}</li>`;
            });
            html += '</ul>';
            tablesListDiv.innerHTML = html;
        } else if (data && data.error) {
            tablesListDiv.textContent = `Error: ${data.error}`;
            tablesListDiv.className = 'error';
        }
    }

    // --- Event Listeners ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        // Show loading state
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Logging in...';

        try {
            const data = await callApi('/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            if (data && data.success && data.data && data.data.token) {
                // Successful login
                jwtToken = data.data.token;
                localStorage.setItem('jwtToken', jwtToken);
                
                // Update UI with user info
                welcomeMessage.textContent = `Welcome, ${data.data.role} (${data.data.email})!`;
                showDashboard();
                setAuthMessage(data.message || 'Login successful!', false);
                
                // Clear the form
                loginForm.reset();
            } else {
                // Handle error response
                const errorMsg = data?.error || 'Invalid email or password';
                setAuthMessage(errorMsg, true);
                
                // Focus on the email field for correction
                document.getElementById('email').focus();
            }
        } catch (error) {
            console.error('Login error:', error);
            setAuthMessage('An error occurred during login. Please try again.', true);
        } finally {
            // Reset button state
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
    });

    logoutBtn.addEventListener('click', () => {
        logout();
    });

    function logout() {
        jwtToken = null;
        localStorage.removeItem('jwtToken');
        showAuth();
        setAuthMessage('Logged out successfully.', false);
    }

    registerUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('new-user-email').value;
        const password = document.getElementById('new-user-password').value;
        const role = document.getElementById('new-user-role').value;

        const data = await callApi('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, role })
        });

        if (data && data.userId) {
            setRegisterUserMessage(`User ${email} registered with ID: ${data.userId}`, false);
            registerUserForm.reset();
            fetchUsers(); // Refresh user list
        } else if (data && data.error) {
            setRegisterUserMessage(data.error, true);
        }
    });

    syncCheckBtn.addEventListener('click', async () => {
        syncCheckOutput.textContent = 'Checking sync status...';
        const data = await callApi('/api/sync-check');
        if (data) {
            let html = `Total Profiles in Local DB: ${data.totalProfilesInLocalDB}<br/>`;
            html += `Total On Blockchain: ${data.totalOnBlockchain}<br/>`;
            if (data.unsyncedProfiles && data.unsyncedProfiles.length > 0) {
                html += '<h4>Unsychronized Profiles:</h4><ul>';
                data.unsyncedProfiles.forEach(p => {
                    html += `<li>ID: ${p.id}, Email: ${p.email}, Role: ${p.role}, Wallet: ${p.wallet_id}</li>`;
                });
                html += '</ul>';
                syncCheckOutput.innerHTML = html;
                syncCheckOutput.className = 'error';
            } else {
                html += '<p class="success">All profiles are synchronized with the blockchain.</p>';
                syncCheckOutput.innerHTML = html;
                syncCheckOutput.className = 'success';
            }
        } else {
            syncCheckOutput.textContent = 'Failed to retrieve sync status.';
            syncCheckOutput.className = 'error';
        }
    });

    runSyncBtn.addEventListener('click', async () => {
        runSyncOutput.textContent = 'Running full sync...';
        const data = await callApi('/api/run-sync', { method: 'POST' });
        if (data) {
            let html = '<p>Sync Process Results:</p><ul>';
            data.results.forEach(r => {
                html += `<li>Profile ID: ${r.profileId}, Email: ${r.email}, Status: ${r.status} ${r.transactionHash ? `(TX: ${r.transactionHash})` : ''} ${r.error ? `(Error: ${r.error})` : ''}</li>`;
            });
            html += '</ul>';
            runSyncOutput.innerHTML = html;
            runSyncOutput.className = 'success';
            fetchUsers(); // Refresh user list after sync
        } else {
            runSyncOutput.textContent = 'Failed to run sync process.';
            runSyncOutput.className = 'error';
        }
    });

    // --- Initial Check ---
    if (jwtToken) {
        showDashboard();
    } else {
        showAuth();
    }
}); 