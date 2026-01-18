const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    id: { type: Number }, // Keeping for backward compatibility/migration logic if needed
    name: { type: String, required: true },
    mobile: { type: String, required: true, unique: true },
    email: { type: String },
    password: { type: String, required: true }
});

module.exports = mongoose.model('User', userSchema);
