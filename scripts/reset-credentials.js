const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// 1. Locate and load MONGODB_URI from .env.local or .env
let mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const match = content.match(/^MONGODB_URI=(.+)$/m);
      if (match) {
        mongoUri = match[1].trim().replace(/^['"]|['"]$/g, '');
        break;
      }
    }
  }
}

if (!mongoUri) {
  console.error('\n❌ Could not find MONGODB_URI in .env.local or process environment.');
  process.exit(1);
}

async function main() {
  try {
    await mongoose.connect(mongoUri);
    const usersCollection = mongoose.connection.collection('users');
    const users = await usersCollection.find({}).toArray();

    if (users.length === 0) {
      console.log('\n⚠️ No users found in the database.');
      await mongoose.disconnect();
      return;
    }

    const args = process.argv.slice(2);
    const newPassword = args[0];
    const targetEmail = args[1];

    if (!newPassword) {
      console.log('\n📋 --- Registered Accounts Found in Database ---');
      users.forEach((u, idx) => {
        console.log(`  ${idx + 1}. Email: ${u.email}`);
        console.log(`     WhatsApp: ${u.whatsappNumber || 'N/A'}`);
        console.log(`     ID: ${u._id}`);
      });

      console.log('\n💡 To reset your password, run:');
      console.log('   node scripts/reset-credentials.js <new_password> [email]');
      console.log('   Example:');
      console.log(`   node scripts/reset-credentials.js MyNewPass123 ${users[0].email}\n`);
      await mongoose.disconnect();
      return;
    }

    const targetUser = targetEmail
      ? users.find((u) => u.email.toLowerCase() === targetEmail.toLowerCase().trim())
      : users[0];

    if (!targetUser) {
      console.error(`\n❌ No user found matching email "${targetEmail}".`);
      await mongoose.disconnect();
      process.exit(1);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await usersCollection.updateOne(
      { _id: targetUser._id },
      { $set: { passwordHash } }
    );

    console.log('\n✅ Success!');
    console.log(`   Account Email : ${targetUser.email}`);
    console.log(`   New Password  : ${newPassword}`);
    console.log('\nYou can now log in at http://localhost:3000/login\n');

    await mongoose.disconnect();
  } catch (err) {
    console.error('\n❌ Error connecting or updating database:', err.message);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  }
}

main();
