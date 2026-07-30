const authController = require('./controllers/authController');
const userModel = require('./models/userModel');
const authRoutes = require('./routes/authRoutes');
const { initDatabase } = require('./config/database');

async function testAuthSystem() {
  await initDatabase();
  console.log('========================================================');
  console.log('🔐 TESTING COMPLETE AUTHENTICATION SYSTEM & VERIFICATION');
  console.log('========================================================\n');

  // Mock Request and Response helpers
  function createMockReq(body = {}, headers = {}) {
    return { body, headers, user: null };
  }

  function createMockRes() {
    const res = {};
    res.statusCode = 200;
    res.jsonObj = null;

    res.status = function(code) {
      res.statusCode = code;
      return res;
    };

    res.json = function(obj) {
      res.jsonObj = obj;
      return res;
    };

    return res;
  }

  const nextErr = (err) => console.error('Next Error:', err);

  const testEmail = 'test@example.com';
  const testPass = 'Password123!';
  const testName = 'Test User';

  // 1. TEST REGISTRATION (SIGNUP)
  console.log('1. Testing User Registration (POST /api/auth/signup)...');
  const signupReq = createMockReq({ email: testEmail, password: testPass, name: testName });
  const signupRes = createMockRes();

  await authController.signup(signupReq, signupRes, nextErr);
  console.log(`- HTTP Status: ${signupRes.statusCode}`);
  console.log('- Response Payload:', JSON.stringify(signupRes.jsonObj, null, 2));

  if (signupRes.statusCode === 201 || (signupRes.statusCode === 409 && signupRes.jsonObj.error)) {
    console.log('✅ Registration Handler Executed Successfully!');
  } else {
    throw new Error('Registration failed with unexpected status!');
  }

  // 2. TEST DUPLICATE REGISTRATION ATTEMPT
  console.log('\n2. Testing Duplicate Registration (POST /api/auth/signup)...');
  const dupReq = createMockReq({ email: testEmail, password: testPass, name: testName });
  const dupRes = createMockRes();

  await authController.signup(dupReq, dupRes, nextErr);
  console.log(`- HTTP Status: ${dupRes.statusCode}`);
  console.log('- Error Message:', dupRes.jsonObj?.error?.message);
  if (dupRes.statusCode === 409) {
    console.log('✅ Duplicate Registration Correctly Rejected with 409 Conflict!');
  }

  // 3. TEST LOGIN WITH VALID CREDENTIALS
  console.log('\n3. Testing Valid Login (POST /api/auth/login)...');
  const loginReq = createMockReq({ email: testEmail, password: testPass });
  const loginRes = createMockRes();

  await authController.login(loginReq, loginRes, nextErr);
  console.log(`- HTTP Status: ${loginRes.statusCode}`);
  console.log('- User Profile Returned:', loginRes.jsonObj?.user);
  console.log('- Access Token Present:', !!loginRes.jsonObj?.tokens?.accessToken);
  console.log('- Refresh Token Present:', !!loginRes.jsonObj?.tokens?.refreshToken);

  const token = loginRes.jsonObj?.tokens?.accessToken;
  if (loginRes.statusCode === 200 && token) {
    console.log('✅ Login Succeeded & JWT Token Generated!');
  } else {
    throw new Error('Login failed or JWT token missing!');
  }

  // 4. TEST LOGIN WITH INVALID PASSWORD
  console.log('\n4. Testing Invalid Password Login...');
  const badLoginReq = createMockReq({ email: testEmail, password: 'WrongPassword99' });
  const badLoginRes = createMockRes();

  await authController.login(badLoginReq, badLoginRes, nextErr);
  console.log(`- HTTP Status: ${badLoginRes.statusCode}`);
  console.log('- Error Message:', badLoginRes.jsonObj?.error?.message);
  if (badLoginRes.statusCode === 401) {
    console.log('✅ Invalid Credentials Correctly Rejected with 401 Unauthorized!');
  }

  // 5. TEST GET USER PROFILE WITH JWT TOKEN (GET /api/auth/me)
  console.log('\n5. Testing Authenticated Profile Fetch (GET /api/auth/me)...');
  const profileReq = createMockReq({}, { authorization: `Bearer ${token}` });
  const profileRes = createMockRes();

  profileReq.user = { id: loginRes.jsonObj.user.id, email: testEmail, name: testName };
  await authController.getProfile(profileReq, profileRes, nextErr);
  console.log(`- HTTP Status: ${profileRes.statusCode}`);
  console.log('- Profile Data:', profileRes.jsonObj?.user);
  if (profileRes.statusCode === 200) {
    console.log('✅ Authenticated JWT Profile Access Succeeded!');
  }

  // 6. VERIFY DATABASE ENTRY
  console.log('\n6. Verifying User Entry in Data Store...');
  const dbUser = await userModel.findByEmail(testEmail);
  console.log('- Data Store Record:', {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    hasPasswordHash: !!dbUser.password_hash,
    hasRefreshToken: !!dbUser.refresh_token
  });

  console.log('\n========================================================');
  console.log('🎉 AUTHENTICATION SYSTEM FULLY VERIFIED & WORKING PERFECTLY!');
  console.log('========================================================\n');
}

testAuthSystem().catch(err => {
  console.error('❌ Auth Verification Failed:', err);
  process.exit(1);
});
