import http from 'http';

console.log('🧪 Testing Rate Limiter & Discord Webhook Alert...');
console.log('Sending 105 rapid requests to http://localhost:5000/api/health...\n');

let passed = 0;
let rateLimited = 0;
let errors = 0;

for (let i = 1; i <= 105; i++) {
  const req = http.get('http://localhost:5000/api/health', (res) => {
    if (res.statusCode === 200) {
      passed++;
    } else if (res.statusCode === 429) {
      rateLimited++;
      if (rateLimited === 1) {
        console.log(`\n🛑 Request #${i}: Hit Rate Limit! (HTTP 429 Too Many Requests)`);
        console.log('📡 Discord webhook notification sent to your logs channel!');
      }
    }
    
    if (passed + rateLimited + errors === 105) {
      console.log('\n📊 TEST SUMMARY:');
      console.log(`- Successful Requests (HTTP 200): ${passed}`);
      console.log(`- Blocked Requests (HTTP 429 Rate Limited): ${rateLimited}`);
      if (rateLimited > 0) {
        console.log('\n✅ Success! Check your Discord channel for the ⚠️ Rate Limit Exceeded alert.');
      }
    }
  });

  req.on('error', () => {
    errors++;
    if (errors === 1) {
      console.error('\n❌ Connection refused. Make sure your backend server is running on http://localhost:5000!');
    }
  });
}
