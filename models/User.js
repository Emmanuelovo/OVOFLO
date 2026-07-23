const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  // Optional now - Google-signed-in users never set a password.
  passwordHash: { type: String, default: null },
  googleId: { type: String, default: null, index: true },
  name: { type: String, default: '' },
  // Stored as a base64 data URL (e.g. "data:image/jpeg;base64,...") - small enough
  // for a profile photo to live directly on the user document without needing a
  // separate file-storage service.
  profilePicture: { type: String, default: '' },
}, { timestamps: true });

UserSchema.methods.setPassword = async function (plainPassword) {
  this.passwordHash = await bcrypt.hash(plainPassword, 10);
};
UserSchema.methods.checkPassword = async function (plainPassword) {
  if (!this.passwordHash) return false; // Google-only account, no password set
  return bcrypt.compare(plainPassword, this.passwordHash);
};
UserSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    email: this.email,
    name: this.name,
    profilePicture: this.profilePicture || '',
    hasPassword: !!this.passwordHash,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', UserSchema);