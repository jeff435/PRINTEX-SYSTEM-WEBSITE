import dns from 'dns';
dns.setDefaultResultOrder('ipv4first'); // to avoid localhost IPv6 issues on Node 17+

async function runTests() {
  console.log('--- Sync Auth Integration Tests ---');
  
  const baseUrl = 'http://localhost:3000';
  
  // Test 1: Verify health endpoint
  try {
    console.log(`Checking health endpoint at ${baseUrl}/api/health...`);
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthData = await healthRes.json();
    console.log('Health Response Status:', healthRes.status);
    console.log('Health Data:', JSON.stringify(healthData, null, 2));
    if (healthRes.status !== 200) {
      throw new Error(`Health status code is not 200, got ${healthRes.status}`);
    }
  } catch (err) {
    console.error('Test 1 failed (is server running?):', err.message);
    process.exit(1);
  }

  // Test 2: Verify sync status endpoint
  try {
    console.log(`Checking sync status endpoint at ${baseUrl}/api/sync/status...`);
    const statusRes = await fetch(`${baseUrl}/api/sync/status`);
    const statusData = await statusRes.json();
    console.log('Sync Status Response Status:', statusRes.status);
    console.log('Sync Status Data:', JSON.stringify(statusData, null, 2));
    if (statusRes.status !== 200) {
      throw new Error(`Sync status code is not 200, got ${statusRes.status}`);
    }
  } catch (err) {
    console.error('Test 2 failed:', err.message);
    process.exit(1);
  }

  // Test 3: Verify POST /api/sync/push returns 401 when unauthenticated
  try {
    console.log(`Verifying /api/sync/push fails with 401 Unauthorized for unauthenticated requests...`);
    const pushRes = await fetch(`${baseUrl}/api/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parts: [], invoices: [], settings: [], activity: [], submissions: [] })
    });
    const pushData = await pushRes.json();
    console.log('Push Response Status:', pushRes.status);
    console.log('Push Data:', JSON.stringify(pushData, null, 2));
    if (pushRes.status !== 401) {
      throw new Error(`Expected status 401, but got ${pushRes.status}`);
    }
    console.log('Test 3 PASSED ✓');
  } catch (err) {
    console.error('Test 3 failed:', err.message);
    process.exit(1);
  }

  // Test 4: Verify POST /api/sync/delete returns 401 when unauthenticated
  try {
    console.log(`Verifying /api/sync/delete fails with 401 Unauthorized for unauthenticated requests...`);
    const deleteRes = await fetch(`${baseUrl}/api/sync/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store: 'parts', id: 'test-id' })
    });
    const deleteData = await deleteRes.json();
    console.log('Delete Response Status:', deleteRes.status);
    console.log('Delete Data:', JSON.stringify(deleteData, null, 2));
    if (deleteRes.status !== 401) {
      throw new Error(`Expected status 401, but got ${deleteRes.status}`);
    }
    console.log('Test 4 PASSED ✓');
  } catch (err) {
    console.error('Test 4 failed:', err.message);
    process.exit(1);
  }

  console.log('\nAll tests completed successfully!');
}

runTests().catch(err => {
  console.error('Unhandled error in test runner:', err);
  process.exit(1);
});
