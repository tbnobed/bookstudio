import { generateInviteToken } from "./email";

// The email and role information should match what was originally sent in the invite
const email = "tbnapps@gamil.com";
const role = "producer";
const adminId = 1; // The ID of the admin user who created the invite

// Generate a new persistent token
const token = generateInviteToken(role, email, adminId);

console.log("======================================");
console.log("New invite link generated for testing:");
console.log("======================================");
console.log(`Email: ${email}`);
console.log(`Role: ${role}`);
console.log(`Token: ${token}`);
console.log(`\nFull invite URL: /invite/${token}`);
console.log("======================================");