import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Name is required"], trim: true, minlength: 2, maxlength: 60 },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true, // creates a unique index on email
      lowercase: true,
      trim: true,
    },
    // select:false => password is NOT returned by queries unless we ask: .select("+password")
    password: { type: String, required: [true, "Password is required"], minlength: 8, select: false },
    profilePhoto: { type: String, default: "" },
    role: { type: String, enum: ["employee", "admin"], default: "employee" },

    // Location is stored only after the employee gives consent.
    locationConsent: { type: Boolean, default: false },
    location: {
      latitude: { type: Number, min: -90, max: 90 },
      longitude: { type: Number, min: -180, max: 180 },
      updatedAt: Date,
    },

    status: { type: String, enum: ["online", "inactive", "offline"], default: "offline" },
    lastActivity: Date,
    statusUpdatedAt: Date,
  },
  { timestamps: true } // adds createdAt and updatedAt automatically
);

// Index: admin dashboard filters by status
userSchema.index({ status: 1 });
// Index: admin dashboard lists employees by role
userSchema.index({ role: 1 });

// Hash the password before saving (only when it is new or changed).
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Compare a plain password with the stored hash.
userSchema.methods.matchPassword = function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

export default mongoose.model("User", userSchema);
