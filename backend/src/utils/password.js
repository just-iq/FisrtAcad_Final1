const bcrypt = require("bcryptjs");

const DEFAULT_ROUNDS = 12;

async function hashPassword(plain) {
  return await bcrypt.hash(plain, DEFAULT_ROUNDS);
}

async function verifyPassword(plain, passwordHash) {
  return await bcrypt.compare(plain, passwordHash);
}

module.exports = { hashPassword, verifyPassword };

