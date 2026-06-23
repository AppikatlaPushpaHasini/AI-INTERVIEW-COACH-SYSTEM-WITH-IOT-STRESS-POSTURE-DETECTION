const mongoose = require("mongoose");

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 50
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    set: normalizeEmail,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  authProvider: {
    type: String,
    enum: ["google", "password"],
    default: "password"
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  avatarUrl: {
    type: String,
    trim: true
  },
  password: {
    type: String,
    required() {
      return this.authProvider === "password";
    },
    minlength: 6
  }
}, {
  timestamps: true,
  versionKey: false,
  toJSON: {
    transform: (_doc, ret) => {
      delete ret.password;
      return ret;
    }
  },
  toObject: {
    transform: (_doc, ret) => {
      delete ret.password;
      return ret;
    }
  }
});

module.exports = mongoose.model("User", UserSchema);
