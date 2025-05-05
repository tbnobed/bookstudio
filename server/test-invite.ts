import { verifyInviteToken, generateInviteToken, invalidateInviteToken } from "./email";

// Generate a test token
const testToken = generateInviteToken("producer", "test@example.com", 1);
console.log("Generated test token:", testToken);

// Verify the test token
const inviteInfo = verifyInviteToken(testToken);
console.log("Verification result:", inviteInfo);

// Now test the specific token from the URL
const urlToken = "f0755a5c1035b5845891dcf781f3d98e29b498f8941c1a34e7c77f0670645782";
const urlTokenInfo = verifyInviteToken(urlToken);
console.log("URL token verification result:", urlTokenInfo);

// Verify the API endpoint URL format
console.log("API endpoint URL:", `/api/invite/${urlToken}`);
console.log("Frontend route:", `/invite/${urlToken}`);