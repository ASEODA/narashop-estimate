const axios = require('axios');

async function testHistory() {
    try {
        console.log('Testing History API...');

        // 1. Check History without Auth (Should fail or return 401/redirect)
        try {
            await axios.get('http://localhost:3000/api/history');
            console.error('❌ FAIL: Accessed history without auth');
        } catch (e) {
            if (e.response && e.response.status === 401) {
                console.log('✅ PASS: Unauthorized access blocked (401)');
            } else {
                console.log('Context: Might have redirected to login.html (200 OK HTML)');
            }
        }

        // 2. Check History WITH Auth
        const axiosConfig = {
            headers: { 'Cookie': 'auth_token=valid_session' }
        };
        const res = await axios.get('http://localhost:3000/api/history', axiosConfig);

        if (Array.isArray(res.data)) {
            console.log('✅ PASS: Retrieved history list');
            console.log('History Items:', res.data.length);
            if (res.data.length > 0) {
                console.log('Latest Item:', res.data[0]);
            }
        } else {
            console.error('❌ FAIL: Invalid history format');
        }

    } catch (e) {
        console.error('Test Error:', e.message);
    }
}

testHistory();
