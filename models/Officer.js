const mongoose = require('mongoose');

const officerSchema = new mongoose.Schema({
    id: { type: Number }, // Keeping for backward compatibility
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    rights: [{ type: String }], // Array of strings like ['BIRTH', 'GRIEVANCE']
    department: { type: String } // Optional department
});

module.exports = mongoose.model('Officer', officerSchema);
