import { verifyInviteToken, generateInviteToken, invalidateInviteToken } from "./email";

// Main async test function
async function runTest() {
  // Generate a new test token
  const testToken = await generateInviteToken("producer", "test@example.com", 1);
  console.log("Generated test token:", testToken);

  // Verify the new test token
  const inviteInfo = await verifyInviteToken(testToken);
  console.log("Verification result:", inviteInfo);
  
  // Test the invite token API flow
  console.log("API endpoint URL:", `/api/invite/${testToken}`);
  console.log("Frontend route:", `/invite/${testToken}`);
}

// Run the main test
runTest().catch(err => {
  console.error("Error running test:", err);
});